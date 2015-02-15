var fs      = require('fs'),
    promise = require('./helpers/promisedFunctions');

var API_KEY = process.env.RIOT_KEY;

function convertChamps() {
    var data = JSON.parse(fs.readFileSync('dragontail/current/data/en_US/champion.json')).data;

    var translatorObj = {};

    for (var champName in data) {
        var champId = parseInt(data[champName].key);
        translatorObj[champName.toLowerCase()] = { id: champId, name: champName };
    }

    fs.writeFile('data-compiled/champsByName.json', JSON.stringify(translatorObj));
}

function fetchMasteryData() {
    var masteryTree = JSON.parse(fs.readFileSync('dragontail/current/data/en_US/mastery.json')).tree;

    var map = {};

    Object.keys(masteryTree).forEach(function handleBranch(branchName) { // Offense, Defense, Utility
        var branch = masteryTree[branchName];
        branch.forEach(function handleTier(tier) { // 0-5
            tier.forEach(function handleSlot(slot) {
                if (slot) // Checks for 'null' paddings
                    map[slot.masteryId] = branchName;
            });
        });
    });

    fs.writeFile('data-compiled/masteryTreeData.json', JSON.stringify(map));
}

convertChamps();
fetchMasteryData();