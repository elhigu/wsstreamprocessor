var express = require('express');

var app = express();
app.use(express.static(__dirname + '/public'));

var http = require('http').Server(app);
var io = require('socket.io')(http);


io.on('connection', function(socket){
  console.log('a user connected TODO: bind here command channel stuff and tell resolution etc.');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var frameCount = 0;
// var frameLength = 1080*1920/16*4;
var frameLength = 32;

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
