/*/---------------------------------------------------------/*/
/*/ Craydent LLC proxy-v0.1.21                              /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
/*
route: {
    fqdn:[{
        host: [],        // host to connect to
        port: [],        // port to connect on
        verbs: [],       // verbs allowed to use
        allow: [],       // array of allowed domains
        headers: {},     // key val pair of headers
        path: "",        // destination path/absolute path of the destination host
        request_path:"", // path or path pattern to match from the request
        domain: "",      // same as fqdn
        http_auth:false, // flag to enable http authentication
        http_username:"",// http authentication username
        http_password:"",// http authentication password
    }]
}
*/
var $c = require('craydent/noConflict');
var $g = global;
$g.DEFAULT_HTTP_PORT = 80;

var net = require('net'),
    util = require("util"),
    fs = require("fs"),
    EventEmitter = require('events').EventEmitter,
    lineBreakChar = '\r\n', onerror;

$c.catchAll(function (err) {
    console.error(err, err.stack);
    onerror && onerror(err);
});
function flog(){
    var prefix = $c.now('M d H:i:s')+' PID[' + process.pid + ']: ';
    for (var i = 0, len = arguments.length; i < len; i++) {
        if ($c.isString(arguments[i])) { console.log(prefix + arguments[i]); }
        else { console.log(prefix, arguments[i]); }
    }
}

function Proxy(config) {
    var self = this,
        host, port,
        routes, route_default,
        config_path = '/var/craydentdeploy/config/craydent-proxy/pconfig.json';
    self.server = [];
    if (!config || $c.isString(config)) {
        config_path = config || config_path;
        config = $c.include(config_path);
        var cb = function(event_type){
            if(event_type == "change") {
                config = _reload_config(config, config_path);
                port = config.port;
                host = config.host;
                routes = config.routes;
                route_default = config.DEFAULT;
            }
        };
        try { fs.watch(config_path, cb); } catch (e) {e.errno == "ENOENT" ? flog(config_path +" not found: using default config") : flog(e); }
        if (!config) { try { require(config_path); } catch(e){ flog(e); }}
    }
    flog('proxy initalized');

    config = _config_validator(config);
    port = config.port;
    host = config.host;
    routes = config.routes;
    route_default = config.DEFAULT;

    function server(source) {
        flog('connection established');
        self.emit('connect', source);
        source.start = $c.now();
        source.on('data',function(chunk) {
            var src = this, headers = chunk.toString('utf-8').split(lineBreakChar);
            self.emit('data', chunk);
            if (this.header && this.header != headers[0] && headers[0].indexOf('HTTP') != -1) {
                // fix bug/issue with net.createServer on data
                return source.destroy();
            }

            this.destinations = this.destinations || [];
            // setting error handler if it's not already set
            !onerror && (onerror = function (err) {
                if(self.listeners('error').length) { self.emit('error', err); }
                $c.logit(err);
                return _send(self, src, 500, $c.RESPONSES[500],null,src.header);
            });

            var route = this.route,
                fqdnheader = headers.filter(function(line){ return $c.startsWith(line.toLowerCase(),'host'); })[0],
                fqdn = this.fqdn || (fqdnheader ? fqdnheader.replace(/^host\s*:\s*(.*)$/i,'$1') : ""),
                needToChunk = !route || headers.length > 1,
                theRoute = route == "DEFAULT" ? route_default :
                    routes[fqdn] && routes[fqdn].filter(function(rt){ return rt.request_path == route; })[0],
                useCurrentRoute = false,
                _l1parts = headers[0].split(' '),
                method = (_l1parts[0] || "").toLowerCase(),
                req_path = (_l1parts[1] || "").replace(/index.html$/i,''), // the path that is being requested
                old_path = req_path;

            this.fqdn = this.fqdn || fqdn;
            this.header = this.header || headers[0];
            routes[fqdn] =  routes[fqdn] || [];

            if (needToChunk) {
                this.destinations = [];
                for (var i = 0, len = routes[fqdn].length; i < len; i++) {
                    var path = routes[fqdn][i].request_path;
                    if (path.indexOf('*') != -1) { path = path.replace(/\*/g,'(.*?)'); }
                    if (!$c.startsWith(path, '/')) { path = "/" + path; }
                    if (!$c.endsWith(path, '/')) { path += "/"; }
                    path += '?';
                    var regex = new RegExp("^"+path+"$");
                    if (regex.test(req_path)) {
                        useCurrentRoute = true;
                        var index = routes[fqdn][i].request_path.indexOf('*');
                        req_path = req_path.replace(routes[fqdn][i].request_path.substr(0, index),routes[fqdn][i].path);
                        theRoute = routes[fqdn][i];
                        break;
                    }
                }
                theRoute = useCurrentRoute ? theRoute :
                    routes[fqdn].filter(function(rt){ return rt.request_path == req_path; })[0];
                if (req_path == "RELOAD_CONFIG") {
                    var out = {};
                    config = _reload_config(config, config_path, out);
                    port = config.port;
                    host = config.host;
                    routes = config.routes;
                    route_default = config.DEFAULT;


                    if (!theRoute) {
                        self.emit('reload', route);
                        $c.logit('the route not found');
                        return _send(self,src, out.code, out.message,null,this.header);
                    }
                }

                headers[0] = this.header = theRoute ? this.header.replace(old_path, req_path) : this.header;
            }
            flog("=>" + this.header);
            if (!theRoute) {
                route = 'DEFAULT';
                if(!(theRoute = route_default)) {
                    if ($c.indexOfAlt(headers,/User-Agent: ELB-HealthChecker/) != -1) {
                        return _send(self, src, 200, $c.RESPONSES[200],null,this.header, true);
                    } else {
                        return _send(self, src, 400, $c.RESPONSES[400],null,this.header);
                    }
                }
            }

            var verbs = theRoute.verbs;
            if (verbs && verbs.indexOf('*') != -1 && verbs.indexOf(method) == -1) {
                return _send(self,src, 405, $c.RESPONSES[405],null,this.header);
            }
            if (theRoute.http_auth) {
                var authHeaderString = headers.filter(function(line){ return $c.startsWith(line.toLowerCase(),'authorization'); })[0],
                    auth = authHeaderString ? authHeaderString.replace(/^authorization\s*:\s*(.*)$/i,'$1') : "",
                    auth_header = {'WWW-Authenticate: Basic realm': theRoute.domain + 'Secure Area'};

                if (!auth) {     // No Authorization header was passed in so it's the first time the browser hit us
                    var body = '<html><body>You are trying to access a secure area.  Please login.</body></html>';
                    return _send(self, src, 401, body, auth_header,this.header);
                }

                var encoded = auth.split(' ')[1];   // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

                var buf = new Buffer(encoded, 'base64'),
                    plain_auth = buf.toString(),
                    creds = plain_auth.split(':'),
                    username = creds[0],
                    password = creds[1];

                if (username != theRoute.http_username || password != theRoute.http_password) {
                    var body = '<html><body>You are not authorized to access this page</body></html>';
                    return _send(self, src, 401, body, auth_header,this.header);
                }
            }
            this.route = theRoute.request_path;
            var rheaders = theRoute.headers;
            if (rheaders && !$c.isEmpty(rheaders)) {
                var heads = [], i = 0;
                for (var len = headers.length; i < len; i++) {
                    if (!headers[i]) { break; }
                    var index = headers[i].indexOf(":"),
                        head = headers[i].substr(0,index),
                        headerVal = rheaders[head] || rheaders[$c.capitalize(head)] || rheaders[head.toLowerCase()];

                    if (headerVal == undefined) { continue; }

                    if (headerVal.constructor == Function) {
                        headerVal = headerVal(head,headers[i].substr(index + 1).trim(),headers[i]);
                    }
                    headers[i] = $c.capitalize(head) + ": " + headerVal;
                    heads.push(head,$c.capitalize(head),head.toLowerCase());
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
                    return _send(self,src, 403,$c.RESPONSES[403],null,this.header);
                }
            }
            if (!this.destinations.length) {
                var hosts = theRoute.host || [],
                    ports = theRoute.port || [],
                    host = "", port = "";
                if (!hosts.length || !ports.length) {
                    return _send(self, src, 500, $c.RESPONSES[500],null,this.header);
                }
                for (var i = 0, len = Math.max(hosts.length, ports.length); i < len; i++) {
                    host = hosts[i] || host;
                    port = ports[i] || port;

                    var destination = net.createConnection({
                        host: host,
                        port: port
                    });
                    destination.on('close', function(isClosed){
                        $c.logit('dclose');
                        self.emit('close', {"destination":destination,"had_error": isClosed});
                        if (isClosed) { _send(self, src, 500, $c.RESPONSES[500],null,src.header); }
                    });
                    destination.on('drain',function(){
                        $c.logit('ddrain');
                        self.emit('drain', {"destination":destination}); });
                    destination.on('error',function(err){
                        $c.logit('derror');
                        if(self.listeners('error').length) { self.emit('error', {"destination":destination,"error": err}); }
                        return _send(self, src, 500, $c.RESPONSES[500],null,src.header);
                    });
                    destination.on('lookup',function(err,address,family){
                        $c.logit('dlookup');
                        self.emit('lookup', {"destination":destination, error:err, address:address, family:family});
                    });
                    destination.on('timeout',function(){
                        $c.logit('dtimeout');
                        self.emit('timeout', {"destination":destination});
                        return _send(self, src, 504, $c.RESPONSES[504],null,src.header);
                    });
                    if (!this.destinations.length) {
                        destination.on('end',function(){
                            flog("<=" + src.header + " 200 " + $c.RESPONSES[200].message);
                            source.destroy();
                        });
                    }
                    this.destinations.push(destination);
                }
                this.destinations[0] && this.destinations[0].pipe(src);
            }
            var index = $c.indexOfAlt(headers,/^host\s*:\s*.*$/i);
            for (var j = 0, jlen = this.destinations.length, hi = 0, pi = 0; j < jlen; j++) {
                if (needToChunk) {
                    headers[index] = "Host: " + theRoute.host[hi] + (theRoute.port[pi] ? ":" + theRoute.port[pi] : "");
                    theRoute.host[hi + 1] && hi++;
                    theRoute.port[pi + 1] && pi++;
                    chunk = new Buffer(headers.join(lineBreakChar));
                }
                this.destinations[j].write(chunk);
            }

        });
        source.on('error', function (err) { source.destroy(); throw err; });
        source.on('end', function () { source.destroy(); });
    }
    function create(hh, pp) {
        self.server.push(net.createServer({allowHalfOpen: true}, server).listen({port:pp, host:hh,exclusive:true}, function () {
            self.emit('bind', {host: hh, port: pp});
            flog((hh ? hh + " ":"") + 'listening on port: ' + pp);
        }));
    }
    port = $c.isArray(port) ? port : [port];
    host = $c.isArray(host) ? host : [host];
    var len = Math.max(port.length,host.length);
    for (var i = 0, pi = 0, hi = 0; i < len; i++) {
        create(host[hi],port[pi]);
        !$c.isNull(port[pi + 1]) && pi++;
        !$c.isNull(host[hi + 1]) && hi++;
    }
    return self;
}
function _reload_config(proxy, cpath, out) {
    flog("Reloading config.");
    out = out || {};
    out.failed = false;
    out.code = 200;
    out.message = {"message":"Config reloaded"};
    var oldProxy = proxy;
    try {
        delete require.cache[cpath];
        proxy = _config_validator(require(cpath));
        flog("Config reloaded.");
        return proxy;
    } catch (e) {
        out.failed = true;
        out.code = 500;
        out.message = {"message":"Failed to reload config","error":e.toString()};
        flog("Failed to Load json",e);
        return (proxy = oldProxy);
    } finally {
        $c.logit('new config: ',proxy);
    }
}
function _send (self, source, statusCode, data, headers, hline1, destroy) {
    try {
        flog("<=" + hline1 + " " + statusCode + " " + (data.message || data));
        headers = headers || {};
        var harray = [];
        if ($c.isObject(headers)) {
            for (var prop in headers) {
                if (!headers.hasOwnProperty(prop)) { continue; }
                harray.push(prop.trim() + ": " + headers[prop]);
            }
            headers = harray;
        }
        var body = $c.isString(data) ? data : JSON.stringify(data),
            response = ["HTTP/1.1 " + $c.RESPONSES[statusCode].status + " " + $c.RESPONSES[statusCode].message];
        if (headers.length) {
            response = response.concat(headers);
        }
        response = response.concat([
            "Content-Length: " + body.length,
            "Connection: close",
            "",
            body
        ]);
        if (self.listeners('error').length) {
            self.emit('error', data);
        }

        //source.write(response.join(lineBreakChar),function (err) {
        //    if (err) { flog("Error on write: ",err); }
        //    source.end();
        //});
        return source.end(response.join(lineBreakChar));
    } catch (e) {
        flog(e, e.stack);
    } finally {
        $c.logit("duration for " + source.header + ": " + ($c.now() - source.start));
        source.route = undefined;
        source.destinations = [];
        source.fqdn = undefined;
        source.header = undefined;
        source.start = undefined;
        destroy && source.destroy();
    }
}
function _config_validator (config) {
    if (!config) {
        return {
            "port" : ["80"],
            "host" : [""],
            "routes" : {},
            "DEFAULT": { "host": ["localhost"], "port": ["8080"] }
        };
    }
    var error = "";
    config.routes = config.routes || {};
    config.port = config.port || "";
    config.host = config.host || "";
    config.HTTP_AUTH_USERNAME = config.HTTP_AUTH_USERNAME || "";
    config.HTTP_AUTH_PASSWORD = config.HTTP_AUTH_PASSWORD || "";

    var droutes = config.routes;

    for (var domain in droutes) { // domain is the FQDN
        if (!droutes.hasOwnProperty(domain)) { continue; }
        var routes = droutes[domain];
        for (var i = 0, len = routes.length; i < len; i++) {
            var route = routes[i];
            // set defaults
            route.path = route.path || "/";
            route.host = typeof route.host == "string" ? route.host.split(',') : (route.host || ["localhost"]);
            route.port = typeof route.port == "string" || typeof route.port == "number" ? route.port.toString().split(',') : (route.port || [""]);
            route.allow = typeof route.allow == "string" ? route.allow.split(',') : (route.allow || ["*"]);
            route.headers = route.headers || {};
            route.request_path = route.request_path || "/";
            route.domain = route.domain || domain;
            route.http_auth = route.http_auth || false;

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
    }
    if (error) { throw error; }
    return config;
}
util.inherits(Proxy, EventEmitter);
module.exports = Proxy;