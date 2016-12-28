/*/---------------------------------------------------------/*/
/*/ Craydent LLC proxy-v1.2.0                               /*/
/*/ Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/ (http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/
const pkg = require('../package.json'),
	ns = !pkg.name.indexOf('@craydent/') ? "@craydent/" : "";

const $c = require(ns + 'craydent/noConflict');

function encrypt_password(str) {
	var hex = "0123456789abcdef", salt = "";
	while (salt.length < 32) { salt += hex[parseInt($c.rand(0,hex.length))]; }
	return $c.md5(str + salt) + salt;
}
function correct_password(guess, str) {
	str = str || "";
	var salt = str.slice(-32);
	return $c.md5(guess + salt) + salt == str;
}
function authorized (b64, section) {
	var buf = new Buffer(b64, 'base64'),
		plain_auth = buf.toString(),
		creds = plain_auth.split(':'),
		username = creds[0],
		password = creds[1],
		auth = global.HTTP_AUTH;
	if (!auth[username] || section && !~auth[username].access.indexOf('*') && !~auth[username].access.indexOf(LISTENERS[section])) {
		return false;
	}
	if (!correct_password(password, auth[username].password)) {
		return false;
	}
	return true;
}

module.exports = {
	encrypt_password: encrypt_password,
	correct_password: correct_password,
	authorized: authorized
};