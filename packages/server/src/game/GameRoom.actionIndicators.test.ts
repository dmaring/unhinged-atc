import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom.js';
import { AircraftCommand } from 'shared';

describe('GameRoom - Action Indicators System', () => {
  let gameRoom: GameRoom;
  let controllerId: string;
  let aircraftId: string;

  beforeEach(() => {
    // Create a fresh game room for each test
    gameRoom = new GameRoom('test-room');

    // Add a controller
    const controller = gameRoom.addController('socket-1', 'TestController', 'test@example.com');
    controllerId = controller.id;

    // Get the ID of the first spawned aircraft
    const gameState = gameRoom.getGameState();
    aircraftId = Object.keys(gameState.aircraft)[0];
  });

  describe('Action Indicator Generation', () => {
    it('should generate a "locked" action indicator when selecting an aircraft', () => {
      // Arrange
      const selectCommand: AircraftCommand = {
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      };

      // Act
      gameRoom.processCommand(selectCommand);
      const delta = gameRoom.update(1 / 60); // One frame update

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      expect(delta.actionIndicators!.length).toBeGreaterThan(0);

      const lockIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.aircraftId === aircraftId && indicator.type === 'locked'
      );

      expect(lockIndicator).toBeDefined();
      expect(lockIndicator!.message).toBe('LOCKED');
      expect(lockIndicator!.aircraftId).toBe(aircraftId);
      expect(lockIndicator!.timestamp).toBeDefined();
      expect(lockIndicator!.id).toBeDefined();
    });

    it('should generate a "turn" action indicator for heading commands', () => {
      // Arrange
      const targetHeading = 270;
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: targetHeading },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const turnIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'turn'
      );

      expect(turnIndicator).toBeDefined();
      expect(turnIndicator!.message).toBe('270°');
      expect(turnIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate a "climb" action indicator for climb commands', () => {
      // Arrange
      const targetAltitude = 25000;
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: targetAltitude },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const climbIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'climb'
      );

      expect(climbIndicator).toBeDefined();
      expect(climbIndicator!.message).toBe('FL250'); // 25000 / 100 = FL250
      expect(climbIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate a "descend" action indicator for descend commands', () => {
      // Arrange
      const targetAltitude = 10000;
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'descend',
        params: { altitude: targetAltitude },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const descendIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'descend'
      );

      expect(descendIndicator).toBeDefined();
      expect(descendIndicator!.message).toBe('FL100'); // 10000 / 100 = FL100
      expect(descendIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate a "speed" action indicator for speed commands', () => {
      // Arrange
      const targetSpeed = 300;
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'speed',
        params: { speed: targetSpeed },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const speedIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'speed'
      );

      expect(speedIndicator).toBeDefined();
      expect(speedIndicator!.message).toBe('300kts');
      expect(speedIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate "LANDING" indicator for land commands', () => {
      // Arrange
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'land',
        params: { runway: '28L' },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const landIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.message === 'LANDING'
      );

      expect(landIndicator).toBeDefined();
      expect(landIndicator!.type).toBe('descend'); // Land uses descend type
      expect(landIndicator!.aircraftId).toBe(aircraftId);
    });

    it.skip('should generate "HOLD" indicator for hold commands', () => {
      // NOTE: 'hold' command type is not yet implemented in CommandProcessor
      // This test is skipped until the feature is implemented
      // Arrange
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'hold',
        params: {},
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const holdIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.message === 'HOLD'
      );

      expect(holdIndicator).toBeDefined();
      expect(holdIndicator!.type).toBe('turn'); // Hold uses turn type
      expect(holdIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate "DIRECT" indicator for direct commands', () => {
      // Arrange
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'direct',
        params: { waypoint: 'MIDPT' },
      });

      // Act
      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const directIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.message === 'DIRECT'
      );

      expect(directIndicator).toBeDefined();
      expect(directIndicator!.type).toBe('turn'); // Direct uses turn type
      expect(directIndicator!.aircraftId).toBe(aircraftId);
    });

    it('should generate an "error" indicator when trying to command a locked aircraft', () => {
      // Arrange - Controller 1 locks the aircraft
      const controller2 = gameRoom.addController('socket-2', 'Controller2', 'test2@example.com');

      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Clear the delta
      gameRoom.update(1 / 60);

      // Act - Controller 2 tries to command the locked aircraft
      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller2.id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const errorIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'error'
      );

      expect(errorIndicator).toBeDefined();
      expect(errorIndicator!.message).toBe('LOCKED!');
      expect(errorIndicator!.aircraftId).toBe(aircraftId);
    });
  });

  describe('Action Indicator Properties', () => {
    it('should include all required properties in action indicators', () => {
      // Arrange & Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const indicator = delta.actionIndicators![0];

      expect(indicator).toHaveProperty('id');
      expect(indicator).toHaveProperty('aircraftId');
      expect(indicator).toHaveProperty('type');
      expect(indicator).toHaveProperty('message');
      expect(indicator).toHaveProperty('timestamp');

      expect(typeof indicator.id).toBe('string');
      expect(typeof indicator.aircraftId).toBe('string');
      expect(typeof indicator.type).toBe('string');
      expect(typeof indicator.message).toBe('string');
      expect(typeof indicator.timestamp).toBe('number');
    });

    it('should generate unique IDs for each action indicator', () => {
      // Arrange & Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: 30000 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      expect(delta.actionIndicators!.length).toBe(2);

      const id1 = delta.actionIndicators![0].id;
      const id2 = delta.actionIndicators![1].id;

      expect(id1).not.toBe(id2);
    });

    it('should have timestamps close to command time', () => {
      // Arrange
      const beforeCommand = Date.now();

      // Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      const delta = gameRoom.update(1 / 60);
      const afterCommand = Date.now();

      // Assert
      expect(delta.actionIndicators).toBeDefined();
      const indicator = delta.actionIndicators![0];

      expect(indicator.timestamp).toBeGreaterThanOrEqual(beforeCommand);
      expect(indicator.timestamp).toBeLessThanOrEqual(afterCommand);
    });
  });

  describe('Action Indicator Lifecycle', () => {
    it('should clear action indicators after sending them in a delta', () => {
      // Arrange & Act - Issue command and get first delta
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      const delta1 = gameRoom.update(1 / 60);
      expect(delta1.actionIndicators).toBeDefined();
      expect(delta1.actionIndicators!.length).toBeGreaterThan(0);

      // Get second delta without new commands
      const delta2 = gameRoom.update(1 / 60);

      // Assert - Second delta should not have the same indicators
      if (delta2.actionIndicators) {
        expect(delta2.actionIndicators.length).toBe(0);
      } else {
        expect(delta2.actionIndicators).toBeUndefined();
      }
    });

    it('should accumulate multiple action indicators before update', () => {
      // Arrange & Act - Issue multiple commands before update
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);

      // Ensure we're using valid altitudes for climb (higher than current)
      const aircraft1 = gameState.aircraft[aircraftIds[0]];
      const aircraft2 = gameState.aircraft[aircraftIds[1]];
      const aircraft3 = gameState.aircraft[aircraftIds[2]];

      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraftIds[0],
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraftIds[1],
        controllerId,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: aircraft2.altitude + 5000 }, // Ensure climbing to higher altitude
      });

      gameRoom.processCommand({
        id: 'cmd-3',
        aircraftId: aircraftIds[2],
        controllerId,
        timestamp: Date.now(),
        type: 'speed',
        params: { speed: 300 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert - Should have indicators for all commands
      expect(delta.actionIndicators).toBeDefined();
      expect(delta.actionIndicators!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Action Indicators with Multiple Aircraft', () => {
    it('should track different action indicators for different aircraft', () => {
      // Arrange
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);
      const aircraft1Id = aircraftIds[0];
      const aircraft2Id = aircraftIds[1];

      // Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraft1Id,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraft2Id,
        controllerId,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: 30000 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert
      expect(delta.actionIndicators).toBeDefined();

      const aircraft1Indicators = delta.actionIndicators!.filter(
        (indicator) => indicator.aircraftId === aircraft1Id
      );
      const aircraft2Indicators = delta.actionIndicators!.filter(
        (indicator) => indicator.aircraftId === aircraft2Id
      );

      expect(aircraft1Indicators.length).toBeGreaterThan(0);
      expect(aircraft2Indicators.length).toBeGreaterThan(0);

      expect(aircraft1Indicators[0].type).toBe('turn');
      expect(aircraft2Indicators[0].type).toBe('climb');
    });
  });

  describe('Integration with Ownership', () => {
    it('should only generate action indicators for successful commands', () => {
      // Arrange - Controller 1 owns aircraft
      const controller2 = gameRoom.addController('socket-2', 'Controller2', 'test2@example.com');

      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      gameRoom.update(1 / 60); // Clear indicators

      // Act - Controller 2 tries invalid command (should fail)
      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller2.id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert - Should have error indicator, not turn indicator
      expect(delta.actionIndicators).toBeDefined();
      const turnIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'turn'
      );
      const errorIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'error'
      );

      expect(turnIndicator).toBeUndefined();
      expect(errorIndicator).toBeDefined();
    });

    it('should generate action indicators when auto-assigning ownership', () => {
      // Act - Command without prior selection (should auto-assign)
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      const delta = gameRoom.update(1 / 60);

      // Assert - Should have turn indicator
      expect(delta.actionIndicators).toBeDefined();
      const turnIndicator = delta.actionIndicators!.find(
        (indicator) => indicator.type === 'turn' && indicator.aircraftId === aircraftId
      );

      expect(turnIndicator).toBeDefined();
      expect(turnIndicator!.message).toBe('180°');
    });
  });
});
