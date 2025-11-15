// Shared constants

export const SEPARATION_MINIMUMS = {
  horizontal: {
    terminal: 3, // NM (within 40NM of airport)
    enroute: 5, // NM (beyond 40NM)
    final: 2.5, // NM (on final approach)
  },
  vertical: {
    standard: 1000, // feet (below FL290)
    rvsm: 1000, // feet (FL290-FL410)
    nonRvsm: 2000, // feet (above FL410)
  },
} as const;

export const CRASH_CONFIG = {
  DISTANCE_THRESHOLD: 2, // NM - horizontal distance for crash (ignores altitude)
  ANIMATION_DURATION: 2000, // ms - how long crash animation plays before removal
} as const;

export const POINTS = {
  successfulLanding: 100,
  onTimeLanding: 50, // Within 2 min of ETA
  fuelEfficient: 25, // Land with >30% fuel
  nearMissAvoided: 50, // Resolved predicted conflict

  // Penalties
  nearMiss: -100,
  collision: -500,
  fuelEmergency: -75,
  goAround: -50, // Failed landing attempt
  outOfBounds: -200, // Aircraft left airspace
} as const;

export const GAME_CONFIG = {
  TICK_RATE: 60, // Server physics updates per second
  MAX_AIRCRAFT_TRAIL: 30, // Number of position points to keep
  MAX_RECENT_EVENTS: 20, // Number of events to keep in history
  MAX_CONTROLLERS_PER_ROOM: 4,
  MAX_COMMANDS_PER_MINUTE: 60,
  AIRCRAFT_SPAWN_INTERVAL: 30000, // ms
  SCENARIO_INTERVAL_MIN: 120000, // 2 minutes
  SCENARIO_INTERVAL_MAX: 300000, // 5 minutes
} as const;

export const RADAR_CONFIG = {
  RANGE_RINGS: [5, 10, 20], // Nautical miles
  PRIMARY_COLOR: "#00FF00",
  BACKGROUND_COLOR: "#000000",
  TRAIL_OPACITY: 0.3,
  AIRCRAFT_SIZE: 8, // pixels
} as const;

export const CHAOS_ABILITIES = {
  reverse_course: {
    name: "Reverse Course",
    description: "Flip all aircraft headings 180°",
    cooldownDuration: 10000, // 10 seconds
  },
  altitude_roulette: {
    name: "Altitude Roulette",
    description: "Randomize all aircraft altitudes ±5000ft",
    cooldownDuration: 10000, // 10 seconds
  },
  speed_lottery: {
    name: "Speed Lottery",
    description: "Random speed changes to all aircraft",
    cooldownDuration: 10000, // 10 seconds
  },
  gravity_well: {
    name: "Gravity Well",
    description: "Pull all aircraft toward center",
    cooldownDuration: 10000, // 10 seconds
  },
  scatter_blast: {
    name: "Scatter Blast",
    description: "Push all aircraft away from center",
    cooldownDuration: 10000, // 10 seconds
  },
  callsign_shuffle: {
    name: "Callsign Shuffle",
    description: "Swap all aircraft callsigns randomly",
    cooldownDuration: 10000, // 10 seconds
  },
} as const;
