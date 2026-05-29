import * as THREE from 'three'; // 3D objects API

const dir = new THREE.Vector3();
const origin = new THREE.Vector3();
const length = 1;
const color = 0xff0000;
const velArrow = new THREE.ArrowHelper(dir, origin, length, color);

export function update_vector(x, y, vx, vy) {
    // velocity vector
    const vVec = new THREE.Vector3(vx, vy, 0);
    const dir = vVec.clone().normalize();
    velArrow.position.set(x, y, 0);
    velArrow.setDirection(dir);
    velArrow.setLength(2 * vVec.length()); // scale arrow length = 2*speed (just a scale)
}

export { velArrow };
