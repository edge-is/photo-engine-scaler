var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    crypto = require('crypto');

function readConfig(configFile){
  var location = path.resolve(configFile);
  try {
    return require(location);
  } catch (e) {
    return false;
  }
}


function md5(string){
  return crypto.createHash('md5').update(string).digest("hex");
}

function exists (filename, callback){

  if (typeof callback === 'function'){
    return fs.stat(filename, callback);
  }

  try {
    fs.statSync(filename);
    return true;
  } catch (e) {
    return false;
  }
}


function serviceIt(callback, time){
  callback();

  return setInterval(callback, time);

}


function jsonParse (string){
  try {
    return JSON.parse(string);
  } catch (e) {
    return false;
  }
}


function ReadLogFileSync(filename){

  if (!exists(filename)){
    console.log('File does not exists', filename);
    return false;
  }

  var content = fs.readFileSync(filename).toString('utf8');

  return content.split('\n').map(jsonParse).filter(function (e){ return e; });

}



function compareFiles(array, src, dst, callback){

  var modifiedFiles = [];

  async.eachOfLimit(array, 4, function (item, key, next){


    var location = item.path.split(src);

    location = location.pop();

    if (!location) return callback('Error finding locaiton', location);


    var destinationLocation = path.join(dst, location);

    var stats = item.stats;

    // Get the source time
    var sourceTime = (stats.mtime > stats.ctime) ? stats.mtime : stats.ctime;

    // check if exists
    exists(destinationLocation, function (err, res){

      // if not exists, then add to job list
      if (err) modifiedFiles.push(item);

      // Check time if exists
      if (!err){


        // Find the timestamp
        var destTime = (res.mtime > res.ctime) ? res.mtime : res.ctime;


        // compare timestamps
        if (sourceTime > destTime) modifiedFiles.push(item);

      }




      next();
    });
  }, function (){

    callback(null, {
      files : modifiedFiles,
      src : src,
      dst : dst
    });

  });
}



module.exports = {
  readConfig : readConfig,
  exists : exists,
  jsonParse : jsonParse,
  readlogfile : ReadLogFileSync,
  compareFiles : compareFiles,
  md5 : md5,
  service : serviceIt
};
