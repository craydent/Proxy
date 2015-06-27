
var http = require('http'),
    net = require('net');

var s1 = http.createServer(function(req,res){
    console.log('on request');
    var destination = net.createConnection({
        host:"localhost",
        port:8082
    });
    req.connection.resume();
    pipe(req.connection,destination);
});
s1.listen(8080);

s1.on('connection',function(soc){
    soc.pause();
});

s1.on('connect',function(request, socket, head){
    console.log(head);
});



var s2 = net.createServer(function(source){
    console.log('on net connection');
    source.setKeepAlive(true);
    source.on('data',function(data){
//        console.log(arguments);
        console.log('on data');
        var st = data.toString('utf-8');
        console.log(st);
        var destination = net.createConnection({
            host:"localhost",
            port:8082
        });
        source.resume();
        pipe(source,destination);
    });

    var destination = net.createConnection({
        host:"localhost",
        port:8082
    });

});
s2.listen(8081,function(){
    console.log('server bound');

    s2.on('connection', function(){
        console.log('connection made...\n')
    })

    s2.on('data', function(data) {
        console.log('data received');
        console.log('data is: \n' + data);
    });
});

function pipe(src,dest) {
    src.pipe(dest);
    dest.pipe(src);
}