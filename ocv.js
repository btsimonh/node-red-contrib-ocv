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
    var cv = require("opencv");

	function videoin(n){
        RED.nodes.createNode(this, n);
        this.name = n.name || 'videoin';
		this.framenumber = 0;
		this.vid = null;
		this.timer = null;
		this.FPS = n.FPS || 25;

        var node = this;
		
		this.fnframe = function(err, img){
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

			var framenumber = node.framenumber++;

			var frame = {
				time:(new Date()).valueOf(),
				number:framenumber,
				data:{}
			};

			frame.data[node.name] = img;

			var newmsg = {
				payload:{
					name: node.name,
					frame:frame
				}
			}; 

			// only reset timer if it's not been cleared
			if (node.timer){
				node.timer = setTimeout(node.fntimer, 10);
			}

			node.send(newmsg);
		};

		this.fntimer = function(){
			var vid = node.vid;
			if (vid){
				vid.read(node.fnframe);
			}
		};

		
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
						vid = new cv.VideoCapture(0);
						var fps = vid.setFPS(node.FPS);
						//node.warn(fps);
						//node.warn(vid);
						node.vid = vid;
						node.framenumber = 0;
						node.timer = setTimeout(node.fntimer, 10);
						node.warn("starting vid");
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
	

	
	function resize(n){
        RED.nodes.createNode(this, n);
        this.name = n.name || 'resize';
		this.toprocess = n.toprocess || '';
        this.releaseall = n.releaseall || false;
		this.releaseinput = n.releaseinput || false;
		this.width = n.width || 640;
		this.height = n.height || 480;
	
        var node = this;
        node.on('input', function (msg) {
			//node.warn("releaseall: "+node.releaseall+" releaseinput:"+node.releaseinput);
			// if a cmd msg, then just pass on now, and don;t do anything further.
			if (msg.cmd){
				node.send(msg);
				return;
			}
			var toprocess = node.toprocess;

			if ((toprocess === '') && (msg.payload.name)){
				toprocess = msg.payload.name
			}

			if (toprocess === ''){
				node.warn("no toprocess");
				return;
			}


			var f = null;

			if (!msg.payload.frame){
				node.warn("no frame");
				return;
			}
			if (!msg.payload.frame.data){
				node.warn("no frame data");
				return;
			}

			if (msg.payload.frame.data[toprocess]){
				f = msg.payload.frame;
				//node.warn("resize process "+toprocess);
				//node.warn(msg.payload.frame);
				
				var im = msg.payload.frame.data[toprocess];
				
				im.resize(node.width,  node.height, function(err, img){
					if (err) {
						node.warn("resize err " + util.inspect(err) + " "+util.inspect(img));
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

					var frame = f;

					//node.warn(frame);
					frame.data[node.name] = img;
					//node.warn(frame);

					var newmsg = {
						payload:{
							name: node.name,
							frame:frame
						}
					}; 

					node.send(newmsg);
				});
				if (node.releaseinput){
					//node.warn("resize release input:" + toprocess);
					msg.payload.frame.data[toprocess].release();
					delete msg.payload.frame[toprocess];
				}
			} else {
				node.warn("toprocess "+toprocess+" not found in frame");
			}

			if (node.releaseall){
				//node.warn("resize release all");
				var f = msg.payload.frame;
				var keys = Object.keys(f.data);
				for (var i = keys.length-1; i >= 0; i--){
					if (f.data[keys[i]].hasOwnProperty('release')){
						f.data[keys[i]].release();
					}
					delete f.data[keys[i]];
				}
			}
			
		});
	}
	
    RED.nodes.registerType("ocv-resize", resize);
	
	
	
};
