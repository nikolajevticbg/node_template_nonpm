// Define handlers

// Dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');

// Define the handlers
var handlers = {};

// Users handlers
handlers.users = function(data, callback){
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    } else {
        callback(405);
    }
}

// Container for users submethods
handlers._users = {};
handlers._users.post = function(data, callback) {
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length >  10 ? data.payload.password.trim() : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement ? true : false;

    if (firstName && lastName && phone && password && tosAgreement) {
        // Make sure that the user does not already exist
        _data.read('users', phone, function(err, data) {
            if (err) {
                // Hash the password
                var hashPassword = helpers.hash(password);
                if (hashPassword) {
                    // Create user object
                    var userObject = {
                        'firstName' : firstName,
                        'lastName' : lastName,
                        'phone' : phone,
                        'hashPassword' : hashPassword,
                        'tosAgreement' : true
                    };
                    // Persist user to disk
                    _data.create('users', phone, userObject, (err) => {
                        if (!err) {
                            callback(200);
                        } else {
                            console.log(err);
                            callback(500, {'Error':'Could not create the new user'});
                        }
                    });
                } else {
                    // Hash error
                    callback(500, {'Error': 'Could not hash the password'});
                }
            } else {
                // User already exists
                callback(400, {'Error' : 'User with that phone number  already exists'});
            }
        })
    } else {
        callback(400, {"error" : "Missing required fields"});
    }
}

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = function(data, callback) {
    // Check that the phone object is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
            if (tokenIsValid) {
                // Lookup the user
                _data.read('users', phone, function(err, data) {
                    if (!err && data) {
                        // Remove the hashed password in user object before returning it
                        delete data.hashPassword;
                        callback(200, data);
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(403, {'Error' : 'Missing required token in header, or the token is invalid'});
            }
        })

    } else {
        callback(400, {'Error' : 'Invalid phone number'});
    }
}

// Users - put
// Required data : phone
// Optional data : fistName, lastName, password - one must be specified
handlers._users.put = function(data, callback) {
    // Check required phone field
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.length == 10 ? data.payload.phone.trim() : false;

    // Check for the optional fields
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length >  10 ? data.payload.password.trim() : false;

    // Error if the phone is invalid
    if (phone) {
        if (firstName || lastName || password) {
            // Get the token from the headers
            var token = typof(data.headers.token) == 'string' ? data.headers.token : false;
            
            // Verify that the given token is valid for the phone number
            handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
                if (tokenIsValid) {
                        // Lookup the user
                        _data.read('users', phone, (err, userData) => {
                            if (!err && userData) {
                                // Update the fields necessary
                                if (firstName) {
                                    userData.firstName = firstName;
                                }
                                if (lastName) {
                                    userData.lastName = lastName;
                                }
                                if (password) {
                                    userData.hashPassword = helpers.hash(password);
                                }
                                // Store new structure to disk
                                _data.update('users', phone, userData, (err) => {
                                if (!err) {
                                        callback(200);  
                                } else {
                                        console.log(err)
                                        callback(500, {'Error': 'Unable to update user'});
                                }
                                });
                            } else {
                                callback(400, {'Error': 'The specified user does not exists'});
                            }
                
                        })
                } else {
                    callback(403, {'Error' : 'Missing required token in header, or the token is invalid'});
                }
            });
        }
    } else {
        callback(400, {'Error': 'Phone name is invalid'});
    }
}

handlers._users.delete = function(data, callback) {
    // Check that the phone object is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
        _data.read('users', phone, function(err, data) {
            if (!err && data) {
                _data.delete('users',phone, (err) => {
                    if (!err) {
                        callback(200);
                    } else {
                        callback(500, {'Error':'Could not delete user'});
                    }
                })
            } else {
                callback(400, {'Error' : 'Could not find specified user'});
            }
        });
    } else {
        callback(400, {'Error' : 'Invalid phone number'});
    }
}

// Tokens handlers

handlers.tokens = function(data, callback){
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        callback(405);
    }
};


handlers._tokens = {};

// Tokens post
// Required data: phone, password
handlers._tokens.post = function(data, callback) {
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length >  10 ? data.payload.password.trim() : false;
    
    if (phone && password) {
        // Lookup the user that matches phone number
        _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
                // Hash the sent password and compare it to the stored password
                var hashedPassword = helpers.hash(password);
                if (hashedPassword == userData.hashPassword) {
                    // If valid create a new token with a random name and valid for 1 hour
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;
                    var tokenObject = {
                        'phone' : phone,
                        'id' : tokenId,
                        'expires' : expires
                    };

                    // Store the token
                    _data.create('tokens', tokenId, tokenObject, function (err){
                        if (!err) {
                            callback(200, tokenObject);
                        } else {
                            callback(300, {'Error' : 'Could not create the new token'});
                        }
                    })
                } else {
                    callback(300, {'Error' : 'Password did not match stored password'});
                }
            } else {
                callback(400, {'Error' : 'Could not find the user data'});
            }
        })
    } else {
        callback(400, {'Error' : 'Missing required fields'});
    }
}

// Tokens - get
// Required data: id
// Optional data: none
handlers._tokens.get = function(data, callback) {
    // Id that was sent as query string
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // Lookup the token
        _data.read('tokens', id, function (err, tokenData){
           if (!err && tokenData) {
                callback(200, tokenData);
           } else {
                callback(400);
           }
        })
    } else {
        callback(400, {'Error' : 'Token not found!'});
    }
}
// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data, callback) {
    // Id that was sent as query string
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend ? true : false;
    if (id && extend) {
        // lookup the token
        _data.read('tokens', id, function(err, tokenData) {
            if (!err && tokenData) {
                // Check and make sure that token is not already expired
                if (tokenData.expires < Date.now()) {
                    // Set the expiration an hour from now
                    tokenData.expires = Date.now() * 1000 * 60 * 60;
                    // Store the new updates
                    _data.update('tokens', id, tokenData, function(err) {
                        if (!err) {
                            callback(200); 
                        } else {
                            callback(500, {'Error': 'Could not update token expiration'});
                        }
                    })
                } else {
                    callback(400, {'Error' : 'Token has already expired'});
                }
            } else {
                callback(400, {'Error' : 'Specified token does not extist'});
            }
        })
    } else {
        callback(400, {'Error' : 'Missing requred data'});
    }
}

// Tokens-delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function(data, callback) {
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    if (id) {
        _data.read('tokens', id, function(err, data) {
            if (!err && data) {
                _data.delete('tokens', id, function(err) {
                    if (!err) {
                        callback(200);
                    } else {
                        callback(400, {'Error' : 'Could not delete token'});
                    }
                })
            } else {
                callback(400, {'Error' : 'Could not find data'});
            }
        })
    } else {
        callback(400, {'Error' : 'Missing required field'})
    }
}

// Verify if a given token id is currently valid for a user id
handlers._tokens.verifyToken = function(id, phone, callback) {
    // Lookup the token
    _data.read('tokens', id, function(err, tokenData) {
        if (!err && tokenData) {
            // Check that the token is for the given user and not expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    })
}

// Check service
handlers.checks = function(data, callback){
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._checks[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Checks object
handlers._checks = {};

// Checks - post
// Required data, protocol, url, method, success
handlers._checks.post = function(data, callback) {
    // Validate inputs 
    var protocol = typeof(data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['get', ' put'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <=5  ? data.payload.timeoutSeconds : false;

    if (protocol && url && method && successCodes && timeoutSeconds) {
        // Check if there is a token in the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, function(err, tokenData) {
            if (!err && tokenData) {
                var userPhone = tokenData.phone;

                // Lookup the user data
                _data.read('users', userPhone,  function(err, userData) {
                    if (!err && userData) {
                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // Verify that user has less than the number of max checks

                        if (userChecks.length < config.maxChecks) {
                            // Create random id for the check
                            var checkId = helpers.createRandomString(20);

                            // Create the check object, and include the users phone
                            var checkObject = {
                                'id' : checkId,
                                'userPhone' : userPhone,
                                'protocol' : protocol,
                                'url' : url,
                                'method' : method,
                                'successCodes' : successCodes,
                                'timeoutSeconds' : timeoutSeconds
                            };

                            _data.create('checks', checkId, checkObject, (err) => {
                                if (!err) {
                                    // Add the check id to user object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // Save the new user data
                                    _data.update('users', userPhone, userData, function(err) {
                                        if (!err) {
                                            callback(200, checkObject);
                                        } else {
                                            callback(500, {'Error' : 'Could not update the user with the new check'});
                                        }
                                    });
                                } else {
                                    callback(500, {'Error' : 'Could not create new check on disk'});
                                }
                            });
                        } else {
                            callback(400, {'Error' : 'The user already has the maximum number of checks: ' + config.maxChecks});
                        }
                    } else {
                        callback(403);
                    }
                })
            } else {
                callback(403);
            }
        })
    } else {
        callback(400, {'Error' : 'Missing required inputs or inputs are invalid'})
    }
}

// Checks - het
// Required data : id
// Optional data : none
handlers._checks.get = function(data, callback) {
    // Check that the id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // Lookup the check
        _data.read('checks', id, function(err, checkData) {
            if (!err && checkData) {
                // Get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

                // Verify that the given token is valid and belongs to the user that created the check
                handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
                if (tokenIsValid) {
                    callback(200, checkData);
                } else {
                    callback(403, {'Error' : 'Missing required token in header, or the token is invalid'});
                }
                })
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error' : 'Invalid input parameter'});
    }
}

// Sample handler
handlers.ping = function(data, callback){
    callback(200, {"name":"ping"});
};
handlers.notFound = function(data, callback){
    callback(404);
};

module.exports = handlers;
