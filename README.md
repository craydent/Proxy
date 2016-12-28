<img src="http://craydent.com/JsonObjectEditor/img/svgs/craydent-logo.svg" width=75 height=75/>

# Craydent Reverse Proxy 1.2.0
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
$ sudo cproxy '{{80,443}}' '*' '{{host:port}}' {{/var/path/to/route_definition.json}} {{/var/path/to/ssl.key}} {{/var/path/to/ssl.cert}} {{/var/path/to/ssl.ca}} true

$ sudo cproxy -p '{{80,443}}' -h '*' -e '{{host:port}}' -j {{/var/path/to/route_definition.json}} -k {{/var/path/to/ssl.key}} -c {{/var/path/to/ssl.cert}} -a {{/var/path/to/ssl.ca}} -b

$ sudo cproxy --port '{{80,443}}' --host '*' --default '{{host:port}}' --route-json {{/var/path/to/route_definition.json}} --key {{/var/path/to/ssl.key}} --cert {{/var/path/to/ssl.cert}} --authority {{/var/path/to/ssl.ca}} --enable
```

cproxy can take up to 7 arguments: ports, hosts, default host/port, and route_definition.json (file path or json string).  When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. port - Comma delimited list of ports to run proxy on. (-p,--port)
2. host - Comma delimited list of domains able to access proxy. (-h,--host)
3. route default - default host and port when a requested route is not found. (default is localhost:8080)  (-e,--default)
4. route definition - json file or string defining the routes to initialize proxy with. Example json is shown below:  (-j,--route-json)
5. domain - fully qualified domain name. (-d,--domain)
6. key - private key (file path or string). (-k,--key)
7. certificate - certificate (file path or string). (-c,--cert)
8. certificate authority - certificate authority to check agains (file path or string). (-a,--authority)
9. enable auto start - flag to add to boot. (-b,--enable)

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
        "http_auth": true
        "http_user": {
            "username": {
                password: "password"
            }
        }
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

#### Enable auto start

```shell
$ sudo cproxy autostart -b

$ sudo cproxy autostart --enable
```

cproxy autostart takes 1 argument.  This will enable auto start on reboot.

1. enable auto start - flag to add to boot. (-b,--enable)

#### Disable auto start

```shell
$ sudo cproxy autostart -s

$ sudo cproxy autostart --disable
```

cproxy autostart takes 1 argument.  This will enable auto start on reboot.

1. disable auto start - flag to remove from boot. (-s,--disable)

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

#### Add Host

```shell
$ sudo cproxy addhost  '{{host1,host2}}'

$ sudo cproxy addhost -h '{{host1,host2}}'

$ sudo cproxy addhost  --host '{{host1,host2}}'
```

cproxy addhost takes 1 argument. When argument is missing, the CLI will ask for the missing arguments.

1. hosts - hosts the able to access proxy via TCP (comma delimit when multiple hosts). (-h,--host)

#### Remove Host

```shell
$ sudo cproxy rmhost  '{{host1,host2}}'

$ sudo cproxy rmhost -h '{{host1,host2}}'

$ sudo cproxy rmhost  --host '{{host1,host2}}'
```

cproxy rmhost takes 1 argument. When argument is missing, the CLI will ask for the missing arguments.

1. hosts - hosts the able to access proxy via TCP (comma delimit when multiple hosts). (-h,--host)

#### Add Port & Protocol

```shell
$ sudo cproxy addlistener  '{{80,443}}' '{{http,https}}'

$ sudo cproxy addlistener -p '{{80,443}}' -o '{{http,https}}'

$ sudo cproxy addlistener  --port '{{80,443}}' --protocol '{{http,https}}'
```

cproxy addhost takes up to 2 arguments. When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. ports - ports the proxy will listen on (comma delimit when multiple ports). (-p,--port)
2. protocol - protocol for these ports (comma delimit when multiple protocols). (-o,--protocol)

#### Remove Port & Protocol

```shell
$ sudo cproxy rmlistener  '{{80,443}}'

$ sudo cproxy rmlistener -p '{{80,443}}'

$ sudo cproxy rmlistener  --port '{{80,443}}'
```

cproxy rmlistener takes 1 argument. When argument is missing, the CLI will ask for the missing arguments.

1. ports - ports the proxy to remove (comma delimit when multiple ports). (-p,--port)

#### Add Route

```shell
$ sudo cproxy add '{{www.example.com}}' '{{example route}}' '{{localhost,example2.com}}' '{{3000,80}}' '{{/request/path/*}}' '{{/destination path}}' '{{auth user}}' '{{auth password}}' '{{headers as json}}}' '{{allowed domains (default:*)}}' '{{allowed methods (default:get,post,put,delete)}}' '{{route index(default:adds at the end)}}' '{{access level (default:*)}}'

$ sudo cproxy add -d '{{www.example.com}}' -n '{{example route}}' -h '{{localhost,example2.com}}' -p '{{3000,80}}' -r '{{/request/path/*}}' -x '{{/destination path}}' -u '{{auth user}}' -w '{{auth password}}' -e '{{headers as json}}}' -a '{{allowed domains (default:*)}}' -m '{{allowed methods (default:get,post,put,delete)}}' -i '{{route index(default:adds at the end)}}' -l '{{access level (default:*)}}'

$ sudo cproxy add --domain '{{www.example.com}}' --name '{{example route}}' --host '{{localhost,example2.com}}' --port '{{3000,80}}' --request-path '{{/request/path/*}}' --destination-path '{{/destination path}}' --user '{{auth user}}' --password '{{auth password}}' --header '{{headers as json}}}' --allowed-domain '{{allowed domains (default:*)}}' --allowed-method '{{allowed methods (default:get,post,put,delete)}}' --index '{{route index(default:adds at the end)}}' --access '{{access level (default:*)}}'
```

cproxy add can take 13 arguments.  When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. domain - fully qualified domain name. (-d,--domain)
2. name - name/alias of the route. (-n,--name)
3. hosts - hosts the request will forward to (comma delimited). (-h,--host)
4. ports - ports the request will forward to (comma delimited). (-p,--port)
5. request path - path being requested. (-r,--request-path)
6. destination path - destination path to forward to. (-x,--destination-path)
7. http auth username - username to login with to access the route (HTTP AUTH). (-u,--user)
8. http auth password - password to login with to access the route (HTTP AUTH). (-w,--password)
9. headers - (JSON) headers to override when the request header exists. (-e,--header)
10. allowed domains - domains allowed to access the route. (-a,--allowed-domain)
11. allowed http methods - http methods allowed on the route (ex: get, post, put, delete). (-m,--allowed-method)
12. route index - precedence index to insert in routes array. (-i,--index)
13. access level - access level to give to the user (HTTP AUTH). (-l,--access)

#### Remove Route(s)

```shell
$ sudo cproxy rm '{{www.example.com}}' '{{example route}}'

$ sudo cproxy rm -d '{{www.example.com}}' -n '{{example route}}'

$ sudo cproxy rm --domain '{{www.example.com}}' --name '{{example route}}'
```

cproxy rm takes 2 arguments.

1. *domain - fully qualified domain name of the route. (-d,--domain)
2. name - name/alias of the route to be removed. (-n,--name)
###**Note: If name is omitted, all routes for that domain will be removed.

#### View Route

```shell
$ sudo cproxy cat '{{www.example.com}}' '{{example route}}'

$ sudo cproxy cat -d '{{www.example.com}}' -n '{{example route}}'

$ sudo cproxy cat --domain '{{www.example.com}}' --name '{{example route}}'
```

cproxy cat takes 2 arguments.

1. domain - fully qualified domain name of the route. (-d,--domain)
2. name - name/alias of the route. (-n,--name)

#### Load Routes

```shell
$ sudo cproxy load  '{{/var/path/to/route_definition.json}}' '{{route index(default:adds at the end)}}'

$ sudo cproxy load -j '{{/var/path/to/route_definition.json}}' -i '{{route index(default:adds at the end)}}'

$ sudo cproxy load  --route-json '{{/var/path/to/route_definition.json}}' --index '{{route index(default:adds at the end)}}'
```

cproxy load takes up to 2 arguments. When arguments are missing, the CLI will ask a series of questions to obtain the missing arguments.

1. route definition - json file (absolute path) or string defining the routes to initialize proxy with. Example json is shown below:  (-j,--route-json)
2. route index - precedence index to insert in routes array. (-i,--index)

#### Enable HTTP Authentication

```shell
$ sudo cproxy enableauth '{{www.example.com}}' '{{example route}}'

$ sudo cproxy enableauth -d '{{www.example.com}}' -n '{{example route}}'

$ sudo cproxy enableauth --domain '{{www.example.com}}' --name '{{example route}}'
```

cproxy enableauth takes 2 arguments.

1. domain - fully qualified domain name of the route. (-d,--domain)
2. name - name/alias of the route. (-n,--name)
###**Note: If domain is omitted, HTTP authentication will be enabled for all routes for all domains.
###**Note: If name is omitted, HTTP authentication will be enabled for all routes for that domain.

#### Disable HTTP Authentication

```shell
$ sudo cproxy disableauth '{{www.example.com}}' '{{example route}}'

$ sudo cproxy disableauth -d '{{www.example.com}}' -n '{{example route}}'

$ sudo cproxy disableauth --domain '{{www.example.com}}' --name '{{example route}}'
```

cproxy enableauth takes 2 arguments.

1. domain - fully qualified domain name of the route. (-d,--domain)
2. name - name/alias of the route. (-n,--name)
###**Note: If domain is omitted, HTTP authentication will be disabled for all routes for all domains.
###**Note: If name is omitted, HTTP authentication will be disabled for all routes for that domain.

#### Add HTTP User to route

```shell
$ sudo cproxy adduser '{{www.example.com}}' '{{route name}}' '{{username}}' '{{password}}'

$ sudo cproxy adduser -d '{{www.example.com}}' -n '{{route name}}' -u '{{username}}' -p '{{password}}'

$ sudo cproxy adduser --domain '{{www.example.com}}' --name '{{route name}}' --user '{{username}}' --password '{{password}}'
```

cproxy adduser can take up to 4 arguments.

1. domain - domain where the user should be added. (-d,--domain)
2. route name - name/alias of the route the user should be added to. (-n,--name)
3. *username - username to add. (-u,--user)
4. *password - password for the username. (-p,--password)

#### Remove HTTP User from route

```shell
$ sudo cproxy rmuser '{{www.example.com}}' '{{route name}}' '{{username}}'

$ sudo cproxy rmuser -d '{{www.example.com}}' -n '{{route name}}' -u '{{username}}'

$ sudo cproxy rmuser --domain '{{www.example.com}}' --name '{{route name}}' -user '{{username}}'
```

cproxy rmuser takes 3 arguments.
                               
1. domain - domain where the user should be removed. (-d,--domain)
2. route name - name/alias of the route the user should be removed from. (-n,--name)
3. *username - username to remove. (-u,--user)

#### Update HTTP User in a specific route

```shell
$ sudo cproxy updateuser '{{www.example.com}}' '{{route name}}' '{{username}}' '{{password}}'

$ sudo cproxy updateuser -d '{{www.example.com}}' -n '{{route name}}' -u '{{username}}' -p '{{password}}'

$ sudo cproxy updateuser --domain '{{www.example.com}}' --name '{{route name}}' --password '{{password}}'
```

cproxy rmuser takes 4 argument.
                               
1. domain - domain where the user should be removed. (-d,--domain)
2. route name - name/alias of the route the user should be removed from. (-n,--name)
3. *username - username to remove. (-u,--user)
3. *password - the new password for the username (-p,--password)

#### Add SSL certificate

```shell
$ sudo cproxy addssl '{{www.example.com}}' '{{/path/to/key}}' '{{/path/to/certificate}}' '{{/path/to/ca}}'

$ sudo cproxy addssl -d '{{www.example.com}}' -k '{{/path/to/key}}' -c '{{/path/to/certificate}}' -a '{{/path/to/ca}}'

$ sudo cproxy addssl --domain '{{www.example.com}}' --key '{{/path/to/key}}' --cert '{{/path/to/certificate}}' --authority '{{/path/to/ca}}'
```

cproxy addssl can take up to 4 arguments.

1. domain - domain for the certificate. (-d,--domain)
2. key - private key (file path or string). (-k,--key)
3. certificate - certificate (file path or string). (-c,--cert)
4. certificate authority - certificate authority to check agains (file path or string). (-a,--authority)

#### Remove SSL certificate

```shell
$ sudo cproxy rmssl '{{www.example.com}}'

$ sudo cproxy rmssl -d '{{www.example.com}}'

$ sudo cproxy rmssl --domain '{{www.example.com}}'
```

cproxy rmssl takes 1 argument.

1. *domain - domain for the certificate. (-d,--domain)
	
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
