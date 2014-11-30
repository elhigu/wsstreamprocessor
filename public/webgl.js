var scene, camera, renderer;
var geometry, material, mesh;

var height = Math.floor(1080/16);
var width = Math.floor(1920/16);
var pixels =  width*height;
var vertices = new Float32Array(pixels*3);
var colors = new Float32Array(pixels*3);
var stats = new Stats();

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
			vertices[ offset + 1 ] = y-height/2;
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
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	document.body.appendChild( stats.domElement );

}

function animate(chunk) {
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

	var color = new THREE.Color();
	color.setRGB( Math.random(), Math.random(), Math.random() );
	for (var i = 0; i < pixels*3; i+=3) {
		colors[i + 0] = color.r;
		colors[i + 1] = color.g;
		colors[i + 2] = color.b;
	}
	geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

	// I might need to create new mesh / object every frame if need to change attributes
	// var geometryAttributes = new THREE.BufferAttribute(chunk.data, 4);
	// TODO: maybe this should be set to normals?

    // requestAnimationFrame( animate );
    renderer.render( scene, camera );
    stats.update();
}
