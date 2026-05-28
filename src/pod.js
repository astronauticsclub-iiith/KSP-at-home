import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new THREE.TextureLoader();

const hullTexture = loader.load('assets/hull.webp');

const pod = new THREE.Group();

const bodyGeometry = BufferGeometryUtils.mergeVertices(new THREE.CylinderGeometry(0.32, 0.38, 1.95, 32, 1));
bodyGeometry.computeVertexNormals();

const bodyMaterial = new THREE.MeshStandardMaterial({
    map: hullTexture,
    metalness: 0.12,
    roughness: 0.65,
});

const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.rotation.z = Math.PI / 2;
body.userData.part = 'booster';
pod.add(body);

const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.82, 28),
    new THREE.MeshStandardMaterial({ color: 0xdce8f6, metalness: 0.05, roughness: 0.45 }),
);
nose.rotation.z = Math.PI / 2;
nose.position.x = 1.38;
nose.userData.part = 'capsule';
pod.add(nose);

const engineCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.45, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1f2c, metalness: 0.3, roughness: 0.7 }),
);
engineCore.rotation.z = Math.PI / 2;
engineCore.position.x = -1.2;
engineCore.userData.part = 'booster';
pod.add(engineCore);

const engineBell = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.42, 20),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.45, roughness: 0.5 }),
);
engineBell.rotation.z = -Math.PI / 2;
engineBell.position.x = -1.48;
engineBell.userData.part = 'booster';
pod.add(engineBell);

const finMaterial = new THREE.MeshStandardMaterial({ color: 0x9ea7b8, metalness: 0.18, roughness: 0.55 });
const finGeometry = new THREE.BoxGeometry(0.08, 0.5, 0.3);
for (const offset of [-0.3, 0.3]) {
    const finA = new THREE.Mesh(finGeometry, finMaterial);
    finA.position.set(-0.95, 0, offset);
    finA.rotation.z = 0.2;
    finA.userData.part = 'booster';
    pod.add(finA);

    const finB = new THREE.Mesh(finGeometry, finMaterial);
    finB.position.set(-0.95, 0, offset);
    finB.rotation.z = -0.2;
    finB.userData.part = 'booster';
    pod.add(finB);
}

const windowGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x8ac7ff, emissive: 0x1b3d63, emissiveIntensity: 0.6 }),
);
windowGlass.position.x = 0.22;
windowGlass.userData.part = 'capsule';
pod.add(windowGlass);

const exhaustAnchor = new THREE.Object3D();
exhaustAnchor.position.set(-1.62, 0, 0);
exhaustAnchor.userData.part = 'booster';
pod.add(exhaustAnchor);

// Capsule service module — shortened cylinder, positioned directly behind the nose cone.
// Nose cone tip is at x=1.38, cone height=0.82, so nose base is at x≈0.97.
// This cylinder (length 0.8) sits right behind: center at x=0.97 - 0.4 = 0.57
const capsuleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.26, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xc8d6e5, metalness: 0.15, roughness: 0.5 })
);
capsuleBody.rotation.z = Math.PI / 2;
capsuleBody.position.x = 0.57;
capsuleBody.userData.part = 'capsule';
capsuleBody.visible = false;
pod.add(capsuleBody);

pod.scale.set(0.95, 0.95, 0.95);

/**
 * Toggle rocket visual between launch configuration (full stack) and orbit (capsule only).
 * @param {'launch' | 'orbit'} stage
 */
export function setStage(stage) {
    pod.children.forEach(child => {
        if (!child.userData.part) return; // skip non-tagged children

        if (stage === 'launch') {
            child.visible = true;
            // Exception: capsuleBody starts hidden during launch
            if (child === capsuleBody) child.visible = false;
        } else if (stage === 'orbit') {
            if (child.userData.part === 'booster') {
                child.visible = false;
            } else if (child.userData.part === 'capsule') {
                child.visible = true;
            }
        }
    });
}

/**
 * Play booster separation animation: clone booster meshes, drift them backward
 * with tumble rotation over 1.5s, then remove from scene.
 * @param {THREE.Scene} scene - The scene to add the temporary separation group to
 * @param {THREE.Vector3} velocity - Normalized velocity direction of the rocket at separation
 */
export function playSeparation(scene, velocity) {
    const separationGroup = new THREE.Group();

    // Get pod world position for placing clones
    const worldPos = new THREE.Vector3();
    pod.getWorldPosition(worldPos);
    separationGroup.position.copy(worldPos);
    separationGroup.rotation.z = pod.rotation.z;

    // Clone all booster-tagged meshes
    pod.children.forEach(child => {
        if (child.userData.part === 'booster' && child.isMesh) {
            const clone = child.clone();
            clone.material = child.material.clone();
            clone.material.transparent = true;
            clone.visible = true;
            separationGroup.add(clone);
        }
    });

    scene.add(separationGroup);

    const driftDirection = velocity.clone().multiplyScalar(-1); // opposite to flight direction
    const driftSpeed = 0.5; // units per second
    const tumbleRate = 0.02; // radians per frame
    const duration = 1500; // 1.5 seconds in ms
    const startTime = performance.now();

    function animateSeparation() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Move backward
        const dt = 1 / 60; // approximate frame time
        separationGroup.position.x += driftDirection.x * driftSpeed * dt;
        separationGroup.position.y += driftDirection.y * driftSpeed * dt;

        // Add tumble
        separationGroup.rotation.z += tumbleRate;

        // Fade opacity
        separationGroup.children.forEach(child => {
            if (child.material) {
                child.material.opacity = 1 - t;
            }
        });

        if (t < 1) {
            requestAnimationFrame(animateSeparation);
        } else {
            // Clean up: remove from scene and dispose geometries/materials
            separationGroup.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            scene.remove(separationGroup);
        }
    }

    requestAnimationFrame(animateSeparation);
}

export { pod, exhaustAnchor };

// ── Trajectory prediction buffer ──────────────────────────────────────────────
// pathLen is the MAX buffer size — actual drawn points is controlled by pathSteps in params
export const pathLen = 10000;

export const trajectory_Geometry = new THREE.BufferGeometry();
const trajectory_Material = new THREE.PointsMaterial({
    color: 0x00ff88,
    size: 0.5,
    sizeAttenuation: false,
});

const positions = new Float32Array(pathLen * 3);
trajectory_Geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
trajectory_Geometry.setDrawRange(0, 0);

const trajectory = new THREE.Points(trajectory_Geometry, trajectory_Material);
export { trajectory };
