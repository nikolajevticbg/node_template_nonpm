/*
 * Worker related tasks
 */

// Dependencies
var path = require('path');
var fs = require('fs');
var  _data = require('./data');
var http = require('http');
var  https = require('https');
var url = require('url');

// Instantiate worker object
var workers = {};


// Lookup all checks, get their data, send to validator
workers.gatherAllChecks = function() {
    // Get all the checks
    _data.list('checks', (err, checks) => {
        if (!err && checks && checks.length > 0) {
            checks.forEach(check => {
                // Read in the check data
                _data.read('checks', check, (err, originalCheckData) => {
                    if (!err && originalCheckData) {
                        // Pass the data to the check validator and function continue or break
                        workers.validateCheckData(originalCheckData);   
                    } else {
                        console.log('Error reading one of check data');
                    }
                });
            });
            
        } else {
            console.log('{Error: Could not find any checks to process}');
        }
    });
}

// Sanity checking of check data
workers.validateCheckData = function(originalCheckData) {
    originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https', 'http'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol.trim() : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method.trim() : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.success : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'integer' && originalCheckData.timeoutSeconds % 1 === 0  && originalCheckData.timeoutSeconds >= 1 &&  originalCheckData.timeoutSeconds < 5 ? originalCheckData.timeoutSeconds : false;

    // Set the keys that may not be set if the workers never seen this object
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'integer' && originalCheckData.lastChecked % 1 === 0  &&  originalCheckData.lastChecked < 5 ? originalCheckData.lastChecked : false;

    // If all the check pass, pass the data along the next step of the process
    if (originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.url &&
    originalCheckData.protocol &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds) {
       workers.preformCheck(originalCheckData); 
    } else {
        console.log('Error: One of the checks is not properly formatted');
    }
};


// Perform the check, send original check data  and the outcome of check process
workers.performCheck = function(originalCheckData) {
    // Prepare the initial check outcome
    var checkOutcome = {
        'error' : false,
        'responseCode' : false
    }

    // Mark the outcome has not been sent yet
    var outcomeSent = false;

    // Parse the houtname and the path from originalCheckData
    var parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path; // Using path because we want the query string

    // Construct the request
    var requestDetails = {
        'protocol' : originalCheckData.protocol + ':',
        'hostname' : hostName,
        'method' : originalCheckData.method.toUpperCase(),
        'path' : path,
        'timeout' : originalCheckData.timeoutSeconds * 1000
    }

    // Make http request, instantiate request object using http or https
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, function(res) {
        // Grab the status of the sent request
        var status = res.statusCode;;

        // Update the checkOutcoma and pass the data
        checkOutcome.responseCode = status;
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //Bind to the error event so it doesn't get thrown
    req.on('error', function(e) {
        // Update the check outcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : e
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    })

    // Bind to the timeout event
    req.on('timeout', function(e) {
        // Update the check outcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : 'timeout' 
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    })

    // End the request
    req.end();
}

// Process the check outcome, update the check data as needed, trigger an alert if needed
// Special logic for accomodated for a check that has never been tested before
workers.processCheckOutcome = function(originalCheckData, checkOutcome) {
    // Decide if the check is considered up or down
    var state  = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // Decide if an elert is wanted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // Update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = now();


    // Save the updates
    _data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            // Send the new check data to the next phase
            if (alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed, no alert needed');
            }
        } else {
            console.log('Error trying to save updates to one of the checks');
        }
    });
};

// Alert the user as to change in their check status
workers.alertUserToStatusChange = function(newCheckData) {
   var msg = 'Alert: your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state;

    helpers.sendTwillioSMS(newCheckData.userPhone, msg, function(err) {
        if(!err) {
            console.log('Success: User was alerted for a status change in their check, via SMS', msg);
        } else {
            console.log('Error: Could not send SMS alert to a user who had state change in their request');
        }
    })
}

// Timer to execute the worker process once per minute
workers.loop = function() {
    setInterval(function() {
        workers.gatherAllChecks();
    }, 1000 * 60)
}


// Init script
workers.init = function() {
    // Execute all the checks immidiately
    workers.gatherAllChecks();

    // Call the loop so the checks will execute later on
    workers.loop();
}

// Export the module
module.exports = workers;




