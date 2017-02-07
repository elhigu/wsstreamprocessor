# Websocket pipeline to stream data to be able to process in browser

[![Greenkeeper badge](https://badges.greenkeeper.io/elhigu/wsstreamprocessor.svg)](https://greenkeeper.io/)

Configured to read / split motion vector data from RaspiCam

1. server.js reads data from stdin (fed by raspivid) and splits it to frames + listens for websocket connections
2. When frame is read, broadcast it over websocket to all connections.
3. Visualize data with three.js

Starting streaming motion vector data:

    /opt/vc/bin/raspivid -t 0 -ex verylong -co -35  -g 0 -fps 25  -o /dev/null -x - | node wsstreamprocessor/server.js

Open in Chrome:

    http://<your raspi IP>:3000 and wait for a moment

Motion vectors are coming from raspicam in following format:

    {
      signed char dx;   // values seems to be around +- 80
      signed char dy;   // values seems to be around +-80
      signed short sad; // values seems to be around 0..512 little endian
    }

Numer of motion vectors can be calculated from your video resolution

    var vectorsPerLine = Math.floor(imageWidth/16)+1
    var vectorLines = Math.floor(imageHeight/16)+1

So for 1920x1080 FullHD video there are 121x68 vectors. First vector in frame is from bottom-left corner.

e.g vectors for 65x31 video stream (5x2 vectors) would be:


	v6 v7 v8 v9 v10

	v1 v2 v3 v4 v5

And frame size would be 40 bytes / frame.
