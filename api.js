/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
"use strict";
    
module.exports = {
    cv: require("opencv"),


	///////////////////////////////////////////////////////////////////////////
	// function which is used in most nodes to get the correct image to process
	// returns name || null
	///////////////////////////////////////////////////////////////////////////
	getimagename: function(node, msg){
		// if a cmd msg, then just pass on now, and don't do anything further.
		// one og these is sent at startup to reset variables in the whole flow
		if (msg.cmd){
			if (msg.cmd === 'reset'){
				node.status({});
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
		var toprocess = node.toprocess || '';

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
	},

	getimage: function(node, msg, name){
		if (!name)
			name = node.api.getimagename(node, msg);
		if (msg.payload && msg.payload.frame && msg.payload.frame.data && msg.payload.frame.data[name]){
			return msg.payload.frame.data[name];
		} else {
			return null;
		}
	},


	///////////////////////////////////////////////////////////////////////////
	// release a named data from a frame
	releaseone: function (node, msg, name){
		if (msg.payload && msg.payload.frame && msg.payload.frame.data){
			var f = msg.payload.frame;
			if (f.data[name]){
				if (f.data[name].hasOwnProperty('release')){
					f.data[name].release();
				}
				delete f.data[name];
			}
		}
	},
	
	///////////////////////////////////////////////////////////////////////////
	// release all frame data
	releaseall:function (node, msg){
		if (msg.payload && msg.payload.frame && msg.payload.frame.data){
			var f = msg.payload.frame;
			var keys = Object.keys(f.data);
			for (var i = keys.length-1; i >= 0; i--){
				node.api.releaseone(node, msg, keys[i]);
			}
		}
	},


	sendframe:function (node, img, msg){
		
		if (msg){
			var frame = msg.payload.frame;
		} else {
			// new frame
			var framenumber = node.framenumber++;
			var frame = {
				origin:node.name,
				time:(new Date()).valueOf(),
				number:framenumber,
				data:{}
			};
		}
		
		frame.data[node.name] = img;

		// should we copy anything else across from old msg?
		var newmsg = {
			payload:{
				name: node.name,
				frame:frame
			}
		}; 

		node.send(newmsg);
	},

	description:"API for using node-red-contrib-ocv functions in your own functions\n" +
			" cv: the node-opencv root object\n"+
			" getimagename( obj, msg ): return the input image name or null, may set status and produce warnings\n"+
			" releaseone( obj, msg, name ): release the named img/data from the frame in the msg\n"+
			" releaseall( obj, msg ): release all images/data in the frame in the msg\n"+
			" sendframe( obj, data, msg ): send a NEW msg containing the original frame from msg plus the data named as obj.name\n"+
			"\n"
			
};

