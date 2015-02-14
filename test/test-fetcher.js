/*

NOTES:

- Getting all challengers, then their match histories, then making a map of champ -> masteries array and map of champ -> runes array


--- IGNORE BELOW --- (the data already exists in data dump from ddragon [http://ddragon.leagueoflegends.com/cdn/dragontail-4.21.4.tgz])
- Side data:
    - Gotta create mastery -> relevant info obj
        - Relevant info: Image, text, ranks, title
    - Gotta create champ -> relevant info
        - Relevant info: Image, title
--- IGNORE ABOVE ---

*/


var bodyParser  = require("body-parser"),
    express     = require("express"),
    fs          = require("fs"),
    logfmt      = require("logfmt"),
    MongoClient = require('mongodb').MongoClient,
    request     = require("request"),
    querystring = require("querystring");

var MONGO_URL = process.env.MONGO_URL;

var KEY = process.env.RIOT_KEY;
var KEY_QUERY = querystring.stringify({ api_key: KEY });

var API_BASE_URL            = 'https://na.api.pvp.net';
var MATCH_HISTORY_ROUTE     = '/api/lol/na/v2.2/matchhistory/';
var LEAGUE_DATA_ROUTE       = '/api/lol/na/v2.5/league/by-summoner/';
var MATCH_ROUTE             = '/api/lol/na/v2.2/match/';

function promiseSave(data, filePath) {
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
        request.get(url, function handleResp(err, resp, body) {
            if (err) {
                reject(Error(err));
            }
            else if (resp.statusCode != 200) {
                reject(Error('Resp status code not 200: ' + resp.statusCode + '(' + url + ')'));
            }
            else {
                resolve(body);
            }
        });
    });
}
function promiseJsonGet(url) {
    return promiseGet(url).then(JSON.parse).catch(function handleError(err) { console.log(err.stack); });
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

function getLeagueFrom(leagueTier, seedPlayer) {
    var queryUrl = API_BASE_URL + MATCH_HISTORY_ROUTE + seedPlayer + '?' + KEY_QUERY;

    return new Promise(function getSomeone(resolve, reject) {
        promiseJsonGet(queryUrl)
            .then(function getMatchIds(matchHistoryObj) {
                console.log('Got match history');
                return matchHistoryObj.matches.map(function(match) {
                    return match.matchId;
                });
            })
            .then(function getMatches(matchIds) {
                console.log('Got match ids');
                matchIds = matchIds.slice(0, 1); // Debugging step - cut down number of calls

                return Promise.all(
                    matchIds.map(function(matchId) {
                        return promiseJsonGet(API_BASE_URL + MATCH_ROUTE + matchId + '?' + KEY_QUERY);
                    })
                );
            })
            .then(function getLeagues(matches) {
                console.log('Got matches');
                var summonerIdObj = {};

                matches.forEach(function(match) {
                    match.participantIdentities.forEach(function(participantIdentity) {
                        summonerIdObj[participantIdentity.player.summonerId] = true;
                    });
                });

                var summonerIds = Object.keys(summonerIdObj);
                var condensedSummonerIds = [];

                for (var i = 0; i < summonerIds.length; i += 10) {
                    condensedSummonerIds.push(summonerIds.slice(i, i+10));
                }

                condensedSummonerIds = condensedSummonerIds.slice(0, 1); // Debugging step - cut down number of calls

                return Promise.all(
                        condensedSummonerIds.map(function(summonerIdSubset) {
                            return promiseJsonGet(API_BASE_URL + LEAGUE_DATA_ROUTE + summonerIdSubset.join() + '?' + KEY_QUERY);
                        })
                    )
                    .then(function extractLeagues(leagueObjs) {
                        // Use of every here is to short-circuit the loop when the culprit is found
                        leagueObjs.every(function(leagueObj) {
                            for (var summonerId in leagueObj) {
                                if (leagueObj[summonerId][0].tier == leagueTier) {
                                    resolve(leagueObj[summonerId][0]);
                                    return false;
                                }
                            }
                            return true;
                        });
                    })
                    .catch(function handleError(err) {
                        console.log(err.stack);
                        process.exit(1);
                    });
            })
            .catch(function handleError(err) {
                console.log(err.stack);
                process.exit(1);
            });
    });
}

function getDataFor(leagueTier, divisions) {
    var seedPlayers = [
        '51405', // C9 Sneaky
        '20132258' // Doublelift
    ];

    getLeagueFrom(leagueTier, seedPlayers[0])
        .then(function(leagueObj) {
            console.log(JSON.stringify(leagueObj, null, 2));

            // for (var player in leagueObj.entries) {
            //     player = leagueObj[player];

                
            // }
        })
        .catch(function handleError(err) {
            console.log(err.stack);
        });
}

getDataFor('DIAMOND', ['I', 'II']);