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

// This module manages the queuing of dialogs. The simulation host must register dialogs (by adding them to
// pluginDialogs) and handle the actual showing/hiding when requested (via hide() and show() methods attach to
// the registered dialog object).

var pluginDialogs = {};

var currentDialogId = null;
var dialogQueue = [];

module.exports.pluginDialogs = pluginDialogs;

function showDialog(dialogId, cb) {
    var dialog = pluginDialogs[dialogId];
    if (!dialog) {
        throw 'No dialog defined with id ' + dialogId;
    }

    // If a dialog is currently showing, queue this one to show later
    if (currentDialogId) {
        dialogQueue.push({id: dialogId, callback: cb});
        return;
    }

    // Notify callback we're about to show
    cb && cb('showing');

    currentDialogId = dialogId;

    dialog.show();

    // Notify callback we're shown
    cb && cb('shown');
}
module.exports.showDialog = showDialog;

function hideDialog(dialogId) {
    if (!dialogId) {
        dialogId = currentDialogId;
        if (!dialogId) {
            throw 'Trying to hide dialog when none is showing.';
        }
    } else {
        if (dialogId !== currentDialogId) {
            throw 'Trying to hide a dialog that isn\'t currently showing: ' + dialogId;
        }
    }

    var dialog = pluginDialogs[dialogId];
    if (!dialog) {
        throw 'No dialog defined with id ' + dialogId;
    }

    currentDialogId = null;
    dialog.hide();

    // After a timeout, see if there are more dialogs to show
    window.setTimeout(function () {
        if (currentDialogId) {
            return;
        }

        var dialogInfo = findNextDialog();
        if (dialogInfo) {
            showDialog(dialogInfo.id, dialogInfo.callback);
        }
    }, 0);
}
module.exports.hideDialog = hideDialog;

function findNextDialog() {
    while (dialogQueue.length) {
        var dialogInfo = dialogQueue.shift();
        var cb = dialogInfo.callback;
        // If there's a callback, it must explicitly return 'false' (not a falsy value) in response to 'query-show' to
        // prevent the dialog from showing.
        if (!cb || cb('query-show') !== false) {
            return dialogInfo;
        }
    }
    return null;
}
