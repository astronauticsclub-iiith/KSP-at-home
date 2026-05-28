# Design Document

## Overview

This design covers six major improvements to the KSP-at-Home simulation: a unified UI overhaul with SpaceX-inspired aesthetics, cinematic launch animation, rocket staging visuals, crash animation with restart, an autopilot system for lunar orbit insertion, and orbit circularization. The implementation builds on the existing Three.js + Vite + Tailwind stack and maintains the Velocity Verlet integrator for physics.

## Architecture

### Module Structure

```
src/
├── main.js              (scene setup, animation loop, launch sequence)
├── maneuver.js          (physics, integrator, state) — add autopilot + circularize logic
├── autopilot.js         (NEW: autopilot state machine, burn computation)
├── circularize.js       (NEW: circularization delta-v computation and execution)
├── pod.js               (rocket/capsule models, staging toggle)
├── crash.js             (NEW: crash explosion effect, restart logic)
├── trajectory.js        (prediction — unchanged)
├── planets.js           (celestial bodies — unchanged)
├── ui.js                (telemetry, controls, event bindings — major rewrite)
├── ui-components.js     (NEW: slider component, tooltip, button factory)
├── styles.css           (full restyle to SpaceX aesthetic)
└── launch-effects.js    (NEW: enhanced particle system, smoke, camera shake)
```

### Data Flow

```
[Preflight UI] → syncMissionParameters() → [maneuver.js state]
                                                    ↓
[animate() loop] ← step() ← [Velocity Verlet + burn logic]
       ↓                              ↓
[Three.js render]          [autopilot.js] ←→ [circularize.js]
       ↓                              ↓
[crash.js] ← collision detect    [ui.js telemetry]
       ↓
[restart] → landing mode
```

## Components and Interfaces

### 1. Unified UI (Requirements 1 & 2)

**Strategy:** Remove lil-gui entirely. Replace with custom-built controls that match the SpaceX docking sim aesthetic: dark background, monospaced data, thin borders, no decoration.

**Slider Component:**
```javascript
// ui-components.js
export function createSlider({ id, label, description, min, max, step, value, unit }) → HTMLElement
```
- Returns a styled container with: label, description text, range input, numeric readout
- Emits `input` events for live parameter binding
- Displays min/max bounds at slider ends

**Layout Changes:**
- Preflight: Single-column card with sliders, grouped by category (Physics, Rocket, Prediction)
- Flight: Remove lil-gui. Telemetry panel stays bottom-left. Add a collapsible right-side panel for in-flight parameter tuning
- Keyboard shortcuts: Single `<kbd>` legend block in the telemetry panel footer

**Font:** Use `"JetBrains Mono", "SF Mono", "Consolas", monospace` for all numeric telemetry. System sans-serif for labels.

**Color Palette:**
- Background: `#000000` to `#0a0a0a`
- Panel: `rgba(10, 10, 10, 0.92)` with `1px solid rgba(255,255,255,0.08)` border
- Text: `#e0e0e0` (primary), `#707070` (secondary)
- Accent: `#00e676` (nominal), `#ff5252` (warning/crash), `#448aff` (info)
- No glows, no gradients on panels, no radial background effects

### 2. Cinematic Launch Animation (Requirement 3)

**Strategy:** Enhance the existing launch particle system and camera behavior.

**Camera:**
- Start position: Close and low — offset `(+0.3, -2.5, 4.5)` from rocket base, looking up
- Camera shake: Perlin-style displacement, amplitude `0.15` at ignition, decaying to `0` by t=0.6 of sequence
- Transition: Lerp to the current chase camera over final 20% of launch duration

**Exhaust Plume:**
- Increase `launchParticlesCount` from 320 to 1200
- Add a secondary smoke particle system (gray/white, larger size, slower velocity, longer lifetime 3s)
- Smoke stays at ground level with slight upward drift and horizontal spread
- Plume particles: orange-white core, expanding cone geometry, additive blending

**Motion Blur:**
- Implement via a custom post-processing pass using `THREE.EffectComposer` with a motion blur shader
- Intensity scales from 0 at ignition to peak at mid-ascent, back to 0 at orbit insertion
- Alternative simpler approach: stretched particle trails (elongate particle geometry in velocity direction)

**Implementation Note:** Since adding EffectComposer introduces a dependency on Three.js post-processing, use the particle-trail approach for v1 (stretch particles along velocity vector proportional to speed).

### 3. Rocket Staging (Requirement 4)

**Strategy:** Toggle visibility of mesh children on the existing `pod` Group.

**Pod.js Changes:**
- Tag mesh children: `body.userData.part = 'booster'`, fins/engine → `'booster'`, nose/window → `'capsule'`
- Add a shortened capsule body mesh (shorter cylinder, no fins) tagged as `'capsule'`
- Export `setStage(stage)` function: `'launch'` shows all, `'orbit'` hides booster parts and shows capsule body

**Separation Animation:**
- On stage transition, clone booster meshes into a temporary group
- Animate them drifting backward (negative velocity direction) with slight tumble rotation over 1.5s
- Remove clones after animation completes

### 4. Crash Animation & Restart (Requirement 5)

**Strategy:** New `crash.js` module handles visual effects and restart flow.

**Explosion Effect:**
- Flash: Bright point light at crash position, intensity 5→0 over 0.3s
- Debris particles: 200 particles, random velocity in sphere, orange→gray color fade, 2s lifetime
- Shockwave ring: Expanding torus geometry, transparent, scale 0→3 over 0.8s, then fade

**Restart Flow:**
- On crash: show centered overlay with crash message + "RESTART MISSION" button
- R key listener active only during crash state
- Reset: call `setMode('landing')`, reset all `maneuver.js` state, clear trajectory, restore fuel to configured value

### 5. Autopilot System (Requirement 6)

**Strategy:** State machine in `autopilot.js` that takes control of burn commands.

**State Machine:**
```
IDLE → COMPUTING_TLI → COAST_TO_TLI → TLI_BURN → COAST_TO_MOON → LOI_BURN → ORBIT_ACHIEVED
                                                                            → CORRECTION_BURN → ORBIT_ACHIEVED
```

**TLI Computation:**
- Compute Hohmann-style transfer: target the Moon's predicted position at intercept time
- Use the vis-viva equation to determine required velocity at current position for a transfer orbit that reaches the Moon's orbital radius
- Delta-v = required velocity - current velocity magnitude, applied prograde

**LOI Computation:**
- Detect Moon sphere-of-influence entry (distance < 3 Moon radii)
- For circular orbit: compute circular velocity at target altitude (2 Moon radii), apply retrograde burn for the difference
- For NRHO: target a specific perilune velocity that produces the desired apolune. Approximate by targeting eccentricity ~0.9 with perilune at 1.5 Moon radii

**Fuel Check:**
- Before starting sequence, estimate total delta-v needed (TLI + LOI)
- Compare with available delta-v via Tsiolkovsky: `Δv_available = Isp * ln(m_wet / m_dry)` (in game units, using thrust/Isp as exhaust velocity)
- Abort if insufficient

**Burn Execution:**
- Each frame during a burn phase: apply prograde/retrograde via existing `controls` flags
- Monitor accumulated delta-v; stop burn when target reached
- Between burns: coast (no thrust, normal integration)

### 6. Orbit Circularization (Requirement 7)

**Strategy:** Pure function in `circularize.js` computes required delta-v, then autopilot-style execution.

**Computation:**
```javascript
export function computeCircularizationDeltaV(pos, vel, bodyPos, bodyMass, G) {
    const r = distance(pos, bodyPos);
    const vCircular = Math.sqrt(G * bodyMass / r);
    const vCurrent = magnitude(vel);
    // Positive = prograde burn needed, negative = retrograde
    return vCircular - vCurrent;
}
```

**Dominant Body Detection:**
- Compare gravitational acceleration from Earth vs Moon at current position
- Use the body producing greater acceleration as the reference for circularization

**Execution:**
- Set burn direction (prograde if delta-v > 0, retrograde if < 0)
- Apply thrust each frame, accumulate applied delta-v
- Stop when accumulated ≥ target (or fuel exhausted)
- Show eccentricity in telemetry for 3s after completion

## Data Models

### Spacecraft State

```javascript
{
  position: { x: Number, y: Number },      // World coordinates
  velocity: { x: Number, y: Number },      // Velocity vector
  fuel: Number,                             // Remaining fuel mass
  dryMass: Number,                          // Spacecraft mass without fuel
  thrust: Number,                           // Engine thrust value
  isp: Number,                              // Specific impulse
  stage: 'launch' | 'orbit',               // Current staging state
  crashed: Boolean,                         // Crash state flag
  crashTarget: 'Earth' | 'Moon' | null      // What body was hit
}
```

### Autopilot State

```javascript
{
  active: Boolean,
  phase: 'IDLE' | 'COMPUTING_TLI' | 'COAST_TO_TLI' | 'TLI_BURN' | 'COAST_TO_MOON' | 'LOI_BURN' | 'CORRECTION_BURN' | 'ORBIT_ACHIEVED',
  targetOrbitType: 'circular' | 'nrho',
  plannedDeltaV: Number,                    // Total planned delta-v for current burn
  accumulatedDeltaV: Number,                // Delta-v applied so far in current burn
  burnDirection: 'prograde' | 'retrograde'  // Current burn orientation
}
```

### Crash Event

```javascript
{
  position: { x: Number, y: Number },       // Crash location in world coordinates
  target: 'Earth' | 'Moon',                 // Collided body
  timestamp: Number                         // Mission elapsed time at crash
}
```

### Preflight Parameters

```javascript
{
  gravity: Number,           // Gravitational constant scale
  timeStep: Number,          // Simulation dt
  moonMass: Number,          // Moon mass multiplier
  isp: Number,              // Specific impulse
  thrust: Number,            // Engine thrust
  dryMass: Number,           // Capsule dry mass
  fuelMass: Number,          // Starting fuel mass
  trajectoryLookAhead: Number, // Prediction steps
  launchTargetRadius: Number   // Target orbit radius
}
```

## Correctness Properties

### Property 1: Restart State Consistency
*For any* crash event followed by a restart, the simulation state (position, velocity, fuel, crash flag, trajectory buffer) shall match the initial configuration state defined by the preflight parameters. This is an invariant: restart always produces a valid, deterministic initial state regardless of what caused the crash.

**Validates: Requirements 5.7**

### Property 2: Circularization Produces Near-Zero Eccentricity
*For any* spacecraft state with sufficient fuel orbiting a single dominant body, executing the circularization burn results in an orbital eccentricity below 0.05. Formally: given position `r`, velocity `v`, body mass `M`, and sufficient fuel, after applying `computeCircularizationDeltaV` and executing the burn, the resulting orbit's eccentricity `e < 0.05`.

**Validates: Requirements 7.2, 7.3**

### Property 3: TLI Burn Increases Orbital Energy
*For any* valid spacecraft state in Earth orbit, executing a TLI prograde burn increases the specific orbital energy (ε = v²/2 - μ/r). The autopilot's TLI computation always produces a positive delta-v applied prograde.

**Validates: Requirements 6.2**

### Property 4: Capsule Position Tracking Invariant
*For any* frame after staging, the capsule model's world position matches the simulation's spacecraft position vector (`r.x`, `r.y`). The visual representation and physics state never diverge.

**Validates: Requirements 4.4**

### Property 5: Fuel Conservation During Autopilot
*For any* autopilot sequence, the total fuel consumed equals the sum of `(thrust / Isp) * dt` across all frames where thrust is applied. Fuel mass never goes negative, and the autopilot halts before fuel reaches zero if remaining delta-v exceeds available delta-v.

**Validates: Requirements 6.7**

## Error Handling

### Crash Detection
- Collision with Earth or Moon surface triggers `Crash_State`
- Crash handler spawns visual effect, displays restart UI, and halts physics integration
- Invalid state (NaN position/velocity) is treated as a crash to prevent simulation corruption

### Autopilot Failures
- Insufficient fuel: Detected before burn sequence starts via Tsiolkovsky equation; autopilot aborts with UI warning
- Moon SOI miss: If spacecraft passes Moon's closest approach without entering SOI (distance < 3 Moon radii), autopilot aborts with "trajectory miss" message
- User cancellation: Escape key or cancel button immediately halts all burns and returns to manual control

### Circularization Edge Cases
- Insufficient fuel: Burns all remaining fuel, displays partial circularization notification with remaining delta-v deficit
- Hyperbolic orbit: If specific orbital energy is positive (escape trajectory), circularization is disabled with an explanatory tooltip
- Dominant body ambiguity: If gravitational accelerations from Earth and Moon are within 10% of each other, warn user that circularization may be unstable

### Input Validation
- All preflight slider values are clamped to their defined min/max bounds
- Zero or negative fuel mass prevents launch (button disabled with tooltip)
- Invalid parameter combinations (e.g., thrust = 0) show inline validation warnings

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ui-components.js` | Create | Slider component, tooltip, button factory functions |
| `src/autopilot.js` | Create | Autopilot state machine, TLI/LOI computation, burn execution |
| `src/circularize.js` | Create | Circularization delta-v computation and execution |
| `src/crash.js` | Create | Explosion particles, flash, shockwave, restart overlay UI |
| `src/launch-effects.js` | Create | Enhanced particle system, smoke particles, camera shake logic |
| `src/ui.js` | Modify | Remove lil-gui references, rewrite controls/telemetry with new components |
| `src/maneuver.js` | Modify | Remove GUI instantiation, export additional helpers, add autopilot hooks |
| `src/pod.js` | Modify | Add capsule model, staging tags, setStage() export, separation animation |
| `src/main.js` | Modify | Integrate new modules, update launch sequence, add crash/restart flow |
| `src/styles.css` | Modify | Complete restyle to SpaceX aesthetic, remove decorative gradients |
| `index.html` | Modify | Update markup for new UI layout (sliders, shortcuts legend, autopilot controls, restart overlay) |
| `package.json` | Modify | Remove `lil-gui` dependency |

## Dependencies

- No new npm dependencies required
- Remove: `lil-gui` (replaced by custom UI)
- Three.js post-processing (`EffectComposer`) is optional for v2 motion blur; v1 uses particle stretching

## Testing Strategy

- **Unit tests (Vitest):** `circularize.js` computation, autopilot delta-v calculations, fuel consumption math
- **Property tests:** Circularization eccentricity bounds, TLI energy increase, restart state invariant
- **Manual testing:** Visual quality of launch animation, staging animation smoothness, crash explosion aesthetics, UI layout review
