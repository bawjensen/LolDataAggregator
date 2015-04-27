var globals     = require('./helpers/globalConstants'),
    request     = require('request'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

function compileMatches() {
    promise.readJson('data-compiled/players.json')
        .then(function fetchMatches(regionPlayerObj) {
            return Promise.all(
                Object.keys(regionPlayerObj).map(function mapRegionToArray(regionStr) {
                    var extractedMatches = {};

                    return promise.groupedGet(regionPlayerObj[regionStr], 50,
                        function mapMatch(id) { // How to map a match to a promise request
                            return promise.persistentGet(globals.URL_PREFIX + regionStr + globals.BASE_URL + regionStr + globals.MATCH_HISTORY_ROUTE + id + '?' + globals.KEY_RANKED_QUEUE_QUERY, regionStr);
                        },
                        function handleMatch(obj) { // How to handle a match's response data
                            var matchHistoryEntry = obj.data;
                            var regionStr = obj.id;

                            if (!matchHistoryEntry) {
                                console.log('Match didn\'t exist');
                                return;
                            }

                            var matches = matchHistoryEntry.matches;

                            for (var i in matches) {
                                extractedMatches[matches[i].matchId] = true;
                            }
                        })
                        .then(function sendDataAlong() {
                            return { data: Object.keys(extractedMatches), regionStr: regionStr };
                        });
                    }
                )
            )
            .then(function reconstructObject(matchesArrayArray) {
                var returnObj = {};

                matchesArrayArray.forEach(function(matchesArrayObj) {
                    returnObj[matchesArrayObj.regionStr] = matchesArrayObj.data;
                });

                return returnObj;
            });
        })
        .then(function saveMatches(allMatches) {
            console.log('Number of matches:');
            var numMatches = Object.keys(allMatches).forEach(function countUpPlayers(regionStr) { console.log(regionStr + ':', allMatches[regionStr].length); });

            promise.save('data-compiled/matches.json', JSON.stringify(allMatches));
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

compileMatches();