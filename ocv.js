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


	///////////////////////////////////////////////////////////////////////////
	// function which is used in most nodes to get the correct image to process
	// returns name || null
	///////////////////////////////////////////////////////////////////////////
	function getimagename(node, msg){
		// if a cmd msg, then just pass on now, and don't do anything further.
		// one og these is sent at startup to reset variables in the whole flow
		if (msg.cmd){
			if (msg.cmd === 'reset'){
				if (node.reset){
					node.reset(node, msg);
				}
				node.haserrored = false;
			}
			node.send(msg);
			return null;
		}

		// if we don't have named data to process, then we can't
		if (!msg.payload){
			if (!node.haserrored){
				node.error("no msg payload");
				node.status({fill:"red",shape:"ring",text:"no payload"});
				node.haserrored = true;
			}
			return null;
		}

		// toprocess is the configured named data to process from the frame
		var toprocess = node.toprocess;

		// if not configured, then we use msg.frame.name - the name of the 
		// last OCV node to send
		if ((toprocess === '') && (msg.payload.name)){
			toprocess = msg.payload.name
		}

		// if we don't have named data to process, then we can't
		if (toprocess === ''){
			if (!node.haserrored){
				node.error("no name to process in message or config");
				node.status({fill:"red",shape:"ring",text:"no name"});
				node.haserrored = true;
			}
			return null;
		}



		if (!msg.payload.frame){
			if (!node.haserrored){
				node.error("no frame in message");
				node.status({fill:"red",shape:"ring",text:"no frame"});
				node.haserrored = true;
			}
			return null;
		}

		var f = msg.payload.frame;
		if (!f.data){
			if (!node.haserrored){
				node.error("no data in frame in message");
				node.status({fill:"red",shape:"ring",text:"no data"});
				node.haserrored = true;
			}
			return null;
		}

		if (f.data[toprocess]){
			return toprocess;
		} else {
			if (!node.haserrored){
				node.error("name "+toprocess+" not found in frame");
				node.status({fill:"red",shape:"ring",text:toprocess+" not in frame"});
				node.haserrored = true;
			}
		}
		
		return null;
	}

	///////////////////////////////////////////////////////////////////////////
	// release a named data from a frame
	function releaseone(msg, name){
		if (msg.payload && msg.payload.frame && msg.payload.frame.data){
			var f = msg.payload.frame;
			if (f.data[name]){
				if (f.data[name].hasOwnProperty('release')){
					f.data[name].release();
				}
				delete f.data[name];
			}
		}
	}
	
	///////////////////////////////////////////////////////////////////////////
	// release all frame data
	function releaseall(msg){
		if (msg.payload && msg.payload.frame && msg.payload.frame.data){
			var f = msg.payload.frame;
			var keys = Object.keys(f.data);
			for (var i = keys.length-1; i >= 0; i--){
				releaseone(msg, keys[i]);
			}
		}
	}


	function sendframe(node, img, msg){
		var frame = msg.payload.frame;
		
		//node.warn(frame);
		frame.data[node.name] = img;
		//node.warn(frame);

		// should we copy anything else across from old msg?
		var newmsg = {
			payload:{
				name: node.name,
				frame:frame
			}
		}; 

		node.send(newmsg);
	}



	var api = {
		cv:cv,
		getimagename:getimagename,
		releaseone:releaseone,
		releaseall:releaseall,
		sendframe:sendframe,
		
		description:"API for using node-red-contrib-ocv functions in your own functions\n" +
			" cv: the node-opencv root object\n"+
			" getimagename( obj, msg ): return the input image name or null, may set status and produce warnings\n"+
			" releaseone( msg, name ): release the named img/data from the frame in the msg\n"+
			" releaseall( msg ): release all images/data in the frame in the msg\n"+
			" sendframe( obj, data, msg ): send a NEW msg containing the original frame from msg plus the data named as obj.name\n"+
			"\n"
			
	};


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
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = msg.payload.frame.data[toprocess];

				var f = msg.payload.frame;
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

					sendframe(node, img, msg);
				});

				// if asked to release our input, do so
				if (node.releaseinput){
					releaseone(msg, toprocess);
				}
			}

			// if asked to release ALL frame data, do so
			// output data will be added afterwards
			if (node.releaseall){
				releaseall(msg);
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
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = msg.payload.frame.data[toprocess];
				im.toBuffer(function(err, data){
					if (err) {
						node.warn("encode jpeg err " + util.inspect(err) + " "+util.inspect(img));
						return;
					}
					sendframe(node, data, msg);
				});

				// if asked to release our input, do so
				if (node.releaseinput){
					releaseone(msg, toprocess);
				}
			}

			// if asked to release ALL frame data, do so
			// output data will be added afterwards
			if (node.releaseall){
				releaseall(msg);
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
			var toprocess = getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				
				if (node.bg === null){
					node.bg = cv.BackgroundSubtractor.createMOG2();
				}
				
				var im = msg.payload.frame.data[toprocess];
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

					sendframe(node, img, msg);
				});

				// if asked to release our input, do so
				if (node.releaseinput){
					releaseone(msg, toprocess);
				}
			}

			// if asked to release ALL frame data, do so
			// output data will be added afterwards
			if (node.releaseall){
				releaseall(msg);
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
		
		// if closing, make sure any async return dies
		node.on('close', function(){
			node.enabled = false;
		});
		
        node.on('input', function (msg) {
			var toprocess = getimagename(node, msg);
			// if error or no processing required
			if (toprocess !== null){
				var im = msg.payload.frame.data[toprocess];
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

					sendframe(node, data, msg);
				});

				// if asked to release our input, do so
				if (node.releaseinput){
					releaseone(msg, toprocess);
				}
			}

			// if asked to release ALL frame data, do so
			// output data will be added afterwards
			if (node.releaseall){
				releaseall(msg);
			}
			
		});
	}
	
    //RED.nodes.registerType("ocv-template", template);
	//////////////////////////////////////////////////////////////
	// end template 
	//////////////////////////////////////////////////////////////
	
};
