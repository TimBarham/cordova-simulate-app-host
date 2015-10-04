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

var path = require('path'),
    config = require('./config');

var rootPath = path.resolve(__dirname, '..');

module.exports.root = rootPath;
module.exports.platforms = path.join(rootPath, 'platforms');
module.exports.plugins = path.join(rootPath, 'plugins');
module.exports.thirdParty = path.join(rootPath, 'third-party');

module.exports.modules = {
    'common': path.join(rootPath, 'modules'),
    'sim-host': path.join(rootPath, 'modules', 'sim-host')
};

module.exports.hostRoot = {
    'app-host':  path.join(rootPath, 'app-host')
};
Object.defineProperty(module.exports.hostRoot, 'sim-host', {
    get: function () {
        // Get dynamically so simHostOptions is initialized
        return config.simHostOptions.simHostRoot;
    }
});

Object.defineProperty(module.exports, 'node_modules', {
    get: function () {
        // Get dynamically so simHostOptions is initialized
        return [path.resolve(rootPath, '..', 'node_modules'), config.simHostOptions.node_modules];
    }
});
