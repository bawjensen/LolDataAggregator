var exec    = require('child_process').exec,
    fs      = require('fs'),
    request = require('request');

function promiseCatchAndQuit(err) {
    console.log('Catching an error in a promise, and quitting');
    console.log(err);
    console.log(err.code)
    console.log(err.stack);
    process.exit(1);
}

function promiseSave(filePath, data) {
    return new Promise(function save(resolve, reject) {
        fs.writeFile(filePath, data, function handleResp(err) {
            if (!err)
                resolve();
            else
                reject(Error(err));
        });
    });
}

function promisePipeFile(url, filePath) {
    return new Promise(function save(resolve, reject) {
        var outStream = fs.createWriteStream(filePath);
        var pipe = request.get(url).pipe(outStream);
        outStream.on('finish', resolve);
    });
}

function promiseReadFile(filePath) {
    return new Promise(function read(resolve, reject) {
        fs.readFile(filePath, function handleResp(err, fileContents) {
            if (!err)
                resolve(fileContents);
            else
                reject(Error(err));
        });
    });
}
function promiseReadJsonFile(filePath) {
    return promiseReadFile(filePath).then(JSON.parse);
}

function promiseGet(url) {
    return new Promise(function get(resolve, reject) {
        request.get(url, function handleResp(err, resp, body) {
            if (err)
                reject(Error(err));
            else if (resp.statusCode != 200)
                reject(Error('Resp status code not 200: ' + resp.statusCode + '(' + url + ')'));
            else
                resolve(body);
        });
    });
}
function promiseJsonGet(url) {
    return promiseGet(url).then(JSON.parse);
}

function persistentCallback(url, resolve, reject, err, resp, body) {
    if (err) {
        console.log('Issue with: ' + url);
        reject(err);
    }
    else if (resp.statusCode === 429) {
        setTimeout(function() {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        }, parseInt(resp.headers['retry-after']));
    }
    else if (resp.statusCode === 503 || resp.statusCode === 504) {
        console.log('Got', resp.statusCode, 'code, retrying in 0.5 sec');
        setTimeout(function() {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        }, 500);
    }
    else if (resp.statusCode === 404) {
        resolve(null); // Return nothing
    }
    else if (resp.statusCode !== 200) {
        reject(Error('Resp status code not 200: ' + resp.statusCode + '(' + url + ')'));
    }
    else {
        resolve(body);
    }
}
function promisePersistentGet(url, identifier) {
    // console.log('url:', url);
    return new Promise(function get(resolve, reject) {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        })
        .then(JSON.parse)
        .then(function returnWithIdentifier(data) {
            return data ? (identifier ? { data: data, id: identifier } : data) : null;
        })
        .catch(function(err) {
            if (err.code === 'ECONNRESET')
                promisePersistentGet(url, identifier);
            else
                throw err;
        });
}

function promiseGroupedGet(list, groupSize, promiseMapper, matchHandler) {
    var listSize = list.length;

    var groupedList = [];
    for (var i = 0; i < list.length; i += groupSize) {
        groupedList.push(list.slice(i, i+groupSize));
    }

    return groupedList.reduce(function chainPromiseAlls(chainSoFar, matchesGroup, i) {
        return chainSoFar.then(function() {
            return Promise.all(matchesGroup.map(promiseMapper))
                .then(function assignData(matchesArray) {
                    matchesArray.forEach(matchHandler); // This is where the handler magic happens - data extracted *outside* of promises
                    console.log('Finished batch ending with', (i + 1) * groupSize, 'sending out the next set of requests');
                })
            });
        }, Promise.resolve());
}

function promiseExec(command, options) {
    return new Promise(function execute(resolve, reject) {
        exec(command, options, function callback(err, stdout, stderr) {
            if (err)
                reject(Error(err));
            else
                resolve();
        });
    });
}

function promiseWait(milliseconds, data) {
    return new Promise(function wait(resolve, reject) {
        setTimeout(resolve, milliseconds, data);
    });
}

function promiseMongoInsert(collection, data) {
    return new Promise(function insert(resolve, reject) {
        collection.insert(data, function callback(err) {
            if (err)
                reject(Error(err));
            else
                resolve();
        });
    });
}

function promiseMongoSave(collection, data) {
    return new Promise(function insert(resolve, reject) {
        collection.save(data, function callback(err) {
            if (err)
                reject(Error(err));
            else
                resolve();
        });
    });
}

function promiseMongoClear(collection, query) {
    return new Promise(function insert(resolve, reject) {
        collection.remove({}, function callback(err) {
            if (err)
                reject(Error(err));
            else
                resolve();
        });
    });
}

module.exports = {
    save:               promiseSave,
    get:                promiseGet,
    getJson:            promiseJsonGet,
    read:               promiseReadFile,
    readJson:           promiseReadJsonFile,
    persistentGet:      promisePersistentGet,
    getPipe:            promisePipeFile,
    exec:               promiseExec,
    wait:               promiseWait,
    groupedGet:         promiseGroupedGet,
    mongoInsert:        promiseMongoInsert,
    mongoSave:          promiseMongoSave,
    mongoClear:         promiseMongoClear
}