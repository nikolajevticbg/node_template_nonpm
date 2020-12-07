/*
 *
 * Library for storing data
 *
 */

var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');
// Container for this module
var lib = {};


// Base directory of a lib object
lib.baseDir = path.join(__dirname, '/../.data/');


// Write data to file
lib.create = function(dir, file, data, callback) {
    // Filename for data
    let fileName = lib.baseDir+dir+'/'+file+'.json';
    console.log('Filename is: ', fileName);

    // Open the file for writing
    fs.open(fileName, 'wx', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // Convert data to a string
            var stringData = JSON.stringify(data);

            // Write to file and close
            fs.writeFile(fileDescriptor, stringData, (err) => {
                if (!err) {
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false);
                        } else {
                            callback('Cant close the file after writing');
                        }
                    });
                } else {
                    callback('Could not write to a file');
                }
            })
            
        } else {
            callback('Could not create new file, it may exist');
        }
    });
}

lib.read = function(dir, file, callback) {
    let fileName = lib.baseDir+dir+'/'+file+'.json';
    fs.readFile(fileName, 'utf-8', (err, data) => {
        if (!err && data) {
            var parsedData = helpers.parseJsonToObject(data);
            callback(false, parsedData);
        } else {
            callback(err, data);
        }
    });

}

lib.update = function(dir, file, data, callback) {
    let fileName = lib.baseDir+dir+'/'+file+'.json';
    
    // Open the file for writing
    fs.open(fileName, 'w+', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            //Convert data to a string
            var stringData = JSON.stringify(data);

            // Truncate file content
            fs.ftruncate(fileDescriptor, (err) => {
                if (err) {
                    callback('Error truncationg file');
                } else {
                    // Write to file and close it
                    fs.writeFile(fileDescriptor, stringData, (err) => {
                        if (err) {
                            callback('Error writing to a file');
                        } else {
                            // Close file
                            fs.close(fileDescriptor, (err) => {
                                if (!err) {
                                    callback(false);
                                } else {
                                    callback('Error closing the file');
                                }
                            });
                        }
                    
                    })
                }
            })
        } else {
            console.log('Error, file does not exist probably');
        }
    })
}

// Delete a file
lib.delete = function(dir, file, callback) {
    let fileName = lib.baseDir+dir+'/'+file+'.json';

    fs.unlink(fileName, (err) => {
        if (!err) {
            callback(false);
        } else {
            callback('Problem deleting a file')
        }

    })
};

// List all the items in a directory
lib.list = function(dir, callback) {
    fs.readdir(lib.baseDir + dir + '/', (err, data) =>  {
        if (!err && data && data.length > 0) {
           var trimmedFileNames = []; 
            data.forEach((fileName) => {
                trimmedFileNames.push(fileName.replace('.json', ''));
            });
            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    });
}

// Export the module
module.exports = lib;
