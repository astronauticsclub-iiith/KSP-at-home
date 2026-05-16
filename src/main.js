import * as THREE from'three';
import './styles.css'
const scene = new THREE.Scene()
console.log("here")

// camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.z = 15;
// camera.position.set(-5, 0, 0);
camera.lookAt(0, 0, 0);

// render
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;


//scene
import { earth } from './planets.js';
import { pod } from './pod.js';
import { moon } from './planets.js'
scene.add(pod)
scene.add(earth);
scene.add(moon);

// lights

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 2, 4);
scene.add(light);

const ambient = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambient);

//background
const loader = new THREE.TextureLoader();

loader.load("assets/bg.webp", (texture) => {
    scene.background = texture;
});

// Orbit Equations and Animation loop
import * as STEP from './maneuver.js';
import * as pathMaker from './path.js';

// velocity vectors

const dir = new THREE.Vector3();
const origin = new THREE.Vector3();
const length = 1;
const color = 0xff0000;
const velArrow = new THREE.ArrowHelper(dir, origin, length, color);
scene.add(velArrow);

// trajectory dots (single reusable Points)
const trajectoryGeometry = new THREE.BufferGeometry();
const trajectoryMaterial = new THREE.PointsMaterial({
    color: 0x00ff00,
    size: 0.02,
    sizeAttenuation: false
});
const trajectoryPoints = new THREE.Points(trajectoryGeometry, trajectoryMaterial);
scene.add(trajectoryPoints);

//add zoom features
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;  //2D only
controls.enableDamping = true; 
controls.zoomToCursor = true;
    

//animation loop
function animate() {

    const { x, y, theta, vx, vy,moonx,moony } = STEP.step();
    const path = pathMaker.pathStep();

    pod.position.x = x;
    pod.position.y = y;
    pod.rotation.z = -Math.PI / 2 + theta
    earth.rotation.y += 0.002;


    moon.position.x =moonx
    moon.position.y =moony

    // velocity vector
    const vVec = new THREE.Vector3(vx, vy, 0);

    // set arrow direction (must be normalized)
    const dir = vVec.clone().normalize();

        // update reusable trajectory geometry (one Points object)
        if (Array.isArray(path) && path.length > 0) {
            const positions = new Float32Array(path.length * 3);
            for (let i = 0; i < path.length; i++) {
                positions[i * 3] = path[i].rx;
                positions[i * 3 + 1] = path[i].ry;
                positions[i * 3 + 2] = 0;
            }
            trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            trajectoryGeometry.computeBoundingSphere();
        } else {
            // clear geometry when no path
            trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
        }

    velArrow.position.set(x, y, 0);
    velArrow.setDirection(dir);

    // scale arrow length = 2*speed // just a scale
    velArrow.setLength(2*vVec.length());

    controls.update();  //zoom update
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();


