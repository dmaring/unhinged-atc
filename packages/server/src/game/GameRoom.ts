import {
  Aircraft,
  GameState,
  Controller,
  QueuedPlayer,
  AircraftCommand,
  GameEvent,
  GameEndData,
  StateDelta,
  AIRCRAFT_TYPES,
  AircraftType,
  Conflict,
  POINTS,
  GAME_CONFIG,
  SPAWN_DIFFICULTY_TIERS,
  GAME_END_MESSAGES,
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
import {
  pickRandom,
  CRASH_MESSAGES,
  NEAR_MISS_MESSAGES,
  CONFLICT_MESSAGES,
  AIRCRAFT_EXIT_MESSAGES,
  AIRCRAFT_SPAWN_MESSAGES,
  FUEL_WARNING_MESSAGES,
  FUEL_EMERGENCY_MESSAGES,
  CHAOS_ACTIVATION_MESSAGES,
  LANDING_SUCCESS_MESSAGES,
  LANDING_FAILURE_MESSAGES,
} from './MessageTemplates.js';
import { Logger } from '../utils/logger.js';

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
  private sentEventIds: Set<string> = new Set(); // Track event IDs that have been sent in deltas
  private previousWeatherCells: WeatherCell[] = [];
  private gameEndData: GameEndData | null = null; // Track if game has ended and why

  // Player queue management
  private queuedPlayers: Map<string, QueuedPlayer> = new Map(); // Map of socketId -> QueuedPlayer
  private activePlayerIds: Set<string> = new Set(); // Track which players are active (not queued)

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
      gameEpoch: 0, // Increments on reset to invalidate stale deltas
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
      planesCleared: 0,
      crashCount: 0,
      recentEvents: [],
      gameTime: 0,
      isPaused: false,
      timeScale: 3, // Default 3x speed
      gameStartTime: Date.now(),
      gameEndTime: Date.now() + (GAME_CONFIG.GAME_DURATION * 1000), // 5 minutes from now
      lastSpawnTime: 0,
      nextBonusAt: GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL,
      lastAutoChaosTime: 0,
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
      return { timestamp: Date.now(), gameEpoch: this.gameState.gameEpoch };
    }

    const delta: StateDelta = {
      timestamp: Date.now(),
      gameEpoch: this.gameState.gameEpoch, // Include epoch to validate delta freshness
      aircraftUpdates: [],
    };

    // Update game time
    this.gameState.gameTime += deltaTime;

    // Staged difficulty progression for aircraft spawning
    const currentTier = SPAWN_DIFFICULTY_TIERS.find(
      tier => this.gameState.gameTime >= tier.minTime && this.gameState.gameTime < tier.maxTime
    ) || SPAWN_DIFFICULTY_TIERS[SPAWN_DIFFICULTY_TIERS.length - 1]; // Default to last tier if beyond max time

    if (this.gameState.gameTime >= this.gameState.lastSpawnTime + currentTier.spawnInterval) {
      const newAircraft: Aircraft[] = [];

      // Spawn based on current tier's planes per spawn (not controller count)
      for (let i = 0; i < currentTier.planesPerSpawn; i++) {
        this.spawnRandomAircraft();
        const latestAircraftId = `aircraft-${this.aircraftCounter}`;
        newAircraft.push(this.gameState.aircraft[latestAircraftId]);
      }

      this.gameState.lastSpawnTime = this.gameState.gameTime;
      delta.newAircraft = newAircraft;

      // Announce timed spawn with difficulty tier info
      const tierNumber = SPAWN_DIFFICULTY_TIERS.indexOf(currentTier) + 1;
      const message = currentTier.planesPerSpawn === 1
        ? `📡 New aircraft entering the chaos! [Tier ${tierNumber}]`
        : `📡 ${currentTier.planesPerSpawn} new aircraft entering the chaos! [Tier ${tierNumber}]`;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'timed_spawn',
        timestamp: Date.now(),
        aircraftIds: newAircraft.map(a => a.id),
        message,
        severity: 'info',
      });
    }

    // Check for crash-free bonus (every 3 minutes without a crash)
    if (this.gameState.gameTime >= this.gameState.nextBonusAt) {
      this.gameState.score += POINTS.crashFreeBonus;
      this.gameState.nextBonusAt = this.gameState.gameTime + GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL;

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'crash_free_bonus',
        timestamp: Date.now(),
        aircraftIds: [],
        message: `🎉 CRASH-FREE BONUS: +${POINTS.crashFreeBonus} points! No crashes for 3 minutes!`,
        severity: 'info',
      });
    }

    // Auto chaos mode: randomly trigger chaos abilities every 30-45 seconds
    const timeSinceLastChaos = this.gameState.gameTime - this.gameState.lastAutoChaosTime;
    const nextChaosInterval = GAME_CONFIG.AUTO_CHAOS_INTERVAL_MIN +
      Math.random() * (GAME_CONFIG.AUTO_CHAOS_INTERVAL_MAX - GAME_CONFIG.AUTO_CHAOS_INTERVAL_MIN);

    if (timeSinceLastChaos >= nextChaosInterval) {
      // Select random chaos ability
      const chaosTypes = Object.keys(CHAOS_ABILITIES) as ChaosType[];
      const randomChaosType = chaosTypes[Math.floor(Math.random() * chaosTypes.length)];

      // Apply the chaos effect
      this.chaosProcessor.applyChaos(
        this.gameState.aircraft,
        randomChaosType
      );

      // Update chaos ability state (for tracking, but not enforcing cooldowns for auto chaos)
      this.gameState.chaosAbilities[randomChaosType].lastUsed = Date.now();
      this.gameState.chaosAbilities[randomChaosType].usageCount += 1;

      // Update last auto chaos time
      this.gameState.lastAutoChaosTime = this.gameState.gameTime;

      // Add auto chaos event
      const chaosConfig = CHAOS_ABILITIES[randomChaosType];
      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'auto_chaos_activated',
        timestamp: Date.now(),
        aircraftIds: Object.keys(this.gameState.aircraft),
        message: `🌪️ AUTO CHAOS: ${chaosConfig.name} - ${chaosConfig.description}`,
        severity: 'funny',
      });
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
    }

    // Check for crashes (horizontal distance only, ignores altitude)
    const crashes = this.collisionDetector.detectCrashes(this.gameState.aircraft);
    let gameEndedDueToCrash = false;

    if (crashes.length > 0) {
      const currentTime = Date.now();

      // Mark aircraft as crashing
      this.collisionDetector.processCrashes(crashes, currentTime);

      // Generate crash events
      crashes.forEach(({ aircraft1, aircraft2 }) => {
        this.handleCrash(aircraft1, aircraft2);
      });

      // Game ends immediately on crash
      gameEndedDueToCrash = true;
    }

    // Check for game end conditions (crash or time limit)
    if (gameEndedDueToCrash || (this.gameState.gameEndTime && Date.now() >= this.gameState.gameEndTime)) {
      const reason: "crash" | "time_limit" = gameEndedDueToCrash ? "crash" : "time_limit";
      this.endGame(reason);
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

    // Add score-related updates to delta
    delta.scoreUpdate = this.gameState.score;
    delta.planesCleared = this.gameState.planesCleared;
    delta.crashCount = this.gameState.crashCount;
    delta.gameTime = this.gameState.gameTime;
    delta.nextBonusAt = this.gameState.nextBonusAt;

    // Add new events to delta (only send each event once)
    if (this.gameState.recentEvents.length > 0) {
      // Filter for events that haven't been sent yet
      const unsentEvents = this.gameState.recentEvents.filter((e) =>
        !this.sentEventIds.has(e.id)
      );

      if (unsentEvents.length > 0) {
        delta.newEvents = unsentEvents;
        // Mark these events as sent
        unsentEvents.forEach((e) => this.sentEventIds.add(e.id));

        // Limit sentEventIds size to prevent memory leak (keep last 100)
        if (this.sentEventIds.size > 100) {
          const idsArray = Array.from(this.sentEventIds);
          this.sentEventIds = new Set(idsArray.slice(-100));
        }
      }
    }

    return delta;
  }

  /**
   * End the game with the specified reason
   */
  private endGame(reason: "crash" | "time_limit"): void {
    // Don't end game twice
    if (this.gameEndData) return;

    // Select random funny message
    const funnyMessage = GAME_END_MESSAGES[Math.floor(Math.random() * GAME_END_MESSAGES.length)];

    // Create game end data
    this.gameEndData = {
      reason,
      finalScore: this.gameState.score,
      planesCleared: this.gameState.planesCleared,
      crashCount: this.gameState.crashCount,
      successfulLandings: this.gameState.successfulLandings,
      gameDuration: this.gameState.gameTime,
      funnyMessage,
    };

    // Add game end event
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'game_ended',
      timestamp: Date.now(),
      aircraftIds: [],
      message: reason === 'crash'
        ? `💥 GAME OVER - Crash detected! ${funnyMessage}`
        : `⏰ TIME'S UP! ${funnyMessage}`,
      severity: 'critical',
    });
  }

  /**
   * Check if the game has ended
   */
  hasGameEnded(): boolean {
    return this.gameEndData !== null;
  }

  /**
   * Get the game end data (null if game hasn't ended)
   */
  getGameEndData(): GameEndData | null {
    return this.gameEndData;
  }

  /**
   * Add a controller to the room (as active player)
   */
  addController(socketId: string, username: string, email: string): Controller {
    const controller: Controller = {
      id: socketId,
      username,
      email,
      joinedAt: Date.now(),
      commandsIssued: 0,
      score: 0,
    };

    this.gameState.controllers[socketId] = controller;
    this.activePlayerIds.add(socketId); // Track as active player

    // Add event for controller joining
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [],
      controllerId: socketId,
      message: `> CONTROLLER ${username} ONLINE`,
      severity: 'info',
    });

    Logger.info(`Controller joined: ${username}`, {
      roomId: this.gameState.roomId,
      socketId,
      email
    });

    return controller;
  }

  /**
   * Remove a controller from the room
   */
  removeController(socketId: string): void {
    const controller = this.gameState.controllers[socketId];
    if (!controller) return;

    delete this.gameState.controllers[socketId];
    this.activePlayerIds.delete(socketId); // Remove from active players

    // Add event for controller leaving
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [],
      controllerId: socketId,
      message: `> CONTROLLER ${controller.username} OFFLINE`,
      severity: 'info',
    });

    Logger.info(`Controller left: ${controller.username}`, {
      roomId: this.gameState.roomId,
      socketId
    });
  }

  /**
   * Get the number of active players (not including queued)
   */
  getActivePlayerCount(): number {
    return this.activePlayerIds.size;
  }

  /**
   * Check if a new player can join as active player
   */
  canAddPlayer(): boolean {
    return this.getActivePlayerCount() < GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM;
  }

  /**
   * Check if a player can be added to queue
   */
  canAddToQueue(): boolean {
    return this.queuedPlayers.size < GAME_CONFIG.MAX_QUEUE_SIZE;
  }

  /**
   * Add a player to the queue
   */
  addToQueue(socketId: string, username: string, email: string): QueuedPlayer {
    const queuedPlayer: QueuedPlayer = {
      socketId,
      username,
      email,
      joinedQueueAt: Date.now(),
      position: this.queuedPlayers.size + 1, // Position is 1-indexed
    };

    this.queuedPlayers.set(socketId, queuedPlayer);
    this.updateQueuePositions();

    Logger.info(`Player queued: ${username}`, {
      roomId: this.gameState.roomId,
      socketId,
      position: queuedPlayer.position,
      email
    });

    return queuedPlayer;
  }

  /**
   * Remove a player from the queue
   */
  removeFromQueue(socketId: string): void {
    const queuedPlayer = this.queuedPlayers.get(socketId);
    if (!queuedPlayer) return;

    this.queuedPlayers.delete(socketId);
    this.updateQueuePositions();

    Logger.info(`Player removed from queue: ${queuedPlayer.username}`, {
      roomId: this.gameState.roomId,
      socketId
    });
  }

  /**
   * Promote the first player from queue to active player
   * Returns the promoted player's info or null if queue is empty
   */
  promoteFromQueue(): QueuedPlayer | null {
    if (this.queuedPlayers.size === 0) return null;

    // Get all queued players sorted by joinedQueueAt (FIFO)
    const queuedArray = Array.from(this.queuedPlayers.values()).sort(
      (a, b) => a.joinedQueueAt - b.joinedQueueAt
    );

    const firstInQueue = queuedArray[0];
    if (!firstInQueue) return null;

    // Remove from queue
    this.queuedPlayers.delete(firstInQueue.socketId);

    // Update positions for remaining queued players
    this.updateQueuePositions();

    Logger.info(`Promoting from queue: ${firstInQueue.username}`, {
      roomId: this.gameState.roomId,
      socketId: firstInQueue.socketId
    });

    return firstInQueue;
  }

  /**
   * Update queue positions for all queued players
   */
  private updateQueuePositions(): void {
    // Get all queued players sorted by joinedQueueAt
    const queuedArray = Array.from(this.queuedPlayers.values()).sort(
      (a, b) => a.joinedQueueAt - b.joinedQueueAt
    );

    // Update positions
    queuedArray.forEach((player, index) => {
      player.position = index + 1; // 1-indexed
    });
  }

  /**
   * Get a player's position in queue
   */
  getQueuePosition(socketId: string): number | null {
    const queuedPlayer = this.queuedPlayers.get(socketId);
    return queuedPlayer ? queuedPlayer.position : null;
  }

  /**
   * Get all queued players
   */
  getQueuedPlayers(): QueuedPlayer[] {
    return Array.from(this.queuedPlayers.values()).sort(
      (a, b) => a.joinedQueueAt - b.joinedQueueAt
    );
  }

  /**
   * Get the next queued player (FIFO)
   */
  getNextQueuedPlayer(): QueuedPlayer | null {
    const queuedPlayers = this.getQueuedPlayers();
    return queuedPlayers.length > 0 ? queuedPlayers[0] : null;
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
    this.chaosProcessor.applyChaos(this.gameState.aircraft, chaosType);

    // Update chaos state
    chaosState.lastUsed = now;
    chaosState.usageCount++;

    // Use humorous chaos message
    const messages = CHAOS_ACTIVATION_MESSAGES[chaosType] || [`${chaosConfig.name} activated!`];
    const message = pickRandom(messages);

    // Add event
    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'chaos_activated',
      timestamp: now,
      aircraftIds: Object.keys(this.gameState.aircraft),
      controllerId: command.controllerId,
      message,
      severity: 'funny',
    });

    return { success: true, message };
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

    // Add spawn notification with humor
    const messageTemplate = pickRandom(AIRCRAFT_SPAWN_MESSAGES);
    const message = messageTemplate(aircraft.callsign);

    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'achievement',
      timestamp: Date.now(),
      aircraftIds: [aircraft.id],
      message,
      severity: 'info',
    });
  }

  /**
   * Spawn a random aircraft at the edge of the airspace
   */
  spawnRandomAircraft(): void {
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

    // Reward for successfully clearing airspace (unless crashed)
    if (!aircraft.isCrashing && !aircraft.hasCollided) {
      this.gameState.score += POINTS.planeCleared; // +100 points
      this.gameState.planesCleared += 1;

      // Use humorous exit message
      const messageTemplate = pickRandom(AIRCRAFT_EXIT_MESSAGES);
      const message = messageTemplate(aircraft.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'plane_cleared',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message,
        severity: 'info',
      });
    }

    // Remove aircraft
    delete this.gameState.aircraft[aircraft.id];
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
      this.gameState.planesCleared++; // Increment cleared planes counter

      // Remove from fuel warnings/emergencies
      this.fuelWarnings.delete(aircraft.id);
      this.fuelEmergencies.delete(aircraft.id);

      // Use humorous landing success message
      const messageTemplate = pickRandom(LANDING_SUCCESS_MESSAGES);
      const message = messageTemplate(aircraft.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'landing_success',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message,
        severity: 'info',
      });

      // Remove aircraft after a delay (simulate taxi to gate)
      setTimeout(() => {
        delete this.gameState.aircraft[aircraft.id];
        this.fuelWarnings.delete(aircraft.id);
        this.fuelEmergencies.delete(aircraft.id);
      }, 5000);
    } else {
      // Failed landing - go around
      this.gameState.score += POINTS.goAround;

      // Use humorous go-around message
      const messageTemplate = pickRandom(LANDING_FAILURE_MESSAGES);
      const message = messageTemplate(aircraft.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'pilot_complaint',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message,
        severity: 'warning',
      });

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

      // Use humorous fuel emergency message
      const messageTemplate = pickRandom(FUEL_EMERGENCY_MESSAGES);
      const message = messageTemplate(aircraft.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'emergency',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message,
        severity: 'critical',
      });
    }
    // Low fuel warning: below 30%
    else if (fuelPercent < 30 && !this.fuelWarnings.has(aircraft.id)) {
      this.fuelWarnings.add(aircraft.id);

      // Use humorous fuel warning message
      const messageTemplate = pickRandom(FUEL_WARNING_MESSAGES);
      const message = messageTemplate(aircraft.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'emergency',
        timestamp: Date.now(),
        aircraftIds: [aircraft.id],
        message,
        severity: 'warning',
      });
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

      // Use humorous crash message (collision is effectively a crash)
      const messageTemplate = pickRandom(CRASH_MESSAGES);
      const message = messageTemplate(aircraft1.callsign, aircraft2.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'collision',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message,
        severity: 'critical',
      });
    } else if (conflict.severity === 'near-miss') {
      // Near miss
      this.gameState.nearMisses++;
      this.gameState.score += POINTS.nearMiss;

      // Use humorous near miss message
      const messageTemplate = pickRandom(NEAR_MISS_MESSAGES);
      const message = messageTemplate(aircraft1.callsign, aircraft2.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'near_miss',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message,
        severity: 'critical',
      });
    } else {
      // Conflict warning
      const messageTemplate = pickRandom(CONFLICT_MESSAGES);
      const message = messageTemplate(aircraft1.callsign, aircraft2.callsign);

      this.addEvent({
        id: randomBytes(8).toString('hex'),
        type: 'conflict_detected',
        timestamp: Date.now(),
        aircraftIds: [conflict.aircraft1, conflict.aircraft2],
        message,
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

    // Update scoring
    this.gameState.score += POINTS.crash; // -100 points
    this.gameState.crashCount += 2; // Increment by 2 per crash

    // Reset crash-free bonus timer
    this.gameState.nextBonusAt = this.gameState.gameTime + GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL;

    // Use humorous crash message
    const messageTemplate = pickRandom(CRASH_MESSAGES);
    const message = messageTemplate(aircraft1.callsign, aircraft2.callsign);

    this.addEvent({
      id: randomBytes(8).toString('hex'),
      type: 'crash',
      timestamp: Date.now(),
      aircraftIds: [aircraft1.id, aircraft2.id],
      message,
      severity: 'critical',
    });
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

  /**
   * Reset the game for the next round while preserving queue positions
   * Active players will be moved to the back of the queue via client auto-rejoin
   * Already-queued players keep their positions
   */
  resetForNextGame(): void {
    const roomId = this.gameState.roomId;
    const controllers = this.gameState.controllers; // Preserve active controllers
    const newEpoch = this.gameState.gameEpoch + 1; // Increment epoch to invalidate old deltas

    Logger.info('Resetting for next game (preserving queue)', { roomId, newEpoch });

    // Clear tracking sets
    this.fuelWarnings.clear();
    this.fuelEmergencies.clear();
    this.sentEventIds.clear();
    this.previousWeatherCells = [];
    this.gameEndData = null;

    // Clear active player tracking (controllers remain connected)
    this.activePlayerIds.clear();

    // Reset counters
    this.aircraftCounter = 0;
    this.lastSpawnTime = 0;

    // Reinitialize game state (controllers and queue are preserved)
    this.gameState = {
      roomId,
      createdAt: Date.now(),
      gameEpoch: newEpoch,
      aircraft: {},
      airspace: this.gameState.airspace, // Preserve airspace definition
      controllers, // Preserve active controllers
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
      gameEndTime: Date.now() + (GAME_CONFIG.GAME_DURATION * 1000),
      lastSpawnTime: 0,
      nextBonusAt: GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL,
      lastAutoChaosTime: 0,
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

    Logger.info('Game reset for next round. Queue preserved.', { roomId });
  }

  /**
   * Reset the game state completely (for game end restart)
   * Clears all aircraft, controllers, resets scores, and spawns new aircraft
   */
  resetGameState(): void {
    const roomId = this.gameState.roomId;
    const newEpoch = this.gameState.gameEpoch + 1; // Increment epoch to invalidate old deltas

    Logger.info('Resetting game state for restart', { roomId, newEpoch });

    // Clear tracking sets
    this.fuelWarnings.clear();
    this.fuelEmergencies.clear();
    this.sentEventIds.clear();
    this.previousWeatherCells = [];
    this.gameEndData = null; // Clear game end data

    // Clear active player tracking
    this.activePlayerIds.clear();

    // Reset counters
    this.aircraftCounter = 0;
    this.lastSpawnTime = 0;

    // Reinitialize game state with NO controllers
    this.gameState = {
      roomId,
      createdAt: Date.now(),
      gameEpoch: newEpoch,
      aircraft: {},
      airspace: this.gameState.airspace, // Preserve airspace definition
      controllers: {}, // Clear all controllers
      score: 0,
      successfulLandings: 0,
      nearMisses: 0,
      collisions: 0,
      planesCleared: 0,
      crashCount: 0,
      recentEvents: [],
      gameTime: 0,
      isPaused: false,
      timeScale: 3, // Default 3x speed
      gameStartTime: Date.now(),
      gameEndTime: Date.now() + (GAME_CONFIG.GAME_DURATION * 1000), // 5 minutes from now
      lastSpawnTime: 0,
      nextBonusAt: GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL,
      lastAutoChaosTime: 0,
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

    Logger.info('Game state reset complete. Ready for new players.', { roomId });
  }

  /**
   * Reset the game to initial state (admin function)
   * Clears all aircraft, resets scores, and spawns new aircraft
   * Preserves the room and connected controllers
   */
  reset(): GameState {
    const roomId = this.gameState.roomId;
    const controllers = this.gameState.controllers;
    const newEpoch = this.gameState.gameEpoch + 1; // Increment epoch to invalidate old deltas

    Logger.info('Resetting game', { roomId, newEpoch });

    // Clear tracking sets
    this.fuelWarnings.clear();
    this.fuelEmergencies.clear();
    this.sentEventIds.clear();
    this.previousWeatherCells = [];

    // Reset counters
    this.aircraftCounter = 0;
    this.lastSpawnTime = 0;

    // Reinitialize game state
    this.gameState = {
      roomId,
      createdAt: Date.now(),
      gameEpoch: newEpoch,
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
      controllers,
      score: 0,
      successfulLandings: 0,
      nearMisses: 0,
      collisions: 0,
      planesCleared: 0,
      crashCount: 0,
      recentEvents: [],
      gameTime: 0,
      isPaused: false,
      timeScale: 3, // Default 3x speed
      gameStartTime: Date.now(),
      gameEndTime: Date.now() + (GAME_CONFIG.GAME_DURATION * 1000), // 5 minutes from now
      lastSpawnTime: 0,
      nextBonusAt: GAME_CONFIG.CRASH_FREE_BONUS_INTERVAL,
      lastAutoChaosTime: 0,
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

    Logger.info('Game reset complete. New aircraft spawned.', { roomId });

    // Return the new game state
    return this.gameState;
  }
}
