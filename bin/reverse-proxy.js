#!/usr/bin/env node
/*/---------------------------------------------------------/*/
/*/ Craydent LLC proxy-v0.1.0                               /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
/*/---------------------------------------------------------/*/

require('craydent/noConflict');
require('shelljs/global');

var run = $c.yieldable(exec);

if($c.include('../pconfig')) {
	return $c.syncroit(function*(){
		yield run(__dirname + "/craydent-proxy.sh " + __dirname + "/../;");
		process.exit();
	});
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
$c.syncroit(function*() {
	var question = $c.yieldable(rl.question, rl),
		status, answer, ssh_file,
		yes = {yes: 1, y: 1},
		no = {no: 1, n: 1},
		routes = {};

	var port = (yield question('What port should proxy run on? (80): ')) || 80;
	var host = yield question('What host can access this proxy? (*): ');


	answer = (yield question('Do you want to configure routes now? (yes): ')) || "yes";
	while (answer in yes) {
		var name = yield question('Provide a name for this route: ');
		var rhost = (yield question('What host will this route be forwarding to? (localhost): ')) || "";
		var rport = (yield question('What port will this route be forwarding to? (80): ')) || 80;
		var rpath = yield question('What outfacing path relative to the domain? (/' + name + '): ');

		var headers = {};
		var hasHeaders = (yield question('Are there any headers to send with each request to this route? (no): ')) || "no";
		while (hasHeaders in yes) {
			var hname = yield question('What is the name of the header? ');
			var hval = yield question('What is the value of the header? ');
			headers[hname] = hval;
			hasHeaders = (yield question('Do you want to add more headers? (yes): ')) || "yes";
		}
		var allowed = (yield question('What hosts can access this route? (*): ')) || "*";
		var verbs = (yield question('What methods can be used to access this route? (get,post,put,delete): ')) || "get,post,put,delete";

		routes[name] = {
			host: rhost,
			port: rport,
			verbs: verbs,
			allow:allowed,
			headers: headers,
			path:rpath
		};

		answer = (yield question('Do you want to configure another route? (yes): ')) || "yes";
	}

	var ncontent = JSON.stringify({host:host,port:port,routes:routes});

	yield run("echo \"" + ncontent + "\" > " + __dirname + "/../pconfig.json;");
	yield run(__dirname + "/craydent-proxy.sh " + __dirname + "/../;");

});