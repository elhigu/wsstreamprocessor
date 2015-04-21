function WebGlMotionVectorReader(options) {
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

  // input data buffer (couldn't get Int8Array type to work... conversion done in shader..)
  this.inputData = new Uint8Array(128*128*4);
  this.inputDataTexture = new THREE.DataTexture( this.inputData, 128, 128, THREE.RGBAFormat, THREE.UnsignedByteType );
  this.inputDataTexture.wrapS = THREE.RepeatWrapping;
  this.inputDataTexture.wrapT = THREE.RepeatWrapping;
  this.inputDataTexture.needsUpdate = true;

  // output as floats
  var outputData = new Float32Array(128*128*4);
  this.dataTexture = new THREE.DataTexture(
    outputData, 128, 128, THREE.RGBAFormat, THREE.FloatType);
  this.offscreenRenderTarget = new THREE.WebGLRenderTarget(128, 128, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, type: THREE.FloatType
  });

  // offscreen render flow
  this.cameraRTT = new THREE.OrthographicCamera(-128/2, 128/2, 128/2, -128/2, -10000, 10000);
  this.sceneRTT = new THREE.Scene();
  var plane = new THREE.PlaneBufferGeometry(128, 128);

  this.quadMaterial = new THREE.ShaderMaterial({
    uniforms: {
      data: {
        type: "t",
        value: this.inputDataTexture
      },
      threshold: { type: "f", value: 0.0 }
    },
    vertexShader: document.getElementById( 'vertexShader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentShaderProcessInputFrame' ).textContent,
    depthWrite: false
  });
  var quad = new THREE.Mesh( plane, this.quadMaterial );
  this.sceneRTT.add( quad );
}

WebGlMotionVectorReader.prototype.readFrame = function (chunk, options) {
  sMs.begin();
  var dataAsByteArray = new Int8Array(chunk.data);
  this.inputData.set(dataAsByteArray);
  this.inputDataTexture.needsUpdate = true;
  this.quadMaterial.uniforms.threshold.value = options.minSpeed;

  // Directly output data to screen...
  //render = _.noop;
  //renderer.render( this.sceneRTT, this.cameraRTT, null, true );

  renderer.render( this.sceneRTT, this.cameraRTT, this.offscreenRenderTarget, true );
  var gl = renderer.getContext();
  gl.readPixels( 0, 0, 128, 128, gl.RGBA, gl.FLOAT, this.dataTexture.image.data );

  for (var i = 0; i < this.frameVectorCount; i++) {
    var vertexObj = this.vertexObjs[i];
    vertexObj.dx = this.dataTexture.image.data[i*4];
    vertexObj.dy = this.dataTexture.image.data[i*4+1];
    vertexObj.direction = this.dataTexture.image.data[i*4+2];
    vertexObj.speed = this.dataTexture.image.data[i*4+3];
  }

  sMs.end();
  return this.vertexObjs;
};
