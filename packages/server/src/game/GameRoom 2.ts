import {
  Aircraft,
  GameState,
  Controller,
  AircraftCommand,
  GameEvent,
  StateDelta,
  AIRCRAFT_TYPES,
  AircraftType
} from 'shared';
import { AircraftPhysics } from './AircraftPhysics.js';
import { CommandProcessor } from './CommandProcessor.js';
import { randomBytes } from 'crypto';

export class GameRoom {
  private gameState: GameState;
  private physics: AircraftPhysics;
  private commandProcessor: CommandProcessor;
  private aircraftCounter = 0;
  private lastSpawnTime = 0;

  constructor(roomId: string) {
    this.physics = new AircraftPhysics();
    this.commandProcessor = new CommandProcessor();

    // Initialize game state
    this.gameState = {
      roomId,
      createdAt: Date.now(),
      aircraft: {},
      airspace: {
        bounds: {
          minX: -25,
          maxX: 25,
          minY: -25,
          maxY: 25,
        },
        airports: [
          {
            code: 'KSFO',
            name: 'San Francisco International',
            position: { x: -15, y: -10 },
            runways: [
              { name: '28L', heading: 280, length: 11870, position: { x: -15, y: -10 } },
              { name: '28R', heading: 280, length: 11381, position: { x: -15, y: -10.5 } },
            ],
          },
          {
            code: 'KOAK',
            name: 'Oakland International',
            position: { x: 10, y: 12 },
            runways: [
              { name: '30', heading: 300, length: 10000, position: { x: 10, y: 12 } },
            ],
          },
        ],
        waypoints: [],
        restrictedZones: [],
      },
      controllers: {},
      score: 0,
      successfulLandings: 0,
      nearMisses: 0,
      collisions: 0,
      recentEvents: [],
      gameTime: 0,
      isPaused: false,
    };

    // Spawn initial aircraft
    this.spawnInitialAircraft();
  }

  /**
   * Update game state (called 60 times per second)
   */
  update(deltaTime: number): StateDelta {
    if (this.gameState.isPaused) {
      return { timestamp: Date.now() };
    }

    const delta: StateDelta = {
      timestamp: Date.now(),
      aircraftUpdates: [],
    };

    // Update game time
    this.gameState.gameTime += deltaTime;

    // Spawn new aircraft if needed (maintain 3-5 aircraft)
    const aircraftCount = Object.keys(this.gameState.aircraft).length;
    const timeSinceLastSpawn = this.gameState.gameTime - this.lastSpawnTime;

    if (aircraftCount < 3 || (aircraftCount < 5 && timeSinceLastSpawn > 30)) {
      this.spawnRandomAircraft();
      this.lastSpawnTime = this.gameState.gameTime;

      delta.newAircraft = [this.gameState.aircraft[`aircraft-${this.aircraftCounter}`]];
    }

    // Update all aircraft
    Object.values(this.gameState.aircraft).forEach((aircraft) => {
      if (aircraft.isLanded || aircraft.hasCollided) return;

      // Update physics
      this.physics.update(aircraft, deltaTime);

      // Check if out of bounds
      if (!this.physics.isInBounds(aircraft, this.gameState.airspace.bounds)) {
        this.handleAircraftOutOfBounds(aircraft);
        return; // Skip sending update for removed aircraft
      }

      // Always send all aircraft updates (like a radar sweep)
      // Real radars update all targets on every sweep, not just changed ones
      delta.aircraftUpdates!.push({
        id: aircraft.id,
        position: aircraft.position,
        altitude: aircraft.altitude,
        heading: aircraft.heading,
        speed: aircraft.speed,
        fuel: aircraft.fuel,
        trailHistory: aircraft.trailHistory,
      });
    });

    return delta;
  }

  /**
   * Add a controller to the room
   */
  addController(socketId: string, username: string): Controller {
    const controller: Controller = {
      id: socketId,
      username,
      joinedAt: Date.now(),
      commandsIssued: 0,
      score: 0,
    };

    this.gameState.controllers[socketId] = controller;

    // Add event
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [],
      controllerId: socketId,
      message: `${username} joined the tower`,
      severity: 'info',
    });

    console.log(`[GameRoom ${this.gameState.roomId}] Controller joined: ${username} (${socketId})`);

    return controller;
  }

  /**
   * Remove a controller from the room
   */
  removeController(socketId: string): void {
    const controller = this.gameState.controllers[socketId];
    if (!controller) return;

    delete this.gameState.controllers[socketId];

    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [],
      controllerId: socketId,
      message: `${controller.username} left the tower`,
      severity: 'info',
    });

    console.log(`[GameRoom ${this.gameState.roomId}] Controller left: ${controller.username}`);
  }

  /**
   * Process an aircraft command
   */
  processCommand(command: AircraftCommand): boolean {
    const aircraft = this.gameState.aircraft[command.aircraftId];
    if (!aircraft) {
      console.warn(`Aircraft ${command.aircraftId} not found`);
      return false;
    }

    const success = this.commandProcessor.processCommand(aircraft, command);

    if (success) {
      const controller = this.gameState.controllers[command.controllerId];
      if (controller) {
        controller.commandsIssued++;
      }
    }

    return success;
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Get number of controllers
   */
  getControllerCount(): number {
    return Object.keys(this.gameState.controllers).length;
  }

  /**
   * Add an event to the game
   */
  private addEvent(event: GameEvent): void {
    this.gameState.recentEvents.unshift(event);
    if (this.gameState.recentEvents.length > 20) {
      this.gameState.recentEvents.pop();
    }
  }

  /**
   * Spawn initial aircraft
   */
  private spawnInitialAircraft(): void {
    const aircraftConfigs: Array<{
      callsign: string;
      type: AircraftType;
      position: { x: number; y: number };
      altitude: number;
      heading: number;
    }> = [
      {
        callsign: 'UAL123',
        type: 'B738',
        position: { x: -12, y: 8 },
        altitude: 15000,
        heading: 90,
      },
      {
        callsign: 'DAL456',
        type: 'A320',
        position: { x: 8, y: -6 },
        altitude: 25000,
        heading: 270,
      },
      {
        callsign: 'AAL789',
        type: 'B77W',
        position: { x: -3, y: 10 },
        altitude: 35000,
        heading: 180,
      },
    ];

    aircraftConfigs.forEach((config) => {
      this.spawnAircraft(config);
    });
  }

  /**
   * Spawn a new aircraft
   */
  private spawnAircraft(config: {
    callsign: string;
    type: AircraftType;
    position: { x: number; y: number };
    altitude: number;
    heading: number;
  }): void {
    const perfData = AIRCRAFT_TYPES[config.type];

    // Add some randomization to make aircraft paths more dynamic
    const headingVariation = (Math.random() - 0.5) * 60; // ±30 degrees
    const altitudeVariation = (Math.random() - 0.5) * 10000; // ±5000 feet
    const speedVariation = (Math.random() - 0.5) * 100; // ±50 knots

    const targetHeading = (config.heading + headingVariation + 360) % 360;
    const targetAltitude = Math.max(10000, Math.min(40000, config.altitude + altitudeVariation));
    const targetSpeed = Math.max(
      perfData.minSpeed,
      Math.min(perfData.maxSpeed, perfData.cruiseSpeed + speedVariation)
    );

    const aircraft: Aircraft = {
      id: `aircraft-${++this.aircraftCounter}`,
      callsign: config.callsign,
      type: config.type,
      position: config.position,
      altitude: config.altitude,
      heading: config.heading,
      speed: perfData.cruiseSpeed,
      targetAltitude: targetAltitude,
      targetHeading: targetHeading,
      targetSpeed: targetSpeed,
      climbRate: perfData.climbRate,
      turnRate: perfData.turnRate,
      acceleration: perfData.acceleration,
      origin: 'KSFO',
      destination: 'KOAK',
      route: [],
      flightPhase: 'cruise',
      fuel: 75 + Math.random() * 20, // 75-95%
      isLanded: false,
      hasCollided: false,
      trailHistory: [],
    };

    this.gameState.aircraft[aircraft.id] = aircraft;
    console.log(`[GameRoom ${this.gameState.roomId}] Aircraft spawned: ${aircraft.callsign}`);
  }

  /**
   * Spawn a random aircraft at the edge of the airspace
   */
  private spawnRandomAircraft(): void {
    const airlines = ['UAL', 'DAL', 'AAL', 'SWA', 'JBU', 'ASA', 'FFT'];
    const types: AircraftType[] = ['B738', 'A320', 'B77W', 'E75L'];

    // Random callsign
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNumber = Math.floor(Math.random() * 900) + 100;
    const callsign = `${airline}${flightNumber}`;

    // Random type
    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn at edge, heading inward
    const edge = Math.floor(Math.random() * 4); // 0=N, 1=E, 2=S, 3=W
    let position = { x: 0, y: 0 };
    let heading = 0;

    switch (edge) {
      case 0: // North edge
        position = { x: Math.random() * 40 - 20, y: 20 };
        heading = 180; // South
        break;
      case 1: // East edge
        position = { x: 20, y: Math.random() * 40 - 20 };
        heading = 270; // West
        break;
      case 2: // South edge
        position = { x: Math.random() * 40 - 20, y: -20 };
        heading = 0; // North
        break;
      case 3: // West edge
        position = { x: -20, y: Math.random() * 40 - 20 };
        heading = 90; // East
        break;
    }

    // Random altitude between 15000 and 35000 feet
    const altitude = Math.floor(Math.random() * 4) * 5000 + 15000;

    this.spawnAircraft({
      callsign,
      type,
      position,
      altitude,
      heading,
    });
  }

  /**
   * Handle aircraft going out of bounds
   */
  private handleAircraftOutOfBounds(aircraft: Aircraft): void {
    console.log(`[GameRoom ${this.gameState.roomId}] Aircraft ${aircraft.callsign} left airspace`);

    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [aircraft.id],
      message: `${aircraft.callsign} left controlled airspace`,
      severity: 'warning',
    });

    // Remove aircraft
    delete this.gameState.aircraft[aircraft.id];

    // Penalty
    this.gameState.score -= 200;
  }

  /**
   * Check if aircraft state has changed significantly
   */
  private hasAircraftChanged(prev: Aircraft, current: Aircraft): boolean {
    return (
      Math.abs(prev.position.x - current.position.x) > 0.001 ||
      Math.abs(prev.position.y - current.position.y) > 0.001 ||
      Math.abs(prev.altitude - current.altitude) > 1 ||
      Math.abs(prev.heading - current.heading) > 0.1 ||
      Math.abs(prev.speed - current.speed) > 0.1 ||
      Math.abs(prev.fuel - current.fuel) > 0.01
    );
  }
}
