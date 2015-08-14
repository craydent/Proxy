var Hub = require('./hub.js');

var server = new Hub({
    routes: {
        "DEFAULT": {host: "localhost", port: 8080},
        "3010": {host: "localhost", port: 3010},
        "3012": {host: "localhost", port: 3012},
        "socket": {host: "localhost", port: 3010},
        "rest": {host: "localhost", port: 3012}
    },
    port:80,
    host:""
});