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
  planeCleared: 100, // Successfully exited airspace or landed
  crashFreeBonus: 500, // 3 minutes without a crash

  // Penalties
  nearMiss: -100,
  crash: -100, // Per crash (collision penalty)
  collision: -500, // Legacy - now using crash
  fuelEmergency: -75,
  goAround: -50, // Failed landing attempt
  outOfBounds: -200, // Aircraft left airspace (now converted to reward)
} as const;

export const GAME_CONFIG = {
  TICK_RATE: 60, // Server physics updates per second
  MAX_AIRCRAFT_TRAIL: 30, // Number of position points to keep
  MAX_RECENT_EVENTS: 20, // Number of events to keep in history
  MAX_CONTROLLERS_PER_ROOM: 5, // Maximum active players in game
  MAX_QUEUE_SIZE: 20, // Maximum players waiting in queue
  MAX_COMMANDS_PER_MINUTE: 60,
  AIRCRAFT_SPAWN_INTERVAL: 30000, // ms (legacy - now using TIMED_SPAWN_INTERVAL)
  TIMED_SPAWN_INTERVAL: 60, // seconds - spawn 1 plane per player every 60s
  CRASH_FREE_BONUS_INTERVAL: 180, // seconds - bonus every 3 minutes without crash
  SCENARIO_INTERVAL_MIN: 120000, // 2 minutes
  SCENARIO_INTERVAL_MAX: 300000, // 5 minutes
  INITIAL_AIRCRAFT_COUNT: 3, // Number of aircraft at game start
  GAME_DURATION: 300, // seconds - 5 minutes per game
  AUTO_CHAOS_INTERVAL_MIN: 30, // seconds - minimum time between auto chaos
  AUTO_CHAOS_INTERVAL_MAX: 45, // seconds - maximum time between auto chaos
  GAME_END_DISPLAY_DURATION: 5000, // ms - how long to show game end screen
} as const;

export const RADAR_CONFIG = {
  RANGE_RINGS: [5, 10, 20], // Nautical miles
  PRIMARY_COLOR: "#00FF00",
  BACKGROUND_COLOR: "#000000",
  TRAIL_OPACITY: 0.3,
  AIRCRAFT_SIZE: 8, // pixels
} as const;

export const MOBILE_CONFIG = {
  // Touch interaction settings
  TAP_TOLERANCE_TOUCH: 44, // px - WCAG 2.2 minimum touch target size
  TAP_TOLERANCE_MOUSE: 15, // px - desktop click tolerance
  TAP_DURATION_MAX: 300, // ms - maximum duration for tap detection
  DOUBLE_TAP_MAX_INTERVAL: 400, // ms - time window for double-tap detection
  DOUBLE_TAP_MAX_DISTANCE: 50, // px - maximum distance between taps for double-tap

  // Zoom and pan settings
  ZOOM_MIN: 0.5, // Minimum zoom level
  ZOOM_MAX: 3.0, // Maximum zoom level
  ZOOM_DOUBLE_TAP_TARGET: 2.0, // Zoom level when double-tapping

  // Font and icon scaling
  FONT_SCALE_MOBILE: 1.3, // 30% larger on mobile (390-767px)
  FONT_SCALE_TABLET: 1.15, // 15% larger on tablet (768-1024px)
  FONT_SCALE_DESKTOP: 1.0, // No scaling on desktop (>1024px)

  ICON_SIZE_MOBILE: 12, // px - aircraft icon size on mobile
  ICON_SIZE_TABLET: 10, // px - aircraft icon size on tablet
  ICON_SIZE_DESKTOP: 8, // px - aircraft icon size on desktop

  // Breakpoints (px)
  BREAKPOINT_MOBILE_MAX: 767, // Mobile devices: 0-767px
  BREAKPOINT_TABLET_MIN: 768, // Tablet devices: 768-1024px
  BREAKPOINT_TABLET_MAX: 1024,
  BREAKPOINT_DESKTOP_MIN: 1025, // Desktop: 1025px+

  // Performance settings
  TARGET_FPS_MOBILE: 45, // Lower target FPS for mobile to conserve battery
  TARGET_FPS_DESKTOP: 60, // Standard 60 FPS for desktop
  LOW_FPS_THRESHOLD_MOBILE: 30, // Warn if FPS drops below 30 on mobile
  LOW_FPS_THRESHOLD_DESKTOP: 45, // Warn if FPS drops below 45 on desktop
  BATTERY_SAVER_FPS: 30, // Battery saver mode caps at 30 FPS
  FPS_MEASUREMENT_INTERVAL: 500, // ms - measure FPS every 500ms
  FPS_HISTORY_LENGTH: 10, // Keep last 10 FPS measurements for average

  // Layout settings
  SIDEBAR_WIDTH_DESKTOP: 400, // px - desktop sidebar width
  SIDEBAR_WIDTH_TABLET: 350, // px - tablet sidebar width
  SIDEBAR_WIDTH_MOBILE_LANDSCAPE: 280, // px - mobile landscape sidebar width
  SIDEBAR_COLLAPSED_WIDTH: 40, // px - collapsed sidebar width (just toggle button)

  BOTTOM_SHEET_SNAP_POINTS: [120, 0.5, 0.85], // Peek (px), half (%), full (%) of screen height

  // Stepper controls
  STEPPER_HEADING_STEP: 5, // degrees
  STEPPER_ALTITUDE_STEP: 1000, // feet
  STEPPER_SPEED_STEP: 10, // knots
  STEPPER_BUTTON_SIZE_MOBILE: 48, // px - touch-friendly size
  STEPPER_BUTTON_SIZE_DESKTOP: 40, // px - desktop size

  // Tutorial settings
  TUTORIAL_DISMISSED_KEY: 'atc_mobile_tutorial_dismissed',
  TUTORIAL_DELAY: 1000, // ms - delay before showing tutorial
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

// Difficulty tiers for spawn progression (staged escalation)
export const SPAWN_DIFFICULTY_TIERS = [
  { minTime: 0, maxTime: 60, spawnInterval: 60, planesPerSpawn: 1 },    // Tier 1: 0-1 min
  { minTime: 60, maxTime: 120, spawnInterval: 40, planesPerSpawn: 2 },  // Tier 2: 1-2 min
  { minTime: 120, maxTime: 180, spawnInterval: 25, planesPerSpawn: 2 }, // Tier 3: 2-3 min
  { minTime: 180, maxTime: 300, spawnInterval: 15, planesPerSpawn: 3 }, // Tier 4: 3-5 min
] as const;

// Funny messages displayed when game ends
export const GAME_END_MESSAGES = [
  "You turned the sky into bumper cars!",
  "The FAA would like a word with you...",
  "At least nobody was hurt... right?",
  "Maybe stick to Microsoft Flight Simulator?",
  "NTSB investigators are en route to your location",
  "That's one way to clear the skies!",
  "Your pilot license has been revoked",
  "Well, that escalated quickly",
  "The insurance companies are NOT happy",
  "Congratulations on reinventing gravity!",
  "Physics wins again!",
  "Houston, we had a problem... several actually",
  "That was certainly... creative",
  "The good news: you set a new record!",
  "Air traffic control speedrun: FAILED",
  "Maybe those planes should've just walked?",
  "Your Yelp rating: ⭐ (1/5 stars)",
  "Next time, try NOT playing chicken with 747s",
  "Achievement unlocked: Cleared the airspace... permanently",
  "The sky is falling! ...literally",
] as const;
