const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Proxy } = require('../dist/index.cjs');

const proxy = new Proxy({ httpPort: 1080, autoStart: true }, {
    beforeConnect({ hostname }) {
        if (hostname === 'www.baidu.com') return true;
        return true;
    },
    beforeRequest(req, res, options) {
        const { hostname, path, method } = options;

        if (hostname !== 'www.baidu.com') return false;

        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('hahah');
        return true;
    },
    afterResponse(req, res, proxyRes, chunks) {
        // if (proxyRes.headers['content-encoding'] === 'gzip') {
        //     zlib.gunzip(chunks, (err, decoded) => console.log('result', decoded.toString()));
        // } else {
        //     console.log('result', chunks.toString());
        // }
    },
});

Proxy.startSysProxy(1080, true).then(() => {
    setTimeout(() => {
        Proxy.stopSysProxy().then((res)=>{
            console.log(JSON.stringify(res));
            proxy.close();
        });
    }, 10000);
}).catch(console.log);

// Proxy.importRootCert();

// console.log(JSON.stringify(path.parse(path.join(__dirname, '../dist/temp/cakey.pem')), 0, 2));