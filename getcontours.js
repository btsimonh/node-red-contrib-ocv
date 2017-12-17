/**
 * Copyright 2017 Simon Hailes &Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/


module.exports = function(RED) {
    "use strict";
	
	var util = require('util');

	function getcontours(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'resize';
		node.toprocess = n.toprocess || '';
        node.releaseall = n.releaseall || false;
		node.releaseinput = n.releaseinput || false;
		// add any specific configurations here
		
		
		// context - add nod evariables here
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		var globalContext = this.context().global;
		node.api = globalContext.get("ocv-api");
		
		
        node.on('input', function (msg) {
			var toprocess = node.api.getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = node.api.getimage(node, msg, toprocess);

				try {
					var cnts = im.findContours(node.api.cv.RETR_EXTERNAL, node.api.cv.CHAIN_APPROX_SIMPLE);
				} catch (e){
					if (!node.haserrored){
						node.error("exception getting contours "+util.inspect(e));
						node.haserrored = true;
					}
					return;
				}

				// if asked to release our input, do so
				// if asked to release ALL frame data, do so
				// output data will be added afterwards
				if (node.releaseall){
					node.api.releaseall(node, msg);
				} else {
					if (node.releaseinput){
						node.api.releaseone(node, msg, toprocess);
					}
				}
				node.api.sendframe(node, cnts, msg);
			} else {
				// if asked to release ALL frame data, do so
				// output data will be added afterwards
				if (node.releaseall){
					node.api.releaseall(node, msg);
				}
			}
		});
	}
	
    RED.nodes.registerType("ocv-contours", getcontours);
	
}	
