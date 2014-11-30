var width = Math.ceil(1920/16);
var height = Math.ceil(1080/16);
var pixels = width*height;
var frames = [];
var frameCount = 360;
var fps = 30;

for (var i = 0; i < frameCount; i++) {
  var frame = new Buffer(pixels*4);
  frames.push(frame)
  for (var y = 0; y < height; y++) {
	  for (var x = 0; x < width; x++) {
	  	var offset = y*width+x;

	  	var dx = Math.floor(Math.sin(i/180*(Math.PI*2))*127);
	  	var dy = Math.floor(Math.cos(i/180*(Math.PI*2))*127);
	  	var sad = Math.floor(Math.random()*32000);

	  	// generate box to screen which goes to opposite direction
	  	var boxX = Math.sin(i/360*(Math.PI*2)) * 30 + 60;
	  	var boxY = Math.cos(i/360*(Math.PI*2)) * 20 + 30;
	  	if (x >= boxX && x < boxX + 5 && y >= boxY && y < boxY + 5) {
	  		dx = -dx;
	  		dy = -dy;
	  		sad = 0;
	  	}

	  	/* We send data in big endian coding
		struct motion_vector {
		    short sad;
		    char y_vector;
		    char x_vector;
		}
		*/
	  	frame.writeInt16BE(sad, offset*4);
	  	frame.writeInt8(dy, offset*4+2);
	  	frame.writeInt8(dx, offset*4+3);
	  }
  }
}

// write frames to stdout
var frameCounter = 0;
setInterval(function () {
  frameCounter++;
  process.stdout.write(frames[frameCounter%frameCount]);
}, Math.floor(1000/fps));
