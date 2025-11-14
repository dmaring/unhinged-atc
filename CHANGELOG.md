# Changelog - Unhinged ATC

## 2025-11-14 - Initial Development Session

### Core Infrastructure
- **Monorepo Setup**: Created pnpm workspace with three packages:
  - `packages/client`: React + TypeScript + Vite frontend
  - `packages/server`: Node.js + Express + Socket.io backend
  - `packages/shared`: Shared TypeScript types
- **WebSocket Integration**: Real-time multiplayer communication using Socket.io
- **State Management**: Zustand store for client-side game state
- **Game Loop**: 60 FPS server-side game loop with delta compression

### Aircraft Simulation System
- **Physics Engine** (`AircraftPhysics.ts`):
  - 60 FPS physics simulation with 15x time scale multiplier for fast-paced gameplay
  - Realistic aircraft movement (heading, altitude, speed, fuel)
  - Trail history rendering for radar effect
  - Performance characteristics for 5 aircraft types (B738, A320, B77W, E75L, C172)

- **Game Room** (`GameRoom.ts`):
  - Multiplayer room management with controller tracking
  - Auto-spawn system maintaining 3-5 aircraft in airspace
  - Random aircraft spawning at map edges with varied airlines (UAL, DAL, AAL, SWA, JBU, ASA, FFT)
  - Dynamic aircraft spawn with randomized targets (±30° heading, ±5000 ft altitude, ±50 kts speed)
  - Out-of-bounds detection with penalties

- **Command System** (`CommandProcessor.ts`):
  - Turn to heading
  - Climb/descend to altitude
  - Change speed
  - Command validation and feedback

### Radar Display
- **Canvas Rendering** (`RadarDisplay.tsx`):
  - Real-time radar visualization with requestAnimationFrame loop
  - Range rings at 5, 10, 15 NM
  - Aircraft icons (triangles) oriented by heading
  - Color coding: green (normal), cyan (selected), red (collided)
  - Trail history visualization
  - Data tags showing callsign, flight level
  - Emergency indicators
  - Compass overlay (N/E/S/W)
  - Click-to-select aircraft interaction

### Control Panel
- **Command Interface** (`ControlPanel.tsx`):
  - Quick turn buttons (±15°, ±30°)
  - Quick altitude buttons (±1000 ft, ±2000 ft)
  - Precise heading/altitude/speed input fields
  - Real-time aircraft information display (callsign, type, position, altitude, speed, fuel)

### Visual Design
- **Retro CRT Aesthetic**:
  - Phosphor green color scheme (#00FF00)
  - Monospace font (Share Tech Mono)
  - Scanline overlay effect
  - Dark terminal background
  - High-contrast UI elements

### Bug Fixes

#### Issue 1: Aircraft Not Moving on Screen
- **Problem**: Initial game state received but no delta updates reaching client
- **Root Cause**: Server only emitted `state_update` when `aircraftUpdates.length > 0`, but this condition was too strict
- **Fix**: Changed `GameEngine.ts:64` to always emit state deltas on every game loop tick (60 FPS)
- **Location**: `/packages/server/src/game/GameEngine.ts:62-64`

#### Issue 2: Some Aircraft Appearing Static
- **Problem**: Aircraft spawned with identical current and target values (heading, altitude, speed)
- **Root Cause**: No variation in initial targets meant aircraft flew in perfectly straight lines
- **Fix**: Added randomization to spawn targets in `GameRoom.ts:282-291`:
  - ±30 degrees heading variation
  - ±5000 feet altitude variation
  - ±50 knots speed variation
- **Location**: `/packages/server/src/game/GameRoom.ts:272-319`

### Performance Optimizations
- **Time Scale Multiplier**: 15x speed multiplier for exciting gameplay while maintaining realistic fuel consumption
- **Ref-based Rendering**: Used React refs in radar display to prevent render loop restarts on prop changes
- **Delta Compression**: Only send changed aircraft data to minimize bandwidth

### Network Protocol
- **Events**:
  - `join_room`: Join a game room with username
  - `game_state`: Initial full game state on join
  - `state_update`: 60 FPS delta updates with aircraft positions
  - `aircraft_command`: Issue commands to aircraft
  - `command_issued`: Broadcast command feedback
  - `game_event`: Achievement/warning notifications
  - `controller_update`: Player join/leave notifications

### Configuration
- **Radar Config** (`RADAR_CONFIG`):
  - Range rings: 5, 10, 15 NM
  - Background: #000a0a
  - Primary color: #00FF00
  - Aircraft size: 8px
  - Trail length: 30 positions (~0.5s at 60 FPS)

- **Game Config** (`GAME_CONFIG`):
  - Tick rate: 60 FPS
  - Airspace bounds: -25 to 25 NM (50 NM × 50 NM)

### Data Models
- **Aircraft**: Position, altitude, heading, speed, fuel, callsign, type, targets, trail history
- **Controller**: ID, username, commands issued, score
- **GameState**: Aircraft map, controllers, airspace, score, events
- **StateDelta**: Aircraft updates, new/removed aircraft, events

## 2025-11-14 - Phase 3: Core Gameplay Implementation

### Collision Detection System
- **CollisionDetector Module** (`packages/server/src/game/CollisionDetector.ts`):
  - Real-time proximity detection between all aircraft pairs
  - Separation standards enforcement (5 NM horizontal, 1000 ft vertical)
  - Three severity levels:
    - **Warning**: Proximity alert, potential conflict
    - **Near-miss**: Both horizontal and vertical separation violated
    - **Collision**: Very close proximity (<0.5 NM, <500 ft)
  - Conflict state tracking to prevent event spam
  - Automatic collision consequence handling (aircraft marked as collided, speed set to 0)

- **Visual Indicators**:
  - Orange dashed warning circles around aircraft in conflict
  - Color-coded aircraft based on state:
    - Red: Collided
    - Orange: In conflict
    - Gold: On approach
    - Orange-red: Low fuel
    - Cyan: Selected
    - Green: Normal

- **Scoring Integration**:
  - Near-miss penalty: -100 points
  - Collision penalty: -500 points
  - Real-time game state tracking (nearMisses, collisions counters)

### Fuel Management System
- **Fuel Consumption**:
  - Realistic fuel burn based on speed and altitude
  - Higher consumption at low altitudes and high speeds
  - Time-scaled fuel depletion (maintains 15x time scale)

- **Warning System**:
  - Low fuel warning: <30% fuel remaining
  - Fuel emergency: <10% fuel remaining
  - Emergency type marked on aircraft
  - Fuel emergency penalty: -75 points

- **Visual Indicators**:
  - Fuel percentage displayed for low fuel aircraft
  - "FUEL X%" emergency indicator in red
  - Orange-red aircraft color for low fuel
  - Real-time fuel tracking in control panel

### Landing System
- **LandingSystem Module** (`packages/server/src/game/LandingSystem.ts`):
  - Automatic approach detection within 10 NM of airports
  - Flight phase transitions (cruise → approach → landing)
  - Landing criteria validation:
    - Runway alignment: ±15 degrees
    - Glideslope: 3-degree approach (300 ft/NM)
    - Safe speed: ≤200 knots
    - Proximity: ≤0.5 NM from runway
    - Altitude: ≤500 ft for touchdown

- **Go-Around Logic**:
  - Failed landing detection (wrong alignment, altitude, or speed)
  - Automatic missed approach procedure (climb to 3000 ft)
  - Go-around penalty: -50 points
  - Pilot complaint events

- **Landing Scoring**:
  - Successful landing: +100 points
  - Fuel efficient landing (>30% fuel): +25 bonus points
  - Emergency landing penalty: -50 points
  - Automatic aircraft removal after 5 seconds (taxi to gate)

### Airport Visualization
- **Radar Display Enhancements**:
  - Airport symbols (white squares) at airport positions
  - Runway indicators showing heading orientation
  - Airport codes labeled (KSFO, KOAK)
  - Approach phase indicator ("APPR") for aircraft on approach

### Event System Improvements
- **New Event Types**:
  - `conflict_detected`: Proximity warnings
  - `near_miss`: Separation violations
  - `collision`: Aircraft collisions
  - `landing_success`: Successful landings
  - `pilot_complaint`: Go-arounds and issues
  - `emergency`: Fuel emergencies

- **Event Broadcasting**:
  - Real-time events sent to clients via `newEvents` in StateDelta
  - Event deduplication to prevent spam
  - Recent events limited to last 20
  - Events displayed with severity levels (info, warning, critical, funny)

### Integration & Testing
- **Build System**:
  - TypeScript compilation fixes
  - Type annotations for Express and Socket.io
  - Vite environment type declarations
  - CSS module type support
  - All packages build successfully

- **Server Integration**:
  - Collision detection runs every game tick (60 FPS)
  - Landing checks on every update
  - Fuel status monitoring
  - Event generation and broadcasting

- **Client Integration**:
  - Airports passed to RadarDisplay
  - Events used for conflict highlighting
  - Enhanced visual feedback
  - Real-time state synchronization

### File Changes
**New Files**:
- `packages/server/src/game/CollisionDetector.ts` (115 lines)
- `packages/server/src/game/LandingSystem.ts` (127 lines)
- `packages/client/src/vite-env.d.ts` (16 lines)

**Modified Files**:
- `packages/server/src/game/GameRoom.ts`: Added collision detection, fuel warnings, landing system
- `packages/client/src/components/RadarDisplay/RadarDisplay.tsx`: Added airport rendering, conflict warnings, enhanced indicators
- `packages/client/src/App.tsx`: Pass airports and events to RadarDisplay
- `packages/server/src/index.ts`: Type annotations
- `packages/client/src/hooks/useWebSocket.ts`: Explicit return type

## 2025-11-14 - Phase 4: Visual Enhancements Implementation

### Waypoint Navigation System
- **Waypoint Markers** (`RadarDisplay.tsx`):
  - 13 waypoints strategically placed across airspace
  - Entry/exit points at airspace edges (ENTRY_N, ENTRY_S, ENTRY_E, ENTRY_W)
  - KSFO approach fixes (KSFO_IAF_N, KSFO_IAF_S, KSFO_FAF) with altitude restrictions
  - KOAK approach fixes (KOAK_IAF_N, KOAK_IAF_E, KOAK_FAF) with altitude restrictions
  - Intermediate waypoints (MIDPT, HOLD_1, HOLD_2)
  - Visual rendering with light blue diamond symbols
  - Waypoint labels with altitude restrictions displayed

- **Integration**:
  - Waypoints defined in `GameRoom.ts` airspace initialization
  - Passed through game state to client
  - Rendered on radar with distinct visual style from aircraft and airports

### Dynamic Weather System
- **Weather Generation** (`WeatherSystem.ts`):
  - Three weather types: clouds, storms, turbulence
  - Automatic spawning every 2 minutes (configurable interval)
  - Weather cells spawn at random airspace edges
  - Realistic movement with velocity vectors (0.5 NM/s drift)
  - Automatic expiration (2-5 minutes based on type)
  - Out-of-bounds cleanup

- **Weather Types**:
  - **Clouds**: 8 NM radius, 5 min duration, light gray, reduce visibility
  - **Storms**: 6 NM radius, 4 min duration, orange/red, hazard zones (-25 points penalty)
  - **Turbulence**: 4 NM radius, 2 min duration, yellow, aircraft instability

- **Gameplay Integration**:
  - Real-time collision detection between aircraft and weather cells
  - Scoring penalties for entering storm cells
  - Event generation for weather interactions
  - Weather state synchronized via WebSocket deltas

- **Visual Rendering**:
  - Semi-transparent circles with type-specific colors
  - Weather symbols (☁ for clouds, ⚡ for storms, 〰 for turbulence)
  - Rendered behind aircraft layer for proper depth ordering

### WebGL CRT Shader Effects
- **Dual-Canvas Rendering Architecture**:
  - Offscreen Canvas 2D for primary radar rendering
  - WebGL canvas for post-processing shader effects
  - 60 FPS rendering pipeline maintained

- **Shader Implementation** (`ShaderRenderer.ts`):
  - Custom WebGL fragment shader with 5 configurable effects:
    1. Scanlines - Horizontal CRT lines
    2. Barrel Distortion - Curved screen edges (CRT curvature)
    3. Chromatic Aberration - RGB color separation
    4. Phosphor Glow - Bloom effect on bright elements
    5. Vignette - Edge darkening
  - Vertex shader for full-screen quad rendering
  - Uniform parameters for real-time effect adjustment

- **Texture Optimization**:
  - NEAREST texture filtering for crisp text rendering
  - Proper WebGL/Canvas 2D coordinate system handling
  - Vertical texture flip to correct orientation

- **Final Configuration**:
  - All shader effects set to 0.0 for maximum text legibility
  - Maintains WebGL pipeline infrastructure for future re-enablement
  - Pixel-perfect text rendering prioritized over visual effects

### Bug Fixes & Optimizations

#### Issue 1: Text Illegibility with Shader Effects
- **Problem**: Initial shader effect intensities made text blurry and hard to read
- **Root Cause**: Aggressive scanlines, glow, and chromatic aberration interfering with text
- **Fix**: Progressively reduced effect intensities, then disabled entirely
- **Result**: Crystal clear callsigns, flight levels, and waypoint labels

#### Issue 2: Upside-Down Text in WebGL Rendering
- **Problem**: All text appearing inverted vertically
- **Root Cause**: Canvas 2D (Y=0 at top) vs WebGL (Y=0 at bottom) coordinate mismatch
- **Fix**: Flipped texture coordinates in vertex shader quad
- **Location**: `ShaderRenderer.ts:75-80`

#### Issue 3: Text Blurriness from LINEAR Filtering
- **Problem**: WebGL LINEAR filtering causing text to appear fuzzy
- **Root Cause**: Texture interpolation between pixels
- **Fix**: Changed to NEAREST filtering for sharp, pixel-perfect text
- **Location**: `ShaderRenderer.ts:102-103`

### File Changes
**New Files**:
- `packages/shared/src/types/weather.ts` (15 lines) - Weather type definitions
- `packages/server/src/game/WeatherSystem.ts` (160 lines) - Weather generation and management
- `packages/client/src/shaders/crt.vert` (10 lines) - WebGL vertex shader
- `packages/client/src/shaders/crt.frag` (90 lines) - WebGL fragment shader with CRT effects
- `packages/client/src/utils/ShaderRenderer.ts` (190 lines) - WebGL renderer class

**Modified Files**:
- `packages/shared/src/types/gameState.ts`: Added `weather: WeatherCell[]` to Airspace, weather deltas to StateDelta
- `packages/shared/src/index.ts`: Exported weather types
- `packages/server/src/game/GameRoom.ts`: Added 13 waypoints, integrated WeatherSystem, weather updates in game loop
- `packages/client/src/components/RadarDisplay/RadarDisplay.tsx`: Dual-canvas architecture, waypoint rendering, weather rendering, WebGL integration
- `packages/client/src/components/RadarDisplay/RadarDisplay.module.css`: WebGL canvas styling
- `packages/client/src/App.tsx`: Pass waypoints and weather to RadarDisplay

### Performance & Statistics
- **Frame Rate**: Solid 60 FPS with all features enabled
- **Lines of Code Added**: ~1,200 lines total
- **Weather Cells**: Up to 10 active simultaneously
- **Waypoints**: 13 visible at all times
- **Text Clarity**: Pixel-perfect rendering with NEAREST filtering

### UI Enhancements
- Collapsible Chaos Controls panel with header click functionality
- Collapsible Control Panel with collapse button
- Display current and target values for aircraft (altitude, heading, speed)
- Smooth CSS transitions and hover effects

### Shader Settings Evolution
**Initial Settings** (maximum visual effects):
- Scanlines: 0.15, Barrel: 0.08, Chromatic: 0.0008, Glow: 0.3, Vignette: 0.6

**Intermediate Settings** (balanced):
- Scanlines: 0.08, Barrel: 0.04, Chromatic: 0.0003, Glow: 0.2, Vignette: 0.4

**Final Settings** (maximum clarity):
- All effects: 0.0 (disabled for pixel-perfect text)

## Pending Features (Next Session)

### Phase 3: Core Gameplay ✅ COMPLETED

### Phase 4: Visual Enhancements
- [ ] WebGL CRT shader effects (barrel distortion, chromatic aberration, glow)
- [ ] Weather overlay (clouds, storms as hazards)
- [ ] Airport visualization on radar
- [ ] Waypoint markers

### Phase 5: LLM Integration
- [ ] AI Copilot (command suggestions, warnings)
- [ ] Dynamic scenario generation (emergencies, weather events)
- [ ] Radio chatter with TTS (pilot-controller communications)
- [ ] Natural language command input

### Phase 6: Multiplayer Polish
- [ ] Chat system for controllers
- [ ] Leaderboard (by room and global)
- [ ] Controller handoff mechanics
- [ ] Spectator mode

## Technical Debt
- [ ] Add unit tests for physics calculations
- [ ] Add integration tests for WebSocket events
- [ ] Implement error boundaries in React components
- [ ] Add logging/monitoring infrastructure
- [ ] Optimize trail rendering (canvas performance)
- [ ] Add rate limiting for commands
- [ ] Implement reconnection logic for dropped connections

## Known Issues
- Minor: "Aircraft not found" errors in logs when commands issued for despawned aircraft (non-critical)
- Minor: Server watch mode sometimes requires 5s force kill on restart (dev only)

## Dependencies
- **Client**: React 18, Vite, Zustand, Socket.io-client, TypeScript
- **Server**: Node.js, Express, Socket.io, tsx (dev), TypeScript
- **Shared**: TypeScript

## File Structure
```
unhinged-atc/
├── packages/
│   ├── client/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── RadarDisplay/
│   │   │   │   └── ControlPanel/
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts
│   │   │   │   └── useGameSync.ts
│   │   │   ├── stores/
│   │   │   │   └── gameStore.ts
│   │   │   └── App.tsx
│   │   └── package.json
│   ├── server/
│   │   ├── src/
│   │   │   ├── game/
│   │   │   │   ├── AircraftPhysics.ts
│   │   │   │   ├── CommandProcessor.ts
│   │   │   │   ├── GameEngine.ts
│   │   │   │   └── GameRoom.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── aircraft.ts
│       │   │   ├── commands.ts
│       │   │   ├── events.ts
│       │   │   ├── game.ts
│       │   │   └── index.ts
│       │   └── config/
│       │       └── constants.ts
│       └── package.json
└── package.json
```

## Development Commands
```bash
# Install dependencies
pnpm install

# Run both client and server in dev mode
pnpm dev

# Run individually
pnpm dev:client  # Client on http://localhost:5173
pnpm dev:server  # Server on http://localhost:3000

# Build for production
pnpm build

# Check server stats
curl http://localhost:3000/stats
```

## Session Notes
- Time scale of 15x provides good balance between excitement and control
- Randomized spawn targets essential for visible movement
- Always emit deltas regardless of content (client filters)
- Refs needed in render loop to avoid restarts
- Aircraft despawn quickly with 15x time scale (~30-60 seconds vs 7-15 minutes real-time)

## Where We Left Off

The core game is **fully functional and playable**:
- ✅ Aircraft spawn, move, and respond to commands in real-time
- ✅ Multiplayer works (tested with multiple browser windows)
- ✅ Radar display renders aircraft smoothly with trails
- ✅ Control panel allows precise command input
- ✅ WebSocket communication is stable at 60 FPS

**What works great**:
- Fast-paced gameplay thanks to 15x time scale
- Dynamic aircraft movement with randomized flight paths
- Responsive controls with immediate visual feedback

**Ready for next session**:
1. **Collision Detection**: Add proximity warnings and collision mechanics
2. **Landing System**: Implement approach vectors to airports (KSFO, KOAK)
3. **Visual Polish**: WebGL shaders for authentic CRT effects
4. **LLM Integration**: Start with AI copilot for command suggestions

**To resume development**:
```bash
cd /Users/andrewmaring/Documents/repos/Deeplearning-ai/unhinged-atc
pnpm dev
# Open http://localhost:5173
# Read CHANGELOG.md and .plan.md for context
```
