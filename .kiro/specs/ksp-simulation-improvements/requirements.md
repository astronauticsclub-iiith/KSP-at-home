# Requirements Document

## Introduction

This document captures requirements for a major improvement pass on the KSP-at-Home orbital simulation game. The improvements span six areas: a UI/UX overhaul inspired by the SpaceX ISS docking simulator aesthetic, cinematic launch animation, rocket staging visuals, crash animation with restart capability, an autopilot system for lunar orbit insertion, and an orbit circularization feature. The simulation is built with Three.js, Vite, and Tailwind CSS, running as a 2D orbital mechanics sandbox with Velocity Verlet integration.

## Glossary

- **Simulation**: The KSP-at-Home orbital mechanics game running in the browser via Three.js
- **Flight_UI**: The in-flight heads-up display showing telemetry, controls, and status during orbital flight mode
- **Preflight_Console**: The pre-launch parameter configuration panel shown on the landing screen
- **Telemetry_Panel**: The bottom-left HUD element displaying velocity, acceleration, fuel, mission timer, and status
- **Controls_Panel**: The top-left set of action buttons (prograde, retrograde, predict, undo) shown during flight
- **Launch_Sequence**: The animated transition from pad ignition through ascent to orbital insertion
- **Rocket_Model**: The Three.js 3D group representing the spacecraft (body, nose, engine, fins, window)
- **Capsule_Model**: A smaller orbital-phase spacecraft visual without booster fins or engine bell
- **Crash_State**: The simulation condition where the spacecraft collides with Earth or Moon
- **Autopilot**: An automated guidance system that computes and executes maneuver burns
- **TLI_Burn**: Trans-Lunar Injection burn that sends the spacecraft toward the Moon
- **LOI_Burn**: Lunar Orbit Insertion burn that captures the spacecraft into lunar orbit
- **NRHO**: Near Rectilinear Halo Orbit, a highly elliptical lunar orbit used by NASA's Gateway station
- **Circularization**: A maneuver that adjusts velocity at a point in an elliptical orbit to make the orbit circular
- **Delta_V**: The change in velocity required to perform a maneuver, measured in simulation velocity units
- **Prograde_Burn**: A thrust applied in the direction of current velocity
- **Retrograde_Burn**: A thrust applied opposite to the direction of current velocity
- **lil-gui**: The third-party GUI library currently used for runtime parameter adjustment during flight

## Requirements

### Requirement 1: Unified Control Interface

**User Story:** As a player, I want a single clean control interface that eliminates duplicate information between the lil-gui panel and preflight console, so that I can understand and adjust simulation parameters without confusion.

#### Acceptance Criteria

1. THE Flight_UI SHALL present each adjustable parameter exactly once across all visible panels
2. WHEN the Simulation enters flight mode, THE Flight_UI SHALL display parameter controls using slider inputs with labeled minimum and maximum values
3. THE Flight_UI SHALL display a short descriptive tooltip or label for each parameter explaining its physical meaning and effect on the simulation
4. THE Preflight_Console SHALL use range slider inputs with visible numeric readouts for all continuous parameters (gravity, time step, moon mass, Isp, thrust, dry mass, fuel mass, trajectory look-ahead, launch target radius)
5. THE Flight_UI SHALL remove the lil-gui panel and integrate its functionality into the custom-styled interface
6. THE Flight_UI SHALL display keyboard shortcuts in a single consolidated location without repetition

### Requirement 2: SpaceX Docking Simulator Aesthetic

**User Story:** As a player, I want the interface to have the clean, minimal, professional look of the SpaceX ISS docking simulator, so that the experience feels polished and intentional rather than auto-generated.

#### Acceptance Criteria

1. THE Flight_UI SHALL use a monochrome color palette with selective accent colors for status indicators and active controls
2. THE Flight_UI SHALL use a monospaced or technical sans-serif font for telemetry readouts
3. THE Telemetry_Panel SHALL present data in a compact grid layout with consistent alignment and fixed-width numeric columns
4. THE Controls_Panel SHALL use minimal bordered buttons with clear iconography or concise uppercase labels
5. THE Preflight_Console SHALL use a dark translucent card with subtle borders and no decorative gradients or glowing effects
6. THE Simulation SHALL remove all placeholder text, unused labels, and redundant status messages from the interface

### Requirement 3: Cinematic Launch Animation

**User Story:** As a player, I want the launch sequence to look dramatic and cinematic like an SLS/Artemis launch, so that ignition feels impactful and immersive.

#### Acceptance Criteria

1. WHEN the Launch_Sequence begins, THE Simulation SHALL position the camera at a low upward angle close to the rocket with the exhaust plume dominating the lower frame
2. WHEN the Launch_Sequence begins, THE Simulation SHALL render a large volumetric exhaust plume using particle effects that expand outward and downward from the engine
3. WHILE the Launch_Sequence is active, THE Simulation SHALL apply a radial motion blur effect to particles and background elements proportional to the rocket's ascent speed
4. WHILE the Launch_Sequence is active, THE Simulation SHALL generate billowing smoke particles that persist near the launch point and slowly dissipate over 3 seconds
5. WHEN the Launch_Sequence begins, THE Simulation SHALL shake the camera with a subtle random displacement that diminishes as the rocket gains altitude
6. WHILE the Launch_Sequence is active, THE Simulation SHALL scale the exhaust particle count and spread to at least 3 times the current particle density

### Requirement 4: Rocket Staging Visual

**User Story:** As a player, I want the rocket to visually separate its launch vehicle after reaching orbit, so that only the capsule/service module is shown during orbital flight.

#### Acceptance Criteria

1. WHEN the Launch_Sequence completes and the Simulation enters flight mode, THE Rocket_Model SHALL transition its visual representation to the Capsule_Model by hiding the booster body, fins, and engine bell components
2. THE Capsule_Model SHALL consist of only the nose cone and a shortened service module body without fins or engine bell geometry
3. WHEN staging occurs, THE Simulation SHALL play a brief separation animation showing the booster components drifting away from the capsule over 1.5 seconds
4. THE Capsule_Model SHALL maintain the same position and orientation tracking as the full Rocket_Model

### Requirement 5: Crash Animation and Restart

**User Story:** As a player, I want to see a visual explosion when my spacecraft crashes and have a clear way to restart, so that failures feel consequential and recovery is immediate.

#### Acceptance Criteria

1. WHEN the Crash_State is triggered, THE Simulation SHALL spawn an explosion particle effect at the crash location with a bright flash, expanding debris particles, and a shockwave ring
2. WHEN the Crash_State is triggered, THE Simulation SHALL display the explosion particles for 2 seconds before fading them out
3. WHEN the Crash_State is triggered, THE Flight_UI SHALL display a restart button in the center of the screen within 0.5 seconds of the crash
4. WHEN the Crash_State is triggered, THE Flight_UI SHALL display a message indicating the crash target (Earth or Moon)
5. WHEN the player presses the R key during Crash_State, THE Simulation SHALL reset to the preflight landing screen
6. WHEN the player clicks the restart button during Crash_State, THE Simulation SHALL reset to the preflight landing screen
7. THE Simulation SHALL clear all trajectory predictions, reset spacecraft state, and restore initial fuel when restarting after a crash

### Requirement 6: Autopilot Lunar Orbit Insertion

**User Story:** As a player, I want an autopilot that can fly my rocket into orbit around the Moon, so that I can observe the maneuver sequence and learn orbital mechanics.

#### Acceptance Criteria

1. THE Flight_UI SHALL provide an autopilot activation button with a dropdown to select the target orbit type (NRHO or circular lunar orbit)
2. WHEN the player activates the autopilot with circular orbit selected, THE Autopilot SHALL compute and execute a TLI_Burn to send the spacecraft on a trajectory toward the Moon
3. WHEN the spacecraft reaches the Moon's sphere of influence during autopilot, THE Autopilot SHALL compute and execute a LOI_Burn to capture into a circular orbit at an altitude of 2 Moon radii
4. WHEN the player activates the autopilot with NRHO selected, THE Autopilot SHALL compute and execute burns to insert the spacecraft into a near-rectilinear halo orbit around the Moon with a perilune below 2 Moon radii and apolune above 8 Moon radii
5. WHILE the Autopilot is executing a burn, THE Telemetry_Panel SHALL display the current autopilot phase (coast, TLI burn, LOI burn, correction burn) and remaining Delta_V for the maneuver
6. WHEN the Autopilot completes the final orbit insertion burn, THE Flight_UI SHALL display a confirmation message and deactivate the autopilot
7. IF the Autopilot determines that the spacecraft has insufficient fuel for the planned maneuver sequence, THEN THE Flight_UI SHALL display an insufficient fuel warning and abort the autopilot sequence
8. THE Autopilot SHALL allow the player to cancel autopilot at any time by pressing the Escape key or clicking a cancel button

### Requirement 7: Orbit Circularization

**User Story:** As a player, I want a one-click button to circularize my current orbit, so that I can achieve a stable circular orbit without manually computing and executing the burn.

#### Acceptance Criteria

1. THE Flight_UI SHALL provide a circularize orbit button visible during flight mode
2. WHEN the player activates circularization, THE Simulation SHALL compute the Delta_V required to circularize at the current orbital position relative to the nearest dominant gravitational body
3. WHEN the player activates circularization, THE Simulation SHALL execute a Prograde_Burn or Retrograde_Burn of the computed Delta_V magnitude applied over successive simulation frames
4. IF the spacecraft has insufficient fuel to complete the circularization burn, THEN THE Simulation SHALL burn all remaining fuel and display a notification indicating partial circularization with the remaining Delta_V deficit
5. WHEN circularization completes, THE Telemetry_Panel SHALL display the achieved orbital eccentricity for 3 seconds
