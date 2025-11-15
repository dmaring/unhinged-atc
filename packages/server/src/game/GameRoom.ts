import {
  Aircraft,
  GameState,
  Controller,
  AircraftCommand,
  GameEvent,
  StateDelta,
  AIRCRAFT_TYPES,
  AircraftType,
  Conflict,
  POINTS,
  ChaosCommand,
  ChaosType,
  CHAOS_ABILITIES,
  WeatherCell
} from 'shared';
import { AircraftPhysics } from './AircraftPhysics.js';
import { CommandProcessor } from './CommandProcessor.js';
import { CollisionDetector } from './CollisionDetector.js';
import { LandingSystem } from './LandingSystem.js';
import { ChaosProcessor } from './ChaosProcessor.js';
import { WeatherSystem } from './WeatherSystem.js';
import { randomBytes } from 'crypto';

export class GameRoom {
  private gameState: GameState;
  private physics: AircraftPhysics;
  private commandProcessor: CommandProcessor;
  private collisionDetector: CollisionDetector;
  private landingSystem: LandingSystem;
  private chaosProcessor: ChaosProcessor;
  private weatherSystem: WeatherSystem;
  private aircraftCounter = 0;
  private lastSpawnTime = 0;
  private fuelWarnings: Set<string> = new Set(); // Track aircraft with fuel warnings
  private fuelEmergencies: Set<string> = new Set(); // Track aircraft with fuel emergencies
  private previousWeatherCells: WeatherCell[] = [];

  constructor(roomId: string) {
    this.physics = new AircraftPhysics();
    this.commandProcessor = new CommandProcessor();
    this.collisionDetector = new CollisionDetector(this.physics);
    this.landingSystem = new LandingSystem(this.physics);
    this.chaosProcessor = new ChaosProcessor();
    this.weatherSystem = new WeatherSystem();

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
        waypoints: [
          // Entry/Exit Points at airspace edges
          { name: 'ENTRY_N', position: { x: 0, y: 22 } },
          { name: 'ENTRY_S', position: { x: 0, y: -22 } },
          { name: 'ENTRY_E', position: { x: 22, y: 0 } },
          { name: 'ENTRY_W', position: { x: -22, y: 0 } },

          // KSFO Approach Fixes
          { name: 'KSFO_IAF_N', position: { x: -15, y: 5 }, altitude: 5000 },
          { name: 'KSFO_IAF_S', position: { x: -15, y: -20 }, altitude: 5000 },
          { name: 'KSFO_FAF', position: { x: -15, y: -5 }, altitude: 2000 },

          // KOAK Approach Fixes
          { name: 'KOAK_IAF_N', position: { x: 10, y: 20 }, altitude: 4000 },
          { name: 'KOAK_IAF_E', position: { x: 20, y: 12 }, altitude: 4000 },
          { name: 'KOAK_FAF', position: { x: 15, y: 12 }, altitude: 2000 },

          // Intermediate Waypoints
          { name: 'MIDPT', position: { x: 0, y: 0 } },
          { name: 'HOLD_1', position: { x: -5, y: 15 } },
          { name: 'HOLD_2', position: { x: 5, y: -15 } },
        ],
        restrictedZones: [],
        weather: [],
      },
      controllers: {},
      score: 0,
      successfulLandings: 0,
      nearMisses: 0,
      collisions: 0,
      recentEvents: [],
      gameTime: 0,
      isPaused: false,
      timeScale: 10, // Default 10x speed
      chaosAbilities: {},
    };

    // Initialize chaos abilities cooldowns
    Object.keys(CHAOS_ABILITIES).forEach((chaosType) => {
      this.gameState.chaosAbilities[chaosType] = {
        lastUsed: 0,
        usageCount: 0,
      };
    });

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

    // Track aircraft that exit the airspace
    const outOfBoundsAircraftIds: string[] = [];

    // Update all aircraft
    Object.values(this.gameState.aircraft).forEach((aircraft) => {
      if (aircraft.isLanded || aircraft.hasCollided) return;

      // Update physics
      this.physics.update(aircraft, deltaTime);

      // Check if out of bounds
      if (!this.physics.isInBounds(aircraft, this.gameState.airspace.bounds)) {
        outOfBoundsAircraftIds.push(aircraft.id);
        return; // Skip sending update for aircraft that will be removed
      }

      // Always send all aircraft updates (like a radar sweep)
      // Real radars update all targets on every sweep, not just changed ones
      delta.aircraftUpdates!.push({
        id: aircraft.id,
        callsign: aircraft.callsign,
        position: aircraft.position,
        altitude: aircraft.altitude,
        heading: aircraft.heading,
        speed: aircraft.speed,
        targetAltitude: aircraft.targetAltitude,
        targetHeading: aircraft.targetHeading,
        targetSpeed: aircraft.targetSpeed,
        fuel: aircraft.fuel,
        trailHistory: aircraft.trailHistory,
        isCrashing: aircraft.isCrashing,
        crashTime: aircraft.crashTime,
        crashPosition: aircraft.crashPosition,
      });
    });

    // Remove out-of-bounds aircraft and notify clients
    if (outOfBoundsAircraftIds.length > 0) {
      outOfBoundsAircraftIds.forEach((aircraftId) => {
        const aircraft = this.gameState.aircraft[aircraftId];
        if (aircraft) {
          this.handleAircraftOutOfBounds(aircraft);
          delete this.gameState.aircraft[aircraftId];
        }
      });
      delta.removedAircraftIds = [...(delta.removedAircraftIds || []), ...outOfBoundsAircraftIds];
    }

    // Check for collisions and near misses
    const conflicts = this.collisionDetector.detectConflicts(this.gameState.aircraft);

    if (conflicts.length > 0) {
      // Process collisions (mark aircraft as collided)
      this.collisionDetector.processCollisions(this.gameState.aircraft, conflicts);

      // Generate events for new conflicts
      conflicts.forEach((conflict) => {
        this.handleConflict(conflict);
      });

      // Add new events to delta
      if (this.gameState.recentEvents.length > 0) {
        const latestEvents = this.gameState.recentEvents.slice(0, 5);
        delta.newEvents = latestEvents.filter((e) =>
          e.timestamp > delta.timestamp - 100
        );
      }
    }

    // Check for crashes (horizontal distance only, ignores altitude)
    const crashes = this.collisionDetector.detectCrashes(this.gameState.aircraft);

    if (crashes.length > 0) {
      const currentTime = Date.now();

      // Mark aircraft as crashing
      this.collisionDetector.processCrashes(crashes, currentTime);

      // Generate crash events
      crashes.forEach(({ aircraft1, aircraft2 }) => {
        this.handleCrash(aircraft1, aircraft2);
      });
    }

    // Remove crashed aircraft after animation duration
    const removedAircraftIds: string[] = [];
    Object.values(this.gameState.aircraft).forEach((aircraft) => {
      if (aircraft.isCrashing && aircraft.crashTime) {
        const elapsedTime = Date.now() - aircraft.crashTime;
        if (elapsedTime >= 2000) { // CRASH_CONFIG.ANIMATION_DURATION
          removedAircraftIds.push(aircraft.id);
          delete this.gameState.aircraft[aircraft.id];
        }
      }
    });

    if (removedAircraftIds.length > 0) {
      delta.removedAircraftIds = removedAircraftIds;
    }

    // Check for fuel emergencies
    Object.values(this.gameState.aircraft).forEach((aircraft) => {
      if (!aircraft.isLanded && !aircraft.hasCollided) {
        this.checkFuelStatus(aircraft);
      }
    });

    // Check for landings
    const landingAttempts = this.landingSystem.checkLandings(
      this.gameState.aircraft,
      this.gameState.airspace.airports
    );

    if (landingAttempts.length > 0) {
      landingAttempts.forEach((attempt) => {
        this.handleLanding(attempt);
      });
    }

    // Update weather system
    const updatedWeather = this.weatherSystem.update(
      deltaTime,
      this.gameState.gameTime,
      this.gameState.airspace.bounds
    );

    // Update airspace weather
    this.gameState.airspace.weather = updatedWeather;

    // Check for aircraft in weather
    const weatherInteraction = this.weatherSystem.checkAircraftInWeather(
      Object.values(this.gameState.aircraft),
      updatedWeather
    );

    // Add weather events to game state
    if (weatherInteraction.events.length > 0) {
      weatherInteraction.events.forEach((event) => this.addEvent(event));
      if (!delta.newEvents) delta.newEvents = [];
      delta.newEvents.push(...weatherInteraction.events);
    }

    // Add weather updates to delta
    delta.weatherUpdates = updatedWeather;

    // Add removed weather IDs to delta
    const removedWeatherIds = this.weatherSystem.getRemovedWeatherIds(this.previousWeatherCells);
    if (removedWeatherIds.length > 0) {
      delta.removedWeatherIds = removedWeatherIds;
    }

    // Store current weather for next delta
    this.previousWeatherCells = [...updatedWeather];

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
   * Process a chaos command
   */
  processChaosCommand(command: ChaosCommand): { success: boolean; message: string } {
    const chaosType = command.type;
    const chaosConfig = CHAOS_ABILITIES[chaosType];
    const chaosState = this.gameState.chaosAbilities[chaosType];

    if (!chaosConfig || !chaosState) {
      return { success: false, message: 'Unknown chaos type' };
    }

    // Check cooldown
    const now = Date.now();
    const timeSinceLastUse = now - chaosState.lastUsed;
    const cooldownRemaining = chaosConfig.cooldownDuration - timeSinceLastUse;

    if (cooldownRemaining > 0) {
      const secondsRemaining = Math.ceil(cooldownRemaining / 1000);
      return {
        success: false,
        message: `${chaosConfig.name} on cooldown (${secondsRemaining}s remaining)`,
      };
    }

    // Apply chaos effect
    const resultMessage = this.chaosProcessor.applyChaos(this.gameState.aircraft, chaosType);

    // Update chaos state
    chaosState.lastUsed = now;
    chaosState.usageCount++;

    // Add event
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'chaos_activated',
      timestamp: now,
      aircraftIds: Object.keys(this.gameState.aircraft),
      controllerId: command.controllerId,
      message: resultMessage,
      severity: 'funny',
    });

    console.log(`[GameRoom ${this.gameState.roomId}] CHAOS: ${chaosConfig.name} activated by ${command.controllerId}`);

    return { success: true, message: resultMessage };
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
   * Set time scale
   */
  setTimeScale(scale: number): void {
    this.gameState.timeScale = Math.max(1, Math.min(30, scale));
    this.physics.setTimeScale(this.gameState.timeScale);
    console.log(`[GameRoom ${this.gameState.roomId}] Time scale set to ${this.gameState.timeScale}x`);
  }

  /**
   * Get current time scale
   */
  getTimeScale(): number {
    return this.gameState.timeScale;
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
    this.gameState.score += POINTS.outOfBounds;
  }

  /**
   * Handle landing attempt
   */
  private handleLanding(attempt: { aircraftId: string; airport: string; runway: string; success: boolean; reason?: string }): void {
    const aircraft = this.gameState.aircraft[attempt.aircraftId];
    if (!aircraft) return;

    if (attempt.success) {
      // Successful landing
      aircraft.isLanded = true;
      aircraft.flightPhase = 'landing';
      aircraft.speed = 0;

      // Calculate score
      const landingScore = this.landingSystem.calculateLandingScore(aircraft, attempt);
      this.gameState.score += landingScore;
      this.gameState.successfulLandings++;

      // Remove from fuel warnings/emergencies
      this.fuelWarnings.delete(aircraft.id);
      this.fuelEmergencies.delete(aircraft.id);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'landing_success',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message: `${aircraft.callsign} landed successfully at ${attempt.airport} runway ${attempt.runway} (+${landingScore} points)`,
        severity: 'info',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] LANDING: ${aircraft.callsign} at ${attempt.airport}`);

      // Remove aircraft after a delay (simulate taxi to gate)
      setTimeout(() => {
        delete this.gameState.aircraft[aircraft.id];
        this.fuelWarnings.delete(aircraft.id);
        this.fuelEmergencies.delete(aircraft.id);
      }, 5000);
    } else {
      // Failed landing - go around
      this.gameState.score += POINTS.goAround;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'pilot_complaint',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message: `${aircraft.callsign} go-around at ${attempt.airport}: ${attempt.reason}`,
        severity: 'warning',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] GO-AROUND: ${aircraft.callsign} - ${attempt.reason}`);

      // Set missed approach - climb to safe altitude
      aircraft.targetAltitude = Math.max(aircraft.targetAltitude, 3000);
      aircraft.flightPhase = 'cruise';
    }
  }

  /**
   * Check fuel status and generate warnings/emergencies
   */
  private checkFuelStatus(aircraft: Aircraft): void {
    const fuelPercent = aircraft.fuel;

    // Fuel emergency: below 10%
    if (fuelPercent < 10 && !this.fuelEmergencies.has(aircraft.id)) {
      this.fuelEmergencies.add(aircraft.id);
      aircraft.emergencyType = 'fuel';

      this.gameState.score += POINTS.fuelEmergency;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'emergency',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message: `FUEL EMERGENCY: ${aircraft.callsign} - ${fuelPercent.toFixed(1)}% fuel remaining!`,
        severity: 'critical',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] FUEL EMERGENCY: ${aircraft.callsign}`);
    }
    // Low fuel warning: below 30%
    else if (fuelPercent < 30 && !this.fuelWarnings.has(aircraft.id)) {
      this.fuelWarnings.add(aircraft.id);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'emergency',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message: `Low fuel: ${aircraft.callsign} - ${fuelPercent.toFixed(1)}% remaining`,
        severity: 'warning',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] Low fuel: ${aircraft.callsign}`);
    }

    // Out of fuel - mark as emergency landing required
    if (fuelPercent <= 0) {
      aircraft.emergencyType = 'fuel';
      aircraft.fuel = 0;
    }
  }

  /**
   * Handle a conflict between aircraft
   */
  private handleConflict(conflict: Conflict): void {
    const aircraft1 = this.gameState.aircraft[conflict.aircraft1];
    const aircraft2 = this.gameState.aircraft[conflict.aircraft2];

    if (!aircraft1 || !aircraft2) return;

    // Check if this is a new conflict
    if (!this.collisionDetector.isNewConflict(conflict.aircraft1, conflict.aircraft2)) {
      return; // Don't spam events for ongoing conflicts
    }

    const callsigns = `${aircraft1.callsign} and ${aircraft2.callsign}`;

    if (conflict.severity === 'collision') {
      // Collision occurred
      this.gameState.collisions++;
      this.gameState.score += POINTS.collision;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'collision',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message: `COLLISION! ${callsigns} - ${conflict.horizontalDist.toFixed(1)} NM / ${Math.round(conflict.verticalDist)} ft separation`,
        severity: 'critical',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] COLLISION: ${callsigns}`);
    } else if (conflict.severity === 'near-miss') {
      // Near miss
      this.gameState.nearMisses++;
      this.gameState.score += POINTS.nearMiss;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'near_miss',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message: `NEAR MISS: ${callsigns} - ${conflict.horizontalDist.toFixed(1)} NM / ${Math.round(conflict.verticalDist)} ft`,
        severity: 'critical',
      });

      console.log(`[GameRoom ${this.gameState.roomId}] NEAR MISS: ${callsigns}`);
    } else {
      // Conflict warning
      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'conflict_detected',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message: `Traffic conflict: ${callsigns} - ${conflict.horizontalDist.toFixed(1)} NM / ${Math.round(conflict.verticalDist)} ft`,
        severity: 'warning',
      });
    }
  }

  /**
   * Handle crash event (aircraft crossing paths regardless of altitude)
   */
  private handleCrash(aircraft1: Aircraft, aircraft2: Aircraft): void {
    if (!aircraft1 || !aircraft2) return;

    // Only generate event for new crashes (when first marked as crashing)
    const justCrashed = aircraft1.crashTime && (Date.now() - aircraft1.crashTime < 100);
    if (!justCrashed) return;

    const callsigns = `${aircraft1.callsign} and ${aircraft2.callsign}`;
    const altitudeDiff = Math.abs(aircraft1.altitude - aircraft2.altitude);

    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'crash',
      timestamp: Date.now(),
      aircraftIds: [aircraft1.id, aircraft2.id],
      message: `CRASH! ${callsigns} collided on radar (altitude difference: ${Math.round(altitudeDiff)} ft)`,
      severity: 'critical',
    });

    console.log(`[GameRoom ${this.gameState.roomId}] CRASH: ${callsigns}`);
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
