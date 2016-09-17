# Craydent Reverse Proxy 0.1.21
**by Clark Inada**

This module is a reverse proxy server implemented in node.  There are 2 ways to use: global install/standalone or as a module.  When used as a standalone, a config file is create in /var/craydentdeploy/config/craydent-proxy/pconfig.json and will auto update the routes if the file is changed.  This happens as well when used as a module and a file is provided as a config.  This eliminates the need to restart the server for a configuration and/or route update.

## Standalone
```shell
$ npm install -g craydent-proxy
$ sudo cproxy
```

Once installed and configured, the cproxy command without arguments will restart the craydent-proxy server.

### CLI

```shell
$ sudo cproxy '80,443' '*' /var/path/to/route_definition.json
```

cproxy can take 3 arguments: ports, hosts, and route_definition.json (file path or json string).
* ports - Comma delimited list of ports to run proxy on.
* hosts - Comma delimited list of domains able to access proxy.
* route definition - json file or string defining the routes to initialize proxy with. Example json is shown below:

Note: routes are processed/matched in order.  If there are more hosts then ports (or vise versa) the last port that was provided is used. 

```js
{
    // these are the domains which the server be requested on 
    "sub.example.com": [{
        // host is the destination to forward the request
        "host": ["localhost"],
        // port is the port to forward on the destination
        "port": ["3000"],
        // verbs are the allowable methods on the destination
        "verbs": ["get", "post", "put", "delete"],
        // refering domains allowed to use this route
        "allow": ["*"],
        // headers are used to overwrite the headers being passed iff it is passed
        "headers": {},
        // destination path prefix
        "path": "/websocket/",
        // request path for this route
        "request_path": "/websocket/*"
        // http authentication
        "http_auth": false
        "http_username": "user",
        "http_password": "password"
    },{
        "host": ["craydent.com"],
        "port": ["8080"],
        "verbs": ["get", "post", "put", "delete"],
        "allow": ["*"],
        "headers": {},
        "path": "/home/",
        "request_path": "/*",\
        "http_auth": false
    }],
    "example2.com": [{
        "host": ["localhost"],
        "port": ["3001"],
        "verbs": ["get", "post", "put", "delete"],
        "allow": ["*"],
        "headers": {},
        "path": "/",
        "request_path": "/*",
        "http_auth": false
    }]
}
```

Notes: In the above example, when a request has been made to the proxy server with sub.example.com or example2.com, the proxy will forward the request.  In all other cases, the proxy will respond with a 400 Bad Request.
The first route configures the server to forward the request when a request is made like `http://sub.example.com/websocket/index.html`.
`http://sub.example.com/websocket/index.html` will be forwarded to `http://localhost:3000/websocket/index.html` but will first check access via http authentication.
The second route for sub.example.com configures all other requests to the server to forward to `http://craydent.com:8080`.  `http://sub.example.com/index.html` will be forwarded to `http://craydent.com:8080/home/index.html`.


## Node.js module
```shell
$ npm i --save craydent-proxy
```

pconfig.json example & structure (this is the default that is used when no config is available)
```js
{
    "port" : ["80"],
    "host" : [""],
    "routes" : {},
    "DEFAULT": { "host": ["localhost"], "port": ["8080"] }
}
```

```js
var Proxy = require('craydent-proxy');
var config = require('pconfig.json');
var server = new Proxy(config);
```
```js
var Proxy = require('craydent-proxy');
var server = new Proxy('pconfig.json');
```
```js
// default location of config is /var/craydentdeploy/config/craydent-proxy/pconfig.json
var Proxy = require('craydent-proxy');
var server = new Proxy();
```


## Download

 * [GitHub](https://github.com/craydent/Craydent-Proxy/)
 * [BitBucket](https://bitbucket.org/craydent/craydent-proxy)

Craydent-Proxy is released under the [Dual licensed under the MIT or GPL Version 2 licenses](http://craydent.com/license).<br>
