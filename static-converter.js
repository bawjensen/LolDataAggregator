var fs      = require('fs'),
    promise = require('./helpers/promisedFunctions');

var API_KEY = process.env.RIOT_KEY;

function convertChamps() {
    var data = JSON.parse(fs.readFileSync('dragontail/current/data/en_US/champion.json')).data;

    var convertedObj = {};
    var translatorObj1 = {};
    var translatorObj2 = {};

    for (var champName in data) {
        var champId = parseInt(data[champName].key);
        convertedObj[champId] = data[champName];
        translatorObj1[champName.toLowerCase()] = { id: champId, name: champName };
        translatorObj2[champId] = champName;
    }

    fs.writeFile('data-compiled/champData.json', JSON.stringify(convertedObj));
    fs.writeFile('data-compiled/champNames.json', JSON.stringify(translatorObj1));
    fs.writeFile('data-compiled/champIds.json', JSON.stringify(translatorObj2));
}

function convertSummonerSpells() {
    var data = JSON.parse(fs.readFileSync('dragontail/current/data/en_US/summoner.json')).data;

    var newObj = {};

    for (var summonerSpellName in data) {
        newObj[parseInt(data[summonerSpellName].key)] = data[summonerSpellName];
    }

    fs.writeFile('data-compiled/spellData.json', JSON.stringify(newObj));
}

function convertRuneData() {
    var data = JSON.parse(fs.readFileSync('dragontail/current/data/en_US/rune.json')).data;

    for (var runeId in data) {
        var runeObj = data[runeId];

        if (runeObj.name.match(/^Greater/)) {
            runeObj.shortName = runeObj.name.replace(/^Greater (Mark|Seal|Quintessence|Glyph) of /, '');

            if (runeObj.name.match(/Quintessence/)) {
                runeObj.shortName += ' Quints';
            }
            else if (runeObj.name.match(/Glyph/)) {
                runeObj.shortName += ' Glyphs';
            }
            else if (runeObj.name.match(/Mark/)) {
                runeObj.shortName += ' Marks';
            }
            else if (runeObj.name.match(/Seal/)) {
                runeObj.shortName += ' Seals';
            }

            runeObj.shortName = runeObj.shortName.replace(/Ability Power/, 'AP');
            runeObj.shortName = runeObj.shortName.replace(/Attack Damage/, 'AD');
            runeObj.shortName = runeObj.shortName.replace(/Penetration/, 'Pen');
            runeObj.shortName = runeObj.shortName.replace(/Regeneration/, 'Regen'); 
            runeObj.shortName = runeObj.shortName.replace(/Cooldown Reduction/, 'CDR');
            runeObj.shortName = runeObj.shortName.replace(/Critical Chance/, 'Crit Chance');
            runeObj.shortName = runeObj.shortName.replace(/Magic Resist/, 'MR');
            runeObj.shortName = runeObj.shortName.replace(/Mana Regen/, 'M. Regen');
            runeObj.shortName = runeObj.shortName.replace(/Movement Speed/, 'Move Speed');
        }
    }

    fs.writeFile('data-compiled/runeData.json', JSON.stringify(data));
}

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

convertChamps();
convertSummonerSpells();
convertRuneData();
fetchMasteryData();