/*/---------------------------------------------------------/*/
/*/ Craydent LLC                                            /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
require('craydent/noConflict');
$g.DEFAULT_HTTP_PORT = 80;

var net = require('net'),
    util = require("util"),
    EventEmitter = require('events').EventEmitter,
    lineBreakChar = '\r\n', onerror;

$c.catchAll(function (err) {
    onerror && onerror(err);
});

function Proxy(config) {
    var self = this, proxy, host, port, routes;
    self.server = [];
    if (!config || $c.isString(config)) {
        config = $c.include(config || './pconfig.json');
    }
    $c.logit('proxy initalized', config);

    config = _config_validator(config);
    port = config.port;
    host = config.host;
    routes = config.routes;
    proxy = config;

    var server = function(source) {
        $c.logit('connection established');
        self.emit('connect', source);

        source.on('data',function(chunk){
            self.emit('data', chunk);

            this.destinations = this.destinations || [];
            !onerror && (onerror = function (err) {
                if(self.listeners('error').length) { self.emit('error', err); }
                source.end();
            });

            var headers = chunk.toString('utf-8').split(lineBreakChar),
                route = this.route,
                needToChunk = !route || headers.length > 1,
                theRoute = routes[route],
                useCurrentRoute = false,
                _l1parts = headers[0].split(' '),
                method = (_l1parts[0] || "").toLowerCase(),
                req_path = (_l1parts[0] || "");
            if (needToChunk) {
                this.destinations = [];
                route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');
                // find the first matching route
                //var path = headers[0].split(' ')[1];
                for (var prop in routes) {
                    if (prop.indexOf('*') != -1) {
                        prop = prop.replace(/\*/g,'.*');
                    }
                    if (prop[0] == '/') {
                        prop = prop.substr(1);
                    }
                    if(new RegExp("^/"+prop+"$").test(req_path)) {
                        useCurrentRoute = true;
                        theRoute = routes[prop];
                        break;
                    }
                }
                theRoute = useCurrentRoute ? theRoute : routes[route];

                if (route == "RELOAD_CONFIG") {
                    /* TODO: implement http auth
                     var auth = headers['authorization'],
                     auth_header = 'WWW-Authenticate: Basic realm="Deployer Secure Area"';

                     if (!auth) {     // No Authorization header was passed in so it's the first time the browser hit us
                     self.header(auth_header);
                     return source.end(401, '<html><body>You are trying to access a secure area.  Please login.</body></html>');
                     }

                     var encoded = auth.split(' ')[1];   // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

                     var buf = new Buffer(encoded, 'base64'),
                     plain_auth = buf.toString(),
                     creds = plain_auth.split(':'),
                     username = creds[0],
                     password = creds[1];

                     if (username != $g.HTTP_AUTH_USERNAME || password != $c.HTTP_AUTH_PASSWORD) {
                     self.header(auth_header);
                     // res.statusCode = 403;   // or alternatively just reject them altogether with a 403 Forbidden
                     self.end(401, '<html><body>You are not authorized to access this page</body></html>');
                     }*/

                    $c.logit("Reloading Config");
                    var oldProxy = proxy,
                        message = {"message":"Config reloaded"},
                        status = 200;
                    try {
                        //get absolute directory
                        var absPath = config;
                        if (typeof absPath == "string") {
                            var dir = __dirname,
                                prefix = absPath.substring(0,2);
                            if (prefix == "./") {
                                absPath = absPath.substring(0,2);
                            }
                            while (prefix == "..") {
                                dir = dir.substring(0,dir.lastIndexOf('/'));
                                absPath = absPath.substring(3);

                                prefix = absPath.substring(0,2);
                            }
                            absPath = dir + '/' + absPath;
                        }
                        delete require.cache[absPath || (__dirname + '/pconfig.json')];
                        proxy = _config_validator(require(config || './pconfig.json'));
                        port = proxy.port;
                        host = proxy.host;
                        routes = proxy.routes;
                    } catch (e) {
                        proxy = oldProxy;
                        message = {"message":"Failed to reload config","error":e.toString()};
                        status = 500;
                    } finally {
                        $c.logit(proxy);
                        if (!theRoute) {
                            self.emit('reload', route);
                            return _send(self,source, status, message);
                        }
                    }
                }

                var regex = new RegExp("/"+route+"/?(.*)");
                var path = proxy.routes[route] && proxy.routes[route].path ? proxy.routes[route].path : '/';
                headers[0] = theRoute ? headers[0].replace(regex, path + '$1') : headers[0];
                //chunk = new Buffer(headers.join(lineBreakChar));
            }
            var req_str = method.toUpperCase() + " " + req_path;
            console.log("=>" + headers[0]);
            if (!theRoute) {
                var oroute = route;
                route = 'DEFAULT';
                if(!(theRoute = routes[route])) {
                    if (headers.indexOf('User-Agent: ELB-HealthChecker/1.0') != -1) {
                        console.log("<=" + req_str + " 200 " + $c.RESPONSES[200].message);
                        return _send(self, source, 200, $c.RESPONSES[200]);
                    } else {
                        console.log("<=" + req_str + " 400 " + $c.RESPONSES[400].message);
                        return _send(self, source, 400, $c.RESPONSES[400]);
                    }
                }
            }
            var verbs = theRoute.verbs;
            if (verbs && verbs.indexOf('*') != -1 && verbs.indexOf(method) == -1) {
                console.log("<=" + req_str + " 405 " + $c.RESPONSES[405].message);
                return _send(self,source, 405, $c.RESPONSES[405]);
            }
            this.route = route;
            var rheaders = theRoute.headers;
            if (rheaders) {
                var heads = [], i = 0;
                for (var len = headers.length; i < len; i++) {
                    if (!headers[i]) { break; }
                    var index = headers[i].indexOf(":"),
                        head = headers[i].substr(0,index),
                        headerVal = rheaders[head];

                    if (headerVal == undefined) { continue; }

                    if (headerVal.constructor == Function) {
                        headerVal = headerVal(head,headers[i].substr(index + 1).trim(),headers[i]);
                    }
                    headers[i] = head + ": " + headerVal;
                }
                for (var prop in rheaders) {
                    if (!rheaders.hasOwnProperty(prop) || heads.indexOf(prop) != -1) { continue; }
                    headers.splice(i,0,prop + ": " + rheaders[prop]);
                }
            }
            needToChunk && (chunk = new Buffer(headers.join(lineBreakChar)));

            var allow = theRoute.allow;
            if (allow && (allow.indexOf('*') == -1)) {
                // retrieve referer
                var referer = (headers.filter(function(head){
                    return head.toLowerCase().indexOf('referer: ') != -1;
                })[0] || " ").split(' ')[1].replace(/(?:https?:\/\/)?(.*?)/,'$1');

                var allowed = false;
                if (referer) {
                    if (typeof allow == "string") {
                        allowed = new RegExp("^"+allow.replace(/\*/,'.*?').replace(/\./,'\\.') + "$").test(referer);
                    } else {
                        allowed = !!allow.filter(function(path){
                            return new RegExp(path.replace(/\*/,'.*?').replace(/\./,'\\.')).test(referer);
                        })[0];
                    }
                }

                if (!allowed) {
                    console.log("<=" + req_str + " 403 " + $c.RESPONSES[403].message);
                    return _send(self,source, 403,$c.RESPONSES[403]);
                }
            }
            if (!this.destinations.length) {
                var hosts = theRoute.host,
                    ports = theRoute.port,
                    host = "", port = "";
                for (var i = 0, len = Math.max(hosts.length,ports.length); i < len; i++) {
                    host = hosts[i] || host;
                    port = ports[i] || port;
                    var destination = net.createConnection({
                        host: host,
                        port: port
                    });
                    destination.on('close',function(isClosed){
                        self.emit('close', {"destination":destination,"had_error": isClosed});
                        if (isClosed) {
                            source.end();
                        }
                    });
                    destination.on('drain',function(){ self.emit('drain', {"destination":destination}); });
                    destination.on('error',function(err){
                        if(self.listeners('error').length) { self.emit('error', {"destination":destination,"error": err}); }
                        console.log("<=" + req_str + " 500 " + $c.RESPONSES[500].message);
                        source.end();
                    });
                    destination.on('lookup',function(err,address,family){
                        self.emit('lookup', {"destination":destination, error:err, address:address, family:family});
                    });
                    destination.on('timeout',function(){
                        console.log("<=" + req_str + " 504 " + $c.RESPONSES[504].message);
                        source.end();
                    });
                    if (!this.destinations.length) {
                        destination.on('end',function(){
                            console.log("<=" + req_str + " 200 " + $c.RESPONSES[200].message);
                        });
                    }
                    this.destinations.push(destination);
                }
                this.destinations[0].pipe(source);
            }

            for (var j = 0, jlen = this.destinations.length; j < jlen; j++) {
                this.destinations[j].write(chunk);
            }
        });
    };
    port = $c.isArray(port) ? port : [port];
    host = $c.isArray(host) ? host : [host];
    var len = Math.max(port.length,host.length);
    for (var i = 0, pi = 0, hi = 0; i < len; i++) {
        var p = port[pi], h = host[hi];
        (function(hh, pp) {
            self.server.push(net.createServer(server).listen(pp, hh, function () {
                self.emit('bind', {host: hh, port: pp});
                console.log('listening on port: ' + pp);
            }));
        })(h,p);
        port[pi + 1] && pi++;
        host[hi + 1] && hi++;
    }
    return self;
}
function _send (self, source, statusCode, data) {
    var body = $c.isString(data) ? data : JSON.stringify(data),
        response = [
            "HTTP/1.1 " + $c.RESPONSES[statusCode].status + " " + $c.RESPONSES[statusCode].message,
            "Content-Length: " + body.length,
            "Connection: close",
            "",
            body
        ];
    if(self.listeners('error').length) { self.emit('error', data); }

    source.write(response.join(lineBreakChar));
    return source.end();
}
function _config_validator (config) {
    if (!config) { return { routes : {"DEFAULT":{host:["localhost"],port:["8080"]}}, port:"80", host: ""}; }
    var error = "";
    config.routes = config.routes || {};
    config.port = config.port || "";
    config.host = config.host || "";
    config.HTTP_AUTH_USERNAME = config.HTTP_AUTH_USERNAME || "";
    config.HTTP_AUTH_PASSWORD = config.HTTP_AUTH_PASSWORD || "";
    
    var routes = config.routes;
    for (var prop in routes) {
        if (!routes.hasOwnProperty(prop)) { continue; }
        var route = routes[prop];
        // set defaults
        route.path = route.path || "/";
        route.host = typeof route.host == "string" ? route.host.split(',') : (route.host || ["localhost"]);
        route.port = typeof route.port == "string" || typeof route.port == "number" ? route.port.toString().split(',') : (route.port || [""]);
        route.allow = typeof route.allow == "string" ? route.allow.split(',') : (route.allow || ["*"]);
        
        // check for errors
        if (typeof route.path != "string") {
            error += "Error: 'path' must be a string in route: " + prop + "\n";
        }
        if (typeof route.host != "object" && route.host.length != undefined) {
            error += "Error: 'host' must be a string or array in route: " + "\n";
        }
        if (typeof route.port != "object" && route.port.length != undefined) {
            error += "Error: 'port' must be a string or array in route: " + "\n";
        }
        if (typeof route.allow != "object" && route.allow.length != undefined) {
            error += "Error: 'allow' must be a string or array in route: " + "\n";
        }
    }
    if (error) {
        throw error;
    }
    return config;
}
util.inherits(Proxy, EventEmitter);
module.exports = Proxy;