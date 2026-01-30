## 1. ControlPanel — add radix to parseInt calls

- [x] 1.1 Add radix `10` to `parseInt(heading)` at line ~64
- [x] 1.2 Add radix `10` to `parseInt(altitude)` at line ~72
- [x] 1.3 Add radix `10` to `parseInt(speed)` at line ~85

## 2. NumericStepper — add radix to parseInt call

- [x] 2.1 Add radix `10` to `parseInt(inputValue)` at line ~50

## 3. deviceDetection — add radix to safe area inset parsing

- [x] 3.1 Add radix `10` to all four `parseInt()` calls in `getSafeAreaInsets()` (lines ~100-103)

## 4. SpeedControl — add radix to parseInt call (discovered during verification)

- [x] 4.1 Add radix `10` to `parseInt(e.target.value)` at line ~64

## 5. Verify

- [x] 5.1 Confirm no remaining `parseInt` calls without radix in `packages/client/src/`
