## Why

All `parseInt()` calls in the client lack an explicit radix parameter. While modern JS engines default to base-10, omitting the radix is flagged by linters (ESLint `radix` rule), obscures developer intent, and is a known source of subtle bugs in older environments or edge cases.

## What Changes

- Add explicit radix `10` to every `parseInt()` call in the client package
- No behavioral change in practice — just making intent explicit

## Capabilities

### New Capabilities
- `numeric-input-parsing`: All user input parsing and CSS value parsing uses explicit base-10 radix

### Modified Capabilities
<!-- None — no existing spec-level behavior is changing -->

## Impact

- `packages/client/src/components/ControlPanel/ControlPanel.tsx`: 3 parseInt calls
- `packages/client/src/components/NumericStepper/NumericStepper.tsx`: 1 parseInt call
- `packages/client/src/utils/deviceDetection.ts`: 4 parseInt calls
