// Command-related types

export type CommandType =
  | "turn" // Change heading
  | "climb" // Change altitude
  | "descend" // Change altitude
  | "speed" // Change speed
  | "direct" // Direct to waypoint
  | "land" // Landing clearance
  | "hold" // Hold pattern
  | "squawk"; // Transponder code

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
  type: CommandType;
  params: CommandParams;
}
