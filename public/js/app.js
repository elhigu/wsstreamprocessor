var frameReader = new MotionVectorReader();
var blobFinder = new BlobFinder();
var objTracker = new ObjTracker();
var circleMath = {
  /**
   * Returns sector width of two directions.
   * @param dir1 Direction 1 [0 .. 1]
   * @param dir2 Direction 2 [0 .. 1]
   * @returns {Number} Different of directions [0 .. 0.5]
   */
  sectorWidth : function (dir1, dir2) {
    if (dir1 < dir2) {
      return (dir2-dir1);
    } else {
      return (dir2 + 1 - dir1);
    }
  }
};

$(function() {

  var uiControls = new UiControls();

  webgl_init();

  /**
   * Read socket.io events to streams
   */
  var socket = io({
    transports: ['websocket']
  });
  var frameStream = Bacon.fromBinder(function(sink) {
    socket.on('newFrame', sink);
  });
  var fpsSelectionStream = Bacon.fromBinder(function (sink) {
    socket.on('setFps', sink);
  }).toProperty(25).log();


  /**
   * Read raw frames and throttle + interpret them as motion vector objects.
   */
  var throttledFrameStream = Bacon
    .combineTemplate({
      rawFrame: frameStream,
      fps: fpsSelectionStream
    })
    .flatMapConcat(function (fullFrame) {
      // only 950ms to catch up a bit rather than falling e.g. 1ms behind all the time...
      return Bacon.once(fullFrame.rawFrame).concat(Bacon.later(950/fullFrame.fps).filter(false));
    })
    .combine(uiControls.frameReaderParams, function (rawFrame, options) {
      statsMs.begin(); // from reading frame, until finishing objectTracker
      return frameReader.readFrame(rawFrame, options);
    });

  /**
   * Frame counter, updated on every throttled frame
   */
  var frameNumberStream = throttledFrameStream.map(1).scan(0, plus);
  function plus(sum, newVal) { return sum + newVal }

  /**
   * This stream updates every time, when new frame or blob detector options are changed.
   */
  var blobStream = Bacon
    .combineTemplate({
      frame: throttledFrameStream,
      blobFinderParams: uiControls.blobFinderParams
    })
    .map(function (blobFinderInput) {
      blobFinder.reset(blobFinderInput.blobFinderParams);
      _.each(blobFinderInput.frame, function (motionVector) {
        var roundZ = (Math.round(motionVector.direction * 16) * 10) + Math.round(motionVector.speed * 10);
        if (motionVector.speed > 0) {
          blobFinder.addVertex(roundZ, motionVector);
        }
      });
      return blobFinder.findBlobs(blobFinderInput.frame);
    });


  /**
   * Blob stream which updates, when ever there is new frame.
   */
  var newFrameBlobStream = Bacon
    .combineTemplate({
      blobs: blobStream,
      frameNumber: frameNumberStream
    })
    .skipDuplicates(function (oldVal, newVal) {
      return oldVal.frameNumber === newVal.frameNumber;
    })
    .map('.blobs');


  /**
   * Run object tracker, when ever we have blobs for a new frame data.
   */
  var objTrackerUpdatedStream =
    Bacon.combineTemplate({
      blobs: newFrameBlobStream,
      objTrackerParams: uiControls.objTrackerParams
    })
    // TODO: add here pass, which could try to estimate all the time how many objects there are in
    //       screen, so that information could be used to help actual object tracking algorithm
    //       to perform a lot better
    .map(function (blobsAndOptions) {
      objTracker.addFrame(blobsAndOptions.blobs);
      statsMs.end();
      return objTracker;
    });

  /**
   * Synchronize rendering on next window.requestAnimationFrame and if some visualized data has changed
   */

  var renderUpdateRequestCounter = Bacon.mergeAll(
    throttledFrameStream, blobStream, objTrackerUpdatedStream,
    uiControls.cameraOrientationEvents.map(webgl_updateCamera)
  ).map(1).scan(0, plus);

  // sample stream when ever repaint is going to be done...
  // if stream counter is changed, something is dirty.
  var updateRequiredStream = renderUpdateRequestCounter
    .sampledBy(Bacon.scheduleAnimationFrame())
    .skipDuplicates();

  // when update really really needed and it is perfect time for animation frame,
  // get latest data and visualize...
  Bacon
    .combineTemplate({
      motionVectors: throttledFrameStream,
      blobs: blobStream,
      objTracker: objTrackerUpdatedStream
    })
    .sampledBy(updateRequiredStream)
    .onValue(function (latestData) {
      updateMotionVectorVisualization(latestData.motionVectors);
      updateBlobVisualizations(latestData.blobs);
      updateObjectTrackingVisualizations(latestData.objTracker);
      render();
      statsFps.update();
    });


});
