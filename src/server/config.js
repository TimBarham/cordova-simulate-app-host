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
    path = require('path');

var config = {};
var simulationFilePath;

Object.defineProperties(module.exports, {
    platform: {
        get: function () {
            return getValue('platform');
        },
        set: function (value) {
            setValue('platform', value);
        }
    },
    projectRoot: {
        get: function () {
            return getValue('projectRoot');
        },
        set: function (value) {
            setValue('projectRoot', value, true)
        }
    },
    platformRoot: {
        get: function () {
            return getValue('platformRoot');
        },
        set: function (value) {
            setValue('platformRoot', value);
        }
    },
    server: {
        get: function () {
            return getValue('server');
        },
        set: function (value) {
            setValue('server', value);
        }
    },
    simHostOptions: {
        get: function () {
            return getValue('simHostOptions');
        },
        set: function (value) {
            setValue('simHostOptions', value);
        }
    },
    simulationFilePath: {
        get: function () {
            if (!simulationFilePath) {
                var projectRoot = getValue('projectRoot');
                simulationFilePath = path.join(projectRoot, 'simulation');
                if (!fs.existsSync(simulationFilePath)) {
                    fs.mkdirSync(simulationFilePath);
                }
            }
            return simulationFilePath;
        }
    }
});

function setValue(prop, value, single) {
    if (single && config[prop]) {
        throw new Error('Can\'t reinitialize ' + prop);
    }
    config[prop] = value;
}

function getValue(prop) {
    if (!config[prop]) {
        throw new Error('Cannot get ' + prop + ' as it has not been initialized.');
    }
    return config[prop];
}
