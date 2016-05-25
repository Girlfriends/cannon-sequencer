var renderer;
var scene;
var camera;
var cubeMesh;
var groundMesh;

var world;
var cubeBody;
var groundBody;
var groundMaterial;
var groundContactMaterial;
var time = new Date().getTime();
var dt;
var fmSynth;
var notes = ["C4", "E4", "G4"];
var noteIdx = 0;

var vertexShaders       = $('script[type="x-shader/x-vertex"]');
var fragmentShaders     = $('script[type="x-shader/x-fragment"]');

var shadersLoaderCount  = vertexShaders.length + fragmentShaders.length;

var shadersHolder = { vertex: '', fragment: '' };

function loadShader(shader, type) {
    var $shader = $(shader);

    $.ajax({
        url: $shader.data('src'),
        dataType: 'text',
        context: {
            name: $shader.data('name'),
            type: type
        },
        complete: processShader
    });
}

function processShader( jqXHR, textStatus ) {
    shadersLoaderCount--;
    shadersHolder[this.type] = jqXHR.responseText;

    if ( !shadersLoaderCount ) {
        shadersLoadComplete();
    }
}

function shadersLoadComplete() {
    init();
}

function setupAttributes( geometry ) {
  // TODO: Bring back quads
  var vectors = [
  	new THREE.Vector3( 1, 0, 0 ),
  	new THREE.Vector3( 0, 1, 0 ),
  	new THREE.Vector3( 0, 0, 1 )
  ];
  var position = geometry.attributes.position;
  var centers = new Float32Array( position.count * 3 );
  for ( var i = 0, l = position.count; i < l; i ++ ) {
  	vectors[ i % 3 ].toArray( centers, i * 3 );
  }
  geometry.addAttribute( 'center', new THREE.BufferAttribute( centers, 3 ) );
}

function init() {
  initThree();
  initCannon();
  initTone();

  populateSceneWithRandomBoxes();

  render();
}

function loadAllShaders() {
  loadShader( vertexShaders[0], 'vertex' );
  loadShader( fragmentShaders[0], 'fragment' );
}

function initThree() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 1, 1000 );
  camera.position.set(0, 0, 5);
  camera.lookAt(scene.position);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setClearColor(0x000000, 1.0);
  var ratio = window.devicePixelRatio || 1;
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  var geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  var material = new THREE.MeshNormalMaterial();

  cubeMesh = new THREE.Mesh(geometry, material);
  scene.add(cubeMesh);

  var groundGeometry = new THREE.PlaneGeometry(75, 75);
  groundGeometry = new THREE.BufferGeometry().fromGeometry(groundGeometry);
  var groundMaterial = new THREE.ShaderMaterial( {
  	uniforms: {},
  	vertexShader: shadersHolder.vertex,
  	fragmentShader: shadersHolder.fragment
	} );
	groundMaterial.extensions.derivatives = true;

  setupAttributes(groundGeometry);

  groundMesh = new THREE.Mesh( groundGeometry, groundMaterial );
  scene.add( groundMesh );

  document.body.appendChild(renderer.domElement);
}

function initCannon() {
  world = new CANNON.World();
  world.broadphase = new CANNON.NaiveBroadphase();
  world.iterations = 5;
  world.gravity.set(0, -9.8, 0);

  // Add material for contact
  groundMaterial = new CANNON.Material('groundMaterial');
  groundMaterial.friction = 0.5;
  groundMaterial.restitution = 0.9;
  var groundContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    groundMaterial,
    {
      friction: 0.5,
      restitution: 0.9,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e8,
      frictionEquationRegularizationTime: 3,
    }
  );
  world.addContactMaterial(groundContactMaterial);

  var cubeShape = new CANNON.Box(new CANNON.Vec3(0.5,0.5,0.5));
  var mass = 1;
  cubeBody = new CANNON.Body({
    mass: mass,
    position: new CANNON.Vec3(0, 5, 0),
    material: groundMaterial
  });
  cubeBody.addShape(cubeShape);
  cubeBody.addEventListener("collide", handleCollision);
  world.addBody(cubeBody);

  // Add a ground plane
  var groundShape = new CANNON.Plane();
  groundBody = new CANNON.Body({
    mass: 0,
    shape: groundShape,
    position: new CANNON.Vec3(0, -1, 0),
    material: groundMaterial
  });

  var rotation = new CANNON.Vec3();
  groundBody.quaternion.toEuler(rotation, 'YZX');
  rotation.x += -3.1415/2;
  groundBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z, 'XYZ');

  world.add(groundBody);

  applyRandomImpulseToBody(cubeBody, 5, 0.05);
}

function initTone() {
  fmSynth = new Tone.SimpleFM().toMaster();
}

function trackBody(body) {
  camera.position.set(body.position.x, body.position.y, body.position.z + 10);
  var look = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
  camera.lookAt(look);
}

function render() {
  var now = new Date().getTime();
  dt = (now - time)/1000;
  time = now;
  requestAnimationFrame(render);
  renderer.render( scene, camera );
  updatePhysics();
  trackBody(cubeBody);
}

function updatePhysics() {
  world.step(dt);

  // var rotation = new CANNON.Vec3();
  // cubeBody.quaternion.toEuler(rotation, 'YZX');
  // cubeBody.quaternion.setFromEuler(rotation.x, rotation.y+0.1, rotation.z, 'XYZ');
  cubeMesh.position.copy(cubeBody.position);
  cubeMesh.quaternion.copy(cubeBody.quaternion);
  groundMesh.position.copy(groundBody.position);
  groundMesh.quaternion.copy(groundBody.quaternion);
}

function handleResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleCollision(e) {
  if (e.contact.getImpactVelocityAlongNormal() > 1) {
    fmSynth.triggerAttackRelease(notes[noteIdx], "8n");
    noteIdx = (noteIdx + 1) % notes.length;
  }
}

function populateSceneWithRandomBoxes() {

}

function applyRandomImpulseToBody(body, impulseScale, offsetScale) {
  var localPoint = new CANNON.Vec3(
    (Math.random() - 0.5) * 2 * offsetScale,
    (Math.random() - 0.5) * 2 * offsetScale,
    (Math.random() - 0.5) * 2 * offsetScale
  );
  var localImpulse = new CANNON.Vec3(
    (Math.random() - 0.5) * 2 * impulseScale,
    (Math.random() - 0.5) * 2 * impulseScale,
    (Math.random() - 0.5) * 2 * impulseScale
  );
  body.applyImpulse(localImpulse, localPoint);
}

window.onload = loadAllShaders;
window.addEventListener('resize', handleResize, false);
