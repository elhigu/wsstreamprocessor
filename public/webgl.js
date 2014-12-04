var scene, camera, renderer;
var geometry, material, mesh;

var width = Math.floor(1920 / 16) + 1;
var height = Math.floor(1080 / 16) + 1;
var pixels = width * height;
var vertices = new Float32Array(pixels * 3);
var colors = new Float32Array(pixels * 3);
var statsMs = new Stats();
statsMs.setMode(1);
var statsFps = new Stats();

init();

function init() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 8000;

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
    size: 99.0,
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

document.onmousewheel = function (event) {
  camera.position.z += event.wheelDeltaY * 0.5;
  if (camera.position < 0) {
    camera.position.z = 0;
  }
  if (camera.position.z > 8000) {
    camera.position.z = 8000;
  }
};

var oldMouseX = null;
var oldMouseY = null;
document.onmousedown = function (evt) {
  oldMouseX = evt.x;
  oldMouseY = evt.y;
}
document.onmouseup = function () {
  oldMouseX = null;
  oldMouseY = null;
}
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
}

function animate(chunk) {
  statsMs.begin();
  var data = new DataStream(chunk.data, 0, DataStream.LITTLE_ENDIAN);
  var color = new THREE.Color();
  for (var i = 0; i < pixels * 3; i += 3) {
    var dx = data.readInt8();
    var dy = data.readInt8();
    var sad = data.readInt16();
    var hue = (Math.atan2(dx, dy) / Math.PI + 1) / 2;
    var lightness = Math.sqrt(dx * dx + dy * dy) / 128;
    color.setHSL(hue, 1, lightness + 0.05);
    colors[i + 0] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  renderer.render(scene, camera);
  statsMs.end();
  statsFps.update();
}
