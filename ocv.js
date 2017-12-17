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


	var api = require('./api.js');
	var util = require('util');

	//console.log(util.inspect(api));
	
	//////////////////////////////////////////////////////
	// expose out API in global as ocv-api
	//////////////////////////////////////////////////////
	function ocv_global(n){
        RED.nodes.createNode(this, n);

		// configurations
		this.name = n.name || 'ocv-global';
        var node = this;
		
		// expose node-opencv as global 'ocv'
		var globalContext = this.context().global;
		globalContext.set("ocv-api", api);		
	}
    RED.nodes.registerType("ocv-global",ocv_global);



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

		node.api = api;
		
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
	

	
	function resize(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'resize';
		node.toprocess = n.toprocess || '';
        node.width = n.width || 640;
        node.height = n.height || 480;
        node.releaseall = n.releaseall || false;
		node.releaseinput = n.releaseinput || false;
		// add any specific configurations here
		
		
		// context - add nod evariables here
		// controls action of async callback
		node.enabled = true;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		node.api = api;
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = node.api.getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = node.api.getimage(node, msg, toprocess);

				im.resize(node.width,  node.height, function(err, img){
					// ignore async finish after we have closed
					if (!node.enabled){
						return;
					}
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

					node.api.sendframe(node, img, msg);
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
	
    RED.nodes.registerType("ocv-resize", resize);
	
	


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
		node.api = api;
		
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




	function bg(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'backgroundsubtractor';
		node.toprocess = n.toprocess || '';
        node.releaseall = n.releaseall || false;
		node.releaseinput = n.releaseinput || false;
		// add any specific configurations here
		node.api = api;
		
		
		// context - add nod evariables here
		// controls action of async callback
		node.enabled = true;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		
		node.bg = null;

		// optional reset function
		node.reset = function(node, msg){
            if (node.bg){
				//node.bg.release();
				node.bg = null;
			}
		};
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
            if (node.bg){
				//node.bg.release();
				node.bg = null;
			}
		});
		
        node.on('input', function (msg) {
			var toprocess = node.api.getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				
				if (node.bg === null){
					node.bg = node.api.cv.BackgroundSubtractor.createMOG2();
				}
				
				var im = node.api.getimage(node, msg, toprocess);
				node.bg.apply(im, function(err, img){
					if (err) {
						node.warn("bg err " + util.inspect(err) + " "+util.inspect(img));
						return;
					}

					if (!img){
						node.warn("bg image invalid"+util.inspect(img));
						return;    
					}

					if ((img.size()[0] === 0) && (img.size()[1] === 0)){
						node.warn("bg image has zero width or height");
						return;    
					}

					node.api.sendframe(node, img, msg);
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

    RED.nodes.registerType("ocv-bg", bg);



	//////////////////////////////////////////////////////////////
	// template for MOST ocv nodes
	// this is a copy of 'resize', an example of a simple async process
	//////////////////////////////////////////////////////////////
	function template(n){
        RED.nodes.createNode(this, n);
		
		// use 'node' early to avoid mistake of using 'this' later
        var node = this;
		
		// configuration
        node.name = n.name || 'resize';
		node.toprocess = n.toprocess || '';
        node.width = n.width || 640;
        node.height = n.height || 480;
        node.releaseall = n.releaseall || false;
		node.releaseinput = n.releaseinput || false;
		// add any specific configurations here
		
		
		// context - add nod evariables here
		// controls action of async callback
		node.enabled = true;
		// we don't want to storm status or debug, so only note errors once
		node.haserrored = false;
		node.api = api;
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = node.api.getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = node.api.getimage(node, msg, toprocess);
				im.resize(node.width,  node.height, function(err, img){
					// ignore async finish after we have closed
					if (!node.enabled){
						return;
					}
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
	
    //RED.nodes.registerType("ocv-template", template);
	//////////////////////////////////////////////////////////////
	// end template 
	//////////////////////////////////////////////////////////////
	
};
