import * as THREE from 'three';
import { bodies } from './maneuver.js'

const loader = new THREE.TextureLoader();

// Earth
const earthTexture = loader.load('assets/earth.webp');

const geometry = new THREE.SphereGeometry(1, 64, 64)

const material = new THREE.MeshStandardMaterial({
    map: earthTexture
});

const earth = new THREE.Mesh(geometry, material);
earth.position.x = bodies.earth.pos.x;
earth.position.y = bodies.earth.pos.y;

export { earth };

// moon

const moonTexture = loader.load('assets/moon.webp');

const geometry_moon = new THREE.SphereGeometry(0.4, 64, 64)

const material_moon = new THREE.MeshStandardMaterial({
    map: moonTexture
});


const moon = new THREE.Mesh(geometry_moon, material_moon);
moon.position.x = bodies.moon.pos.x;
moon.position.y = bodies.moon.pos.y;
export { moon }
