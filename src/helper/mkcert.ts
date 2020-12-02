import mkcert from 'mkcert';
import fstemp from './fstemp';
export interface InfoCA {
    organization?: string,
    countryCode?: string,
    state?: string,
    locality?: string,
    validityDays?: number,
}

export interface CA {
    caCert: string,
    caKey: string,
}

const TEMP_CA_CERT_FILE = 'cacert.pem';
const TEMP_CA_KEY_FILE = 'cakey.pem';

const _mkcert = {
    /**
     * Creates CA - 创建根证书
     * 
     * @param {InfoCA} [info] - 根证书信息
     * @param {string} [info.organization='FXTOp'] - 组织
     * @param {string} [info.countryCode='CN'] - 国家
     * @param {string} [info.state='GuangDong'] - 省份
     * @param {string} [info.locality='ShenZhen'] - 城市
     * @param {number} [info.validityDays=365] - 有效期
     * 
     * @returns ca 根证书
     */
    createCA(info?: InfoCA): Promise<mkcert.Certificate> {
        return mkcert.createCA(
            Object.assign({
                organization: 'FXTop',
                countryCode: 'CN',
                state: 'GuangDong',
                locality: 'ShenZhen',
                validityDays: 365,
            }, info),
        );
    },

    /**
     * Create Cert - 创建授权证书
     * 
     * @param {CA} ca - 根证书(授权)
     * @param {string} domain - 证书域名
     * @param {number} [validDays=365] - 证书有效期
     */
    createCert(domain: string, ca?: CA, validDays: number = 365): Promise<mkcert.Certificate> {

        if (!ca) {
            if (fstemp.exists(TEMP_CA_CERT_FILE) && fstemp.exists(TEMP_CA_KEY_FILE)) {
                ca = {
                    caCert: fstemp.readFile(TEMP_CA_CERT_FILE),
                    caKey: fstemp.readFile(TEMP_CA_KEY_FILE),
                }
            } else {
                ca = _mkcert.getDefaultCA(); // Tips: 用户使用默认证书
            }
        }

        return mkcert.createCert({ domains: [domain], validityDays: validDays, ...ca });
    },

    /**
     * Gets Default CA - 获取默认根证书
     * 
     * @returns {CA} 默认根证书
     */
    getDefaultCA(): CA {
        return {
            caCert: `-----BEGIN CERTIFICATE-----
            MIIDSjCCAjKgAwIBAgIFNjE4ODYwDQYJKoZIhvcNAQELBQAwVDEOMAwGA1UEAxMF
            RlhUb3AxCzAJBgNVBAYTAkNOMRIwEAYDVQQIEwlHdWFuZ0RvbmcxETAPBgNVBAcT
            CFNoZW5aaGVuMQ4wDAYDVQQKEwVGWFRvcDAeFw0yMDExMjgwOTUzMjFaFw0yMTEx
            MjgwOTUzMjFaMFQxDjAMBgNVBAMTBUZYVG9wMQswCQYDVQQGEwJDTjESMBAGA1UE
            CBMJR3VhbmdEb25nMREwDwYDVQQHEwhTaGVuWmhlbjEOMAwGA1UEChMFRlhUb3Aw
            ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCZ5XRM6mJ0sNJyvtysw1mc
            zkE2aUNcaP0Zl0cE0CGIhu8SN8LPRJv6qzEAVlN81XHo/sEQ1lmq/Zzh4vOz1wmM
            INS8Q3csgHl4cHnQekUBNNQQw6dQLRGibytzrJnVE7TSSmxaf97jO6f3sTlPpPI+
            rhKtDtuKB+YpmJNJo/h3ZicPXk3phokOzKVChSHIi6UVSrpLmCflXJ/RYVrniC+M
            gbY7cifeef1532Ar4fGvYhRHppiFg4XA7vqd4/0kT86HwsFfZZCSXx2v5SrV1eLl
            VgQoSMrJZTNhpyqJ8WAc5oN/kDam+GUClqEvgOZkAcKzJASjOGxPS2zzlAWubA5d
            AgMBAAGjIzAhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgIEMA0GCSqG
            SIb3DQEBCwUAA4IBAQBHWQ7qp6mVDjhXYxxn+/7MRjgofkwK1krNg6H/thPg+Uqj
            HI//Aa8rk+HHq6ntJ83GXyKSiIyZzMPEVn0R/FDiRR4alOAmJUTDLrGJjo1U8lD8
            xRPWMZm7jbdkyXs/hFioTqkA2UaJUbHmrKmVaCI5FZ4SRaFu99u1pA09kGiO37vD
            asb2Z6zGzC2EBKYGTVnkaGbAjs6yzNmFtYEBQVSiRrscLr0Bt97DLgRq986Kbn/9
            AFpowKVXXudya8U+C8k+UYT/ojWZFysAENPM0aNklU3wdHqyXh7gG1N6r00jUvcy
            h0L2hFHLFew+9QcVs5j3HqIYy8Hl80hIobhQ7fr8
            -----END CERTIFICATE-----`,
            caKey: `-----BEGIN RSA PRIVATE KEY-----
            MIIEowIBAAKCAQEAmeV0TOpidLDScr7crMNZnM5BNmlDXGj9GZdHBNAhiIbvEjfC
            z0Sb+qsxAFZTfNVx6P7BENZZqv2c4eLzs9cJjCDUvEN3LIB5eHB50HpFATTUEMOn
            UC0Rom8rc6yZ1RO00kpsWn/e4zun97E5T6TyPq4SrQ7bigfmKZiTSaP4d2YnD15N
            6YaJDsylQoUhyIulFUq6S5gn5Vyf0WFa54gvjIG2O3In3nn9ed9gK+Hxr2IUR6aY
            hYOFwO76neP9JE/Oh8LBX2WQkl8dr+Uq1dXi5VYEKEjKyWUzYacqifFgHOaDf5A2
            pvhlApahL4DmZAHCsyQEozhsT0ts85QFrmwOXQIDAQABAoIBACL8ghMWWemzZTSG
            5X41LwMx9KtdBN5WU+vkc1XJx0XVfzZCDPy32UoEbzBnb7V6hNn2SIf+YwY3f9nu
            kX66DUaZFCP0pnwsfPD/iQH3OgbLLsbc5AWbKV4nLdavT42cXEhOeRGd7lr0bfwm
            gyPzGMtdIYvMS+a2YwHj2OAt8ceazFc9P8gbwM6K1ucA46hI1jAkv1pncBEuM7lu
            dO5+GMr7qgqboaoH0/SZ8JhTsAAPJFC4j18foVbDTu1dXTArLeue/lGCWZmQRJUX
            YweG/1R6KCOem+w3KjPqqkJ1CPG2D8kJfHkMvBcd8oH/poxjwRh6YUtRZi2HediK
            rRxSxeECgYEAyMtrMN195InAdgAp9/PYLA5am9BNIbNf/f9IDYmmYmScqb3owhKd
            PjLrcUsYLOeuhF/G4EyGtZeFj5QXovWglGFOlEnLu4gFWhUOv3ddAeCpLcPzVFOc
            ueyMAnWdam9is+x2ysSQxWMK23/0FhgFpgUyfQ2HsJJ5MCPHNndbt8kCgYEAxDUu
            DHFU7w09trXgb4UAM3kmdVX6AFNQ5WNWleCNq/Di2VnaxMTgt29DtRs82brP7HyW
            4crMCqkz/H4ZxDkFnlgPjqeE61yfPz4w2R0/Wtmoyf13pXT088/HmIBh/aM4+R6v
            I8cqy6oGzerB+9Gs8c40Kq9U62KwQvZzjZQXU/UCgYEAinxBoaIhgc2//6J9T5XO
            MhR0SaKQj/225ud6OlwFdTcPFcL1FWThLlTQLYMtWUsxAftMnsYo4nVumGf7JVlj
            NvMlzwBWkzBtAIQld8hLTVA1XmsXF8HTBigvKEMWHqJT4OPlylNnxbtZcan+Hn7S
            5n4PJFCAlTdwfdMvQlFv4IECgYB3DmnlxPMrpxY2gwAvyz2G/lF2y3fKsMOanX+R
            rFNq7N1J0/sqgOh2hj5Ia8GtwGygbC1Fzz+mjGtuH7pU1eDx5y9xeXbvNiGvR3Zu
            mA+0efSwtGvgayqjswXDJMvREzTj/Vl61UTDlmVQl82jluRhSaVf7UoTFqwrxc3y
            L9VD7QKBgFcOV8E4u+EDvILIbXZAUAvAvOeb2iCbG4xE075IaImVSefPA/NYX9pX
            zC5fjuL2ZCOlvENBJkpC0NuCSDpBn4NO/5rl2ukMNTgWdqgTZOWOUMhnfPxW15mg
            nY/fpWTzk69jvoKONDRrn0dmjQBnh+umIDbMQtRQ+bSP3LVOOUO0
            -----END RSA PRIVATE KEY-----
            `,
        };
    },
};

export default _mkcert;
