import fstemp from './fstemp';
import mkcert from './mkcert';
import syswin from './syswin';
import sysmac from './sysmac';

export interface Result {
  error: number;
  data?: any;
  message?: string;
}

function getSystemName(): string {
  const opsys = process.platform.toLowerCase();

  if (opsys == 'darwin') return 'MacOS';

  if (opsys == 'linux') return 'Linux';

  if (opsys == 'win32' || opsys == 'win64') return 'Windows';

  return '';
}

export default {
  /**
   * Get System Name - 获取系统名称
   *
   * @return {String} sysName - 系统名称
   */
  getSystemName,

  /**
   * Trust Root Cert - 导入系统证书
   * @param {string} [path] - 存放跟证书的绝对路径
   * @returns {Promise} 导入结果
   */
  trustRootCert(path?: string): Promise<Result> {
    const sysName = getSystemName();
    const TEMP_CA_CERT_FILE = 'temp-cacert.pem';

    return new Promise((resolve, reject) => {
      if (!path && !fstemp.exists(TEMP_CA_CERT_FILE)) {
        const ca = mkcert.getDefaultCA();
        fstemp.writeFile(TEMP_CA_CERT_FILE, ca.caCert);
      }

      switch (sysName) {
        case 'Windows':
          syswin.importRootCert(path || fstemp.getAbsPath(TEMP_CA_CERT_FILE))
            ? resolve({ error: 0, data: path })
            : reject({ error: 21, message: '导入根证书失败' });
          break;
        case 'MacOS':
          sysmac.importRootCert(path || fstemp.getAbsPath(TEMP_CA_CERT_FILE))
            ? resolve({ error: 0, data: path })
            : reject({ error: 21, message: '导入根证书失败' });
          break;
        default:
          return reject({ error: 10, message: '未匹配到该系统的处理' });
      }
    });
  },

  /**
   * Start System Proxy - 启动系统代理
   *
   * @param {number} [port=8888] 代理服务监听端口
   * @param {boolean} [isProxyHttps=false] 是否代理HTTPS服务
   *
   * @return {Promise} 启动系统代理结果
   *
   * @description 返回结果Promise中，error不为零，代表启动失败，可通过message查看失败原因。
   */
  startSysProxy(
    port: number = 8888,
    isProxyHttps: boolean = false
  ): Promise<Result> {
    const sysName = getSystemName();

    switch (sysName) {
      case 'Windows':
        return syswin.startSysProxy(port, isProxyHttps);
      case 'MacOS':
        return sysmac.startSysProxy(port, isProxyHttps);
      default:
        return Promise.reject({ error: 10, message: '未匹配到该系统的处理' });
    }
  },

  /**
   * Stop System Proxy - 关闭系统代理
   *
   * @return {Promise} 关闭系统代理结果
   *
   * @description 返回结果Promise中，error不为零，代表关闭失败，可通过message查看失败原因。
   */
  stopSysProxy(): Promise<Result> {
    const sysName = getSystemName();

    switch (sysName) {
      case 'Windows':
        return syswin.stopSysProxy();
      case 'MacOS':
        return sysmac.stopSysProxy();
      default:
        return Promise.reject({ error: 10, message: '未匹配到该系统的处理' });
    }
  },
};
