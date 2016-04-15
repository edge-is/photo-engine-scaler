var sharp = require('sharp');

var async = require('async');
var fs = require('fs');
var path = require('path');
var tinytim = require('tinytim');
var crypto = require('crypto');

var mkdirp = require('mkdirp');
function md5(string){
  return crypto.createHash('md5').update(string).digest("hex");
}


function exists(file){
  try {
    fs.statSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  _fileCache : {

  },
  _mkdir : function (dst, callback){
    var self = this;
    if (dst in self._fileCache){
      callback(null);
    }

    fs.stat(dst, function (err, res){
      if (err){
        return mkdirp(dst, callback);
      }
      return callback();
    })

  },
  _formatString:function (template, object){
    return tinytim.render(template, object);
  },
  _createTemplateObject : function (filename){
    var parsedFileName = path.parse(filename);
    var nameHash = md5(parsedFileName.name);

    return {
      l1 : nameHash.charAt(nameHash.length -1),
      l2 : nameHash.substring(nameHash.length -3, nameHash.length -1),
      filename : parsedFileName.name,
      hash : nameHash
    };
  },
  _meta : function (src, callback){
    sharp(src)
      .metadata(callback);
  },
  thumb : function (src, dst, size, callback){
    sharp(src)
      .resize(size.height, size.width)
      .max()
      .toFile(dst, callback);
  },
  _watermark : function (src, watermark, imageMetadata, callback){
    var self = this;
    var gravity = sharp.gravity.south;
    var selectedGravity = watermark.gravity
    if (selectedGravity in sharp.gravity){
      gravity = sharp.gravity[selectedGravity];
    }
    self._meta(watermark.image, function (err, watermarkMetadata){

      if (
          watermarkMetadata.heigth > imageMetadata.heigth ||
          watermarkMetadata.width > imageMetadata.width
          ){

        return callback('Watermark is larger than image');
      }

      sharp(src)
        .overlayWith(watermark.image, { gravity: gravity} )
        .quality(100)
        .jpeg()
        .toBuffer()
        .then(function(outputBuffer) {
          callback(null, outputBuffer, watermarkMetadata);
          // outputBuffer contains upside down, 300px wide, alpha channel flattened
          // onto orange background, composited with overlay.png with SE gravity,
          // sharpened, with metadata, 90% quality WebP image data. Phew!
        });
    });


  },
  start : function (src, buffer, options, callback){
    var self = this;

    var filename = src;

    if (buffer){
      src = buffer;
    }

    var force = options.force || false;


    // Check metadata
    self._meta(src, function (err, imageMetadata){
      if (err) return callback(err, 'metadata failure');

      // create watermark
      self._watermark(src, options.watermark, imageMetadata, function (err, watermarkBuffer, watermarkMetadata){
        if (err) return callback(err, 'watermark failure');
        var availableStringValues = self._createTemplateObject(filename);

        var workers = options.workers || 2;
        // Loop throug sizes of images
        async.forEachLimit(options.profiles, workers, function (item, next){

          availableStringValues.filetype = item.filetype;
          availableStringValues.profilename=item.name;


          var fileLocation = self._formatString(item.dst, availableStringValues);
          var locationDirectory = path.parse(fileLocation);
          var size = {};

          if (imageMetadata.height >= imageMetadata.width){
            size.height = parseInt(item.maxsize);
          }else if (imageMetadata.height <= imageMetadata.width){
            size.width = parseInt(item.maxsize);
          }

          if (!force){
            if(exists(fileLocation)){
              return next();
            }
          }



          //create dir if not exists
          self._mkdir(locationDirectory.dir, function (err){

            if (err) {
              callback(err);
              return next();
            }
            //Thumbnail the image
            //
            self.thumb(watermarkBuffer, fileLocation, size, function (err, res){
              if (err) {
                callback(err);
              };
              return next();
            });
          });

        }, function (){
          buffer = null;
          watermarkBuffer = null;
          callback(null, {
            src : filename,
            metadata : imageMetadata
          });
        });
      });
    });
  }
};
