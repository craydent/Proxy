/*/---------------------------------------------------------/*/
/*/ Craydent LLC proxy-v0.1.28                              /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
var $c = require('craydent/noConflict');
var Proxy = require('./proxy.js');
function child (ccluster) {
	var server = new Proxy();
	flog('child process initialized');
}
function flog(){
	var prefix = $c.now('M d H:i:s')+' PID[' + process.pid + ']: ';
	for (var i = 0, len = arguments.length; i < len; i++) {
		if ($c.isString(arguments[i])) { console.log(prefix + arguments[i]); }
		else { console.log(prefix, arguments[i]); }
	}
}
var cluster = $c.clusterit({
	auto_spawn:true,
	onfork:function(worker){
		flog('worker forked: ', worker.process.pid);
	},
	onexit:function(worker, code, signal){
		flog('worker died: ', worker.pid);
		flog(code);
		flog(signal);
	}
},child);