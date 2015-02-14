var fs      = require('fs'),
    promise = require('./helpers/promisedFunctions');

var API_KEY = process.env.RIOT_KEY;

function fetchMasteryData() {
    var masteryIds = Object.keys(JSON.parse(fs.readFileSync('dragontail/current/data/en_US/mastery.json')).data);

    Promise.all(
        masteryIds.map(function mapToFetch(id) {
            return promise.persistentGet('https://na.api.pvp.net/api/lol/static-data/na/v1.2/mastery/' + id + '?masteryData=masteryTree&api_key=' + API_KEY)
        })
    )
    .then(function mapIdToTree(masteryArray) {
        var map = {};

        masteryArray.forEach(function(masteryEntry) {
            map[masteryEntry.id] = masteryEntry.masteryTree;
        });

        return map;
    })
    .then(function save(map) {
        fs.writeFile('data-compiled/masteryTreeData.json', JSON.stringify(map));
    })
    .catch(function(err) {
        console.log(err.stack);
    });
}

fetchMasteryData();