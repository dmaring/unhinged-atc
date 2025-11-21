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

## Production Deployment

### Deployment Commands

**Create deployment package**:
```bash
cd /path/to/unhinged-atc
./deploy/create-package.sh
```

**Deploy to GCP** (first time):
```bash
cd deploy
cp .env.example .env
# Edit .env with your configuration
./deploy.sh
```

**Update existing deployment**:
```bash
# Build and upload new package
./deploy/create-package.sh

# Rolling update to new version
gcloud compute instance-groups managed rolling-action replace atc-mig --zone=us-central1-a

# Or create new template with version number
gcloud compute instance-templates create atc-template-v2 \
    --source-instance-template=atc-template-v1 \
    --metadata=domain=yourdomain.com
```

### Environment Setup

**Production Server** (set by startup script):
- `NODE_ENV=production`
- `PORT=3000`
- `CORS_ORIGIN` - fetched from instance metadata `domain` attribute
- `ANTHROPIC_API_KEY` - from Secret Manager
- `OPENAI_API_KEY` - from Secret Manager

**Production Client** (generated during deployment):
- `VITE_WS_URL=wss://yourdomain.com`
- `VITE_API_URL=https://yourdomain.com`

### Cloud Logging & Monitoring

**Viewing Logs in Cloud Logging**:

The application automatically forwards logs to Cloud Logging via the Ops Agent. All logs are structured as JSON with the following types:

```bash
# View all player events (joins, disconnects)
gcloud logging read 'jsonPayload.logType="player_event"' --limit 50 --format json

# View specific player's activity
gcloud logging read 'jsonPayload.username="USERNAME"' --limit 50 --format json

# View errors only
gcloud logging read 'jsonPayload.logType="server_error"' --limit 50 --format json

# View security events (rate limiting, profanity filtering)
gcloud logging read 'jsonPayload.logType="security_event"' --limit 50 --format json

# View game events (crashes, landings)
gcloud logging read 'jsonPayload.logType="game_event"' --limit 50 --format json

# View logs from the last 24 hours
gcloud logging read 'jsonPayload.logType=~".*"' --freshness=24h --format json
```

**Log Types**:
- `player_event`: User connections, disconnections, queue events
- `game_event`: Crashes, landings, game state changes
- `server_info`: General server information and state changes
- `server_error`: Application errors and exceptions
- `security_event`: Security-related events (rate limiting, profanity detection)

**Ops Agent Configuration**:

The Ops Agent is automatically installed and configured by the startup script. It:
- Collects logs from the `unhinged-atc.service` systemd unit
- Parses JSON-formatted logs
- Forwards to Cloud Logging with proper timestamps
- Collects host metrics (CPU, memory, disk, network)

Configuration file: `/etc/google-cloud-ops-agent/config.yaml`

To restart the Ops Agent after configuration changes:
```bash
sudo systemctl restart google-cloud-ops-agent
```

### Troubleshooting Deployment

**Instance fails to start**:
```bash
# Check serial console logs
gcloud compute instances get-serial-port-output INSTANCE_NAME --zone=us-central1-a

# Check systemd service logs via SSH
gcloud compute ssh INSTANCE_NAME --zone=us-central1-a
sudo journalctl -u unhinged-atc.service -f

# Or view in Cloud Logging
gcloud logging read 'resource.labels.instance_id="INSTANCE_NAME"' --limit 50
```

**Module resolution errors**:
- Ensure `packages/shared/package.json` points to `dist/` not `src/`
- Check that all packages have been built: `pnpm build` in shared, server, client

**Deployment package not found**:
- Run `./deploy/create-package.sh` to create and upload package
- Verify bucket exists: `gsutil ls gs://PROJECT_ID-deploy/`

**Domain not resolving**:
- Check DNS A record points to load balancer IP
- Wait 5-15 minutes for DNS propagation
- Test: `dig yourdomain.com`

**Ops Agent not forwarding logs**:
```bash
# Check Ops Agent status
gcloud compute ssh INSTANCE_NAME --zone=us-central1-a
sudo systemctl status google-cloud-ops-agent

# View Ops Agent logs
sudo journalctl -u google-cloud-ops-agent -f

# Verify configuration
sudo cat /etc/google-cloud-ops-agent/config.yaml
```

### Architecture Overview

```
deploy/
├── deploy.sh              # Main deployment orchestrator (13 steps)
├── create-package.sh      # Build and upload code to Cloud Storage
├── startup-script.sh      # VM initialization script
├── cloud-armor.sh         # DDoS protection and WAF
├── firewall-rules.sh      # Zero-trust VPC firewall
├── monitoring.sh          # Alerts and uptime checks
└── .env                   # Configuration (PROJECT_ID, DOMAIN, etc.)
```
