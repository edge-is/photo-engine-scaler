'use strict'
var sharp = require('sharp');

var async = require('async');
var fs = require('fs');
var path = require('path');
var tinytim = require('tinytim');
var crypto = require('crypto');

var mkdirp = require('mkdirp');

var converter = require('./converter.js');




function log(){
  var arg = [];

  for (var key in arguments){
    arg.push(arguments[key]);
  }
  console.log.apply(this, arg);

}

function md5(string){
  return crypto.createHash('md5').update(string).digest("hex");
}






function jsonParse (string){
  try {
    return JSON.parse(string);
  } catch (e) {
    return false;
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

function deDupeArray(array, callback){
  var cache = {};

  var files = [];

  var pace = dummypace;

  var len = array.length;

  async.forEachLimit(array, 2, function (item, next){

    var key = md5(item.path);

    if (key in cache) {

      return async.setImmediate(function () {
          return next();
      });
    }

    files.push(item);
    cache[key] = true;

    return next();

  }, function (){

    cache = false;
    return callback(null, files);

  });
}

function filesExist(array, options, callback){

  options = options || {};


  if (options.force){
    return callback(null, array);
  }

  var nonExisting = [];

  var cache = {};

  async.forEachLimit(array, 2, function (item, next){
    var parsed = path.parse(item.path);
    var obj = converter._createTemplateObject(parsed.name);

    var cacheKey = md5(item.path);

    async.forEachLimit(options.profiles, 2, function (profile, _next){
      obj.filetype    = profile.filetype;
      obj.profilename = profile.name;

      var dst = converter._formatString(profile.dst, obj);
      fs.stat(dst, function (err, stats){

        if (err){
          //log('ERROR', dst, 'does not exist! not found count:', nonExisting.length);
          if (cacheKey in cache){
            return async.setImmediate(function () {
              return _next();
            });
          }

          cache[cacheKey] = true;
          nonExisting.push(item);
        }

        _next();

      });

    }, next);

  }, function (){
    callback(null, nonExisting);
  });

}

function convertImages(array, options, callback, done){


  options.limit = options.limit || 1;

  options.force = options.force || false;


  var sharpOptions = {};

  sharpOptions.files  = options.sharpCache.files  ||  10;
  sharpOptions.memory = options.sharpCache.memory ||  200;
  sharpOptions.items  = options.sharpCache.items  ||  100;

  sharp.cache(sharpOptions);


  filesExist(array, options, function (err, files){

    if (err) return callback(err);

    async.forEachLimit(array, options.limit, function (item, next){
      var filePath = path.relative('.', item.path);
      var parsedFile = path.parse(item.path);
      if (!isImage(parsedFile.ext)){
        // console.log('Not an image', item.path);
        return callback('Not an image', item, next);
      }

      fs.readFile(item.path, function (err, buffer){
        converter.start(item.path, buffer, options, function (err, status){
          return callback(err, item, next);
        });
      });
    }, done);
  });
}

module.exports = {
  convert : convertImages

};
