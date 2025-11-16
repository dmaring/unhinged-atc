import ReactGA from 'react-ga4';

const isProduction = import.meta.env.PROD;
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Initialize Google Analytics 4
export const initGA = () => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.initialize(measurementId, {
      gaOptions: {
        anonymize_ip: true, // GDPR compliance
      },
    });
    console.log('[Analytics] Google Analytics initialized');
  } else {
    console.log('[Analytics] Skipped - not in production or no valid measurement ID');
  }
};

// Track custom events
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  }
};

// Track page views (useful for hash-based routing)
export const trackPageView = (path: string) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.send({ hitType: 'pageview', page: path });
  }
};

// Track game ended event with custom dimensions
export const trackGameEnded = (data: {
  reason: string;
  finalScore: number;
  planesCleared: number;
  crashCount: number;
  duration: number;
  roomId: string;
  controllerCount: number;
}) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('game_ended', {
      game_end_reason: data.reason,
      score: data.finalScore,
      planes_cleared: data.planesCleared,
      crashes: data.crashCount,
      game_duration: data.duration,
      room_id: data.roomId,
      controller_count: data.controllerCount,
    });
  }
};

// Track user login
export const trackUserLogin = (username: string) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('login', {
      method: 'email',
      username_length: username.length, // Don't send actual username for privacy
    });
  }
};

// Track crash event
export const trackCrash = (data: {
  aircraftCount: number;
  roomId: string;
  controllerCount: number;
}) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('aircraft_crash', {
      aircraft_count: data.aircraftCount,
      room_id: data.roomId,
      controller_count: data.controllerCount,
    });
  }
};

// Track chaos ability usage
export const trackChaosUsed = (chaosType: string) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('chaos_used', {
      chaos_type: chaosType,
    });
  }
};

// Track queue events
export const trackQueueJoined = (position: number, totalInQueue: number) => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('queue_joined', {
      queue_position: position,
      total_in_queue: totalInQueue,
    });
  }
};

export const trackQueuePromoted = () => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('queue_promoted');
  }
};

// Track aircraft commands
export const trackAircraftCommand = (commandType: 'turn' | 'altitude' | 'speed') => {
  if (isProduction && measurementId && measurementId !== 'G-XXXXXXXXXX') {
    ReactGA.event('aircraft_command', {
      command_type: commandType,
    });
  }
};
