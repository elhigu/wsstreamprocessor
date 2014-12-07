/**
 * Generate same kind of motion vector feed that raspivid -x - creates
 */

var width = Math.floor(1920/16)+1;
var height = Math.floor(1080/16)+1;
var pixels = width*height;
var frames = [];
var frameCount = 360;
var fps = 10;

for (var i = 0; i < frameCount; i++) {
  var frame = new Buffer(pixels*4);
  frames.push(frame)
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
			if ((floorX+0)%4 == 0 && (floorY+0)%4 == 0) { dx = 5; dy = 77; }
			if ((floorX+0)%4 == 0 && (floorY+1)%4 == 0) { dx = 15; dy = 66; }
			if ((floorX+0)%4 == 0 && (floorY+2)%4 == 0) { dx = 25; dy = 55; }
			if ((floorX+0)%4 == 0 && (floorY+3)%4 == 0) { dx = 35; dy = 44; }

			//
			// Uncomment these to get crazy amount of blobs..
			//

			//if ((floorX+1)%4 == 0 && (floorY+0)%4 == 0) { dx = 45; dy = 33; }
			//if ((floorX+1)%4 == 0 && (floorY+1)%4 == 0) { dx = 55; dy = 22; }
			//if ((floorX+1)%4 == 0 && (floorY+2)%4 == 0) { dx = 65; dy = 11; }
			//if ((floorX+1)%4 == 0 && (floorY+3)%4 == 0) { dx = 75; dy = 0; }

			//if ((floorX+2)%4 == 0 && (floorY+0)%4 == 0) { dx = 80; dy = 10; }
			//if ((floorX+2)%4 == 0 && (floorY+1)%4 == 0) { dx = 70; dy = 20; }
			//if ((floorX+2)%4 == 0 && (floorY+2)%4 == 0) { dx = 60; dy = 30; }
			//if ((floorX+2)%4 == 0 && (floorY+3)%4 == 0) { dx = 50; dy = 40; }

			//if ((floorX+3)%4 == 0 && (floorY+0)%4 == 0) { dx = 40; dy = 50; }
			//if ((floorX+3)%4 == 0 && (floorY+1)%4 == 0) { dx = 30; dy = 60; }
			//if ((floorX+3)%4 == 0 && (floorY+2)%4 == 0) { dx = 20; dy = 70; }
			//if ((floorX+3)%4 == 0 && (floorY+3)%4 == 0) { dx = 10; dy = 80; }

			//
			// Create some moving objects
			//

			// TODO: refactor box creator to generate more boxes from array of parameters
			var boxX = Math.cos(i/360*(Math.PI*2)) * 30 + 60;
			var boxY = Math.sin(i/360*(Math.PI*2)) * 20 + 10;
			if (x >= boxX && x < boxX + 20 && y >= boxY && y < boxY + 20) {
				dx = Math.floor(Math.sin(i/180*(Math.PI*2))*80);
				dy = Math.floor(Math.cos(i/180*(Math.PI*2))*80);
			}
			boxX = Math.sin(i/360*(Math.PI*2)) * 20 + 40;
			boxY = Math.cos(i/180*(Math.PI*2)) * 60 + 10;
			if (x >= boxX && x < boxX + 20 && y >= boxY && y < boxY + 20) {
				dx = -Math.floor(Math.sin(i/180*(Math.PI*2))*60);
				dy = Math.floor(Math.cos(i/180*(Math.PI*2))*80);
			}
			boxX = Math.sin(i/180*(Math.PI*2)) * 30 + 60;
			boxY = Math.cos(i/180*(Math.PI*2)) * 20 + 10;
			if (x >= boxX && x < boxX + 5 && y >= boxY && y < boxY + 5) {
				dx = 50;
				dy = 50;
			}
			boxX = Math.sin(i/180*(Math.PI*2)) * 30 + 60;
			boxY = Math.cos(i/180*(Math.PI*2)) * 10 + 5;
			if (x >= boxX && x < boxX + 5 && y >= boxY && y < boxY + 5) {
				dx = 50;
				dy = 50;
			}

			frame.writeInt8(dx, offset*4);
	  	frame.writeInt8(dy, offset*4+1);
			frame.writeInt16LE(sad, offset*4+2);
	  }
  }
}

// write frames to stdout
var frameCounter = 0;
setInterval(function () {
  frameCounter++;
  process.stdout.write(frames[frameCounter%frameCount]);
}, Math.floor(1000/fps));
