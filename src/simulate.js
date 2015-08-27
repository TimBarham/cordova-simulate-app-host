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

var Q = require('q'),
    fs = require('fs'),
    exec = require('child_process').exec,
    cordovaServe = require('cordova-serve'),
    path = require('path'),
    log = require('./log'),
    simServer = require('./server'),
    plugins = require('./plugins'),
    simFiles = require('./sim-files');

module.exports = function (args) {
    var server,
        appUrl,
        simHostUrl;

    args = processArgs(args);
    var platform = args.platform;
    var target = args.target;

    return cordovaServe.servePlatform(platform, {
        noServerInfo: true,
        urlPathHandler: simServer.handleUrlPath,
        streamHandler: simServer.streamFile,
        serverExtender: simServer.init
    }).then(function (serverInfo) {
        server = serverInfo.server;
        var projectRoot = serverInfo.projectRoot;
        simFiles.initialize(projectRoot);
        var urlRoot = 'http://localhost:' + serverInfo.port + '/';
        appUrl = urlRoot +  parseStartPage(projectRoot);
        simHostUrl = urlRoot + 'simulator/index.html';
        log.log('Server started:\n- App running at: ' + appUrl + '\n- Sim host running at: ' + simHostUrl);
        return plugins.initPlugins(platform, projectRoot, serverInfo.platformRoot);
    }).then(function () {
        return cordovaServe.launchBrowser({target: target, url: appUrl});
    }).then(function () {
        return cordovaServe.launchBrowser({target: target, url: simHostUrl});
    }).catch(function (error) {
        // Ideally cordova-serve should provide a method to stop the server, but for now it doesn't.
        server && server.close();
        log.error(error.stack || error.toString());
    });
};

function parseStartPage(projectRoot) {
    // Start Page is defined as <content src="some_uri" /> in config.xml

    var configFile = path.join(projectRoot, 'config.xml');
    if (!fs.existsSync(configFile)) {
        throw new Error('Cannot find project config file: ' + configFile);
    }

    var startPageRegexp = /<content\s+src\s*=\s*"(.+)"\s*\/>/ig,
        configFileContent = fs.readFileSync(configFile);

    var match = startPageRegexp.exec(configFileContent);
    if (match) {
        return match[1];
    }

    return 'index.html'; // default uri
}

function processArgs(args) {
    var platform = null;
    var target = null;

    args.shift(); // Remove 'node'
    args.shift(); // Remove 'simulate'

    args.forEach(function (arg) {
        arg = arg.toLowerCase();
        if (arg.indexOf('--target=') === 0) {
            if (target) {
                throw new Error('Target defined more than once');
            }
            target = arg.substring(9);
        } else {
            if (platform) {
                throw new Error('Too many arguments');
            }
            platform = arg;
        }
    });

    return {
        platform: platform || 'browser',
        target: target || 'chrome'
    };
}
