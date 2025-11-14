import { Aircraft, ChaosType, CHAOS_ABILITIES } from 'shared';

export class ChaosProcessor {
  /**
   * Apply chaos effect to all aircraft
   */
  applyChaos(aircraft: Record<string, Aircraft>, chaosType: ChaosType): string {
    const aircraftList = Object.values(aircraft).filter((a) => !a.isLanded && !a.hasCollided);

    if (aircraftList.length === 0) {
      return 'No aircraft available for chaos!';
    }

    switch (chaosType) {
      case 'reverse_course':
        return this.reverseCourse(aircraftList);
      case 'altitude_roulette':
        return this.altitudeRoulette(aircraftList);
      case 'speed_lottery':
        return this.speedLottery(aircraftList);
      case 'gravity_well':
        return this.gravityWell(aircraftList);
      case 'scatter_blast':
        return this.scatterBlast(aircraftList);
      case 'callsign_shuffle':
        return this.callsignShuffle(aircraftList);
      default:
        return 'Unknown chaos type!';
    }
  }

  /**
   * Reverse all aircraft headings 180 degrees
   */
  private reverseCourse(aircraft: Aircraft[]): string {
    aircraft.forEach((ac) => {
      ac.targetHeading = (ac.heading + 180) % 360;
    });
    return `⟲ REVERSE COURSE! All ${aircraft.length} aircraft flipped 180°`;
  }

  /**
   * Randomize all aircraft altitudes
   */
  private altitudeRoulette(aircraft: Aircraft[]): string {
    aircraft.forEach((ac) => {
      const variation = Math.floor(Math.random() * 10000) - 5000; // ±5000 ft
      ac.targetAltitude = Math.max(10000, Math.min(40000, ac.altitude + variation));
    });
    return `🎲 ALTITUDE ROULETTE! ${aircraft.length} aircraft scrambled to random altitudes`;
  }

  /**
   * Randomize all aircraft speeds
   */
  private speedLottery(aircraft: Aircraft[]): string {
    aircraft.forEach((ac) => {
      // Random speed between min and max speed for aircraft type
      const minSpeed = 150;
      const maxSpeed = 500;
      ac.targetSpeed = Math.floor(Math.random() * (maxSpeed - minSpeed)) + minSpeed;
    });
    return `⚡ SPEED LOTTERY! ${aircraft.length} aircraft set to random speeds`;
  }

  /**
   * Pull all aircraft toward center (0,0)
   */
  private gravityWell(aircraft: Aircraft[]): string {
    aircraft.forEach((ac) => {
      const dx = 0 - ac.position.x;
      const dy = 0 - ac.position.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Convert to aviation heading (0° = North, clockwise)
      ac.targetHeading = (90 - angle + 360) % 360;
    });
    return `🌀 GRAVITY WELL! ${aircraft.length} aircraft pulled toward center`;
  }

  /**
   * Push all aircraft away from center (0,0)
   */
  private scatterBlast(aircraft: Aircraft[]): string {
    aircraft.forEach((ac) => {
      const dx = ac.position.x - 0;
      const dy = ac.position.y - 0;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Convert to aviation heading (0° = North, clockwise)
      ac.targetHeading = (90 - angle + 360) % 360;
    });
    return `💥 SCATTER BLAST! ${aircraft.length} aircraft pushed away from center`;
  }

  /**
   * Shuffle all aircraft callsigns randomly
   */
  private callsignShuffle(aircraft: Aircraft[]): string {
    // Collect all callsigns
    const callsigns = aircraft.map((ac) => ac.callsign);

    // Fisher-Yates shuffle
    for (let i = callsigns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [callsigns[i], callsigns[j]] = [callsigns[j], callsigns[i]];
    }

    // Assign shuffled callsigns
    aircraft.forEach((ac, index) => {
      ac.callsign = callsigns[index];
    });

    return `🔀 CALLSIGN SHUFFLE! ${aircraft.length} aircraft identities scrambled`;
  }

  /**
   * Get chaos ability details
   */
  getChaosDetails(chaosType: ChaosType) {
    return CHAOS_ABILITIES[chaosType];
  }
}
