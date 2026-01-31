// Command-related types

export type CommandType =
  | "turn" // Change heading
  | "climb" // Change altitude
  | "descend" // Change altitude
  | "speed" // Change speed
  | "direct" // Direct to waypoint
  | "land" // Landing clearance
  | "hold" // Hold pattern
  | "squawk" // Transponder code
  | "select_aircraft"; // Select/Lock aircraft

export interface CommandParams {
  heading?: number;
  altitude?: number;
  speed?: number;
  waypoint?: string;
  runway?: string;
  squawk?: string;
}

export interface AircraftCommand {
  id: string; // Command UUID
  aircraftId: string;
  controllerId: string;
  timestamp: number;
  gameEpoch?: number; // Optional for backward compatibility, validates command freshness
  type: CommandType;
  params: CommandParams;
}

// Chaos command types
export type ChaosType =
  | "reverse_course"
  | "altitude_roulette"
  | "speed_lottery"
  | "gravity_well"
  | "scatter_blast"
  | "callsign_shuffle";

export interface ChaosCommand {
  id: string;
  type: ChaosType;
  controllerId: string;
  timestamp: number;
}

export interface ChaosAbility {
  id: ChaosType;
  name: string;
  description: string;
  cooldownDuration: number; // milliseconds
  lastUsed: number; // timestamp
  usageCount: number;
}
