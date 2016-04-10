var fs = require('fs');
var path = require('path');
var walk = require('walk');

var AllFiles = [];

var AllDirectorys = [];
var AllErrors = [];
function StatsTimesToEpoch(object){
  var _object = { };
  for (var key in object){
    var value = object[key];

    if (typeof value === 'function') continue;

    if (value instanceof Date){
      _object[key] = value.getTime();
    }else{
      _object[key] = value;
    }

  }

  return _object;
}
var scan = function (dir, logfile, callback){
      var self = this;
      var W = walk.walk(dir);

      W.on('file', function (root, stats, next){

        var filename = path.resolve(root, stats.name);

        var type = 'file';
        var object = {path : filename, stats : stats, type : type};
        AllFiles.push({path : filename, stats : stats});

        var _json = JSON.stringify({
            path : filename,
            type : type,
            stats : StatsTimesToEpoch(stats)
        });

        if (logfile) return  fs.appendFile(logfile, _json + '\n', next);

        next();
      });

      W.on('directory', function (root, stats, next){
        var directory = path.resolve(root, stats.name);

        var type = 'directory';

        var object = {path : directory, stats : stats, type : type};
        AllDirectorys.push({path : directory, stats : stats});

        var _json = JSON.stringify({
            path : directory,
            type : type,
            stats : StatsTimesToEpoch(stats)
        });
        if (logfile) return fs.appendFile(logfile, _json + '\n', next);

        next();
      });


      W.on("errors", function (file, nodeStatsArray, next){
        AllErrors = nodeStatsArray;
        console.log('Error, will continue', file);
        next();
      });

      W.on('end', function (){
        callback(null, {
          files : AllFiles,
          folders : AllDirectorys,
          logfile : logfile
        });
      });


  }
module.exports = scan;
