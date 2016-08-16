require('craydent/noConflict');
var cluster = $c.clusterit(function(){
	var Proxy = require('./proxy.js');
	var server = new Proxy();
});

cluster.on('exit', function(worker, code, signal) {
	console.log("worker " + worker.process.pid + " died");
});