global.DEFAULT_HTTP_PORT = 80;

function Hosts() {
    var self = this;
    self.routes = {};
    self.port = 80;
    self.host = "localhost";
}
var h = new Hosts();

setTimeout(function(){
    h.routes = {
        "DEFAULT":{host:"localhost",port:80},
        "8082":{host:"localhost",port:8082},
        "8083":{host:"localhost",port:8083},
        "3000":{host:"localhost",port:[3000,3001]},
        "3012":{host:"ec2-23-23-199-244.compute-1.amazonaws.com",port:3012},
        "esri":{host:"esri.com",port:80},
        "google":{host:"google.com",port:80}
    };

},5000);
module.exports = h;