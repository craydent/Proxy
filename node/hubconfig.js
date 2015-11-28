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
        "craydent_socket":{host:"localhost",port:4000},
        "shapow_page":{host:"localhost",port:4100},
        "shapow_rest":{host:"localhost",port:4300},
        "shapow_include":{host:"localhost",port:4400},
        "catnap_rest":{host:"localhost",port:5000},
        "DEFAULT":{host:"localhost",port:8000}
        /*,
        "route_path":{host:"",port:80},
        "route/with/all/possible/options/*" : {
            host:"",
            port:80,
            headers:{},
            allowed:"*",
            verbs:"get,post,put,delete"
        }*/
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
    self.host = "";
}
var h = new Hosts();

module.exports = h;