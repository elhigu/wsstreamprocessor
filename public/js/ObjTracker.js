
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

  // update tracked objects, with groups of this frame
  for (i = 0; i < this.trackedObjs.length; i++) {
    var newGroups = groupsByObjIndex[i];
    this.trackedObjs[i].updateState(newGroups);
  }

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
 * @param groups
 * @returns {Object|*}
 * @private
 */
ObjTracker.prototype._groupGroupsToObjects = function (groups) {
  // TODO: if multiple matched, calculate match value to select to which object group belong
  // TODO: for now, just take first match
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
function TrackedObj(group, options) {
  var defaultOptions = {
    // Thresholds for changing object state
    dropFreshObjThreshold : 10,
    setActiveThreshold : 25*1,
    setPassiveThreshold : 25*5,
    dropPassiveThreshold : 25*60*3,

    // Thresholds for matching group with object
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.1
  };

  this.options = _.defaults(options || {}, defaultOptions);

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
 * @param {Array} matchedGroups Groups, which were matched in this frame.
 * @returns True if object is ok, false if update function thinks that object should not be tracked anymore.
 */
TrackedObj.prototype.updateState = function (matchedGroups) {
  // TODO: update all objects with data just recognized, fix position / size / direction etc. and
  // TODO: update latest verified match...
  //
  // TODO: if group state is new (it havent got enough positive matches) and certain time
  // TODO: lost, then we just should dump the object.
  // TODO:
};

/**
 * Returns true if group could match to object.
 * TODO: this is the next one to make future match correct..
 */
// $minY, $maxY, $minX, $minY, $minSpeed, $maxSpeed, $minDirection, $maxDirection
TrackedObj.prototype.isMatch = function (group) {

  // 1. thresholding by direction and position
  // TODO: first check that group is inside with certain threshold, +
  // TODO: some calculated shift depending on speed
  // TODO: then check that direction is inside of groups direction

  // 2. for multiple matches calculate probability... for now, just return first match
  // TODO: then calculate match according to group size and position

  return this.isDirectionMatch(group);
};

TrackedObj.prototype.isDirectionMatch = function (group) {
  var minDirection = group.$minDirection-this.options.directionThreshold;
  var maxDirection = group.$maxDirection+this.options.directionThreshold;
  return this.direction > minDirection && this.direction < maxDirection;
};
