# Unhinged ATC — Repository Analysis & Improvement Recommendations

Comprehensive analysis performed across six dimensions: architecture, security, testing, performance, code quality, and UX/features.

---

## Executive Summary

The codebase is well-structured for a single-room multiplayer game with good TypeScript foundations, clean package boundaries, and excellent mobile support. However, there are critical issues in **security** (no WebSocket rate limiting, missing authorization), **performance** (full state broadcast every frame), and **maintainability** (1,600-line god-file). The testing coverage sits at roughly 15-20% with key game systems entirely untested.

**Overall Score: 7/10** — Solid fundamentals, needs hardening for production.

---

## 1. Architecture

### Strengths
- Clean monorepo structure with unidirectional dependency flow: Client/Server → Shared
- Proper epoch versioning for state consistency across game resets
- Good client-side defensive programming (stale delta rejection, duplicate event prevention)
- Watchdog timer for detecting stale connections (`useGameSync.ts`)

### Critical Issues

| Issue | Location | Impact |
|-------|----------|--------|
| **GameRoom.ts is a 1,601-line god-class** | `packages/server/src/game/GameRoom.ts` | Unmaintainable; violates SRP |
| **Single game loop processes all rooms sequentially** | `GameEngine.ts:33-35` | Frame drops with 100+ rooms |
| **Full aircraft data broadcast every frame** | `GameRoom.ts:298-318` | ~19 MB/sec network overhead per room |

### Recommendations

1. **Split GameRoom.ts** into focused modules:
   - `AircraftSpawner` — spawn logic (currently lines 949-1098)
   - `FuelManager` — fuel checking system
   - `PhaseManager` — bonus/chaos/spawn cycle management
   - `QueueManager` — player queue operations (currently lines 635-743)
   - Keep core `update()` to ~100 lines

2. **Implement delta compression** — only send changed aircraft fields per frame. Expected 60-80% data reduction.

3. **Use `setImmediate()` for broadcasting** to prevent blocking the event loop when emitting to multiple rooms.

---

## 2. Security

### Critical Vulnerabilities

| # | Issue | Location | Risk |
|---|-------|----------|------|
| 1 | **No auth on `reset_game`** — any player can reset the entire game | `index.ts:557-578` | Game disruption |
| 2 | **No auth on `set_time_scale`** — any player can freeze/speed up gameplay | `index.ts:465-484` | Game disruption |
| 3 | **No WebSocket rate limiting** — unlimited `aircraft_command` events | `index.ts:425-530` | DoS |
| 4 | **Unlimited `spawn_aircraft`** — can spawn 50 aircraft per call with no frequency limit | `index.ts:533-554` | Server crash |
| 5 | **Timing attack on admin password** — uses `!==` instead of constant-time comparison | `index.ts:118` | Credential leak |

### High-Severity Issues

| # | Issue | Location |
|---|-------|----------|
| 6 | No email validation — accepts any string | `index.ts:253-262` |
| 7 | Email addresses logged in plaintext to Cloud Logging | `logger.ts:33-39` |
| 8 | IP-based rate limiting bypassable via X-Forwarded-For spoofing | `index.ts:214-239` |
| 9 | Helmet CSP allows `wss:` and `ws:` with no host restriction | `index.ts:46` |

### Recommendations

1. **Add authorization middleware** for `reset_game` and `set_time_scale` — restrict to room creator or admin.
2. **Implement per-socket command throttling** — e.g., max 60 commands/minute per socket using a token bucket.
3. **Cap `spawn_aircraft`** — max 5 per call, once per 5 seconds per player.
4. **Use `crypto.timingSafeEqual()`** for admin password comparison.
5. **Hash or remove emails from logs** — they serve no operational purpose in plaintext.
6. **Add email format validation** with a regex or validation library.

---

## 3. Testing

### Current State

- **132 tests** across 5 test files (~15-20% code coverage)
- Vitest configured for both client (jsdom) and server (node)
- Good test patterns established (factory helpers, BDD-style describes, AAA pattern)

### Coverage Gaps

| Module | File | Test Coverage |
|--------|------|:------------:|
| AircraftPhysics | `AircraftPhysics.ts` | ~70% |
| GameRoom | `GameRoom.ts` | ~65% |
| GameStore | `gameStore.ts` | ~75% |
| **CommandProcessor** | `CommandProcessor.ts` | **0%** |
| **CollisionDetector** | `CollisionDetector.ts` | **~30% (indirect only)** |
| **LandingSystem** | `LandingSystem.ts` | **0%** |
| **WeatherSystem** | `WeatherSystem.ts` | **0%** |
| **ChaosProcessor** | `ChaosProcessor.ts` | **0%** |
| **GameEngine** | `GameEngine.ts` | **0%** |
| Client components | `~20 components` | **0%** |
| Shared package | types/constants | **0%** |

### Recommendations

**Phase 1 — Critical game logic:**
1. `CommandProcessor.test.ts` — parameter validation, bounds checking, edge cases
2. `CollisionDetector.test.ts` — conflict detection distances, crash thresholds, severity classification
3. `LandingSystem.test.ts` — approach validation, runway alignment, altitude/speed requirements

**Phase 2 — Supporting systems:**
4. `WeatherSystem.test.ts` — spawn, movement, expiration
5. `ChaosProcessor.test.ts` — all 6 chaos ability implementations
6. `GameEngine.test.ts` — room management, frame timing

**Phase 3 — Client & integration:**
7. WebSocket integration tests (event flow, reconnection)
8. Component tests (RadarDisplay, ControlPanel)
9. End-to-end multiplayer scenarios

---

## 4. Performance

### Critical (Immediate Impact)

| Issue | Location | Impact |
|-------|----------|--------|
| **Trail history sent every frame** | `GameRoom.ts:311` | ~1.7 MB/sec per room (30 positions × 20 aircraft × 60 FPS) |
| **All aircraft fields sent every frame** | `GameRoom.ts:298-318` | ~19 MB/sec per room uncompressed |
| **Zustand store spreads entire aircraft dict on single update** | `gameStore.ts:41-69` | All subscribers re-render |
| **O(n²) collision detection at 60 FPS** | `CollisionDetector.ts:22-29` | 11,400 calcs/sec with 20 aircraft |

### High

| Issue | Location |
|-------|----------|
| Conflict set rebuilt every render frame (60 allocs/sec) | `RadarDisplay.tsx:265-269` |
| Aircraft ownership release iterates all aircraft per command O(n) | `GameRoom.ts:777-782` |
| `recentEvents.unshift()` is O(n) — shifts 20 elements per event | `GameRoom.ts:940` |
| `Date.now()` called per-frame for crash animation | `RadarDisplay.tsx:687-717` |

### Medium

| Issue | Location |
|-------|----------|
| Trail rendering: 600 `worldToScreen()` calls/frame | `RadarDisplay.tsx:651-672` |
| `randomBytes()` buffer allocation in hot path | `GameRoom.ts:217,232,267,849` |
| Queue position update uses Map→Array→Sort | `GameRoom.ts:705-715` |
| `availableChaosAbilities` computed twice identically | `App.tsx:432-463` |

### Recommendations

1. **Send only new trail points** instead of full history — reduces trail data by ~97%.
2. **Implement dirty-flag delta encoding** — only serialize fields that changed since last frame.
3. **Use `Map<controllerId, aircraftId>`** for ownership instead of scanning all aircraft.
4. **Memoize `conflictAircraftIds`** in RadarDisplay using `useMemo`.
5. **Replace `recentEvents` array with circular buffer** — eliminate O(n) `unshift()`.
6. **Pre-generate event IDs** instead of `randomBytes()` per event in the hot path.

---

## 5. Code Quality

### TypeScript Issues

| Issue | Location |
|-------|----------|
| `any` type in public interface | `ControlPanel.tsx:11`, `useKeyboardControls.ts:7`, `useGameSync.ts:410` |
| `as any` type assertions for trail index | `AircraftPhysics.ts:126-128` |
| No ESLint configuration file despite ESLint being installed | Both packages |

### Code Duplication

| Duplicated Logic | Locations |
|-----------------|-----------|
| Heading validation (0-360°) | `CommandProcessor.ts:41`, `ControlPanel.tsx:40,46`, `useKeyboardControls.ts:77,86` |
| Altitude limits (0-45,000 ft) | `CommandProcessor.ts:55,76`, `ControlPanel.tsx:52,73` |
| Airspace/airport definitions | `GameRoom.ts` constructor and `resetForNextGame()` |
| Turn left/right calculation | `ControlPanel.tsx`, `useKeyboardControls.ts` |

### Dead Code

| Issue | Location |
|-------|----------|
| Commented-out event broadcasting | `GameEngine.ts:96-102` |
| Commented-out socket event registrations | `useGameSync.ts:248,382` |
| TODO stubs for waypoint navigation | `CommandProcessor.ts:116` |
| TODO stubs for landing logic | `CommandProcessor.ts:130` |

### Recommendations

1. **Create ESLint config** with rules against `any`, `console.log` in production, and enforcing return types.
2. **Extract shared validation** into `packages/shared/src/utils/validation.ts` for heading, altitude, and speed bounds.
3. **Remove commented-out code** — rely on git history.
4. **Replace `any` with typed union** for `CommandParams` interface.
5. **Extract airspace definitions** to shared constants — they're duplicated in GameRoom.

---

## 6. UX & Features

### Strengths
- Excellent mobile support (pinch zoom, pan, bottom sheet, touch targets meet WCAG 2.2)
- Retro CRT aesthetic with scanline overlay and glow effects
- Color-coded severity for events (critical/warning/info)
- Comprehensive queue system with real-time position updates
- Action indicators show command attribution per controller

### Critical UX Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| **Silent command rejection** — failed commands produce no user feedback | Users don't know if commands worked | HIGH |
| **No audio at all** — no crash sounds, alarms, radio chatter, or UI sounds | Severely limits immersion and accessibility | MEDIUM |
| **No spectating mode** — queued players see nothing while waiting | Poor queue experience | MEDIUM |
| **Waypoint navigation not implemented** | Core ATC feature missing (marked TODO) | HIGH |
| **Fuel never actually depletes** | Removes fuel management strategy element | MEDIUM |

### Missing ATC-Specific Features

1. **Conflict prediction** — only reactive detection; no 60-second lookahead warnings
2. **Holding patterns** — no automated holds at waypoints
3. **Go-around automation** — failed landings require manual altitude reset
4. **Wind effects** — weather system exists but doesn't affect aircraft heading/speed
5. **Separation minima display** — controllers can't see required distances on radar
6. **Aircraft performance data** — climb rate, turn rate not visible to controller
7. **Controller handoffs** — no coordination between players for specific aircraft

### Recommendations

1. **Add command feedback** — emit `command_result` event back to issuing client with success/failure + reason.
2. **Implement basic sound effects** — crash alert, separation warning beep, command confirmation tone.
3. **Add spectator view** for queued players — read-only radar feed while waiting.
4. **Implement conflict prediction** — extrapolate aircraft paths 60 seconds ahead and warn before violations occur.
5. **Complete waypoint navigation** — the TODO in CommandProcessor is a core gameplay feature.

---

## Priority Roadmap

### P0 — Must Fix (Security & Stability)
- [ ] Add authorization checks on `reset_game` and `set_time_scale`
- [ ] Implement WebSocket command rate limiting
- [ ] Cap `spawn_aircraft` frequency and count
- [ ] Use constant-time comparison for admin password

### P1 — Should Fix (Performance & Quality)
- [ ] Send only changed aircraft fields (delta encoding)
- [ ] Send only new trail points, not full history
- [ ] Split GameRoom.ts into focused modules
- [ ] Add CommandProcessor and CollisionDetector tests
- [ ] Add command success/failure feedback to client

### P2 — Important (UX & Features)
- [ ] Add basic sound effects (warnings, crashes, confirmations)
- [ ] Add spectator mode for queued players
- [ ] Implement conflict prediction (lookahead warnings)
- [ ] Complete waypoint navigation
- [ ] Create ESLint configuration

### P3 — Nice to Have (Polish)
- [ ] Binary protocol for WebSocket messages (msgpack/protobuf)
- [ ] Extract shared validation utilities
- [ ] Add client component tests
- [ ] Implement fuel depletion mechanics
- [ ] Add haptic feedback on mobile

---

*Analysis generated by a team of 6 specialized agents examining architecture, security, testing, performance, code quality, and UX.*
