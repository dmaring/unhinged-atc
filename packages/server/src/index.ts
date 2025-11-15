import { createServer } from 'http';
import express, { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import { Filter } from 'bad-words';
import { GameEngine } from './game/GameEngine.js';
import { AircraftCommand, ChaosCommand } from 'shared';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174'];

// Profanity filter
const profanityFilter = new Filter();

// Create Express app
const app: Express = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const stats = gameEngine.getStats();
  res.json(stats);
});

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Create and start game engine
const gameEngine = new GameEngine(io);
gameEngine.start();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  let currentRoom: string | null = null;

  // Handle join room
  socket.on('join_room', (data: { roomId?: string; username: string; email?: string }) => {
    const roomId = data.roomId || 'default';
    const username = data.username?.trim();
    const email = data.email?.trim();

    // Validate username and email are provided
    if (!username || !email) {
      socket.emit('join_error', { message: 'Screen name and email are required' });
      return;
    }

    // Validate username length
    if (username.length < 3 || username.length > 20) {
      socket.emit('join_error', { message: 'Screen name must be between 3 and 20 characters' });
      return;
    }

    // Check for profanity in username
    if (profanityFilter.isProfane(username)) {
      console.log(`[Socket ${socket.id}] Rejected username "${username}" - contains profanity`);
      socket.emit('join_error', { message: 'Screen name contains inappropriate language' });
      return;
    }

    // Leave previous room if any
    if (currentRoom) {
      socket.leave(currentRoom);
      const room = gameEngine.getRoom(currentRoom);
      if (room) {
        room.removeController(socket.id);
      }
    }

    // Get or create room
    const room = gameEngine.getOrCreateRoom(roomId);

    // Check if username is already taken in this room
    const existingControllers = Object.values(room.getGameState().controllers);
    const usernameTaken = existingControllers.some(
      (controller) => controller.username.toLowerCase() === username.toLowerCase() && controller.id !== socket.id
    );

    if (usernameTaken) {
      console.log(`[Socket ${socket.id}] Rejected username "${username}" - already taken in room ${roomId}`);
      socket.emit('join_error', { message: 'Screen name is already taken. Please choose another.' });
      return;
    }

    // Join new room
    socket.join(roomId);
    currentRoom = roomId;

    // Add controller to room with email
    const controller = room.addController(socket.id, username, email);

    // Log the join event with email
    console.log(`[Socket ${socket.id}] User joined - Username: ${username}, Email: ${email}, Room: ${roomId}`);

    // Send initial game state
    const gameState = room.getGameState();
    socket.emit('game_state', gameState);

    // Notify others (without email for privacy)
    socket.to(roomId).emit('controller_update', {
      type: 'joined',
      controller: {
        id: controller.id,
        username: controller.username,
        joinedAt: controller.joinedAt,
        commandsIssued: controller.commandsIssued,
        score: controller.score,
        // Email is intentionally omitted from broadcast
      },
    });
  });

  // Handle aircraft command
  socket.on('aircraft_command', (command: Omit<AircraftCommand, 'id' | 'timestamp'>) => {
    if (!currentRoom) {
      socket.emit('error', { code: 'NO_ROOM', message: 'Not in a room' });
      return;
    }

    const room = gameEngine.getRoom(currentRoom);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // Create full command
    const fullCommand: AircraftCommand = {
      ...command,
      id: randomBytes(8).toString('hex'),
      timestamp: Date.now(),
      controllerId: socket.id,
    };

    // Process command
    const success = room.processCommand(fullCommand);

    if (success) {
      // Broadcast command to all clients for feedback
      io.to(currentRoom).emit('command_issued', {
        controllerId: socket.id,
        aircraftId: command.aircraftId,
        commandType: command.type,
      });
    } else {
      socket.emit('error', {
        code: 'COMMAND_FAILED',
        message: 'Failed to process command',
      });
    }
  });

  // Handle time scale change
  socket.on('set_time_scale', (data: { scale: number }) => {
    if (!currentRoom) {
      socket.emit('error', { code: 'NO_ROOM', message: 'Not in a room' });
      return;
    }

    const room = gameEngine.getRoom(currentRoom);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // Set the time scale
    room.setTimeScale(data.scale);

    // Broadcast the new time scale to all clients in the room
    io.to(currentRoom).emit('time_scale_updated', {
      timeScale: room.getTimeScale(),
    });
  });

  // Handle chaos command
  socket.on('chaos_command', (command: Omit<ChaosCommand, 'id' | 'timestamp'>) => {
    if (!currentRoom) {
      socket.emit('error', { code: 'NO_ROOM', message: 'Not in a room' });
      return;
    }

    const room = gameEngine.getRoom(currentRoom);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // Create full chaos command
    const fullCommand: ChaosCommand = {
      ...command,
      id: randomBytes(8).toString('hex'),
      timestamp: Date.now(),
      controllerId: socket.id,
    };

    // Process chaos command
    const result = room.processChaosCommand(fullCommand);

    if (result.success) {
      // Broadcast chaos activation to all clients
      io.to(currentRoom).emit('chaos_activated', {
        chaosType: command.type,
        controllerId: socket.id,
        message: result.message,
        timestamp: Date.now(),
      });

      // Update chaos abilities state
      io.to(currentRoom).emit('chaos_state_updated', {
        chaosAbilities: room.getGameState().chaosAbilities,
      });
    } else {
      // Send error back to requesting client
      socket.emit('chaos_failed', {
        chaosType: command.type,
        message: result.message,
      });
    }
  });

  // Handle spawn aircraft request
  socket.on('spawn_aircraft', (data?: { count?: number }) => {
    if (!currentRoom) {
      socket.emit('error', { code: 'NO_ROOM', message: 'Not in a room' });
      return;
    }

    const room = gameEngine.getRoom(currentRoom);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    // Get count from data, default to 1, cap at 50 to prevent abuse
    const count = Math.min(Math.max(1, data?.count || 1), 50);

    // Spawn N aircraft
    for (let i = 0; i < count; i++) {
      room.spawnRandomAircraft();
    }

    console.log(`[GameRoom ${currentRoom}] ${count} aircraft manually spawned by ${socket.id}`);
  });

  // Handle game reset (admin function)
  socket.on('reset_game', () => {
    if (!currentRoom) {
      socket.emit('error', { code: 'NO_ROOM', message: 'Not in a room' });
      return;
    }

    const room = gameEngine.getRoom(currentRoom);
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
      return;
    }

    console.log(`[GameRoom ${currentRoom}] Game reset requested by ${socket.id}`);

    // Reset the game room
    const newGameState = room.reset();

    // Broadcast the reset game state to all clients in the room
    io.to(currentRoom).emit('game_reset', newGameState);

    console.log(`[GameRoom ${currentRoom}] Game reset complete, new state broadcasted to all clients`);
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}, reason: ${reason}`);

    if (currentRoom) {
      const room = gameEngine.getRoom(currentRoom);
      if (room) {
        const controller = room.getGameState().controllers[socket.id];
        room.removeController(socket.id);

        // Notify others
        io.to(currentRoom).emit('controller_update', {
          type: 'left',
          controller,
        });

        // Delete room if empty
        gameEngine.deleteRoomIfEmpty(currentRoom);
      }
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    UNHINGED ATC SERVER                     ║
╠═══════════════════════════════════════════════════════════╣
║  Status: ONLINE                                            ║
║  Port: ${PORT.toString().padEnd(52)}║
║  CORS Origin: ${(Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN).padEnd(44)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SIGTERM] Shutting down gracefully...');
  gameEngine.stop();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SIGINT] Shutting down gracefully...');
  gameEngine.stop();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { io, app, httpServer };
