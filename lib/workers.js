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
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');

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
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length >= 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https', 'http'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol.trim() : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(originalCheckData.method.toUpperCase()) > -1 ? originalCheckData.method.trim().toUpperCase() : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0  && originalCheckData.timeoutSeconds >= 1 &&  originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    // Set the keys that may not be set if the workers never seen this object
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked % 1 === 0  &&  originalCheckData.lastChecked < 5 ? originalCheckData.lastChecked : false;

    // If all the check pass, pass the data along the next step of the process
    if (originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.url &&
    originalCheckData.protocol &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds) {
       workers.performCheck(originalCheckData); 
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

    // Log the outcome
    var timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // Update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

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

// Log to log into file
workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck){
    // Form the log data
    var logData = {
        'check' : originalCheckData,
        'outcome' : checkOutcome,
        'state' : state,
        'alert' : alertWarranted,
        'time' : timeOfCheck
    };
    
    // Convert data to as string
    var logString = JSON.stringify(logData);

    // Determine the name of the file
    var logFileName = originalCheckData.id;

    // Append the log string to the file
    _logs.append(logFileName, logString, (err) => {
        if (!err) {
            console.log('Logging to file succeedeed');
        } else {
            console.log('Logging to file failed');
        }

    })
}



// Timer to execute the worker process once per minute
workers.loop = function() {
    setInterval(function() {
        workers.gatherAllChecks();
    }, 1000 * 60);
}


// Rotate (comress) logfiles
workers.rotateLogs = function() {
    // List all the non-compressed logfiles
    _logs.list(false, function(err, logs) {
        if (!err && logs && logs.length) {
            logs.forEach(function(logName) {
                // Compress the data to a different file
                var logId = logName.replace('.log', '');
                var newFileId = logId+'-'+Date.now();
                _logs.compress(logId, newFileId, function(err) {
                    if (!err) {
                        // Truncate log file
                        _logs.truncate(logId, function(err) {
                            if (!err) {
                                console.log("Success truncating logfile");
                            } else {
                                console.log("Error truncating logfile");
                            }
                        })
                    } else {
                        console.log("Error compressing one of the log files", err);
                    }
                });
            })
        } else {
            console.log('Error : Could not find any logs to rotate');
        }
    });
}

// Timer to execute the log rotation process once per day
workers.logRotationLoop = function() {
    setInterval(function() {
        workers.rotateLogs() 
    }, 1000 * 60 * 60 * 24);
}

// Init script
workers.init = function() {
    
    // Send to console in yellow
    console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');

    // Execute all the checks immidiately
    workers.gatherAllChecks();

    // Call the loop so the checks will execute later on
    workers.loop();

    // Compress all the logs immidiately
    workers.rotateLogs();

    // Call the compression loops so the logs will be compressed
    workers.logRotationLoop();

}

// Export the module
module.exports = workers;




