/*
 * Helpers for various tasks
 *
 */
// Dependencies
var crypto = require('crypto');
var config = require('./config');


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




// Export the module
module.exports = helpers;
