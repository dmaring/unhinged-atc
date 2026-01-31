import { describe, it, expect, beforeEach } from 'vitest';
import { AircraftPhysics } from './AircraftPhysics.js';
import { Aircraft, AIRCRAFT_TYPES } from 'shared';

/**
 * Helper to create a test aircraft with sensible defaults.
 */
function createTestAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  const type = 'B738' as const;
  const perfData = AIRCRAFT_TYPES[type];

  return {
    id: 'test-aircraft-1',
    callsign: 'TST001',
    type,
    position: { x: 0, y: 0 },
    altitude: 10000,
    heading: 90,
    speed: 250,
    targetAltitude: 10000,
    targetHeading: 90,
    targetSpeed: 250,
    turnRate: perfData.turnRate,
    climbRate: perfData.climbRate,
    acceleration: perfData.acceleration,
    fuel: 80,
    trailHistory: [],
    isLanded: false,
    hasCollided: false,
    ...overrides,
  } as Aircraft;
}

describe('AircraftPhysics - Bug Fix Regression Tests', () => {
  let physics: AircraftPhysics;

  beforeEach(() => {
    physics = new AircraftPhysics();
  });

  // =========================================================================
  // BUG-007: Division by Zero / Invalid Input Guard
  // Verifies that updatePosition guards against deltaTime <= 0 and
  // negative speed to prevent NaN propagation through the physics system.
  // =========================================================================
  describe('BUG-007: Physics input validation', () => {
    it('should not move aircraft when deltaTime is zero', () => {
      const aircraft = createTestAircraft({
        position: { x: 5, y: 5 },
        speed: 250,
        heading: 90,
      });

      const originalX = aircraft.position.x;
      const originalY = aircraft.position.y;

      physics.update(aircraft, 0);

      expect(aircraft.position.x).toBe(originalX);
      expect(aircraft.position.y).toBe(originalY);
    });

    it('should not move aircraft when deltaTime is negative', () => {
      const aircraft = createTestAircraft({
        position: { x: 5, y: 5 },
        speed: 250,
        heading: 90,
      });

      const originalX = aircraft.position.x;
      const originalY = aircraft.position.y;

      physics.update(aircraft, -1);

      expect(aircraft.position.x).toBe(originalX);
      expect(aircraft.position.y).toBe(originalY);
    });

    it('should not produce NaN with negative speed', () => {
      const aircraft = createTestAircraft({
        position: { x: 5, y: 5 },
        speed: -100,
        heading: 90,
      });

      physics.update(aircraft, 1 / 60);

      expect(Number.isFinite(aircraft.position.x)).toBe(true);
      expect(Number.isFinite(aircraft.position.y)).toBe(true);
    });

    it('should move aircraft with valid positive deltaTime', () => {
      const aircraft = createTestAircraft({
        position: { x: 0, y: 0 },
        speed: 250,
        heading: 90, // East
        targetHeading: 90,
      });

      const originalX = aircraft.position.x;
      physics.update(aircraft, 1 / 60);

      // Aircraft should have moved east (positive x)
      expect(aircraft.position.x).not.toBe(originalX);
      expect(Number.isFinite(aircraft.position.x)).toBe(true);
      expect(Number.isFinite(aircraft.position.y)).toBe(true);
    });

    it('should produce finite positions after many update cycles', () => {
      const aircraft = createTestAircraft({
        position: { x: 0, y: 0 },
        speed: 450,
        heading: 45,
        targetHeading: 270,
      });

      // Run 600 updates (10 seconds at 60 FPS)
      for (let i = 0; i < 600; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(Number.isFinite(aircraft.position.x)).toBe(true);
      expect(Number.isFinite(aircraft.position.y)).toBe(true);
      expect(Number.isFinite(aircraft.altitude)).toBe(true);
      expect(Number.isFinite(aircraft.speed)).toBe(true);
      expect(Number.isFinite(aircraft.heading)).toBe(true);
    });
  });

  // =========================================================================
  // BUG-009: Ring Buffer Trail History
  // Verifies that trail history uses a ring buffer pattern (O(1) overwrites)
  // instead of shift/push (O(n) operations), preventing array churn in the
  // 60 FPS game loop.
  // =========================================================================
  describe('BUG-009: Ring buffer trail history', () => {
    it('should initialize trail history on first update', () => {
      const aircraft = createTestAircraft({
        trailHistory: [],
      });

      physics.update(aircraft, 1 / 60);

      expect(aircraft.trailHistory).toBeDefined();
      expect(aircraft.trailHistory.length).toBe(30); // Pre-allocated ring buffer
    });

    it('should not grow trail beyond max length', () => {
      const aircraft = createTestAircraft();

      // Run 100 updates (well beyond the 30-entry max trail)
      for (let i = 0; i < 100; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.trailHistory.length).toBe(30);
    });

    it('should maintain fixed array length (ring buffer pattern)', () => {
      const aircraft = createTestAircraft();

      // First update initializes the ring buffer
      physics.update(aircraft, 1 / 60);
      const initialLength = aircraft.trailHistory.length;

      // Many more updates
      for (let i = 0; i < 200; i++) {
        physics.update(aircraft, 1 / 60);
      }

      // Length should remain constant (ring buffer overwrites, doesn't grow)
      expect(aircraft.trailHistory.length).toBe(initialLength);
    });

    it('should record position data in trail entries', () => {
      const aircraft = createTestAircraft({
        position: { x: 10, y: 20 },
      });

      physics.update(aircraft, 1 / 60);

      // At least one entry should have position data
      const hasValidEntry = aircraft.trailHistory.some(
        (entry) => entry && typeof entry.x === 'number' && typeof entry.y === 'number'
      );
      expect(hasValidEntry).toBe(true);
    });

    it('should use trailIndex for ring buffer writes', () => {
      const aircraft = createTestAircraft();

      // First update sets trailIndex to 1 (wrote at index 0, then incremented)
      physics.update(aircraft, 1 / 60);
      expect((aircraft as any).trailIndex).toBe(1);

      // After 30 updates, index should wrap around to 0
      for (let i = 0; i < 29; i++) {
        physics.update(aircraft, 1 / 60);
      }
      expect((aircraft as any).trailIndex).toBe(0); // Wrapped around
    });
  });

  // =========================================================================
  // General physics correctness tests
  // =========================================================================
  describe('Physics correctness', () => {
    it('should turn aircraft toward target heading', () => {
      const aircraft = createTestAircraft({
        heading: 0,
        targetHeading: 90,
      });

      // Run several updates
      for (let i = 0; i < 120; i++) {
        physics.update(aircraft, 1 / 60);
      }

      // Heading should have moved toward 90
      expect(aircraft.heading).toBeGreaterThan(0);
    });

    it('should take shortest turn path', () => {
      const aircraft = createTestAircraft({
        heading: 350,
        targetHeading: 10,
      });

      // First update: should turn right (through 360/0) not left
      physics.update(aircraft, 1 / 60);

      // Heading should have increased (turning right through 360)
      // or wrapped to near 360/0
      const headingDiff = aircraft.heading - 350;
      expect(headingDiff >= 0 || aircraft.heading < 20).toBe(true);
    });

    it('should climb aircraft toward target altitude', () => {
      const aircraft = createTestAircraft({
        altitude: 5000,
        targetAltitude: 15000,
      });

      for (let i = 0; i < 300; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.altitude).toBeGreaterThan(5000);
    });

    it('should accelerate aircraft toward target speed', () => {
      const aircraft = createTestAircraft({
        speed: 200,
        targetSpeed: 350,
      });

      for (let i = 0; i < 300; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.speed).toBeGreaterThan(200);
    });

    it('should enforce aircraft speed limits', () => {
      const perfData = AIRCRAFT_TYPES['B738'];
      const aircraft = createTestAircraft({
        speed: perfData.maxSpeed,
        targetSpeed: perfData.maxSpeed + 200,
      });

      for (let i = 0; i < 300; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.speed).toBeLessThanOrEqual(perfData.maxSpeed);
    });

    it('should decrease fuel over time', () => {
      const aircraft = createTestAircraft({
        fuel: 80,
      });

      for (let i = 0; i < 600; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.fuel).toBeLessThan(80);
      expect(aircraft.fuel).toBeGreaterThanOrEqual(0);
    });

    it('should clamp fuel to 0 minimum', () => {
      const aircraft = createTestAircraft({
        fuel: 0.001,
        speed: 450,
        altitude: 5000, // Low altitude = higher fuel burn
      });

      for (let i = 0; i < 600; i++) {
        physics.update(aircraft, 1 / 60);
      }

      expect(aircraft.fuel).toBe(0);
    });

    it('should check bounds correctly', () => {
      const bounds = { minX: -25, maxX: 25, minY: -25, maxY: 25 };

      const inBounds = createTestAircraft({ position: { x: 0, y: 0 } });
      expect(physics.isInBounds(inBounds, bounds)).toBe(true);

      const outOfBounds = createTestAircraft({ position: { x: 30, y: 0 } });
      expect(physics.isInBounds(outOfBounds, bounds)).toBe(false);

      const onBoundary = createTestAircraft({ position: { x: 25, y: -25 } });
      expect(physics.isInBounds(onBoundary, bounds)).toBe(true);
    });

    it('should calculate distance correctly', () => {
      const distance = physics.getDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
      expect(distance).toBeCloseTo(5, 5);
    });

    it('should respect time scale setting', () => {
      physics.setTimeScale(1);
      expect(physics.getTimeScale()).toBe(1);

      const aircraft1 = createTestAircraft({ position: { x: 0, y: 0 }, heading: 90, targetHeading: 90 });
      physics.update(aircraft1, 1);
      const distance1 = Math.abs(aircraft1.position.x);

      physics.setTimeScale(3);
      expect(physics.getTimeScale()).toBe(3);

      const aircraft2 = createTestAircraft({ position: { x: 0, y: 0 }, heading: 90, targetHeading: 90 });
      physics.update(aircraft2, 1);
      const distance2 = Math.abs(aircraft2.position.x);

      // 3x time scale should move roughly 3x the distance
      expect(distance2).toBeGreaterThan(distance1 * 2.5);
    });

    it('should clamp time scale to valid range', () => {
      physics.setTimeScale(0);
      expect(physics.getTimeScale()).toBe(1); // Minimum

      physics.setTimeScale(100);
      expect(physics.getTimeScale()).toBe(30); // Maximum
    });
  });
});
