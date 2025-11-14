// Aircraft-related types

export type AircraftType = "B738" | "A320" | "B77W" | "E75L" | "C172";
export type FlightPhase = "departure" | "cruise" | "approach" | "landing";
export type EmergencyType = "engine" | "medical" | "fuel" | "hydraulic" | "pressurization" | "unusual";

export interface Position {
  x: number; // Longitude-like coordinate
  y: number; // Latitude-like coordinate
}

export interface Waypoint {
  name: string;
  position: Position;
  altitude?: number;
}

export interface Aircraft {
  // Identity
  id: string;
  callsign: string; // e.g., "UAL123", "AAL456"
  type: AircraftType;

  // Position & Movement (2D simulation)
  position: Position;
  altitude: number; // Feet (0-40000)
  heading: number; // Degrees (0-360)
  speed: number; // Knots (0-600)

  // Target values (for autopilot)
  targetAltitude: number;
  targetHeading: number;
  targetSpeed: number;

  // Flight characteristics
  climbRate: number; // Feet per minute
  turnRate: number; // Degrees per second
  acceleration: number; // Knots per second

  // Flight plan
  origin: string; // Airport code
  destination: string; // Airport code
  route: Waypoint[];
  flightPhase: FlightPhase;

  // State
  fuel: number; // Percentage (0-100)
  emergencyType?: EmergencyType;
  isLanded: boolean;
  hasCollided: boolean;

  // Control tracking
  lastCommandBy?: string; // Controller ID who last commanded
  lastCommandTime?: number; // Timestamp

  // Visual
  trailHistory: Position[]; // Last N positions for radar trail
}

export interface AircraftPerformance {
  maxSpeed: number;
  cruiseSpeed: number;
  minSpeed: number;
  climbRate: number;
  turnRate: number;
  acceleration: number;
}

export const AIRCRAFT_TYPES: Record<AircraftType, AircraftPerformance> = {
  B738: {
    maxSpeed: 480,
    cruiseSpeed: 450,
    minSpeed: 140,
    climbRate: 2000,
    turnRate: 3,
    acceleration: 5,
  },
  A320: {
    maxSpeed: 470,
    cruiseSpeed: 450,
    minSpeed: 135,
    climbRate: 2200,
    turnRate: 3,
    acceleration: 5,
  },
  B77W: {
    maxSpeed: 510,
    cruiseSpeed: 490,
    minSpeed: 160,
    climbRate: 1500,
    turnRate: 2,
    acceleration: 3,
  },
  E75L: {
    maxSpeed: 450,
    cruiseSpeed: 420,
    minSpeed: 120,
    climbRate: 2500,
    turnRate: 4,
    acceleration: 6,
  },
  C172: {
    maxSpeed: 140,
    cruiseSpeed: 120,
    minSpeed: 50,
    climbRate: 700,
    turnRate: 6,
    acceleration: 2,
  },
};
