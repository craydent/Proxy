<img src="http://craydent.com/JsonObjectEditor/img/svgs/craydent-logo.svg" width=75 height=75/>

# Craydent Reverse Proxy 1.0.0
**by Clark Inada**

This module is a reverse proxy server implemented in node.  There are 2 ways to use: global install/standalone or as a module.  When used as a standalone, a config file is create in /var/craydent/config/craydent-proxy/pconfig.json and will auto update the routes if the file is changed.  This happens as well when used as a module and a file is provided as a config.  This eliminates the need to restart the server for a configuration and/or route update.

## Standalone
```shell
$ npm install -g craydent-proxy
$ sudo cproxy
```

Once installed and configured, the cproxy command without arguments will restart the craydent-proxy server.

### CLI
All * arguments are required.

#### Version

```shell
$ sudo cproxy version;
$ sudo cproxy --version;
$ sudo cproxy -v;
```

cproxy version takes no arguments.  This will output the current verion of Craydent Proxy.

#### Initialize

```shell
$ sudo cproxy '{{80,443}}' '*' '{{host:port}}' {{/var/path/to/route_definition.json}}
```

cproxy can take 4 arguments: ports, hosts, default host/port, and route_definition.json (file path or json string).  When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. ports - Comma delimited list of ports to run proxy on.
2. hosts - Comma delimited list of domains able to access proxy.
3. route default - default host and port when a requested route is not found. (default is localhost:8080)
4. route definition - json file or string defining the routes to initialize proxy with. Example json is shown below:

Note: routes are processed/matched in order.  If there are more hosts then ports (or vise versa) the last port that was provided is used. 

```js
{
    // these are the domains which the server be requested on 
    "sub.example.com": [{
        // name is the identifier of the route and must be unique (best practice would be to prefix name with project name)
        "name": "project1_websocket"
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
        "name": "project1_home"
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
        "name": "project2_root"
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

#### Stop/Terminate

```shell
$ sudo cproxy stop
```

cproxy stop takes no arguments.  This will terminate the craydent-proxy process.

#### Reset

```shell
$ sudo cproxy reset
```

cproxy reset takes no arguments.  This will remove configuration/log files and reset the state to a freshly installed state.

#### Uninstall

```shell
$ sudo cproxy uninstall
```

cproxy uninstall takes no arguments.  This will remove configuration/log files and and uninstalled the global module.

#### Add Route

```shell
$ sudo cproxy add '{{www.example.com}}' {{example route}}' '{{localhost,example2.com}}' '{{3000,80}}' '{{/request/path/*}}' '{{/destination path}}' '{{auth user}}' '{{auth password}}' '{{headers as json}}}' '{{allowed domains (default:*)}}' '{{allowed methods (default:get,post,put,delete)}}' '{{route index(default:adds at the end)}}'
```

cproxy add can take 12 arguments.  When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. domain - fully qualified domain name.
2. name - name/alias of the route.
3. hosts - hosts the request will forward to (comma delimited).
4. ports - ports the request will forward to (comma delimited).
5. request path - path being requested.
6. destination path - destination path to forward to.
7. http auth username - username to login with to access the route (HTTP AUTH).
8. http auth password - password to login with to access the route (HTTP AUTH).
9. headers - (JSON) headers to override when the request header exists.
10. allowed domains - domains allowed to access the route.
11. allowed http methods - http methods allowed on the route (ex: get, post, put, delete).
12. route index - precedence index to insert in routes array.

#### Remove Route(s)

```shell
$ sudo cproxy rm '{{www.example.com}}' '{{example route}}'
```

cproxy rm takes 2 arguments.

1. *domain - fully qualified domain name of the route.
2. name - name/alias of the route to be removed.
###**Note: If name is omitted, all routes for that domain will be removed.


#### View Route

```shell
$ sudo cproxy cat '{{www.example.com}}' '{{example route}}'
```

cproxy cat takes 2 arguments.

1. *domain - fully qualified domain name of the route.
2. *name - name/alias of the route.

#### Add SSL certificate

```shell
$ sudo cproxy addssl '{{www.example.com}}' '{{/path/to/key}}' '{{/path/to/certificate}}' '{{/path/to/ca}}'
```

cproxy addssl can take up 4 arguments.

1. *domain - domain for the certificate.
2. *key - private key (file path or string).
3. *certifiate - certificate (file path or string).
4. certificate authority - certificate authority to check agains (file path or string).

#### Remove SSL certificate

```shell
$ sudo cproxy rmssl '{{www.example.com}}'
```

cproxy rmssl takes 1 argument.

1. *domain - domain for the certificate.
	
## Node.js module
```shell
$ npm i --save craydent-proxy
```

pconfig.json example & structure (this is the default that is used when no config is available)
Note: If there are more hosts or ports than protocols the last protocol that was provided is used for the subsequent hosts and ports.
 - Valid protocols are:
 
 * http
 * https
 * ssl
 * tls
   
```js
{
    "port" : ["80"],
    "host" : [""],
    "routes" : {},
    "protocol": [""],
    "certs": {},
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
// default location of config is /var/craydent/config/craydent-proxy/pconfig.json
var Proxy = require('craydent-proxy');
var server = new Proxy();
```


## Download

 * [GitHub](https://github.com/craydent/Proxy/)
 * [BitBucket](https://bitbucket.org/craydent/proxy)
 * [GitLab](https://gitlab.com/craydent/proxy)

Craydent-Proxy is released under the [Dual licensed under the MIT or GPL Version 2 licenses](http://craydent.com/license).<br>
