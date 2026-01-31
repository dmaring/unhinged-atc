import { createServer } from 'http';
import express, { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import { Filter } from 'bad-words';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameEngine } from './game/GameEngine.js';
import { AircraftCommand, ChaosCommand } from 'shared';
import { loadSecrets } from './config/secrets.js';
import { Logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Security middleware - Helmet for HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "wss:",
        "ws:",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://www.googletagmanager.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite HMR in dev
        "https://www.googletagmanager.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: [
        "'self'",
        "data:",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com"
      ],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Socket.IO
}));

// Rate limiting for HTTP endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip health checks and stats from rate limiting
  skip: (req) => req.path === '/health',
});

app.use('/api/', apiLimiter);
app.use('/stats', apiLimiter);

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

// Admin endpoint - password protected
app.get('/api/admin/status', (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Check if admin password is configured
  if (!adminPassword) {
    return res.status(503).json({
      error: 'Admin panel not configured'
    });
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized - Missing or invalid authorization header'
    });
  }

  const providedPassword = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Verify password
  if (providedPassword !== adminPassword) {
    return res.status(401).json({
      error: 'Unauthorized - Invalid password'
    });
  }

  // Get admin status data
  try {
    const stats = gameEngine.getStats();
    const rooms = gameEngine.getAllRooms();

    // Get detailed info from the main room (default)
    const mainRoom = rooms.get('default');

    if (!mainRoom) {
      return res.json({
        stats,
        activePlayers: [],
        queuedPlayers: [],
      });
    }

    const gameState = mainRoom.getGameState();
    const queuedPlayers = mainRoom.getQueuedPlayers();

    // Format active players
    const activePlayers = Object.values(gameState.controllers).map((controller) => ({
      id: controller.id,
      username: controller.username,
      email: controller.email,
      joinedAt: controller.joinedAt,
      commandsIssued: controller.commandsIssued,
      score: controller.score,
    }));

    // Format queued players
    const formattedQueuedPlayers = queuedPlayers.map((player) => ({
      socketId: player.socketId,
      username: player.username,
      email: player.email,
      position: player.position,
      joinedQueueAt: player.joinedQueueAt,
      waitTime: Date.now() - player.joinedQueueAt,
    }));

    res.json({
      stats,
      activePlayers,
      queuedPlayers: formattedQueuedPlayers,
      gameState: {
        score: gameState.score,
        planesCleared: gameState.planesCleared,
        crashCount: gameState.crashCount,
        successfulLandings: gameState.successfulLandings,
        nearMisses: gameState.nearMisses,
        collisions: gameState.collisions,
        aircraftCount: Object.keys(gameState.aircraft).length,
        timeScale: gameState.timeScale,
        gameTime: gameState.gameTime,
      },
    });
  } catch (error) {
    console.error('Error fetching admin status:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Serve static files from client dist directory in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Skip Socket.IO and API routes
    if (!req.path.startsWith('/socket.io') && !req.path.startsWith('/health') && !req.path.startsWith('/stats')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Create Socket.IO server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket for better security
});

// Socket.IO connection rate limiting
const connectionAttempts = new Map<string, { count: number; resetTime: number }>();

io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();

  const attempt = connectionAttempts.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > attempt.resetTime) {
    attempt.count = 0;
    attempt.resetTime = now + 60000;
  }

  attempt.count++;
  connectionAttempts.set(ip, attempt);

  // Allow 10 connection attempts per minute per IP
  if (attempt.count > 10) {
    Logger.security('rate_limit_exceeded', {
      ip,
      attemptCount: attempt.count,
      type: 'socket_connection'
    });
    return next(new Error('Too many connection attempts, please try again later'));
  }

  next();
});

// Create and start game engine
const gameEngine = new GameEngine(io);
gameEngine.start();

// Socket.IO connection handling
io.on('connection', (socket) => {
  Logger.info(`Client connected: ${socket.id}`);

  let currentRoom: string | null = null;
  let joinedAt: number | null = null; // Track when player joined for session duration

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

    // Check if username is already taken in this room (active players or queue)
    // IMPORTANT: Check username availability BEFORE profanity filter to prevent timing attacks
    const existingControllers = Object.values(room.getGameState().controllers);
    const usernameInActive = existingControllers.some(
      (controller) => controller.username.toLowerCase() === username.toLowerCase() && controller.id !== socket.id
    );

    const queuedPlayers = room.getQueuedPlayers();
    const usernameInQueue = queuedPlayers.some(
      (player) => player.username.toLowerCase() === username.toLowerCase() && player.socketId !== socket.id
    );

    if (usernameInActive || usernameInQueue) {
      Logger.logPlayer({
        event: 'player_rejected',
        timestamp: new Date().toISOString(),
        username,
        email,
        socketId: socket.id,
        roomId,
        ip: socket.handshake.address,
        reason: 'username_taken'
      });
      socket.emit('join_error', { message: 'Screen name is already taken. Please choose another.' });
      return;
    }

    // Check for profanity in username AFTER checking availability
    // This prevents timing attacks that could enumerate taken usernames
    if (profanityFilter.isProfane(username)) {
      Logger.security('profanity_detected', {
        socketId: socket.id,
        username,
        ip: socket.handshake.address
      });
      socket.emit('join_error', { message: 'Screen name contains inappropriate language' });
      return;
    }

    // Join new room
    socket.join(roomId);
    currentRoom = roomId;

    // Check if room has space for active player
    if (room.canAddPlayer()) {
      // Add controller to room as active player
      const controller = room.addController(socket.id, username, email);

      // Track join time for session duration
      joinedAt = Date.now();

      // Log the join event with structured data
      Logger.logPlayer({
        event: 'player_joined',
        timestamp: new Date().toISOString(),
        username,
        email,
        socketId: socket.id,
        roomId,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Send initial game state
      const gameState = room.getGameState();
      const controllerIds = Object.keys(gameState.controllers);
      Logger.info(`Sending game_state to ${username}`, {
        socketId: socket.id,
        roomId,
        controllerCount: controllerIds.length,
        controllerIds,
        controllerUsernames: Object.values(gameState.controllers).map(c => c.username)
      });
      socket.emit('game_state', gameState);

      // Notify others that a player entered the game
      socket.to(roomId).emit('player_entered_game', {
        username: controller.username,
        playerId: controller.id,
      });

      // Also send controller_update for backward compatibility
      socket.to(roomId).emit('controller_update', {
        type: 'joined',
        controller: {
          id: controller.id,
          username: controller.username,
          email: '', // Empty for privacy - email is only logged server-side
          joinedAt: controller.joinedAt,
          commandsIssued: controller.commandsIssued,
          score: controller.score,
        },
      });
    } else if (room.canAddToQueue()) {
      // Room is full, add to queue
      const queuedPlayer = room.addToQueue(socket.id, username, email);

      // Track join time for queue duration
      joinedAt = Date.now();

      // Log queue event with structured data
      Logger.logPlayer({
        event: 'player_queued',
        timestamp: new Date().toISOString(),
        username,
        email,
        socketId: socket.id,
        roomId,
        queuePosition: queuedPlayer.position,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Send queue joined event
      socket.emit('queue_joined', {
        position: queuedPlayer.position,
        totalInQueue: room.getQueuedPlayers().length,
        activePlayerCount: room.getActivePlayerCount(),
      });
    } else {
      // Both room and queue are full
      Logger.logPlayer({
        event: 'player_rejected',
        timestamp: new Date().toISOString(),
        username,
        email,
        socketId: socket.id,
        roomId,
        ip: socket.handshake.address,
        reason: 'game_full'
      });

      socket.emit('game_full', {
        message: 'Game is full and queue is at capacity. Please try again later.',
      });

      // Leave the room since they can't join
      socket.leave(roomId);
      currentRoom = null;
    }
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

    // Create full command with current game epoch
    const fullCommand: AircraftCommand = {
      ...command,
      id: randomBytes(8).toString('hex'),
      timestamp: Date.now(),
      gameEpoch: room.getGameState().gameEpoch,
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
    if (currentRoom) {
      const room = gameEngine.getRoom(currentRoom);
      if (room) {
        const controller = room.getGameState().controllers[socket.id];
        const queuedPlayer = room.getQueuePosition(socket.id);

        if (controller) {
          // Active player disconnected - log with session data
          const username = controller.username;
          const duration = joinedAt ? Date.now() - joinedAt : undefined;

          Logger.logPlayer({
            event: 'player_disconnected',
            timestamp: new Date().toISOString(),
            username: controller.username,
            email: controller.email,
            socketId: socket.id,
            roomId: currentRoom,
            duration,
            commandsIssued: controller.commandsIssued,
            score: controller.score,
            reason
          });

          room.removeController(socket.id);

          // Notify others that player left the game
          io.to(currentRoom).emit('player_left_game', {
            username,
            playerId: socket.id,
          });

          // Also send controller_update for backward compatibility
          io.to(currentRoom).emit('controller_update', {
            type: 'left',
            controller,
          });

          // Try to promote a queued player
          const promotedPlayer = room.promoteFromQueue();
          if (promotedPlayer) {
            // Find the socket for the promoted player
            const promotedSocket = io.sockets.sockets.get(promotedPlayer.socketId);
            if (promotedSocket) {
              // Log promotion event
              const queueDuration = Date.now() - promotedPlayer.joinedQueueAt;

              Logger.logPlayer({
                event: 'player_promoted',
                timestamp: new Date().toISOString(),
                username: promotedPlayer.username,
                email: promotedPlayer.email,
                socketId: promotedPlayer.socketId,
                roomId: currentRoom,
                duration: queueDuration, // time spent in queue
                queuePosition: promotedPlayer.position
              });

              // Add as active controller
              const newController = room.addController(
                promotedPlayer.socketId,
                promotedPlayer.username,
                promotedPlayer.email
              );

              // Notify the promoted player
              promotedSocket.emit('promoted_from_queue', {});

              // Send them the game state
              const gameState = room.getGameState();
              promotedSocket.emit('game_state', gameState);

              // Notify everyone that new player entered
              io.to(currentRoom).emit('player_entered_game', {
                username: newController.username,
                playerId: newController.id,
              });

              // Batch update queue positions for remaining queued players
              const remainingQueue = room.getQueuedPlayers();
              if (remainingQueue.length > 0) {
                io.to(currentRoom).emit('queue_updated', {
                  queue: remainingQueue.map(qp => ({
                    position: qp.position,
                    socketId: qp.socketId,
                  })),
                });
              }
            }
          }

          // Delete room if empty
          gameEngine.deleteRoomIfEmpty(currentRoom);
        } else if (queuedPlayer !== null) {
          // Queued player disconnected - get player info before removing
          const queuedPlayers = room.getQueuedPlayers();
          const playerInfo = queuedPlayers.find(p => p.socketId === socket.id);

          if (playerInfo) {
            const duration = joinedAt ? Date.now() - joinedAt : undefined;

            Logger.logPlayer({
              event: 'player_disconnected',
              timestamp: new Date().toISOString(),
              username: playerInfo.username,
              email: playerInfo.email,
              socketId: socket.id,
              roomId: currentRoom,
              queuePosition: playerInfo.position,
              duration,
              reason
            });
          }

          room.removeFromQueue(socket.id);

          // Batch update queue positions for remaining queued players
          const remainingQueue = room.getQueuedPlayers();
          if (remainingQueue.length > 0) {
            io.to(currentRoom).emit('queue_updated', {
              queue: remainingQueue.map(qp => ({
                position: qp.position,
                socketId: qp.socketId,
              })),
            });
          }
        }
      }
    } else {
      // Player disconnected without joining a room
      Logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    }
  });
});

// Async startup function
async function startServer() {
  try {
    // Load secrets from Secret Manager (production) or environment (development)
    await loadSecrets();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    UNHINGED ATC SERVER                     ║
╠═══════════════════════════════════════════════════════════╣
║  Status: ONLINE                                            ║
║  Port: ${PORT.toString().padEnd(52)}║
║  CORS Origin: ${(Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN).padEnd(44)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)}║
║  Security: Helmet + Rate Limiting ENABLED                  ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

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
