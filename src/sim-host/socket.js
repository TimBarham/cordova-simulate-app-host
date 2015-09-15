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

var cordova = require('cordova');

var socket;

module.exports.initialize = function (pluginHandlers) {
    socket = io();
    module.exports.socket = socket;

    socket.emit('register-simulation-host');
    socket.on('exec', function (data) {
        if (!data) {
            throw 'Exec called on simulation host without exec info';
        }

        var index = data.index;
        if (typeof index !== 'number') {
            throw 'Exec called on simulation host without an index specified';
        }

        var success = getSuccess(index);
        var failure = getFailure(index);

        var service = data.service;
        if (!service) {
            throw 'Exec called on simulation host without a service specified';
        }

        var action = data.action;
        if (!action) {
            throw 'Exec called on simulation host without an action specified';
        }

        console.log('Exec ' + service + '.' + action + ' (index: ' + index + ')');

        var handler = pluginHandlers[service] && pluginHandlers[service][action];
        if (!handler) {
            handler = pluginHandlers['*']['*'];
            handler(success, failure, service, action, data.args);
        } else {
            handler(success, failure, data.args);
        }
    });

    socket.on('refresh', function () {
        document.location.reload(true);
    });
};

function getSuccess(index) {
    return function (result) {
        console.log('Success callback for index: ' + index + '; result: ' + result);
        var data = {index: index, result: result};
        socket.emit('exec-success', data);
    };
}

function getFailure(index) {
    return function (error) {
        console.log('Failure callback for index: ' + index + '; error: ' + error);
        var data = {index: index, error: error};
        socket.emit('exec-failure', data);
    };
}
