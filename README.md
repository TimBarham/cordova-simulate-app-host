<!--
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
-->

A browser based plugin simulation tool to aid development and testing of Cordova applications.

*Note that this is currently a work in progress / prototype! It still lacks a bunch of functionality, and may be quite buggy.*

It is somewhat based on [Apache Ripple&trade;](http://ripple.incubator.apache.org/), but aims to improve it in the following ways:

1. Separates the simulation UI from the app (to improve the debugging experience, and allow for using modern browser developer tools). This also protects the UI from a misbehaving app.
2. Allows plugins to define their own simulation UI.

# Installation

```
npm install -g cordova-simulate
```


# Usage

## CLI
From the command line anywhere within a Cordova project, enter the following:

```
simulate [<platform>] [--target=<browser>] 
```

Where:

* **platform** is any Cordova platform that has been added to your project. Defaults to `browser`.
* **browser** is the name of the browser to launch your app in. Can be any of the following: `chrome`, `chromium`, `edge`, `firefox`, `ie`, `opera`, `safari`. Defaults to `chrome`. 

## API
You can also `require('cordova-simulate')` and launch a simulation via the API:

```JavaScript
var simulate = require('cordova-simulate');
simulate(opts);
```

Where opts is an object with the following properties (all optional):

* **platform** - any Cordova platform that has been added to your project. Defaults to `browser`.
* **target** - the name of the browser to launch your app in. Can be any of the following: `chrome`, `chromium`, `edge`, `firefox`, `ie`, `opera`, `safari`. Defaults to `chrome`.
* **port** - the desired port for the server to use. Defaults to `8000`.
* **dir** - the directory to launch from (where it should look for a Cordova project). Defaults to cwd.


# What it does

Cordova simulate will launch your app in the browser, and open a second browser window displaying UI that allows you to control how plugins in your application work.

This preview version currently includes built-in support for the following Cordova plugins:

* [cordova-plugin-camera](https://github.com/apache/cordova-plugin-camera)
* [cordova-plugin-console](https://github.com/apache/cordova-plugin-console)
* [cordova-plugin-contacts](https://github.com/apache/cordova-plugin-contacts)
* [cordova-plugin-device](https://github.com/apache/cordova-plugin-device)
* [cordova-plugin-device-motion](https://github.com/apache/cordova-plugin-device-motion)
* [cordova-plugin-dialogs](https://github.com/apache/cordova-plugin-dialogs)
* [cordova-plugin-geolocation](https://github.com/apache/cordova-plugin-geolocation)
* [cordova-plugin-globalization](https://github.com/apache/cordova-plugin-globalization)
* [cordova-plugin-media](https://github.com/apache/cordova-plugin-media)
* [cordova-plugin-vibration](https://github.com/apache/cordova-plugin-vibration)

It also allows for plugins to define their own UI. To add simulation support to a plugin, follow these steps:

1. Clone the `cordova-simulate` git repository (`git clone https://github.com/TimBarham/cordova-simulate.git`), as it contains useful example code (see `src/plugins`).
2. Add your plugin UI code to your plugin in `src/simulation`. Follow the file naming conventions seen in the built-in plugins.
