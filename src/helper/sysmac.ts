import { execSync } from 'child_process';

interface Result {
  error: number;
  data?: any;
  message?: string;
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
    try {
      execSync(
        `security add-trusted-cert -k ~/Library/Keychains/login.keychain ${path}`
      );
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
   * @description 返回结果Promise中，error不为零，代表启动失败，可通过message查看失败原因。
   */
  startSysProxy(port: number, isProxyHttps: boolean = false): Promise<Result> {
    return new Promise((resolve, reject) => {
      try {
        execSync(`networksetup -setwebproxy "Wi-Fi" 127.0.0.1 ${port}`);
        isProxyHttps &&
          execSync(`networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 ${port}`);
        resolve({ error: 0, data: {} });
      } catch (e) {
        console.log('err', e);
        reject({ error: 2, message: '设置系统网络代理配置失败' });
      }
    });
  },

  /**
   * Stop System Proxy - 关闭系统代理
   *
   * @param {any} regData - 网络代理配置(恢复代理前的配置)
   *
   * @return {Promise} 关闭系统代理结果
   *
   * @description 返回结果Promise中，error不为零，代表关闭失败，可通过message查看失败原因。
   */
  stopSysProxy(): Promise<Result> {
    return new Promise((resolve, reject) => {
      try {
        const closeHttpProxy = `networksetup -setwebproxystate "Wi-Fi" off`;
        const closeHttpsProxy = `networksetup -setsecurewebproxystate "Wi-Fi" off`;
        execSync(`${closeHttpProxy} && ${closeHttpsProxy}`);
        resolve({ error: 0, data: {} });
      } catch (e) {
        reject({ error: 2, message: '设置系统网络代理配置失败' });
      }
    });
  },
};
