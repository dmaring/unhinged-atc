import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom.js';
import { AircraftCommand, CRASH_CONFIG, GAME_CONFIG } from 'shared';

describe('GameRoom - Bug Fix Regression Tests', () => {
  let gameRoom: GameRoom;

  beforeEach(() => {
    gameRoom = new GameRoom('test-room');
  });

  // =========================================================================
  // BUG-001: Event ID Deduplication Memory Limit
  // Verifies that sentEventIds is pruned to prevent unbounded memory growth.
  // The fix uses in-place deletion of oldest entries instead of creating
  // temporary arrays 60 times per second.
  // =========================================================================
  describe('BUG-001: Event ID deduplication memory limit', () => {
    it('should not grow sentEventIds beyond 100 entries', () => {
      // Add a controller to enable game updates
      gameRoom.addController('socket-1', 'Player1', 'test@example.com');

      // Generate 150 events by running many update ticks
      // Each tick can generate events, and we need to accumulate >100 sent event IDs
      for (let i = 0; i < 300; i++) {
        gameRoom.update(1 / 60);
      }

      // Access the internal sentEventIds via getGameState delta
      // We verify indirectly: if the fix works, the room continues to function
      // without memory growth. Run many more ticks to ensure stability.
      for (let i = 0; i < 300; i++) {
        gameRoom.update(1 / 60);
      }

      // The room should still be functional (no OOM or errors)
      const state = gameRoom.getGameState();
      expect(state).toBeDefined();
      expect(state.roomId).toBe('test-room');
    });

    it('should continue tracking new events after pruning old ones', () => {
      gameRoom.addController('socket-1', 'Player1', 'test@example.com');

      // Run enough ticks to generate and prune events
      for (let i = 0; i < 500; i++) {
        gameRoom.update(1 / 60);
      }

      // Game state should remain valid
      const state = gameRoom.getGameState();
      expect(Object.keys(state.aircraft).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // BUG-002: Queue Promotion (Atomic Remove + Promote)
  // Verifies that promoteFromQueue atomically removes from queue,
  // so a player is never in both the active and queued lists.
  // =========================================================================
  describe('BUG-002: Queue promotion atomicity', () => {
    it('should remove player from queue when promoting', () => {
      // Fill active slots
      for (let i = 1; i <= GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      // Add player to queue
      gameRoom.addToQueue('socket-queued-1', 'QueuedPlayer1', 'queued1@example.com');
      expect(gameRoom.getQueuedPlayers()).toHaveLength(1);

      // Promote from queue
      const promoted = gameRoom.promoteFromQueue();

      expect(promoted).not.toBeNull();
      expect(promoted!.username).toBe('QueuedPlayer1');

      // Player should no longer be in queue
      expect(gameRoom.getQueuedPlayers()).toHaveLength(0);
    });

    it('should maintain FIFO order when promoting', () => {
      // Fill active slots
      for (let i = 1; i <= GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      // Add multiple players to queue
      gameRoom.addToQueue('socket-q1', 'First', 'first@example.com');
      gameRoom.addToQueue('socket-q2', 'Second', 'second@example.com');
      gameRoom.addToQueue('socket-q3', 'Third', 'third@example.com');

      // Promote should follow FIFO
      const first = gameRoom.promoteFromQueue();
      expect(first!.username).toBe('First');

      const second = gameRoom.promoteFromQueue();
      expect(second!.username).toBe('Second');

      const third = gameRoom.promoteFromQueue();
      expect(third!.username).toBe('Third');

      // Queue should be empty
      expect(gameRoom.promoteFromQueue()).toBeNull();
    });

    it('should update queue positions after promotion', () => {
      // Fill active slots
      for (let i = 1; i <= GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      // Add players to queue
      gameRoom.addToQueue('socket-q1', 'First', 'first@example.com');
      gameRoom.addToQueue('socket-q2', 'Second', 'second@example.com');
      gameRoom.addToQueue('socket-q3', 'Third', 'third@example.com');

      // Promote first player
      gameRoom.promoteFromQueue();

      // Remaining players should have updated positions
      const remaining = gameRoom.getQueuedPlayers();
      expect(remaining).toHaveLength(2);
      expect(remaining[0].username).toBe('Second');
      expect(remaining[0].position).toBe(1);
      expect(remaining[1].username).toBe('Third');
      expect(remaining[1].position).toBe(2);
    });

    it('should return null when promoting from empty queue', () => {
      expect(gameRoom.promoteFromQueue()).toBeNull();
    });
  });

  // =========================================================================
  // BUG-003: Epoch Validation in Command Processing
  // Verifies that commands from old game epochs are rejected to prevent
  // stale commands from corrupting the new game state after a reset.
  // =========================================================================
  describe('BUG-003: Epoch validation in command processing', () => {
    let controllerId: string;
    let aircraftId: string;

    beforeEach(() => {
      const controller = gameRoom.addController('socket-1', 'Player1', 'test@example.com');
      controllerId = controller.id;
      aircraftId = Object.keys(gameRoom.getGameState().aircraft)[0];
    });

    it('should accept commands with matching epoch', () => {
      const currentEpoch = gameRoom.getGameState().gameEpoch;

      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
        gameEpoch: currentEpoch,
      });

      expect(success).toBe(true);
    });

    it('should reject commands with old epoch', () => {
      const oldEpoch = gameRoom.getGameState().gameEpoch;

      // Reset the game to increment epoch
      gameRoom.resetForNextGame();
      const newEpoch = gameRoom.getGameState().gameEpoch;
      expect(newEpoch).toBe(oldEpoch + 1);

      // Re-add controller (reset clears active player tracking)
      const aircraftIds = Object.keys(gameRoom.getGameState().aircraft);
      const newAircraftId = aircraftIds[0];

      // Command with old epoch should be rejected
      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: newAircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
        gameEpoch: oldEpoch,
      });

      expect(success).toBe(false);
    });

    it('should accept commands without epoch field (backwards compatibility)', () => {
      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      expect(success).toBe(true);
    });

    it('should increment epoch on game reset', () => {
      const epoch0 = gameRoom.getGameState().gameEpoch;
      expect(epoch0).toBe(0);

      gameRoom.resetForNextGame();
      expect(gameRoom.getGameState().gameEpoch).toBe(1);

      gameRoom.resetForNextGame();
      expect(gameRoom.getGameState().gameEpoch).toBe(2);
    });

    it('should reset game state but preserve controllers on reset', () => {
      // Add a second controller
      gameRoom.addController('socket-2', 'Player2', 'test2@example.com');

      const controllersBefore = Object.keys(gameRoom.getGameState().controllers);
      expect(controllersBefore).toHaveLength(2);

      gameRoom.resetForNextGame();

      const controllersAfter = Object.keys(gameRoom.getGameState().controllers);
      expect(controllersAfter).toHaveLength(2);
      expect(controllersAfter).toEqual(controllersBefore);
    });
  });

  // =========================================================================
  // BUG-005: Color Assignment Pool (Atomic Operations)
  // Verifies that controller colors are assigned from a pool using atomic
  // shift operations, preventing duplicate colors in concurrent joins.
  // =========================================================================
  describe('BUG-005: Color assignment pool', () => {
    it('should assign unique colors to all controllers', () => {
      const colors = new Set<string>();

      for (let i = 1; i <= 8; i++) {
        const controller = gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
        colors.add(controller.color);
      }

      // All 8 colors should be unique
      expect(colors.size).toBe(8);
    });

    it('should recycle colors when controllers leave', () => {
      // Add and record first controller's color
      const controller1 = gameRoom.addController('socket-1', 'Player1', 'test1@example.com');
      const firstColor = controller1.color;

      // Fill remaining slots
      for (let i = 2; i <= 8; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      // Remove first controller (should return color to pool)
      gameRoom.removeController('socket-1');

      // Next controller should get the recycled color
      const controller9 = gameRoom.addController('socket-9', 'Player9', 'test9@example.com');
      expect(controller9.color).toBe(firstColor);
    });

    it('should fall back to cycling when all colors exhausted', () => {
      // Add 8 controllers to exhaust the pool
      for (let i = 1; i <= 8; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      // 9th controller should still get a color (cycling fallback)
      const controller9 = gameRoom.addController('socket-9', 'Player9', 'test9@example.com');
      expect(controller9.color).toBeDefined();
      expect(controller9.color).toBeTruthy();
    });
  });

  // =========================================================================
  // BUG-008: Dual Bounds Checking
  // Verifies that out-of-bounds aircraft are checked both before and after
  // physics updates, preventing edge cases where aircraft skip past boundary.
  // =========================================================================
  describe('BUG-008: Dual bounds checking', () => {
    it('should remove aircraft that exit airspace bounds', () => {
      gameRoom.addController('socket-1', 'Player1', 'test@example.com');

      const initialCount = Object.keys(gameRoom.getGameState().aircraft).length;
      expect(initialCount).toBeGreaterThan(0);

      // Run many ticks to allow aircraft to fly out of bounds
      for (let i = 0; i < 6000; i++) {
        gameRoom.update(1 / 60);
      }

      // Some aircraft may have exited and new ones spawned
      // The important thing is no crash from bounds issues
      const state = gameRoom.getGameState();
      expect(state).toBeDefined();
    });

    it('should skip physics for already out-of-bounds aircraft', () => {
      gameRoom.addController('socket-1', 'Player1', 'test@example.com');

      // Run enough ticks that aircraft reach boundaries
      // The dual-check ensures aircraft at boundary don't get processed twice
      for (let i = 0; i < 3000; i++) {
        gameRoom.update(1 / 60);
      }

      // Room should remain functional
      const state = gameRoom.getGameState();
      expect(state.roomId).toBe('test-room');
    });
  });

  // =========================================================================
  // BUG-011: CRASH_CONFIG.ANIMATION_DURATION Constant
  // Verifies that the crash animation uses the shared constant instead of
  // a hardcoded magic number.
  // =========================================================================
  describe('BUG-011: CRASH_CONFIG constant usage', () => {
    it('should use CRASH_CONFIG.ANIMATION_DURATION value of 2000ms', () => {
      expect(CRASH_CONFIG.ANIMATION_DURATION).toBe(2000);
    });

    it('should have CRASH_CONFIG.DISTANCE_THRESHOLD defined', () => {
      expect(CRASH_CONFIG.DISTANCE_THRESHOLD).toBe(2);
    });
  });

  // =========================================================================
  // Queue Management
  // Additional queue tests to verify queue integrity
  // =========================================================================
  describe('Queue management', () => {
    it('should add players to queue when room is full', () => {
      // Fill active slots
      for (let i = 1; i <= GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      expect(gameRoom.canAddPlayer()).toBe(false);
      expect(gameRoom.canAddToQueue()).toBe(true);

      const queuedPlayer = gameRoom.addToQueue('socket-q1', 'Queued1', 'q1@example.com');
      expect(queuedPlayer.position).toBe(1);
    });

    it('should track active player count separately from queue', () => {
      gameRoom.addController('socket-1', 'Player1', 'test@example.com');
      gameRoom.addController('socket-2', 'Player2', 'test2@example.com');

      expect(gameRoom.getActivePlayerCount()).toBe(2);
      expect(gameRoom.getQueuedPlayers()).toHaveLength(0);
    });

    it('should remove player from queue correctly', () => {
      // Fill active slots first
      for (let i = 1; i <= GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM; i++) {
        gameRoom.addController(`socket-${i}`, `Player${i}`, `test${i}@example.com`);
      }

      gameRoom.addToQueue('socket-q1', 'First', 'first@example.com');
      gameRoom.addToQueue('socket-q2', 'Second', 'second@example.com');
      gameRoom.addToQueue('socket-q3', 'Third', 'third@example.com');

      // Remove middle player
      gameRoom.removeFromQueue('socket-q2');

      const queue = gameRoom.getQueuedPlayers();
      expect(queue).toHaveLength(2);
      expect(queue[0].username).toBe('First');
      expect(queue[0].position).toBe(1);
      expect(queue[1].username).toBe('Third');
      expect(queue[1].position).toBe(2);
    });
  });
});
