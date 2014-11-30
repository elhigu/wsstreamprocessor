# Websocket pipeline to stream data to be able to process in browser

1. Reads data from stdin and splits it to frames / packages and listens for websocket connections.
2. When browser connects to server it opens command channel and other channel for reading frame data.
3. Browser might be able to control desired framerate through command channel.
4. Each frame message has maybe format {i:<framenum>,d:Blob}


## 1. Splitting input stream to frames

Currently server expect constant frame size from input stream, so it is split to constant size pieces. 

## 2. On websocket connect server tells data dimensions, frame size etc. to browser


## 3. Nothing special in this step

## 4. Here we could also show an example how to create webgl canvas from frame and use shaders to visualize data.
