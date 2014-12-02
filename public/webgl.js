var scene, camera, renderer;
var geometry, material, mesh;

var width = Math.floor(1920/16)+1;
var height = Math.floor(1080/16)+1;
var pixels = width*height;
var vertices = new Float32Array(pixels*3);
var colors = new Float32Array(pixels*3);
var statsMs = new Stats();
statsMs.setMode( 1 );
var statsFps = new Stats();

init();

function init() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 1, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 8000;

	geometry = new THREE.BufferGeometry();
	
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			var offset = (y*width+x)*3;
			vertices[ offset + 0 ] = x-width/2;
			vertices[ offset + 1 ] = (height-y)-height/2;
			vertices[ offset + 2 ] = 0;
		}
	}

	geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

    material = new THREE.PointCloudMaterial({ 
    	size: 99.0, 
    	sizeAttenuation : true,
    	vertexColors : THREE.VertexColors
    });
    mesh = new THREE.PointCloud( geometry, material );
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );

    document.body.appendChild( renderer.domElement );

    // stats
   statsMs.domElement.style.position = 'absolute';
   statsMs.domElement.style.top = '0px';
   document.body.appendChild( statsMs.domElement );
   statsFps.domElement.style.position = 'absolute';
   statsFps.domElement.style.top = '30px';
   document.body.appendChild( statsFps.domElement );
}

function animate(chunk) {
    statsMs.begin();
    // update previous frame and record stats, then start processing new chunk
    /*
	struct motion_vector {
	  short sad;
	  char y_vector;
	  char x_vector;
	}
	So encodes more than just the vector but also the SAD (Sum of Absolute Difference) 
	for the block. You can look at this value to get a feel for how well the vector 
	represents the match to the reference frame (I’ve ignored it in creating the gif)
    */
	var data = new DataStream(chunk.data, 0, DataStream.LITTLE_ENDIAN);

	var color = new THREE.Color();
	color.setRGB( Math.random(), Math.random(), Math.random() );

	// TODO: get dx / dy / sad min and max values for stats
	// TODO: I'm pretty sure stuff is not the way that mentioned above
	for (var i = 0; i < pixels*3; i+=3) {
		var sad = data.readInt16();
		var dy = data.readInt8();
		var dx = data.readInt8();
		var sadScaler = sad/65000;
		var threshold = 0;
		colors[i + 0] = dy > threshold ? dy/128 : 0;
		colors[i + 1] = dx/256 + 0.1;
		colors[i + 2] = dy < -threshold ? -dy/128 : 0;
	}
	geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
        renderer.render( scene, camera );
	statsMs.end();
	statsFps.update();
}
