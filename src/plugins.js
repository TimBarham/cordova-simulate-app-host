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

var fs = require('fs'),
    path = require('path'),
    config = require('./config');

var pluginSimulationFiles = require('./plugin-files');

var plugins = {};

function initPlugins() {
    // Always defined plugins
    var pluginList = ['exec', 'events'];

    var pluginPath = path.resolve(config.platformRoot, 'plugins');
    if (fs.existsSync(pluginPath)) {
        fs.readdirSync(pluginPath).forEach(function (file) {
            if (fs.statSync(path.join(pluginPath, file)).isDirectory()) {
                pluginList.push(file);
            }
        });
    }

    if (pluginList.indexOf('cordova-plugin-geolocation') === -1) {
        pluginList.push('cordova-plugin-geolocation');
    }

    var projectRoot = config.projectRoot;


    plugins = {};
    pluginList.forEach(function (pluginId) {
        var pluginFilePath = findPluginPath(projectRoot, pluginId);
        if (pluginFilePath) {
            plugins[pluginId] = pluginFilePath;
        }
    });

    addPlatformDefaultHandlers();

    // Check if the plugin list has changed
    //return refreshCache(path.join(simFiles.getSimulationFilePath(), 'plugins.json'), plugins);
}

/**
 * Adds platform specific exec handlers and ui components to the main plugins list so
 * that they are injected to simulation host along with standard plugins
 */
function addPlatformDefaultHandlers() {
    var platform = config.platform;
    var platformScriptsRoot = path.join(__dirname, 'platforms', platform);
    if (fs.existsSync(platformScriptsRoot)) {
        var pluginId = platform + '-platform-core';
        plugins[pluginId] = platformScriptsRoot;
    }
}

function findPluginPath(projectRoot, pluginId, hostType) {
    if (!hostType) {
        return findPluginPath(projectRoot, pluginId, 'SIM-HOST') || findPluginPath(projectRoot, pluginId, 'APP-HOST');
    }
    for (var file in pluginSimulationFiles[hostType]) {
        var pluginFilePath = findPluginSourceFilePath(projectRoot, pluginId, pluginSimulationFiles[hostType][file]);
        if (pluginFilePath) {
            return pluginFilePath;
        }
    }
}

function findPluginSourceFilePath(projectRoot, pluginId, file) {
    var pluginPath = path.join(projectRoot, 'plugins', pluginId, 'src/simulation');
    var pluginFilePath = path.resolve(pluginPath, file);

    if (fs.existsSync(pluginFilePath)) {
        return pluginPath;
    }

    pluginPath = path.join(__dirname, 'plugins', pluginId);
    pluginFilePath = path.join(pluginPath, file);
    if (fs.existsSync(pluginFilePath)) {
        return pluginPath;
    }

    return null;
}

function refreshCache(cacheFile, arr) {
    var pluginListChanged = false;
    if (fs.existsSync(cacheFile)) {
        var cachedArray = require(cacheFile);

        if (!compareObjects(arr, cachedArray)) {
            pluginListChanged = true;
        }
    } else {
        pluginListChanged = true
    }

    if (pluginListChanged) {
        fs.writeFileSync(cacheFile, JSON.stringify(arr));
        return true;
    }

    return false;
}

function compareObjects(a1, a2) {
    if (Array.isArray(a1)) {
        if (!Array.isArray(a2)) {
            return false;
        }
        // Simple array comparison - expects same order and only scalar values
        return a1.length === a2.length && a1.every(function (v, i) {
                return v === a2[i]
            });
    }

    var keys1 = Object.keys(a1);
    var keys2 = Object.keys(a2);

    return compareObjects(keys1, keys2) &&
        compareObjects(keys1.map(function (key) {
            return a1[key];
        }), keys2.map(function (key) {
            return a2[key];
        }));
}

module.exports.initPlugins = initPlugins;
module.exports.getPlugins = function () {
    return plugins
};
