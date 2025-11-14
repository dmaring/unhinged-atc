import { Aircraft, AIRCRAFT_TYPES } from 'shared';

export class AircraftPhysics {
  // Time scale multiplier - makes the game faster and more fun!
  // 10x means aircraft move 10x faster than real-time
  private timeScale = 10;

  /**
   * Set the time scale multiplier
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(1, Math.min(30, scale)); // Clamp between 1x and 30x
  }

  /**
   * Get the current time scale
   */
  getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * Update aircraft position and state based on physics
   * Called 60 times per second (deltaTime = 1/60 ≈ 0.0167s)
   */
  update(aircraft: Aircraft, deltaTime: number): void {
    // Apply time scale for faster, more exciting gameplay
    const scaledDeltaTime = deltaTime * this.timeScale;
    // 1. Turn towards target heading
    this.updateHeading(aircraft, scaledDeltaTime);

    // 2. Climb/descend towards target altitude
    this.updateAltitude(aircraft, scaledDeltaTime);

    // 3. Accelerate/decelerate towards target speed
    this.updateSpeed(aircraft, scaledDeltaTime);

    // 4. Update position based on heading and speed
    this.updatePosition(aircraft, scaledDeltaTime);

    // 5. Decrease fuel (use regular deltaTime so fuel doesn't burn too fast)
    this.updateFuel(aircraft, deltaTime);

    // 6. Update trail history
    this.updateTrail(aircraft);
  }

  private updateHeading(aircraft: Aircraft, deltaTime: number): void {
    const headingDiff = this.normalizeAngle(aircraft.targetHeading - aircraft.heading);

    if (Math.abs(headingDiff) < 0.1) {
      aircraft.heading = aircraft.targetHeading;
      return;
    }

    const turnAmount = Math.min(
      Math.abs(headingDiff),
      aircraft.turnRate * deltaTime
    );

    aircraft.heading += Math.sign(headingDiff) * turnAmount;
    aircraft.heading = this.normalizeAngle(aircraft.heading);
  }

  private updateAltitude(aircraft: Aircraft, deltaTime: number): void {
    const altDiff = aircraft.targetAltitude - aircraft.altitude;

    if (Math.abs(altDiff) < 10) {
      aircraft.altitude = aircraft.targetAltitude;
      return;
    }

    const climbAmount = Math.min(
      Math.abs(altDiff),
      (aircraft.climbRate * deltaTime) / 60 // Convert ft/min to ft/sec
    );

    aircraft.altitude += Math.sign(altDiff) * climbAmount;
  }

  private updateSpeed(aircraft: Aircraft, deltaTime: number): void {
    const speedDiff = aircraft.targetSpeed - aircraft.speed;

    if (Math.abs(speedDiff) < 1) {
      aircraft.speed = aircraft.targetSpeed;
      return;
    }

    const accelAmount = Math.min(
      Math.abs(speedDiff),
      aircraft.acceleration * deltaTime
    );

    aircraft.speed += Math.sign(speedDiff) * accelAmount;

    // Enforce aircraft speed limits
    const perfData = AIRCRAFT_TYPES[aircraft.type];
    aircraft.speed = Math.max(
      perfData.minSpeed,
      Math.min(perfData.maxSpeed, aircraft.speed)
    );
  }

  private updatePosition(aircraft: Aircraft, deltaTime: number): void {
    // Convert heading to radians (0° = North, clockwise)
    // Aviation: 0° = North, 90° = East, 180° = South, 270° = West
    // Math: 0° = East, 90° = North (counterclockwise from East)
    // Conversion: math_angle = 90° - aviation_heading
    const radians = ((90 - aircraft.heading) * Math.PI) / 180;

    // Calculate distance traveled in nautical miles
    // speed is in knots (NM/hour), deltaTime is in seconds
    const distance = (aircraft.speed * deltaTime) / 3600;

    // Update position
    aircraft.position.x += Math.cos(radians) * distance;
    aircraft.position.y += Math.sin(radians) * distance;
  }

  private updateFuel(aircraft: Aircraft, deltaTime: number): void {
    const fuelBurnRate = this.getFuelBurnRate(aircraft);
    aircraft.fuel -= fuelBurnRate * deltaTime;

    // Clamp fuel to 0-100
    aircraft.fuel = Math.max(0, Math.min(100, aircraft.fuel));
  }

  private updateTrail(aircraft: Aircraft): void {
    // Add current position to trail
    aircraft.trailHistory.push({
      x: aircraft.position.x,
      y: aircraft.position.y,
    });

    // Keep only last 30 positions (about 0.5 seconds at 60 FPS)
    if (aircraft.trailHistory.length > 30) {
      aircraft.trailHistory.shift();
    }
  }

  private getFuelBurnRate(aircraft: Aircraft): number {
    // Simplified fuel model (% per second)
    const baseBurn = 0.01; // Base burn rate
    const speedFactor = aircraft.speed / 450; // More speed = more fuel
    const altFactor = aircraft.altitude < 10000 ? 1.5 : 1.0; // Low altitude = more fuel

    return baseBurn * speedFactor * altFactor;
  }

  private normalizeAngle(angle: number): number {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }

  /**
   * Check if aircraft is within bounds
   */
  isInBounds(aircraft: Aircraft, bounds: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
    return (
      aircraft.position.x >= bounds.minX &&
      aircraft.position.x <= bounds.maxX &&
      aircraft.position.y >= bounds.minY &&
      aircraft.position.y <= bounds.maxY
    );
  }

  /**
   * Calculate distance between two positions in nautical miles
   */
  getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
