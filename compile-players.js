var globals     = require('./helpers/globalConstants'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

function compilePlayers() {
    Promise.all(
        globals.REGIONS.map(function(regionStr) {
            return promise.persistentGet(globals.URL_PREFIX + regionStr + globals.BASE_URL + regionStr + globals.CHALLENGER_ROUTE + '?' + globals.KEY_RANKED_TYPE_QUERY, regionStr);
        })
    )
    .then(function parseOutArray(LeagueDtoArray) {
        var data = [];

        LeagueDtoArray.forEach(function parseOut(obj) {
            var LeagueDto = obj.data;
            var regionStr = obj.id;

            console.log('Received:', regionStr);

            var players = {};
            var entries = LeagueDto.entries;

            for (var i in entries) {
                var entry = entries[i];

                players[entry.playerOrTeamId] = true;
            }

            // return Object.keys(players);
            Object.keys(players).forEach(function attachRegionToPlayer(playerId) {
                data.push([playerId, regionStr]);
            });
        });

        return data;
    })
    .then(function saveData(allPlayers) {
        console.log('Got ' + allPlayers.length + ' players');

        promise.save('data-compiled/players.json', JSON.stringify(allPlayers));
    })
    .catch(function(err) {
        console.log(err.stack);
    });
}

compilePlayers();