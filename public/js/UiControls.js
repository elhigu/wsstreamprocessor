/**
 * Ui controller.
 *
 * Sprinkles javascript magic to index.html for reading parameters and deliver
 * them as streams to rest of the system.
 */
function UiControls(options) {

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
}
