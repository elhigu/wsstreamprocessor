/**
 * Recognize moving motion vector groups from single frame and
 * calculates direction, area and speed for every group.
 */

function BlobFinder(options) {
  this.vertexBuckets = {};
}

/** not needed new Blob() should do unless pooling is implemented.
BlobFinder.prototype.createNewBlob = function (vertexObj) {
  return new Blob(vertexObj);
};
*/

BlobFinder.prototype.addVertex = function (roundz, vertexObj) {
};

BlobFinder.prototype.findBlobs = function () {
};

function Blob(initialVertex, options) {
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

Blob.prototype.isPositionInside = function (x,y) {
};

Blob.prototype. isDirectionInside = function (other) {
};

Blob.prototype. isSpeedInside = function (other) {
};

Blob.prototype.sectorWidth = function () {
};

Blob.prototype.generalDirection = function () {
};

Blob.prototype.generalSpeed = function () {
};

Blob.prototype.updateMinMaxDirection = function () {
};

