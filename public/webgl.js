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

var cameraZMax = 2000;

var objTracker = new ObjTracker();


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

// when need more power, preallocate here 121*68 arrays for vertex info
var vertexPool = [];
// and 121*68 arrays for vertex groups
var vertexGroupPool = [];


// TODO: refactor to Group class....
function generalDirectionOfGroup(group) {
  // average should be calculated actually calculated from every vertex, instead of min / max...
  var generalDirection = group.$minDirection +
    Math.abs(group.$maxDirection - group.$minDirection)/2;
  return generalDirection%1;
}

function generalSpeedOfGroup(group) {
  // average should be calculated actually calculated from every vertex, instead of min / max...
  var generalSpeed = group.$minSpeed +
    Math.abs(group.$maxSpeed - group.$minSpeed)/2;
  return generalSpeed;
};

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
    newGroup.$minSpeed = vertexObj.speed;
    newGroup.$maxSpeed = vertexObj.speed;
    return newGroup;
  }

  function isXYInsideGroup(x,y,group) {
    return (
      x > group.$minX-4 &&
      x < group.$maxX+4 &&
      y > group.$minY-4 &&
      y < group.$maxY+4
    );
  }

  function sectorWidth(start, end) {
    if (start < end) {
      return (end-start);
    } else {
      return (end + 1 - start);
    }
  }

  // if start,end sectors overlap...
  function isDirectionInsideGroup(group1, group2) {
    var threshold = 0.1;
    // normalize sector directions so that min < max and max may be > 1
    var min = group2.$minDirection-threshold;
    var max = group2.$maxDirection+threshold;
    if (max < min) {
      max += 1;
    }
    // check if start / end of group one's sector overlap or if next round overlaps..
    // NOTE: here we could probably optimize a bit by just normalizing group1 limits above and check only once...
    var isInside =
      (group1.$minDirection > min && group1.$minDirection < max) ||
      (group1.$maxDirection > min && group1.$maxDirection < max) ||
      (group1.$minDirection+1 > min && group1.$minDirection+1 < max) ||
      (group1.$maxDirection+1 > min && group1.$maxDirection+1 < max);
    return isInside;
  }

  function isSpeedInsideGroup(group1, group2) {
    var threshold = 0.2;
    var min = group2.$minSpeed-threshold;
    var max = group2.$maxSpeed+threshold;
    var isInside =
      (group1.$minSpeed > min && group1.$minSpeed < max) ||
      (group1.$maxSpeed > min && group1.$maxSpeed < max);
    return isInside;
  }

  //
  // update min / max by optimizing sector size to be as small as possible
  //
  function groupMinMaxDirection(direction, group) {
    var min = group.$minDirection;
    var max = group.$maxDirection;
    // sector overflows 0 point
    if (min > max) {
      max += 1;
    }
    if (direction > min && direction < max) {
      return "NONE";
    }
    if (sectorWidth(direction, group.$maxDirection) <
        sectorWidth(group.$minDirection, direction)) {
      return "MIN";
    } else {
      return "MAX";
    }
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
    if (isXYInsideGroup(vertexObj.x, vertexObj.y, group)) {
      group.push(vertexObj);
      group.$minX = Math.min(vertexObj.x, group.$minX);
      group.$maxX = Math.max(vertexObj.x, group.$maxX);
      // we go through vertices in order height/2 .. -height/2 so no need to update $minY
      group.$minY = vertexObj.y;
      // 3rd and 4th dimensions... speed
      group.$minSpeed = Math.min(vertexObj.speed, group.$minSpeed);
      group.$maxSpeed = Math.max(vertexObj.speed, group.$maxSpeed);
      // and direction... in direction min / max we always go for minimum sector siz
      var whatToUpdate = groupMinMaxDirection(vertexObj.direction, group);
      if (whatToUpdate === "MIN") {
        group.$minDirection = vertexObj.direction;
      } else if (whatToUpdate === "MAX") {
        group.$maxDirection = vertexObj.direction;
      }
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
    vertexObj.dx = dx;
    vertexObj.dy = dy;

    if (dx || dy) {
      hue = (Math.atan2(dy, -dx) / Math.PI + 1) / 2;
      lightness = Math.sqrt(dx * dx + dy * dy) / 128;
      vertexObj.direction = hue;
      vertexObj.speed = lightness;
      movingVerticesCount++;
      z = hue*10*5 + lightness*10;
      roundZ = (Math.round(hue*16)*10) + Math.round(lightness*10);
      addVertexTo2dGroup(roundZ, vertexObj);
    }

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

  /// Combines information of 2 groups and returns new group
  function merge(group1, group2) {
    var newGroup = group1.concat(group2);
    newGroup.$minX = Math.min(group1.$minX, group2.$minX);
    newGroup.$maxX = Math.max(group1.$maxX, group2.$maxX);
    newGroup.$minY = Math.min(group1.$minY, group2.$minY);
    newGroup.$maxY = Math.max(group1.$maxY, group2.$maxY);
    newGroup.$minSpeed = Math.min(group1.$minSpeed, group2.$minSpeed);
    newGroup.$maxSpeed = Math.max(group1.$maxSpeed, group2.$maxSpeed);

    // and merge directions too take group 2 as base (there must be nicer way to handle angles sectors...)
    newGroup.$minDirection = group2.$minDirection;
    newGroup.$maxDirection = group2.$maxDirection;
    // update with group1 min direction
    var whatToUpdate = groupMinMaxDirection(group1.$minDirection, group2);
    if (whatToUpdate === "MIN") {
      newGroup.$minDirection = group1.$minDirection;
    } else if (whatToUpdate === "MAX") {
      newGroup.$minDirection = group1.$minDirection;
    }
    // update with group1 max direction
    whatToUpdate = groupMinMaxDirection(group1.$maxDirection, group2);
    if (whatToUpdate === "MIN") {
      newGroup.$minDirection = group1.$maxDirection;
    } else if (whatToUpdate === "MAX") {
      newGroup.$minDirection = group1.$maxDirection;
    }
    return newGroup;
  }

  /// Merge groups together if they are near enough to each other in xy-plane
  function merge2dGroup(group1, group2) {
    if (
      isXYInsideGroup(group1.$minX, group1.$minY, group2) ||
      isXYInsideGroup(group1.$maxX, group1.$minY, group2) ||
      isXYInsideGroup(group1.$minX, group1.$maxY, group2) ||
      isXYInsideGroup(group1.$maxX, group1.$maxY, group2)
    ) {
      return merge(group1, group2);
    }
    return null;
  }

  /// 4d merge check also that that direction / speed is fine before merging
  function merge4dGroup(group1, group2) {
    if (isDirectionInsideGroup(group1, group2) && isSpeedInsideGroup(group1, group2)) {
      return merge2dGroup(group1, group2);
    }
    return null;
  }

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
      for (group in newGroupPlane) {
        sortedGroups.push(newGroupPlane[group]);
      }
    }
  }
  vertexBuckets = filteredVertexBuckets;

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

  // TODO: calculate average for direction and speed...

  // ------------------------------- END OF VERTEX GROUP DETECTION -----------------------------------

  objTracker.addFrame(sortedGroups);

  // TODO: add ui controls to select which visualizations to show...
  visualizeVertexGroups(sortedGroups);
  visualizeTrackedObjects(objTracker);

  render();

  //
  // Add statistics information
  //
  statsMs.end();
  statsFps.update();
  document.getElementById('movingVertices').textContent = movingVerticesCount;

  // generate group info strings
  var groupInfo = [];
  for (var groupIndex = 0; groupIndex < sortedGroups.length; groupIndex++) {
    var group = sortedGroups[groupIndex];
    groupInfo.push(['<br/><span class="infoLabel">==> Group #', groupIndex, ' Vertices</spane>: ', group.length].join(''));
    groupInfo.push(['<br/><span class="infoLabel">: : : : > $minDirection</spane>: ', group.$minDirection.toPrecision(4)].join(''));
    groupInfo.push(['<br/><span class="infoLabel">: : : : > $maxDirection</spane>: ', group.$maxDirection.toPrecision(4)].join(''));
    groupInfo.push(['<br/><span class="infoLabel">: : : : > $minSpeed</spane>: ', group.$minSpeed.toPrecision(4)].join(''));
    groupInfo.push(['<br/><span class="infoLabel">: : : : > $maxSpeed</spane>: ', group.$maxSpeed.toPrecision(4)].join(''));
  }
  document.getElementById('groupingInfo').innerHTML = groupInfo.join('');
}

//
// Create red rectangles around found groups...
//

var lineMaterial = new THREE.LineBasicMaterial( {
  color: 0xff0000,
  opacity: 0.7,
  linewidth: 10,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

var minMovementMaterial = new THREE.LineBasicMaterial( {
  color: 0x0000ff,
  opacity: 0.7,
  linewidth: 3,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

var maxMovementMaterial = new THREE.LineBasicMaterial( {
  color: 0x00ff00,
  opacity: 0.7,
  linewidth: 3,
  depthWrite: false,
  depthTest: false,
  transparent: true
} );

vertexGroupObjects = [];
function visualizeVertexGroups(groups) {
  // delete old ones
  for (wgObjIndex in vertexGroupObjects) {
    scene.remove(vertexGroupObjects[wgObjIndex]);
  }
  vertexGroupObjects = [];

  // create new for every group in plane
  for (var groupIndex in groups) {
    var group = groups[groupIndex];
    var groupBoundingBox = new THREE.Geometry();
    groupBoundingBox.vertices.push(
      new THREE.Vector3(group.$minX, group.$minY, 70),
      new THREE.Vector3(group.$maxX, group.$minY, 70),
      new THREE.Vector3(group.$maxX, group.$maxY, 70),
      new THREE.Vector3(group.$minX, group.$maxY, 70),
      new THREE.Vector3(group.$minX, group.$minY, 70)
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
      new THREE.Vector3(centerX, centerY, 71),
      new THREE.Vector3(minSpeedStartX, minSpeedStartY, 71),
      new THREE.Vector3(minSpeedEndX, minSpeedEndY, 71),
      new THREE.Vector3(centerX, centerY, 71)
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
      new THREE.Vector3(centerX, centerY, 71),
      new THREE.Vector3(maxSpeedStartX, maxSpeedStartY, 71),
      new THREE.Vector3(maxSpeedEndX, maxSpeedEndY, 71),
      new THREE.Vector3(centerX, centerY, 71)
    );

    var maxSpeedTriangleLine = new THREE.Line(maxSpeedTriangle, maxMovementMaterial);
    vertexGroupObjects.push(maxSpeedTriangleLine);
    scene.add(maxSpeedTriangleLine);
  }
}

var trackedObjectsGraphics = {};
function visualizeTrackedObjects(objTracker) {
  _.each(objTracker.trackedObjs, function (item) {
    var obj = trackedObjectsGraphics[item.id];
    if (!obj) {
      obj = {};
      obj.groupBoundingBox = new THREE.Geometry();
      obj.groupBoundingBox.vertices.push(
        new THREE.Vector3(item.minPosition.x, item.minPosition.y, 70),
        new THREE.Vector3(item.maxPosition.x, item.minPosition.y, 70),
        new THREE.Vector3(item.maxPosition.x, item.maxPosition.y, 70),
        new THREE.Vector3(item.minPosition.x, item.maxPosition.y, 70),
        new THREE.Vector3(item.minPosition.x, item.minPosition.y, 70)
      );

      var lineColor = new THREE.Color();
      lineColor.setHSL(Math.random(), 0.5, 0.4);
      obj.lineMaterial = new THREE.LineBasicMaterial( {
        color: lineColor,
        opacity: 0.7,
        linewidth: 3,
        depthWrite: false,
        depthTest: false,
        transparent: true
      });

      obj.line = new THREE.Line(obj.groupBoundingBox, obj.lineMaterial);
      scene.add(obj.line);
      trackedObjectsGraphics[item.id] = obj;
    } else {
      obj.groupBoundingBox.vertices[0].set(item.minPosition.x, item.minPosition.y, 70);
      obj.groupBoundingBox.vertices[1].set(item.maxPosition.x, item.minPosition.y, 70);
      obj.groupBoundingBox.vertices[2].set(item.maxPosition.x, item.maxPosition.y, 70);
      obj.groupBoundingBox.vertices[3].set(item.minPosition.x, item.maxPosition.y, 70);
      obj.groupBoundingBox.vertices[4].set(item.minPosition.x, item.minPosition.y, 70);
      obj.groupBoundingBox.verticesNeedUpdate = true;

      // TODO: update color according to state

      //obj.groupBoundingBox.elementsNeedUpdate = true;
      //obj.groupBoundingBox.morphTargetsNeedUpdate = true;
      //obj.groupBoundingBox.uvsNeedUpdate = true;
      //obj.groupBoundingBox.normalsNeedUpdate = true;
      //obj.groupBoundingBox.colorsNeedUpdate = true;
      //obj.groupBoundingBox.tangentsNeedUpdate = true;
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
