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

function convertImages(array){

  var pace = new Pace(array.length);
  async.forEachLimit(array, 1, function (item, next){
    var filePath = path.relative('.', item.path);
    var parsedFile = path.parse(item.path);

    if (!isImage(parsedFile.ext)){
      // console.log('Not an image', item.path);
      pace.op();
      return next();
    }

    fs.readFile(item.path, function (err, buffer){
      converter.start(item.path, buffer, options, function (err, status){
        next();
        pace.op();
      });
    });
  });
}
//
//
