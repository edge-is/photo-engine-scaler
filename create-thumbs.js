'use strict'
var sharp = require('sharp');

var async = require('async');
var fs = require('fs');
var path = require('path');
var tinytim = require('tinytim');
var crypto = require('crypto');

var mkdirp = require('mkdirp');
var argv = require('yargs').argv;

var fileScan = require('./lib/scan.js');

var converter = require('./lib/converter.js');

var now = new Date().toISOString().replace(/:/g, '_');

var scanLogFile = ['logs/', 'converter-scan-', now, '.log'].join('');

var Pace = require('pace');

var scanDir = argv.s || false;

var logfile = argv.f || false;

var force = argv.force || false;

var sharpCache = {};

function log(){
  if (!argv.verbose) return;

  var arg = [];

  for (var key in arguments){
    arg.push(arguments[key]);
  }
  console.log.apply(this, arg);

}

sharpCache.files  = setDefaultInt(argv['cache-files']  , 10);
sharpCache.memory = setDefaultInt(argv['cache-memory'] , 200);
sharpCache.items  = setDefaultInt(argv['cache-items']  , 100);

function setDefaultInt(value, def){
  var int = parseInt(value);

  if (isNaN(int)){
    return def;
  }
  return int;
}


if (argv.h || argv.help){
  return console.log([
    'Usage program -s /dir/ || -f /logfile.log',
    'settings for Sharp: --cache-files, --cache-memory --cache-itesm'
  ].join('\n'));
}

sharp.cache(sharpCache);


var options = false;
if (argv.c){
  options = readConfig(argv.c);
}else{
  options = require('./thumbs-config.js');
}


if (!options){
  return console.error('could not load config:', argv.c);
}
function readConfig(configFile){
  var location = path.resolve(configFile);
  try {
    return require(location);
  } catch (e) {
    return false;
  }
}

function jsonParse (string){
  try {
    return JSON.parse(string);
  } catch (e) {
    return false;
  }
}
function exists (filename){
  try {
    fs.statSync(filename);
    return true;
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

  return content.split('\n').map(jsonParse).filter(function (e){return e});

}

if (scanDir){
  logfile = logfile || scanLogFile;

  if (typeof scanDir !=='string') return console.log('path needs to be string');

  if (!exists(scanDir)) return console.log('Path does not exist', scanDir);
  console.log('Search for files in ', scanDir, logfile);
  fileScan(scanDir, logfile, function (err, stats){

    var total  = stats.folders.length + stats.files.length;
    console.log([
      '',
      'All done, log file is: ' + logfile,
      'Total files and folders ' + total
    ].join('\n'));

    convertImages(stats.files);

  });
}else if ((typeof logfile === 'string') && !scanDir ){
  console.log('Starting from logfile...', logfile);
  var array = ReadLogFileSync(logfile);
  if (array && array.length > 0){
    convertImages(array);
  }
}
function isImage(extension){
  extension = extension.toLowerCase();
  var extensions = ['.jpg', '.jpeg', '.png', '.tif', '.gif'];
  if (extensions.indexOf(extension) >= 0){
    return true;
  }
  return false;
}

var dummypace = {
  op  : function (){}
};

function filesExist(array, profiles, callback){
  if (force){
    return callback(null, array);
  }

  var nonExisting = [];

  var pace = dummypace;

  if (!argv.verbose){
    pace = Pace(array.length * profiles.length);
  }

  async.forEachLimit(array, 2, function (item, next){
    var parsed = path.parse(item.path);
    var obj = converter._createTemplateObject(parsed.name);
    async.forEachLimit(profiles, 2, function (profile, _next){
      obj.filetype    = profile.filetype;
      obj.profilename =profile.name;
      var dst = converter._formatString(profile.dst, obj);

      fs.stat(dst, function (err, stats){
        if (err){
          log(dst, 'does not exist! not found count:', nonExisting.length);
          nonExisting.push(item);
        }
        pace.op();
        _next();
      });

    }, next);

  }, function (){
    callback(null, nonExisting);
  });

}

function convertImages(array){
  if (!force) console.log('Checking if thumbnails already exists', array.length * options.profiles.length);

  filesExist(array, options.profiles, function (err, files){

    console.log('Starting convert:', files.length);
    var pace = dummypace;

    if (!argv.verbose){
      pace = Pace(array.length * profiles.length);
    }

    async.forEachLimit(files, 1, function (item, next){
      var filePath = path.relative('.', item.path);
      var parsedFile = path.parse(item.path);

      if (!isImage(parsedFile.ext)){
        // console.log('Not an image', item.path);
        pace.op();
        return next();
      }

      fs.readFile(item.path, function (err, buffer){
        converter.start(item.path, buffer, options, function (err, status){
          if (err) console.log('ERROR CONVERTING', err);

          if (!err) log('INFO', item.path, status.thumb);

          next();
          pace.op();
        });
      });
    });
  });




}
//
//
