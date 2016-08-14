var http = require('http');

http.createServer(function(req,res){
    console.log('hellow world');
    res.end('hello world');
}).listen(8082);