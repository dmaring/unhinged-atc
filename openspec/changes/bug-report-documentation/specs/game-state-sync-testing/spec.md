## ADDED Requirements

### Requirement: Epoch validation testing
The system SHALL test that stale commands from old game epochs are rejected.

#### Scenario: Command from old epoch is rejected
- **WHEN** a client sends a command with an epoch value less than the current game epoch
- **THEN** the server MUST reject the command and return false

#### Scenario: Command from current epoch is accepted
- **WHEN** a client sends a command with the current game epoch
- **THEN** the server MUST process the command normally

#### Scenario: Epoch increments on game reset
- **WHEN** a game reset occurs
- **THEN** the game epoch MUST increment by exactly 1

### Requirement: Delta processing validation
The system SHALL test that state deltas are properly validated before application.

#### Scenario: Stale delta is rejected
- **WHEN** a client receives a delta with an epoch less than the current client epoch
- **THEN** the client MUST reject the delta and log a warning

#### Scenario: Delta updates only existing aircraft
- **WHEN** a delta contains updates for aircraft not in the current game state
- **THEN** the client MUST ignore updates for unknown aircraft IDs

#### Scenario: Aircraft removal is idempotent
- **WHEN** a delta contains removal for an aircraft that doesn't exist
- **THEN** the operation MUST complete without error

### Requirement: Queue promotion atomicity
The system SHALL test that queue promotion operations are atomic and prevent dual-list membership.

#### Scenario: Player cannot be in both active and queued lists
- **WHEN** a player is promoted from queue to active
- **THEN** the player MUST be removed from the queue before being added to active controllers

#### Scenario: Rapid disconnect during promotion is handled
- **WHEN** a promoted player disconnects during the promotion process
- **THEN** the system MUST not leave orphaned references in either list

#### Scenario: Queue positions update correctly after promotion
- **WHEN** a player is promoted from queue position 1
- **THEN** all remaining queued players MUST have their positions decremented by 1

### Requirement: Concurrent state modification testing
The system SHALL test race conditions in multiplayer state updates.

#### Scenario: Simultaneous player joins receive unique colors
- **WHEN** multiple players join within 100ms of each other
- **THEN** each player MUST receive a unique color assignment

#### Scenario: Simultaneous aircraft commands are serialized
- **WHEN** multiple controllers command the same aircraft simultaneously
- **THEN** only one controller MUST gain ownership

### Requirement: State synchronization after reconnect
The system SHALL test that clients can recover from connection interruptions.

#### Scenario: Full state sync on reconnection
- **WHEN** a client reconnects after disconnection
- **THEN** the server MUST send a complete game state with the current epoch

#### Scenario: Pending updates are discarded on disconnect
- **WHEN** a client has pending state updates and disconnects
- **THEN** those updates MUST be cleared and not applied after reconnection

### Requirement: Event deduplication testing
The system SHALL test that game events are not duplicated across state updates.

#### Scenario: Event is sent only once
- **WHEN** a game event is generated
- **THEN** the event MUST appear in exactly one state delta

#### Scenario: Duplicate event IDs are filtered
- **WHEN** the same event ID appears in multiple deltas
- **THEN** clients MUST display the event only once
