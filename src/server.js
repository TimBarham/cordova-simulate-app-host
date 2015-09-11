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
    path = require('path'),
    replaceStream = require('replacestream'),
    cordovaServe = require('cordova-serve'),
    Q = require('q'),
    plugins = require('./plugins'),
    prepare = require('./prepare'),
    simFiles = require('./sim-files'),
    log = require('./log');

var SIM_HOST_PANELS_HTML = 'sim-host-panels.html';
var SIM_HOST_DIALOGS_HTML = 'sim-host-dialogs.html';

function handleUrlPath(urlPath, request, response, do302, do404, serveFile) {
    serveFile(getFileToServe(urlPath));
}

function getFileToServe(urlPath) {
    var d = Q.defer();

    if (urlPath.indexOf('/node_modules/') === 0) {
        // Something in our node_modules...
        return path.resolve(__dirname, '..', urlPath.substr(1));
    }

    if (urlPath.indexOf('/simulator/') !== 0) {
        // Not a path we care about
        return null;
    }

    var splitPath = urlPath.split('/');

    // Remove the empty first element and 'simulator'
    splitPath.shift();
    splitPath.shift();

    if (splitPath[0] === 'app-host') {
        if (splitPath[1] === 'app-host.js') {
            var appHostJsFile = simFiles.getHostJsFile('APP-HOST');
            if (!appHostJsFile) {
                throw new Error('Path to app-host js file has not been set.');
            }
            return appHostJsFile;
        }
        return path.join(__dirname, splitPath.join('/'));
    }

    if (splitPath[0] === 'plugin') {
        // Remove 'plugin'
        splitPath.shift();

        var pluginId = splitPath.shift();
        var pluginPath = plugins.getPlugins()[pluginId];
        return pluginPath && path.join(pluginPath, splitPath.join('/'));
    }

    var filePath = splitPath.join('/');

    if (filePath === 'sim-host.js') {
        var simHostJsFile = simFiles.getHostJsFile('SIM-HOST');
        if (!simHostJsFile) {
            throw new Error('Path to sim-host js file has not been set.');
        }
        return simHostJsFile;
    }

    if (filePath === 'index.html') {
        // Allow 'index.html' as a synonym for 'sim-host.html'
        filePath = 'sim-host.html';
    }
    return path.join(__dirname, 'sim-host', filePath);
}

function streamFile(filePath, request, response) {
    if (request.url === '/simulator/index.html' || request.url === '/simulator/sim-host.html') {
        streamSimHostHtml(filePath, request, response);
        return true;
    }

    // Checking if request url ends with .html (5 is the length of '.html') or request url is '/'
    // to inject plugin simulation app-host <script> references into any html page inside the app
    if (request.url === '/' || request.url.indexOf('.html', request.url.length - 5) !== -1) {
        streamAppHostHtml(filePath, request, response);
        return true;
    }

    if (request.url === '/simulator/sim-host.css') {
        // If target browser isn't Chrome (user agent contains 'Chrome', but isn't 'Edge'), remove shadow dom stuff from
        // the CSS file.
        var userAgent = request.headers['user-agent'];
        var isChrome = userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edge/') === -1;
        if (!isChrome) {
            streamSimHostCss(filePath, request, response);
            return true;
        }
    }

    cordovaServe.sendStream(filePath, request, response, null, true);
    return true;
}

function streamAppHostHtml(filePath, request, response) {
    // Always prepare before serving up app HTML file, so app is up-to-date, then create the app-host.js (if it is
    // out-of-date) so it is ready when it is requested.
    prepare.prepare().then(function () {
        return simFiles.createAppHostJsFile();
    }).then(function (pluginList) {
        // Sim host will need to be refreshed if the plugin list has changed.
        simFiles.validateSimHostPlugins(pluginList);

        // Inject plugin simulation app-host <script> references into *.html
        log.log('Injecting app-host into ' + filePath);
        var scriptSources = [
            'https://cdn.socket.io/socket.io-1.2.0.js',
            '/simulator/app-host/app-host.js'
        ];
        var scriptTags = scriptSources.map(function (scriptSource) {
            return '<script src="' + scriptSource + '"></script>';
        }).join('');

        // Note we replace "default-src 'self'" with "default-src 'self' ws:" (in Content Security Policy) so that
        // websocket connections are allowed.
        cordovaServe.sendStream(filePath, request, response, fs.createReadStream(filePath)
            .pipe(replaceStream(/<\s*head\s*>/, '<head>' + scriptTags))
            .pipe(replaceStream('default-src \'self\'', 'default-src \'self\' ws: blob:')), true);
    });
}

function streamSimHostHtml(filePath, request, response) {
    // If we haven't ever prepared, do so before we try to generate sim-host, so we know our list of plugins is up-to-date.
    // Then create sim-host.js (if it is out-of-date) so it is ready when it is requested.
    prepare.waitOnPrepare().then(function () {
        return simFiles.createSimHostJsFile();
    }).then(function () {
        // Inject references to simulation HTML files
        var panelsHtmlBasename = SIM_HOST_PANELS_HTML;
        var dialogsHtmlBasename = SIM_HOST_DIALOGS_HTML;
        var panelsHtml = [];
        var dialogsHtml = [];

        var pluginList = plugins.getPlugins();

        Object.keys(pluginList).forEach(function (pluginId) {
            var pluginPath = pluginList[pluginId];
            if (pluginPath) {
                var panelsHtmlFile = path.join(pluginPath, panelsHtmlBasename);
                if (fs.existsSync(panelsHtmlFile)) {
                    panelsHtml.push(processPluginHtml(fs.readFileSync(panelsHtmlFile, 'utf8'), pluginId));
                }

                var dialogsHtmlFile = path.join(pluginPath, dialogsHtmlBasename);
                if (fs.existsSync(dialogsHtmlFile)) {
                    dialogsHtml.push(processPluginHtml(fs.readFileSync(dialogsHtmlFile, 'utf8'), pluginId));
                }
            }
        });
        cordovaServe.sendStream(filePath, request, response, fs.createReadStream(filePath)
            .pipe(replaceStream('<!-- PANELS -->', panelsHtml.join('\n')))
            .pipe(replaceStream('<!-- DIALOGS -->', dialogsHtml.join('\n'))), true);
    });
}

function processPluginHtml(html, pluginId) {
    return [/<script[^>]*src\s*=\s*"([^"]*)"[^>]*>/g, /<link[^>]*href\s*=\s*"([^"]*)"[^>]*>/g].reduce(function (result, regex) {
        // Ensures plugin path is prefixed to source of any script and link tags
        return result.replace(regex, function (match, p1) {
            return match.replace(p1, 'plugin/' + pluginId + '/' + p1.trim());
        });
    }, html).replace(/<!\-\-(.|\s)*?\-\->(\s)*/g, function () {
        // Remove comments
        return '';
    });
}

function streamSimHostCss(filePath, request, response) {
    // Replace '/deep/' combinator
    cordovaServe.sendStream(filePath, request, response, fs.createReadStream(filePath)
        .pipe(replaceStream('> ::content >', '>'))
        .pipe(replaceStream(/\^|\/shadow\/|\/shadow-deep\/|::shadow|\/deep\/|::content|>>>/g, ' ')), true);
}

module.exports = {
    handleUrlPath: handleUrlPath,
    streamFile: streamFile
};
