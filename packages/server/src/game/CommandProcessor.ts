import { Aircraft, AircraftCommand, CommandType, AIRCRAFT_TYPES } from 'shared';

export class CommandProcessor {
  /**
   * Process a command and apply it to the aircraft
   */
  processCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    // Update command tracking
    aircraft.lastCommandBy = command.controllerId;
    aircraft.lastCommandTime = command.timestamp;

    // Process based on command type
    switch (command.type) {
      case 'turn':
        return this.processTurnCommand(aircraft, command);
      case 'climb':
        return this.processClimbCommand(aircraft, command);
      case 'descend':
        return this.processDescendCommand(aircraft, command);
      case 'speed':
        return this.processSpeedCommand(aircraft, command);
      case 'direct':
        return this.processDirectCommand(aircraft, command);
      case 'land':
        return this.processLandCommand(aircraft, command);
      default:
        console.warn(`Unknown command type: ${command.type}`);
        return false;
    }
  }

  private processTurnCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (command.params.heading === undefined) {
      console.warn('Turn command missing heading parameter');
      return false;
    }

    // Validate heading (0-360)
    const heading = Math.max(0, Math.min(360, command.params.heading));
    aircraft.targetHeading = heading;

    console.log(`[Command] ${aircraft.callsign} turn to heading ${heading}°`);
    return true;
  }

  private processClimbCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (command.params.altitude === undefined) {
      console.warn('Climb command missing altitude parameter');
      return false;
    }

    // Validate altitude (0-45000 ft)
    const altitude = Math.max(0, Math.min(45000, command.params.altitude));

    // Can only climb if target is higher than current
    if (altitude <= aircraft.altitude) {
      console.warn(`Cannot climb to ${altitude} ft - currently at ${aircraft.altitude} ft`);
      return false;
    }

    aircraft.targetAltitude = altitude;

    console.log(`[Command] ${aircraft.callsign} climb to ${altitude} ft (FL${Math.round(altitude / 100)})`);
    return true;
  }

  private processDescendCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (command.params.altitude === undefined) {
      console.warn('Descend command missing altitude parameter');
      return false;
    }

    // Validate altitude (0-45000 ft)
    const altitude = Math.max(0, Math.min(45000, command.params.altitude));

    // Can only descend if target is lower than current
    if (altitude >= aircraft.altitude) {
      console.warn(`Cannot descend to ${altitude} ft - currently at ${aircraft.altitude} ft`);
      return false;
    }

    aircraft.targetAltitude = altitude;

    console.log(`[Command] ${aircraft.callsign} descend to ${altitude} ft (FL${Math.round(altitude / 100)})`);
    return true;
  }

  private processSpeedCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (command.params.speed === undefined) {
      console.warn('Speed command missing speed parameter');
      return false;
    }

    const perfData = AIRCRAFT_TYPES[aircraft.type];

    // Validate speed based on aircraft type
    const speed = Math.max(
      perfData.minSpeed,
      Math.min(perfData.maxSpeed, command.params.speed)
    );

    aircraft.targetSpeed = speed;

    console.log(`[Command] ${aircraft.callsign} speed ${speed} knots`);
    return true;
  }

  private processDirectCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (!command.params.waypoint) {
      console.warn('Direct command missing waypoint parameter');
      return false;
    }

    // TODO: Implement waypoint navigation
    console.log(`[Command] ${aircraft.callsign} direct to ${command.params.waypoint}`);
    return true;
  }

  private processLandCommand(aircraft: Aircraft, command: AircraftCommand): boolean {
    if (!command.params.runway) {
      console.warn('Land command missing runway parameter');
      return false;
    }

    // Set aircraft to landing phase
    aircraft.flightPhase = 'landing';

    // TODO: Implement landing logic
    console.log(`[Command] ${aircraft.callsign} cleared to land runway ${command.params.runway}`);
    return true;
  }

  /**
   * Generate a formatted command string for radio readback
   */
  formatCommandString(command: AircraftCommand): string {
    switch (command.type) {
      case 'turn':
        return `Turn heading ${command.params.heading}`;
      case 'climb':
        return `Climb to ${command.params.altitude} feet`;
      case 'descend':
        return `Descend to ${command.params.altitude} feet`;
      case 'speed':
        return `Speed ${command.params.speed} knots`;
      case 'direct':
        return `Direct to ${command.params.waypoint}`;
      case 'land':
        return `Cleared to land runway ${command.params.runway}`;
      default:
        return 'Unknown command';
    }
  }
}
