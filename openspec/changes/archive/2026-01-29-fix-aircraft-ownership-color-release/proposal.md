## Why

When a player selects a new aircraft, the previously controlled aircraft keeps the player's color instead of reverting to the default green. This is a JSON serialization bug: the server sets `ownerId` and `ownerColor` to `undefined` on release, but `JSON.stringify` strips `undefined` keys from the delta payload. The client's spread-merge then preserves the stale color values. All players see the stuck color, breaking the visual feedback for multiplayer ownership.

## What Changes

- Server uses `null` instead of `undefined` when releasing aircraft ownership, so the values survive JSON serialization
- Shared `Aircraft` type updated to allow `null` for `ownerId` and `ownerColor`
- Client rendering already handles this correctly (`null` is falsy, so `if (aircraft.ownerColor)` falls through to default green)

## Capabilities

### New Capabilities
- `aircraft-ownership`: Defines how aircraft ownership is assigned, released, and visually communicated to all players

### Modified Capabilities
<!-- None — no existing specs are affected -->

## Impact

- `packages/shared/src/types/aircraft.ts`: Type change — `ownerId` and `ownerColor` accept `null`
- `packages/server/src/game/GameRoom.ts`: Use `null` instead of `undefined` when releasing ownership
- Client rendering requires no changes (already handles falsy `ownerColor`)
