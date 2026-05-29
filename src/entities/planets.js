import * as THREE from 'three';
import { bodies } from '../physics/control_params.js';

const loader = new THREE.TextureLoader();

// Earth
const earthTexture = loader.load('assets/earth.webp');

const geometry = new THREE.SphereGeometry(1, 64, 64);

const material = new THREE.MeshPhongMaterial({
    map: earthTexture,
});

const earth = new THREE.Mesh(geometry, material);
earth.position.x = bodies.earth.pos.x;
earth.position.y = bodies.earth.pos.y;

export { earth };

// moon

const moonTexture = loader.load('assets/moon.webp');

const geometry_moon = new THREE.SphereGeometry(0.4, 64, 64);

const material_moon = new THREE.MeshPhongMaterial({
    map: moonTexture,
});

const moon = new THREE.Mesh(geometry_moon, material_moon);
moon.position.x = bodies.moon.pos.x;
moon.position.y = bodies.moon.pos.y;
export { moon };

//sun

const sunTexture = loader.load('assets/sun.webp');

const geometry_sun = new THREE.SphereGeometry(2, 64, 64);

const material_sun = new THREE.MeshStandardMaterial({
    map: sunTexture,

    emissive: 0xffffff,
    emissiveMap: sunTexture,

    emissiveIntensity: 1,
});

const sun = new THREE.Mesh(geometry_sun, material_sun);
sun.position.x = bodies.sun.pos.x;
sun.position.y = bodies.sun.pos.y;
sun.position.z = bodies.sun.pos.z;
export { sun };

//sunlight
const sunlight = new THREE.PointLight(0xffffff, 20);
sunlight.decay = 0; // dosent look lit enough otherwise
sunlight.position.copy(sun.position);
sunlight.castShadow = true;
export { sunlight };
