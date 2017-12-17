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

	function videoin(n){
        RED.nodes.createNode(this, n);
        var node = this;

		// configurations
		node.name = n.name || 'videoin';
        node.video = n.video || 0;
		node.FPS = n.FPS || 25;
		
		// node context
		node.framenumber = 0;
		node.vid = null;
		node.timer = null;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;

		var globalContext = this.context().global;
		node.api = globalContext.get("ocv-api");
		
		node.fnframe = function(err, img){
			if (err) {
				node.warn("read " + util.inspect(err) + " "+util.inspect(img));
				return;
			}

			if (!img){
				node.warn("image invalid"+util.inspect(img));
				return;    
			}

			if ((img.size()[0] === 0) && (img.size()[1] === 0)){
				node.warn("image has zero width or height");
				return;    
			}
			
			// only reset timer if it's not been cleared
			if (node.timer){
				node.timer = setTimeout(node.fntimer, 10);
			}

			// because we don;t supply an existing msg, this will create a new frame using node.framenumber++.
			node.api.sendframe(node, img);
		};

		node.fntimer = function(){
			var vid = node.vid;
			if (vid){
				vid.read(node.fnframe);
			}
		};

		// if closing, ensure video is closed
		node.on('close', function(){
			var vid = node.vid;
			if (vid){
				// stop
				vid.release();
				node.vid = null;
			}
			if (node.timer){
				clearTimeout(node.timer);
				node.timer = null;
			}
		});
		
        node.on('input', function (msg) {

			// if a cmd msg, then just pass on now, and don;t do anything further.
			if (msg.cmd){
				node.send(msg);
				return;
			}


			switch (msg.payload){
				case 0:
				case false:
				case 'stop':
					// in case we never hit if(stop), delete in 200ms
					// else can't open camera ever again. 
					var vid = node.vid;
					if (vid){
						// stop
						vid.release();
						node.vid = null;
					}
					if (node.timer){
						clearTimeout(node.timer);
						node.timer = null;
					}
					node.warn("stopped video read");
					break;
				case 1:
				case true:
				case 'start':
					try {
						var vid = node.vid;
						if (vid){
							// stop
							vid.release();
							node.vid = null;
						}
						if (node.timer){
							clearTimeout(node.timer);
							node.timer = null;
						}
						vid = new node.api.cv.VideoCapture(0);
						var fps = vid.setFPS(node.FPS);
						//node.warn(fps);
						//node.warn(vid);
						node.vid = vid;
						node.framenumber = 0;
						node.timer = setTimeout(node.fntimer, 10);
						node.warn("starting video read");
						var newmsg = {
							cmd:'reset'
						};
						node.send(newmsg);
					} catch (e){
						node.warn(e);
					}
					break;
			}
			
		});
	}

    RED.nodes.registerType("ocv-videoin",videoin);
	
}	
