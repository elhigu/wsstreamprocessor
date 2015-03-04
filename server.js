var express = require('express');

var app = express();
app.use(express.static(__dirname + '/public'));

var http = require('http').Server(app);
var io = require('socket.io')(http);


io.on('connection', function(socket){
  console.log('a user connected TODO: bind here command channel stuff and tell resolution etc.');
	/*
	struct motion_vector {
	    short sad;
	    char y_vector;
	    char x_vector;
	}
	So encodes more than just the vector but also the SAD (Sum of Absolute Difference) 
	for the block. You can look at this value to get a feel for how well the vector 
	represents the match to the reference frame (I’ve ignored it in creating the gif)
	*/
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var frameCount = 0;
var frameLength = (Math.floor(1920/16)+1)*(Math.floor(1080/16)+1)*4;

process.stdin.on('readable', function() {
  process.stdin.read(0);
  
  var chunk = null;
  while ( (chunk = process.stdin.read(frameLength)) !== null ) {
    frameCount++;
    // broadcast frame... no framerate control here...
    io.emit('newFrame', {
      frame: frameCount,
      data: chunk
    });
  }
});

