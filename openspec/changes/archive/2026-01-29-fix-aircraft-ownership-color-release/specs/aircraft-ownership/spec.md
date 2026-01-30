## ADDED Requirements

### Requirement: One-at-a-time aircraft ownership

Each player SHALL control at most one aircraft at a time. When a player selects a new aircraft, the server MUST release ownership of any previously owned aircraft before assigning the new one.

#### Scenario: Player selects a new aircraft while already controlling one

- **WHEN** a player who owns aircraft A selects aircraft B
- **THEN** aircraft A's `ownerId` and `ownerColor` MUST be set to `null`
- **AND** aircraft B's `ownerId` MUST be set to the player's ID
- **AND** aircraft B's `ownerColor` MUST be set to the player's assigned color

#### Scenario: Player selects an unowned aircraft with no prior ownership

- **WHEN** a player who owns no aircraft selects aircraft A
- **THEN** aircraft A's `ownerId` MUST be set to the player's ID
- **AND** aircraft A's `ownerColor` MUST be set to the player's assigned color

### Requirement: Ownership release survives serialization

When aircraft ownership is released, the cleared ownership fields MUST be transmitted to all clients so the aircraft reverts to its default appearance.

#### Scenario: Released ownership is broadcast via StateDelta

- **WHEN** the server releases ownership of an aircraft
- **THEN** the StateDelta payload MUST include `ownerId: null` and `ownerColor: null` for that aircraft
- **AND** the `null` values MUST survive JSON serialization (not be stripped as `undefined` would be)

#### Scenario: Client merges null ownership from delta

- **WHEN** the client receives a StateDelta with `ownerColor: null` for an aircraft
- **THEN** the aircraft's `ownerColor` MUST be overwritten to `null`
- **AND** the aircraft MUST render in the default radar color

### Requirement: Ownership visibility across players

All connected players MUST see the same ownership coloring for every aircraft, regardless of who owns it.

#### Scenario: Other players see ownership assignment

- **WHEN** player A selects an aircraft
- **THEN** all other connected players MUST see that aircraft rendered in player A's assigned color

#### Scenario: Other players see ownership release

- **WHEN** player A releases an aircraft (by selecting a different one)
- **THEN** all other connected players MUST see the released aircraft revert to the default radar color

### Requirement: Ownership mutual exclusivity

An aircraft SHALL be owned by at most one player at a time. The server MUST reject selection attempts on aircraft already owned by another player.

#### Scenario: Player attempts to select aircraft owned by another player

- **WHEN** player B attempts to select an aircraft owned by player A
- **THEN** the server MUST reject the selection
- **AND** the aircraft MUST remain owned by player A with player A's color
