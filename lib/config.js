
// Container for all the environments
var environments = {};


// Staging (default) environment
//

environments.staging = {
    'httpPort':3000,
    'httpsPort':3001,
    'envName':'staging',
    'hashingSecret':'thisIsASecret',
    'maxChecks' : 5,
    twilio : { 
        'accountSID' : 'ACc963fca37e29bd4642ae3385df61466b',
        'accountToken' : 'b3dc625af1f3755cd1c73da58a372a30',
        'fromPhone' : '+17542197982'
    }
};



environments.production = {
    'httpPort':5000,
    'httpsPort':5001,
    'envName':'production',
    'hashingSecret':'thisIsASecret',
    'maxChecks' : 5,
    twilio : { 
        'accountSID' : 'ACc963fca37e29bd4642ae3385df61466b',
        'accountToken' : 'b3dc625af1f3755cd1c73da58a372a30',
        'fromPhone' : '+17542197982'
    }
};

var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

var environmentToExport =  typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

// Export the module
module.exports = environmentToExport;

