import { WeatherCell, WeatherType, Bounds, Aircraft, GameEvent, POINTS } from 'shared';
import { randomBytes } from 'crypto';

export class WeatherSystem {
  private weatherCells: WeatherCell[] = [];
  private lastWeatherSpawn = 0;
  private weatherSpawnInterval = 120000; // 2 minutes between weather spawns

  /**
   * Update weather cells - move them, check for dissipation, spawn new cells
   */
  update(deltaTime: number, gameTime: number, bounds: Bounds): WeatherCell[] {
    // Move existing weather cells
    this.weatherCells.forEach((cell) => {
      cell.position.x += cell.movement.x * deltaTime;
      cell.position.y += cell.movement.y * deltaTime;
    });

    // Remove expired weather cells
    const now = Date.now();
    this.weatherCells = this.weatherCells.filter((cell) => cell.expiresAt > now);

    // Remove weather cells that left the airspace
    this.weatherCells = this.weatherCells.filter((cell) =>
      cell.position.x >= bounds.minX - 5 &&
      cell.position.x <= bounds.maxX + 5 &&
      cell.position.y >= bounds.minY - 5 &&
      cell.position.y <= bounds.maxY + 5
    );

    // Spawn new weather cells periodically
    if (gameTime - this.lastWeatherSpawn > this.weatherSpawnInterval) {
      this.spawnWeatherCell(bounds);
      this.lastWeatherSpawn = gameTime;
    }

    return this.weatherCells;
  }

  /**
   * Spawn a new weather cell at a random edge of the airspace
   */
  private spawnWeatherCell(bounds: Bounds): void {
    const types: WeatherType[] = ['cloud', 'storm', 'turbulence'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn at random edge
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let position = { x: 0, y: 0 };
    let movement = { x: 0, y: 0 };

    const movementSpeed = 0.5; // NM per second

    switch (edge) {
      case 0: // Top edge
        position = { x: Math.random() * (bounds.maxX - bounds.minX) + bounds.minX, y: bounds.maxY };
        movement = { x: (Math.random() - 0.5) * movementSpeed, y: -movementSpeed * 0.5 }; // Move down
        break;
      case 1: // Right edge
        position = { x: bounds.maxX, y: Math.random() * (bounds.maxY - bounds.minY) + bounds.minY };
        movement = { x: -movementSpeed * 0.5, y: (Math.random() - 0.5) * movementSpeed }; // Move left
        break;
      case 2: // Bottom edge
        position = { x: Math.random() * (bounds.maxX - bounds.minX) + bounds.minX, y: bounds.minY };
        movement = { x: (Math.random() - 0.5) * movementSpeed, y: movementSpeed * 0.5 }; // Move up
        break;
      case 3: // Left edge
        position = { x: bounds.minX, y: Math.random() * (bounds.maxY - bounds.minY) + bounds.minY };
        movement = { x: movementSpeed * 0.5, y: (Math.random() - 0.5) * movementSpeed }; // Move right
        break;
    }

    // Weather cell properties based on type
    let radius = 5; // Default 5 NM
    let intensity = 0.5;
    let duration = 180000; // 3 minutes default

    switch (type) {
      case 'cloud':
        radius = 8;
        intensity = 0.4;
        duration = 300000; // 5 minutes
        break;
      case 'storm':
        radius = 6;
        intensity = 0.8;
        duration = 240000; // 4 minutes
        break;
      case 'turbulence':
        radius = 4;
        intensity = 0.6;
        duration = 120000; // 2 minutes
        break;
    }

    const cell: WeatherCell = {
      id: `weather_${randomBytes(4).toString('hex')}`,
      type,
      position,
      radius,
      intensity,
      movement,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };

    this.weatherCells.push(cell);
    console.log(`[WeatherSystem] Spawned ${type} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
  }

  /**
   * Check if an aircraft is inside a weather cell
   */
  checkAircraftInWeather(aircraft: Aircraft[], weatherCells: WeatherCell[]): {
    events: GameEvent[];
    affectedAircraft: Set<string>;
  } {
    const events: GameEvent[] = [];
    const affectedAircraft = new Set<string>();

    weatherCells.forEach((cell) => {
      aircraft.forEach((ac) => {
        const distance = Math.sqrt(
          Math.pow(ac.position.x - cell.position.x, 2) +
          Math.pow(ac.position.y - cell.position.y, 2)
        );

        if (distance <= cell.radius) {
          affectedAircraft.add(ac.id);

          // Only storms cause damage/penalties
          if (cell.type === 'storm') {
            events.push({
              id: `event_${randomBytes(4).toString('hex')}`,
              type: 'emergency',
              message: `${ac.callsign} entered storm cell - risk of damage!`,
              timestamp: Date.now(),
              severity: 'warning',
              aircraftIds: [ac.id],
            });
          }
        }
      });
    });

    return { events, affectedAircraft };
  }

  /**
   * Get all weather cells
   */
  getWeatherCells(): WeatherCell[] {
    return this.weatherCells;
  }

  /**
   * Get removed weather cell IDs (for delta updates)
   */
  getRemovedWeatherIds(previousCells: WeatherCell[]): string[] {
    const currentIds = new Set(this.weatherCells.map((c) => c.id));
    return previousCells.filter((c) => !currentIds.has(c.id)).map((c) => c.id);
  }
}
