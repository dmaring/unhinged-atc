import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from './GameRoom.js';
import { AircraftCommand } from 'shared';

describe('GameRoom - Aircraft Ownership System', () => {
  let gameRoom: GameRoom;
  let controller1Id: string;
  let controller2Id: string;
  let aircraftId: string;

  beforeEach(() => {
    // Create a fresh game room for each test
    gameRoom = new GameRoom('test-room');

    // Add two controllers
    const controller1 = gameRoom.addController('socket-1', 'Controller1', 'test1@example.com');
    const controller2 = gameRoom.addController('socket-2', 'Controller2', 'test2@example.com');
    controller1Id = controller1.id;
    controller2Id = controller2.id;

    // Get the ID of the first spawned aircraft
    const gameState = gameRoom.getGameState();
    aircraftId = Object.keys(gameState.aircraft)[0];
  });

  describe('Aircraft Selection (select_aircraft command)', () => {
    it('should assign ownership when a controller selects an unowned aircraft', () => {
      // Arrange
      const selectCommand: AircraftCommand = {
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      };

      // Act
      const success = gameRoom.processCommand(selectCommand);

      // Assert
      expect(success).toBe(true);
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.ownerId).toBe(controller1Id);
      expect(aircraft.ownerColor).toBeDefined();
      expect(aircraft.ownerColor).toBe(gameState.controllers[controller1Id].color);
    });

    it('should prevent another controller from selecting an owned aircraft', () => {
      // Arrange - Controller 1 owns the aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Controller 2 tries to select the same aircraft
      const success = gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller2Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      expect(success).toBe(false);
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.ownerId).toBe(controller1Id); // Still owned by controller 1
    });

    it('should allow the same controller to re-select their owned aircraft', () => {
      // Arrange - Controller 1 owns the aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Controller 1 selects it again
      const success = gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      expect(success).toBe(true);
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.ownerId).toBe(controller1Id);
    });

    it('should release previous aircraft when selecting a new one', () => {
      // Arrange - Get two different aircraft
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);
      const aircraft1Id = aircraftIds[0];
      const aircraft2Id = aircraftIds[1];

      // Controller 1 selects first aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraft1Id,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Controller 1 selects second aircraft
      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraft2Id,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      const updatedState = gameRoom.getGameState();
      const aircraft1 = updatedState.aircraft[aircraft1Id];
      const aircraft2 = updatedState.aircraft[aircraft2Id];

      expect(aircraft1.ownerId).toBeNull(); // Released
      expect(aircraft1.ownerColor).toBeNull();
      expect(aircraft2.ownerId).toBe(controller1Id); // Now owned
      expect(aircraft2.ownerColor).toBe(updatedState.controllers[controller1Id].color);
    });
  });

  describe('Command Ownership Validation', () => {
    it('should reject commands to an aircraft owned by another controller', () => {
      // Arrange - Controller 1 owns the aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Controller 2 tries to issue a turn command
      const success = gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller2Id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      // Assert
      expect(success).toBe(false);
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.targetHeading).not.toBe(90); // Command was not applied
    });

    it('should allow commands from the owning controller', () => {
      // Arrange - Controller 1 owns the aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      const initialHeading = gameRoom.getGameState().aircraft[aircraftId].targetHeading;

      // Act - Controller 1 issues a turn command
      const success = gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 180 },
      });

      // Assert
      expect(success).toBe(true);
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.targetHeading).toBe(180); // Command was applied
    });

    it('should auto-assign ownership when commanding an unowned aircraft', () => {
      // Arrange - Verify aircraft is unowned
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.ownerId).toBeUndefined();

      // Act - Controller 1 issues a command without selecting first
      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 270 },
      });

      // Assert
      expect(success).toBe(true);
      const updatedState = gameRoom.getGameState();
      const updatedAircraft = updatedState.aircraft[aircraftId];
      expect(updatedAircraft.ownerId).toBe(controller1Id); // Auto-assigned
      expect(updatedAircraft.ownerColor).toBe(updatedState.controllers[controller1Id].color);
      expect(updatedAircraft.targetHeading).toBe(270); // Command was applied
    });

    it('should release previous aircraft when auto-assigning via command', () => {
      // Arrange - Get two different aircraft
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);
      const aircraft1Id = aircraftIds[0];
      const aircraft2Id = aircraftIds[1];

      // Controller 1 owns first aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraft1Id,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Controller 1 commands second aircraft (should auto-assign and release first)
      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraft2Id,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: 30000 },
      });

      // Assert
      const updatedState = gameRoom.getGameState();
      const aircraft1 = updatedState.aircraft[aircraft1Id];
      const aircraft2 = updatedState.aircraft[aircraft2Id];

      expect(aircraft1.ownerId).toBeNull(); // Released
      expect(aircraft2.ownerId).toBe(controller1Id); // Auto-assigned
    });
  });

  describe('Controller Color Assignment', () => {
    it('should assign unique colors to different controllers', () => {
      // Arrange & Act
      const gameState = gameRoom.getGameState();
      const controller1 = gameState.controllers[controller1Id];
      const controller2 = gameState.controllers[controller2Id];

      // Assert
      expect(controller1.color).toBeDefined();
      expect(controller2.color).toBeDefined();
      expect(controller1.color).not.toBe(controller2.color);
    });

    it('should cycle through colors when there are more controllers than colors', () => {
      // Arrange - Add 8 controllers (CONTROLLER_COLORS has 8 colors)
      const controllers = [];
      for (let i = 3; i <= 10; i++) {
        const controller = gameRoom.addController(`socket-${i}`, `Controller${i}`, `test${i}@example.com`);
        controllers.push(controller);
      }

      // Act & Assert - The 9th and 10th controllers should get the same colors as 1st and 2nd
      const gameState = gameRoom.getGameState();
      const controller1 = gameState.controllers[controller1Id];
      const controller9 = controllers[6]; // 9th controller (index 6 in controllers array)
      const controller2 = gameState.controllers[controller2Id];
      const controller10 = controllers[7]; // 10th controller

      expect(controller1.color).toBe(controller9.color);
      expect(controller2.color).toBe(controller10.color);
    });

    it('should propagate controller color to owned aircraft', () => {
      // Arrange
      const gameState = gameRoom.getGameState();
      const expectedColor = gameState.controllers[controller1Id].color;

      // Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      const updatedState = gameRoom.getGameState();
      const aircraft = updatedState.aircraft[aircraftId];
      expect(aircraft.ownerColor).toBe(expectedColor);
    });
  });

  describe('Multiple Controllers Interaction', () => {
    it('should allow multiple controllers to own different aircraft simultaneously', () => {
      // Arrange
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);
      const aircraft1Id = aircraftIds[0];
      const aircraft2Id = aircraftIds[1];

      // Act
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraft1Id,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraft2Id,
        controllerId: controller2Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      const updatedState = gameRoom.getGameState();
      const aircraft1 = updatedState.aircraft[aircraft1Id];
      const aircraft2 = updatedState.aircraft[aircraft2Id];

      expect(aircraft1.ownerId).toBe(controller1Id);
      expect(aircraft2.ownerId).toBe(controller2Id);
      expect(aircraft1.ownerColor).toBe(updatedState.controllers[controller1Id].color);
      expect(aircraft2.ownerColor).toBe(updatedState.controllers[controller2Id].color);
    });

    it('should enforce one aircraft per controller rule', () => {
      // Arrange
      const gameState = gameRoom.getGameState();
      const aircraftIds = Object.keys(gameState.aircraft);

      // Act - Controller 1 tries to own multiple aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: aircraftIds[0],
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId: aircraftIds[1],
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert - Should only own the second one (first was released)
      const updatedState = gameRoom.getGameState();
      const aircraft1 = updatedState.aircraft[aircraftIds[0]];
      const aircraft2 = updatedState.aircraft[aircraftIds[1]];

      expect(aircraft1.ownerId).toBeNull();
      expect(aircraft2.ownerId).toBe(controller1Id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle commands to non-existent aircraft gracefully', () => {
      // Act
      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId: 'non-existent-aircraft',
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      expect(success).toBe(false);
    });

    it('should handle commands from non-existent controller gracefully', () => {
      // Act
      const success = gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: 'non-existent-controller',
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Assert
      expect(success).toBe(false);
    });

    it('should preserve ownership across multiple command types', () => {
      // Arrange - Controller 1 selects aircraft
      gameRoom.processCommand({
        id: 'cmd-1',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'select_aircraft',
        params: {},
      });

      // Act - Issue various commands
      gameRoom.processCommand({
        id: 'cmd-2',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'turn',
        params: { heading: 90 },
      });

      gameRoom.processCommand({
        id: 'cmd-3',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'climb',
        params: { altitude: 25000 },
      });

      gameRoom.processCommand({
        id: 'cmd-4',
        aircraftId,
        controllerId: controller1Id,
        timestamp: Date.now(),
        type: 'speed',
        params: { speed: 300 },
      });

      // Assert - Ownership should persist
      const gameState = gameRoom.getGameState();
      const aircraft = gameState.aircraft[aircraftId];
      expect(aircraft.ownerId).toBe(controller1Id);
    });
  });
});
