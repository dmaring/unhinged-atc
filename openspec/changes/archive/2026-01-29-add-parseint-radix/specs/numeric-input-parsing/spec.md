## ADDED Requirements

### Requirement: Explicit radix on all parseInt calls

All `parseInt()` invocations in client code MUST include an explicit radix parameter of `10` to ensure base-10 parsing regardless of input format.

#### Scenario: User enters zero-prefixed heading

- **WHEN** a user types `"010"` into the heading input
- **THEN** the value is parsed as decimal `10`
- **AND** the radix parameter `10` is explicitly passed to `parseInt`

#### Scenario: CSS safe area inset is parsed

- **WHEN** the `getSafeAreaInsets()` function reads a CSS custom property value
- **THEN** the value is parsed with an explicit radix of `10`
- **AND** the fallback of `0` is preserved for empty/missing values
