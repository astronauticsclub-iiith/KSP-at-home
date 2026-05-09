import * as THREE from 'https://unpkg.com/three?module';

const loader = new THREE.TextureLoader();

const earthTexture = loader.load('earth.jpg');

const geometry = new THREE.SphereGeometry(1, 64, 64)

const material = new THREE.MeshStandardMaterial({
    map: earthTexture
});

const earth = new THREE.Mesh(geometry, material);

export {earth};