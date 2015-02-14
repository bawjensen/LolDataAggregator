var promise         = require('./helpers/promisedFunctions'),
    querystring     = require('querystring');

var BASE_URL    = 'https://na.api.pvp.net';
var API_KEY     = process.env.RIOT_KEY;

var CHALLENGER_ROUTE = '/api/lol/na/v2.5/league/challenger';

var KEY_QUERY = querystring.stringify({ api_key: API_KEY });

function compilePlayers() {
    promise.getJson(BASE_URL + CHALLENGER_ROUTE + '?' + querystring.stringify({ type: 'RANKED_SOLO_5x5' }) + '&' + KEY_QUERY)
        .then(function parseOut(LeagueDto) {
            var players = {};
            var entries = LeagueDto.entries;

            for (var i in entries) {
                var entry = entries[i];

                players[entry.playerOrTeamId] = true;
            }

            return Object.keys(players);
        })
        .then(function saveData(players) {
            console.log('Got ' + players.length + ' players');
            promise.save('data-compiled/players.json', JSON.stringify(players));
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

compilePlayers();