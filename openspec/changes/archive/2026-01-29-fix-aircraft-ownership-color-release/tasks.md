## 1. Shared Types

- [x] 1.1 Update `ownerId` type from `string | undefined` to `string | null | undefined` in `packages/shared/src/types/aircraft.ts`
- [x] 1.2 Update `ownerColor` type from `string | undefined` to `string | null | undefined` in `packages/shared/src/types/aircraft.ts`

## 2. Server Ownership Release

- [x] 2.1 Change `a.ownerId = undefined` to `a.ownerId = null` in the `select_aircraft` release loop (`GameRoom.ts` ~line 740)
- [x] 2.2 Change `a.ownerColor = undefined` to `a.ownerColor = null` in the `select_aircraft` release loop (`GameRoom.ts` ~line 741)
- [x] 2.3 Change `a.ownerId = undefined` to `a.ownerId = null` in the auto-assign release loop (`GameRoom.ts` ~line 767)
- [x] 2.4 Change `a.ownerColor = undefined` to `a.ownerColor = null` in the auto-assign release loop (`GameRoom.ts` ~line 768)

## 3. Verify No Strict Equality Checks Break

- [x] 3.1 Search client and server for `=== undefined` or `!== undefined` checks on `ownerId` or `ownerColor` and fix any that would break with `null`

## 4. Controllers Panel — display player colors

- [x] 4.1 Apply `controller.color` as inline style on the indicator dot in PlayersPanel.tsx
- [x] 4.2 Apply `controller.color` as inline style on the username in PlayersPanel.tsx

## 5. Manual Verification

- [x] 5.1 Open the game in two browser windows, select an aircraft in window 1, then select a different aircraft — confirm the first aircraft reverts to green in both windows
- [x] 5.2 Confirm each player's name and indicator dot in the Controllers panel shows their unique assigned color
