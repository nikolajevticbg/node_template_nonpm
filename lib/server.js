/*
 * Server related taskes
 */


// Dependencies
const http = require('http');
const https = require('https');
const url  = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog('server');


// Instantiate the server module object
var server={};

/*// @TODO: 
helpers.sendTwillioSMS('351913510668', 'Ola', (err) => {
    console.log('This was the error: ', err);
});*/

// Instantiating http server
server.httpServer = http.createServer((req, res) => {
    server.unifiedServer(req, res);
});


// Instantiating https server
server.httpsServerOptions = {
    'key':fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert':fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}

server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
    unifiedServer(req, res);
});



// Unified server logic
server.unifiedServer = function (req, res) {

    // Get URL and parse it
    var parsedUrl = url.parse(req.url, true);

    // Get the path
    var path = parsedUrl.pathname;
    var trimmedPath = path.replace(/^\/+|\/+$/g,'');

    // Get the qry string as object
    var queryStringObject = parsedUrl.query;

    // Get the HTTP method
    var method = req.method.toLowerCase();

    // Get the headers as an object
    var headers = req.headers;

    // Get the payload
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    req.addListener('data', (data) => {
        buffer += decoder.write(data);
    });

    req.addListener('end', () => {
        buffer += decoder.end();

        // Choose the handler this request should go to
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : server.router.notFound;

        // Construct the data object to send to the handler
        var data = {
            'trimmedPath' : trimmedPath,
            'queryStringObject' : queryStringObject,
            'method' : method,
            'headers' : headers,
            'payload' : helpers.parseJsonToObject(buffer)
        }

        // Route the request to handler specified in the router
        chosenHandler(data, (statusCode, payload) => {
            // Use the status code
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            // Use the payload or default to empty object
            payload = typeof(payload) == 'object' ? payload : {};

            // Convert a payload to a string
            var payloadString = JSON.stringify(payload);

            // Return response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            // Log the request path
            // If the response is 200 then green, else red
            if (statusCode == 200) {
                debug('\x1b[32m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m',method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            }
        })
    })
}

// Define a request router
server.router = {
    'ping' : handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks' : handlers.checks,
    'notFound' : handlers.notFound
};

server.init = function() {
    // Starting the servers
    server.httpServer.listen(config.httpPort, ()=> {
    console.log('\x1b[36m%s\x1b[0m', `The server is listening on the port ${config.httpPort}`);
    });

    // Starting the servers
    server.httpsServer.listen(config.httpsPort, ()=> {
    console.log('\x1b[35m%s\x1b[0m', `The server is listening on the port ${config.httpsPort}`);
    });

}
// Export the module
module.exports = server;
