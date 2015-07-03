var net = require('net');

function Hub(host, port, config) {
    var hub = require(config || './hubconfig.js');
    if (typeof host == "object") {
        port = host.port;
        host = host.host;
    }
    port = port || hub.port;
    host = host || hub.host;
    return net.createServer(function(source) {
        var lineBreakChar = '\r\n';
        source.on('data',function(chunk){
            this.destinations = this.destinations || [];
            if (!process.listeners('uncaughtException').length) {
                process.on('uncaughtException', function (err) {
                    console.log(err);
                    source.end();
                });
            }
            var headers = chunk.toString('utf-8').split(lineBreakChar);
            var route = this.route;
            if (!route || headers.length > 1) {
                this.destinations = [];
                route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');

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
                source.end();
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
                    this.destinations.push(net.createConnection({
                        host: lhost,
                        port: lport
                    }));
                }
                this.destinations[0].pipe(source);
            }

            for (var j = 0, jlen = this.destinations.length; j < jlen; j++) {
                this.destinations[j].write(chunk);
            }
        });
    }).listen(port, host);
}
module.exports = Hub;