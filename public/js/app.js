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
  webgl_init();

  function eventTargetVal(event) {
    return $(event.target).val();
  }

  function numberFieldAsStream(jqEl) {
    var changeStream = jqEl.asEventStream('change').flatMap(eventTargetVal);
    var keyupStream = jqEl.asEventStream('keyup').flatMap(eventTargetVal);
    return keyupStream.merge(changeStream).skipDuplicates().toProperty(jqEl.val());
  }

  var blobFinderDefaults = {
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.1
  };

  var positionInputEl = $('input#positionTh');
  positionInputEl.val(blobFinderDefaults.positionThreshold);
  var speedInputEl = $('input#speedTh');
  speedInputEl.val(blobFinderDefaults.speedThreshold);
  var directionThInputEl = $('input#directionTh');
  directionThInputEl.val(blobFinderDefaults.directionThreshold);

  var blobFinderParams = Bacon.combineTemplate({
    positionThreshold: numberFieldAsStream(positionInputEl),
    speedThreshold: numberFieldAsStream(speedInputEl),
    directionThreshold: numberFieldAsStream(directionThInputEl)
  }).log();

  // Read socket.io socket
  var socket = io({
    transports: ['websocket']
  });
  var frameStream = Bacon.fromBinder(function(sink) {
    socket.on('newFrame', sink);
  });
  var fpsSelectionStream = Bacon.fromBinder(function (sink) {
    socket.on('setFps', sink);
  }).toProperty(25).log();

  var throttledFrameStream = Bacon
    .combineTemplate({
      rawFrame: frameStream,
      fps: fpsSelectionStream
    })
    .flatMapConcat(function (fullFrame) {
      // only 950ms to catch up a bit rather than falling e.g. 1ms behind all the time...
      return Bacon.once(fullFrame.rawFrame).concat(Bacon.later(950/fullFrame.fps).filter(false));
    })
    .map(function (rawFrame) {
      statsMs.begin();
      return frameReader.readFrame(rawFrame);
    });

  Bacon
    .combineTemplate({
      frame: throttledFrameStream,
      blobFinderParams: blobFinderParams
    })
    .flatMap(function (blobFinderInput) {
      blobFinder.reset();
      _.each(blobFinderInput.frame, function (motionVector) {
        var roundZ = (Math.round(motionVector.direction*16)*10) + Math.round(motionVector.speed*10);
        if (motionVector.speed > 0) {
          blobFinder.addVertex(roundZ, motionVector);
        }
      });
      return blobFinder.findBlobs(blobFinderInput.frame);
    }).onValue(function (blobs) {
      animate(blobs);
      statsMs.end();
      statsFps.update();
    });

  // TODO: request animation frame for actually drawing visualizations

});
