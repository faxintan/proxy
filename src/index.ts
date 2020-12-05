import net from 'net';
import tls from 'tls';
import http from 'http';
import https from 'https';
import sys from './helper/sys';
import mkcert from './helper/mkcert';

const DEFAULT_HTTP_PORT = 8888;
const DEFAULT_HTTPS_PORT = 8889;
const NOTIFIER = 'Fast-Proxy Server';

class Proxy {
    /**
     * Status - 代理服务状态
     */
    status: string;
    /**
     * Options - 初始化配置信息
     */
    private options: Proxy.Options;

    /**
     * Lifecycle - 请求代理声明周期
     */
    private lifecycle: Proxy.Lifecycle;

    /**
     * httpProxy - HTTP代理服务实例
     */
    private httpProxy: http.Server | undefined;

    /**
     * httpsProxy - HTTPS代理服务实例(解析密文)
     */
    private httpsProxy: https.Server | undefined;

    /**
     * Sockets - 收集代理服务过程中产生的套接字(主动断开链接)
     */
    private httpSockets: Set<net.Socket> = new Set();
    private httpsSockets: Set<net.Socket> = new Set();

    /**
     * Creates an instance of proxy.
     * 
     * @param {Proxy.Options} options - 代理初始化配置信息
     * @param {Proxy.Lifecycle} lifecycle - 代理的生命周期钩子
     */
    constructor(options: Proxy.Options, lifecycle: Proxy.Lifecycle = {}) {
        this.options = options;
        this.lifecycle = lifecycle;

        options.autoStart && this.start();
    }
    
    /**
     * Start Proxy - 启动代理服务
     */
    start() {
        // 端口占用校验 httpPort, httpsPort
        this.lifecycle.beforeStart?.(this.options);

        if ('start' !== this.status) {
            this.gateway();
            this.status = 'start';
        }

        this.lifecycle.afterStart?.();
    }

    /**
     * Gateway - 开启Http(s)代理网关
     */
    protected gateway() {
        const { httpPort = DEFAULT_HTTP_PORT } = this.options;

        this.httpProxy = http.createServer().listen(httpPort, () => {
            console.log(`${NOTIFIER} listen on ${httpPort}...`);
        });

        // http服务代理
        this.httpProxy.on('request', this.handleHttpRequest.bind(this));

        // https服务代理(通过http的connect方式，请求与https服务建立tunnel)
        this.httpProxy.on('connect', this.handleTunnelConnect.bind(this));

        this.handleRedundantEvent(this.httpProxy, 'http');
    }

    /**
     * Handles httpRequest - Http请求代理处理
     * 
     * @param {http.IncomingMessage} req - 请求信息
     * @param {http.ServerResponse} res - 响应信息
     */
    protected handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        if (!req.url) return res.end('Empty');

        const url = req.url[0] === '/' ? `http://${req.headers.host}${req.url}` : req.url;
        const { hostname, pathname, port } = new URL(url);

        const options = {
            hostname,
            path: pathname,
            method: req.method,
            headers: req.headers,
            port: parseInt(port || '80'),
        };

        // 代理服务向目标服务发起请求前
        if (this.lifecycle.beforeRequest?.(req, res, options)) return;

        const proxy = http.request(options, (proxyRes) => {
            // 代理服务向目标服务发起请求后，并建立链接
            if (this.lifecycle.afterRequest?.(req, res, proxyRes)) return;

            // 代理获取响应数据后，透传至源服务器前
            if (this.lifecycle.beforeResponse?.(req, res, proxyRes)) return;

            res.writeHead(proxyRes.statusCode as number, proxyRes.headers);

            let size = 0;
            const chunks: Buffer[] = [];

            proxyRes.on('data', (chunk) => {
                size += chunk.length;
                chunks.push(chunk);
                res.write(chunk);
            });

            proxyRes.on('end', () => {
                res.end();

                // 代理获取响应数据后，透传至源服务器后
                const resData = {  
                    chunks: Buffer.concat(chunks, size),
                    encoding: proxyRes.headers['content-encoding'] || '',
                };

                if (this.lifecycle.afterResponse?.(req, res, resData)) return;
            });
        });

        proxy.on('timeout', () => {
            console.log(`${NOTIFIER}: connect ${hostname}${pathname} timeout !`)
        });

        proxy.on('error', (error) => {
            console.log(`${NOTIFIER}: proxy to ${hostname}${pathname} error !\n`, error);
        });

        req.pipe(proxy);
    }

    /**
     * Handles httpRequest - Https请求代理处理
     * 
     * @param {http.IncomingMessage} req - 请求信息
     * @param {http.ServerResponse} res - 响应信息
     */
    protected handleHttpsRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const options = {
            method: req.method,
            headers: req.headers,
            hostname: req.headers.host,
            path: req.url || '/',
            port: 443,
        };

        // 代理服务向目标服务发起请求前
        if (this.lifecycle.beforeRequest?.(req, res, options)) return;

        const proxy = https.request(options, (proxyRes) => {
            // 代理服务向目标服务发起请求后，并建立链接
            if (this.lifecycle.afterRequest?.(req, res, proxyRes)) return;

            // 代理获取响应数据后，透传至源服务器前
            if (this.lifecycle.beforeResponse?.(req, res, proxyRes)) return;

            res.writeHead(proxyRes.statusCode as number, proxyRes.headers);

            let size = 0;
            const chunks: Buffer[] = [];

            proxyRes.on('data', (chunk) => {
                size += chunk.length;
                chunks.push(chunk);
                res.write(chunk);
            });

            proxyRes.on('end', () => {
                res.end();

                // 代理获取响应数据后，透传至源服务器后
                const resData = {  
                    chunks: Buffer.concat(chunks, size),
                    encoding: proxyRes.headers['content-encoding'] || '',
                };

                if (this.lifecycle.afterResponse?.(req, res, resData)) return;
            });
        });

        proxy.on('timeout', () => {
            console.log(`${NOTIFIER}: connect ${req.headers.host}${req.url} timeout !`)
        });

        proxy.on('error', (error) => {
            console.log(`${NOTIFIER}: proxy to ${req.headers.host}${req.url} error !\n`, error);
        });

        req.pipe(proxy);
    }

    /**
     * Handles Tunnel connect - 为HTTPS请求建立tunnel隧道
     * 
     * @param {http.IncomingMessage} req - 请求头信息
     * @param {net.Socket} client - socket信息
     */
    protected handleTunnelConnect(req: http.IncomingMessage, client: net.Socket/* , head: http.IncomingHttpHeaders */) {
        const { httpsPort = DEFAULT_HTTPS_PORT, ca } = this.options;

        const server = new net.Socket();
        const urlObj = new URL(`https://${req.headers.host}`);
        const isNeedProxy = this.lifecycle.beforeConnect?.(urlObj);
        const { hostname, port } = isNeedProxy ? new URL(`https://localhost:${httpsPort}`) : urlObj;        

        // 创建可信任https服务代理用于解析密文
        if (isNeedProxy && !this.httpsProxy ) {
            this.httpsProxy = Proxy.createHttpsProxy(ca);

            this.httpsProxy.on('request', this.handleHttpsRequest.bind(this));

            this.httpsProxy.listen(httpsPort, () => {
                console.log(`${NOTIFIER}(https) listen on ${httpsPort}...`);
            });

            this.handleRedundantEvent(this.httpsProxy, 'https');
        }

        // 透明代理，如果域名需要代理则代理至httpsProxy中
        server.connect(parseInt(port || '443'), hostname as string, () => {
            client.write(
                `HTTP/${req.httpVersion} 200 Connection established\r\n` +
                'Proxy-agent: FXTop\r\n' +
                '\r\n'
            );

            // browser send data to target server
            client.on('data', (chunk) => { server.write(chunk) });
            client.on('end', () => { server.end() });
            client.on('close', () => { server.end(); server.destroy(); });
            client.on('error', () => { server.end(); server.destroy(); });
            
            // target server send data back to browser
            server.on('data', (chunk) => { client.write(chunk); });
            server.on('end', () => { client.end(); });
            server.on('close', () => { client.end(); client.destroy(); });
            server.on('error', () => { client.end(); client.destroy(); });
        });
    }

    /**
     * Handles RedundantEvent - 处理Http(s)服务实例中非代理相关的事件
     * 
     * @param {http.Server | https.Server} server - 服务实例
     * @param {'http' | 'https'} type - 服务实例类型
     */
    protected handleRedundantEvent(server: http.Server | https.Server, type: 'http' | 'https') {
        server.on('connection', (socket: net.Socket) => {
            const sockets = type === 'http' ? this.httpSockets : this.httpsSockets;

            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
        });

        server.on('timeout', () => {
            console.log(`${NOTIFIER}(${type}) timeout !`);
        });

        this.httpProxy?.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`${NOTIFIER}(${type}) port is occupied !`);
            } else {
                console.log(`${NOTIFIER}(${type}) Error: `, err);
            }
        });
    }

    /**
     * Reset Proxy - 重置代理配置
     * 
     * @param {Proxy.Options} options - 更改代理配置信息
     * @param {Proxy.Lifecycle} lifecycle - 代理生命周期钩子
     */
    reset(options: Proxy.Options, lifecycle: Proxy.Lifecycle = {}) {
        this.options = Object.assign(this.options, options);
        this.lifecycle = Object.assign(this.lifecycle, lifecycle);

        // 重启服务
        this.close();
        this.start();
    }

    /**
     * Close Proxy - 销毁代理服务实例
     */
    close() {
        this.lifecycle.beforeClose?.();

        // 服务端主动关闭所有链接
        this.httpSockets.forEach((socket) => socket.destroy());
        this.httpsSockets.forEach((socket) => socket.destroy());

        // 解除对socket引用，释放内存
        this.httpSockets.clear();
        this.httpsSockets.clear();

        // 停止接受新的链接请求
        this.httpProxy?.close();
        this.httpsProxy?.close();

        // 接触对Server引用，释放内存
        this.httpProxy = undefined;
        this.httpsProxy = undefined;

        this.lifecycle.afterClose?.();

        this.status = 'closed';
    }

    static createHttpsProxy(ca?: Proxy.CA): https.Server {
        const cache: Map<string, tls.SecureContext > = new Map();

        return https.createServer({
            SNICallback: async (domain, callback)  => {
                if (cache.has(domain)) {
                    if (!callback) return cache.get(domain);
                    return callback(null, cache.get(domain) as tls.SecureContext);
                } else {
                    const cert = await Proxy.createCert(domain, ca);

                    cache.set(domain, tls.createSecureContext(cert));

                    if (!callback) return cache.get(domain);
                    return callback(null, cache.get(domain) as tls.SecureContext);
                }
            }
        });
    }

    /**
     * Creates CA - 创建根证书
     * 
     * @param {InfoCA} info - 根证书信息
     * @param {string} [info.organization='FXTOp'] - 组织
     * @param {string} [info.countryCode='CN'] - 国家
     * @param {string} [info.state='GuangDong'] - 省份
     * @param {string} [info.locality='ShenZhen'] - 城市
     * @param {number} [info.validityDays=365] - 有效期
     * 
     * @returns ca 根证书
     */
    static createCA = mkcert.createCA

        /**
     * Gets Default CA - 获取默认根证书
     * 
     * @returns {CA} 默认根证书
     */
    static getDefaultCA = mkcert.getDefaultCA

    /**
     * Create Cert - 创建授权证书
     * 
     * @param {CA} ca - 根证书(授权)
     * @param {string} domain - 证书域名
     * @param {number} [days=365] - 证书有效期
     */
    static createCert = mkcert.createCert

    /**
     * Trust Root Cert - 导入根证书到系统中
     * 
     * @param {string} path - 存放根证书的路径
     * 
     * @return {boolean} - 是否导入成功
     */
    static trustRootCert = sys.trustRootCert

    /**
     * Start System Proxy - 启动系统代理
     * 
     * @param {number} [port=8888] 代理服务监听端口
     * 
     * @return {Promise} 启动系统代理结果
     * 
     * @description 返回结果Promise中，error不为零，代表启动失败，可通过message查看失败原因。
     */
    static startSysProxy = sys.startSysProxy

    /**
     * Stop System Proxy - 关闭系统代理
     * 
     * @return {Promise} 关闭系统代理结果
     * 
     * @description 返回结果Promise中，error不为零，代表关闭失败，可通过message查看失败原因。
     */
    static stopSysProxy = sys.stopSysProxy
}

process.on('uncaughtException', (err) => {
    console.error(`uncaught error: \nname: ${err.name}, \nmessage: ${err.message}\n`);
});

export default Proxy;

export { Proxy };

/**
 * Proxy - HTTP(S)代理
 */
declare namespace Proxy {
    /**
     * Options - 代理初始化配置
     * 
     * @param {number} [httpPort=8888] - http代理服务监听端口
     * @param {number} [httpsPort=8889] - https代理服务监听端口
     * @param {CA} [ca] - CA签名证书和私钥，启动https服务代理必须设置该参数
     * @param {boolean} [autoStart=false] - 是否在实例化后立即启动代理
     */
    export interface Options {
        ca?: CA,
        httpPort?: number,
        httpsPort?: number,
        autoStart?: boolean,
    }

    /**
     * CA - 权威机构数字证书和私钥
     * 
     * @param {string} caCert - 签名证书
     * @param {string} caKey - CA私钥
     */
    export interface CA {
        caCert: string,
        caKey: string,
    }

    /**
     * Lifecycle - 代理服务声明周期
     * 
     * @param {Function} beforeStart - 代理服务启动前
     * @param {Function} afterStart - 代理服务启动后
     * @param {Function} beforeConnect - 代理为HTTPS通讯建立Tunnel前
     * @param {Function} beforeRequest - 代理服务向目标服务发起请求前
     * @param {Function} afterRequest - 代理服务向目标服务发起请求后(建立链接)
     * @param {Function} beforeResponse - 代理透传响应数据至源服务器前
     * @param {Function} afterResponse - 代理透传响应数据至源服务器后
     * @param {Function} beforeClose - 关闭代理服务前
     * @param {Function} afterClose - 关闭代理服务后
     */
    export interface Lifecycle {
        /**
         * Before Proxy Start - 代理服务启动前
         * 
         * @param {Proxy.Options} options - 代理服务初始化配置信息
         * 
         * @description 修改初始化配置信息，改变代理服务启动的行为，如监听端口等等
         */
        beforeStart?(options: Proxy.Options): void

        /**
         * After Proxy Start - 代理服务启动后
         */
        afterStart?(): void

        /**
         * Before Https Tunnel Connect - 建立通讯隧道前
         * 
         * @param {URL} urlObj - 请求URL信息
         * 
         * @return {boolean} isNeedProxy - 是否需要进行代理
         */
        beforeConnect?(urlObj: URL): boolean

        /**
         * Before Proxy Request - 代理服务向目标服务发起请求前
         * 
         * @param {http.IncomingMessage} request - 来源服务的请求信息实例
         * @param {http.ServerResponse} response - 来源服务的响应控制实例
         * @param {http.RequestOptions} proxyOption - 代理请求配置信息
         * @return {boolean} isBreakOff - 是否中断，自行处理后续流程
         * 
         * @description 通过更改proxyOption配置，改变请求的目标服务器、路径、方法等等
         */
        beforeRequest?(request: http.IncomingMessage, response: http.ServerResponse, proxyOption: http.RequestOptions): boolean

        /**
         * After Proxy Request - 代理服务向目标服务发起请求后
         * 
         * @param {http.IncomingMessage} request - 来源服务的请求信息实例
         * @param {http.ServerResponse} response - 来源服务的响应控制实例
         * @param {http.IncomingMessage} proxyResponse - 代理服务的响应控制实例
         * @return {boolean} isBreakOff - 是否中断，自行处理后续流程
         * 
         * @description 通过proxyResponse可获取目标服务发送的响应信息和传输数据，并通过pipe管道透传至来源服务端
         */
        afterRequest?(request: http.IncomingMessage, response: http.ServerResponse, proxyResponse: http.IncomingMessage): boolean

        /**
         * Before Proxy Response - 代理服务透传响应数据给来源服务器前
         * 
         * @param {http.IncomingMessage} request - 来源服务的请求信息实例
         * @param {http.ServerResponse} response - 来源服务的响应控制实例
         * @param {http.IncomingMessage} proxyResponse - 代理服务的响应控制实例
         * @return {boolean} isBreakOff - 是否中断，自行处理后续流程
         * 
         * @description proxyResponse中指定了chunks的加密方式，需要使用相应的解密方式解析chunks内容
         */
        beforeResponse?(req: http.IncomingMessage, res: http.ServerResponse, proxyResponse: http.IncomingMessage): boolean

        /**
         * After Proxy Response - 代理服务透传响应数据给来源服务器后
         * 
         * @param {http.IncomingMessage} request - 来源服务的请求信息实例
         * @param {http.ServerResponse} response - 来源服务的响应控制实例
         * @param {ResponseBody} responseData - 目标服务传输过来的响应体数据
         * @return {boolean} isBreakOff - 是否中断，自行处理后续流程
         * 
         * @description proxyResponse中指定了chunks的加密方式，需要使用相应的解密方式解析chunks内容
         */
        afterResponse?(request: http.IncomingMessage, response: http.ServerResponse, responseData: ResponseBody): boolean

        /**
         * Before Proxy Close - 代理服务关闭前
         */
        beforeClose?(): void

        /**
         * After Proxy Close - 代理服务关闭后
         */
        afterClose?(): void
    }

    /**
     * Response Body - 响应数据内容
     * 
     * @member {Buffer} chunks - 压缩数据
     * @member {string} encoding = 压缩方式
     */
    export interface ResponseBody {
        chunks: Buffer,
        encoding: string,
    } 
}