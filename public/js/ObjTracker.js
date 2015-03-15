
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
  for (i = 0; i < groupsByObjIndex.length; i++) {
    var newGroups = groupsByObjIndex[i];
    this.trackedObjs[i].updateState(newGroups);
  }

  // create new groups for all matches which didn't have earlier group
  var newGroups = groupsByObjIndex[null] || [];
  for (i = 0; i < newGroups; i++) {
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

ObjTracker.prototype._groupGroupsToObjects = function (groups) {
  return _.groupBy(groups, function (group) {
    return _.find(this.trackedObjs, function (obj) {
      return obj.isMatch(group);
    }) || null;
  });

  // TODO: if multiple matched, calculate match value to select to which object group belong
  // TODO: for now, just take first match
};

/**
 * Tracked object is actual entity which is being recognized for tracking.
 *
 * When created, object is in 'Fresh' state, which means that if tracking is lost, it will
 * be discarded very aggressively.
 *
 * When object has been alive for enough time,
 *
 * state     Tracking state, New, Active, Passive
 * history   Ring buffer containing few latest object movement data
 *           (we can e.g. recognize acceleration, if we are about to stop or what..).
 *
 * History elements contain:
 *   direction    Direction where object was moving.
 *   speed        Speed of object.
 *   position.x   X position.
 *   position.y   Y position.
 *   width        Width.
 *   height       Height.
 *   size         Number of vertices in object.
 *
 */
function TrackedObj(group, options) {
  var defaults = {
    // Thresholds for changing object state
    dropFreshObjThreshold : 10,
    setActiveThreshold : 25*1,
    setPassiveThreshold : 25*5,
    dropPassiveThreshold : 25*60*3,

    // Thresholds for matching group with object
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.2
  };
  _.defaults(options, defaults);

  this.options = options;

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
TrackedObj.prototype.upadateState = function (matchedGroups) {
  // TODO: update all objects with data just recognized, fix position / size / direction etc. and
  // TODO: update latest verified match...
  //
  // TODO: if group state is new (it havent got enough positive matches) and certain time
  // TODO: lost, then we just should dump the object.
  // TODO:
};

/**
 * Returns true if group could match to object.
 *
 * @param group
 * @returns
 */
// $minY, $maxY, $minX, $minY, $minSpeed, $maxSpeed, $minDirection, $maxDirection
TrackedObj.prototype.isMatch = function (group) {

  // 1. thresholding by direction and position
  // TODO: first check that group is inside with certain threshold, +
  // TODO: some calculated shift depending on speed
  // TODO: then check that direction is inside of groups direction

  // 2. for multiple matches calculate probability... for now, just return first match
  // TODO: then calculate match according to group size and position
  return 0;
};
