import * as THREE from 'three';

// ─── Internal State ────────────────────────────────────────────────────────────

let sceneRef = null;

// Exhaust particle system
const EXHAUST_COUNT = 1200;
let exhaustGeometry = null;
let exhaustMaterial = null;
let exhaustPoints = null;
let exhaustPositions = null;
let exhaustVelocities = null;
let exhaustAges = null;
let exhaustLives = null;
let exhaustSizes = null;

// Smoke particle system
const SMOKE_COUNT = 400;
let smokeGeometry = null;
let smokeMaterial = null;
let smokePoints = null;
let smokePositions = null;
let smokeVelocities = null;
let smokeAges = null;
let smokeLives = null;

// ─── Initialization ────────────────────────────────────────────────────────────

/**
 * Sets up the exhaust and smoke particle systems and adds them to the scene.
 * @param {THREE.Scene} scene
 */
export function initLaunchEffects(scene) {
    sceneRef = scene;

    // --- Main exhaust particle system ---
    exhaustPositions = new Float32Array(EXHAUST_COUNT * 3);
    exhaustVelocities = new Float32Array(EXHAUST_COUNT * 3);
    exhaustAges = new Float32Array(EXHAUST_COUNT);
    exhaustLives = new Float32Array(EXHAUST_COUNT);
    exhaustSizes = new Float32Array(EXHAUST_COUNT);

    // Initialize all particles as inactive (age > life)
    for (let i = 0; i < EXHAUST_COUNT; i++) {
        exhaustAges[i] = 1;
        exhaustLives[i] = 0;
        exhaustSizes[i] = 0.2;
    }

    exhaustGeometry = new THREE.BufferGeometry();
    exhaustGeometry.setAttribute('position', new THREE.BufferAttribute(exhaustPositions, 3));
    exhaustGeometry.setAttribute('size', new THREE.BufferAttribute(exhaustSizes, 1));

    exhaustMaterial = new THREE.PointsMaterial({
        color: 0xffddb8,
        size: 0.2,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });

    exhaustPoints = new THREE.Points(exhaustGeometry, exhaustMaterial);
    scene.add(exhaustPoints);

    // --- Secondary smoke particle system ---
    smokePositions = new Float32Array(SMOKE_COUNT * 3);
    smokeVelocities = new Float32Array(SMOKE_COUNT * 3);
    smokeAges = new Float32Array(SMOKE_COUNT);
    smokeLives = new Float32Array(SMOKE_COUNT);

    // Initialize all smoke particles as inactive
    for (let i = 0; i < SMOKE_COUNT; i++) {
        smokeAges[i] = 1;
        smokeLives[i] = 0;
    }

    smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

    smokeMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.6,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.NormalBlending,
        sizeAttenuation: true,
    });

    smokePoints = new THREE.Points(smokeGeometry, smokeMaterial);
    scene.add(smokePoints);
}

// ─── Update ────────────────────────────────────────────────────────────────────

/**
 * Per-frame update: spawns new particles and updates active ones.
 * @param {number} dt - Delta time in seconds
 * @param {THREE.Vector3} rocketPosition - Current rocket position
 * @param {THREE.Vector3} rocketVelocity - Current rocket velocity
 */
export function updateLaunchEffects(dt, rocketPosition, rocketVelocity) {
    if (!exhaustGeometry || !smokeGeometry) return;

    const speed = rocketVelocity.length();
    const velDir = speed > 0.001
        ? rocketVelocity.clone().normalize()
        : new THREE.Vector3(0, 1, 0);

    // Exhaust position: offset behind rocket in velocity direction
    const exhaustOrigin = rocketPosition.clone().sub(velDir.clone().multiplyScalar(0.5));

    // Task 4.6: Scale material base size based on rocket speed for motion blur effect
    // Faster rocket = larger particles that create a stretched/streaked look
    const baseSize = 0.15 + Math.min(speed * 0.05, 0.35);
    exhaustMaterial.size = baseSize;

    // Task 4.6: When moving fast, spawn particles in a trail pattern
    // (closer together along velocity direction) to create streak illusion
    const exhaustSpawnCount = 8 + Math.floor(Math.random() * 5) + Math.floor(speed * 2);
    for (let s = 0; s < exhaustSpawnCount; s++) {
        const idx = findDeadParticle(exhaustAges, exhaustLives, EXHAUST_COUNT);
        if (idx === -1) break;

        const base = idx * 3;

        // For trail effect: offset spawn position along velocity direction
        const trailOffset = speed > 0.5 ? (s / exhaustSpawnCount) * 0.3 : 0;
        const spawnPos = exhaustOrigin.clone().sub(velDir.clone().multiplyScalar(trailOffset));

        // Position at exhaust origin with slight random offset
        exhaustPositions[base] = spawnPos.x + (Math.random() - 0.5) * 0.1;
        exhaustPositions[base + 1] = spawnPos.y + (Math.random() - 0.5) * 0.1;
        exhaustPositions[base + 2] = 0;

        // Velocity: opposite to rocket velocity + random cone spread
        const coneAngle = (Math.random() - 0.5) * 0.6; // ~34 degree cone half-angle
        const baseSpeed = 1.5 + Math.random() * 1.0;
        const oppositeDir = velDir.clone().multiplyScalar(-1);

        // Rotate opposite direction by cone angle in 2D
        const cos = Math.cos(coneAngle);
        const sin = Math.sin(coneAngle);
        const rx = oppositeDir.x * cos - oppositeDir.y * sin;
        const ry = oppositeDir.x * sin + oppositeDir.y * cos;

        exhaustVelocities[base] = rx * baseSpeed + (Math.random() - 0.5) * 0.3;
        exhaustVelocities[base + 1] = ry * baseSpeed + (Math.random() - 0.5) * 0.3;
        exhaustVelocities[base + 2] = 0;

        // Task 4.6: Per-particle size scaled by velocity magnitude
        const particleSpeed = Math.sqrt(
            exhaustVelocities[base] ** 2 + exhaustVelocities[base + 1] ** 2
        );
        exhaustSizes[idx] = Math.min(0.15 + particleSpeed * 0.05, 0.5);

        exhaustAges[idx] = 0;
        exhaustLives[idx] = 0.6 + Math.random() * 0.6; // 0.6–1.2s lifetime
    }

    // --- Spawn smoke particles near launch origin (3-5 per frame) ---
    const smokeSpawnCount = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < smokeSpawnCount; s++) {
        const idx = findDeadParticle(smokeAges, smokeLives, SMOKE_COUNT);
        if (idx === -1) break;

        const base = idx * 3;

        // Smoke near the ground / launch origin (base of rocket)
        smokePositions[base] = exhaustOrigin.x + (Math.random() - 0.5) * 0.8;
        smokePositions[base + 1] = exhaustOrigin.y + (Math.random() - 0.5) * 0.3;
        smokePositions[base + 2] = 0;

        // Mostly horizontal spread + slight upward drift
        smokeVelocities[base] = (Math.random() - 0.5) * 1.2;
        smokeVelocities[base + 1] = 0.1 + Math.random() * 0.3; // slight upward
        smokeVelocities[base + 2] = 0;

        smokeAges[idx] = 0;
        smokeLives[idx] = 2.5 + Math.random() * 1.0; // 2.5–3.5s lifetime
    }

    // --- Update exhaust particles ---
    const gravity = -0.5;
    const drag = 0.97;

    for (let i = 0; i < EXHAUST_COUNT; i++) {
        if (exhaustAges[i] >= exhaustLives[i]) continue;

        const base = i * 3;

        // Apply gravity and drag
        exhaustVelocities[base + 1] += gravity * dt;
        exhaustVelocities[base] *= drag;
        exhaustVelocities[base + 1] *= drag;

        // Update position
        exhaustPositions[base] += exhaustVelocities[base] * dt;
        exhaustPositions[base + 1] += exhaustVelocities[base + 1] * dt;

        // Task 4.6: Update per-particle size based on current velocity (motion blur)
        const vx = exhaustVelocities[base];
        const vy = exhaustVelocities[base + 1];
        const pSpeed = Math.sqrt(vx * vx + vy * vy);
        exhaustSizes[i] = Math.min(0.15 + pSpeed * 0.05, 0.5);

        // Age particle
        exhaustAges[i] += dt;
    }

    // --- Update smoke particles ---
    const smokeDrag = 0.985;
    const smokeGravity = 0.02; // very slight upward drift (positive = up)

    for (let i = 0; i < SMOKE_COUNT; i++) {
        if (smokeAges[i] >= smokeLives[i]) continue;

        const base = i * 3;

        // Slight upward drift, heavy drag
        smokeVelocities[base + 1] += smokeGravity * dt;
        smokeVelocities[base] *= smokeDrag;
        smokeVelocities[base + 1] *= smokeDrag;

        // Update position
        smokePositions[base] += smokeVelocities[base] * dt;
        smokePositions[base + 1] += smokeVelocities[base + 1] * dt;

        // Age particle
        smokeAges[i] += dt;
    }

    // --- Mark buffers for GPU upload ---
    exhaustGeometry.attributes.position.needsUpdate = true;
    exhaustGeometry.attributes.size.needsUpdate = true;
    smokeGeometry.attributes.position.needsUpdate = true;
}

// ─── Disposal ──────────────────────────────────────────────────────────────────

/**
 * Removes particle systems from scene and disposes GPU resources.
 */
export function disposeLaunchEffects() {
    if (sceneRef && exhaustPoints) {
        sceneRef.remove(exhaustPoints);
    }
    if (sceneRef && smokePoints) {
        sceneRef.remove(smokePoints);
    }

    if (exhaustGeometry) {
        exhaustGeometry.dispose();
        exhaustGeometry = null;
    }
    if (exhaustMaterial) {
        exhaustMaterial.dispose();
        exhaustMaterial = null;
    }
    exhaustPoints = null;
    exhaustPositions = null;
    exhaustVelocities = null;
    exhaustAges = null;
    exhaustLives = null;
    exhaustSizes = null;

    if (smokeGeometry) {
        smokeGeometry.dispose();
        smokeGeometry = null;
    }
    if (smokeMaterial) {
        smokeMaterial.dispose();
        smokeMaterial = null;
    }
    smokePoints = null;
    smokePositions = null;
    smokeVelocities = null;
    smokeAges = null;
    smokeLives = null;

    sceneRef = null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find a dead particle in the pool (age >= life) to reuse.
 * Returns the index, or -1 if all particles are active.
 */
function findDeadParticle(ages, lives, count) {
    for (let i = 0; i < count; i++) {
        if (ages[i] >= lives[i]) {
            return i;
        }
    }
    return -1;
}
