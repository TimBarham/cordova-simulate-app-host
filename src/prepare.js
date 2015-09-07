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

var preparedSinceLastServe;
var preparing;

function prepare() {
    var d = Q.defer();

    if (preparing) {
        preparing.push(d);
        return d.promise;
    }

    preparing = [d];
    var platform = config.platform;

    log.log('Preparing platform \'' + platform + '\'.');
    exec('cordova prepare ' + platform, function (err, stdout, stderr) {
        if (err) {
            preparing.forEach(function (d) {
                d.reject(stderr || err);
            });
            preparing = null;
        } else {
            log.log('Finished preparing platform \'' + platform + '\'.');
            preparedSinceLastServe = true;
            plugins.initPlugins();
            preparing.forEach(function (d) {
                d.resolve();
            });
            preparing = null;
        }
    });

    return d.promise;
}

function prepareIfRequired() {
    return preparedSinceLastServe? Q() : prepare();
}

module.exports.prepare = prepare;
module.exports.prepareIfRequired = prepareIfRequired;
