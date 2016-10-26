/*/---------------------------------------------------------/*/
/*/ Craydent LLC proxy-v1.0.0                              /*/
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
const $c = require('craydent/noConflict');
const $g = global;
const net = require('net');
const tls = require('tls');
const util = require("util");
const fs = require("fs");
const fsread = $c.yieldable(fs.readFile, fs);
const EventEmitter = require('events').EventEmitter;
const lineBreakChar = '\r\n';
const secureProtocols = {"https":1,"tls":1,"ssl":1};

var onerror;

$g.DEFAULT_HTTP_PORT = 80;
$c.DEBUG_MODE = true;

$c.catchAll(function (err) {
    console.log(err);
    console.error(err, err.stack);
    flog(err);
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
        host, port, protocol,
        routes, route_default, certs,
        config_path = '/var/craydent/config/craydent-proxy/pconfig.json';
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
                certs = config.certs;
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
    protocol = config.protocol;
    routes = config.routes;
    certs = config.certs;
    route_default = config.DEFAULT;

    function server(source) {
        flog('connection established');
        self.emit('connect', source);
        source.start = $c.now();
        source.on('data',function(chunk) {
            var src = this;
            $c.syncroit(function* () {
                var headers = chunk.toString('utf-8').split(lineBreakChar);
                self.emit('data', chunk);
                if (src.header && src.header != headers[0] && ~headers[0].indexOf('HTTP')) {
                    // fix bug/issue with net.createServer on data
                    return source.destroy();
                }

                src.destinations = src.destinations || [];
                // setting error handler if it's not already set
                !onerror && (onerror = function (err) {
                    if(self.listeners('error').length) { self.emit('error', err); }
                    $c.logit(err);
                    return _send(self, src, 500, $c.RESPONSES[500],null,src.header);
                });

                var route = src.route,
                    fqdnheader = headers.filter(function(line){ return $c.startsWith(line.toLowerCase(),'host'); })[0],
                    fqdn = src.fqdn || (fqdnheader ? fqdnheader.replace(/^host\s*:\s*(.*)$/i,'$1') : ""),
                    needToChunk = !route || headers.length > 1,
                    theRoute = route == "DEFAULT" ? route_default :
                        routes[fqdn] && routes[fqdn].filter(function(rt){ return rt.request_path == route; })[0],
                    useCurrentRoute = false,
                    _l1parts = headers[0].split(' '),
                    method = (_l1parts[0] || "").toLowerCase(),
                    req_path = (_l1parts[1] || "").replace(/index.html$/i,''), // the path that is being requested
                    old_path = req_path;

                src.fqdn = src.fqdn || fqdn;
                src.header = src.header || headers[0];
                routes[fqdn] =  routes[fqdn] || [];

                if (needToChunk) {
                    src.destinations = [];
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
                            return _send(self,src, out.code, out.message,null,src.header);
                        }
                    }

                    headers[0] = src.header = theRoute ? src.header.replace(old_path, req_path) : src.header;
                }
                flog("=>" + src.header);
                if (!theRoute) {
                    route = 'DEFAULT';
                    if(!(theRoute = route_default)) {
                        if ($c.indexOfAlt(headers,/User-Agent: ELB-HealthChecker/) != -1) {
                            return _send(self, src, 200, $c.RESPONSES[200],null,src.header, true);
                        } else {
                            return _send(self, src, 400, $c.RESPONSES[400],null,src.header);
                        }
                    }
                }

                var verbs = theRoute.verbs;
                if (verbs && verbs.indexOf('*') != -1 && verbs.indexOf(method) == -1) {
                    return _send(self,src, 405, $c.RESPONSES[405],null,src.header);
                }
                if (theRoute.http_auth) {
                    var authHeaderString = headers.filter(function(line){ return $c.startsWith(line.toLowerCase(),'authorization'); })[0],
                        auth = authHeaderString ? authHeaderString.replace(/^authorization\s*:\s*(.*)$/i,'$1') : "",
                        auth_header = {'WWW-Authenticate: Basic realm': theRoute.domain + 'Secure Area'};

                    if (!auth) {     // No Authorization header was passed in so it's the first time the browser hit us
                        var body = '<html><body>You are trying to access a secure area.  Please login.</body></html>';
                        return _send(self, src, 401, body, auth_header,src.header);
                    }

                    var encoded = auth.split(' ')[1];   // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part

                    var buf = new Buffer(encoded, 'base64'),
                        plain_auth = buf.toString(),
                        creds = plain_auth.split(':'),
                        username = creds[0],
                        password = creds[1];

                    if (username != theRoute.http_username || password != theRoute.http_password) {
                        var body = '<html><body>You are not authorized to access this page</body></html>';
                        return _send(self, src, 401, body, auth_header,src.header);
                    }
                }
                src.route = theRoute.request_path;
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
                        return _send(self,src, 403,$c.RESPONSES[403],null,src.header);
                    }
                }
                if (!src.destinations.length) {
                    var hosts = theRoute.host || [],
                        ports = theRoute.port || [],
                        protocols = theRoute.protocol || [],
                        host = "", port = "", prot = "";
                    if (!hosts.length || !ports.length) {
                        return _send(self, src, 500, $c.RESPONSES[500],null,src.header);
                    }
                    for (var i = 0, len = Math.max(hosts.length, ports.length); i < len; i++) {
                        host = hosts[i] || host;
                        port = ports[i] || port;
                        prot = protocols[i] || prot;

                        var options = { host: host, port: port},
                            destination;

                        if (prot.toLowerCase() in secureProtocols) {
                            var conf = yield _get_cert_data(config.certs[fqdn]);
                            $c.merge(conf, {
                                socket: destination,
                                servername: host,
                                rejectUnauthorized: !!config.certs.rejectUnauthorized
                            });
                            destination = tls.connect(conf);
                        } else {
                            destination = net.createConnection(options);
                        }

                        destination.on('close', function(isClosed){
                            $c.logit('dclose');
                            self.emit('close', {"destination":destination,"had_error": isClosed});
                            if (isClosed) { _send(self, src, 500, $c.RESPONSES[500],null,src.header); }
                        });
                        destination.on('drain',function(){
                            $c.logit('ddrain');
                            self.emit('drain', {"destination":destination}); });
                        destination.on('error',function(err){
                            $c.logit('derror',err);
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
                        if (!src.destinations.length) {
                            destination.on('end',function(){
                                flog("<=" + src.header + " 200 " + $c.RESPONSES[200].message);
                                source.destroy();
                            });
                        }
                        src.destinations.push(destination);
                    }
                    src.destinations[0] && src.destinations[0].pipe(src);
                }
                var index = $c.indexOfAlt(headers,/^host\s*:\s*.*$/i);
                for (var j = 0, jlen = src.destinations.length, hi = 0, pi = 0; j < jlen; j++) {
                    if (needToChunk) {
                        headers[index] = "Host: " + (theRoute.host[hi] == "localhost" ? fqdn : theRoute.host[hi]) + (theRoute.port[pi] ? ":" + theRoute.port[pi] : "");
                        theRoute.host[hi + 1] && hi++;
                        theRoute.port[pi + 1] && pi++;
                        chunk = new Buffer(headers.join(lineBreakChar));
                    }
                    src.destinations[j].write(chunk);
                }
            });
        });
        source.on('error', function (err) { source.destroy(); throw err; });
        source.on('close', function () { source.destroy(); });
        source.on('end', function () { source.destroy(); });
    }
    function create(hh, pp, prot) {
        var socket = net,
            options = {allowHalfOpen: true};
        if (prot.toLowerCase() in secureProtocols) {
            socket = tls;
            options = {
                SNICallback: function (domain, cb) {
                    $c.syncroit(function* () {
                        var cert = certs[domain];
                        if (cert) {
                            var conf = yield _get_cert_data(cert);
                            cb(null, tls.createSecureContext(conf));
                        } else {
                            cb();
                        }
                        //return ctx;
                    });
                }
            };
        }
        self.server.push(socket.createServer(options, server).listen({port:pp, host:hh}, function () {
            self.emit('bind', {host: hh, port: pp});
            flog((hh ? hh + " ":"localhost ") + 'listening on port: ' + pp);
        }));
    }
    port = $c.isArray(port) ? port : [port];
    host = $c.isArray(host) ? host : [host];
    protocol = $c.isArray(protocol) ? protocol : [protocol];
    var len = Math.max(port.length,host.length);
    for (var i = 0, pi = 0, hi = 0, si = 0; i < len; i++) {
        flog(i,host[hi],port[pi],protocol[si] || "http");
        create(host[hi],port[pi],protocol[si] || "http");
        !$c.isNull(port[pi + 1]) && pi++;
        !$c.isNull(host[hi + 1]) && hi++;
        !$c.isNull(protocol[si + 1]) && si++;
    }
    return self;
}
function _get_cert_data (cert_data) {
    return $c.syncroit(function* () {
        var data = {},
            tmp = {
                key: cert_data.key,
                cert: cert_data.cert || cert_data.certificate,
                ca: cert_data.ca || cert_data.certificate_authority
            },
            fields = ['key','cert','ca'];

        for (var i = 0, len = fields.length; i < len; i++) {
            var field = fields[i];
            if ($c.isString(tmp[field])) {
                data[field] = (yield fsread(field))[1];
            } else if ($c.isArray(tmp[field])) {
                data[field] = tmp[field].join('\n');
            }
        }
        return data;
    });
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
        if (source.destroyed || source.closed) { return; }
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
        source.closed = true;
    }
}
function _config_validator (config) {
    if (!config) {
        return {
            "port" : ["80"],
            "host" : [""],
            "protocol": [""],
            "certs": {},
            "routes" : {},
            "DEFAULT": { "host": ["localhost"], "port": ["8080"] }
        };
    }
    var error = "";
    config.routes = config.routes || {};
    config.certs = config.certs || {};
    config.port = config.port || "";
    config.host = config.host || "";
    config.protocol = config.protocol || "";
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
            route.protocol = typeof route.protocol == "string" ? route.protocol.split(',') : (route.protocol || ["http"]);
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
Proxy.VERSION = require('./package.json').version;
module.exports = Proxy;