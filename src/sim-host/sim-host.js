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

var db             = require('db'),
    Messages       = require('messages'),
    customElements = require('./custom-elements'),
    socket         = require('./socket'),
    cordova        = require('cordova');

var plugins;
var pluginHandlers = {};

customElements.initialize();
socket.initialize(pluginHandlers);

window.addEventListener('DOMContentLoaded', function () {
    sizeContent();

    // Initialize standard modules, then plugins
    db.initialize().then(initializePlugins);
});

window.addEventListener('resize', function () {
    sizeContent();
});

function sizeContent() {
    // Size the content area to keep column widths fixed
    var bodyWidth = parseInt(window.getComputedStyle(document.body).width);
    var contentWidth = (Math.floor((bodyWidth - 1) / 333) || 1) * 333;
    document.querySelector('.cordova-main').style.width = contentWidth + 'px';
}

var pluginMessages = {};
function applyPlugins(plugins, clobberScope) {
    Object.keys(plugins).forEach(function (pluginId) {
        var plugin = plugins[pluginId];
        if (plugin) {
            if (typeof plugin === 'function') {
                pluginMessages[pluginId] = pluginMessages[pluginId] || new Messages(pluginId, socket.socket);
                plugin = plugin(pluginMessages[pluginId]);
                plugins[pluginId] = plugin;
            }
            if (clobberScope) {
                clobber(plugin, clobberScope);
            }
        }
    });
}

function clobber(clobbers, scope) {
    Object.keys(clobbers).forEach(function (key) {
        if (clobbers[key] && typeof clobbers[key] === 'object') {
            scope[key] =  scope[key] || {};
            clobber(clobbers[key], scope[key]);
        } else {
            scope[key] = clobbers[key];
        }
    });
}

function initializePlugins() {
    plugins = {
        /** PLUGINS **/
    };

    var pluginHandlersDefinitions = {
        /** PLUGIN-HANDLERS **/
    };

    applyPlugins(plugins);
    applyPlugins(pluginHandlersDefinitions, pluginHandlers);

    // Hide and register dialogs
    Array.prototype.forEach.call(document.getElementById('popup-window').children, function (dialog) {
        cordova.pluginDialogs[dialog.id] = dialog;
        dialog.style.display = 'none';
    });

    Object.keys(plugins).forEach(function (pluginId) {
        try{
            plugins[pluginId].initialize && plugins[pluginId].initialize();
        } catch (e) {
            console.error('Error initializing plugin ' + pluginId);
            console.error(e);
        }
    });
}
