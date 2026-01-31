## ADDED Requirements

### Requirement: Game loop memory allocation limits
The game loop SHALL minimize memory allocations to prevent garbage collection pressure.

#### Scenario: Event ID tracking uses efficient data structure
- **WHEN** limiting the event ID tracking set to 100 entries
- **THEN** the implementation MUST delete entries from the front rather than creating new arrays

#### Scenario: Array operations in hot paths are minimized
- **WHEN** code runs 60 times per second in the game loop
- **THEN** temporary array allocations MUST be avoided or pre-allocated

#### Scenario: Object creation in game loop is tracked
- **WHEN** reviewing game loop code
- **THEN** each new object allocation MUST be justified and documented

### Requirement: Collection size management
Collections SHALL have enforced size limits to prevent unbounded growth.

#### Scenario: Event tracking has hard limit
- **WHEN** tracking sent event IDs
- **THEN** the collection MUST have a maximum size of 100 entries with automatic pruning

#### Scenario: Trail history has fixed size
- **WHEN** storing aircraft trail positions
- **THEN** the trail array MUST have a maximum length of 30 positions

#### Scenario: Recent events list is bounded
- **WHEN** storing recent game events
- **THEN** the list MUST have a maximum size of 20 events

### Requirement: Ring buffer usage for fixed-size collections
Fixed-size collections that update frequently SHALL use ring buffers instead of shift/push operations.

#### Scenario: Trail history uses ring buffer
- **WHEN** updating aircraft trail positions 60 times per second
- **THEN** the implementation MUST use a pre-allocated ring buffer with index wrapping

#### Scenario: Ring buffer avoids array modifications
- **WHEN** adding a new entry to a ring buffer
- **THEN** the implementation MUST overwrite the oldest entry without shifting elements

### Requirement: Resource cleanup on component unmount
Client components SHALL clean up timers, intervals, and event listeners.

#### Scenario: Timeouts are tracked and cleared
- **WHEN** creating setTimeout calls for UI indicators
- **THEN** timeout IDs MUST be tracked and cleared on component unmount

#### Scenario: Intervals are cleared on cleanup
- **WHEN** creating setInterval for watchdog monitoring
- **THEN** the interval MUST be cleared in the component cleanup function

#### Scenario: Socket listeners are removed
- **WHEN** registering socket event listeners in a React hook
- **THEN** all listeners MUST be removed in the cleanup return function

### Requirement: Memory leak detection
The documentation SHALL identify memory leak patterns and provide detection methods.

#### Scenario: Growing collections are flagged
- **WHEN** a collection can grow without bounds
- **THEN** the pattern MUST be documented as a memory leak with size limit recommendation

#### Scenario: Orphaned timers are identified
- **WHEN** timers or intervals are created without cleanup
- **THEN** the pattern MUST be documented with cleanup example

#### Scenario: Performance cost is quantified
- **WHEN** documenting a memory-related bug
- **THEN** the cost MUST include allocation rate, GC impact, or memory growth metrics
