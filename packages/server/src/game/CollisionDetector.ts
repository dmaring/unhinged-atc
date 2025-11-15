import { Aircraft, Conflict, SEPARATION_MINIMUMS, CRASH_CONFIG } from 'shared';
import { AircraftPhysics } from './AircraftPhysics.js';

export class CollisionDetector {
  private physics: AircraftPhysics;
  private previousConflicts: Map<string, Conflict> = new Map();

  constructor(physics: AircraftPhysics) {
    this.physics = physics;
  }

  /**
   * Check for conflicts between all aircraft pairs
   * Returns list of current conflicts
   */
  detectConflicts(aircraft: Record<string, Aircraft>): Conflict[] {
    const conflicts: Conflict[] = [];
    const aircraftList = Object.values(aircraft).filter(
      (a) => !a.isLanded && !a.hasCollided
    );

    // Check each pair of aircraft
    for (let i = 0; i < aircraftList.length; i++) {
      for (let j = i + 1; j < aircraftList.length; j++) {
        const conflict = this.checkPair(aircraftList[i], aircraftList[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    this.previousConflicts.clear();
    conflicts.forEach((conflict) => {
      const key = this.getConflictKey(conflict.aircraft1, conflict.aircraft2);
      this.previousConflicts.set(key, conflict);
    });

    return conflicts;
  }

  /**
   * Check for crashes between aircraft (horizontal distance only, ignores altitude)
   * Returns list of aircraft pairs that have crashed
   */
  detectCrashes(aircraft: Record<string, Aircraft>): Array<{ aircraft1: Aircraft; aircraft2: Aircraft }> {
    const crashes: Array<{ aircraft1: Aircraft; aircraft2: Aircraft }> = [];
    const aircraftList = Object.values(aircraft).filter(
      (a) => !a.isLanded && !a.hasCollided && !a.isCrashing
    );

    // Check each pair of aircraft
    for (let i = 0; i < aircraftList.length; i++) {
      for (let j = i + 1; j < aircraftList.length; j++) {
        const aircraft1 = aircraftList[i];
        const aircraft2 = aircraftList[j];

        // Check ONLY horizontal distance (ignore altitude)
        const horizontalDist = this.physics.getDistance(
          aircraft1.position,
          aircraft2.position
        );

        // Crash if within threshold (2 NM)
        if (horizontalDist <= CRASH_CONFIG.DISTANCE_THRESHOLD) {
          crashes.push({ aircraft1, aircraft2 });
        }
      }
    }

    return crashes;
  }

  /**
   * Check separation between two aircraft
   */
  private checkPair(aircraft1: Aircraft, aircraft2: Aircraft): Conflict | null {
    const horizontalDist = this.physics.getDistance(
      aircraft1.position,
      aircraft2.position
    );
    const verticalDist = Math.abs(aircraft1.altitude - aircraft2.altitude);

    // Determine required separation minimums
    const requiredHorizontal = SEPARATION_MINIMUMS.horizontal.enroute; // 5 NM
    const requiredVertical = SEPARATION_MINIMUMS.vertical.standard; // 1000 ft

    // Check if there's a separation issue
    const horizontalViolation = horizontalDist < requiredHorizontal;
    const verticalViolation = verticalDist < requiredVertical;

    if (!horizontalViolation && !verticalViolation) {
      return null; // No conflict
    }

    // Determine severity
    let severity: 'warning' | 'near-miss' | 'collision';

    // Collision: very close in both dimensions
    if (horizontalDist < 0.5 && verticalDist < 500) {
      severity = 'collision';
    }
    // Near-miss: below minimum separation in both dimensions
    else if (horizontalViolation && verticalViolation) {
      severity = 'near-miss';
    }
    // Warning: predicted conflict or minor violation
    else {
      severity = 'warning';
    }

    return {
      aircraft1: aircraft1.id,
      aircraft2: aircraft2.id,
      horizontalDist,
      verticalDist,
      severity,
      time: 0, // Current conflict (0 = now)
    };
  }

  /**
   * Process collision consequences (mark aircraft as collided)
   */
  processCollisions(aircraft: Record<string, Aircraft>, conflicts: Conflict[]): void {
    conflicts
      .filter((c) => c.severity === 'collision')
      .forEach((conflict) => {
        const aircraft1 = aircraft[conflict.aircraft1];
        const aircraft2 = aircraft[conflict.aircraft2];

        if (aircraft1 && !aircraft1.hasCollided) {
          aircraft1.hasCollided = true;
          aircraft1.targetSpeed = 0;
        }

        if (aircraft2 && !aircraft2.hasCollided) {
          aircraft2.hasCollided = true;
          aircraft2.targetSpeed = 0;
        }
      });
  }

  /**
   * Process crash consequences (mark aircraft as crashing with animation state)
   */
  processCrashes(
    crashes: Array<{ aircraft1: Aircraft; aircraft2: Aircraft }>,
    currentTime: number
  ): void {
    crashes.forEach(({ aircraft1, aircraft2 }) => {
      if (!aircraft1.isCrashing) {
        aircraft1.isCrashing = true;
        aircraft1.crashTime = currentTime;
        aircraft1.crashPosition = { ...aircraft1.position };
        aircraft1.targetSpeed = 0;
      }

      if (!aircraft2.isCrashing) {
        aircraft2.isCrashing = true;
        aircraft2.crashTime = currentTime;
        aircraft2.crashPosition = { ...aircraft2.position };
        aircraft2.targetSpeed = 0;
      }
    });
  }

  /**
   * Check if this is a new conflict (not seen in previous tick)
   */
  isNewConflict(aircraft1Id: string, aircraft2Id: string): boolean {
    const key = this.getConflictKey(aircraft1Id, aircraft2Id);
    return !this.previousConflicts.has(key);
  }

  private getConflictKey(aircraft1: string, aircraft2: string): string {
    // Always use same order for consistency
    return aircraft1 < aircraft2
      ? `${aircraft1}-${aircraft2}`
      : `${aircraft2}-${aircraft1}`;
  }
}
