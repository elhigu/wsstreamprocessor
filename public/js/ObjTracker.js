
function ObjTracker(options) {
  /**
   * Each tracked object has following properties:
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

  // TODO: update all objects with new group data

  // TODO: check all groups
  // TODO: find if group is part of some existing object
  // TODO: if so, add group to list for updating that group data
  // TODO: if no group found, create new group for object (if new group does not live long enough it will be removed)
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

function TrackedObj(group) {
  // TODO: setup initial values for object for matching....
}

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
