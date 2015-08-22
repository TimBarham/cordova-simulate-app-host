/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

var MediaError = window.MediaError;

if (!MediaError) {
    window.MediaError = MediaError = function () {
        throw new TypeError('Illegal constructor');
    };
}

MediaError.MEDIA_ERR_NONE_ACTIVE = MediaError.MEDIA_ERR_NONE_ACTIVE || 0;
MediaError.MEDIA_ERR_ABORTED = MediaError.MEDIA_ERR_ABORTED || 1;
MediaError.MEDIA_ERR_NETWORK = MediaError.MEDIA_ERR_NETWORK || 2;
MediaError.MEDIA_ERR_DECODE = MediaError.MEDIA_ERR_DECODE || 3;
MediaError.MEDIA_ERR_NONE_SUPPORTED = MediaError.MEDIA_ERR_NONE_SUPPORTED || 4;
// TODO: MediaError.MEDIA_ERR_NONE_SUPPORTED is legacy, the W3 spec now defines it as below.
// as defined by http://dev.w3.org/html5/spec-author-view/video.html#error-codes
MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED = MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || 4;

module.exports = MediaError;
