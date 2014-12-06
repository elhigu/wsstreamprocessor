var scene, camera, renderer;
var geometry, material, mesh;

var width = Math.floor(1920 / 16) + 1;
var height = Math.floor(1080 / 16) + 1;
var pixels = width * height;
var vertices = new Float32Array(pixels * 3);
var colors = new Float32Array(pixels * 3);
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
    }
  }

  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  material = new THREE.PointCloudMaterial({
    size: 3,
    sizeAttenuation: false,
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

function animate(chunk) {

  /**
   * Group vertices by direction / nearbystuff
   *
   * NOTE: this might perform pretty badly if there are two/more separate
   *       blobs with great height side by side on the same level.
   *
   * TODO: maybe implement some real 2d blob finding algorithm, instead of this adhoc thing
   */
  var vertexBuckets = { };
  var totalGroups = 0;
  function createNewGroup(x,y) {
    totalGroups++;
    var newGroup =[[x,y]];
    newGroup.$minX = x;
    newGroup.$minY = y;
    newGroup.$maxX = x;
    newGroup.$maxY = y;
    return newGroup;
  }

  /**
   * Add vertex to group if near enough of groups bounding box.
   *
   * @return {Boolean} true if vertex was added
   */
  function addToGroup(group, x,y) {
    // add x,y to group if it is inside boundingbox widened by treshold (4)
    if (x > group.$minX-4 &&
        x < group.$maxX+4 &&
        y > group.$minY-4 &&
        y < group.$maxY+4) {
      group.push([x,y]);
      group.$maxY = y; // we go through vertices in order -height/2 .. height/2 so no need to update $minY
      group.$minX = Math.min(x, group.$minX);
      group.$maxX = Math.max(x, group.$maxX);
      return true;
    }
    return false;
  }

  function addVertexToBucket(x, y, z) {
    // select main bucket
    var planeBucket = vertexBuckets[z];
    if (!planeBucket) {
      // create main bucket with initial vertex group
      vertexBuckets[z] = [createNewGroup(x, y)];
    } else {
      // find old vertex group to put this vertex
      var groupFound = false;
      for (var groupIndex = 0; groupIndex < planeBucket.length; groupIndex++) {
        var group = planeBucket[groupIndex];
        if (addToGroup(group, x, y)) {
          groupFound = true;
          break;
        }
      }
      // couldn't find bucket where is near enough, create new bucket
      if (!groupFound) {
        planeBucket.unshift(createNewGroup(x, y));
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
    var dx = data.readInt8();
    var dy = data.readInt8();
    var sad = data.readInt16();


    var hue = 0;
    var lightness = 0;
    var directionAndSpeed = 0;
    if (dx || dy) {
      hue = (Math.atan2(dx, dy) / Math.PI + 1) / 2;
      lightness = Math.sqrt(dx * dx + dy * dy) / 128;
      movingVerticesCount++;
      directionAndSpeed = ((Math.ceil(hue*16)*2) + lightness);
      addVertexToBucket(vertices[i], vertices[i+1], directionAndSpeed);
    }

    color.setHSL(hue, 1, lightness + 0.05);
    colors[i + 0] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
    vertices[i + 2] = directionAndSpeed;
  }
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  renderer.render(scene, camera);

  //
  // Create objects for vertex groups for visualizing found blobs
  //
  visualizeVertexGroups(vertexBuckets);

  statsMs.end();
  statsFps.update();
  document.getElementById('movingVertices').textContent = movingVerticesCount;
  document.getElementById('groupingInfo').textContent = totalGroups;
}

function visualizeVertexGroups(buckets) {
  for (var z in Object.keys(buckets)) {
    var plane = buckets[z];
        
  }
}

/**
 * Mouse controls
 */
document.onmousewheel = function (event) {
  camera.position.z += event.wheelDeltaY * cameraZMax/2000;
  if (camera.position < 0) {
    camera.position.z = 0;
  }
  if (camera.position.z > cameraZMax) {
    camera.position.z = cameraZMax;
  }
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
document.onmousemove = function (evt) {
  if (oldMouseX != null) {
    var mouseDeltaX = evt.x - oldMouseX;
    var mouseDeltaY = evt.y - oldMouseY;
    mesh.rotation.y += mouseDeltaX * 0.01;
    mesh.rotation.x += mouseDeltaY * 0.01;

    if (mesh.rotation.y > Math.PI / 2) {
      mesh.rotation.y = Math.PI / 2;
    }
    if (mesh.rotation.y < -Math.PI / 2) {
      mesh.rotation.y = -Math.PI / 2;
    }

    if (mesh.rotation.x > Math.PI / 2) {
      mesh.rotation.x = Math.PI / 2;
    }
    if (mesh.rotation.x < -Math.PI / 2) {
      mesh.rotation.x = -Math.PI / 2;
    }

    oldMouseX = evt.x;
    oldMouseY = evt.y;
  }
};
