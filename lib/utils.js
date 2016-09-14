var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    crypto = require('crypto'),
    argv = require('yargs').argv;


function log(){
  if (!argv.v) return;

  var arr = [];


  for (var a in arguments){
    arr.push(arguments[a]);
  }

  console.log.apply(this, arr);
}


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

function logArray(array, logfile, callback){
  async.eachOfLimit(array, 10, function (item, key, next){
    fs.appendFile(logfile, JSON.stringify(item) + '\n', next);
  }, callback);
}

function filterImages(array, callback){

  // File extensions allowed
  var allowedFiles = ['.tif', '.jpeg', '.jpg', '.png'];
  async.filterLimit(array, 10, function item(item, next){

    // parse it
    var parsed = path.parse(item.path);

    // check if is hidden..
    if (parsed.name.charAt(0) === '.') return async.setImmediate(function (){
      next(false);
    });

    // check if extension is in array
    if (allowedFiles.indexOf(parsed.ext) === -1) {

      // if not then false
      return async.setImmediate(function (){
        next(false);
      });
    }

    // return true if is..
    async.setImmediate(function (){
      next(true);
    });
  }, callback);
}


function compareFiles(array, src, dst, callback){

  var modifiedFiles = [];



  async.eachOfLimit(array, 4, function (item, key, next){


    var location = item.path.split(src);

    location = location.pop();

    if (!location) return callback('Error finding locaiton', location);

    var destinationLocation = path.join(dst, location);

    var parsedLocation = path.parse(destinationLocation);

    // set destination type to JPEG
    parsedLocation.ext = '.jpg';

    destinationLocation = parsedLocation.dir + path.sep + parsedLocation.name + parsedLocation.ext;

    var stats = item.stats;

    // Get the source time
    var sourceTime = (stats.mtime > stats.ctime) ? stats.mtime : stats.ctime;

    // check if exists
    exists(destinationLocation, function (err, res){

      // if not exists, then add to job list
      if (err) {
        modifiedFiles.push(item);
        log('New file', item.path);
      }




      // Check time if exists
      if (!err){

        // Find the timestamp
        var destTime = (res.mtime > res.ctime) ? res.mtime : res.ctime;


        // compare timestamps
        if (sourceTime > destTime) {
          modifiedFiles.push(item)

          var diff = (sourceTime - destTime);

          log('Modified', item.path, diff);
        }

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
  service : serviceIt,
  filterImages : filterImages,
  logArray : logArray
};
