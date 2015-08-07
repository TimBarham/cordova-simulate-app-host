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

# Cordova-simulate Release Notes

### 0.1.2 (Aug 5, 2015)
* Readme updates (including corrected install instructions) ([75159a1](https://github.com/TimBarham/cordova-simulate/commit/75159a15cf1c2e3a2be77e87201aea080e840e08)).
* Fix for error when cordova is installed locally to the app ([117fb42](https://github.com/TimBarham/cordova-simulate/commit/117fb42685ab1df9ab4ea11e69097dbc05e18016)).
* Added `RELEASENOTES.md` ([cf99271](https://github.com/TimBarham/cordova-simulate/commit/cf99271f2720e3edd2b632291fff26d2dc148577)).

### 0.1.1 (Aug 4, 2015)
* Updated styling.
* Added `Events` panel.
* Added `Geolocation` panel.
* Fixed security issue that blocked web socket connections with newer Cordova apps.
* Support for 'clobber' functionality in app host (allow plugins to clobber built in JavaScript objects).
* Added `Accelerometer` panel (device motion plugin).
* Now prepares target platform on launch (but not yet on refresh).
* Adds `Unhandled Exec Call` dialog and `Persisted Exec Responses` panel.
* Supports `Globalization` API.


### 0.1.0 (May 24, 2015)
* Initial release with basic functionality