import { Aircraft, Airport, Runway, Position, POINTS } from 'shared';
import { AircraftPhysics } from './AircraftPhysics.js';

interface LandingAttempt {
  aircraftId: string;
  airport: string;
  runway: string;
  success: boolean;
  reason?: string;
}

export class LandingSystem {
  private physics: AircraftPhysics;
  private landingAttempts: Map<string, LandingAttempt> = new Map();

  constructor(physics: AircraftPhysics) {
    this.physics = physics;
  }

  /**
   * Check all aircraft for landing opportunities
   * Returns list of landing attempts
   */
  checkLandings(aircraft: Record<string, Aircraft>, airports: Airport[]): LandingAttempt[] {
    const attempts: LandingAttempt[] = [];

    Object.values(aircraft).forEach((plane) => {
      if (plane.isLanded || plane.hasCollided) return;

      // Check each airport
      for (const airport of airports) {
        const attempt = this.checkAirportApproach(plane, airport);
        if (attempt) {
          attempts.push(attempt);
          break; // Only land at one airport
        }
      }
    });

    return attempts;
  }

  /**
   * Check if aircraft is on approach to an airport
   */
  private checkAirportApproach(aircraft: Aircraft, airport: Airport): LandingAttempt | null {
    // Check each runway
    for (const runway of airport.runways) {
      const distanceToRunway = this.physics.getDistance(aircraft.position, runway.position);

      // Must be within 10 NM of runway
      if (distanceToRunway > 10) continue;

      // Check if aircraft is on final approach (within 5 NM and low altitude)
      const isOnFinal = distanceToRunway <= 5 && aircraft.altitude <= 3000;

      if (!isOnFinal) continue;

      // Check heading alignment (within ±15 degrees of runway heading)
      const headingDiff = this.normalizeAngle(aircraft.heading - runway.heading);
      const isAligned = Math.abs(headingDiff) <= 15;

      // Check if altitude is appropriate for distance
      // Typical approach is 3 degrees: ~300 ft per NM
      const targetAltitude = distanceToRunway * 300;
      const altitudeTolerance = 500; // feet
      const isOnGlideslope =
        aircraft.altitude >= targetAltitude - altitudeTolerance &&
        aircraft.altitude <= targetAltitude + altitudeTolerance + 1000;

      // Check if speed is appropriate (not too fast)
      const isSafeSpeed = aircraft.speed <= 200;

      // Attempt landing if very close to runway
      if (distanceToRunway <= 0.5) {
        const success = isAligned && isOnGlideslope && isSafeSpeed && aircraft.altitude <= 500;

        let reason: string | undefined;
        if (!success) {
          if (!isAligned) reason = 'Not aligned with runway';
          else if (!isOnGlideslope) reason = 'Wrong altitude';
          else if (!isSafeSpeed) reason = 'Speed too high';
          else reason = 'Approach unstable';
        }

        return {
          aircraftId: aircraft.id,
          airport: airport.code,
          runway: runway.name,
          success,
          reason,
        };
      }

      // If on approach but not at landing point yet, update flight phase
      if (aircraft.flightPhase !== 'landing') {
        aircraft.flightPhase = 'approach';
      }
    }

    return null;
  }

  /**
   * Calculate landing score based on conditions
   */
  calculateLandingScore(aircraft: Aircraft, attempt: LandingAttempt): number {
    let score = POINTS.successfulLanding; // Base score

    // Bonus for fuel efficiency
    if (aircraft.fuel > 30) {
      score += POINTS.fuelEfficient;
    }

    // Penalty for emergency landing
    if (aircraft.emergencyType) {
      score -= 50;
    }

    return score;
  }

  private normalizeAngle(angle: number): number {
    while (angle < -180) angle += 360;
    while (angle > 180) angle -= 360;
    return angle;
  }
}
