/**
 * Recognize moving motion vector groups from single frame and
 * calculates direction, area and speed for every group.
 */

function BlobFinder(options) {
  this.vertexBuckets = {};
  this.foundBlobs = [];
}

/**
 * Adds one vertex to blob finder.
 *
 * TODO: maybe we could add all vertices at once and do some fast opengl/simd
 * TODO: processing at first stage? maybe even finding optimal grouping, its only 8k vertices...?
 *
 * @param sortingBucket When grouping this is used to speed up first phase merging
 *                      algorithm to lessen number of groups, where vertex can be added.
 * @param vertexObj One movement vector in screen, corresponding 16x16 block of original image.
 * @param vertexObj.x {Number}
 * @param vertexObj.y {Number}
 * @param vertexObj.dx {Number}
 * @param vertexObj.dy {Number}
 * @param vertexObj.speed {Number}
 * @param vertexObj.direction {Number} Between to 0..1
 */
BlobFinder.prototype.addVertex = function (sortingBucket, vertexObj) {
  var planeBucket = this.vertexBuckets[sortingBucket];
  if (!planeBucket) {
    // create main bucket with initial vertex group
    var planeBucket = [new Blob(vertexObj)];
    planeBucket.$finishedGroups = [];
    this.vertexBuckets[sortingBucket] = planeBucket;
  } else {
    // find old vertex group to put this vertex
    // TODO: is first always the best, or is end result the same anyways?
    var groupFound = false;
    for (var groupIndex = 0; groupIndex < planeBucket.length; groupIndex++) {
      var blob = planeBucket[groupIndex];
      var result = blob.addVertex(vertexObj);
      if (result === 1) {
        groupFound = true;
        break;
      } else if (result === -1) {
        planeBucket.$finishedGroups.push(blob);
        planeBucket.splice(groupIndex,1);
        groupIndex--;
      }
    }
    // couldn't find bucket where is near enough, create new bucket
    if (!groupFound) {
      planeBucket.unshift(new Blob(vertexObj));
    }
  }
};

BlobFinder.prototype.reset = function () {
  this.vertexBuckets = {};
  this.foundBlobs = [];
};

/**
 * Find groups from added vertices
 */
BlobFinder.prototype.findBlobs = function () {

  /// Merge groups together if they are near enough to each other in xy-plane
  function merge2dGroup(group1, group2) {
    if (
      group2.isPositionInside(group1.$minX, group1.$minY) ||
      group2.isPositionInside(group1.$maxX, group1.$minY) ||
      group2.isPositionInside(group1.$minX, group1.$maxY) ||
      group2.isPositionInside(group1.$maxX, group1.$maxY)
    ) {
      group1.merge(group2);
      return group1;
    }
    return null;
  }

  /// 4d merge check also that that direction / speed is fine before merging
  function merge4dGroup(group1, group2) {
    if (group1.isDirectionInside(group2) && group1.isSpeedInside(group2)) {
      return merge2dGroup(group1, group2);
    }
    return null;
  }

  var filteredVertexBuckets = {};
  var sortedGroups = [];
  for (var plane in this.vertexBuckets) {
    var oldGroupPlane = this.vertexBuckets[plane];

    // filter out groups of less than 2 vertices
    var newGroupPlane = oldGroupPlane.concat(oldGroupPlane.$finishedGroups);
    for (var groupIndex = 0; groupIndex < newGroupPlane.length; groupIndex++) {
      if (newGroupPlane[groupIndex].vertices.length < 2) {
        newGroupPlane.splice(groupIndex,1);
        groupIndex--;
      }
    }

    //
    // Brute force merge of nearby groups to bigger ones in the same plane
    //
    for (var i1 = 0; i1 < newGroupPlane.length-1; i1++) {
      var group1 = newGroupPlane[i1];
      for (var i2 = i1+1; i2 < newGroupPlane.length; i2++) {
        var group2 = newGroupPlane[i2];
        // if all future groups are too far away give up already
        if (group1.$maxY < group2.$minY-4) { break; }

        // if any of group corners is inside the other + threshold
        var newGroup = merge2dGroup(group1, group2);
        if (newGroup !== null) {
          newGroupPlane[i1] = newGroup;
          newGroupPlane.splice(i2,1);
          // remove merged group and run merge for new group instead of continuing to next one
          i1--;
          break;
        }
      }
    }

    if (newGroupPlane.length > 0) {
      filteredVertexBuckets[plane] = newGroupPlane;
      for (var group in newGroupPlane) {
        sortedGroups.push(newGroupPlane[group]);
      }
    }
  }
  this.vertexBuckets = filteredVertexBuckets;

  // O(n^2) merge for all groups, this could be made faster if previous phase would sort all groups
  // in xy-plane to know more or less, which groups even may overlap
  for (var g1 = 0; g1 < sortedGroups.length-1; g1++) {
    for (var g2 = g1 + 1; g2 < sortedGroups.length; g2++) {
      var group1 = sortedGroups[g1];
      var group2 = sortedGroups[g2];
      var newGroup = merge4dGroup(group1, group2);
      if (newGroup !== null) {
        sortedGroups[g1] = newGroup;
        // merge was done, remove merged group2 and run merge for index g1 again
        sortedGroups.splice(g2,1);
        g1--;
        break;
      }
    }
  }

  // TODO: maybe precalculate average direction and speed...

  this.vertexBuckets = {};
  return sortedGroups;
};



/**
 * Blob objects, which is extracted from each frame for object tracker.
 *
 * @param initialVertex
 * @param options
 * @constructor
 */
function Blob(initialVertex, options) {
  var defaultOptions = {
    positionThreshold : 4,
    speedThreshold : 0.2,
    directionThreshold : 0.1
  };
  this.options = _.defaults(options || {}, defaultOptions);

  this.$minX = initialVertex.x;
  this.$minY = initialVertex.y;
  this.$maxX = initialVertex.x;
  this.$maxY = initialVertex.y;
  this.$minDirection = initialVertex.direction;
  this.$maxDirection = initialVertex.direction;
  this.$minSpeed = initialVertex.speed;
  this.$maxSpeed = initialVertex.speed;
  this.vertices = [initialVertex];
}

/**
 * Add vertex to group if near enough of groups bounding box.
 *
 * @return {Number}
 *   1 if vertex was added,
 *   0 if vertex not near enough,
 *   -1 if no future vertices may be near enough
 */
Blob.prototype.addVertex = function (vertexObj) {
  if (this.isPositionInside(vertexObj.x, vertexObj.y)) {
    this.vertices.push(vertexObj);
    this.$minX = Math.min(vertexObj.x, this.$minX);
    this.$maxX = Math.max(vertexObj.x, this.$maxX);
    // we go through vertices in order height/2 .. -height/2 so no need to update $minY
    this.$minY = vertexObj.y;
    // 3rd and 4th dimensions... speed
    this.$minSpeed = Math.min(vertexObj.speed, this.$minSpeed);
    this.$maxSpeed = Math.max(vertexObj.speed, this.$maxSpeed);
    // and direction... in direction min / max we always go for minimum sector siz
    this.updateDirection(vertexObj.direction);
    return 1;
  }

  // all future y coordinates are too far away from this group
  if (vertexObj.y < this.$minY-4) {
    return -1;
  }

  return 0;
};

Blob.prototype.merge = function (other) {
  this.vertices = this.vertices.concat(other.vertices);
  this.$minX = Math.min(this.$minX, other.$minX);
  this.$maxX = Math.max(this.$maxX, other.$maxX);
  this.$minY = Math.min(this.$minY, other.$minY);
  this.$maxY = Math.max(this.$maxY, other.$maxY);
  this.$minSpeed = Math.min(this.$minSpeed, other.$minSpeed);
  this.$maxSpeed = Math.max(this.$maxSpeed, other.$maxSpeed);
  this.updateDirection(other.$minDirection);
  this.updateDirection(other.$maxDirection);
};

Blob.prototype.isPositionInside = function (x,y) {
  var th = this.options.positionThreshold;
  return (x > this.$minX-th && x < this.$maxX+th && y > this.$minY-th && y < this.$maxY+th);
};

Blob.prototype.isDirectionInside = function (other) {
  var threshold = this.options.directionThreshold;
  // normalize sector directions so that min < max and max may be > 1
  var min = other.$minDirection-threshold;
  var max = other.$maxDirection+threshold;
  if (max < min) {
    max += 1;
  }
  var isInside =
    (this.$minDirection > min && other.$minDirection < max) ||
    (this.$maxDirection > min && other.$maxDirection < max) ||
    (this.$minDirection+1 > min && other.$minDirection+1 < max) ||
    (this.$maxDirection+1 > min && other.$maxDirection+1 < max);
  return isInside;
};

Blob.prototype.isSpeedInside = function (other) {
  var threshold = this.options.speedThreshold;
  var min = other.$minSpeed-threshold;
  var max = other.$maxSpeed+threshold;
  var isInside =
    (this.$minSpeed > min && this.$minSpeed < max) ||
    (this.$maxSpeed > min && this.$maxSpeed < max);
  return isInside;
};

Blob.prototype.generalDirection = function () {
  // average should be calculated actually calculated from every vertex, instead of min / max...
  var generalDirection = this.$minDirection +
    Math.abs(this.$maxDirection - this.$minDirection)/2;
  return generalDirection%1;
};

Blob.prototype.generalSpeed = function () {
  // average should be calculated actually calculated from every vertex, instead of min / max...
  var generalSpeed = this.$minSpeed +
    Math.abs(this.$maxSpeed - this.$minSpeed)/2;
  return generalSpeed;
};

Blob.prototype.updateDirection = function (direction) {
  var min = this.$minDirection;
  var max = this.$maxDirection;
  // sector overflows 0 point
  if (min > max) {
    max += 1;
  }
  if (direction > min && direction < max) {
    return;
  }
  var widthWithMax = circleMath.sectorWidth(direction, this.$maxDirection);
  var widthWithMin = circleMath.sectorWidth(this.$minDirection, direction);
  if (widthWithMax < widthWithMin) {
    this.$minDirection = direction;
  } else {
    this.$maxDirection = direction;
  }
};

