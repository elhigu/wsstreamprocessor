
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

  var groupsByObjIndex = this._mapGroupsToObjects(groups);

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

ObjTracker.prototype._mapGroupsToObjects = function (groups) {
  for (var gi = 0; gi < groups.length; gi++) {
    var mostProbableObj = this._mostProbableObj(groups[gi]);
    // TODO: get list of probabilities which object group belong to...
    // TODO: X,y has biggest weight, direction then and velocity last...
    // TODO: match algorithm has best result is zero... bigger worse e.g.
    // dx*5+dy*5+dd*2+dv... if not in treshold,
    // create new group and take it in for next group in the same frame
  }
};

ObjTracker.prototype._mostProbableObj = function (group) {
  var mostProbable = 1000000;
  for (var i = 0; i < this.trackedObjs; i++) {
    var probability = this.trackedObjs[i].calcMatch(group);
    mostProbable = Math.min(probability, mostProbable);
  }
};


function TrackedObj(group) {
  // TODO: setup initial values for object for matching....
}

// $minY, $maxY, $minX, $minY, $minSpeed, $maxSpeed, $minDirection, $maxDirection
TrackedObj.prototype.calcMatch = function (group) {
  return 0;
};
