import * as THREE from 'three';
import { bodies } from '../physics/control_params.js';

const loader = new THREE.TextureLoader();

// Earth
const earthTexture = loader.load('assets/earth.webp');

const geometry = new THREE.SphereGeometry(bodies.earth.r, 64, 64);

const material = new THREE.MeshPhongMaterial({
    map: earthTexture,
});

const earth = new THREE.Mesh(geometry, material);
earth.position.x = bodies.earth.pos.x;
earth.position.y = bodies.earth.pos.y;

export { earth };

// moon

const moonTexture = loader.load('assets/moon.webp');

const geometry_moon = new THREE.SphereGeometry(bodies.moon.r, 64, 64);

const material_moon = new THREE.MeshPhongMaterial({
    map: moonTexture,
});

const moon = new THREE.Mesh(geometry_moon, material_moon);
moon.position.x = bodies.moon.pos.x;
moon.position.y = bodies.moon.pos.y;
export { moon };

//sun

const sunTexture = loader.load('assets/sun.webp');

const geometry_sun = new THREE.SphereGeometry(bodies.sun.r, 64, 64);

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

// Jupiter (fixed: was incorrectly using earth geometry + material)

const jupiterTexture = loader.load('assets/jupiter.jpg');

const jupiterGeometry = new THREE.SphereGeometry(bodies.jupiter.r, 64, 64);

const jupiterMaterial = new THREE.MeshPhongMaterial({
    map: jupiterTexture,
});

const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
jupiter.position.x = bodies.jupiter.pos.x;
jupiter.position.y = bodies.jupiter.pos.y;

export { jupiter };

// Saturn (new — level 2 middle maneuver planet)

const saturnTexture = loader.load('assets/saturn.jpg');

const saturnGeometry = new THREE.SphereGeometry(bodies.saturn.r, 64, 64);

const saturnMaterial = new THREE.MeshPhongMaterial({
    map: saturnTexture,
});

const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
saturn.position.x = bodies.saturn.pos.x;
saturn.position.y = bodies.saturn.pos.y;

export { saturn };

// Neptune (level 3 — middle maneuver planet)

const neptuneTexture = loader.load('assets/neptune.jpg');

const neptuneGeometry = new THREE.SphereGeometry(bodies.neptune.r, 64, 64);

const neptuneMaterial = new THREE.MeshPhongMaterial({
    map: neptuneTexture,
});

const neptune = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
neptune.position.x = bodies.neptune.pos.x;
neptune.position.y = bodies.neptune.pos.y;

export { neptune };

// Pluto (level 3 — destination)

const plutoTexture = loader.load('assets/pluto.webp');

const plutoGeometry = new THREE.SphereGeometry(bodies.pluto.r, 64, 64);

const plutoMaterial = new THREE.MeshPhongMaterial({
    map: plutoTexture,
});

const pluto = new THREE.Mesh(plutoGeometry, plutoMaterial);
pluto.position.x = bodies.pluto.pos.x;
pluto.position.y = bodies.pluto.pos.y;

export { pluto };

// Named mesh lookup map — used by main.js to add planets by name from level.json
export const planetMeshes = { earth, moon, sun, jupiter, saturn, neptune, pluto };