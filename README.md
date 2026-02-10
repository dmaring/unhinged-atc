# Unhinged ATC

> Crowdsourced air traffic control - because what could go wrong?

A real-time multiplayer web application where multiple users simultaneously control the same airspace as air traffic controllers. Features retro CRT radar aesthetics, AI-powered scenarios, and gloriously chaotic multiplayer mayhem.

## 🎮 Try It Live (If You Dare)

**[openatc.app](https://openatc.app)** - Where internet strangers collectively manage an airspace. What could possibly go wrong?

Join the chaos right now - no installation, no training, no adult supervision required. Just you, some aircraft, and whoever else decided this was a good idea today.

## Current Status (2025-11-16)

### ✅ Implemented
- **Real-time Multiplayer**: WebSocket-based with 60 FPS server game loop and queue system
- **Retro Radar Display**: Canvas-based with range rings, aircraft icons, trails, compass, and waypoints
- **Aircraft Physics**: Realistic movement with 15x time scale and graduated difficulty progression
- **Control Systems**: Point-and-click selection, keyboard controls (arrow keys, Tab), precise input panels
- **Collision Detection**: Proximity warnings, near-miss detection, crash animation with 2-second display
- **Fuel Management**: Realistic consumption with low fuel warnings and emergency detection
- **Chaos System**: 6 abilities (Reverse Course, Altitude Roulette, Speed Lottery, Gravity Well, Scatter Blast, Callsign Shuffle) with cooldowns
- **User Authentication**: Login with screen name and email, profanity filtering
- **Queue Management**: Player queue when game full (max 4 controllers per room, max 8 in queue)
- **Scoring System**: Comprehensive points for landings (+100), cleared aircraft (+100), penalties for crashes (-100), 3-minute crash-free bonus (+500)
- **Game Mechanics**: Auto-spawning with difficulty tiers, auto-chaos every 30-45s, 5-minute game duration with time limit or crash end condition
- **Notification System**: Terminal-style message panel with 50+ humorous messages, duplicate prevention, severity-based colors
- **Visual Features**: Dynamic weather (clouds, storms, turbulence), airport/waypoint visualization, crash animations, CRT shader effects
- **Production Ready**: GCP deployment with Cloud Armor, auto-scaling, monitoring, security hardening, secret management

### 🚧 Planned Features
- **AI Copilot**: Claude-powered assistant for command suggestions and warnings
- **Landing System**: Automatic approach detection, landing criteria validation, scoring, and go-arounds
- **Natural Language Commands**: Parse pilot-like input ("turn AAL123 left to 090")
- **LLM Scenarios**: AI-generated emergencies and dynamic events
- **Radio Chatter**: TTS pilot-controller communications
- **Chat System**: Real-time communication for controllers
- **Leaderboards**: Global and room-specific rankings
- **Controller Handoff**: Transfer aircraft control between players
- **Spectator Mode**: Watch-only mode for queued players

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **State Management**: Zustand
- **Rendering**: Canvas API + WebGL shaders
- **LLMs**: Anthropic Claude + OpenAI TTS
- **Deployment**: Google Cloud Platform (Compute Engine + Cloud CDN)

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

## Production Deployment

This project includes production-ready deployment scripts for Google Cloud Platform with enterprise-grade security and auto-scaling.

### Quick Start

```bash
cd deploy
cp .env.example .env
# Edit .env with your configuration
./deploy.sh
```

### Features

- 🛡️ **Security**: Cloud Armor DDoS protection, WAF rules, rate limiting
- 📈 **Auto-scaling**: Managed Instance Group (1-5 VMs based on CPU)
- 🔒 **SSL/TLS**: Google-managed certificates with auto-renewal
- 🚀 **CDN**: Cloud CDN for static assets
- 📊 **Monitoring**: Cloud Monitoring with proactive alerts
- 🔐 **Secrets**: Secret Manager for API keys

### Cost Estimate

- **Low traffic** (few users): $85-150/month
- **Medium traffic** (moderate use): $238/month
- **High traffic** (popular): $827+/month

### Documentation

- **Quick Start**: [deploy/README.md](deploy/README.md)
- **Full Guide**: [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)
- **Security**: [deploy/SECURITY_CHECKLIST.md](deploy/SECURITY_CHECKLIST.md)
- **Operations**: [deploy/RUNBOOK.md](deploy/RUNBOOK.md)

### Architecture

```
Internet → Load Balancer (HTTPS + SSL) → Cloud Armor (DDoS/WAF)
                ↓
         Backend Service → Managed Instance Group (1-5 VMs)
                ↓
         Node.js Server (Express + Socket.io)
                ├─ Serves React SPA
                ├─ WebSocket real-time game
                └─ Health/Stats APIs
```

## Contributing

This is a vibecoding experiment showcasing AI-assisted development. Feel free to explore, learn, and have fun!

## License

MIT

---

**Warning**: This application is for entertainment purposes only. Please do not actually crowdsource real air traffic control. The FAA has opinions about that.
