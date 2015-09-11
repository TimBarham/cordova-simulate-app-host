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

var exec = require('child_process').exec,
    Q = require('q'),
    config = require('./config'),
    log = require('./log'),
    plugins = require('./plugins');

var preparedOnce;
var preparePromise;
var lastPlatform;

function prepare() {
    if (!preparePromise) {
        var d = Q.defer();
        preparePromise = d.promise;

        var platform = config.platform;
        log.log('Preparing platform \'' + platform + '\'.');

        lastPlatform = platform;

        exec('cordova prepare ' + platform, function (err, stdout, stderr) {
            lastPlatform = null;
            preparePromise = null;
            if (err) {
                d.reject(stderr || err);
            } else {
                preparedOnce = true;
                plugins.initPlugins();
                d.resolve();
            }
        });
    } else {
        if (config.platform !== lastPlatform) {
            // Sanity check to verify we never queue prepares for different platforms
            throw new Error('Unexpected request to prepare \'' + config.platform + '\' while prepare of \'' + lastPlatform + '\' still pending.');
        }
    }

    return preparePromise;
}

function waitOnPrepare() {
    // Caller doesn't want to continue until we've prepared at least once. If we already have, return immediately,
    // otherwise launch a prepare.
    return preparedOnce ? Q.when() : prepare();
}

module.exports.prepare = prepare;
module.exports.waitOnPrepare = waitOnPrepare;
