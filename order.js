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

	function order(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'encode';
		
		// context - add nod evariables here
		// controls action of async callback
		node.enabled = true;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		var globalContext = this.context().global;
		node.api = globalContext.get("ocv-api");
		
		node.frames = [];
		node.frameout = 0;
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
			// empty frames, releasing any images
			for (var i = 0; i < node.frames.length; i++){
				var f = node.frames[i];
				if (f.data){
					var keys = Object.keys(f.data);
					for (var j = keys.length-1; j >= 0; j--){
						if (f.data[keys[j]].hasOwnProperty('release')){
							f.data[keys[j]].release();
						}
						delete f.data[keys[j]];
					}
				}
			}

			node.frames = [];
			node.frameout = 0;
		});
		
        node.on('input', function (msg) {

			switch (msg.cmd){
				case 'reset':
					// empty frames, releasing any images
					for (var i = 0; i < node.frames.length; i++){
						var f = node.frames[i];
						if (f.data){
							var keys = Object.keys(f.data);
							for (var j = keys.length-1; j >= 0; j--){
								if (f.data[keys[j]].hasOwnProperty('release')){
									f.data[keys[j]].release();
								}
								delete f.data[keys[j]];
							}
						}
					}

					node.frames = [];
					node.frameout = 0;
					break;
			}
			if (msg.cmd){
				return msg;
			}

			if (!msg.payload.frame){
				node.warn("no frame");
				return msg;
			}


			// add the new frame in order
			var frames = [];
			var pushed = false;
			for (var i = 0; i < node.frames.length; i++){
				if ((msg.payload.frame.number < node.frames[i].number) && !pushed){
					frames.push(msg.payload.frame);
					pushed = true;
				}
				frames.push(node.frames[i]);
			}
			if (!pushed){
				frames.push(msg.payload.frame);
			}

			node.frames = frames;

			//console.log(node.frames);

			node.framein = msg.payload.frame.number;

			while ((node.frames.length) && (node.frameout === node.frames[0].number)){
				var f = node.frames.shift();
				var newmsg = {
					payload:{
						frame:f
					}
				};

				if (msg.payload.name){
					newmsg.payload.name = msg.payload.name;
				}

				node.frameout++;

				//console.log("send");
				node.send(newmsg);
			}
			
		});
	}

    RED.nodes.registerType("ocv-order", order);
	
}	
