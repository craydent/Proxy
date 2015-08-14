var net = require('net'),
    util = require("util"),
    EventEmitter = require('events').EventEmitter;

function Hub(config) {
    var self = this, hub, host, port, onConnect, onData, onError, onReload, onBind;
    try { hub = require(config || './hubconfig.js'); } catch (e) { }

    hub = hub || config || {};
    port = hub.port;
    host = hub.host;
//    onConnect = hub.onRequest || foo;
//    onData = hub.onData || foo;
//    onError = hub.onError || foo;
//    onReload = hub.onReload || foo;
//    onBind = hub.onBind || foo;
    
    return net.createServer(function(source) {
        self.emit('connect', source);
//        onConnect.call(hub, source);
        
        var lineBreakChar = '\r\n';
        source.on('data',function(chunk){
            self.emit('data', chunk);
//            onData.call(hub, chunk);
            
            this.destinations = this.destinations || [];
            if (!process.listeners('uncaughtException').length) {
                process.on('uncaughtException', function (err) {
                    self.emit('error', err);
//                    onError.call(hub, err);
                    source.end();
                });
            }
            var headers = chunk.toString('utf-8').split(lineBreakChar);
            var route = this.route;
            if (!route || headers.length > 1) {
                this.destinations = [];
                route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');

                if (route == "RELOAD_CONFIG") {
                    var oldHub = hub;
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
                        hub = require(config || './hubconfig.js'); 
                    } catch (e) {
                        hub = oldHub;
                    }
                    finally {
                        if (!hub.routes[route]) {
                            self.emit('reload', route);
//                            onReload.call(hub, route);
                            var body = "{\"message\":\"Config reloaded\"}",
                                response = [
                                    "HTTP/1.1 200 OK",
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
                headers[0] = hub.routes[route] ? headers[0].replace(regex, path + '$1') : headers[0];
                chunk = new Buffer(headers.join(lineBreakChar));
            }
            
            this.route = route;
            if (!hub.routes[route]) {
                // retrieve the route via the referece
                var refererRoute = (headers.filter(function(head){
                    return head.toLowerCase().indexOf('referer: ') != -1;
                })[0] || " ").split(' ')[1].replace(/https?:\/\/.*?\/(.*?)\/.*|\/(.*?)/,'$1');

                //port = parseInt(refererPort);

                //if (!port || port.toString().length != refererPort.length) {
                if (!hub.routes[refererRoute]) {
                    //port = DEFAULT_HTTP_PORT;
                    this.route = route = 'DEFAULT';
                }
            }

            if (!route) {
                var body = "{\"error\":true,\"message\":\"Request could not be understood.\"}",
                    response = [
                        "HTTP/1.1 400 Bad Request",
                        "Content-Length: " + body.length,
                        "Connection: close",
                        "",
                        body
                    ];
                self.emit('error', JSON.parse(body));
//                onError(JSON.parse(body));
                source.write(response.join(lineBreakChar));
                return source.end();
            }

            if (!this.destinations.length) {
                hub.routes[route].host = typeof hub.routes[route].host == "string" ? hub.routes[route].host.split(',') : hub.routes[route].host;
                hub.routes[route].port = typeof hub.routes[route].port == "object" ? hub.routes[route].port : hub.routes[route].port.toString().split(',');
                var hosts = hub.routes[route].host,
                    ports = hub.routes[route].port,
                    lhost = "", lport = "";
                for (var i = 0, len = hosts.length; i < len; i++) {
                    lhost = hosts[i] || lhost;
                    lport = ports[i] || lport;
                    var destination = net.createConnection({
                        host: lhost,
                        port: lport
                    });
                    destination.on('error',function(){
                        source.end();
                    });
                    destination.on('close',function(isClosed){
                        if (isClosed) {
                            source.end();
                        }
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
}
util.inherits(Hub, EventEmitter);
module.exports = Hub;