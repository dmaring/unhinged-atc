import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { GameState, Aircraft, Controller } from 'shared';

describe('GameStore - Action Indicators', () => {
  beforeEach(() => {
    // Reset the store before each test
    useGameStore.getState().reset();
  });

  const createMockGameState = (): GameState => ({
    roomId: 'test-room',
    createdAt: Date.now(),
    gameEpoch: 0,
    aircraft: {},
    airspace: {
      bounds: { minX: -25, maxX: 25, minY: -25, maxY: 25 },
      airports: [],
      waypoints: [],
      restrictedZones: [],
      weather: [],
    },
    controllers: {},
    score: 0,
    successfulLandings: 0,
    nearMisses: 0,
    collisions: 0,
    planesCleared: 0,
    crashCount: 0,
    recentEvents: [],
    gameTime: 0,
    isPaused: false,
    timeScale: 3,
    gameStartTime: Date.now(),
    gameEndTime: Date.now() + 300000,
    lastSpawnTime: 0,
    nextBonusAt: 180,
    lastAutoChaosTime: 0,
    chaosAbilities: {},
  });

  describe('addActionIndicator', () => {
    it('should add an action indicator to the store', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      // Act
      store.addActionIndicator(indicator);

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(1);
      expect(state.actionIndicators[0]).toEqual(indicator);
    });

    it('should add multiple action indicators', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator1 = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      const indicator2 = {
        id: 'indicator-2',
        aircraftId: 'aircraft-2',
        type: 'climb',
        message: 'FL250',
        timestamp: Date.now(),
      };

      // Act
      store.addActionIndicator(indicator1);
      store.addActionIndicator(indicator2);

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(2);
      expect(state.actionIndicators[0]).toEqual(indicator1);
      expect(state.actionIndicators[1]).toEqual(indicator2);
    });

    it('should maintain action indicators in insertion order', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicators = [
        { id: '1', aircraftId: 'a1', type: 'turn', message: '90°', timestamp: Date.now() },
        { id: '2', aircraftId: 'a2', type: 'climb', message: 'FL200', timestamp: Date.now() + 1 },
        { id: '3', aircraftId: 'a3', type: 'speed', message: '300kts', timestamp: Date.now() + 2 },
      ];

      // Act
      indicators.forEach((indicator) => store.addActionIndicator(indicator));

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(3);
      expect(state.actionIndicators[0].id).toBe('1');
      expect(state.actionIndicators[1].id).toBe('2');
      expect(state.actionIndicators[2].id).toBe('3');
    });

    it('should allow duplicate aircraft IDs with different indicator IDs', () => {
      // Arrange - Same aircraft can have multiple action indicators
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator1 = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      const indicator2 = {
        id: 'indicator-2',
        aircraftId: 'aircraft-1', // Same aircraft
        type: 'climb',
        message: 'FL250',
        timestamp: Date.now() + 100,
      };

      // Act
      store.addActionIndicator(indicator1);
      store.addActionIndicator(indicator2);

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(2);
      expect(state.actionIndicators.filter((i) => i.aircraftId === 'aircraft-1')).toHaveLength(2);
    });
  });

  describe('removeActionIndicator', () => {
    it('should remove an action indicator by ID', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      store.addActionIndicator(indicator);
      expect(useGameStore.getState().actionIndicators).toHaveLength(1);

      // Act
      store.removeActionIndicator('indicator-1');

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(0);
    });

    it('should only remove the indicator with matching ID', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator1 = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      const indicator2 = {
        id: 'indicator-2',
        aircraftId: 'aircraft-2',
        type: 'climb',
        message: 'FL250',
        timestamp: Date.now(),
      };

      store.addActionIndicator(indicator1);
      store.addActionIndicator(indicator2);

      // Act
      store.removeActionIndicator('indicator-1');

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(1);
      expect(state.actionIndicators[0].id).toBe('indicator-2');
    });

    it('should handle removing non-existent indicator gracefully', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      store.addActionIndicator(indicator);

      // Act - Try to remove a different ID
      store.removeActionIndicator('non-existent-id');

      // Assert - Original indicator should still be there
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(1);
      expect(state.actionIndicators[0].id).toBe('indicator-1');
    });

    it('should handle removing from empty array', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      // Act & Assert - Should not throw
      expect(() => store.removeActionIndicator('any-id')).not.toThrow();
      expect(useGameStore.getState().actionIndicators).toHaveLength(0);
    });

    it('should preserve remaining indicators when removing one', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicators = [
        { id: '1', aircraftId: 'a1', type: 'turn', message: '90°', timestamp: Date.now() },
        { id: '2', aircraftId: 'a2', type: 'climb', message: 'FL200', timestamp: Date.now() },
        { id: '3', aircraftId: 'a3', type: 'speed', message: '300kts', timestamp: Date.now() },
      ];

      indicators.forEach((indicator) => store.addActionIndicator(indicator));

      // Act - Remove middle indicator
      store.removeActionIndicator('2');

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(2);
      expect(state.actionIndicators[0].id).toBe('1');
      expect(state.actionIndicators[1].id).toBe('3');
    });
  });

  describe('Action Indicator State Management', () => {
    it('should initialize with empty action indicators array', () => {
      // Act
      const state = useGameStore.getState();

      // Assert
      expect(state.actionIndicators).toEqual([]);
      expect(Array.isArray(state.actionIndicators)).toBe(true);
    });

    it('should reset action indicators when store is reset', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const indicator = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      store.addActionIndicator(indicator);
      expect(useGameStore.getState().actionIndicators).toHaveLength(1);

      // Act
      store.reset();

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toEqual([]);
    });

    it('should maintain action indicators independently of game state', () => {
      // Arrange
      const store = useGameStore.getState();
      const gameState1 = createMockGameState();
      gameState1.roomId = 'room-1';

      store.setGameState(gameState1);

      const indicator = {
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      };

      store.addActionIndicator(indicator);

      // Act - Update game state
      const gameState2 = createMockGameState();
      gameState2.roomId = 'room-2';
      store.setGameState(gameState2);

      // Assert - Action indicators should persist
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(1);
      expect(state.actionIndicators[0]).toEqual(indicator);
      expect(state.gameState?.roomId).toBe('room-2');
    });
  });

  describe('Action Indicator Types', () => {
    it('should handle "turn" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'turn',
        message: '270°',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('turn');
      expect(indicator.message).toBe('270°');
    });

    it('should handle "climb" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'climb',
        message: 'FL300',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('climb');
      expect(indicator.message).toBe('FL300');
    });

    it('should handle "descend" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'descend',
        message: 'FL100',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('descend');
      expect(indicator.message).toBe('FL100');
    });

    it('should handle "speed" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'speed',
        message: '350kts',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('speed');
      expect(indicator.message).toBe('350kts');
    });

    it('should handle "locked" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'locked',
        message: 'LOCKED',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('locked');
      expect(indicator.message).toBe('LOCKED');
    });

    it('should handle "error" type indicators', () => {
      // Arrange & Act
      const store = useGameStore.getState();
      store.addActionIndicator({
        id: '1',
        aircraftId: 'a1',
        type: 'error',
        message: 'LOCKED!',
        timestamp: Date.now(),
      });

      // Assert
      const indicator = useGameStore.getState().actionIndicators[0];
      expect(indicator.type).toBe('error');
      expect(indicator.message).toBe('LOCKED!');
    });
  });

  describe('Batch Operations', () => {
    it('should handle adding multiple indicators in rapid succession', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      // Act - Add 10 indicators rapidly
      for (let i = 0; i < 10; i++) {
        store.addActionIndicator({
          id: `indicator-${i}`,
          aircraftId: `aircraft-${i % 3}`, // Distribute across 3 aircraft
          type: 'turn',
          message: `${i * 10}°`,
          timestamp: Date.now() + i,
        });
      }

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(10);
    });

    it('should handle removing multiple indicators sequentially', () => {
      // Arrange
      const store = useGameStore.getState();
      store.setGameState(createMockGameState());

      const ids = ['1', '2', '3', '4', '5'];
      ids.forEach((id) => {
        store.addActionIndicator({
          id,
          aircraftId: 'a1',
          type: 'turn',
          message: '90°',
          timestamp: Date.now(),
        });
      });

      // Act - Remove half of them
      store.removeActionIndicator('1');
      store.removeActionIndicator('3');
      store.removeActionIndicator('5');

      // Assert
      const state = useGameStore.getState();
      expect(state.actionIndicators).toHaveLength(2);
      expect(state.actionIndicators.map((i) => i.id)).toEqual(['2', '4']);
    });
  });

  describe('Integration with Game State', () => {
    it('should work alongside other store operations', () => {
      // Arrange
      const store = useGameStore.getState();
      const gameState = createMockGameState();

      const aircraft: Aircraft = {
        id: 'aircraft-1',
        callsign: 'UAL123',
        type: 'B738',
        position: { x: 0, y: 0 },
        altitude: 15000,
        heading: 90,
        speed: 450,
        targetAltitude: 15000,
        targetHeading: 90,
        targetSpeed: 450,
        climbRate: 2000,
        turnRate: 3,
        acceleration: 5,
        origin: 'KSFO',
        destination: 'KOAK',
        route: [],
        flightPhase: 'cruise',
        fuel: 75,
        isLanded: false,
        hasCollided: false,
        trailHistory: [],
      };

      store.setGameState(gameState);

      // Act - Mix aircraft updates with action indicators
      store.addAircraft(aircraft);
      store.addActionIndicator({
        id: 'indicator-1',
        aircraftId: 'aircraft-1',
        type: 'turn',
        message: '180°',
        timestamp: Date.now(),
      });

      store.updateAircraft('aircraft-1', { heading: 180 });
      store.addActionIndicator({
        id: 'indicator-2',
        aircraftId: 'aircraft-1',
        type: 'climb',
        message: 'FL250',
        timestamp: Date.now(),
      });

      // Assert
      const state = useGameStore.getState();
      expect(state.gameState?.aircraft['aircraft-1']).toBeDefined();
      expect(state.gameState?.aircraft['aircraft-1'].heading).toBe(180);
      expect(state.actionIndicators).toHaveLength(2);
    });
  });
});
