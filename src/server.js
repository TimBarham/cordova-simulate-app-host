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
    cordovaServe = require('cordova-serve'),
    path = require('path'),
    config = require('./server/config'),
    log = require('./server/log'),
    simServer = require('./server/server'),
    simSocket = require('./server/socket'),
    plugins = require('./server/plugins');

var server = cordovaServe();

module.exports = function (opts, simHostOpts) {
    var appUrl,
        simHostUrl;

    opts = opts || {};

    var platform = opts.platform || 'browser';
    var target = opts.target || 'chrome';

    config.platform = platform;
    config.simHostOptions = simHostOpts || {};

    simServer.attach(server.app);

    return server.servePlatform(platform, {
        port: opts.port,
        root: opts.dir,
        noServerInfo: true
    }).then(function () {
        simSocket.init(server.server);
        config.server = server.server;
        var projectRoot = server.projectRoot;
        config.projectRoot = projectRoot;
        config.platformRoot = server.root;
        var urlRoot = 'http://localhost:' + server.port + '/';
        appUrl = urlRoot +  parseStartPage(projectRoot);
        simHostUrl = urlRoot + 'simulator/index.html';
        log.log('Server started:\n- App running at: ' + appUrl + '\n- Sim host running at: ' + simHostUrl);
    }).then(function () {
        return cordovaServe.launchBrowser({target: target, url: appUrl});
    }).then(function () {
        return cordovaServe.launchBrowser({target: target, url: simHostUrl});
    }).catch(function (error) {
        log.error(error);
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

module.exports.dirs = require('./server/dirs');
module.exports.app = server.app;
