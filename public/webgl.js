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

init();

function init() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(10, 1920 / 1080, 5, cameraZMax*2);
  camera.position.z = cameraZMax;

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
        direction: 0, length: 0
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

/**
 * Tracked object should have at least:
 *  x, y, width, height and general direction + speed.
 */
var trackedObjects = {};

// when need more power, preallocate here 121*68 arrays for vertex info
var vertexPool = [];
// and 121*68 arrays for vertex groups
 var vertexGroupPool = [];

function animate(chunk) {

  /**
   * Group vertices by direction / nearbystuff
   */
  var vertexBuckets = { };
  var totalGroups = 0;
  function createNewGroup(vertexObj) {
    totalGroups++;
    var newGroup = [vertexObj];
    newGroup.$minX = vertexObj.x;
    newGroup.$minY = vertexObj.y;
    newGroup.$maxX = vertexObj.x;
    newGroup.$maxY = vertexObj.y;
    newGroup.$minDirection = vertexObj.direction;
    newGroup.$maxDirection = vertexObj.direction;
    newGroup.$minLength = vertexObj.length;
    newGroup.$maxLength = vertexObj.length;
    return newGroup;
  }

  function isInsideGroup(x,y,group) {
    return (
      x > group.$minX-4 &&
      x < group.$maxX+4 &&
      y > group.$minY-4 &&
      y < group.$maxY+4
    );
  }

  /**
   * Add vertex to group if near enough of groups bounding box.
   *
   * @return {Number}
   *   1 if vertex was added,
   *   0 if vertex not near enough,
   *   -1 if no future vertices may be near enough
   */
  function addToGroup(group, vertexObj) {
    // add x,y to group if it is inside boundingbox widened by treshold (4)
    if (isInsideGroup(vertexObj.x, vertexObj.y, group)) {
      group.push(vertexObj);
      group.$minX = Math.min(vertexObj.x, group.$minX);
      group.$maxX = Math.max(vertexObj.x, group.$maxX);
      // we go through vertices in order height/2 .. -height/2 so no need to update $minY
      group.$minY = vertexObj.y;
      // 3rd and 4th dimensions...
      group.$minDirection = Math.min(vertexObj.direction, group.$minDirection);
      group.$maxDirection = Math.max(vertexObj.direction, group.$maxDirection);
      group.$minLength = Math.min(vertexObj.length, group.$minLength);
      group.$maxLength = Math.max(vertexObj.length, group.$maxLength);
      return 1;
    }

    // all future y coordinates are too far away from this group
    if (vertexObj.y < group.$minY-4) {
      return -1;
    }

    return 0;
  }

  /**
   * Adds vertex to correct 2d group in certain position of z-plane.
   *
   * @todo Use data from dx, dy, hue and lightness to do grouping planes smarter
   *       one could e.g. to group first at some too fine grained level
   *       and in the end check if certain levels are near enough be and merge
   *       those levels together (this would be kind of analogous of adding
   *       1 or 2 dimensions more to current 2D grouping)
   *       @see comment after merging groups in plane
   *
   */
  function addVertexTo2dGroup(zBucket, vertexObj) {
    var planeBucket = vertexBuckets[zBucket];
    if (!planeBucket) {
      // create main bucket with initial vertex group
      var planeBucket = [createNewGroup(vertexObj)];
      planeBucket.$finishedGroups = [];
      vertexBuckets[zBucket] = planeBucket;

    } else {
      // find old vertex group to put this vertex
      var groupFound = false;
      for (var groupIndex = 0; groupIndex < planeBucket.length; groupIndex++) {
        var group = planeBucket[groupIndex];
        var result = addToGroup(group, vertexObj);
        if (result === 1) {
          groupFound = true;
          break;
        } else if (result === -1) {
          planeBucket.$finishedGroups.push(group);
          planeBucket.splice(groupIndex,1);
          groupIndex--;
        }
      }
      // couldn't find bucket where is near enough, create new bucket
      if (!groupFound) {
        planeBucket.unshift(createNewGroup(vertexObj));
      }
    }
  }

  //
  // Read frame data, calculate direction and group vertices to kind of blobs
  //

  statsMs.begin();
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
    if (dx || dy) {
      hue = (Math.atan2(dx, dy) / Math.PI + 1) / 2;
      lightness = Math.sqrt(dx * dx + dy * dy) / 128;
      movingVerticesCount++;
      z = hue*10*10 + lightness*10;
      roundZ = (Math.round(hue*16)*10) + Math.round(lightness*10);
      addVertexTo2dGroup(roundZ, vertexObj);
    }

    // update vertex object data for this frame
    vertexObj.dx = dx;
    vertexObj.dy = dy;
    vertexObj.direction = hue;
    vertexObj.length = lightness;

    color.setHSL(hue, 1, lightness + 0.05);
    colors[i + 0] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
    vertices[i + 2] = z;
  }
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));

  //
  // Merge nearby groups in plane which were splitted, because algorithm scans
  // data line by line and groups united after split already happened
  //
  // Also merge $finishedGroups again with all groups.
  //

  var filteredVertexBuckets = {};
  var sortedGroups = [];
  for (var plane in vertexBuckets) {
    var oldGroupPlane = vertexBuckets[plane];

    // filter out groups of less than 4 vertices
    var newGroupPlane = oldGroupPlane.concat(oldGroupPlane.$finishedGroups);
    for (var groupIndex = 0; groupIndex < newGroupPlane.length; groupIndex++) {
      if (newGroupPlane[groupIndex].length < 4) {
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
        if (
          isInsideGroup(group1.$minX, group1.$minY, group2) ||
          isInsideGroup(group1.$maxX, group1.$minY, group2) ||
          isInsideGroup(group1.$minX, group1.$maxY, group2) ||
          isInsideGroup(group1.$maxX, group1.$maxY, group2)
        ) {

          // merge group
          var newGroup = group1.concat(group2);
          newGroup.$minX = Math.min(group1.$minX, group2.$minX);
          newGroup.$maxX = Math.max(group1.$maxX, group2.$maxX);
          newGroup.$minY = Math.min(group1.$minY, group2.$minY);
          newGroup.$maxY = Math.max(group1.$maxY, group2.$maxY);
          newGroup.$minDirection = Math.min(group1.$minDirection, group2.$minDirection);
          newGroup.$maxDirection = Math.max(group1.$maxDirection, group2.$maxDirection);
          newGroup.$minLength = Math.min(group1.$minLength, group2.$minLength);
          newGroup.$maxLength = Math.max(group1.$maxLength, group2.$maxLength);
          newGroupPlane[i1] = newGroup;

          // delete ingested group
          newGroupPlane.splice(i2,1);

          // run merge for new group instead of continuing to next one
          i1--;
          break;
        }
      }
    }

    if (newGroupPlane.length > 0) {
      filteredVertexBuckets[plane] = newGroupPlane;
      for (group in newGroupPlane) {
        sortedGroups.push(newGroupPlane[group]);
      }
    }
  }
  vertexBuckets = filteredVertexBuckets;

  // O(n^2) merge for all groups, this could be made faster if previous phase would sort all groups
  // in xy-plane to know more or less, which groups even may overlap
  console.log("Sorted groupt length", sortedGroups.length);
  // TODO: for each in sortedGroups....

  //
  // Create objects for vertex groups for visualizing found blobs
  //
  visualizeVertexGroups(vertexBuckets);

  // ------------------------------- END OF VERTEX GROUP DETECTION -----------------------------------

  //
  // TODO: Add here object tracking + their visualization
  //
  // The algorithm:
  //
  // 1. Do some probability analysis between last frame and current blobs which are counted ...
  //


  render();

  //
  // Add statistics information
  //
  statsMs.end();
  statsFps.update();
  document.getElementById('movingVertices').textContent = movingVerticesCount;

  // generate group info strings
  var groupInfo = [];
  for (plane in vertexBuckets) {
    var planeGroups = vertexBuckets[plane];
    if (planeGroups.length > 0) {
      groupInfo.push([
        '<br/><span class="infoLabel">Bucket / group count</spane>: ',
        plane, ' / ', planeGroups.length].join(''));
    }
  }
  document.getElementById('groupingInfo').innerHTML = groupInfo.join('');
}

//
// Create red rectangles around found groups...
//

lineMaterial = new THREE.LineBasicMaterial( {
  color: 0xff0000,
  opacity: 0.7,
  linewidth: 10,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

vertexGroupObjects = [];
function visualizeVertexGroups(buckets) {
  // delete old ones
  for (wgObjIndex in vertexGroupObjects) {
    scene.remove(vertexGroupObjects[wgObjIndex]);
  }
  vertexGroupObjects = [];

  // create new for every group in plane
  for (var z in buckets) {
    var plane = buckets[z];
    for (var groupIndex in plane) {
      var group = plane[groupIndex];
      if (group.length === 1) { continue; }
      var groupBoundingBox = new THREE.Geometry();
      groupBoundingBox.vertices.push(
        new THREE.Vector3( group.$minX, group.$minY, z ),
        new THREE.Vector3( group.$maxX, group.$minY, z ),
        new THREE.Vector3( group.$maxX, group.$maxY, z ),
        new THREE.Vector3( group.$minX, group.$maxY, z ),
        new THREE.Vector3( group.$minX, group.$minY, z )
      );
      var line = new THREE.Line( groupBoundingBox, lineMaterial );
      vertexGroupObjects.push(line);
      scene.add(line);
    }
  }
}

/**
 * Mouse controls
 */
var cameraAngleY = 0;  // - PI..PI
var cameraAngleX = 0;  // - PI..PI
var cameraDistance = cameraZMax;
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
