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

var PLUGIN_SIMULATION_FILES = {
    'SIM-HOST': {
        'PANELS': 'sim-host-panels.html',
        'DIALOGS': 'sim-host-dialogs.html',
        'JS': 'sim-host.js',
        'HANDLERS': 'sim-host-handlers.js'
    },
    'APP-HOST': {
        'JS': 'app-host.js',
        'HANDLERS': 'app-host-handlers.js',
        'CLOBBERS': 'app-host-clobbers.js'
    }
};

var simulationFilePath;
var hostJsFiles = [];

function initialize(projectRoot) {
    simulationFilePath = path.join(projectRoot, 'simulation');
    if (!fs.existsSync(simulationFilePath)) {
        fs.mkdirSync(simulationFilePath);
    }
}

function createSimHostJsFile(pluginsChanged) {
    return createHostJsFile('SIM-HOST', ['JS', 'HANDLERS'], pluginsChanged);
}

function createAppHostJsFile(pluginsChanged) {
    return createHostJsFile('APP-HOST', ['JS', 'HANDLERS', 'CLOBBERS'], pluginsChanged);
}

function createHostJsFile(hostType, scriptTypes, pluginsChanged) {
    if (!simulationFilePath) {
        throw new Error('SimFiles.initialize() must be called before creating sim JS files.');
    }

    var d = Q.defer();

    var hostBaseName = hostType.toLowerCase();
    var outputFile = path.join(simulationFilePath, hostBaseName + '.js');
    hostJsFiles[hostType] = outputFile;
    var jsonFile = path.join(simulationFilePath, hostBaseName + '.json');

    // See if we already have created our output file, and it is up-to-date with all its dependencies. However, if the
    // list of plugins has changed, or the directory where a plugin's simulation definition lives has changed, we need
    // to force a refresh.
    var fileInfo = {};
    if (!pluginsChanged && fs.existsSync(outputFile) && fs.existsSync(jsonFile)) {
        var upToDate = true;
        fileInfo = require(jsonFile);
        for (var file in fileInfo) {
            if (!fs.existsSync(file) || fileInfo[file] !== new Date(fs.statSync(file).mtime).getTime()) {
                upToDate = false;
                break;
            }
        }
        if (upToDate) {
            log.log('Creating ' + hostBaseName + '.js: Existing file found and is up-to-date.');
            d.resolve();
            return d.promise;
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
    var pluginList = plugins.getPlugins();
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

    fileInfo = {};
    b.on('file', function (file) {
        fileInfo[file] = new Date(fs.statSync(file).mtime).getTime();
    });

    var outputFileStream = fs.createWriteStream(outputFile);

    outputFileStream.on('finish', function () {
        fs.writeFileSync(jsonFile, JSON.stringify(fileInfo));
        d.resolve(pluginsChanged);
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
            fileName: PLUGIN_SIMULATION_FILES[hostType][scriptType],
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

module.exports.initialize = initialize;
module.exports.createSimHostJsFile = createSimHostJsFile;
module.exports.createAppHostJsFile = createAppHostJsFile;

module.exports.getPluginSimulationFiles = function () {
    return PLUGIN_SIMULATION_FILES;
};
module.exports.getSimulationFilePath = function () {
    if (!simulationFilePath) {
        throw new Error('SimFiles.initialize() must be called before requesting simulationFilePath.');
    }
    return simulationFilePath;
};
module.exports.getHostJsFile = function (hostType) {
    return hostJsFiles[hostType];
};
