var argv        = require('optimist').argv,
    MongoClient = require('mongodb').MongoClient,
    promise     = require('./helpers/promisedFunctions');

var MONGO_URL = process.env.MONGO_URL_PREFIX + (argv.db_ip || 'localhost:27017') + process.env.MONGO_URL_DB;

var NUM_TO_STORE = 50;

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
            return new Promise(function(resolve, reject) {
                console.log('Connecting to', MONGO_URL);
                MongoClient.connect(MONGO_URL, function callback(err, db) {
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
                Object.keys(staticChampsData).map(function(key) {
                    var entry = staticChampsData[key];

                    var newChampData = newChampsData.filter(function(dataEntry) { return dataEntry.champId === entry.id; });
                    var numNew = newChampData.length;

                    console.log(entry.name, 'has', numNew, 'new matches');

                    var promiseBuffer;

                    if (numNew >= NUM_TO_STORE) {
                        console.log('Cutting down to', NUM_TO_STORE);
                        promiseBuffer = Promise.resolve(newChampData.slice(0, NUM_TO_STORE));
                    }
                    else {
                        console.log('Fetching more to make', NUM_TO_STORE);
                        var numToFetch = NUM_TO_STORE - numNew;

                        var earliestDate = Infinity;

                        newChampData.forEach(function(entry) {
                            earliestDate = entry.date < earliestDate ? entry.date : earliestDate;
                        });

                        // console.log(entry.name, 'latest old game:', earliestDate);

                        promiseBuffer = new Promise(function(resolve, reject) {
                            mongoDb.collection('champData').find({ champId: entry.id, date: { $lt: earliestDate } }).sort({ date: -1 }).limit(numToFetch).toArray(function(err, oldGames) {
                                console.log('Got', oldGames.length, 'old games for', entry.name, 'vs', newChampData.length, 'new games');
                                newChampData.push.apply(newChampData, oldGames);
                                resolve(newChampData);
                            });
                        });
                    }

                    return promiseBuffer;
                })
            )
            .then(function returnData(allChampGames) {
                var merged = [];
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
                    mongoDb.close();
                    throw err;
                });
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

sendDataToDatabase();