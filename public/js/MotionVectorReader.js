function MotionVectorReader(options) {
  var defaultOptions = {
    pixelWidth: 1920,
    pixelHeight: 1080
  };
  this.options = _.defaults(options || {}, defaultOptions);

  var vectorWidth = Math.floor(this.options.pixelWidth / 16) + 1;
  var vectorHeight = Math.floor(this.options.pixelHeight / 16) + 1;
  this.vectorWidth = vectorWidth;
  this.vectorHeight = vectorHeight;
  this.frameVectorCount = vectorHeight*vectorWidth;

  this.vertexObjs = [];

  for (var y = 0; y < vectorHeight; y++) {
    for (var x = 0; x < vectorWidth; x++) {
      this.vertexObjs.push({
        x: x - vectorWidth / 2,
        y: (vectorHeight - y) - vectorHeight / 2,
        dx: 0, dy: 0, direction: 0, speed: 0
      });
    }
  }
}

MotionVectorReader.prototype.readFrame = function (chunk, options) {
  var data = new DataStream(chunk.data, 0, DataStream.LITTLE_ENDIAN);
  for (var i = 0; i < this.frameVectorCount; i++) {
    var vertexObj = this.vertexObjs[i];
    var dx = data.readInt8();
    var dy = data.readInt8();
    var sad = data.readInt16();

    var hue = 0;
    var lightness = 0;
    vertexObj.dx = dx;
    vertexObj.dy = dy;

    if (dx || dy) {
      lightness = Math.sqrt(dx * dx + dy * dy) / 128;
      if (lightness < options.minSpeed) {
        vertexObj.direction = 0;
        vertexObj.speed = 0;
      } else {
        hue = (Math.atan2(dy, -dx) / Math.PI + 1) / 2;
        vertexObj.direction = hue;
        vertexObj.speed = lightness;
      }
    } else {
      vertexObj.direction = 0;
      vertexObj.speed = 0;
    }
  }
  return this.vertexObjs;
};
