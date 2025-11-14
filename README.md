# Unhinged ATC

> Crowdsourced air traffic control - because what could go wrong?

A real-time multiplayer web application where multiple users simultaneously control the same airspace as air traffic controllers. Features retro CRT radar aesthetics, AI-powered scenarios, and gloriously chaotic multiplayer mayhem.

## Current Status (2025-11-14)

### ✅ Implemented
- **Real-time Multiplayer**: WebSocket-based with 60 FPS server game loop
- **Retro Radar Display**: Canvas-based with range rings, aircraft icons, trails, and compass
- **Aircraft Physics**: Realistic movement with 15x time scale for fast-paced gameplay
- **Control Panel**: Issue heading, altitude, and speed commands to selected aircraft
- **Auto-spawn System**: Maintains 3-5 aircraft with random callsigns and varied flight paths
- **Multiplayer Room Management**: Join/leave tracking with controller stats

### 🚧 Planned Features
- **AI Copilot**: Claude-powered assistant provides guidance and warnings
- **Dynamic Scenarios**: LLM-generated emergencies keep things interesting
- **Radio Chatter**: AI-generated pilot responses with text-to-speech
- **Collision Detection**: Near-miss warnings and collision consequences
- **Landing System**: Approach vectors and scoring for safe landings
- **Visual Effects**: WebGL CRT shaders with barrel distortion and glow

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **State Management**: Zustand
- **Rendering**: Canvas API + WebGL shaders
- **LLMs**: Anthropic Claude + OpenAI TTS
- **Deployment**: Vercel + Railway/Render

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp packages/client/.env.example packages/client/.env
cp packages/server/.env.example packages/server/.env

# Start development servers (both client and server)
pnpm dev

# Or start individually
pnpm dev:client  # Client on http://localhost:5173
pnpm dev:server  # Server on http://localhost:3000
```

### Playing the Game

1. Open http://localhost:5173 in your browser
2. You'll automatically join the default room as "ControllerXXX"
3. Aircraft will spawn automatically and move across the radar
4. Click on an aircraft to select it (turns cyan)
5. Use the control panel on the right to issue commands:
   - **Quick Turn**: Click ±15° or ±30° buttons
   - **Quick Altitude**: Click ±1000 ft or ±2000 ft buttons
   - **Precise Control**: Enter exact heading (0-360°), altitude (1000-40000 ft), or speed values
6. Watch aircraft respond to your commands in real-time
7. Aircraft will automatically despawn when they fly out of the 50 NM × 50 NM airspace

**Tips**:
- Aircraft move 15x faster than real-time for exciting gameplay
- Green = normal, Cyan = selected, Red = collided (not yet implemented)
- Open multiple browser windows to test multiplayer!

### Environment Variables

**Client (.env)**
```
VITE_WS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000
```

**Server (.env)**
```
PORT=3000
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

## Project Structure

```
unhinged-atc/
├── packages/
│   ├── client/      # React frontend
│   ├── server/      # Node.js backend
│   └── shared/      # Shared types & utilities
├── docs/            # Documentation
└── .plan.md         # Detailed design document
```

## Development

```bash
# Run tests
pnpm test

# Lint code
pnpm lint

# Build for production
pnpm build

# Clean all node_modules and build artifacts
pnpm clean
```

## Contributing

This is a vibecoding experiment showcasing AI-assisted development. Feel free to explore, learn, and have fun!

## License

MIT

---

**Warning**: This application is for entertainment purposes only. Please do not actually crowdsource real air traffic control. The FAA has opinions about that.
