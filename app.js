var renderer;
var scene;
var camera;
var cubeMesh;

var world;
var sphereBody;
var groundMaterial;
var groundContactMaterial;
var time = new Date().getTime();
var dt;
var fmSynth;

function init() {
  initThree();
  initCannon();
  initTone();
  render();
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

  var geometry = new THREE.BoxGeometry(1, 1, 1);
  var material = new THREE.MeshNormalMaterial();

  cubeMesh = new THREE.Mesh(geometry, material);
  scene.add(cubeMesh);

  document.body.appendChild(renderer.domElement);
}

function initCannon() {
  world = new CANNON.World();
  world.broadphase = new CANNON.NaiveBroadphase();
  world.iterations = 10;
  world.gravity.set(0, -9.8, 0);

  // Add material for contact
  groundMaterial = new CANNON.Material('groundMaterial');
  groundMaterial.friction = 0.1;
  groundMaterial.restitution = 1.0;
  var groundContactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    groundMaterial,
    {
      friction: 0.1,
      restitution: 1.0,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3,
      frictionEquationStiffness: 1e8,
      frictionEquationRegularizationTime: 3,
    }
  );
  world.addContactMaterial(groundContactMaterial);

  var sphereShape = new CANNON.Sphere(0.5);
  var cubeShape = new CANNON.Box(new CANNON.Vec3(0.5,0.5,0.5));
  var mass = 1;
  sphereBody = new CANNON.Body({
    mass: mass,
    position: new CANNON.Vec3(0, 0.5, 0),
    material: groundMaterial
  });
  sphereBody.addShape(sphereShape);
  sphereBody.addEventListener("collide", handleCollision);
  world.addBody(sphereBody);

  // Add a ground plane
  var groundShape = new CANNON.Plane();
  var groundBody = new CANNON.Body({
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
}

function initTone() {
  fmSynth = new Tone.SimpleFM().toMaster();
}

function render() {
  var now = new Date().getTime();
  dt = (now - time)/1000;
  time = now;
  requestAnimationFrame(render);
  renderer.render( scene, camera );
  updatePhysics();
}

function updatePhysics() {
  world.step(dt);

  // var rotation = new CANNON.Vec3();
  // sphereBody.quaternion.toEuler(rotation, 'YZX');
  // sphereBody.quaternion.setFromEuler(rotation.x, rotation.y+0.1, rotation.z, 'XYZ');
  cubeMesh.position.copy(sphereBody.position);
  cubeMesh.quaternion.copy(sphereBody.quaternion);
}

function handleResize() {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleCollision(e) {
  fmSynth.triggerAttackRelease("C4", "8n");
}

window.onload = init;
window.addEventListener('resize', handleResize, false);
