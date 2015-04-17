var fs          = require('fs'),
    request     = require('request'),
    promise     = require('./helpers/promisedFunctions'),
    querystring = require('querystring');

var BASE_URL    = 'https://na.api.pvp.net';
var API_KEY     = process.env.RIOT_KEY;
var KEY_QUERY   = querystring.stringify({ api_key: API_KEY });

var MATCH_ROUTE = '/api/lol/na/v2.2/match/';

var UNKNOWN_ROLE = 'UNKNOWN';

var NUM_TOTAL_CHAMP_ENTRIES; // Summoner entries
var NUM_KEPT_CHAMP_ENTRIES;

function convertArrayToObject(runesOrMasteries) {
    var newObj = {};

    for (var i in runesOrMasteries) {
        var runeOrMastery = runesOrMasteries[i];

        var key;
        if (runeOrMastery.runeId)
            key = 'runeId';
        else
            key = 'masteryId';
        
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

function parseMaxOrder(skills) {
    var maxOrder = [];

    var ranks = {};
    skills.forEach(function(skill) {
        if (!ranks[skill])
            ranks[skill] = 0;

        ++ranks[skill];

        if (ranks[skill] === 5)
            maxOrder.push(skill);
    });

    Object.keys(ranks)
        .map(function(skillKey) { return { key: skillKey, rank: ranks[skillKey] }; })
        .sort(function(a, b) { return a.rank < b.rank ? 1 : a.rank > b.rank ? -1 : 0; })
        .forEach(function(skill) {
            var skillId = parseInt(skill.key); // Undoing automatic stringification of keys by javascript
            if (skillId !== 4 && maxOrder.indexOf(skillId) === -1)
                maxOrder.push(skillId);
        });

    return maxOrder;
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
    }

    return grouped;
}

function parseSkillsAndBuys(matchEntry) {
    matchEntry.timeline.frames.forEach(function handleFrame(frame, i) {
        if (!frame.events) return;

        frame.events.forEach(function handleEvent(evt, j) {
            if (evt.eventType === 'SKILL_LEVEL_UP' || evt.eventType === 'ITEM_PURCHASED' || evt.eventType === 'ITEM_UNDO') {

                var participantIndex = evt.participantId - 1; // Adjust the id by 1 to get the index
                var participant = matchEntry.participants[participantIndex];

                if (evt.eventType === 'SKILL_LEVEL_UP') {
                    if (!(participant.skills))
                        participant.skills = [];

                    participant.skills.push(evt.skillSlot);
                }
                else if (evt.eventType === 'ITEM_PURCHASED') {
                    if (!(participant.buys))
                        participant.buys = [];

                    participant.buys.push({ time: evt.timestamp, id: evt.itemId });
                }
                else if (evt.eventType === 'ITEM_UNDO') {
                    for (var i = participant.buys.length - 1; i >= 0; i--) {
                        if (participant.buys[i].id === evt.itemBefore) {
                            participant.buys.splice(i, 1); // Remove the 1 item at i
                            break;
                        }
                    }
                }
            }
        });
    });

    matchEntry.participants.forEach(function(participant) {
        if (participant.skills)
            participant.skillMaxOrder = parseMaxOrder(participant.skills);
        else {
            matchEntry.hasAfker = true;
            console.log('Match:', matchEntry.matchId, 'participant:', participant.participantId, 'has no skills');
        }
        participant.buys = groupPurchases(participant.buys);
    });
}

var MIDDLE_LANE = 'middle',
    JUNGLE_ROLE = 'jungle',
    TOP_LANE = 'top',
    BOTTOM_LANE = 'bottom',
    ADC_ROLE = 'adc',
    SUPPORT_ROLE = 'support';

function checkIsTopLaner(participant) {

}

var SMITE_ID = 11;
function checkIsJungler(participant) {
    return (participant.spell1Id === SMITE_ID || participant.spell2Id === SMITE_ID);
}

function checkIsMidLaner(participant) {

}

function checkIsAdc(participant) {

}

var SUPPORT_ROLE_START_ITEMS = [
    '2010', // Total Biscuit of Rejuvenation
    '3301', // Ancient Coin
    '3302', // Relic Shield
    '3303'  // Spellthief's Edge
];
function checkIsSupport(participant) {
    var flag = false;

    if (participant.buys) {
        flag = Object.keys(participant.buys[0]).some(function(initialItemId) {
            return SUPPORT_ROLE_START_ITEMS.indexOf(initialItemId) !== -1;
        });
    }
    else
        console.log('Failed finding buys to classify', participant.participantId);

    return flag;
}

function parseRoles(matchEntry) {
    var teams = {};

    matchEntry.participants.forEach(function(participant) {
        var teamId = participant.teamId;
        var lane = participant.timeline.lane = participant.timeline.lane.toLowerCase();
        participant.timeline.role = participant.timeline.role.toLowerCase();

        if (!(teamId in teams)) {
            teams[teamId] = {};

            teams[teamId][TOP_LANE] = [];
            teams[teamId][JUNGLE_ROLE] = [];
            teams[teamId][MIDDLE_LANE] = [];
            teams[teamId][BOTTOM_LANE] = [];
        }

        teams[teamId][lane].push(participant);
    });

    var expectedAmounts = {};
    expectedAmounts[TOP_LANE] = 1;
    expectedAmounts[JUNGLE_ROLE] = 1;
    expectedAmounts[MIDDLE_LANE] = 1;
    expectedAmounts[BOTTOM_LANE] = 2;

    var campedLanes = [TOP_LANE, MIDDLE_LANE, BOTTOM_LANE]; // Lanes often camped by jungler, might cause misclassification

    for (var teamId in teams) {
        var team = teams[teamId];

        // console.log('before:', JSON.stringify(Object.keys(team).map(function(role) { return [role, team[role].length]; })));

        var flagged = false, // Flagging an issue with the team comp/lanes
            fixed = false; // Flagging whether the issue was fixed

        for (var lane in expectedAmounts) {
            if (team[lane].length !== expectedAmounts[lane]) {
                flagged = true;
            }
        }

        // Set initial baseline roles
        team[BOTTOM_LANE].forEach(function(botLaner) {
            // console.log(botLaner.timeline.role);
            botLaner.role = botLaner.timeline.role === 'duo' ?
                (checkIsSupport(botLaner) ? SUPPORT_ROLE : ADC_ROLE) :
                botLaner.timeline.role === 'duo_support' ?
                    SUPPORT_ROLE :
                    ADC_ROLE; // Note: defaults to ADC
        });

        team[MIDDLE_LANE].forEach(function(midLaner) { midLaner.role = MIDDLE_LANE; });
        team[JUNGLE_ROLE].forEach(function(jungler) { jungler.role = JUNGLE_ROLE; });
        team[TOP_LANE].forEach(function(topLaner) { topLaner.role = TOP_LANE; });


        // Attempt simple fixes for normal lane mixups
        if (flagged) {
            // Fixing: a jungler camping botlane and getting misclassified
            if (team[BOTTOM_LANE].length === 3 && team[JUNGLE_ROLE].length === 0) {
                team[BOTTOM_LANE].forEach(function(botLaner, index) {
                    // Check for junglers and supports because everything defaults to adc
                    if (checkIsJungler(botLaner)) {
                        botLaner.role = JUNGLE_ROLE;
                        team[JUNGLE_ROLE].push(team[BOTTOM_LANE].splice(index, 1));
                    }
                    else if (checkIsSupport(botLaner)) {
                        botLaner.role = SUPPORT_ROLE;
                    }
                });

                fixed = true;
            }

            // Fixing: a likely lane swap
            if (team[TOP_LANE].length === 2 && team[BOTTOM_LANE].length === 1 && team[MIDDLE_LANE].length === 1 && team[JUNGLE_ROLE].length === 1) {
                // Swap top and bottom
                var temp = team[BOTTOM_LANE];
                team[BOTTOM_LANE] = team[TOP_LANE];
                team[TOP_LANE] = temp;

                // Reset roles
                team[BOTTOM_LANE].forEach(function(botLaner) {
                    botLaner.role = (botLaner.timeline.role === 'duo_carry') ? ADC_ROLE : SUPPORT_ROLE;
                });
                team[TOP_LANE].forEach(function(topLaner) { topLaner.role = TOP_LANE; });

                fixed = true;
            }

            // Fixing: junglers camping a solo lane so much they're classified as a laner, or a solo laner roaming so much they're a jungler
            campedLanes.forEach(function(campedLane) {
                if ((team[campedLane].length === 2 && team[JUNGLE_ROLE].length === 0) || (team[campedLane].length === 0 && team[JUNGLE_ROLE].length === 2)) {
                    var overloadedRole = team[campedLane].length === 2 ? campedLane : JUNGLE_ROLE;

                    team[overloadedRole].forEach(function(laner, index) {
                        laner.role = checkIsJungler(laner) ? JUNGLE_ROLE : campedLane;
                        if (laner.role !== overloadedRole) {
                            team[laner.role].push(team[overloadedRole].splice(index, 1));
                        }
                    });

                    fixed = true;
                }
            });

            // Fixing: a roaming support/adc getting classified as a jungler
            if (team[BOTTOM_LANE].length === 1 && team[JUNGLE_ROLE].length === 2) {
                var issueWithJungler = false;
                team[JUNGLE_ROLE].forEach(function(jungler, index) {
                    jungler.role = checkIsSupport(jungler) ? SUPPORT_ROLE : checkIsJungler(jungler) ? JUNGLE_ROLE : checkIsSupport(team[BOTTOM_LANE][0]) ? ADC_ROLE : undefined;

                    if (jungler.role === SUPPORT_ROLE || jungler.role === ADC_ROLE) {
                        team[BOTTOM_LANE].push(team[JUNGLE_ROLE].splice(index, 1));
                    }

                    if (!jungler.role) {
                        console.log('Issue with identifying in match:', matchEntry.matchId);
                        console.log('Person in question:', matchEntry.participantIdentities[jungler.participantId-1].player.summonerName);
                        issueWithJungler = true;
                    }
                });

                if (!issueWithJungler)
                    fixed = true;
                else {
                    console.log('Jungler issue game:', JSON.stringify(Object.keys(team).map(function(role) { return [role, team[role].length]; })));
                    team[TOP_LANE].forEach(function(topLaner) {
                        console.log('Top laner:', matchEntry.participantIdentities[topLaner.participantId-1].player.summonerName);
                    });
                }
            }
        }

        if (flagged && !fixed) {
            matchEntry.unclearRoles = true;
            console.log('Flagging match:', matchEntry.matchId, 'team:', teamId, '-', JSON.stringify(Object.keys(team).map(function(role) { return [role, team[role].length]; })));
        }

        // console.log('after: ', JSON.stringify(Object.keys(team).map(function(role) { return [role, team[role].length]; })));
    }
}

function compileData() {
    var start = new Date().getTime();

    var limitStart = 0;
    var limit = Infinity;
    if (process.argv[2] && process.argv[3]) {
        limitStart = process.argv[2];
        limit = process.argv[3];
        console.log('Limiting to ' + (limit - limitStart) + ' matches');
    }
    else if (process.argv[2]) {
        limit = parseInt(process.argv[2]);
        console.log('Limiting to ' + limit + ' matches');
    }

    var runeStaticData;

    promise.readJson('data-compiled/runes.json')
        .then(function loadDynamic(runeStatic) {
            runeStaticData = runeStatic;
            return promise.readJson('data-compiled/matches.json');
        })
        .then(function fetchMatches(matches) {
            var matches = matches.slice(limitStart, limit);
            // var matches = [1761141257];
            NUM_TOTAL_CHAMP_ENTRIES = matches.length * 10;
            NUM_KEPT_CHAMP_ENTRIES = 0;

            var includeTimelineQuery = querystring.stringify({ includeTimeline: true });

            var champDataArray = [];

            return promise.groupedGet(matches, 50,
                function mapMatch(matchId) { // How to map a match to a promise request
                    return promise.persistentGet(BASE_URL + MATCH_ROUTE + matchId + '?' + includeTimelineQuery + '&' + KEY_QUERY);
                },
                function handleMatch(matchEntry) { // How to handle a match's response data
                    if (!matchEntry) {
                        console.log('Ignoring match as it returned "falsey"');
                    }
                    else if (!matchEntry.timeline) {
                        console.log('Ignoring match', matchEntry.matchId, 'as it has no timeline');
                    }
                    else {
                        parseSkillsAndBuys(matchEntry);
                        parseRoles(matchEntry);

                        // if (matchEntry.hasAfker || matchEntry.unclearRoles) return;

                        matchEntry.participants.forEach(function handleParticipant(participant, i) {
                            if (!participant.skills) return; // Ignore champs that haven't skilled anything (likely afk)

                            var champId = participant.championId;

                            if (participant.participantId != i+1) {
                                throw new Error('Issue: The participant index (' + i + ') doesn\'t match the id (' + participant.participantId + ')');
                            }

                            var masteries = participant.masteries ? convertArrayToObject(participant.masteries) : {};
                            var masterySummary = participant.masteries ? extractMasterySummary(participant.masteries) : {};

                            var runeTree =  {};
                            if (participant.runes) {
                                participant.runes.forEach(function(rune) {
                                    var runeType = runeStaticData[rune.runeId].type;
                                    if (!(runeType in runeTree))
                                        runeTree[runeType] = {};

                                    runeTree[runeType][rune.runeId] = rune.rank;
                                });
                            }
                            
                            if (matchEntry.hasAfker || matchEntry.unclearRoles)
                                participant.role = UNKNOWN_ROLE;

                            champDataArray.push ({
                                champId:        participant.championId,
                                summonerName:   matchEntry.participantIdentities[i].player.summonerName,
                                winner:         participant.stats.winner,
                                runes:          runeTree,
                                masteries:      masteries,
                                masterySummary: masterySummary,
                                role:           participant.role,
                                kills:          participant.stats.kills,
                                deaths:         participant.stats.deaths,
                                assists:        participant.stats.assists,
                                summonerSpells: [
                                                    participant.spell1Id,
                                                    participant.spell2Id
                                                ],
                                date:           matchEntry.matchCreation,
                                skillOrder:     participant.skills,
                                skillMaxOrder:  participant.skillMaxOrder,
                                buyOrder:       participant.buys,
                                matchId:        matchEntry.matchId
                                // finalBuild:     [
                                //                     participant.stats.item0,
                                //                     participant.stats.item1,
                                //                     participant.stats.item2,
                                //                     participant.stats.item3,
                                //                     participant.stats.item4,
                                //                     participant.stats.item5,
                                //                     participant.stats.item6
                                //                 ],
                            });

                            ++NUM_KEPT_CHAMP_ENTRIES;
                        });
                    }
                })
                .then(function() {
                    return champDataArray; // Funnel data into the save step
                });
        })
        .then(function saveData(champDataArray) {
            console.log(((new Date().getTime() - start) / 1000 / 60) + ' minutes');
            console.log('Kept', NUM_KEPT_CHAMP_ENTRIES, 'out of', NUM_TOTAL_CHAMP_ENTRIES, 'champ entries');

            promise.save('data-compiled/data.json', JSON.stringify(champDataArray));
        })
        .catch(function(err) {
            console.log(err.stack);
            exit(1);
        });
}


compileData();