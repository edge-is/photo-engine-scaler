var scan = require('./lib/scan.js');

var fs = require('fs');

var async = require('async');

var path = require('path');

var slug = require('slug');

slug.defaults.modes['pretty'] = {
    replacement: '-',
    symbols: true,
    remove: /[.]/g,
    lower: true,
    charmap: slug.charmap,
    multicharmap: slug.multicharmap
};

var converter = require('./lib/img-converter.js');

var scaleProfile = {
  src : '',
  dst : '',
  base: 'archives',
  watermark : {
    image : 'img/Herarn_watermark.tif',
    size : {
      height : '0',
      width : '0'
    },
    location : {
      top : function (s, w){
        return (s.height - w.height) - 10;
      },
      left : function (s, w){
        return ((s.width / 2) - (w.width / 2));
      }
    }
  },
  profiles : [
    { name: 'xx-small',compress:'JPEG',  slug: true, maxsize : '225',  maxheight : '127', quality : '60%', watermark : true, strip: true, format : 'jpg' },
    { name: 'x-small', compress:'JPEG',  slug: true, maxsize : '324',  maxheight : '182', quality : '60%', watermark : true, strip: true, format : 'jpg' },
    { name: 'small',   compress:'JPEG',  slug: true, maxsize : '480',  maxheight : '270', quality : '60%', watermark : true, strip: true, format : 'jpg' },
    { name: 'medium',  compress:'JPEG',  slug: true, maxsize : '720',  maxheight : '405', quality : '60%', watermark : true, strip: true, format : 'jpg' },
    { name: 'large',    compress:'JPEG', slug: true, maxsize : '1080', maxheight : '608', quality : '70%', watermark : true, strip: true, format : 'jpg' },
    { name: 'x-large',  compress:'JPEG', slug: true, maxsize : '1280', maxheight : '720', quality : '70%', watermark : true, strip: true, format : 'jpg' },
    { name: 'xx-large', compress:'JPEG', slug: true, maxsize : '1600', maxheight : '900', quality : '83%', watermark : true, strip: true, format : 'jpg' },
    { name: 'ref',      compress:'JPEG', slug: true, maxsize : '1600', maxheight : '900', quality : '83%', watermark : false, strip: false, format : 'jpg' },
  ]
};


// scan('./archives', function (err, res){
//   if (err) return console.log(err);
//   ConvertFiles(res);
// })
//
//
ConvertFiles({log : 'tmp/scan-0.2.2016_3-17-12.json'})


function exists(path){
  try {
    fs.readdirSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

function mkdir(path){

  if (typeof path === 'string'){
    path = path.split('/');
  }

  var p = path[0];
  path.forEach(function (folder){
    if (folder !== '.' && folder !== '..'){
      p = [p, folder].join('/');
      if (!exists(p)) fs.mkdirSync(p)

    }
  });
}

function outputFolderName(filename){
  if (filename === '.' || filename === '..' ){
    return filename;
  }
  return slug(filename);
}


function createDestinationPath(path){

  var parts = path.split('/');

  var filename = outputFileName(parts.pop());
  var folders =parts.map(outputFolderName);
  mkdir(folders);
  folders.push(filename)
  return folders.join('/');
}

function outputFileName(filename){
  var parts = filename.split('.');
  var ending = parts.pop();

  var name = parts.join('.');


  return [slug(name), ending ].join('.');
}

function bounch(bool){
  return bool;
}
function toObject(json){
  try {
    return JSON.parse(json);
  } catch (e) {
    return false;
  }
}
function ReadLogtoJSON(logfile){
  return fs.readFileSync(logfile)
    .toString('utf-8')
    .split('\n')
    .map(toObject).filter(bounch);
}

function ConvertFiles(files){

  var list = ReadLogtoJSON(files.log);
// list = list.slice(70,75);
// console.log(list);
  async.eachLimit(list, 1, function (item, next){

      scaleProfile.src = item.file;

      scaleProfile.dst = "output4/{{dir}}/{{profile_name}}/{{filename}}.{{profile_name}}{{ext}}";

      converter.scaleImageByProfile(scaleProfile, function (err, res){
        if (err) return next(err);
        console.log('Done', res.source_image_size, res._parsed_output_filename);
        next();
      });
  }, function allDone(err){
    console.log('done', err);
  })

}
