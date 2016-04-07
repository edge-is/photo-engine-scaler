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

var config = require('./config.js');

var scaleProfile = config.profile;

var argv = require('yargs').argv;

var logfile = argv.l;

if (!logfile){
  return console.error('No log file specified use -l /path/to/file');
}

ConvertFiles({log : logfile});


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
function isHidden(file){
  var ch = file.charAt(0)
  if (ch === '.' || ch === '..'){
    return true;
  }
  return false;
}

function isImage(p){
  var file = p.path;
  var res = path.parse(file);

  var hidden = isHidden(res.name);
  var extensions = ['.jpeg','.jpg','.tif', '.tif', '.png', '.gif', '.webp'];

  if (extensions.indexOf(res.ext) < 0){
    return false;
  }

  if (!isHidden(res.name)){
    return p;
  }
  return false;

}

function ConvertFiles(files){



  var list = ReadLogtoJSON(files.log);


  list = list.filter(isImage);
// list = list.slice(70,75);
// console.log(list);
  async.eachLimit(list, 1, function (item, next){
      scaleProfile.src = item.path;

      converter.scaleImageByProfile(scaleProfile, function (err, res){
        if (err) return next(err);
        console.log('Done', res.source_image_size, res._parsed_output_filename);
        next();
      });
  }, function allDone(err){
    console.log('done', err);
  })

}
