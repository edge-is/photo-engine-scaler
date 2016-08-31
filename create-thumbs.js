
var thumbs = require('./lib/thumbs.js');

var Pace = require('awesome-progress');

var fs = require('fs');

var fileScan = require('./lib/scan.js');

var argv = require('yargs').argv;

var scanDir = argv.s || argv.scan || false;

var logfile = argv.l || argv.logfile || false;

var force = argv.f || argv.force || false;



var now = new Date().toISOString().replace(/:/g, '_');

var scanLogFile = ['logs/', 'converter-scan-', now, '.log'].join('');


var sharpCache = {};

sharpCache.files  = setDefaultInt(argv['cache-files']  , 10);
sharpCache.memory = setDefaultInt(argv['cache-memory'] , 200);
sharpCache.items  = setDefaultInt(argv['cache-items']  , 100);

if (argv.h || argv.help){
  return console.log(`
    Usage program

    -s --scan       Scans a directory
    -l --logfile    Uses a log file
    -f --force      Don't check if files exist
    settings for Sharp: --cache-files, --cache-memory --cache-itesm
  `);
}



var configOptions = false;
if (argv.c){
  configOptions = readConfig(argv.c);
}else{
  configOptions = require('./thumbs-config.js');
}


if (!configOptions){
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

function exists (filename){

  try {
    fs.statSync(filename);
    return true;
  } catch (e) {
    return false;
  }
}


function setDefaultInt(value, def){
  var int = parseInt(value);

  if (isNaN(int)){
    return def;
  }
  return int;
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

    console.log(`
      Scaning done
      Log file is : ${logfile}
      Total files : ${total}
      `);

    convertImages(stats.files);

  });
}else if ((typeof logfile === 'string') && !scanDir ){
  console.log('Starting from logfile...', logfile);
  var array = ReadLogFileSync(logfile);
  if (array && array.length > 0){
    convertImages(array);
  }
}


function convertImages(array){


  configOptions.limit = 1;

  configOptions.sharpCache = sharpCache;

  var total = array.length;

  console.log(array.length, 'files..')
  var pace = Pace(total);

  var i = 0;

  thumbs.convert(array, configOptions, function image(err, res, next){

    pace.op();
    next();

  }, function done(){
    console.log('DONE');
  })


}
