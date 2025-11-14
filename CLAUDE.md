# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unhinged ATC is a real-time multiplayer air traffic control game where multiple users simultaneously control the same airspace. Built with React (client), Node.js + Express + Socket.io (server), and a shared TypeScript package for types/constants.

## Architecture

### Monorepo Structure (pnpm workspaces)

- **packages/client**: React 18 + Vite frontend with Zustand state management
- **packages/server**: Node.js + Express backend with Socket.io WebSocket server
- **packages/shared**: Shared TypeScript types, constants, and utilities

The `shared` package is referenced as `workspace:*` in both client and server dependencies and exports types/constants used across the stack.

### Key Architectural Patterns

**Server Game Loop (60 FPS)**:
- `packages/server/src/index.ts` runs the Express server and Socket.io WebSocket server
- `packages/server/src/game/GameEngine.ts` manages the 60 FPS game loop (16.67ms ticks)
- `packages/server/src/game/GameRoom.ts` contains the core game state and logic for a multiplayer room
- `packages/server/src/game/AircraftPhysics.ts` handles realistic aircraft movement with 15x time scale
- `packages/server/src/game/CommandProcessor.ts` validates and applies heading/altitude/speed commands

**WebSocket Communication**:
- Server broadcasts `stateDelta` events 60 times per second with aircraft position updates
- Clients send `aircraftCommand` events for heading/altitude/speed changes
- Full game state sent on initial connection via `gameState` event

**Client Rendering**:
- `packages/client/src/components/RadarDisplay/` renders Canvas-based retro CRT radar with range rings, aircraft icons, trails, and compass
- `packages/client/src/stores/gameStore.ts` is the Zustand store managing local game state
- `packages/client/src/services/websocket.ts` handles WebSocket connection and event handling

**Shared Types**:
- `packages/shared/src/types/aircraft.ts`: Aircraft, AircraftType, AIRCRAFT_TYPES performance data
- `packages/shared/src/types/gameState.ts`: GameState, StateDelta, Controller
- `packages/shared/src/types/commands.ts`: AircraftCommand
- `packages/shared/src/types/events.ts`: GameEvent
- `packages/shared/src/constants.ts`: GAME_CONFIG (tick rate, spawn intervals), SEPARATION_MINIMUMS, POINTS, RADAR_CONFIG

## Common Commands

### Development
```bash
# Install all dependencies
pnpm install

# Start both client and server in parallel
pnpm dev

# Start client only (http://localhost:5173)
pnpm dev:client

# Start server only (http://localhost:3000)
pnpm dev:server
```

### Build & Test
```bash
# Build all packages
pnpm build

# Build specific package
pnpm build:client
pnpm build:server

# Lint all packages
pnpm lint

# Run tests (when implemented)
pnpm test
```

### Testing Individual Components
- Server uses `tsx watch` for hot-reload development
- Client uses Vite's HMR for instant updates
- To test multiplayer: open multiple browser windows to http://localhost:5173

### Cleanup
```bash
# Remove all node_modules and build artifacts
pnpm clean
```

## Environment Variables

**Client** (`packages/client/.env`):
```
VITE_WS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000
```

**Server** (`packages/server/.env`):
```
PORT=3000
ANTHROPIC_API_KEY=your_key_here  # For AI copilot (planned)
OPENAI_API_KEY=your_key_here     # For TTS (planned)
```

## Key Implementation Details

### Time Scale
Aircraft move at 15x real-time speed (defined in physics calculations) for fast-paced gameplay. This is hardcoded in `AircraftPhysics.ts` where deltaTime is scaled.

### Auto-spawn System
`GameRoom.ts` maintains 3-5 aircraft automatically:
- Spawns at airspace edges heading inward
- Removes aircraft that exit the 50 NM × 50 NM bounds
- Random callsigns, types, altitudes, and slight heading variations

### Physics Updates
Aircraft smoothly interpolate toward target heading/altitude/speed using:
- Turn rate (degrees per second)
- Climb rate (feet per minute)
- Acceleration (knots per second)

Each aircraft type in `AIRCRAFT_TYPES` has realistic performance characteristics.

### WebSocket State Management
Server sends lightweight `StateDelta` with only changed aircraft data (though currently sends all aircraft like a radar sweep). Clients merge deltas into their local Zustand store.
