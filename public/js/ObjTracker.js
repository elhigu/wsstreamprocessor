
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
 * @param groups
 * @returns {Object|*}
 * @private
 */
ObjTracker.prototype._groupGroupsToObjects = function (groups) {
  var self = this;
  return _.groupBy(groups, function (group) {
    var obj = _(self.trackedObjs)
      .map(function (obj, index) {
        obj.index = index;
        return obj;
      })
      .max(function (obj) {
        obj.tempMatchStrength = obj.matchStrength(group);
        return obj.tempMatchStrength;
      });
      return _.isObject(obj) && obj.tempMatchStrength > 0 && obj.index || -1;
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
    dropFreshObjThreshold : 5,
    setActiveThreshold : 10,
    setPassiveThreshold : 25*5,
    dropPassiveThreshold : 25*60,

    // Thresholds for matching group with object
    positionThreshold : 20,
    speedThreshold : 0.3,
    directionThreshold : 0.3,
    similarityThreshold : 10000
  };

  this.options = _.defaults(options || {}, defaultOptions);

  this.liveness = 0;
  this.inactiveFrames = 0;
  this.activeFrames = 0;
  this.state = TrackedObj.State.Fresh;
  this.direction = group.generalDirection();
  this.speed = group.generalSpeed();
  this.minPosition = { x : group.$minX, y : group.$minY };
  this.maxPosition = { x : group.$maxX, y : group.$maxY };
  this.size = group.vertices.length;
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
    this.liveness--;
    this.inactiveFrames++;
    this.activeFrames = 0;
  } else {
    this.liveness++;
    this.inactiveFrames = 0;
    this.activeFrames++;
    // limit speed of growing / shrinking by setting new position to be average of old / new
    this.minPosition.x = (_(matchedGroups).pluck('$minX').min() + this.minPosition.x)/2;
    this.minPosition.y = (_(matchedGroups).pluck('$minY').min() + this.minPosition.y)/2;
    this.maxPosition.x = (_(matchedGroups).pluck('$maxX').max() + this.maxPosition.x)/2;
    this.maxPosition.y = (_(matchedGroups).pluck('$maxY').max() + this.maxPosition.y)/2;
    this.size = _(matchedGroups).pluck('vertices').pluck('length').sum();
    this.direction = _(matchedGroups)
      .map(function (blob) {
        return blob.generalDirection();
      }).sum() / matchedGroups.length;
    this.speed = _(matchedGroups)
      .map(function (blob) {
        return blob.generalSpeed();
      }).sum() / matchedGroups.length;
  }

  // rough decision if tracked object should be dropped / state should be changed
  if (this.activeFrames > this.options.setActiveThreshold) {
    this.state = TrackedObj.State.Active;
    // reset liveness status to positive if we came out from Passive mode
    this.liveness = Math.max(this.liveness, 1);
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
 *
 * Now we think there is possible match, if position in inside threshold
 */
TrackedObj.prototype.isMatch = function (group) {
  return this.isPositionMatch(group);
};

/**
 * Match strength...
 *
 * We consider speed, direction and group size (number of moving vertices in group)
 * to be deciding factors.
 *
 * Position is pretty hard to utilize, due to nature of motion vector data,
 * where center point of object might change a lot depending how moving vertices
 * are positioned and the noise... someone could make that data useful to be
 * considered here though.
 *
 */
TrackedObj.prototype.matchStrength = function (group) {
  if (this.isMatch(group)) {
    var sizeDiff = this.sizeDifference(group);
    var difference =
      this.directionDifference(group)*
      this.speedDifference(group)*
      sizeDiff*sizeDiff;
    var similarity = 1/difference;
    return similarity > this.options.similarityThreshold ? similarity : 0;
  }
  return 0;
};

/**
 * TODO: one could actually make position threshold bigger to movement direction if object speed is fast
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

TrackedObj.prototype.directionDifference = function (group) {
  var dir1 = this.direction;
  var dir2 = group.generalDirection();
  var maybeThis = Math.abs(dir1-dir2);
  return maybeThis <= 0.5 ? maybeThis : (1-maybeThis);
};

TrackedObj.prototype.speedDifference = function (group) {
  return Math.abs(group.generalSpeed() - this.speed)/80;
};

TrackedObj.prototype.sizeDifference = function (group) {
  return Math.abs(group.vertices.length - this.size)/40;
};

// TODO: Track out group size and position and recognize if object actually left screen
TrackedObj.prototype.isLeavingScreen = function () {
};
