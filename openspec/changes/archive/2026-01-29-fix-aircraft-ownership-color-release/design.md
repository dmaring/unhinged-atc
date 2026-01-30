## Context

When a player selects a new aircraft, the server correctly releases ownership of the previously controlled aircraft by setting `ownerId` and `ownerColor` to `undefined`. However, `JSON.stringify` strips keys with `undefined` values. The client's spread-merge (`{ ...old, ...update }`) then preserves the stale ownership fields because the update object simply doesn't contain them.

The ownership assignment path works correctly — the bug is isolated to the release path.

## Goals / Non-Goals

**Goals:**
- Aircraft visually revert to default color when ownership is released
- All clients see ownership release in real-time (not just the releasing player)
- Minimal change — fix the serialization gap without restructuring ownership

**Non-Goals:**
- Changing the ownership model (one-at-a-time, mutual exclusivity)
- Adding explicit deselect commands from client
- Refactoring the StateDelta merge strategy on the client

## Decisions

### Decision 1: Use `null` instead of `undefined` for released ownership

**Choice:** Set `ownerId = null` and `ownerColor = null` when releasing, instead of `undefined`.

**Rationale:** `JSON.stringify({ ownerColor: null })` produces `{"ownerColor":null}`, preserving the key. The client spread-merge then correctly overwrites the old value with `null`. The rendering code (`if (aircraft.ownerColor)`) already treats `null` as falsy, falling through to default green.

**Alternative considered:** Sending an explicit "release" event via a separate WebSocket channel. Rejected — adds protocol complexity for a problem solvable with a one-line fix.

**Alternative considered:** Client-side cleanup (clear ownerColor when `selectedAircraftId` changes). Rejected — this would only fix it for the selecting player, not for other players who also need to see the release.

### Decision 2: Update shared types to `string | null` instead of `string | undefined`

**Choice:** Change `ownerId?: string` and `ownerColor?: string` to `ownerId?: string | null` and `ownerColor?: string | null` in the shared `Aircraft` interface.

**Rationale:** TypeScript distinguishes `undefined` (absent) from `null` (explicitly empty). Using `null` communicates "this was set and then cleared" which matches the domain semantics. The optional `?` marker is kept so new aircraft don't need to specify these fields.

## Risks / Trade-offs

- **Low risk:** `null` vs `undefined` falsiness — Both are falsy in JavaScript. Every existing check (`if (aircraft.ownerColor)`, `if (aircraft.ownerId)`) handles `null` identically to `undefined`. No conditional logic changes needed.
- **Type noise:** Adding `| null` to the type means code doing strict equality checks (`=== undefined`) would need updating. Mitigated by searching for such patterns before implementation.
