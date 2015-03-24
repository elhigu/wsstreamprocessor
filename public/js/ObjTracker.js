
function ObjTracker(options) {
  this.trackedObjs = [];
}

/**
 * Found group has few attributes....
 *
 * $minY, $maxY, $minX, $minY, $minSpeed, $maxSpeed, $minDirection, $maxDirection
 *
 * @param groups
 */
ObjTracker.prototype.addFrame = function (groups) {
  var groupsByObjIndex = this._groupGroupsToObjects(groups);
  var i;
  var self = this;

  var objectsToDrop = [];
  // update tracked objects, with groups of this frame
  for (i = 0; i < this.trackedObjs.length; i++) {
    var newGroups = groupsByObjIndex[i];
    if (!this.trackedObjs[i].updateState(newGroups)) {
      objectsToDrop.unshift(i);
    }
  }

  // indices are in reverse order, last is first
  _.each(objectsToDrop, function (objIndex) {
    self.trackedObjs.splice(objIndex,1);
  });

  // create new groups for all matches which didn't have earlier group
  var newGroups = groupsByObjIndex[-1] || [];
  for (i = 0; i < newGroups.length; i++) {
    var newObj = new TrackedObj(newGroups[i]);
    this.trackedObjs.push(newObj);
  }

  // TODO: post filter groups, if there is necessity to merge some recognized objects....
};

/**
 * Tell object tracker if camera moved to allow compensating all object positions.
 * @param dx X coordinate changes.
 * @param dy Y coordinate changes.
 */
ObjTracker.prototype.worldMoved = function (dx, dy) {
};

/**
 * Organize groups so that each object will have an array of matching groups for them.
 *
 * Unmatched groups are stored with key -1.
 *
 * TODO: if multiple matched, calculate match value to select to which object group belong
 *
 * @param groups
 * @returns {Object|*}
 * @private
 */
ObjTracker.prototype._groupGroupsToObjects = function (groups) {
  var self = this;
  return _.groupBy(groups, function (group) {
    return _.findIndex(self.trackedObjs, function (obj) {
      return obj.isMatch(group);
    });
  });
};

/*****************************************************************************************
 *
 * TrackedObject represents one object which is being followed.
 *
 * When created, object is in 'Fresh' state, which means that if tracking is lost, it will
 * be discarded very aggressively.
 *
 * When object has been alive for enough time, it will go to 'Active' state.
 *
 * When object is not moving / recognized anymore, it will go to 'Passive' state.
 *
 * NOTE: object might need to store historical values about its state in future, but for now
 *       all decisions are made only by data from last frame + some counters telling when
 *       was the last positive match found...
 *
 * Most important attributes:
 *
 * state        Tracking state, Fresh, Active, Passive
 * direction    Direction where object was moving.
 * speed        Speed of object.
 * minPosition  {x,y} upper left corner.
 * maxPosition  {x,y} lower right corner.
 * size         Number of vertices in object.
 */
var id = 0;
function TrackedObj(group, options) {
  this.id = id++;
  var defaultOptions = {
    // Thresholds for changing object state
    dropFreshObjThreshold : 10,
    setActiveThreshold : 25*1,
    setPassiveThreshold : 25*5,
    dropPassiveThreshold : 25*60*3,

    // Thresholds for matching group with object
    positionThreshold : 20,
    speedThreshold : 0.4,
    directionThreshold : 0.4
  };

  this.options = _.defaults(options || {}, defaultOptions);

  this.inactiveFrames = 0;
  this.activeFrames = 0;
  this.state = TrackedObj.State.Fresh;
  this.direction = generalDirectionOfGroup(group);
  this.speed = generalSpeedOfGroup(group);
  this.minPosition = { x : group.$minX, y : group.$minY };
  this.maxPosition = { x : group.$maxX, y : group.$maxY };
  this.size = group.length;
}

TrackedObj.State = {
  Fresh : 'Fresh',
  Active : 'Active',
  Passive : 'Passive'
};

/**
 * Updates state of object for frame.
 *
 * If matchedGroups is undefined, null or [], then do nothing. Depending on motion, we
 * may decide, if object just stopped or vanished completely unexpectedly, e.g got under some other
 * obj.
 *
 * TODO: if object seems to be leaving screen, set status 'LeavingArea', so we can drop it fast.
 *
 * @param {Array} matchedGroups Groups, which were matched in this frame.
 * @returns {Boolean} True if object is ok, false if update function thinks that object should not be tracked anymore.
 */
TrackedObj.prototype.updateState = function (matchedGroups) {
  if (!_.isArray(matchedGroups) || _.isEmpty(matchedGroups)) {
    this.inactiveFrames++;
    this.activeFrames = 0;
  } else {
    this.inactiveFrames = 0;
    this.activeFrames++;
    this.minPosition.x = _(matchedGroups).pluck('$minX').min();
    this.minPosition.y = _(matchedGroups).pluck('$minY').min();
    this.maxPosition.x = _(matchedGroups).pluck('$maxX').max();
    this.maxPosition.y = _(matchedGroups).pluck('$maxY').max();
    this.size = _(matchedGroups).pluck('length').sum();
    this.direction = _(matchedGroups).map(generalDirectionOfGroup).sum() / matchedGroups.length;
    this.speed = _(matchedGroups).map(generalSpeedOfGroup).sum() / matchedGroups.length;
  }

  // rough decision if tracked object should be dropped / state should be changed
  if (this.activeFrames > this.options.setActiveThreshold) {
    this.state = TrackedObj.State.Active;
  }
  var shouldBeDropped = false;
  switch (this.state) {
    case TrackedObj.State.Fresh:
      if (this.inactiveFrames > this.options.dropFreshObjThreshold) {
        shouldBeDropped = true;
      }
      break;
    case TrackedObj.State.Passive:
      if (this.inactiveFrames > this.options.dropPassiveThreshold) {
        shouldBeDropped = true;
      }
      break;
    case TrackedObj.State.Active:
      if (this.inactiveFrames > this.options.setPassiveThreshold) {
        this.state = TrackedObj.State.Passive;
      }
      break;
  }
  return !shouldBeDropped;
};

/**
 * Returns true if group could match to object.
 */
TrackedObj.prototype.isMatch = function (group) {
  return this.isDirectionMatch(group) && this.isSpeedMatch(group) && this.isPositionMatch(group);
};

/**
 * TODO: one could actually make position threshold bigger to movement
 *       direction if object speed is fast
 */
TrackedObj.prototype.isPositionMatch = function (group) {
  var topLeftIn =
    group.$minX > (this.minPosition.x - this.options.positionThreshold) &&
    group.$minY > (this.minPosition.y - this.options.positionThreshold);

  var bottomRightIn =
    group.$maxX < (this.maxPosition.x + this.options.positionThreshold) &&
    group.$maxY < (this.maxPosition.y + this.options.positionThreshold);

  return topLeftIn && bottomRightIn;
};

TrackedObj.prototype.isDirectionMatch = function (group) {
  var minDirection = group.$minDirection-this.options.directionThreshold;
  var maxDirection = group.$maxDirection+this.options.directionThreshold;
  return this.direction > minDirection && this.direction < maxDirection;
};

TrackedObj.prototype.isSpeedMatch = function (group) {
  var minSpeed = group.$minSpeed-this.options.speedThreshold;
  var maxSpeed = group.$maxSpeed+this.options.speedThreshold;
  return this.speed > minSpeed && this.speed < maxSpeed;
};
