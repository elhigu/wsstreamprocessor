$(function() {
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

});
