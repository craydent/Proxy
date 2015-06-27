var net = require('net');

var HOST = '127.0.0.1';
var PORT = 3000;

net.createServer({allowHalfOpen:true}, function (sock) {
    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + sock.remoteAddress +':'+ sock.remotePort);

    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {

        //console.log('DATA ' + sock.remoteAddress + ': ' + data);
//        console.log(data + "");
        // Write the data back to the socket, the client will receive it as data from the server
        var response = "",
            guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";//cuid();
        var shasum = require('crypto').createHash('sha1');
        var key = data.toString().replace(/[\s\S]*Sec-WebSocket-Key:\s*(.*)\s*?\r\n[\s\S]*/,"$1") + guid;


        shasum.update(key);
        var rkey = shasum.digest('base64');
        console.log(data.toString());
        response += "HTTP/1.1 101 Switching Protocols\r\n";
        response += "Upgrade: websocket\r\n";
        response += "Connection: Upgrade\r\n";
        //    response += "Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=\r\n";
//        response += "Sec-WebSocket-Accept: "+rkey+"\r\n\r\n";
        response += "Sec-WebSocket-Accept: "+rkey;
//        response += "Sec-WebSocket-Protocol: chat\r\n";

        console.log(response);
        sock.write(response);
        sock.pipe(sock);
    });
    sock.on('end',function (){
        console.log('socket end');
    });

    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });

    sock.write('You are connected');
    sock.pipe(sock);
}).listen(PORT,HOST);

console.log('Server listening on ' + HOST +':'+ PORT);


function cuid(msFormat) {
    /*|  {info: "Creates a Craydent/Global Unique IDendifier",
     *    category: "Global",
     *    parameters:[
     *        {msFormat: "(Bool) use microsoft format if true"}],
     *
     *    description: "http://www.craydent.com/library/1.8.0/docs#cuid"},
     *    returnType: "(String)"
     * |*/
    try {
        var pr = "", pt = "";
        msFormat && (pr="{",pt="}");
        return pr + 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function(c) {
            var r = Math.random()*16|0;
            return r.toString(16);
        }) + pt;
    } catch (e) {
        error('cuid', e);
    }
}