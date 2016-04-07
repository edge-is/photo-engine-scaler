var fs = require('fs');
var async = require('async');
var filewalker = require('filewalker');

var fsPath = require('path');

function newerTime(stats){
  if ((+stats.ctime) > (+stats.mtime)){
    return +stats.ctime;
  }

  return +stats.mtime;
}

function LogFile(path, db, callback){

  var item = {
    path : path,
    id : createID()
  };
  var json = JSON.stringify(item);
  fs.appendFile(db, json + '\n', function (err, res){
    if (err) return console.log('FS ERROR', err)

    callback();
  })
}
function exists(path){
  try {
    fs.statSync(path);
    return true;
  } catch (e) {
    return false;
  }
}

function scan(base, timestamp, callback){
  var now = new Date();
  var date = [now.getDay(),now.getMonth(),now.getFullYear()].join('.');
  var time = [now.getHours(), now.getMinutes(), now.getSeconds()].join('-')
  var timestring = [date, time].join('_');
  var db = ['./tmp/scan-', timestring,'.json'].join('');
  if (!exists(base)) return console.log('PATH NOT GOOD', base)
  if (typeof timestamp === 'function'){
    callback = timestamp;
    timestamp = 0;
  }
  var i = 0;
  var Walking = filewalker(base)
    .on('file', function (file, stats){
      var mTime = newerTime(stats)
      if (timestamp <= mTime){

        Walking.pause();

        var path = fsPath.resolve(fsPath.join(base, file));
        LogFile(path, db, function (){
          Walking.resume();
        });
        i++;
      }
    })
    .on('error', function (error){
      callback(error);
    })
    .on('done', function (){
      callback(null, {
        log : db,
        files : i
      });
    }).walk();
}

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

module.exports = scan;
