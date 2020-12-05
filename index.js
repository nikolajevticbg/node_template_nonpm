/*
 *
 * Primary API file
 *
 */
// Dependencies
const http = require('http');
const https = require('https');
const url  = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./lib/config');
const fs = require('fs');
const handlers = require('./lib/handlers');
const helpers = require('./lib/helpers');

// Instantiating http server
var httpServer = http.createServer((req, res) => {
    unifiedServer(req, res);
});

// Starting the servers
httpServer.listen(config.httpPort, ()=> {
   console.log(`The server is listening on the port ${config.httpPort}`);
});

// Instantiating https server
var httpsServerOptions = {
    'key':fs.readFileSync('./https/key.pem'),
    'cert':fs.readFileSync('./https/cert.pem')
}

var httpsServer = https.createServer(httpsServerOptions, (req, res) => {
    unifiedServer(req, res);
});

// Starting the servers
httpsServer.listen(config.httpsPort, ()=> {
   console.log(`The server is listening on the port ${config.httpsPort}`);
});


// Unified server logic
var unifiedServer = function (req, res) {

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
        var chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : router.notFound;

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
            console.log('Returning this response: ', statusCode, payloadString);
        })
    })
}

// Define a request router
var router = {
    'ping' : handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks' : handlers.checks,
    'notFound' : handlers.notFound
};
