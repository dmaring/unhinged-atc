## ADDED Requirements

### Requirement: Connection failure user feedback
The system SHALL provide clear user feedback when connection attempts fail.

#### Scenario: Max reconnection attempts notification
- **WHEN** Socket.IO exhausts all reconnection attempts
- **THEN** the system MUST emit a connection_failed event with error message and retry count

#### Scenario: Reconnection attempt progress
- **WHEN** a reconnection attempt is in progress
- **THEN** the UI MUST show which attempt number is being tried and the maximum attempts

#### Scenario: Manual retry option
- **WHEN** automatic reconnection fails completely
- **THEN** the UI MUST provide a manual "Retry Connection" button

### Requirement: Watchdog monitoring and recovery
The system SHALL monitor connection health and attempt recovery when stale.

#### Scenario: Stale connection detection
- **WHEN** no state updates have been received for 3 seconds
- **THEN** the watchdog MUST log a warning about connection staleness

#### Scenario: Critical staleness triggers reconnect
- **WHEN** no state updates have been received for 10 seconds
- **THEN** the system MUST automatically disconnect and reconnect

#### Scenario: User notification of connection issues
- **WHEN** connection staleness is detected but not critical
- **THEN** the system MUST notify the user once that connection monitoring is active

#### Scenario: Stale warning resets on recovery
- **WHEN** state updates resume after staleness detection
- **THEN** the stale warning flag MUST be cleared to allow future warnings

### Requirement: Reconnection backoff strategy
The system SHALL implement exponential backoff for reconnection attempts.

#### Scenario: Initial reconnection delay
- **WHEN** the first reconnection attempt occurs
- **THEN** the delay MUST be 1000ms

#### Scenario: Maximum reconnection delay
- **WHEN** multiple reconnection attempts have failed
- **THEN** the delay MUST not exceed 5000ms

#### Scenario: Backoff resets on successful connection
- **WHEN** a connection is successfully established
- **THEN** the reconnection attempt counter MUST reset to 0

### Requirement: Connection state visibility
The system SHALL expose connection state to UI components.

#### Scenario: Connection status is reactive
- **WHEN** connection status changes
- **THEN** the UI MUST update to reflect the new state (connecting, connected, disconnected, error)

#### Scenario: Last update timestamp is tracked
- **WHEN** state updates are received
- **THEN** the system MUST track the timestamp of the last successful update

#### Scenario: Connection metrics are available
- **WHEN** debugging connection issues
- **THEN** the system MUST expose reconnection attempt count, last error, and connection duration

### Requirement: Graceful degradation on network issues
The system SHALL handle network interruptions without data corruption.

#### Scenario: Pending commands are cancelled on disconnect
- **WHEN** a client disconnects with pending aircraft commands
- **THEN** those commands MUST be cancelled and not retried on reconnect

#### Scenario: State updates during disconnect are discarded
- **WHEN** state deltas arrive while disconnected
- **THEN** the deltas MUST be ignored to prevent stale state application

#### Scenario: Full state resync after reconnect
- **WHEN** a client reconnects after network interruption
- **THEN** the server MUST send a complete game state to ensure synchronization

### Requirement: Error handling and logging
The system SHALL log connection errors with sufficient context for debugging.

#### Scenario: Connection errors include context
- **WHEN** a connection error occurs
- **THEN** the log MUST include error type, reconnection attempt number, and timestamp

#### Scenario: Rate limiting detection
- **WHEN** connection attempts are rate limited
- **THEN** the system MUST detect this condition and notify the user with appropriate messaging

#### Scenario: Network condition logging
- **WHEN** connection issues occur
- **THEN** the system MUST log observable network conditions (latency, packet loss if available)
