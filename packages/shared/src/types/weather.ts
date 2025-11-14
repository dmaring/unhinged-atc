// Weather-related types

import { Position } from './aircraft.js';

export type WeatherType = 'cloud' | 'storm' | 'turbulence';

export interface WeatherCell {
  id: string;
  type: WeatherType;
  position: Position;
  radius: number; // Nautical miles
  intensity: number; // 0-1, affects visual opacity and gameplay impact
  movement: Position; // Velocity vector (NM per second)
  createdAt: number; // Timestamp
  expiresAt: number; // Timestamp when this cell will dissipate
}
