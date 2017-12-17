# node-red-contrib-ocv
Node Red node set for using node-opencv in Node Red

# nodes

## ocv global

This node adds a structure 'ocv-api' to the globals in NodeRed, allowing function nodes to use node-opencv functionality, but simplify interaction with the node-red-contrib-ocv node set.

The api may be accessed like:

var ocvapi = global.get("ocv-api");

and contains:

```
{
   cv: node-opencv root object,
   getimagename( obj, msg ): return the input image name or null, may set status and produce warnings\n"+
   releaseone( msg, name ): release the named img/data from the frame in the msg\n"+
   releaseall( msg ): release all images/data in the frame in the msg\n"+
   sendframe( obj, data, msg ): send a NEW msg containing the original frame from msg plus the data named as obj.name\n"+
}
```

See API notes below.

## ocv videoin

reads video from a camera

## ocv resize

Resizes an image

## ocv encode

Encodes an image to jpeg data in a buffer

## ocv bg

calculates the difference between an image and a running average background using MOG2 from Opencv


# API Notes

## frame representation

A frame of data is a collection of data for a specific point in time.

This may contain one or more opencv images, plus other data (e.g. jppeg data, contours, etc).

A frame is stored in a Node-Red message at msg.payload.frame

The base structure is ;

```
frame: {
   number: the frame number since start
   data:{ - a container for named data within the frame, e.g.:
     videoin: - opencv mat representing the frame read by the node 'videoin'
   }
}
```

Frame data is generally named according to the node name of the originating node.

When a node sends a frame, it adds it's name in msg.payload.name, and this may be used by the next node to determine which chunk of data it is to process if not configured to process a specifically named piece of data.

## node representation.

The API calls are designed for use from the native nodes.  However, they may be used from function nodes if certain expectations are met.

for getimagename( obj, msg ) and sendframe(obj, data, msg ):

'obj' in a call is normally the node itself.  The calls will use the following functions and variables:

```obj.status - std NR function
obj.error - std NR function
obj.warn - std NR function
obj.send(msg) - std NR function
obj.toprocess - the name of the data to be processed from the frame
obj.haserrored - a flag indicating that an error has occurred since 'reset'.
obj.reset(obj) - an optional function indicating a msg received was a rest message.```

### getimagename( obj, msg )

This function takes the 'obj' and an input msg, and retrieves the name of the data to process.

It first checks for a rest msg, and then checks other msg parameters are correct for an ovc message containing a frame.

If there is any problem, an error will be show using status, and obj.error() will be called; but only for the first error encountered.

If there is any problem, the function will return null, which indicates there is no processing to do.

### releaseone(msg, name)

Releases the memory for the named image/data in the frame in the msg

### releaseall(msg)

Releases the memory for all the images/data in the frame in the msg

### sendframe( obj, data, msg )

creates a new msg from the frame in msg, add 'data' to the frame using 'obj.name' as the name of the data, and sends the new msg on the first output.


## example code

example:

```
    var api = global.get('ocv-api');
    node.name = 'myname';
    var toprocess = api.getimagename(node, msg);
    // if error or no processing required
    if (toprocess !== null){
       var im = msg.payload.frame.data[toprocess];
       (do something with img)
       api.sendframe(node, outputdata, msg);
       if (releaseinput){
           api.releaseone(msg, toprocess);
       }
    }
    if (releaseall){
        api.releaseall(msg);
    }
```

