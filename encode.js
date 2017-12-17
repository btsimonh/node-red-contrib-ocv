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



	function encode(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'encode';
		node.toprocess = n.toprocess || '';
        node.releaseall = n.releaseall || false;
		node.releaseinput = n.releaseinput || false;
		// add any specific configurations here
		
		
		// context - add nod evariables here
		// controls action of async callback
		node.enabled = true;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		var globalContext = this.context().global;
		node.api = globalContext.get("ocv-api");
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = node.api.getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = node.api.getimage(node, msg, toprocess);
				im.toBuffer(function(err, data){
					if (err) {
						node.warn("encode jpeg err " + util.inspect(err) + " "+util.inspect(img));
						return;
					}
					node.api.sendframe(node, data, msg);
				});

				// if asked to release our input, do so
				if (node.releaseinput){
					node.api.releaseone(node, msg, toprocess);
				}
			}

			// if asked to release ALL frame data, do so
			// output data will be added afterwards
			if (node.releaseall){
				node.api.releaseall(node, msg);
			}
			
		});
	}

    RED.nodes.registerType("ocv-encode", encode);


	
	
}	
