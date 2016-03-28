'use strict'

var gm = require('gm');
var fs = require('fs');

var path = require('path');

var _format = require('tinytim');

var async = require('async');

var mkdirp = require('mkdirp');

var slug = require('slug');

function createID(len){
  len = len || 10;
  var chars = "qwertyuiopasdfghjklzxcvbnm123456789".split('');
  var arr = [];
  var charsLen = chars.length;
  for (var i = 0; i < len; i ++ ){
    var rand = RandomNumber(0, charsLen - 1 );
    var ch = (RandomNumber(0,1) === 1) ? chars[rand].toUpperCase() : chars[rand];
    arr.push(
      ch
    );
  }
  return arr.join('');
}

function RandomNumber(min, max){
  min = min || 0;
  max = max || 10;

  return Math.floor(
    Math.random() * ( max - min + 1 ) + min
  );
}

function exists(path){
  try {
    fs.statSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

function SlugPath(_path){

  var parts = _path;
  if (~_path.indexOf(path.sep)){
    parts = _path.split(path.sep);
  }

  var sluggedPath = parts.map(function (dir){
    return slug(dir);
  }).join(path.sep);


  return sluggedPath;
}


var img = {
  _imageSize : function (image, callback){
    gm(image).size(function (err, size) {
        if (err)  return  callback(err);
        callback(null, size);
      });
  },
  _size : function (s, profile) {
       var ImageSize = {
         height : null,
         width : null
       };

      if(s.width > s.height){
      // Landscape
        ImageSize.width = profile.maxsize;

      }else if (s.width == s.height){
        // Squer
        ImageSize.width = profile.maxsize;

      }else{
        // Portrate
        ImageSize.height = profile.maxsize;
      }

      return ImageSize;

  },
  thumbnail : function (profile, _profile, callback) {

    var self = this;
    var image = profile.src;
    var output = profile._parsed_output_filename;

    if (!exists(profile.src)) return  callback('Image does not exist: ' + image);

    if (_profile.watermark){
      image = profile._watermark_image;
    }

    var size = self._size(profile.source_image_size, _profile);
    var _gm = gm(image)
      .resize(size.width, size.height)
      .compress(_profile.compress)
      .quality(_profile.quality);

      if (_profile.strip){
        _gm.noProfile();
      }

      //callback();

      _gm.write(output, function (err) {
        if (err) return callback(err);
        callback(null, {
          output : output,
          size : size,
          compress : _profile.compress,
          quality : _profile.quality
        });
        //if (!err) console.log('done with ' + output + ' \t \t Quality:' + profile.quality + '% height: ' + size.height + ' Width: ' + size.width  );
      });

  },
  watermark : function (image, output, profile, callback){
    var self = this;
    var options = profile.watermark;

    if (!exists(options.image)){
      return callback('Watermark image not found')
    }

    options.image = path.resolve(options.image);

    self._imageSize(options.image, function (err, watermarkSize){

      if (err) {
        console.log('Watermark error', err);
        return callback(err);
      }
      if (!watermarkSize){
        console.log('Unknown error');
        return callback('No object returned during _imageSize');
      }

      var top     = options.location.top;
      var left    = options.location.left;
      var height  = options.size.height;
      var width   = options.size.width;

      if (!watermarkSize.height){
        console.log('ALERT, FUCKING ISSUE HERE', watermarkSize, image);
      }

      if (typeof top === 'function'){
        top = Math.floor(
          top(profile.source_image_size, watermarkSize)
        );
      }

      if (typeof left === 'function'){
        left = Math.floor(
          left(profile.source_image_size, watermarkSize)
        );
      }

      if (typeof height === 'function'){
        height= Math.floor(
          height(profile.source_image_size, watermarkSize)
        );
      }

      if (typeof width === 'function'){
        width= Math.floor(
          width(profile.source_image_size, watermarkSize)
        );
      }


      //var settings = ['image Over', options.location.top, ','  '0,0', options.image].join('');
      //
      var obj = {
        x : left,
        y : top,
        w : width,
        h : height,
        src : options.image
      };

      // Create settings for GM
      var settings = _format.render('image Over {{x}},{{y}} {{w}},{{h}} {{src}}', obj)
      gm(image)
        .draw([settings])
        .write(output, function WriteWatermark(error){
          if (error) return callback(error);
          callback(null, output);
        });
    })


  },
  scaleImageByProfile : function (profile, callback){
    var self = this;
    if (!profile.src || profile.src.length < 1){
      return callback('FILE EXPECTED, need src')
    }
    callback = callback || function (){};

    var SourceImage = profile.src;

    self._imageSize(SourceImage, function (err, size){
      if (err){
        return callback('Error finding image size for '+ SourceImage, err );
      }

      profile.source_image_size = size;
      var tempDir = process.env.TEMP || './tmp';
      var tmp_filename = path.join(tempDir, createID() + '.jpg' ) ;

      //var tmp_filename = path.join('.', 'FUCKINGTEMP' + '.jpg' ) ;


      self.watermark(profile.src, tmp_filename, profile, function watermarkDone(err, watermark){
        if (err) return callback(err);

        profile._watermark_image = watermark;
        self._createThumbnailsFromProfile(profile, callback);
      });
    });
  },
  _createThumbnailsFromProfile: function(profile, callback){
    var self = this;

    async.eachLimit(profile.profiles, 1, function (selectedProfile, next){

      var src = profile.src;
      var releativeSrc = path.relative(profile.base, profile.src);

      var parsedPath = path.parse(releativeSrc);

      var output = "";

      var obj = {
        ext : parsedPath.ext,
        filename : parsedPath.name,
        dir : parsedPath.dir,
        profile_name : selectedProfile.name
      };

      output = path.normalize(_format.render(profile.dst, obj));

      var image= path.resolve(profile.src);

      var outputFolder = path.dirname(output);
      //
      if (selectedProfile.slug){
        outputFolder = SlugPath(outputFolder);
      }
      //
      output = path.join(outputFolder, path.basename( output ) );
      //
      profile._parsed_output_filename = output;

      if (!exists(outputFolder)) mkdirp.sync(outputFolder);

      self.thumbnail(profile, selectedProfile, function (err, data){
       if (err) return next(err);
       next();
      })

    }, function (err){
      if (err) return callback(err);

      profile._watermark_image_deleted = false;

      fs.unlink(profile._watermark_image, function (err){
        if (err) callback(err);

        profile._watermark_image_deleted = true;

        callback(null, profile);
      })

    })
  }

};

module.exports = img;
