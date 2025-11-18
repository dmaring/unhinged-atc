// Game state types

import { Aircraft, Position, Waypoint } from "./aircraft.js";
import { GameEvent } from "./events.js";
import { WeatherCell } from "./weather.js";

export interface Runway {
  name: string; // "28L", "01R"
  heading: number;
  length: number; // Feet
  position: Position; // Threshold position
}

export interface Airport {
  code: string; // "KSFO", "KJFK"
  name: string;
  position: Position;
  runways: Runway[];
}

export interface RestrictedZone {
  name: string;
  position: Position;
  radius: number; // Nautical miles
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Airspace {
  bounds: Bounds;
  airports: Airport[];
  waypoints: Waypoint[];
  restrictedZones: RestrictedZone[];
  weather: WeatherCell[];
}

export interface Controller {
  id: string; // Socket ID
  username: string;
  email: string; // Email address (logged but not displayed to other players)
  joinedAt: number;
  commandsIssued: number;
  score: number;
}

export interface QueuedPlayer {
  socketId: string;
  username: string;
  email: string;
  joinedQueueAt: number;
  position: number;
}

export interface GameState {
  // Room info
  roomId: string;
  createdAt: number;
  gameEpoch: number; // Increments on reset to invalidate stale deltas

  // Aircraft (using Map on server, convert to array for client)
  aircraft: Record<string, Aircraft>; // Changed from Map for JSON serialization

  // Airspace definition
  airspace: Airspace;

  // Controllers
  controllers: Record<string, Controller>; // Changed from Map for JSON serialization

  // Game metrics
  score: number;
  successfulLandings: number;
  nearMisses: number;
  collisions: number;
  planesCleared: number; // Successfully exited or landed aircraft
  crashCount: number; // Crash counter (increments by 2 per crash)

  // Events
  recentEvents: GameEvent[]; // Last 20 events

  // Time
  gameTime: number; // Seconds since start
  isPaused: boolean;
  timeScale: number; // Speed multiplier (1x-30x)
  gameStartTime: number; // Timestamp when game started
  gameEndTime: number | null; // Timestamp when game should end (gameStartTime + 5 minutes)
  lastSpawnTime: number; // Last timed aircraft spawn (in gameTime seconds)
  nextBonusAt: number; // Next crash-free bonus time (in gameTime seconds)
  lastAutoChaosTime: number; // Last auto chaos activation (in gameTime seconds)

  // Chaos system
  chaosAbilities: Record<string, { lastUsed: number; usageCount: number }>;
}

export interface StateDelta {
  timestamp: number;
  gameEpoch?: number; // Game epoch to validate delta freshness
  aircraftUpdates?: Partial<Aircraft>[];
  newAircraft?: Aircraft[];
  removedAircraftIds?: string[];
  weatherUpdates?: WeatherCell[];
  removedWeatherIds?: string[];
  scoreUpdate?: number;
  planesCleared?: number;
  crashCount?: number;
  gameTime?: number;
  nextBonusAt?: number;
  newEvents?: GameEvent[];
  controllerUpdate?: {
    type: "joined" | "left";
    controller: Controller;
  };
}
