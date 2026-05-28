# Implementation Plan: KSP Simulation Improvements

## Overview

This implementation plan covers six major improvements to the KSP-at-Home simulation: removing lil-gui and building a custom UI component system, restyling to a SpaceX docking simulator aesthetic, adding cinematic launch animation, rocket staging visuals, crash animation with restart, an autopilot system for lunar orbit insertion, and orbit circularization. The implementation uses JavaScript with the existing Three.js + Vite stack.

## Tasks

- [x] 1. Remove lil-gui and Create UI Component System
  - [x] 1.1 Remove `lil-gui` from `package.json` dependencies and run install
    - _Requirements: 1.5_
  - [x] 1.2 Remove all lil-gui imports and GUI instantiation from `src/maneuver.js`
    - _Requirements: 1.5_
  - [x] 1.3 Create `src/ui-components.js` with `createSlider({ id, label, description, min, max, step, value, unit })` that returns a styled range input with label, description tooltip, and numeric readout
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 1.4 Create `createButton({ id, label, icon, variant })` component in `ui-components.js` for consistent control buttons
    - _Requirements: 2.4_
  - [x] 1.5 Update `index.html` preflight console to use range sliders with descriptive labels for all 9 parameters (gravity, dt, moon mass, Isp, thrust, dry mass, fuel mass, path steps, orbit radius)
    - _Requirements: 1.4, 1.1_
  - [x] 1.6 Add a keyboard shortcuts legend section to the telemetry panel showing W/↑ (prograde), S/↓ (retrograde), Ctrl+Z (undo), R (restart) in a single location
    - _Requirements: 1.6_

- [x] 2. Restyle UI to SpaceX Docking Simulator Aesthetic
  - [x] 2.1 Rewrite `src/styles.css` root variables to use monochrome palette: backgrounds `#000`–`#0a0a0a`, panels `rgba(10,10,10,0.92)`, text `#e0e0e0`/`#707070`, accents `#00e676`/`#ff5252`/`#448aff`
    - _Requirements: 2.1_
  - [x] 2.2 Set telemetry font-family to `"JetBrains Mono", "SF Mono", "Consolas", monospace` and apply fixed-width numeric columns
    - _Requirements: 2.2, 2.3_
  - [x] 2.3 Restyle `.mission-card` to dark translucent card with thin `1px solid rgba(255,255,255,0.08)` border, no gradients or glowing pseudo-elements
    - _Requirements: 2.5_
  - [x] 2.4 Restyle all buttons (`.launch-button`, `.control-button`) to minimal bordered style with no gradient backgrounds
    - _Requirements: 2.4_
  - [x] 2.5 Remove decorative radial gradients from `body.app-shell`, `.landing-backdrop`, and `.mission-card::before`
    - _Requirements: 2.5_
  - [x] 2.6 Remove landing page marketing copy (eyebrow, h1, lead paragraph, landing-points) and replace with concise mission briefing text
    - _Requirements: 2.6_
  - [x] 2.7 Update `.telemetry-panel` to use compact grid layout with left-aligned labels and right-aligned monospaced values
    - _Requirements: 2.3_

- [x] 3. Checkpoint - UI system complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Cinematic Launch Animation
  - [x] 4.1 Create `src/launch-effects.js` exporting `initLaunchEffects(scene)`, `updateLaunchEffects(dt, rocketPosition, rocketVelocity)`, and `disposeLaunchEffects()`
    - _Requirements: 3.2, 3.4_
  - [x] 4.2 Increase exhaust particle system to 1200 particles with larger spread cone and orange-white color gradient
    - _Requirements: 3.6, 3.2_
  - [x] 4.3 Add secondary smoke particle system: 400 gray particles, size 0.4–0.8, lifetime 3s, low velocity, stays near launch point with slight upward drift
    - _Requirements: 3.4_
  - [x] 4.4 Implement camera shake: random displacement with amplitude 0.15 at ignition, exponential decay to 0 over 60% of launch duration
    - _Requirements: 3.5_
  - [x] 4.5 Position launch camera at low upward angle: offset `(+0.3, -2.5, 4.5)` from rocket base, looking up at rocket
    - _Requirements: 3.1_
  - [x] 4.6 Implement particle stretching for motion blur effect: elongate particle geometry in velocity direction proportional to speed
    - _Requirements: 3.3_
  - [x] 4.7 Integrate `launch-effects.js` into `main.js` launch sequence, replacing current particle spawning logic
    - _Requirements: 3.2_

- [x] 5. Rocket Staging Visual
  - [x] 5.1 Tag existing pod mesh children with `userData.part`: body/fins/engineCore/engineBell → `'booster'`, nose/windowGlass → `'capsule'`
    - _Requirements: 4.1_
  - [x] 5.2 Add a shortened capsule service module mesh (cylinder 0.24 radius, 0.8 length) tagged as `'capsule'`, initially hidden
    - _Requirements: 4.2_
  - [x] 5.3 Export `setStage(stage)` function from `pod.js`: `'launch'` shows all parts, `'orbit'` hides booster parts and shows capsule body
    - _Requirements: 4.1, 4.4_
  - [x] 5.4 Implement separation animation: on stage change to `'orbit'`, clone booster meshes, animate them drifting backward with tumble over 1.5s, then remove
    - _Requirements: 4.3_
  - [x] 5.5 Call `setStage('orbit')` in `finishLaunchSequence()` in `main.js`
    - _Requirements: 4.1_
  - [x] 5.6 Call `setStage('launch')` when restarting/resetting to landing mode
    - _Requirements: 4.4_
  - [ ]* 5.7 Write property test for capsule position tracking invariant
    - **Property 4: Capsule Position Tracking Invariant**
    - **Validates: Requirements 4.4**

- [x] 6. Crash Animation and Restart
  - [x] 6.1 Create `src/crash.js` exporting `triggerCrashEffect(scene, position, target)` and `disposeCrashEffect()`
    - _Requirements: 5.1_
  - [x] 6.2 Implement explosion flash: point light at crash position, intensity 5→0 over 0.3s
    - _Requirements: 5.1_
  - [x] 6.3 Implement debris particles: 200 particles with spherical random velocity, orange→gray color fade, 2s lifetime
    - _Requirements: 5.1, 5.2_
  - [x] 6.4 Implement shockwave ring: expanding torus geometry, transparent material, scale 0→3 over 0.8s then fade out
    - _Requirements: 5.1_
  - [x] 6.5 Add crash overlay UI to `index.html`: centered panel with crash message, target indicator, and "RESTART MISSION" button, hidden by default
    - _Requirements: 5.3, 5.4_
  - [x] 6.6 Show crash overlay within 0.5s of crash state, displaying "CRASHED INTO EARTH" or "CRASHED INTO MOON"
    - _Requirements: 5.3, 5.4_
  - [x] 6.7 Implement restart logic: R key and button click reset mode to `'landing'`, clear trajectory, reset maneuver state, restore fuel to configured value
    - _Requirements: 5.5, 5.6, 5.7_
  - [x] 6.8 Wire crash detection in `main.js` animate loop to trigger `triggerCrashEffect` and show overlay
    - _Requirements: 5.1_
  - [ ]* 6.9 Write property test for restart state consistency
    - **Property 1: Restart State Consistency**
    - **Validates: Requirements 5.7**

- [x] 7. Checkpoint - Visual systems complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Autopilot System
  - [x] 8.1 Create `src/autopilot.js` with state machine: IDLE, COMPUTING_TLI, COAST_TO_TLI, TLI_BURN, COAST_TO_MOON, LOI_BURN, CORRECTION_BURN, ORBIT_ACHIEVED
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 8.2 Implement TLI delta-v computation using vis-viva equation: target velocity for transfer orbit reaching Moon's orbital radius
    - _Requirements: 6.2_
  - [x] 8.3 Implement Moon sphere-of-influence detection (distance < 3 Moon radii from Moon center)
    - _Requirements: 6.3_
  - [x] 8.4 Implement LOI computation for circular orbit: compute circular velocity at 2 Moon radii altitude, apply retrograde delta-v
    - _Requirements: 6.3_
  - [x] 8.5 Implement NRHO insertion: target perilune velocity producing eccentricity ~0.9 with perilune at 1.5 Moon radii and apolune > 8 Moon radii
    - _Requirements: 6.4_
  - [x] 8.6 Implement fuel sufficiency check using Tsiolkovsky equation before starting sequence; abort with warning if insufficient
    - _Requirements: 6.7_
  - [x] 8.7 Implement burn execution: set controls.prograding/retrograding flags each frame, track accumulated delta-v, stop at target
    - _Requirements: 6.2, 6.3_
  - [x] 8.8 Add autopilot UI: activation button with orbit type dropdown (Circular / NRHO), cancel button, Escape key binding
    - _Requirements: 6.1, 6.8_
  - [x] 8.9 Display autopilot phase and remaining delta-v in telemetry panel during active autopilot
    - _Requirements: 6.5_
  - [x] 8.10 Display confirmation message and deactivate autopilot on orbit achievement
    - _Requirements: 6.6_
  - [x] 8.11 Integrate autopilot step into `main.js` animate loop (call `autopilot.update()` each frame during flight)
    - _Requirements: 6.2_
  - [ ]* 8.12 Write property test for TLI burn increases orbital energy
    - **Property 3: TLI Burn Increases Orbital Energy**
    - **Validates: Requirements 6.2**
  - [ ]* 8.13 Write property test for fuel conservation during autopilot
    - **Property 5: Fuel Conservation During Autopilot**
    - **Validates: Requirements 6.7**

- [x] 9. Orbit Circularization
  - [x] 9.1 Create `src/circularize.js` exporting `computeCircularizationDeltaV(pos, vel, bodyPos, bodyMass, G)` returning signed delta-v (positive = prograde)
    - _Requirements: 7.2_
  - [x] 9.2 Implement dominant body detection: compare gravitational acceleration from Earth vs Moon at current position
    - _Requirements: 7.2_
  - [x] 9.3 Implement circularization burn execution: set burn direction based on delta-v sign, accumulate applied delta-v each frame, stop when target reached or fuel exhausted
    - _Requirements: 7.3_
  - [x] 9.4 Handle insufficient fuel case: burn all remaining fuel, display notification with remaining delta-v deficit
    - _Requirements: 7.4_
  - [x] 9.5 Display achieved orbital eccentricity in telemetry panel for 3 seconds after circularization completes
    - _Requirements: 7.5_
  - [x] 9.6 Add "CIRCULARIZE" button to flight controls panel in `index.html` and wire click handler
    - _Requirements: 7.1_
  - [ ]* 9.7 Write property test for circularization produces near-zero eccentricity
    - **Property 2: Circularization Produces Near-Zero Eccentricity**
    - **Validates: Requirements 7.2, 7.3**

- [x] 10. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses JavaScript with the existing Three.js + Vite stack
- No new npm dependencies are required; lil-gui is removed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["1.5", "1.6", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 3, "tasks": ["4.1", "5.1", "5.2"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "5.3"] },
    { "id": 5, "tasks": ["4.7", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 6, "tasks": ["6.1", "6.5"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.6"] },
    { "id": 8, "tasks": ["6.7", "6.8", "6.9"] },
    { "id": 9, "tasks": ["8.1", "9.1", "9.2"] },
    { "id": 10, "tasks": ["8.2", "8.3", "8.6", "9.6"] },
    { "id": 11, "tasks": ["8.4", "8.5", "8.7", "8.8", "9.3"] },
    { "id": 12, "tasks": ["8.9", "8.10", "8.11", "9.4", "9.5"] },
    { "id": 13, "tasks": ["8.12", "8.13", "9.7"] }
  ]
}
```
