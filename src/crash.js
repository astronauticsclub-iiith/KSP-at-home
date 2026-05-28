import * as THREE from 'three';

let sceneRef = null;
let flashLight = null;
let debrisGeometry = null;
let debrisMaterial = null;
let debrisPoints = null;
let shockwaveRing = null;
let crashActive = false;
let crashStartTime = 0;

// Debris particle data
const DEBRIS_COUNT = 200;
let debrisPositions, debrisVelocities, debrisAges;

export function triggerCrashEffect(scene, position, target) {
    // Store scene ref for disposal
    sceneRef = scene;
    crashActive = true;
    crashStartTime = performance.now();

    // 6.2: Flash light at crash position, intensity 5
    flashLight = new THREE.PointLight(0xffaa00, 5, 10);
    flashLight.position.set(position.x, position.y, 1);
    scene.add(flashLight);

    // 6.3: Debris particles - 200 particles with spherical random velocity
    debrisPositions = new Float32Array(DEBRIS_COUNT * 3);
    debrisVelocities = new Float32Array(DEBRIS_COUNT * 3);
    debrisAges = new Float32Array(DEBRIS_COUNT);

    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const base = i * 3;
        debrisPositions[base] = position.x;
        debrisPositions[base + 1] = position.y;
        debrisPositions[base + 2] = 0;

        // Random spherical velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        debrisVelocities[base] = Math.cos(angle) * speed;
        debrisVelocities[base + 1] = Math.sin(angle) * speed;
        debrisVelocities[base + 2] = 0;
        debrisAges[i] = 0;
    }

    debrisGeometry = new THREE.BufferGeometry();
    debrisGeometry.setAttribute('position', new THREE.BufferAttribute(debrisPositions, 3));
    debrisMaterial = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 0.15,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    debrisPoints = new THREE.Points(debrisGeometry, debrisMaterial);
    scene.add(debrisPoints);

    // 6.4: Shockwave ring - expanding torus
    const torusGeo = new THREE.TorusGeometry(0.1, 0.03, 8, 32);
    const torusMat = new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
    });
    shockwaveRing = new THREE.Mesh(torusGeo, torusMat);
    shockwaveRing.position.set(position.x, position.y, 0);
    shockwaveRing.rotation.x = Math.PI / 2;
    scene.add(shockwaveRing);
}

// Call this each frame to animate the crash effect
export function updateCrashEffect() {
    if (!crashActive) return;

    const elapsed = (performance.now() - crashStartTime) / 1000; // seconds

    // Flash: intensity 5→0 over 0.3s
    if (flashLight) {
        flashLight.intensity = Math.max(0, 5 * (1 - elapsed / 0.3));
        if (elapsed > 0.3) {
            sceneRef.remove(flashLight);
            flashLight = null;
        }
    }

    // Debris: update positions, fade color orange→gray over 2s
    if (debrisPoints && elapsed < 2) {
        const dt = 1 / 60;
        for (let i = 0; i < DEBRIS_COUNT; i++) {
            const base = i * 3;
            debrisVelocities[base + 1] -= 0.5 * dt; // gravity
            debrisPositions[base] += debrisVelocities[base] * dt;
            debrisPositions[base + 1] += debrisVelocities[base + 1] * dt;
        }
        debrisGeometry.attributes.position.needsUpdate = true;

        // Fade orange→gray
        const t = elapsed / 2;
        const r = THREE.MathUtils.lerp(1.0, 0.4, t);
        const g = THREE.MathUtils.lerp(0.4, 0.4, t);
        const b = THREE.MathUtils.lerp(0.0, 0.4, t);
        debrisMaterial.color.setRGB(r, g, b);
        debrisMaterial.opacity = 1 - t;
    } else if (debrisPoints && elapsed >= 2) {
        sceneRef.remove(debrisPoints);
        debrisGeometry.dispose();
        debrisMaterial.dispose();
        debrisPoints = null;
    }

    // Shockwave: scale 0→3 over 0.8s then fade
    if (shockwaveRing) {
        if (elapsed < 0.8) {
            const scale = (elapsed / 0.8) * 3;
            shockwaveRing.scale.set(scale, scale, scale);
            shockwaveRing.material.opacity = 0.8 * (1 - elapsed / 0.8);
        } else {
            sceneRef.remove(shockwaveRing);
            shockwaveRing.geometry.dispose();
            shockwaveRing.material.dispose();
            shockwaveRing = null;
        }
    }

    // Deactivate after all effects done
    if (!flashLight && !debrisPoints && !shockwaveRing) {
        crashActive = false;
    }
}

export function disposeCrashEffect() {
    if (flashLight && sceneRef) { sceneRef.remove(flashLight); flashLight = null; }
    if (debrisPoints && sceneRef) { sceneRef.remove(debrisPoints); debrisGeometry?.dispose(); debrisMaterial?.dispose(); debrisPoints = null; }
    if (shockwaveRing && sceneRef) { sceneRef.remove(shockwaveRing); shockwaveRing.geometry?.dispose(); shockwaveRing.material?.dispose(); shockwaveRing = null; }
    crashActive = false;
    sceneRef = null;
}

export function isCrashActive() { return crashActive; }
