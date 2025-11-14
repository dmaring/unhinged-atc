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

## Pending Features (Next Session)

### Phase 3: Core Gameplay
- [ ] Collision detection (aircraft proximity warnings)
- [ ] Landing system (approach vectors to airports)
- [ ] Fuel management (low fuel warnings, emergencies)
- [ ] Scoring system (safe landings, near misses, incidents)

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
