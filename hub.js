var net = require('net'),
    util = require("util"),
    EventEmitter = require('events').EventEmitter;

function Hub(config) {
    var self = this, hub, host, port;
    try { hub = require(config || './hubconfig.js'); } catch (e) { }

    hub = _config_validator(hub || config);
    port = hub.port;
    host = hub.host;
    
    self.server = net.createServer(function(source) {
        self.emit('connect', source);
        
        var lineBreakChar = '\r\n';
        source.on('data',function(chunk){
            self.emit('data', chunk);
            
            this.destinations = this.destinations || [];
            if (!process.listeners('uncaughtException').length) {
                process.on('uncaughtException', function (err) {
                    self.emit('error', err);
                    source.end();
                });
            }
            var headers = chunk.toString('utf-8').split(lineBreakChar);
            var route = this.route,
                theRoute = hub.routes[route];
            if (!route || headers.length > 1) {
                this.destinations = [];
                route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');
                theRoute = hub.routes[route];
                
                if (route == "RELOAD_CONFIG") {
                    var oldHub = hub,
                        message = "{\"message\":\"Config reloaded\"}",
                        status = "200 OK";
                    try {
                        //get absolute directory
                        var absPath = config;
                        if (typeof absPath == "string") {
                            var dir = __dirname;
                            var prefix = absPath.substring(0,2);
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
                        delete require.cache[absPath || (__dirname + '/hubconfig.js')];
                        hub = _config_validator(require(config || './hubconfig.js')); 
                    } catch (e) {
                        hub = oldHub;
                        message = "{\"message\":\"Failed to reload config\",\"error\":\""+e.toString()+"\"}";
                        status = "500 Internal Server Error";
                    }
                    finally {
                        if (!hub.routes[route]) {
                            self.emit('reload', route);
                            var body = message,
                                response = [
                                    "HTTP/1.1 " + status,
                                    "Content-Length: " + body.length,
                                    "Connection: close",
                                    "",
                                    body
                                ];
                            source.write(response.join(lineBreakChar));
                            return source.end();
                        }
                    }
                }

                var regex = new RegExp("/"+route+"/?(.*)");
                headers[0] = theRoute ? headers[0].replace(regex, theRoute.path + '$1') : headers[0];
            }
            if (!theRoute) {
                route = 'DEFAULT';
                if(!(theRoute = hub.routes[route])) {
                    var body = "{\"error\":true,\"message\":\"Request could not be understood.\"}",
                        response = [
                            "HTTP/1.1 400 Bad Request",
                            "Content-Length: " + body.length,
                            "Connection: close",
                            "",
                            body
                        ];
                    self.emit('error', JSON.parse(body));
                    source.write(response.join(lineBreakChar));
                    return source.end();
                }
            }
            if (hub.routes[route].headers) {
                for (var i = 0, len = headers.length; i < len; i++) {
                    var index = headers[i].indexOf(":"),
                        head = headers[i].substr(0,index),
                        headerVal = hub.routes[route].headers[head];

                    if (headerVal == undefined) { continue; }

                    if (headerVal.constructor == Function) {
                        headerVal = headerVal(head,headers[i].substr(index + 1).trim(),headers[i]);
                    }
                    headers[i] = head + ": " + headerVal;
                }
            }
            chunk = new Buffer(headers.join(lineBreakChar));
            this.route = route;

            var allow = theRoute.allow;
            if (allow && (allow.indexOf('*') != -1)) {
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
                    var body = "{\"error\":true,\"message\":\"Forbidden.\"}",
                        response = [
                            "HTTP/1.1 403 Forbidden",
                            "Content-Length: " + body.length,
                            "Connection: close",
                            "",
                            body
                        ];
                    self.emit('error', JSON.parse(body));
                    source.write(response.join(lineBreakChar));
                    return source.end();
                }
            }
            if (!this.destinations.length) {
                var hosts = theRoute.host,
                    ports = theRoute.port,
                    host, port;
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
                        self.emit('error', {"destination":destination,"error": err});
                        source.end();
                    });
                    destination.on('lookup',function(err,address,family){
                        self.emit('lookup', {"destination":destination, error:err, address:address, family:family});
                    });
                    destination.on('timeout',function(){
                        source.end();
                    });
                    this.destinations.push(destination);
                }
                this.destinations[0].pipe(source);
            }

            for (var j = 0, jlen = this.destinations.length; j < jlen; j++) {
                this.destinations[j].write(chunk);
            }
        });
    }).listen(port, host, function () {
        self.emit('bind', {host:host, port:port});
    });
    return self;
}
function _config_validator (config) {
    if (!config) { return { routes : {"DEFAULT":{host:"localhost",port:"8080"}}, port:"", host: ""}; }
    var error = "";
    config.routes = config.routes || {};
    config.port = config.port || "";
    config.host = config.host || "";
    
    var routes = config.routes;
    for (var prop in routes) {
        if (!routes.hasOwnProperty(prop)) { continue; }
        var route = routes[prop];
        // set defaults
        route.path = route.path || "/";
        route.host = typeof route.host == "string" ? route.host.split(',') : (route.host || ["localhost"]);
        route.port = typeof route.port == "string" ? route.port.split(',') : (route.port || [""]);
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
util.inherits(Hub, EventEmitter);
module.exports = Hub;