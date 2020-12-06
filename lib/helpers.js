/*
 * Helpers for various tasks
 *
 */
// Dependencies
var crypto = require('crypto');
var config = require('./config');
var querystring = require('querystring');
var https = require('https');


// Container for all the helpers
var helpers = {};

// Create a SHA256 hash
helpers.hash = function(str) {
    if (typeof(str) == 'string' && str.length > 0) {
        var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    } else {
        return false;
    }
}

// Parse a JSON string to a object in all cases, without throwing
helpers.parseJsonToObject = function(str) {
   try {
        let obj = JSON.parse(str);
        return obj;
   } catch(e) {
        return {};
   } 
}

// Create string of random alphanum of given length
helpers.createRandomString = function(strLength) {
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    if (strLength) {
        // Define all the characters that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrswyz0123456789';

        // Start the final string
        var str = '';
        for (i = 1; i <= strLength; i++) {
            // Get the random character from a possible string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));

            // Append the random character to a final string
            str += randomCharacter;
        }

        return str;
    } else {
        return false;
    }
}

helpers.sendTwillioSMS = function(phone, msg, callback) {
    // Validbte paramteres
    phone = typeof(phone) == 'string' && phone.trim().length > 9 ? phone.trim() : false;
    msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length < 160 ? msg.trim() : false;

    if (phone && msg) {
        // Configure the request to send to Twillio
        var payload = {
            'From' : config.twilio.fromPhone,
            'To' : '+' + phone,
            'Body' : msg
        };
        
        // Stringify payload
        var stringPayload = querystring.stringify(payload);

        // Comnfigure request details
        var requestDetails = {
            'protocol' : 'https:',
            'hostname' : 'api.twilio.com',
            'method' : 'POST',
            'path' : '/2010-04-01/Accounts/' + config.twilio.accountSID + '/Messages.json',
            'auth' : config.twilio.accountSID + ':' + config.twilio.accountToken,
            'headers' : {
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Content-Length' : Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request
        var req = https.request(requestDetails, (response) => {
            // Take the status of the sent request
            var status = response.statusCode;

            // Callback success if everything OK
            if (status == 200 || status == 201) {
                callback(false); 
            } else {
                callback('Status code returned was:' + status);
            }
        });
        
        // Bind to the error event  so it doesn't get thrown
        req.on('error', function(err) {
            callback(err);
        });

        // Add the payload
        req.write(stringPayload);
        req.end();
    } else {
        callback('Given parameters missing or invalid');
    }
}


// Export the module
module.exports = helpers;
