var statsFps;
var statsMs;
var sMs;

/**
 * Ui controller.
 *
 * Sprinkles javascript magic to index.html for reading parameters and deliver
 * them as streams to rest of the system.
 */
function UiControls(options) {
  statsFps = new Stats();

  // hackfix end() to do nothing unless begin has been called before
  var _statsMs = new Stats();
  _statsMs.setMode(1);
  statsMs = {
    domElement : _statsMs.domElement,
    _statsMs : _statsMs,
    _hasBegun : false,
    begin : function () {
      this._hasBegun = true;
      this._statsMs.begin();
    },
    end : function () {
      if (this._hasBegun) {
        this._hasBegun = false;
        this._statsMs.end();
      }
    }
  };

  statsFps = new Stats();
  sMs = new Stats();
  sMs.setMode(1);

  function eventTargetVal(event) {
    return $(event.target).val();
  }

  function numberFieldAsStream(jqEl) {
    var changeStream = jqEl.asEventStream('change').flatMap(eventTargetVal);
    var keyupStream = jqEl.asEventStream('keyup').flatMap(eventTargetVal);
    return keyupStream.merge(changeStream).skipDuplicates().toProperty(jqEl.val());
  }

  function checkBoxAsStream(jqEl) {
    var changeStream = jqEl.asEventStream('change').flatMap(function (event) {
      return $(event.target).prop('checked');
    });
    return changeStream.toProperty(jqEl.prop('checked'));
  }

  /**
   * Frame reader options.
   */
  var frameReaderDefaults = {
    minSpeed : 0
  };

  var minSpeedInputEl = $('input#minSpeedTh');
  minSpeedInputEl.val(frameReaderDefaults.minSpeed);

  this.frameReaderParams = Bacon.combineTemplate({
    minSpeed: numberFieldAsStream(minSpeedInputEl),
  });

  /**
   * Blob finder options controls.
   */
  var blobFinderDefaults = {
    visualizationEnabled : false,
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.1
  };

  var showBlobsVisualizations = $('#showBlobsCheckbox');
  showBlobsVisualizations.prop('checked', blobFinderDefaults.visualizationEnabled);
  var positionInputEl = $('input#positionTh');
  positionInputEl.val(blobFinderDefaults.positionThreshold);
  var speedInputEl = $('input#speedTh');
  speedInputEl.val(blobFinderDefaults.speedThreshold);
  var directionThInputEl = $('input#directionTh');
  directionThInputEl.val(blobFinderDefaults.directionThreshold);

  this.blobFinderParams = Bacon.combineTemplate({
    visualizationEnabled: checkBoxAsStream(showBlobsVisualizations),
    positionThreshold: numberFieldAsStream(positionInputEl),
    speedThreshold: numberFieldAsStream(speedInputEl),
    directionThreshold: numberFieldAsStream(directionThInputEl)
  });

  /**
   * Obj tracker options controls.
   */
  var objTrackerDefaults = {
    visualizationEnabled : false
  };

  var showObjVisualizations = $('#showObjsCheckbox');
  showObjVisualizations.prop('checked', objTrackerDefaults.visualizationEnabled);
  this.objTrackerParams = {
    visualizationEnabled: checkBoxAsStream(showObjVisualizations)
  };

  $('#reRunObjTracker').click(function () {
    // just trigger dummy options change to trigger objTracker again
    showObjVisualizations.trigger('change');
  });

  /**
   * Camera position and angle controls
   */

  this.rotateButtonPressed = Bacon
    .mergeAll($(document).asEventStream('keydown'), $(document).asEventStream('keyup'))
    .flatMap(function (event) {
      // rotatebutton pressed
      return event.type === 'keydown' && event.keyCode === 16;
    })
    .skipDuplicates()
    .toProperty(false);

  var mouseButtonPressed = Bacon
    .mergeAll($(document).asEventStream('mousedown'), $(document).asEventStream('mouseup'))
    .filter(function (event) { return event.button != 2; })
    .flatMap(function (event) {
      return event.type === 'mousedown';
    })
    .skipDuplicates()
    .toProperty(false);

  var mouseXYPositions = $(document).asEventStream('mousemove')
    .merge($(document).asEventStream('mousedown'))
    .filter(mouseButtonPressed)
    .flatMap(function (event) {
      return {
        startPosition: event.type === 'mousedown',
        x: event.originalEvent.x,
        y: event.originalEvent.y
      };
    });

  var mouseWheelDeltas = $(document).asEventStream('mousewheel')
    .flatMap(function (event) {
      return { z: event.originalEvent.wheelDelta };
    });

  var mouseXYDeltas = mouseXYPositions
    .slidingWindow(2,2)
    .filter(function (positions) {
      // skip calculation if second item is actually start of next dragging sequence
      return !positions[1].startPosition;
    })
    .map(function (positions) {
      return {
        x: positions[1].x - positions[0].x,
        y: positions[1].y - positions[0].y
      };
    });

  function clamp(val, min, max) {
    return Math.max(Math.min(val, max), min);
  }

  function normalizedPosition(oldVal, newVal) {
    return {
      x: clamp(oldVal.x + newVal.x*0.01, -1, 1),
      y: clamp(oldVal.y + newVal.y*0.01, -1, 1)
    };
  }

  var cameraXYPosition = mouseXYDeltas
    .filter(this.rotateButtonPressed.not())
    .scan({x: 0, y: 0}, normalizedPosition);

  var cameraAngle = mouseXYDeltas
    .filter(this.rotateButtonPressed)
    .scan({x: 0, y: 0}, normalizedPosition);

  var cameraZPosition = mouseWheelDeltas
    .scan({z: 0.5}, function (oldVal, newVal) {
      return { z: clamp(oldVal.z + newVal.z*0.001, 0, 1)};
    });

  this.cameraOrientationEvents = Bacon
    .combineTemplate({
      angle: cameraAngle,
      xyPosition: cameraXYPosition,
      zPosition: cameraZPosition
    });
}
