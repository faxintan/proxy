import _path from 'path';
import { execSync } from 'child_process';
// @ts-ignore
import regedit from 'regedit';

const REG_INET_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

interface Result {
  error: number;
  data?: any;
  message?: string;
}

/**
 * Enforces Sys Proxy - 刷新代理配置，使注册表配置生效
 */
function enforceSysProxy(): boolean {
  const winffi = require('@fxtop/winffi');

  try {
    // const INTERNET_OPTION_REFRESH = 37
    const INTERNET_OPTION_SETTINGS_CHANGED = 39;
    const inet = winffi.Library('wininet', {
      InternetSetOptionW: ['bool', ['int', 'int', 'int', 'int']],
    });

    // Tips: 刷新注册表后，无法再通过regedit.putValue更新注册表信息
    // inet.InternetSetOptionW(0, INTERNET_OPTION_REFRESH, 0, 0);
    inet.InternetSetOptionW(0, INTERNET_OPTION_SETTINGS_CHANGED, 0, 0);

    return true;
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
    const getRegList =
      process.arch === 'x64' ? regedit.arch.list64 : regedit.arch.list32;

    return new Promise((resolve, reject) => {
      getRegList(REG_INET_KEY, (err1: any, result: any) => {
        if (err1)
          return reject({ error: 1, message: '读取注册表代理信息失败' });

        // 设置系统网络接口代理至mock系统
        regedit.putValue(
          {
            [REG_INET_KEY]: {
              ProxyEnable: { type: 'REG_DWORD', value: 1 },
              ProxyOverride: { type: 'REG_SZ', value: '<-loopback>' },
              ProxyServer: {
                type: 'REG_SZ',
                value: `http=127.0.0.1:${port}${
                  isProxyHttps ? ';https=127.0.0.1:' + port : ''
                }`,
              },
              AutoConfigURL: { type: 'REG_SZ', value: '' },
              AutoDetect: { type: 'REG_DWORD', value: 0 },
            },
          },
          (err2: any) => {
            if (err2)
              return reject({ error: 2, message: '设置系统网络代理配置失败' });

            if (!enforceSysProxy())
              return reject({ error: 3, message: '代理配置未生效' });

            resolve({
              error: 0,
              data: { [REG_INET_KEY]: (result[REG_INET_KEY] || {}).values },
            });
          }
        );
      });
    });
  },

  /**
   * Stop System Proxy - 关闭系统代理
   *
   * @param {any} regData - 网络代理配置(恢复代理前的配置)
   *
   * @return {Promise} 关闭系统代理结果
   *
   * @description 返回结果Promise中，data为成功设置到系统注册表中的代理配置。
   * error不为零，代表关闭失败，可通过message查看失败原因。
   */
  stopSysProxy(regData?: any): Promise<Result> {
    return new Promise((resolve, reject) => {
      let data = regData;

      if (!data || !data[REG_INET_KEY]) {
        data = {
          [REG_INET_KEY]: {
            ProxyEnable: { type: 'REG_DWORD', value: 0 },
            ProxyOverride: { type: 'REG_SZ', value: '' },
            ProxyServer: { type: 'REG_SZ', value: '' },
          },
        };
      }

      regedit.putValue(data, (err: any) => {
        if (err) return reject({ error: 2, message: '重置网络代理配置失败' });

        if (!enforceSysProxy())
          return reject({ error: 3, message: '代理配置未生效' });

        resolve({ error: 0, data });
      });
    });
  },
};
