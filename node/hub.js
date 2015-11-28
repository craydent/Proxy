/*/---------------------------------------------------------/*/
/*/ Craydent LLC                                            /*/
/*/	Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/	(http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/

var net = require('net'),
    util = require("util"),
    EventEmitter = require('events').EventEmitter;

function Hub(config) {
    var self = this, hub, host, port, routes;
    try { hub = require(config || './hubconfig.js'); } catch (e) { }

    console.log('hub initalized',hub);

    hub = _config_validator(hub || config);
    port = hub.port;
    host = hub.host;
    routes = hub.routes;
    
    self.server = net.createServer(function(source) {
        self.emit('connect', source);
        
        console.log('connection established');
        var lineBreakChar = '\r\n';
        source.on('data',function(chunk){
            self.emit('data', chunk);
            
            this.destinations = this.destinations || [];
            if (!process.listeners('uncaughtException').length) {
                console.log("listening for uncaught errors");
                process.on('uncaughtException', function (err) {
                    self.emit('error', err);
                    source.end();
                });
            }
            var headers = chunk.toString('utf-8').split(lineBreakChar),
                route = this.route,
                needToChunk = !route || headers.length > 1,
                theRoute = routes[route];
            if (needToChunk) {
                this.destinations = [];
                route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');
                // find the first matching route
                var path = headers[0].split(' ')[1];
                for (var prop in routes) {
                    if (prop.indexOf('*') != -1) {
                        prop = prop.replace(/\*/g,'.*');
                    }
                    if (prop[0] == '/') {
                        prop = prop.substr(1);
                    }
                    if(new RegExp("^/"+prop+"$").test(path)) {
                        theRoute = routes[prop];
                        break;
                    }
                }
                theRoute = theRoute || routes[route];
                
                if (route == "RELOAD_CONFIG") {
                    console.log("Reloading Config");
                    var oldHub = hub,
                        message = "{\"message\":\"Config reloaded\"}",
                        status = "200 OK";
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
                        delete require.cache[absPath || (__dirname + '/hubconfig.js')];
                        hub = _config_validator(require(config || './hubconfig.js'));
                        port = hub.port;
                        host = hub.host;
                        routes = hub.routes;
                    } catch (e) {
                        hub = oldHub;
                        message = "{\"message\":\"Failed to reload config\",\"error\":\""+e.toString()+"\"}";
                        status = "500 Internal Server Error";
                    } finally {
                        console.log(hub);
                        if (!theRoute) {
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
                var path = hub.routes[route] && hub.routes[route].path ? hub.routes[route].path : '/';
                headers[0] = theRoute ? headers[0].replace(regex, path + '$1') : headers[0];
                //chunk = new Buffer(headers.join(lineBreakChar));
            }
            if (!theRoute) {
                route = 'DEFAULT';
                if(!(theRoute = routes[route])) {
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


            if (true||headers[0].indexOf("webconfig.js") != -1) {
                console.log("route: " + route);
                console.log(headers);
            }

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
    if (!config) { return { routes : {"DEFAULT":{host:["localhost"],port:["8080"]}}, port:"80", host: ""}; }
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
util.inherits(Hub, EventEmitter);
module.exports = Hub;