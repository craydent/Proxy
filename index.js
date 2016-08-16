var Proxy = require('./proxy.js');
var server = new Proxy();

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
	// Fork workers.
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
	var Proxy = require('./proxy.js');
	var server = new Proxy();
}