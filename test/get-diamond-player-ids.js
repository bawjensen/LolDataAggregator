var fs          = require("fs"),
    logfmt      = require("logfmt"),
    MongoClient = require('mongodb').MongoClient,
    request     = require("request"),
    querystring = require("querystring");

var MONGO_URL = process.env.MONGOLAB_URI;

var KEY = process.env.RIOT_KEY;
var KEY_QUERY = querystring.stringify({ api_key: KEY });

var API_BASE_URL            = 'https://na.api.pvp.net';
var MATCH_HISTORY_ROUTE     = '/api/lol/na/v2.2/matchhistory/';
var LEAGUE_DATA_ROUTE       = '/api/lol/na/v2.5/league/by-summoner/';
var MATCH_ROUTE             = '/api/lol/na/v2.2/match/';

function promiseSave(filePath, data) {
    return new Promise(function save(resolve, reject) {
        fs.writeFile(filePath, data, function handleResp(err) {
            if (!err) {
                resolve();
            }
            else {
                reject(Error(err));
            }
        });
    });
}

function promiseGet(url) {
    console.log('Sending GET request to: ' + url);
    return new Promise(function get(resolve, reject) {
        request.get(url, function handleResp(err, resp, data) {
            if (err) {
                reject(Error(err));
            }
            else if (resp.statusCode != 200) {
                reject(Error('Resp status code not 200: ' + resp.statusCode + '(' + url + ')'));
            }
            else {
                resolve(data);
            }
        });
    });
}
function promiseJsonGet(url) {
    return promiseGet(url).then(JSON.parse);
}

function requestGet(url) {
    
}

function repetitiveJsonGet(url) {
    console.log('Sending repetitive GET request to: ' + url);
    return new Promise(function repetitiveGet(resolve, reject) {
        request.get(url, function handleResp(err, resp, data) {
            if (err)
                reject(Error(err));
            else if (resp.statusCode == 429 || resp.statusCode == 503) {
                console.log('Repeating request to ' + url + '... (' + resp.statusCode + ')');
                setTimeout(function() { resolve(repetitiveJsonGet(url)); }, 100);
            }
            else if (resp.statusCode != 200) {
                reject(Error(resp.statusCode + ': ' + url));
            }
            else
                resolve(data);
        });
    });
}

function promiseReadFile(filePath) {
    return new Promise(function read(resolve, reject) {
        fs.readFile(filePath, function handleResp(err, fileContents) {
            if (!err) {
                resolve(fileContents);
            }
            else {
                reject(Error(err));
            }
        });
    });
}
function promiseReadJsonFile(filePath) {
    return promiseReadFile(filePath).then(JSON.parse);
}

function preprocessStaticData(staticData) {
    var subData = staticData.data;

    processed = {};

    for (var key in subData) {
        var entry = subData[key];
        processed[entry.key] = key;
    }

    return processed;
}

function convertObjectForMongo(dataObj) {
    var mongoArray = [];

    for (var key in dataObj) {
        dataObj[key]._id = key;
        mongoArray.push(dataObj[key]);
    }

    return mongoArray;
}

function getAllPlayerIds() {
    promiseReadJsonFile('')
}

getAllPlayerIds();