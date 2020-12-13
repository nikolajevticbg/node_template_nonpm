/*
 * Library for storing and log rotating
 */

// Dependencies
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

// Container for the module
var lib = {};

// Base directory for the logs module
lib.baseDir = path.join(__dirname,'/../.logs/');

// Append function. Append a string to a file
// Create file if it not exists
lib.append = function(file, str, callback) {
    // Open the file for appending
    fs.open(lib.baseDir+file+'.log','a', function(err, fileDescriptor) {
        if (!err && fileDescriptor) {
            // Append to the file and close it
            fs.appendFile(fileDescriptor, str+'\n', (err) => {
                if (!err) {
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false);
                        } else {
                            callback('Could not close the file');
                        }
                    }) 
                } else {
                    callback ('Error appending the file');
                }
            });
        } else {
            callback('Could not open the file for appending');
        }
    });

};

lib.list = function(includeCompressLogs, callback) {
    fs.readdir(lib.baseDir , function(err, data) {
        if (!err && data && data.length > 0) {
            var trimmedFileNames = [];
            data.forEach(function(fileName) {
                // Add the .log files
                if (fileName.indexOf('.log' > -1)) {
                    trimmedFileNames.push(fileName.replace('.log', ''));
                };
                 
                // Add the compressed files
                if (fileName.indexOf('.gz.b64') > -1 && includeCompressLogs) {
                    trimmedFileNames.push(fileName.replace('.gz,b64', ''));
                };
            });

            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    });
};


// Compress contents of .log file into a .gz.b64 file within the same directory
lib.compress = function(logId, newFileId, callback) {
    var sourceFile = logId+'.log';
    var destinationFile = newFileId+'.gz.b64';

    // Read the source file
    fs.readFile(lib.baseDir+sourceFile, 'utf8', function(err, inputString) {
        if (!err && inputString) {
            // Compress the data that we have read
            zlib.gzip(inputString, function(err, buffer) {
                if (!err && buffer) {
                    // Write data to destinationFile
                    fs.open(lib.baseDir+destinationFile, 'wx', function(err, fileDescriptor) {
                        if (!err && fileDescriptor) {
                            // WErite to destination file
                            fs.writeFile(fileDescriptor, buffer.toString('base64'), function(err) {
                                if (!err) {
                                    // Close the destination file
                                    fs.close(fileDescriptor, (err) => {
                                        if (!err) {
                                            callback(false);
                                        } else {
                                            callback(err);
                                        }
                                    })
                                } else {
                                    callback(err)
                                }
                            })
                        } else {
                            callback(err);
                        }
                    }) 
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }   
    });
}
// Decompress compressed file
lib.decompress = function(fileId, callback) {
    // Filename to decompress
    var fileName = fileId+'.gz.b64';
    fs.readFile(lib.baseDir+fileName, 'utf8', function(err, str) {
       if (!err && str) {
            // Inflate the data    
            var inputBuffer = Buffer.from(str, 'base64');
            zlib.unzip(inputBuffer, function(err, outputBuffer) {
                if (!err && outputBuffer) {
                    var str = outputBuffer.toString();
                    callback(false, str);
                } else {
                    callback(err);
                }
            })
       } else {
            callback(err);
       } 
    }) 
}


lib.truncate = function(fileName, callback) {
    // Truncate logfile
    fs.truncate(lib.baseDir+fileName+'.log', (err) => {
        if (!err) {
            callback(false);
        } else {
            callback('Error : Could not truncate filename');
        }
    })
}


// Export the module
module.exports = lib;
