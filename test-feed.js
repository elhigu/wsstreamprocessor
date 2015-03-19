/**
 * Generate same kind of motion vector feed that raspivid -x - creates
 */

var width = Math.floor(1920/16)+1;
var height = Math.floor(1080/16)+1;
var pixels = width*height;
var frames = [];
var frameCount = 360;
var fps = 25;

// TODO: add arguments to tune frames to show
var inputFile = null;
for (var argIndex = 0; argIndex < process.argv.length; argIndex++) {
	if (process.argv[argIndex] === "--in") {
		inputFile = process.argv[argIndex+1];
	}
}

if (inputFile) {
	// input file given, expect fullhd and read frames from there
	var fs = require("fs");
	var motionVectors = fs.readFileSync(inputFile);
	var frameSize = pixels*4;
	var currOffset = 0;
	var nextOffset = frameSize;
	var dropFrames = 15;
	while (nextOffset < motionVectors.length) {
		if (dropFrames-- < 0) {
			frames.push(motionVectors.slice(currOffset, nextOffset));
		}
		// console.error("Read Frame", currOffset, nextOffset, frames[frames.length-1].length);
		currOffset = nextOffset;
		nextOffset += frameSize;
	}
	console.error("Read frames:", frames.length);
} else {
  // generate input frames
	for (var i = 0; i < frameCount; i++) {
		var frame = new Buffer(pixels*4);
		frames.push(frame);
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				var offset = y*width+x;

				var dx = 0;
				var dy = 0;
				var sad = Math.floor(Math.random()*512);

				//
				// Max reallife changes seen in camera was ~ 4000 changes when camera is
				// spanning, however there changes creates usually single / few groups
				//

				// create worst case performance test data
				// 16 planes, which each has max number of single vertex groups
				var floorX = Math.floor(x);
				var floorY = Math.floor(y);
				if ((floorX+0)%4 == 0 && (floorY+0)%4 == 0) { dx = 0; dy = 10; }
				if ((floorX+0)%4 == 0 && (floorY+1)%4 == 0) { dx = 10; dy = 0; }
				if ((floorX+0)%4 == 0 && (floorY+2)%4 == 0) { dx = 0; dy = -10; }
				if ((floorX+0)%4 == 0 && (floorY+3)%4 == 0) { dx = -10; dy = 0; }

				//
				// Uncomment these to get crazy amount of blobs..
				//

				//if ((floorX+1)%4 == 0 && (floorY+0)%4 == 0) { dx = 10; dy = 10; }
				//if ((floorX+1)%4 == 0 && (floorY+1)%4 == 0) { dx = -10; dy = 10; }
				//if ((floorX+1)%4 == 0 && (floorY+2)%4 == 0) { dx = 10; dy = -10; }
				//if ((floorX+1)%4 == 0 && (floorY+3)%4 == 0) { dx = -10; dy = -10; }

				//if ((floorX+2)%4 == 0 && (floorY+0)%4 == 0) { dx = 0; dy = 50; }
				//if ((floorX+2)%4 == 0 && (floorY+1)%4 == 0) { dx = 50; dy = 0; }
				//if ((floorX+2)%4 == 0 && (floorY+2)%4 == 0) { dx = 0; dy = -50; }
				//if ((floorX+2)%4 == 0 && (floorY+3)%4 == 0) { dx = -50; dy = 0; }

				//if ((floorX+3)%4 == 0 && (floorY+0)%4 == 0) { dx = 80; dy = 80; }
				//if ((floorX+3)%4 == 0 && (floorY+1)%4 == 0) { dx = -80; dy = 80; }
				//if ((floorX+3)%4 == 0 && (floorY+2)%4 == 0) { dx = 80; dy = -80; }
				//if ((floorX+3)%4 == 0 && (floorY+3)%4 == 0) { dx = -80; dy = -80; }

				//
				// Create some moving objects
				//

				// TODO: refactor box creator to generate more boxes from array of parameters
				var boxX = Math.cos(i/360*(Math.PI*2)) * 30 + 60;
				var boxY = Math.sin(i/360*(Math.PI*2)) * 20 + 10;
				var rndX = (Math.random()-0.5)*20;
				var rndY = (Math.random()-0.5)*20;
				if (x >= boxX && x < boxX + 20 && y >= boxY && y < boxY + 20) {
					dy = Math.floor(Math.sin(i/180*(Math.PI*2))*80+rndY);
					dx = Math.floor(Math.cos(i/180*(Math.PI*2))*80+rndX);
				}

				boxX = Math.sin(i/360*(Math.PI*2)) * 20 + 40;
				boxY = Math.cos(i/180*(Math.PI*2)) * 60 + 10;
				if (x >= boxX && x < boxX + 20 && y >= boxY && y < boxY + 20) {
					dx = -Math.floor(Math.sin(i/180*(Math.PI*2))*60+rndX);
					dy = Math.floor(Math.cos(i/180*(Math.PI*2))*80+rndY);
				}

				boxX = Math.sin(i/180*(Math.PI*2)) * 30 + 60;
				boxY = Math.cos(i/180*(Math.PI*2)) * 20 + 10;
				if (x >= boxX && x < boxX + 5 && y >= boxY && y < boxY + 5) {
					dx = Math.floor(50 + rndX);
					dy = Math.floor(50 + rndY);
				}
				boxX = Math.sin(i/180*(Math.PI*2)) * 30 + 60;
				boxY = Math.cos(i/180*(Math.PI*2)) * 10 + 5;
				if (x >= boxX && x < boxX + 5 && y >= boxY && y < boxY + 5) {
					dx = Math.floor(50 + rndX);
					dy = Math.floor(50 + rndY);
				}

				frame.writeInt8(dx, offset*4);
				frame.writeInt8(dy, offset*4+1);
				frame.writeInt16LE(sad, offset*4+2);
			}
		}
	}
}

// write frames to stdout
var frameCounter = 0;
setInterval(function () {
  frameCounter++;
  process.stdout.write(frames[frameCounter%frames.length]);
}, Math.floor(1000/fps));

setInterval(function () {
	console.error("frames.length", frames.length, "FrameCounter:", frameCounter);
}, 10000);
