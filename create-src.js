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

var workLogFileName = `logs/converter-source-worklog-${now}.log`;

var logfile = argv.l || argv.logfile || scanLogFile;

var limit = (isNaN(parseInt(argv.limit))) ? 4 : parseInt(argv.limit);

var workLogFile = argv.w || workLogFileName;

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
    --limit         How many images to convert at a time
    -w              worklog
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

  if (argv.l || argv.logfile){
    console.log(`Using ${logfile}`);

    filteredImages = _utils.readlogfile(logfile);


    return convertImages(filteredImages);
  }

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
        _utils.filterImages(res.files, function (filteredImages){
          console.log(`
            Files to update or created ${res.files.length}
            Images to update or created ${filteredImages.length}
            `);
          if (dry) return console.log('Dry run, exiting');

          _utils.logArray(filteredImages, workLogFile, function logDone(err){
            if (err) return console.log(`Error writing logfile ${workLogFile}`);

            console.log(`Wrote logfile ${workLogFile}`);

            convertImages(filteredImages);

          });

        });

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

  workLogFileName = `./logs/.service-worklog-${now}.log`;
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

  noprogress = true;

  deleteLogFileonSuccess = true;




  _utils.service(start, seconds);

}else{
  start();
}


function setDestination(_dst, _src){
  var rel = path.relative(source, _src)
  return path.join(_dst, rel);
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

  var errors = [];

  async.eachOfLimit(array, limit, function (item, key, next){


      var inputFile = item.path;

      var size = {
        height : maxHeight,
        width : maxWidth
      };

      var destinationFile = setDestination(dest, item.path);

      var destDir = path.parse(destinationFile).dir;
      if (!_utils.exists(destDir)){
        mkdirp(destDir);
      }

      fs.readFile(inputFile, function (err, buffer){
        sharp(buffer)
          .resize(size.height, size.width)
          .max()
          .jpeg()
          .toBuffer(function (err, outputBuffer){
            if (err) {

              if (argv.v) console.log(inputFile, destinationFile, err);

              errors.push({
                src : inputFile,
                dst : destinationFile,
                err : err
              })

            }
            fs.writeFile(destinationFile, outputBuffer, function doneImageResize(err, res){
              if (argv.v) console.log(inputFile, destinationFile, err);

              errors.push({
                src : inputFile,
                dst : destinationFile,
                err : err
              })

              pace.op();
              next();
            });
        });
      });
  }, function done(err){



    resizeRunning = false;

    if (deleteLogFileonSuccess){
      fs.unlinkSync(logfile);
      fs.unlinkSync(workLogFileName);
    }

    var imagesDone = (array.length - errors.length);

    console.log(`
      ${array.length} images processed
      ${errors.length} errors
      ${imagesDone} successful
    `);


  });



}
