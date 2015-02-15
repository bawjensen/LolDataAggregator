var argv        = require('optimist').argv,
    MongoClient = require('mongodb').MongoClient,
    promise     = require('./helpers/promisedFunctions');

var MONGO_URL = process.env.MONGO_URL_PREFIX + argv.db_ip + process.env.MONGO_URL_DB;

console.log('Connecting to', MONGO_URL);

function sendDataToDatabase() {
    promise.readJson('data-compiled/data.json')
        .then(function connectToDatabase(mongoData) {
            return new Promise(function(resolve, reject) {
                MongoClient.connect(MONGO_URL, function callback(err, db) {
                    if (err) {
                        reject(Error(err));
                    }
                    else {
                        resolve({ db: db, collection: db.collection('champData'), mongoData: mongoData });
                    }
                });
            })
        })
        .then(function wipeAndInsert(obj) {
            var collection = obj.collection;
            var mongoData = obj.mongoData;
            var db = obj.db;

            collection.remove({}, function callback(err) {
                console.log(err ? err.stack : 'Remove success');

                collection.insert(mongoData, function callback(err) {
                    console.log(err ? err.stack : 'Write success');
                    db.close();
                });
            });
        })
        .catch(function(err) {
            console.log(err.stack);
        });
}

sendDataToDatabase();