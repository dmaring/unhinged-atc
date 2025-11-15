/**
 * Message templates for game events with humor and variety
 */

// Utility to pick a random message from an array
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Crash messages - prioritizing humor and chaos
export const CRASH_MESSAGES = [
  (callsign1: string, callsign2: string) => `💥 ${callsign1} and ${callsign2} have merged into modern art`,
  (callsign1: string, callsign2: string) => `🔥 ${callsign1} decided to kiss ${callsign2}... with extreme prejudice`,
  (callsign1: string, callsign2: string) => `⚠️ BREAKING: ${callsign1} and ${callsign2} form unprecedented mid-air merger`,
  (callsign1: string, callsign2: string) => `💀 ${callsign1} and ${callsign2} just invented a new dance move: The Collision`,
  (callsign1: string, callsign2: string) => `😱 ${callsign1} and ${callsign2} violated the laws of physics AND aviation`,
  (callsign1: string, callsign2: string) => `🎆 ${callsign1} and ${callsign2} created an unscheduled fireworks display`,
  (callsign1: string, callsign2: string) => `🚨 ${callsign1} + ${callsign2} = Your worst nightmare realized`,
  (callsign1: string, callsign2: string) => `💥 ${callsign1} and ${callsign2} are no longer accepting applications for survival`,
  (callsign1: string, callsign2: string) => `🔴 CATASTROPHIC: ${callsign1} and ${callsign2} just became debris field #${Math.floor(Math.random() * 1000)}`,
  (callsign1: string, callsign2: string) => `☠️ ${callsign1} and ${callsign2}: Brought together by bad ATC, separated by physics`,
];

// Near miss messages - emphasizing panic and chaos
export const NEAR_MISS_MESSAGES = [
  (callsign1: string, callsign2: string) => `😰 Close call! Passengers on ${callsign1} and ${callsign2} just saw their lives flash before their eyes`,
  (callsign1: string, callsign2: string) => `⚠️ ${callsign1} and ${callsign2} exchanged paint at FL${Math.floor(Math.random() * 300 + 100)}`,
  (callsign1: string, callsign2: string) => `😱 ${callsign1} pilot to ${callsign2}: "I can see what you had for breakfast!"`,
  (callsign1: string, callsign2: string) => `🚨 NEAR MISS: ${callsign1} and ${callsign2} just proved how close is TOO close`,
  (callsign1: string, callsign2: string) => `💀 ${callsign1} and ${callsign2} played chicken. Both lost their nerve (and composure)`,
  (callsign1: string, callsign2: string) => `⚡ ${callsign1} and ${callsign2} missed by mere pixels on someone's radar screen`,
  (callsign1: string, callsign2: string) => `🎢 ${callsign1} and ${callsign2} passengers got a FREE adrenaline rush!`,
  (callsign1: string, callsign2: string) => `😨 ${callsign1} and ${callsign2}: So close they could've shared WiFi passwords`,
  (callsign1: string, callsign2: string) => `⚠️ ${callsign1} and ${callsign2} just created new job openings in HR for trauma counselors`,
  (callsign1: string, callsign2: string) => `🫣 ${callsign1} and ${callsign2} violators are writing VERY lengthy incident reports`,
];

// Conflict detected messages - warnings with attitude
export const CONFLICT_MESSAGES = [
  (callsign1: string, callsign2: string) => `⚠️ CONFLICT: ${callsign1} and ${callsign2} are getting uncomfortably close`,
  (callsign1: string, callsign2: string) => `🚨 ${callsign1} and ${callsign2} are on a collision course. Do something!`,
  (callsign1: string, callsign2: string) => `😬 ${callsign1} and ${callsign2} separation is making me nervous...`,
  (callsign1: string, callsign2: string) => `⚡ ${callsign1} and ${callsign2} conflict detected - time to earn your paycheck!`,
  (callsign1: string, callsign2: string) => `🎯 ${callsign1} and ${callsign2} are converging. This is YOUR problem now`,
  (callsign1: string, callsign2: string) => `📢 ${callsign1} and ${callsign2}: Someone should probably do something about this...`,
  (callsign1: string, callsign2: string) => `😰 ${callsign1} and ${callsign2} trajectory analysis: BAD. Very bad.`,
];

// Aircraft exit messages - variety with some humor
export const AIRCRAFT_EXIT_MESSAGES = [
  (callsign: string) => `✈️ ${callsign} left controlled airspace (probably for the best)`,
  (callsign: string) => `👋 ${callsign} noped out of your airspace`,
  (callsign: string) => `🎉 ${callsign} escaped! They're someone else's problem now`,
  (callsign: string) => `✨ ${callsign} has left the building (and your airspace)`,
  (callsign: string) => `🚪 ${callsign} successfully fled your chaos zone`,
  (callsign: string) => `🏃 ${callsign} exited. They'll never speak of this again.`,
  (callsign: string) => `⭐ ${callsign} departed. Score +1 (somehow you didn't crash them)`,
  (callsign: string) => `🎊 ${callsign} made it out alive! Against all odds!`,
];

// Aircraft spawn messages - chaotic welcomes
export const AIRCRAFT_SPAWN_MESSAGES = [
  (callsign: string) => `✈️ ${callsign} enters your nightmare - good luck!`,
  (callsign: string) => `🎮 NEW CHALLENGER: ${callsign} has entered the arena`,
  (callsign: string) => `😈 ${callsign} spawned. Your problems just multiplied.`,
  (callsign: string) => `🚨 ${callsign} is now your responsibility. Don't mess this up.`,
  (callsign: string) => `⚡ ${callsign} online. Try not to crash this one.`,
  (callsign: string) => `🎯 ${callsign} added to the chaos. What could go wrong?`,
  (callsign: string) => `💀 ${callsign} has joined the server. Prepare for trouble.`,
  (callsign: string) => `🎪 ${callsign} enters the circus. Honk honk.`,
  (callsign: string) => `⚠️ ${callsign} spawned. Another victim for your incompetence!`,
  (callsign: string) => `🔥 ${callsign} is now in play. The odds of success just dropped.`,
];

// Fuel emergency messages
export const FUEL_WARNING_MESSAGES = [
  (callsign: string) => `⚠️ ${callsign} fuel LOW - they're flying on hopes and dreams`,
  (callsign: string) => `⛽ ${callsign} reports low fuel. Time to panic?`,
  (callsign: string) => `🚨 ${callsign} fuel warning! Someone should probably care about this`,
  (callsign: string) => `😰 ${callsign} is running on fumes and prayers`,
];

export const FUEL_EMERGENCY_MESSAGES = [
  (callsign: string) => `🔴 EMERGENCY: ${callsign} is about to become a glider!`,
  (callsign: string) => `💀 ${callsign} FUEL EMERGENCY! Gravity is about to take over`,
  (callsign: string) => `⚠️ ${callsign} has NO fuel! This is fine. Everything is fine.`,
  (callsign: string) => `🚨 ${callsign} fuel: CRITICAL! Start drafting the incident report now`,
  (callsign: string) => `😱 ${callsign} running on EMPTY! Physics doesn't care about your excuses!`,
];

// Chaos ability messages
export const CHAOS_ACTIVATION_MESSAGES: Record<string, string[]> = {
  'gravity_well': [
    '🌀 GRAVITY WELL ACTIVATED: All aircraft are now best friends!',
    '⚫ Gravity Well engaged. Watch them all converge into a nightmare!',
    '🌪️ GRAVITY WELL: Because chaos wasn\'t chaotic enough',
    '💫 Gravity Well activated. Say goodbye to safe separation!',
  ],
  'reverse_course': [
    '🔄 REVERSE COURSE: Everyone turn around! Chaos mode engaged!',
    '↩️ All aircraft reversing! This will definitely end well!',
    '🎢 REVERSE COURSE: U-turns for everyone! What could go wrong?',
    '🔃 Reversing all headings. Buckle up!',
  ],
  'altitude_chaos': [
    '📊 ALTITUDE CHAOS: Random climbs and descents for all!',
    '⬆️⬇️ Altitude Chaos engaged! Elevators broken!',
    '🎲 ALTITUDE CHAOS: Vertical separation is now optional!',
    '🎪 Random altitude changes! It\'s like a rollercoaster!',
  ],
  'speed_shuffle': [
    '⚡ SPEED SHUFFLE: Everyone gets a new speed!',
    '🏃 Speed randomization active! Fast, slow, who knows!',
    '🎯 SPEED SHUFFLE: Predictability is overrated!',
    '💨 Random speeds assigned. Good luck!',
  ],
  'callsign_shuffle': [
    '🎭 CALLSIGN SHUFFLE: Identity crisis for everyone!',
    '🔀 Callsigns scrambled! Who\'s who now?',
    '🎪 CALLSIGN SHUFFLE: Total confusion activated!',
    '🎲 New callsigns for all! Try to keep track!',
  ],
};

// Random chaos messages (periodic flavor text)
export const RANDOM_CHAOS_MESSAGES = [
  '📡 Systems nominal... wait, no they\'re not',
  '🎮 Achievement Unlocked: Survived another minute',
  '⚠️ Reminder: Crashes are bad for your performance review',
  '🤖 AI Copilot: "I would help but... nah"',
  '📊 Current chaos level: MAXIMUM',
  '🎪 Welcome to the thunderdome of air traffic control',
  '💀 Nobody said this job would be easy. Or safe. Or sane.',
  '⚡ Fun fact: Real ATC controllers don\'t deal with this nonsense',
  '🎯 Your success rate: Better than random chance! (barely)',
  '🚨 OSHA has entered the chat... then left immediately',
  '😈 The schadenfreude is strong with this one',
  '🎢 This is fine. Everything is fine.',
  '⚠️ Gravity: Still working. Your skills: Debatable.',
  '💥 Reminder: Metal birds shouldn\'t kiss',
];

// Landing success messages
export const LANDING_SUCCESS_MESSAGES = [
  (callsign: string) => `✅ ${callsign} landed safely! Miracle of the day!`,
  (callsign: string) => `🎉 ${callsign} touchdown! They actually made it!`,
  (callsign: string) => `⭐ ${callsign} landed. Passengers will need new pants though.`,
  (callsign: string) => `👏 ${callsign} successful landing! Against all odds!`,
];

// Landing failure messages
export const LANDING_FAILURE_MESSAGES = [
  (callsign: string) => `❌ ${callsign} go-around! Pilot: "NOPE NOPE NOPE"`,
  (callsign: string) => `⚠️ ${callsign} aborted landing. Too fast, too high, too scared.`,
  (callsign: string) => `🚨 ${callsign} rejected landing. Passengers are NOT happy.`,
  (callsign: string) => `😬 ${callsign} go-around. They'll try again... maybe.`,
];
