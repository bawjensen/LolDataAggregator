var exec    = require('child_process').exec,
    fs      = require('fs'),
    request = require('request');

function promiseCatchAndQuit(err) {
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
        reject(Error(err));
    }
    else if (resp.statusCode === 429) {
        setTimeout(function() {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        }, parseInt(resp.headers['retry-after']));
    }
    else if (resp.statusCode === 503 || resp.statusCode === 504) {
        setTimeout(function() {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        }, 100);
    }
    else if (resp.statusCode != 200) {
        reject(Error('Resp status code not 200: ' + resp.statusCode + '(' + url + ')'));
    }
    else {
        resolve(body);
    }
}
function persistentPromiseGet(url) {
    return new Promise(function get(resolve, reject) {
            request.get(url, persistentCallback.bind(null, url, resolve, reject));
        })
        .then(JSON.parse)
        .catch(promiseCatchAndQuit);
}

function promiseRateLimitedGet(list, groupSize, promiseMapper, matchHandler) {
    var listSize = list.length;

    var groupedList = [];
    for (var i = 0; i < list.length; i += groupSize) {
        groupedList.push(list.slice(i, i+groupSize));
    }

    return groupedList.reduce(function chainPromiseAlls(chainSoFar, matchesGroup, i) {
        return chainSoFar.then(function() {
            return Promise.all(matchesGroup.map(promiseMapper))
                .then(function assignData(matchesArray) {
                    matchesArray.forEach(matchHandler); // This is where the magic happens - data extracted *outside* of promises
                    console.log('Finished ' + (i + 1) * 10 + ', sending out the next set of requests');
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

module.exports = {
    save:               promiseSave,
    get:                promiseGet,
    getJson:            promiseJsonGet,
    read:               promiseReadFile,
    readJson:           promiseReadJsonFile,
    persistentGet:      persistentPromiseGet,
    getPipe:            promisePipeFile,
    exec:               promiseExec,
    wait:               promiseWait,
    rateLimitGet:       promiseRateLimitedGet
}