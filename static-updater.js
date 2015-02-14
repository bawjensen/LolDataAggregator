var exec        = require('child_process').exec,
    fs          = require('fs'),
    promise     = require('./helpers/promisedFunctions');

var SAVE_DIR = 'dragontail';
var SAVE_NAME = 'dragontail.tgz';
var SAVE_LOCATION = SAVE_DIR + '/' + SAVE_NAME;


function updateStaticData() {
    var versionDataDir;

    promise.exec('rm -r dragontail/*')
        .catch(function ignoreIt(err) {
            console.log('Note: Didn\'t remove old data');
            return;
        })
        .then(function getVersions() {
            console.log('Folder clean');
            return promise.getJson('https://ddragon.leagueoflegends.com/api/versions.json');
        })
        .then(function getLatestData(versions) {
            console.log('Got versions');
            versionDataDir = SAVE_DIR + '/' + versions[0];
            return promise.getPipe('http://ddragon.leagueoflegends.com/cdn/dragontail-' + versions[0] + '.tgz', SAVE_LOCATION);
        })
        .then(function extractData() {
            console.log('Got data');
            return promise.exec('tar -zxf ' + SAVE_NAME, { cwd: SAVE_DIR });
        })
        .then(function finishUp() {
            console.log('Unzipped the data');
            return promise.exec('rm ' + SAVE_LOCATION);
        })
        .then(function renameSubFolder() {
            console.log('Deleted the archive');
            return promise.exec('mv ' + versionDataDir + ' ' + SAVE_DIR + '/current');
        })
        .then(function done() {
            console.log('Renamed the version directory');
        })
        .catch(function handleIt(err) {
            console.log(err.stack);
            throw err;
        })
        // .catch(function recoverFromDataExisting(err) {
        //     console.log(err.message);
        //     return null;
        // })
        // .then(function saveRecent(recentFile) {
        //     console.log(' - Got most recent data');
        //     return new Promise(function (resolve, reject) {
        //         exec('rm -r dragontail/*', function(err, stdout, stderr) {
        //             console.log(err ? ' = There was no old data' : ' - Removed old data');

        //             if (recentFile) {
        //                 console.log(recentFile);
        //                 resolve(promise.save(SAVE_LOCATION, recentFile));
        //             }
        //             else {
        //                 resolve();
        //             }
        //         });
        //     });
        // })
        // .then(function() {
        //     exec('tar zxf ' + SAVE_LOCATION, function(err, stdout, stderr) {
        //         if (err) throw err;

        //         console.log(' - Unpacked');

        //         exec('rm -r ' + SAVE_LOCATION, function(err, stdout, stderr) {
        //             console.log(err ? ' = Error with deleting downloaded archive' : ' - Deleted downloaded archive');
        //         });
        //     });
        // })
        // .catch(function(err) {
        //     console.log(err.stack);
        // });
}

updateStaticData();