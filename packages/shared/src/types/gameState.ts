// Game state types

import { Aircraft, Position, Waypoint } from "./aircraft.js";
import { GameEvent } from "./events.js";

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
}

export interface Controller {
  id: string; // Socket ID
  username: string;
  joinedAt: number;
  commandsIssued: number;
  score: number;
}

export interface GameState {
  // Room info
  roomId: string;
  createdAt: number;

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

  // Events
  recentEvents: GameEvent[]; // Last 20 events

  // Time
  gameTime: number; // Seconds since start
  isPaused: boolean;
  timeScale: number; // Speed multiplier (1x-30x)
}

export interface StateDelta {
  timestamp: number;
  aircraftUpdates?: Partial<Aircraft>[];
  newAircraft?: Aircraft[];
  removedAircraftIds?: string[];
  scoreUpdate?: number;
  newEvents?: GameEvent[];
  controllerUpdate?: {
    type: "joined" | "left";
    controller: Controller;
  };
}
