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
    config = require('./config'),
    log = require('./log'),
    plugins = require('./plugins'),
    prepare = require('./prepare'),
    simSocket = require('./socket');

var pluginSimulationFiles = require('./plugin-files');

var hostJsFiles = {};
var builtOnce = {};
var simHost = 'SIM-HOST';
var appHost = 'APP-HOST';

function loadJsonFile(file) {
    return JSON.parse(fs.readFileSync(file).toString());
}

function createSimHostJsFile() {
    // Don't create sim-host.js until we've created app-host.js at least once, so we know we're working with the same
    // list of plugins.
    return waitOnAppHostJs().then(function (appHostPlugins) {
        return createHostJsFile(simHost, ['JS', 'HANDLERS'], appHostPlugins);
    });
}

function validateSimHostPlugins(pluginList) {
    // App-host has been refreshed. If plugins have changed, notify sim-host that is should also refresh (but only bother
    // doing this if we have ever created sim-host).
    if (builtOnce[simHost] && !validatePlugins(simHost, pluginList)) {
        simSocket.emitToHost(simHost, 'refresh');
        simSocket.invalidateSimHost();
    }
}

function waitOnAppHostJs() {
    if (builtOnce[appHost]) {
        // If we've ever built app-host, just use what we have (on a refresh of sim-host, we don't want to rebuild app-host).
        return Q.when(loadJsonFile(path.join(config.simulationFilePath, 'app-host.json')).plugins);
    } else {
        // Otherwise force it to build now (this is to handle the case where sim-host is requested before app-host).
        return createAppHostJsFile();
    }
}

var appHostJsPromise;
function createAppHostJsFile() {
    if (!appHostJsPromise) {
        var d = Q.defer();
        appHostJsPromise = d.promise;

        prepare.waitOnPrepare().then(function () {
            return createHostJsFile(appHost, ['JS', 'HANDLERS', 'CLOBBERS'])
        }).then(function (pluginList) {
            d.resolve(pluginList);
            appHostJsPromise = null;
        });
    }

    return appHostJsPromise;
}

function validatePlugins(hostType, pluginList) {
    var hostBaseName = hostType.toLowerCase();
    var jsonFile = path.join(config.simulationFilePath, hostBaseName + '.json');
    if (!fs.existsSync(jsonFile)) {
        return false;
    }

    var cache = loadJsonFile(jsonFile);
    if (!compareObjects(cache.plugins, pluginList)) {
        return false;
    }

    var cachedFileInfo = cache.files;
    return Object.keys(cachedFileInfo).every(function (file) {
        return fs.existsSync(file) && cachedFileInfo[file] === new Date(fs.statSync(file).mtime).getTime();
    });
}

function createHostJsFile(hostType, scriptTypes, pluginList) {
    builtOnce[hostType] = true;
    var hostBaseName = hostType.toLowerCase();
    var outputFile = getHostJsFile(hostType);
    var jsonFile = path.join(config.simulationFilePath, hostBaseName + '.json');

    pluginList = pluginList || plugins.getPlugins();

    // See if we already have created our output file, and it is up-to-date with all its dependencies. However, if the
    // list of plugins has changed, or the directory where a plugin's simulation definition lives has changed, we need
    // to force a refresh.
    if (fs.existsSync(outputFile) && validatePlugins(hostType, pluginList)) {
        log.log('Creating ' + hostBaseName + '.js: Existing file found and is up-to-date.');
        return Q.when(pluginList);
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
    var d = Q.defer();

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
    if (!_browserifySearchPaths) {
        _browserifySearchPaths = {};
        _browserifySearchPaths[appHost] = [path.join(__dirname, 'modules', 'app-host'), path.join(__dirname, 'modules', 'common'), path.join(__dirname, 'third-party')];
        _browserifySearchPaths[simHost] = [path.join(__dirname, 'modules', 'sim-host'), path.join(__dirname, 'modules', 'common'), path.join(__dirname, 'third-party')];
    }

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

function getHostJsFile(hostType) {
    if (!hostJsFiles[hostType]) {
        hostJsFiles[hostType] = path.join(config.simulationFilePath, hostType.toLowerCase() + '.js');
    }
    return hostJsFiles[hostType];
}

module.exports.createSimHostJsFile = createSimHostJsFile;
module.exports.createAppHostJsFile = createAppHostJsFile;
module.exports.validateSimHostPlugins = validateSimHostPlugins;
module.exports.getHostJsFile = getHostJsFile;
