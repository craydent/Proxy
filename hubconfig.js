/*/---------------------------------------------------------/*/
/*/ Craydent LLC                                            /*/
/*/	Copyright 2011 (http://craydent.com/about)              /*/
/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
/*/	(http://craydent.com/license)                           /*/
/*/---------------------------------------------------------/*/

global.DEFAULT_HTTP_PORT = 80;

function Hosts() {
    /*|{

    }|*/
    var self = this;
    self.routes = {
        "DEFAULT":{host:"localhost",port:8080},
        "route_path":{host:"",port:80}
        //"Key":{host:"(Array or String) host or domain we should forward to",port:3010/*Integer or Array of ports*/,path:"",headers:{}}
        /*
            Assume route is {"routeOne":{"host":"www.google.com",port:80,path:"/myRoute",headers:{"Header Name":"(String or Function) Overwrite Value"}}}
                and this proxy is running on port 80 on www.example.com
            Key is the route name or route path.
            EX: if a request comes through on http://www.example.com/routeOne/subdirectory/file.html
                the request will be forwarded to http://www.google.com/myRoute/subdirectory/file.html
            if there is a header in the request called "Header Name" (regardless of the previous Value)
                will forward the request with the header defined in the config
        */
    };
    self.port = 80;
    self.host = "localhost";
}
var h = new Hosts();

module.exports = h;