var request     = require('request'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

var BASE_URL    = 'https://na.api.pvp.net';
var API_KEY     = process.env.RIOT_KEY;
var KEY_QUERY   = querystring.stringify({ api_key: API_KEY });

var MATCH_HISTORY_ROUTE = '/api/lol/na/v2.2/matchhistory/'

function compileMatches() {
    promise.readJson('data-compiled/players.json')
        .then(function fetchMatches(players) {
            var extractedMatches = {};

            var desiredMap = 11; // New summoner's rift id
            var desiredMode = 'CLASSIC';
            var desiredType = 'MATCHED_GAME';
            var desiredQueue = 'RANKED_SOLO_5x5';

            var baseRoute = BASE_URL + MATCH_HISTORY_ROUTE;

            return promise.groupedGet(players, 50,
                function mapMatch(id) { // How to map a match to a promise request
                    return promise.persistentGet(baseRoute + id + '?' + KEY_QUERY);
                },
                function handleMatch(matchHistoryEntry) { // How to handle a match's response data
                    if (!matchHistoryEntry) {
                        console.log('Match didn\'t exist');
                        return;
                    }

                    var matches = matchHistoryEntry.matches;

                    for (var i in matches) {
                        var match = matches[i];

                        if (match.queueType === desiredQueue && match.mapId === desiredMap && match.matchMode === desiredMode && match.matchType === desiredType) {
                            extractedMatches[match.matchId] = true;
                        }
                    }

                })
                .then(function() {
                    return Object.keys(extractedMatches);
                });
        })
        .then(function saveMatches(matches) {
            console.log('Got ' + matches.length + ' matches');
            promise.save('data-compiled/matches.json', JSON.stringify(matches));
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

compileMatches();