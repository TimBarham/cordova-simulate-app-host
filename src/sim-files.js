/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */

var browserify = require('browserify'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    through = require('through2'),
    log = require('./log'),
    plugins = require('./plugins');

var pluginSimulationFiles = require('./plugin-files');

var simulationFilePath;
var hostJsFiles = [];

function initialize(projectRoot) {
    simulationFilePath = path.join(projectRoot, 'simulation');
    if (!fs.existsSync(simulationFilePath)) {
        fs.mkdirSync(simulationFilePath);
    }
    hostJsFiles['APP-HOST'] = path.join(simulationFilePath, 'app-host.js');
    hostJsFiles['SIM-HOST'] = path.join(simulationFilePath, 'sim-host.js');
}

function loadJsonFile(file) {
    return JSON.parse(fs.readFileSync(file).toString());
}

function createSimHostJsFile() {
    //console.log('THIS REQUIRE MUST CHANGE TO A DYNAMIC LOADING OF THE FILE');
    var appHostPlugins = loadJsonFile(path.join(simulationFilePath, 'app-host.json')).plugins; // require(path.join(simulationFilePath, 'app-host.json')).plugins;
    console.log('appHostPlugins:');
    console.log(appHostPlugins);
    return createHostJsFile('SIM-HOST', ['JS', 'HANDLERS'], appHostPlugins);
}

function createAppHostJsFile() {
    return createHostJsFile('APP-HOST', ['JS', 'HANDLERS', 'CLOBBERS']);
}

function createHostJsFile(hostType, scriptTypes, pluginList) {
    console.log('*** BUILDING ' + hostType + '.JS ***');
    var d = Q.defer();

    var hostBaseName = hostType.toLowerCase();
    var outputFile = hostJsFiles[hostType];
    var jsonFile = path.join(simulationFilePath, hostBaseName + '.json');

    pluginList = pluginList || plugins.getPlugins();

    // See if we already have created our output file, and it is up-to-date with all its dependencies. However, if the
    // list of plugins has changed, or the directory where a plugin's simulation definition lives has changed, we need
    // to force a refresh.
    if (fs.existsSync(outputFile) && fs.existsSync(jsonFile)) {
        console.log('- BOTH JS AND JSON FILES EXIST');
        // Check plugin list in jsonFile to see if it is up-to-date
        // console.log('THIS REQUIRE MUST CHANGE TO A DYNAMIC LOADING OF THE FILE');
        //var cache = require(jsonFile);
        var cache = loadJsonFile(jsonFile);
        if (compareObjects(cache.plugins, pluginList)) {
            console.log('- CACHED PLUGINS MATCH REQUIRED LIST');
            var cachedFileInfo = cache.files;
            var upToDate = Object.keys(cachedFileInfo).every(function (file) {
                if (!fs.existsSync(file)) {
                    console.log('REQUIRED FILE DOES NOT EXIST: ' + file);
                } else {
                    if (cachedFileInfo[file] !== new Date(fs.statSync(file).mtime).getTime()) {
                        console.log('TIME STAMPS DON\'T MATCH FOR FILE ' + file);
                        console.log('CACHED: ' + cachedFileInfo[file]);
                        console.log('CURRENT: ' + new Date(fs.statSync(file).mtime).getTime());
                    }
                }
                return fs.existsSync(file) && cachedFileInfo[file] === new Date(fs.statSync(file).mtime).getTime();
            });
            console.log('- UP-TO-DATE: ' + upToDate);
            if (upToDate) {
                log.log('Creating ' + hostBaseName + '.js: Existing file found and is up-to-date.');
                d.resolve();
                return d.promise;
            }
        }
    }

    var filePath = path.join(__dirname, hostBaseName, hostBaseName + '.js');
    log.log('Creating ' + hostBaseName + '.js');

    var scriptDefs = createScriptDefs(hostType, scriptTypes);

    var b = browserify({paths: getBrowserifySearchPaths(hostType), debug: true});
    b.transform(function (file) {
        if (file === filePath) {
            var data = '';
            return through(function (buf, encoding, cb) {
                data += buf;
                cb();
            }, function (cb) {
                data = scriptDefs.reduce(function (previousData, scriptDef) {
                    return previousData.replace(scriptDef.comment, scriptDef.code.join(',\n'));
                }, data);
                this.push(data);
                cb();
            });
        } else {
            // No-op for other files
            return through(function (chunk, encoding, cb) {
                cb(null, chunk);
            });
        }
    });

    b.add(filePath);

    // Include common modules
    getCommonModules(hostType).forEach(function (module) {
        b.require(module.file, {expose: module.name});
    });

    var pluginTemplate = '\'%PLUGINID%\': require(\'%EXPOSEID%\')';
    Object.keys(pluginList).forEach(function (pluginId) {
        var pluginPath = pluginList[pluginId];
        scriptDefs.forEach(function (scriptDef) {
            var pluginScriptFile = path.join(pluginPath, scriptDef.fileName);
            if (fs.existsSync(pluginScriptFile)) {
                var exposeId = scriptDef.exposeId.replace(/%PLUGINID%/g, pluginId);
                scriptDef.code.push(pluginTemplate
                    .replace(/%PLUGINID%/g, pluginId)
                    .replace(/%EXPOSEID%/g, exposeId));
                b.require(pluginScriptFile, {expose: exposeId});
            }
        });
    });

    var fileInfo = {};
    b.on('file', function (file) {
        fileInfo[file] = new Date(fs.statSync(file).mtime).getTime();
    });

    var outputFileStream = fs.createWriteStream(outputFile);

    outputFileStream.on('finish', function () {
        fs.writeFileSync(jsonFile, JSON.stringify({plugins: pluginList, files: fileInfo}));
        d.resolve(pluginList);
    });
    outputFileStream.on('error', function (error) {
        d.reject(error);
    });

    var bundle = b.bundle();
    bundle.on('error', function (error) {
        d.reject(error);
    });

    bundle.pipe(outputFileStream);

    return d.promise;
}

var _browserifySearchPaths = null;
function getBrowserifySearchPaths(hostType) {
    _browserifySearchPaths = _browserifySearchPaths || {
            'APP-HOST': [path.join(__dirname, 'modules', 'app-host'), path.join(__dirname, 'modules', 'common'), path.join(__dirname, 'third-party')],
            'SIM-HOST': [path.join(__dirname, 'modules', 'sim-host'), path.join(__dirname, 'modules', 'common'), path.join(__dirname, 'third-party')],
        };
    return hostType ? _browserifySearchPaths[hostType] : _browserifySearchPaths;
}

function createScriptDefs(hostType, scriptTypes) {
    return scriptTypes.map(function (scriptType) {
        return {
            comment: {
                'JS': '/** PLUGINS **/',
                'HANDLERS': '/** PLUGIN-HANDLERS **/',
                'CLOBBERS': '/** PLUGIN-CLOBBERS **/'
            }[scriptType],
            exposeId: {
                'JS': '%PLUGINID%',
                'HANDLERS': '%PLUGINID%-handlers',
                'CLOBBERS': '%PLUGINID%-clobbers'
            }[scriptType],
            fileName: pluginSimulationFiles[hostType][scriptType],
            code: []
        };
    });
}


var _commonModules = null;
function getCommonModules(hostType) {
    if (!_commonModules) {
        _commonModules = {};
        var browserifySearchPaths = getBrowserifySearchPaths();
        Object.keys(browserifySearchPaths).forEach(function (hostType) {
            _commonModules[hostType] = [];
            browserifySearchPaths[hostType].forEach(function (searchPath) {
                if (fs.existsSync(searchPath)) {
                    fs.readdirSync(searchPath).forEach(function (file) {
                        if (path.extname(file) === '.js') {
                            _commonModules[hostType].push({name: path.basename(file, '.js'), file: path.join(searchPath, file)});
                        }
                    });
                }
            });
        });
    }
    return hostType? _commonModules[hostType] : _commonModules;
}

function compareObjects(o1, o2) {
    // If either are undefined, return false - don't consider undefined to equal undefined.
    if (typeof o1 === 'undefined' || typeof o1 === 'undefined') {
        return false;
    }

    if (Array.isArray(o1)) {
        if (!Array.isArray(o2)) {
            return false;
        }
        // Simple array comparison - expects same order and only scalar values
        return o1.length === o2.length && o1.every(function (v, i) {
                if (v !== o2[i]) {
                    console.log('KEY: ' + i);
                    console.log('LEFT: ' + v);
                    console.log('RIGHT: ' + o2[i]);
                }
                return v === o2[i];
            });
    }

    var keys1 = Object.keys(o1);
    var keys2 = Object.keys(o2);

    return compareObjects(keys1, keys2) &&
        compareObjects(keys1.map(function (key) {
            return o1[key];
        }), keys2.map(function (key) {
            return o2[key];
        }));
}

module.exports.initialize = initialize;
module.exports.createSimHostJsFile = createSimHostJsFile;
module.exports.createAppHostJsFile = createAppHostJsFile;

module.exports.getSimulationFilePath = function () {
    return simulationFilePath;
};
module.exports.getHostJsFile = function (hostType) {
    return hostJsFiles[hostType];
};
