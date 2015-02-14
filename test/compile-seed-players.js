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


var fs          = require("fs"),
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
    return promiseGet(url).then(JSON.parse);
}

function requestGetCallback(url, resolve, reject, err, resp, body) {
    if (err) {
        reject(Error(err));
    }
    else if (resp.statusCode == 429 || resp.statusCode == 503) {
        // Resend request after 100 miliseconds (uses bind liberally to call callbacks with correct args)
        setTimeout(request.get.bind(null, url, requestGetCallback.bind(null, url, resolve, reject)), 100);
    }
    else {
        resolve(body);
    }
}
function repetitivePromiseJsonGet(url) {
    return new Promise(function repetetiveGet(resolve, reject) {
        request.get(url, requestGetCallback.bind(null, url, resolve, reject));
    }).then(JSON.parse);
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

    return repetitivePromiseJsonGet(queryUrl)
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
                    return repetitivePromiseJsonGet(API_BASE_URL + MATCH_ROUTE + matchId + '?' + KEY_QUERY);
                })
            );
        })
        .then(function getParticipants(matches) {
            console.log('Got matches');
            var leagueNamesObj = {};

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
                        return repetitivePromiseJsonGet(API_BASE_URL + LEAGUE_DATA_ROUTE + summonerIdSubset.join() + '?' + KEY_QUERY);
                    })
                )
                .then(function extractLeagues(leagueObjs) {
                    leagueObjs.forEach(function(leagueObj) {
                        for (var summonerId in leagueObj) {
                            for (var indexKey in leagueObj[summonerId]) {
                                // Ignore all non solo queue games
                                if (leagueObj[summonerId][indexKey].queue != 'RANKED_SOLO_5x5') continue;

                                if (leagueObj[summonerId][0].tier == leagueTier) {
                                    var leagueName = leagueObj[summonerId][0].name;

                                    if (!(leagueName in leagueNamesObj)) {
                                        leagueNamesObj[leagueName] = summonerId;
                                    }
                                }
                            }
                        }
                    });
                })
                .then(function returnResults() {
                    return leagueNamesObj;
                });
        })
        .catch(function handleError(err) {
            console.log(err.stack);
            process.exit(1);
        });
}

function getDataFor(leagueTier) {
    var seedPlayer = '51405';

    getLeagueFrom(leagueTier, seedPlayer)
        .then(function(leaguePlayerMap) {
            // console.log(JSON.stringify(leaguePlayerMap, null, 2));
            promiseSave('test.json', JSON.stringify(leaguePlayerMap));
        })
        .catch(function handleError(err) {
            console.log(err.stack);
            process.exit(1);
        });
}

getDataFor('DIAMOND');