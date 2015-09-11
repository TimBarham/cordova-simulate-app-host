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

var log = require('./log');

var appHost = 'APP-HOST';
var simHost = 'SIM-HOST';

var hostSockets = {};
var pendingEmits = {};
pendingEmits[appHost] = [];
pendingEmits[simHost] = [];

function init(server) {
    var io = require('socket.io')(server);

    io.on('connection', function (socket) {
        socket.on('register-app-host', function () {
            log.log('App-host registered with server.');

            // It only makes sense to have one app host per server. If more than one tries to connect, always take the
            // most recent.
            hostSockets[appHost] = socket;

            socket.on('exec', function (data) {
                emitToHost(simHost, 'exec', data);
            });

            socket.on('plugin-message', function (data) {
                emitToHost(simHost, 'plugin-message', data);
            });

            socket.on('plugin-method', function (data, callback) {
                emitToHost(simHost, 'plugin-method', data, callback);
            });

            handlePendingEmits(appHost);
        });

        socket.on('register-simulation-host', function () {
            log.log('Simulation host registered with server.');

            // It only makes sense to have one simulation host per server. If more than one tries to connect, always
            // take the most recent.
            hostSockets[simHost] = socket;

            socket.on('exec-success', function (data) {
                emitToHost(appHost, 'exec-success', data);
            });
            socket.on('exec-failure', function (data) {
                emitToHost(appHost, 'exec-failure', data);
            });

            socket.on('plugin-message', function (data) {
                emitToHost(appHost, 'plugin-message', data);
            });

            socket.on('plugin-method', function (data, callback) {
                emitToHost(appHost, 'plugin-method', data, callback);
            });

            handlePendingEmits(simHost);
        });
    });
}

function handlePendingEmits(host) {
    pendingEmits[host].forEach(function (pendingEmit) {
        log.log('Handling pending emit \'' + pendingEmit.msg + '\' to ' + host.toLowerCase());
        emitToHost(host, pendingEmit.msg, pendingEmit.data, pendingEmit.callback);
    });
    pendingEmits[host] = [];
}

function emitToHost(host, msg, data, callback) {
    var socket = hostSockets[host];
    if (socket) {
        log.log('Emitting \'' + msg + '\' to ' + host.toLowerCase());
        socket.emit(msg, data, callback);
    } else {
        log.log('Emitting \'' + msg + '\' to ' + host.toLowerCase() + ' (pending connection)');
        pendingEmits[host].push({msg: msg, data: data, callback: callback});
    }
}

function invalidateSimHost() {
    // Simulation host is being refreshed, so we'll wait on a new connection.
    hostSockets[simHost] = null;
}

module.exports.init = init;
module.exports.emitToHost = emitToHost;
module.exports.invalidateSimHost = invalidateSimHost;
