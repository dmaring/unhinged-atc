## Context

The client package has 8 `parseInt()` calls across 3 files, all missing the radix parameter. These parse user-typed text input values and CSS custom property strings — all intended as base-10.

## Goals / Non-Goals

**Goals:**
- Add explicit radix `10` to all `parseInt()` calls in the client package

**Non-Goals:**
- Changing parsing logic or validation behavior
- Adding `Number()` or other alternative parsing approaches
- Modifying server-side code (no `parseInt` issues found there)

## Decisions

### Decision 1: Use `parseInt(value, 10)` rather than switching to `Number()`

`Number()` is stricter (rejects `"10px"`) and doesn't need a radix, but changing the parsing function could subtly alter behavior. Adding the radix parameter is the minimal, zero-risk fix — it changes nothing about how values are parsed, just makes the base explicit.

### Decision 2: Mechanical replacement only

Each call site gets `, 10` added as the second argument. No surrounding code changes, no additional validation, no refactoring. This keeps the diff minimal and reviewable.
