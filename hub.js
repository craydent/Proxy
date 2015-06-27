var net = require('net');
var hub = require('./hubconfig.js');



net.createServer(function(source) {
    var lineBreakChar = '\r\n';
    console.log('server created');
    source.on('data',function(chunk){
        this.destinations = this.destinations || [];
        if (!process.listeners('uncaughtException').length) {
            process.on('uncaughtException', function (err) {
                console.log(err);
                source.end();
            });
        }
        console.log('receiveing data: ' + chunk.length);
        var headers = chunk.toString('utf-8').split(lineBreakChar);
        var route = this.route;
        if (!route || headers.length > 1) {
            this.destinations = [];
            route = headers[0].split(' ')[1].replace(/\/(.*?)\/.*|\/(.*?)/,'$1');

            var regex = new RegExp("/"+route+"/?(.*)");
            headers[0] = hub.routes[route] ? headers[0].replace(regex,'/$1') : headers[0];
            chunk = new Buffer(headers.join(lineBreakChar));
        }

        if (!route) {
            source.end();
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

        if (!this.destinations.length) {
            hub.routes[route].host = typeof hub.routes[route].host == "string" ? hub.routes[route].host.split(',') : hub.routes[route].host;
            hub.routes[route].port = typeof hub.routes[route].port == "string" ? hub.routes[route].port.split(',') : hub.routes[route].port;
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
}).listen(8080, "localhost");
