// Event-related types

export type EventType =
  | "landing_success"
  | "near_miss"
  | "collision"
  | "crash"
  | "emergency"
  | "conflict_detected"
  | "pilot_complaint"
  | "achievement"
  | "command_conflict"
  | "chaos_activated"
  | "timed_spawn"
  | "crash_free_bonus"
  | "plane_cleared";

export type EventSeverity = "info" | "warning" | "critical" | "funny";

export interface GameEvent {
  id: string;
  type: EventType;
  timestamp: number;
  aircraftIds: string[];
  controllerId?: string;
  message: string;
  severity: EventSeverity;
}

export interface Conflict {
  aircraft1: string;
  aircraft2: string;
  horizontalDist: number; // Nautical miles
  verticalDist: number; // Feet
  severity: "warning" | "near-miss" | "collision";
  time: number; // Seconds (0 = now, >0 = predicted future)
}
