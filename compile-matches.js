var globals     = require('./helpers/globalConstants'),
    request     = require('request'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

function compileMatches() {
    promise.readJson('data-compiled/players.json')
        .then(function fetchMatches(allPlayers) {
            var extractedMatches = {};

            return promise.groupedGet(allPlayers, 50,
                function mapMatch(playerTuple) { // How to map a match to a promise request
                    return promise.persistentGet(globals.URL_PREFIX + playerTuple[1] + globals.BASE_URL + playerTuple[1] + globals.MATCH_HISTORY_ROUTE + playerTuple[0] + '?' + globals.KEY_RANKED_QUEUE_QUERY);
                },
                function handleMatch(matchHistoryEntry) { // How to handle a match's response data
                    if (!matchHistoryEntry) {
                        console.log('Match didn\'t exist');
                        return;
                    }

                    matchHistoryEntry.matches.forEach(function(match) {
                        extractedMatches[match.matchId] = match.region.toLowerCase();
                    })
                })
                .then(function sendDataAlong() {
                    var dataArray = [];

                    for (var key in extractedMatches) {
                        dataArray.push([key, extractedMatches[key]]);
                    }

                    return dataArray;
                });
        })
        .then(function saveMatches(allMatches) {
            console.log('Number of matches:', allMatches.length);

            promise.save('data-compiled/matches.json', JSON.stringify(allMatches));
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

compileMatches();