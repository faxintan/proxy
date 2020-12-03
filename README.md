<img width="75px" height="75px" align="right" alt="Inquirer Logo" src="https://res.wesure.cn/front/sit/product/activity/image/1egne42r42ln.png" title="Commander"/>

# @fxtop/proxy
### Nodejs Web Proxy Tool


![GitHub package.json version](https://img.shields.io/github/package-json/v/faxintan/proxy)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](contributing.md)



`@fxtop/proxy` is a lightweight web proxy tool based on Nodejs. The primary purpose of 
`@fxtop/proxy` is to capture http(s) request and expose the lifecycle hooks in the process of proxy.
so, the developers can do what he want in relevant hook.

For example, the developers can use it to implement a mock tool for team work. `@fxtop/proxy` expose 
the lifecycle hooks, before the request to after the response. developers can check request's hostname 
on before request hook, and mock data as a response if in needed. all [lifecycle hooks](#lifecycle) 
supported we will talk later.

`@fxtop/proxy` is system level proxy, when you run the proxy server, you may need to do : 
  1. import the root cert into system trust list.
  2. set your system's web proxy to the proxy server. e.g. `127.0.0.1:1080`.  


## Directory

- [document](#document)
  - [install](#installation)
  - [examples](#examples)
  - [class](#class)
  - [methods](#methods)
  - [static methods](#staticMethods)
  - [lifecycle](#lifecycle)
- [feature](#feature)
- [support](#support)
- [license](#license)
- [issues](#issues)


## [document](#document)

<a name="document"></a>


## installation

<a name="installation"></a>

```shell
npm install @fxtop/proxy
```

## examples

<a name="examples"></a>

before proxy, we could invoke `Proxy.trustRootCert` to import Root Cert into system trust list 
and then, invoke `Proxy.startSysProxy` to set system's web proxy to assigned IP and Port.
finally, we just need to start the proxy server to capture http(s) request.

```javascript
const { Proxy } = require('@fxtop/proxy');

const httpPort = 1080;

// Proxy.trustRootCert();

const proxy = new Proxy({ httpPort, autoStart: true }, {
    beforeRequest(req, res, options) {
        const { hostname, path, method } = options;

        // when return false, it just proxy transparently
        if (hostname !== 'www.baidu.com') return false;

        res.writeHead(200, { 'content-type': 'application/json' });

        res.end(/* Mock Data */);
        return true;
    },
});

// start proxy
Proxy.startSysProxy(httpPort);

// close proxy after one minute
setTimeout(() => {
  Proxy.stopSysProxy().then(()=>{
      proxy.close();
  });
}, 60 * 1000);

```

## class

<a name="class"></a>

``Proxy`` is all we need to control the proxy behavior. when call new Proxy, we need to pass 
two main params to config proxy's behavior, the options and the lifecycle. just like the example above.

> Options: &nbsp; base config of proxy.

| name       | type     |  default | description |
| --------   | :-----:  | :----: | :---- |
| httpPort   | number   |  8888    | http server listen port |
| httpsPort  | number   |  8889    | https server listen port |
| ca         | object   |   -      | the ca role, to generate certificate dynamically |
| autoStart  | boolean  |  false   | whether to start proxy immediately after call new Proxy |


> Lifecycle: &nbsp; the lifecycle hooks for proxy process

| name           | type     |  default  | description |
| --------       | :-----:  |  :----:   | :----       |
| beforeStart    | Function |     -     | the hook before proxy start |
| afterStart     | Function |     -     | the hook after proxy start |
| beforeConnect  | Function |     -     | the hook before connect the https server, use for https proxy |
| beforeRequest  | Function |     -     | the hook before proxy send the request to target server |
| afterRequest   | Function |     -     | the hook after proxy send the request to target server |
| beforeResponse | Function |     -     | the hook before proxy send the response to target client |
| afterResponse  | Function |     -     | the hook after proxy send the response to target client |
| beforeClose    | Function |     -     | the hook before proxy close |
| afterClose     | Function |     -     | the hook before proxy close |


## methods

<a name="methods"></a>

proxy instance only provide 3 simple methods to control the proxy to start or close. 

| name     | param1   | param2    |  return   | description |
| -------- | :-----:  | :-----:   |  :----:   | :----       |
| start    |    -     |    -      |     -     | start proxy |
| reset    | Options  | Lifecycle |     -     | restart proxy by new configuration and lifecycle hooks |
| close    |    -     |    -      |     -     | close proxy, it will close all unfinished sockets forcibly |


## static methods

<a name="staticMethods"></a>

class Proxy provide some static methods which can be used to invoke system capacity, 
e.g. import root cert into system trust list, and set system web proxy.

| name            | param1  | param2     |  param2   |  return     | description |
| -------------   | :-----: | :-----:    |  :-----:  |  :----:     | :---------- |
| createCA        | InfoCA  |    -       |     -     | Certificate | Create ca cert which use for https certificate auto-generate |
| createCert      | domain  |    ca      | validDays | Certificate | Create certificate manually and use specified ca sign for it |
| getDefaultCA    |   -     |    -       |     -     |     -       | Get the default ca (FXTOP) the library provided |
| trustRootCert   | path    |    -       |     -     |     -       | Import root cert specified by path param into system trust list |
| startSysProxy   | port    |isProxyHttps|     -     |     -       | Set system's web proxy to localhost and listen to specified port |
| stopSysProxy    |   -     |    -       |     -     |     -       | Disable system's web proxy |


## [feature](#feature)

<a name="feature"></a>

@fxtop/proxy@0.1.5

- proxy http & https
- proxy lifecycle hooks
- node.js API provided
- system web proxy control
- import root certificate into system trust list
- https certificate auto-generate


## [support](#support)

<a name="support"></a>

  - The current version is tested to run on node v8.0.0
  - The static method is Only support Windows and MacOS system

## [license](#license)

<a name="license"></a>

Copyright (c) 2020 Louis (wechat: Faxin_Tan) Licensed under the MIT license.


## [issues](#issues)

<a name="issues"></a>
