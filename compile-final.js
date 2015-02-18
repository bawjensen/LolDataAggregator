var fs          = require('fs'),
    request     = require('request'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

var BASE_URL    = 'https://na.api.pvp.net';
var API_KEY     = process.env.RIOT_KEY;
var KEY_QUERY   = querystring.stringify({ api_key: API_KEY });

var MATCH_ROUTE         = '/api/lol/na/v2.2/match/';

function convertToObject(runesOrMasteries) {
    var newObj = {};

    for (var i in runesOrMasteries) {
        var runeOrMastery = runesOrMasteries[i];

        var key;
        if (runeOrMastery.runeId) {
            key = 'runeId';
        }
        else {
            key = 'masteryId';
        }
        newObj[runeOrMastery[key]] = runeOrMastery.rank;
    }

    return newObj;
}

function extractMasterySummary(masteries) {
    var masteryTreeMapper = JSON.parse(fs.readFileSync('data-compiled/masteryTreeData.json'));

    var trees = {
        'Offense': 0,
        'Defense': 0,
        'Utility': 0
    };

    if (masteries) {
        masteries.forEach(function(mastery) {
            trees[masteryTreeMapper[mastery.masteryId]] += mastery.rank;
        });
    }

    return trees;
}

function groupPurchases(buys) {
    if (!buys)
        return [];
    
    var grouped = [];
    var i = 0;

    while (i < buys.length) {
        var subGroup = {};
        var starterTime = buys[i].time;

        while ((i < buys.length) && (buys[i].time - starterTime) < 30000) { // 30 time window of buying
            var itemId = buys[i].id;

            if (!(itemId in subGroup))
                subGroup[itemId] = 0;

            subGroup[itemId]++;
            i++;
        }

        grouped.push(subGroup);
        i++;
    }

    return grouped;
}

function parseSkillsAndBuysFromTimeline(matchEntry) {
    matchEntry.timeline.frames.forEach(function handleFrame(frame, i) {
        if (!frame.events) return;

        frame.events.forEach(function handleEvent(evt) {
            if (evt.eventType === 'SKILL_LEVEL_UP') {
                var id = evt.participantId - 1; // Adjust the index by 1
                var participant = matchEntry.participants[id];

                if (!(participant.skills))
                    participant.skills = [];

                participant.skills.push(evt.skillSlot);
            }
            else if (evt.eventType === 'ITEM_PURCHASED') {
                var id = evt.participantId - 1; // Adjust the index by 1
                var participant = matchEntry.participants[id];

                if (!(participant.buys))
                    participant.buys = [];


                participant.buys.push({ time: evt.timestamp, id: evt.itemId });
            }
        });
    });
}

function compileData() {
    var start = new Date().getTime();


    var limit = Infinity;
    var limitStart = 0;
    if (process.argv[2] && process.argv[3]) {
        limitStart = process.argv[2];
        limit = process.argv[3];
        console.log('Limiting to ' + (limit - limitStart) + ' matches');
    }
    else if (process.argv[2]) {
        limit = parseInt(process.argv[2]);
        console.log('Limiting to ' + limit + ' matches');
    }

    promise.readJson('data-compiled/matches.json')
        .then(function fetchMatches(matches) {
            var matches = matches.slice(limitStart, limit);

            var includeTimelineQuery = querystring.stringify({ includeTimeline: true });

            var champDataArray = [];

            return promise.groupedGet(matches, 50,
                function mapMatch(matchId) { // How to map a match to a promise request
                    return promise.persistentGet(BASE_URL + MATCH_ROUTE + matchId + '?' + includeTimelineQuery + '&' + KEY_QUERY);
                },
                function handleMatch(matchEntry) { // How to handle a match's response data
                    if (!matchEntry) return;
                    
                    parseSkillsAndBuysFromTimeline(matchEntry);

                    matchEntry.participants.forEach(function handleParticipant(participant, i) {
                        var champId = participant.championId;

                        if (participant.participantId != i+1) {
                            throw new Error('Issue: The participant index (' + i + ') doesn\'t match the id (' + participant.participantId + ')');
                        }

                        // if (!(champId in champDataArray))
                            // champDataArray[champId] = [];

                        var buyOrder = groupPurchases(participant.buys);
                        var runes = convertToObject(participant.runes);
                        var masteries = convertToObject(participant.masteries);

                        var masterySummary = extractMasterySummary(participant.masteries);

                        // matchDataObjs.push({
                        champDataArray.push ({
                            champId:        participant.championId,
                            summonerName:   matchEntry.participantIdentities[i].player.summonerName,
                            winner:         participant.stats.winner,
                            runes:          runes,
                            masteries:      masteries,
                            masterySummary: masterySummary,
                            lane:           participant.timeline.lane,
                            kills:          participant.stats.kills,
                            deaths:         participant.stats.deaths,
                            assists:        participant.stats.assists,
                            finalBuild:     [
                                                participant.stats.item0,
                                                participant.stats.item1,
                                                participant.stats.item2,
                                                participant.stats.item3,
                                                participant.stats.item4,
                                                participant.stats.item5,
                                                participant.stats.item6
                                            ],
                            summonerSpells: [
                                                participant.spell1Id,
                                                participant.spell2Id
                                            ],
                            date:           matchEntry.matchCreation,
                            skillOrder:     participant.skills,
                            buyOrder:       buyOrder,
                            uniqueId:       parseInt('' + matchEntry.matchId + participant.participantId)
                        });
                    });
                })
                .then(function() {
                    return champDataArray; // Funnel data into the save step
                });
        })
        .then(function saveData(champDataArray) {
            console.log(((new Date().getTime() - start) / 1000 / 3600) + ' hours');

            promise.save('data-compiled/data.json', JSON.stringify(champDataArray));
        })
        .catch(function(err) {
            console.log(err.stack);
            exit(1);
        });
}


compileData();