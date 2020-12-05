import _path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import regedit from 'regedit';
import fstemp from './fstemp';

// TODO: 代理相关代码优化
/**
 * 通过cmd操作注册表 https://blog.csdn.net/hongkaihua1987/article/details/89414691
 * 通过脚本控制代理信息刷新 https://stackoverflow.com/questions/45371133/changes-to-proxy-settings-in-windows-registry-have-no-effect
 * 恢复代理的使用脚本链接 https://superuser.com/questions/809864/windows-script-to-toggle-automatic-configuration-script-checkbox-without-removin
 */

interface Result {
  error: number;
  data?: any;
  message?: string;
}

/**
 * Enforces Sys Proxy - 刷新代理配置，使注册表配置生效
 */
function enforceSysProxy(): boolean {
  const tempFilename = 'refresh-system-setting.ps1';

  if (!fstemp.exists(tempFilename)) {
    fstemp.writeFile(
      tempFilename,
      `$signature = @'
          [DllImport("wininet.dll", SetLastError = true, CharSet=CharSet.Auto)]
          public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
      '@
      $INTERNET_OPTION_SETTINGS_CHANGED = 39
      $type = Add-Type -MemberDefinition $signature -Name wininet -Namespace pinvoke -PassThru
      $result = $type::InternetSetOption(0, $INTERNET_OPTION_SETTINGS_CHANGED, 0, 0)
      echo $result`
    );
  }

  try {
    const result = execSync(
      `powershell -ExecutionPolicy Bypass -Command "${fstemp.getAbsPath(
        tempFilename
      )}"`
    );
    return result.toString().toLowerCase().indexOf('true') === 0;
  } catch (e) {
    return false;
  }
}

export default {
  /**
   * Import Root Cert - 导入根证书到系统中
   *
   * @param {string} path - 存放根证书的路径
   *
   * @return {boolean} - 是否导入成功
   */
  importRootCert(path: string): boolean {
    const pathObj = _path.parse(path);
    const cmd = `powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c cd ${pathObj.dir} && certutil -addstore -f root ${pathObj.base}'"`;

    try {
      execSync(cmd);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Start System Proxy - 启动系统代理
   *
   * @param {number} [port=8888] 代理服务监听端口
   * @param {boolean} [isProxyHttps=false] 是否代理HTTPS服务
   *
   * @return {Promise} 启动系统代理结果
   *
   * @description 返回结果Promise中，data为读取reg注册表的信息，需要自行备份。
   * error不为零，代表启动失败，可通过message查看失败原因。
   */
  startSysProxy(port: number, isProxyHttps: boolean = false): Promise<Result> {
    const tempFilename = 'regedit-inet-values.json';
    const getRegList = process.arch === 'x64' ? regedit.arch.list64 : regedit.arch.list32;
    const REG_INET_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

    return new Promise((resolve, reject) => {
      getRegList(REG_INET_KEY, (err1: any, result: any) => {
        if (err1) {
          return reject({ error: 1, message: '读取注册表代理信息失败' });
        }

        // 设置系统网络接口代理至mock系统
        regedit.putValue(
          {
            [REG_INET_KEY]: {
              ProxyEnable: { type: 'REG_DWORD', value: 1 },
              ProxyOverride: { type: 'REG_SZ', value: '<-loopback>' },
              ProxyServer: {
                type: 'REG_SZ',
                value: `http=127.0.0.1:${port}${isProxyHttps ? ';https=127.0.0.1:' + port : ''
                  }`,
              },
              AutoConfigURL: { type: 'REG_SZ', value: '' },
              AutoDetect: { type: 'REG_DWORD', value: 0 },
            },
          },
          (err2: any) => {
            if (err2) {
              return reject({ error: 2, message: '设置系统网络代理配置失败' });
            }

            if (!enforceSysProxy()) {
              return reject({ error: 3, message: '代理配置更新失败' });
            }

            // Tips: 如果存在，不允许覆盖
            if (!fstemp.exists(tempFilename)) {
              fstemp.writeJSON(tempFilename, { [REG_INET_KEY]: (result[REG_INET_KEY] || {}).values });
            }

            resolve({ error: 0, message: '代理配置已更新' });
          }
        );
      });
    });
  },

  /**
   * Stop System Proxy - 关闭系统代理
   *
   * @return {Promise} 关闭系统代理结果
   *
   * @description 返回结果Promise中，data为成功设置到系统注册表中的代理配置。
   * error不为零，代表关闭失败，可通过message查看失败原因。
   */
  stopSysProxy(): Promise<Result> {
    return new Promise((resolve, reject) => {
      const tempFilename = 'regedit-inet-values.json';
      const REG_INET_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

      let inetValues: object = {
        [REG_INET_KEY]: {
          ProxyEnable: { type: 'REG_DWORD', value: 0 },
          ProxyOverride: { type: 'REG_SZ', value: '' },
          ProxyServer: { type: 'REG_SZ', value: '' },
        },
      };

      // Tips: 如果存在，直接恢复
      if (fstemp.exists(tempFilename)) {
        inetValues = fstemp.readJSON(tempFilename);
      }

      regedit.putValue(inetValues, (err: any) => {
        if (err) {
          return reject({ error: 2, message: '重置网络代理配置失败' });
        }

        if (!enforceSysProxy()) {
          return reject({ error: 3, message: '代理配置更新失败' });
        }

        // Tips: 恢复配置后，删除备份
        fstemp.delete(tempFilename);

        resolve({ error: 0, message: '代理配置已更新' });
      });
    });
  },
};
