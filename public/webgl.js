var scene, camera, renderer;
var geometry, material, mesh;

var width = Math.floor(1920 / 16) + 1;
var height = Math.floor(1080 / 16) + 1;
var pixels = width * height;
var vertices = new Float32Array(pixels * 3);
var colors = new Float32Array(pixels * 3);
var vertexObjs = [];
var statsFps = new Stats();
var statsMs = new Stats();
statsMs.setMode(1);

var cameraZMax = 1000;
var cameraZInit = 500;
var SCALE_DEPTH = 0.3;

var objTracker = new ObjTracker();
var blobFinder = new BlobFinder();
var circleMath = {
  /**
   * Returns sector width of two directions.
   * @param dir1 Direction 1 [0 .. 1]
   * @param dir2 Direction 2 [0 .. 1]
   * @returns {Number} Different of directions [0 .. 0.5]
   */
  sectorWidth : function (dir1, dir2) {
    if (dir1 < dir2) {
      return (dir2-dir1);
    } else {
      return (dir2 + 1 - dir1);
    }
  }
};

init();

function init() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(10, 1920 / 1080, 5, cameraZMax*2);
  camera.position.z = cameraZInit;

  geometry = new THREE.BufferGeometry();

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var offset = (y * width + x) * 3;
      vertices[offset + 0] = x - width / 2;
      vertices[offset + 1] = (height - y) - height / 2;
      vertices[offset + 2] = 0;
      vertexObjs.push({
        x: vertices[offset + 0],
        y: vertices[offset + 1],
        dx: 0,
        dy: 0,
        direction: 0, speed: 0
      });
    }
  }

  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  material = new THREE.PointCloudMaterial({
    size: 7,
    sizeAttenuation: true,
    vertexColors: THREE.VertexColors
  });
  mesh = new THREE.PointCloud(geometry, material);
  scene.add(mesh);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(1920, 1080);

  var wrapper = document.getElementById('canvasWrapper');
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = 'auto';
  wrapper.appendChild(renderer.domElement);

  // stats
  statsMs.domElement.style.position = 'absolute';
  statsMs.domElement.style.top = '0px';
  document.body.appendChild(statsMs.domElement);
  statsFps.domElement.style.position = 'absolute';
  statsFps.domElement.style.top = '30px';
  document.body.appendChild(statsFps.domElement);
}

function animate(chunk) {

  //
  // Read frame data, calculate direction and group vertices to kind of blobs
  //

  statsMs.begin();
  blobFinder.reset();
  var data = new DataStream(chunk.data, 0, DataStream.LITTLE_ENDIAN);
  var color = new THREE.Color();
  var movingVerticesCount = 0;
  for (var i = 0; i < pixels * 3; i += 3) {
    var vertexObj = vertexObjs[i/3];
    var dx = data.readInt8();
    var dy = data.readInt8();
    var sad = data.readInt16();

    var hue = 0;
    var lightness = 0;
    var z = 0;
    vertexObj.dx = dx;
    vertexObj.dy = dy;

    if (dx || dy) {
      hue = (Math.atan2(dy, -dx) / Math.PI + 1) / 2;
      lightness = Math.sqrt(dx * dx + dy * dy) / 128;
      vertexObj.direction = hue;
      vertexObj.speed = lightness;
      movingVerticesCount++;
      z = (hue*10*5 + lightness*10)*0.5*SCALE_DEPTH;
      var roundZ = (Math.round(hue*16)*10) + Math.round(lightness*10);
      blobFinder.addVertex(roundZ, vertexObj);
    }

    color.setHSL(hue, 1, lightness + 0.05);
    colors[i + 0] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
    vertices[i + 2] = z;
  }
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));

  var blobs = blobFinder.findBlobs();

  // TODO: add here pass, which could try to estimate all the time how many objects there are in
  //       screen, so that information could be used to help actual object tracking algorithm
  //       to perform a lot better

  objTracker.addFrame(blobs);

  if (document.getElementById('showBlobsCheckbox').checked) {
    visualizeVertexGroups(blobs);
  } else {
    clearVertexGroups();
  }
  if (document.getElementById('showObjsCheckbox').checked) {
    visualizeTrackedObjects(objTracker);
  } else {
    clearTrackedObjects(objTracker);
  }

  document.getElementById('blob_count').textContent = ""+blobs.length;
  document.getElementById('obj_count').textContent = ""+objTracker.trackedObjs.length;

  render();

  statsMs.end();
  statsFps.update();
}

//
// Create red rectangles around found groups...
//

var lineMaterial = new THREE.LineBasicMaterial( {
  color: 0xff0000,
  opacity: 0.7,
  linewidth: 1,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

var minMovementMaterial = new THREE.LineBasicMaterial( {
  color: 0x0000ff,
  opacity: 0.7,
  linewidth: 1,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

var maxMovementMaterial = new THREE.LineBasicMaterial( {
  color: 0x00ff00,
  opacity: 0.7,
  linewidth: 1,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

var vertexGroupObjects = [];
function clearVertexGroups() {
  for (wgObjIndex in vertexGroupObjects) {
    scene.remove(vertexGroupObjects[wgObjIndex]);
  }
}

function visualizeVertexGroups(groups) {
  clearVertexGroups();
  vertexGroupObjects = [];

  // create new for every group in plane
  for (var groupIndex in groups) {
    var group = groups[groupIndex];
    var groupBoundingBox = new THREE.Geometry();
    groupBoundingBox.vertices.push(
      new THREE.Vector3(group.$minX, group.$minY, 30*SCALE_DEPTH),
      new THREE.Vector3(group.$maxX, group.$minY, 30*SCALE_DEPTH),
      new THREE.Vector3(group.$maxX, group.$maxY, 30*SCALE_DEPTH),
      new THREE.Vector3(group.$minX, group.$maxY, 30*SCALE_DEPTH),
      new THREE.Vector3(group.$minX, group.$minY, 30*SCALE_DEPTH)
    );
    var line = new THREE.Line(groupBoundingBox, lineMaterial);
    vertexGroupObjects.push(line);
    scene.add(line);

    // create triangles for visualizing direction / spees
    var centerX = (group.$minX + group.$maxX)/2;
    var centerY = (group.$minY + group.$maxY)/2;
    var speedTriangleScale = 70;
    var startAngleX = Math.cos((group.$minDirection-0.5)*Math.PI*2)*speedTriangleScale;
    var startAngleY = Math.sin((group.$minDirection-0.5)*Math.PI*2)*speedTriangleScale;
    var endAngleX = Math.cos((group.$maxDirection-0.5)*Math.PI*2)*speedTriangleScale;
    var endAngleY = Math.sin((group.$maxDirection-0.5)*Math.PI*2)*speedTriangleScale;

    // blue min speed triangle
    var minSpeedStartX = centerX + startAngleX * group.$minSpeed;
    var minSpeedStartY = centerY + startAngleY * group.$minSpeed;
    var minSpeedEndX = centerX + endAngleX * group.$minSpeed;
    var minSpeedEndY = centerY + endAngleY * group.$minSpeed;
    var minSpeedTriangle = new THREE.Geometry();
    minSpeedTriangle.vertices.push(
      new THREE.Vector3(centerX, centerY, 31*SCALE_DEPTH),
      new THREE.Vector3(minSpeedStartX, minSpeedStartY, 31*SCALE_DEPTH),
      new THREE.Vector3(minSpeedEndX, minSpeedEndY, 31*SCALE_DEPTH),
      new THREE.Vector3(centerX, centerY, 31*SCALE_DEPTH)
    );
    var minSpeedTriangleLine = new THREE.Line(minSpeedTriangle, minMovementMaterial);
    vertexGroupObjects.push(minSpeedTriangleLine);
    scene.add(minSpeedTriangleLine);

    // green max speed triangle
    var maxSpeedStartX = centerX + startAngleX * group.$maxSpeed;
    var maxSpeedStartY = centerY + startAngleY * group.$maxSpeed;
    var maxSpeedEndX = centerX + endAngleX * group.$maxSpeed;
    var maxSpeedEndY = centerY + endAngleY * group.$maxSpeed;
    var maxSpeedTriangle = new THREE.Geometry();
    maxSpeedTriangle.vertices.push(
      new THREE.Vector3(centerX, centerY, 31*SCALE_DEPTH),
      new THREE.Vector3(maxSpeedStartX, maxSpeedStartY, 31*SCALE_DEPTH),
      new THREE.Vector3(maxSpeedEndX, maxSpeedEndY, 31*SCALE_DEPTH),
      new THREE.Vector3(centerX, centerY, 31*SCALE_DEPTH)
    );

    var maxSpeedTriangleLine = new THREE.Line(maxSpeedTriangle, maxMovementMaterial);
    vertexGroupObjects.push(maxSpeedTriangleLine);
    scene.add(maxSpeedTriangleLine);
  }
}

var trackedObjectsGraphics = {};
function clearTrackedObjects() {
  _.each(trackedObjectsGraphics, function (obj) {
    if (obj) { scene.remove(obj.line); }
  });
  trackedObjectsGraphics = {};
}

function visualizeTrackedObjects(objTracker) {
  _.each(objTracker.trackedObjs, function (item) {
    var obj = trackedObjectsGraphics[item.id];
    if (!obj) {
      obj = {};
      obj.groupBoundingBox = new THREE.Geometry();
      obj.groupBoundingBox.vertices.push(
        new THREE.Vector3(item.minPosition.x, item.minPosition.y, 32*SCALE_DEPTH),
        new THREE.Vector3(item.maxPosition.x, item.minPosition.y, 32*SCALE_DEPTH),
        new THREE.Vector3(item.maxPosition.x, item.maxPosition.y, 32*SCALE_DEPTH),
        new THREE.Vector3(item.minPosition.x, item.maxPosition.y, 32*SCALE_DEPTH),
        new THREE.Vector3(item.minPosition.x, item.minPosition.y, 32*SCALE_DEPTH)
      );
      obj.hue = Math.random();
      obj.lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(),
        opacity: 0.7,
        linewidth: 3,
        depthWrite: false,
        depthTest: false,
        transparent: true
      });
      obj.lineMaterial.color.setHSL(obj.hue, 0.5, 0.1);
      obj.line = new THREE.Line(obj.groupBoundingBox, obj.lineMaterial);
      scene.add(obj.line);
      trackedObjectsGraphics[item.id] = obj;
    } else {
      obj.groupBoundingBox.vertices[0].set(item.minPosition.x-0.5, item.minPosition.y-0.5, 32*SCALE_DEPTH);
      obj.groupBoundingBox.vertices[1].set(item.maxPosition.x+0.5, item.minPosition.y-0.5, 32*SCALE_DEPTH);
      obj.groupBoundingBox.vertices[2].set(item.maxPosition.x+0.5, item.maxPosition.y+0.5, 32*SCALE_DEPTH);
      obj.groupBoundingBox.vertices[3].set(item.minPosition.x-0.5, item.maxPosition.y+0.5, 32*SCALE_DEPTH);
      obj.groupBoundingBox.vertices[4].set(item.minPosition.x-0.5, item.minPosition.y-0.5, 32*SCALE_DEPTH);
      obj.groupBoundingBox.verticesNeedUpdate = true;
      obj.groupBoundingBox.dynamic = true;

      // TODO: set more control of width and color depending on
      // TODO: tracked object active / inactive counters...
      if (item.state === 'Active') {
        obj.lineMaterial.color = new THREE.Color();
        obj.lineMaterial.color.setHSL(obj.hue, 1.0, Math.min(Math.max(item.liveness / 25, 0.4), 0.8));
      } else if (item.state === 'Passive') {
        obj.lineMaterial.color = new THREE.Color();
        obj.lineMaterial.color.setHSL(obj.hue, 0.4, 0.25);
      }
      obj.lineMaterial.needsUpdate = true;

      obj.groupBoundingBox.colorsNeedUpdate = true;
      obj.groupBoundingBox.elementsNeedUpdate = true;
      obj.groupBoundingBox.morphTargetsNeedUpdate = true;
      obj.groupBoundingBox.uvsNeedUpdate = true;
      obj.groupBoundingBox.normalsNeedUpdate = true;
      obj.groupBoundingBox.tangentsNeedUpdate = true;

      // TODO: update obj speed direction etc.
    }
    obj.lives = true;
  });

  _.each(trackedObjectsGraphics, function (objToDraw, key) {
    if (objToDraw !== null) {
      if (!objToDraw.lives) {
        scene.remove(objToDraw.line);
        trackedObjectsGraphics[key] = null;
      }
      objToDraw.lives = false;
    }
  });
}

/**
 * Mouse controls
 *
 * TODO: capture pinchzoom...
 */
var cameraAngleY = 0;  // - PI..PI
var cameraAngleX = 0;  // - PI..PI
var cameraDistance = cameraZInit;
document.onmousewheel = function (event) {
  cameraDistance += event.wheelDeltaY * cameraZMax/2000;
  if (cameraDistance < 0) { cameraDistance = 0; }
  if (cameraDistance > cameraZMax) { cameraDistance = cameraZMax; }
  updateCamera();
};

var oldMouseX = null;
var oldMouseY = null;
document.onmousedown = function (evt) {
  oldMouseX = evt.x;
  oldMouseY = evt.y;
};
document.onmouseup = function () {
  oldMouseX = null;
  oldMouseY = null;
};

var zeroPoint = new THREE.Vector3(0,0,0);
var rotationY = new THREE.Matrix4();
var rotationX = new THREE.Matrix4();
var translation = new THREE.Matrix4();
var positionMatrix = new THREE.Matrix4();
document.onmousemove = function (evt) {
  if (oldMouseX != null) {
    var mouseDeltaX = evt.x - oldMouseX;
    var mouseDeltaY = evt.y - oldMouseY;
    cameraAngleY = cameraAngleY -mouseDeltaX*0.01;
    cameraAngleX = cameraAngleX -mouseDeltaY*0.01;

    if (cameraAngleY > Math.PI / 2) { cameraAngleY = Math.PI / 2; }
    if (cameraAngleY < -Math.PI / 2) { cameraAngleY = -Math.PI / 2; }
    if (cameraAngleX > Math.PI / 2) { cameraAngleX = Math.PI / 2; }
    if (cameraAngleX < -Math.PI / 2) { cameraAngleX = -Math.PI / 2; }
    updateCamera();

    oldMouseX = evt.x;
    oldMouseY = evt.y;
  }
};

// move camera to new position
function updateCamera() {
  rotationY.makeRotationY(cameraAngleY);
  rotationX.makeRotationX(cameraAngleX);
  translation.makeTranslation(0, 0, cameraDistance);
  positionMatrix.multiplyMatrices( rotationY, rotationX );
  positionMatrix.multiply( translation );
  camera.matrix.identity();
  camera.applyMatrix(positionMatrix);
  camera.lookAt(zeroPoint);
  render();
}

function render() {
  renderer.render( scene, camera );
}
