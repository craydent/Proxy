var net = require('net');
var hub = require('./hubconfig.js');



net.createServer(function(source) {
    var lineBreakChar = '\r\n';
    console.log('server created');
    source.on('data',function(chunk){
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
            this.destination = undefined;
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

        if (!this.destination) {
            this.destination = net.createConnection({
                host: hub.routes[route].host,
                port: hub.routes[route].port
            });
            this.destination.pipe(source);
        }
        this.destination.write(chunk);
    });
}).listen(8080, "localhost");
