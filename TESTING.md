# Testing Documentation

This document describes the comprehensive test suite for the aircraft ownership/locking system and action indicators feature.

## Overview

The test suite covers three main areas:
1. **Server-side GameRoom ownership logic** - Aircraft selection, ownership assignment, and command validation
2. **Server-side action indicators** - Visual feedback for user commands
3. **Client-side gameStore** - State management for action indicators

## Test Framework

- **Framework**: Vitest (v4.0.16)
- **Total Tests**: 54 tests (53 passing, 1 skipped)
- **Coverage**: Core ownership and action indicator features

## Running Tests

### Run all tests (watch mode)
```bash
# From workspace root
pnpm test

# Individual packages
pnpm test:server
pnpm test:client
```

### Run tests once (CI mode)
```bash
# From workspace root
pnpm test:run

# Individual packages
cd packages/server && pnpm test:run
cd packages/client && pnpm test:run
```

### Run with UI
```bash
# Interactive test UI
pnpm test:ui
```

### Run with coverage
```bash
pnpm test:coverage
```

## Test Files

### Server Tests

#### `/packages/server/src/game/GameRoom.test.ts` (16 tests)

Tests the core aircraft ownership system:

**Aircraft Selection (select_aircraft command)**
- ✓ Assigns ownership when controller selects unowned aircraft
- ✓ Prevents other controllers from selecting owned aircraft
- ✓ Allows same controller to re-select their aircraft
- ✓ Releases previous aircraft when selecting a new one

**Command Ownership Validation**
- ✓ Rejects commands to aircraft owned by another controller
- ✓ Allows commands from the owning controller
- ✓ Auto-assigns ownership when commanding unowned aircraft
- ✓ Releases previous aircraft when auto-assigning via command

**Controller Color Assignment**
- ✓ Assigns unique colors to different controllers
- ✓ Cycles through colors when there are more controllers than colors
- ✓ Propagates controller color to owned aircraft

**Multiple Controllers Interaction**
- ✓ Allows multiple controllers to own different aircraft simultaneously
- ✓ Enforces one aircraft per controller rule

**Edge Cases**
- ✓ Handles commands to non-existent aircraft gracefully
- ✓ Handles commands from non-existent controller gracefully
- ✓ Preserves ownership across multiple command types

#### `/packages/server/src/game/GameRoom.actionIndicators.test.ts` (17 tests)

Tests the action indicators visual feedback system:

**Action Indicator Generation**
- ✓ Generates "locked" indicator when selecting aircraft
- ✓ Generates "turn" indicator for heading commands (e.g., "270°")
- ✓ Generates "climb" indicator for climb commands (e.g., "FL250")
- ✓ Generates "descend" indicator for descend commands (e.g., "FL100")
- ✓ Generates "speed" indicator for speed commands (e.g., "300kts")
- ✓ Generates "LANDING" indicator for land commands
- ⊘ Generates "HOLD" indicator for hold commands (SKIPPED - not implemented)
- ✓ Generates "DIRECT" indicator for direct commands
- ✓ Generates "error" indicator when trying to command locked aircraft

**Action Indicator Properties**
- ✓ Includes all required properties (id, aircraftId, type, message, timestamp)
- ✓ Generates unique IDs for each indicator
- ✓ Has timestamps close to command time

**Action Indicator Lifecycle**
- ✓ Clears indicators after sending them in a delta
- ✓ Accumulates multiple indicators before update

**Integration Tests**
- ✓ Tracks different indicators for different aircraft
- ✓ Only generates indicators for successful commands
- ✓ Generates indicators when auto-assigning ownership

### Client Tests

#### `/packages/client/src/stores/gameStore.test.ts` (21 tests)

Tests the Zustand store's action indicator management:

**addActionIndicator**
- ✓ Adds an action indicator to the store
- ✓ Adds multiple action indicators
- ✓ Maintains indicators in insertion order
- ✓ Allows duplicate aircraft IDs with different indicator IDs

**removeActionIndicator**
- ✓ Removes an action indicator by ID
- ✓ Only removes the indicator with matching ID
- ✓ Handles removing non-existent indicator gracefully
- ✓ Handles removing from empty array
- ✓ Preserves remaining indicators when removing one

**Action Indicator State Management**
- ✓ Initializes with empty action indicators array
- ✓ Resets action indicators when store is reset
- ✓ Maintains indicators independently of game state

**Action Indicator Types**
- ✓ Handles "turn" type indicators
- ✓ Handles "climb" type indicators
- ✓ Handles "descend" type indicators
- ✓ Handles "speed" type indicators
- ✓ Handles "locked" type indicators
- ✓ Handles "error" type indicators

**Batch Operations**
- ✓ Handles adding multiple indicators in rapid succession
- ✓ Handles removing multiple indicators sequentially

**Integration**
- ✓ Works alongside other store operations

## Key Features Tested

### 1. Aircraft Ownership/Locking

**Ownership Assignment**
- When a player selects an aircraft (via `select_aircraft` command), they become the owner
- Only one aircraft per controller at a time - selecting a new aircraft releases the previous one
- Auto-ownership: Issuing any command to an unowned aircraft automatically assigns ownership

**Ownership Blocking**
- Other players cannot command an aircraft owned by someone else
- Attempting to select or command a locked aircraft fails gracefully
- Error indicators are generated when commands are rejected

**Controller Colors**
- Each controller gets assigned a unique color from the CONTROLLER_COLORS array
- Colors are cycled when there are more controllers than available colors
- Aircraft inherit the owner's color for visual identification

### 2. Action Indicators

**Indicator Types**
- `turn`: Heading changes (displays target heading in degrees)
- `climb`: Altitude increases (displays as flight level, e.g., "FL250")
- `descend`: Altitude decreases (displays as flight level)
- `speed`: Speed changes (displays in knots)
- `locked`: Aircraft selection confirmation
- `error`: Command rejection notifications

**Indicator Properties**
- Each indicator has a unique ID (8-character hex string)
- Includes aircraft ID, type, message, and timestamp
- Sent in `StateDelta.actionIndicators` array
- Cleared after being sent to prevent duplicates

**Lifecycle**
- Generated when commands are processed
- Accumulated during the frame
- Sent with the next game state delta
- Cleared after transmission

## Test Coverage Summary

| Component | Test File | Tests | Status |
|-----------|-----------|-------|--------|
| GameRoom Ownership | GameRoom.test.ts | 16 | ✓ 16 passing |
| GameRoom Action Indicators | GameRoom.actionIndicators.test.ts | 17 | ✓ 16 passing, 1 skipped |
| Client Store | gameStore.test.ts | 21 | ✓ 21 passing |
| **Total** | | **54** | **53 passing, 1 skipped** |

## Continuous Integration

Tests should be run as part of CI/CD pipeline:

```yaml
# Example CI configuration
test:
  script:
    - pnpm install
    - pnpm test:run
    - pnpm test:coverage
```

## Future Test Additions

1. **Integration Tests**: End-to-end tests with real WebSocket connections
2. **Performance Tests**: Test ownership with many concurrent controllers
3. **UI Tests**: Visual indicator rendering with Playwright
4. **Hold Command**: Add tests when hold pattern functionality is implemented

## Troubleshooting

### Tests failing due to timing issues
- Ensure `beforeEach` resets state properly
- Use `await` for async operations
- Check for race conditions in parallel tests

### Import errors
- Verify `shared` package is built: `pnpm build` in workspace root
- Check TypeScript configuration in `tsconfig.json`
- Ensure proper module resolution in `vitest.config.ts`

### Coverage not generating
- Install `@vitest/coverage-v8`: `pnpm add -D @vitest/coverage-v8`
- Check `vitest.config.ts` coverage configuration

## Contributing

When adding new features related to ownership or action indicators:

1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add new test cases for edge cases
4. Update this documentation
5. Run coverage to ensure adequate test coverage

## Test Conventions

- Use `describe` blocks to group related tests
- Use clear, descriptive test names that complete "it should..."
- Follow Arrange-Act-Assert pattern
- Mock external dependencies appropriately
- Keep tests focused and independent
- Use `beforeEach` for test setup
- Use `.skip` for temporarily disabled tests with explanatory comments
