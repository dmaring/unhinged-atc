import { Server as SocketIOServer } from 'socket.io';
import { GameRoom } from './GameRoom.js';
import { GAME_CONFIG } from 'shared';

export class GameEngine {
  private rooms: Map<string, GameRoom> = new Map();
  private io: SocketIOServer;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = Date.now();

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

      // Broadcast new events
      if (delta.newEvents && delta.newEvents.length > 0) {
        delta.newEvents.forEach((event) => {
          this.io.to(roomId).emit('game_event', event);
        });
      }
    });
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
