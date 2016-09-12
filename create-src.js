var async = require('async'),
    thumbs = require('./lib/thumbs.js'),
    Pace = require('awesome-progress'),
    path = require('path'),
    fs = require('fs'),
    fileScan = require('./lib/scan.js'),
    argv = require('yargs').argv,
    _utils = require('./lib/utils.js'),
    duration = require('parse-duration');



var source = argv.s || argv.source || false;

var dest = argv.d || false;


var dry = argv.dry || false;

var force = argv.f || argv.force || false;

var service = argv.service || false;

var now = new Date().toISOString().replace(/:/g, '_');

var scanLogFile = `logs/converter-source-scan-${now}.log`;

var logfile = argv.l || argv.logfile || scanLogFile;


var maxHeight = argv.height || false;

var maxWidth = argv.width || false;

var noprogress = argv.noprogress || false;

var deleteLogFileonSuccess = argv.del || false;

var sharp = require('sharp');
var mkdirp = require('mkdirp');


var sharpCache = {};

sharpCache.files  = setDefaultInt(argv['cachefiles']  , 10);
sharpCache.memory = setDefaultInt(argv['cachememory'] , 200);
sharpCache.items  = setDefaultInt(argv['cacheitems']  , 100);

if (argv.h || argv.help){
  return console.log(`
    Tool to create source images for creation of thumbnails

    Usage program

    -s              Source directory
    -d              Destiantion
    -l --logfile    Uses a log file
    -f --force      Don't check if files exist
    --service       Run as service, (interval)
    -c --config     Config file to use
    --height        Max height of image
    --width         Max width of image
    --dry           Dry run, no images will be hurt..
    --del           delete logfile on exit
    settings for Sharp: --cachefiles, --cachememory --cacheitems
  `);
}

if (!maxHeight || !maxWidth){
  return console.log('Arguments not valid')
}


function setDefaultInt(value, def){
  var int = parseInt(value);

  if (isNaN(int)){
    return def;
  }
  return int;
}
var configOptions = {};

function start(){

  if (!source) return console.log('No source..');

  fileScan(source, logfile, function (err, stats){

      var total  = stats.folders.length + stats.files.length;
      console.log(`
        Scaning done
        Log file is : ${logfile}
        Total files : ${stats.files.length}
        `);

      _utils.compareFiles(stats.files, source, dest, function (err, res){
        if (err) return console.log(err);


        if (dry) return console.log(`
          Dry run
          Files to changed or created ${res.files.length}
          `);

        convertImages(res.files);
      });

      //

    });

}

function testTime(time){
  try {
    duration(time);
    return true;
  } catch (variable) {
    return false;
  }
}


var resizeRunning = false;


if (argv.service){


  var interval = (argv.service == true) ? '5h' : argv.service;

  interval = (testTime(interval) === false) ? '5h' :  interval;

  var seconds = duration(interval);
  logfile = `./logs/.service-${now}.log`;
  console.log(`
    starting service
      options are:
        Max height    : ${maxHeight}
        Max width     : ${maxWidth}
        source        : ${source}
        destination   : ${dest}
        interval      : ${interval}
        logfile       : ${logfile}
    `);

  noprogress=true;

  deleteLogFileonSuccess = true;




  _utils.service(start, seconds);

}else{
  start();
}




function convertImages(array){

  if (resizeRunning) return console.log('Already running');


  resizeRunning = true;

  configOptions.limit = 1;

  configOptions.sharpCache = sharpCache;

  configOptions.force = force;

  var total = array.length;

  if (total === 0) {
    resizeRunning = false;
    return console.log('No files to process');

  }

  var pace = {
    op : function (){}
  };

  if (!noprogress){
    pace = Pace(total);
  }


  var dirCache = {

  };



  async.eachOfLimit(array, 4, function (item, key, next){


      var inputFile = item.path;

      var location = inputFile.split(source);

      location = location.pop();


      var destination = path.join(dest, location);

      var parsed = path.parse(destination);

      var dir = parsed.dir;

      var dirHash = _utils.md5(dir);


      if (!dirCache[dirHash]){
        var dirExists = _utils.exists(dir);

        if (!dirExists){
          mkdirp(dir);
        }

        dirCache[dirHash] = true;
      }

      _utils.exists(parsed.dir);


      var size = {
        height : maxHeight,
        width : maxWidth
      };

      sharp(inputFile)
        .resize(size.height, size.width)
        .max()
        .toFile(destination, function (err, converted){
          if (err) console.log(err);

          pace.op();
          next();

        });

  }, function done(){
    console.log('All Done', array.length);

    resizeRunning = false;
  });



}