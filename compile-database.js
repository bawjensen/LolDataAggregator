var argv        = require('optimist').argv,
    globals     = require('./helpers/globalConstants'),
    MongoClient = require('mongodb').MongoClient,
    promise     = require('./helpers/promisedFunctions');

function sendDataToDatabase() {
    var newChampsData;
    var staticChampsData;
    var mongoDb;

    promise.readJson('data-compiled/data.json')
        .then(function findEarliestDate(data) {
            newChampsData = data;
        })
        .then(function readAllChampionIds() {
            return promise.readJson('./data-compiled/champsByName.json')
                .then(function store(data) {
                    staticChampsData = data;
                });
        })
        .then(function connectToDatabase() {
            var mongoUrl = process.env.MONGO_URL_PREFIX + (argv.db_ip || 'localhost:27017') + process.env.MONGO_URL_DB;

            return new Promise(function(resolve, reject) {
                console.log('Connecting to', mongoUrl);
                MongoClient.connect(mongoUrl, function callback(err, db) {
                    if (err) {
                        reject(Error(err));
                    }
                    else {
                        mongoDb = db;
                        resolve();
                    }
                });
            });
        })
        .then(function determineShortedChampions() {
            return Promise.all(
                Object.keys(staticChampsData).map(function(champId) {
                    var entry = staticChampsData[champId];

                    var newChampData = newChampsData.filter(function(dataEntry) { return dataEntry.champId === entry.id; });
                    var numNew = newChampData.length;

                    console.log(entry.name, 'has', numNew, 'new matches');

                    // var promiseBuffer;

                    // if (numNew >= globals.NUM_PER_CHAMP_ROLE) {
                    //     // Grab the most recent
                    //     newChampData.sort(function(a, b) { return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
                    //     promiseBuffer = Promise.resolve(newChampData.slice(0, globals.NUM_PER_CHAMP_ROLE));
                    // }
                    // else {
                    //     console.log('Fetching more to make', globals.NUM_PER_CHAMP_ROLE);
                    //     var numToFetch = globals.NUM_PER_CHAMP_ROLE - numNew;

                    //     var earliestDate = Infinity;

                    //     newChampData.forEach(function(entry) {
                    //         earliestDate = entry.date < earliestDate ? entry.date : earliestDate;
                    //     });

                    //     // console.log(entry.name, 'latest old game:', earliestDate);

                    //     promiseBuffer = new Promise(function(resolve, reject) {
                    //         mongoDb.collection('champData').find({ champId: entry.id, date: { $lt: earliestDate } }).sort({ date: -1 }).limit(numToFetch).toArray(function(err, oldGames) {
                    //             console.log('Got', oldGames.length, 'old games for', entry.name, 'vs', newChampData.length, 'new games');
                    //             newChampData.push.apply(newChampData, oldGames);
                    //             resolve(newChampData);
                    //         });
                    //     });
                    // }

                    return newChampData;
                })
            )
            .then(function returnData(allChampGames) {
                var merged = [];
                // Flatten the array of arrays
                return merged.concat.apply(merged, allChampGames);
            });
        })
        .then(function insert(mongoData) {
            var collection = mongoDb.collection('champData');

            return promise.mongoClear(collection)
                .then(function saveNew() {
                    return promise.mongoInsert(collection, mongoData);
                })
                .then(function closeDB() {
                    console.log('Write success, closing db');
                    mongoDb.close();
                })
                .catch(function closeDBAnyway(err) {
                    console.log('Error, closing db anyway');
                    mongoDb.close();
                    throw err;
                });
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

sendDataToDatabase();