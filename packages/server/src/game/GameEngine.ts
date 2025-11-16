import { Server as SocketIOServer } from 'socket.io';
import { GameRoom } from './GameRoom.js';
import { GAME_CONFIG, GameEndData } from 'shared';

export class GameEngine {
  private rooms: Map<string, GameRoom> = new Map();
  private io: SocketIOServer;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = Date.now();
  private gameEndHandlers: Map<string, NodeJS.Timeout> = new Map(); // Track scheduled game restarts

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Start the game engine
   */
  start(): void {
    if (this.gameLoopInterval) {
      console.warn('[GameEngine] Already running');
      return;
    }

    // Create default room
    const defaultRoom = this.createRoom('default');
    console.log('[GameEngine] Created default room');

    // Start game loop at 60 FPS (16.67ms per frame)
    const frameTime = 1000 / GAME_CONFIG.TICK_RATE;
    this.lastUpdateTime = Date.now();

    this.gameLoopInterval = setInterval(() => {
      this.gameLoop();
    }, frameTime);

    console.log(`[GameEngine] Started at ${GAME_CONFIG.TICK_RATE} FPS`);
  }

  /**
   * Stop the game engine
   */
  stop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      console.log('[GameEngine] Stopped');
    }
  }

  /**
   * Main game loop (called 60 times per second)
   */
  private gameLoop(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = now;

    // Update all rooms
    this.rooms.forEach((room, roomId) => {
      const delta = room.update(deltaTime);

      // Broadcast state delta to all clients in room
      // Always emit delta (clients can decide if they need to act on it)
      this.io.to(roomId).emit('state_update', delta);

      // Check if game has ended
      if (room.hasGameEnded() && !this.gameEndHandlers.has(roomId)) {
        const gameEndData = room.getGameEndData();
        if (gameEndData) {
          // Broadcast game end to all players
          this.io.to(roomId).emit('game_ended', gameEndData);

          console.log(`[GameEngine] Game ended in room ${roomId}: ${gameEndData.reason}`);

          // Schedule game restart after 5 seconds
          const restartTimeout = setTimeout(() => {
            this.handleGameRestart(roomId);
            this.gameEndHandlers.delete(roomId);
          }, GAME_CONFIG.GAME_END_DISPLAY_DURATION);

          this.gameEndHandlers.set(roomId, restartTimeout);
        }
      }

      // Broadcast new events - DISABLED: events are already in delta.newEvents
      // Emitting separately was causing duplicates on the client side
      // if (delta.newEvents && delta.newEvents.length > 0) {
      //   delta.newEvents.forEach((event) => {
      //     this.io.to(roomId).emit('game_event', event);
      //   });
      // }
    });
  }

  /**
   * Handle game restart - notify players and preserve queue positions
   */
  private handleGameRestart(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[GameEngine] Restarting game in room ${roomId}`);

    // Get all connected sockets in this room
    const socketsInRoom = this.io.sockets.adapter.rooms.get(roomId);

    if (socketsInRoom) {
      // Notify all players game is restarting (they remain in room and will auto-rejoin queue)
      socketsInRoom.forEach((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('game_restarting', { message: 'Game ended. Preparing next round...' });
          // Note: Players stay in room, will auto-rejoin queue via client
        }
      });
    }

    // Reset the room for next game (clears active controllers, preserves queue)
    room.resetForNextGame();

    // Promote queued players to fill the new game
    const maxPlayers = GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM;
    for (let i = 0; i < maxPlayers; i++) {
      const queuedPlayer = room.getNextQueuedPlayer();
      if (!queuedPlayer) break;

      // Get the socket
      const socket = this.io.sockets.sockets.get(queuedPlayer.socketId);
      if (socket) {
        // Join the room
        socket.join(roomId);

        // Add as controller
        const controller = room.addController(
          queuedPlayer.socketId,
          queuedPlayer.username,
          queuedPlayer.email
        );

        // Send game state to newly promoted player
        socket.emit('promoted_from_queue', {
          gameState: room.getGameState(),
          controller,
        });

        console.log(`[GameEngine] Promoted ${queuedPlayer.username} from queue in room ${roomId}`);
      }

      // Remove from queue
      room.removeFromQueue(queuedPlayer.socketId);
    }

    console.log(`[GameEngine] Game restarted in room ${roomId}`);
  }

  /**
   * Create a new game room
   */
  createRoom(roomId: string): GameRoom {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    const room = new GameRoom(roomId);
    this.rooms.set(roomId, room);

    console.log(`[GameEngine] Created room: ${roomId}`);
    return room;
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get or create a room
   */
  getOrCreateRoom(roomId: string): GameRoom {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }
    return room;
  }

  /**
   * Delete a room if empty
   */
  deleteRoomIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.getControllerCount() === 0 && roomId !== 'default') {
      this.rooms.delete(roomId);
      console.log(`[GameEngine] Deleted empty room: ${roomId}`);
    }
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Map<string, GameRoom> {
    return this.rooms;
  }

  /**
   * Get game statistics
   */
  getStats(): {
    totalRooms: number;
    totalControllers: number;
    totalAircraft: number;
  } {
    let totalControllers = 0;
    let totalAircraft = 0;

    this.rooms.forEach((room) => {
      const state = room.getGameState();
      totalControllers += Object.keys(state.controllers).length;
      totalAircraft += Object.keys(state.aircraft).length;
    });

    return {
      totalRooms: this.rooms.size,
      totalControllers,
      totalAircraft,
    };
  }
}
