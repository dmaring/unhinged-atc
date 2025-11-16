/**
 * Structured logging utility for player tracking and server events
 * Logs are formatted as JSON for easy parsing by GCP Cloud Logging
 */

export interface PlayerEventLog {
  event: 'player_joined' | 'player_queued' | 'player_disconnected' | 'player_promoted' | 'player_rejected';
  timestamp: string;
  username: string;
  email: string;
  socketId: string;
  roomId: string;
  ip?: string;
  userAgent?: string;
  queuePosition?: number;
  duration?: number; // session duration in ms
  commandsIssued?: number;
  score?: number;
  reason?: string; // for rejections/disconnections
}

export interface GameEventLog {
  event: 'game_started' | 'game_ended' | 'crash' | 'landing';
  timestamp: string;
  roomId: string;
  details: Record<string, any>;
}

export class Logger {
  /**
   * Log player events with structured data
   */
  static logPlayer(data: PlayerEventLog): void {
    console.log(JSON.stringify({
      ...data,
      logType: 'player_event',
      timestamp: data.timestamp || new Date().toISOString(),
    }));
  }

  /**
   * Log game events with structured data
   */
  static logGame(data: GameEventLog): void {
    console.log(JSON.stringify({
      ...data,
      logType: 'game_event',
      timestamp: data.timestamp || new Date().toISOString(),
    }));
  }

  /**
   * Log general server info (keeps existing console.log format for non-critical logs)
   */
  static info(message: string, metadata?: Record<string, any>): void {
    if (metadata) {
      console.log(JSON.stringify({
        logType: 'server_info',
        timestamp: new Date().toISOString(),
        message,
        ...metadata,
      }));
    } else {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  /**
   * Log errors with structured data
   */
  static error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(JSON.stringify({
      logType: 'server_error',
      timestamp: new Date().toISOString(),
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      ...metadata,
    }));
  }

  /**
   * Log security events (rate limiting, profanity, etc.)
   */
  static security(event: string, details: Record<string, any>): void {
    console.warn(JSON.stringify({
      logType: 'security_event',
      timestamp: new Date().toISOString(),
      event,
      ...details,
    }));
  }
}
