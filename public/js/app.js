$(function() {
  webgl_init();

  var blobFinderParams = {
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.1
  };

  function eventTargetVal(event) {
    return $(event.target).val();
  }

  function numberFieldAsStream(jqEl) {
    var changeStream = jqEl.asEventStream('change').map(eventTargetVal);
    var keyupStream = jqEl.asEventStream('keyup').map(eventTargetVal);
    return keyupStream.merge(changeStream).skipDuplicates();
  }

  var positionInputEl = $('input#positionTh');
  positionInputEl.val(blobFinderParams.positionThreshold);
  numberFieldAsStream(positionInputEl).onValue(function (value) {
    blobFinderParams.positionThreshold = value;
  });

  var speedInputEl = $('input#speedTh');
  speedInputEl.val(blobFinderParams.speedThreshold);
  numberFieldAsStream(speedInputEl).log().onValue(function (value) {
    blobFinderParams.speedThreshold = value;
  });

  var directionThInputEl = $('input#directionTh');
  directionThInputEl.val(blobFinderParams.directionThreshold);
  numberFieldAsStream(directionThInputEl).log().onValue(function (value) {
    blobFinderParams.directionThreshold = value;
  });

  // Read socket.io socket
  var socket = io({
    transports: ['websocket']
  });
  var frameStream = Bacon.fromBinder(function(sink) {
    socket.on('newFrame', sink);
  });
  var fpsSelectionStream = Bacon.fromBinder(function (sink) {
    socket.on('setFps', sink);
  }).toProperty(25);

  var throttledFrameStream = Bacon
    .combineTemplate({
      frame: frameStream,
      fps: fpsSelectionStream
    })
    .flatMapConcat(function (fullFrame) {
      // only 950ms to catch up a bit rather than falling e.g. 1ms behind all the time...
      return Bacon.once(fullFrame.frame).concat(Bacon.later(950/fullFrame.fps).filter(false));
    });

  throttledFrameStream.onValue(function (frame) {
    animate(frame);
  });

});
