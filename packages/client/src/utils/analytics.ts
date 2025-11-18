import ReactGA from 'react-ga4';

const isProduction = import.meta.env.PROD;
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

// Check if analytics should be enabled
const shouldEnableAnalytics = () => {
  return (isProduction || enableAnalytics) && measurementId && measurementId !== 'G-XXXXXXXXXX';
};

// Initialize Google Analytics 4
export const initGA = () => {
  if (shouldEnableAnalytics()) {
    ReactGA.initialize(measurementId, {
      gaOptions: {
        anonymize_ip: true, // GDPR compliance
      },
    });
    console.log('[Analytics] Google Analytics initialized', {
      mode: isProduction ? 'production' : 'development',
      enabled: true
    });
  } else {
    console.log('[Analytics] Skipped', {
      isProduction,
      enableAnalytics,
      hasMeasurementId: !!measurementId
    });
  }
};

// Track custom events
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  if (shouldEnableAnalytics()) {
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
  if (shouldEnableAnalytics()) {
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
  if (shouldEnableAnalytics()) {
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
  if (shouldEnableAnalytics()) {
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
  if (shouldEnableAnalytics()) {
    ReactGA.event('aircraft_crash', {
      aircraft_count: data.aircraftCount,
      room_id: data.roomId,
      controller_count: data.controllerCount,
    });
  }
};

// Track chaos ability usage
export const trackChaosUsed = (chaosType: string) => {
  if (shouldEnableAnalytics()) {
    ReactGA.event('chaos_used', {
      chaos_type: chaosType,
    });
  }
};

// Track queue events
export const trackQueueJoined = (position: number, totalInQueue: number) => {
  if (shouldEnableAnalytics()) {
    ReactGA.event('queue_joined', {
      queue_position: position,
      total_in_queue: totalInQueue,
    });
  }
};

export const trackQueuePromoted = () => {
  if (shouldEnableAnalytics()) {
    ReactGA.event('queue_promoted');
  }
};

// Track aircraft commands
export const trackAircraftCommand = (commandType: 'turn' | 'altitude' | 'speed') => {
  if (shouldEnableAnalytics()) {
    ReactGA.event('aircraft_command', {
      command_type: commandType,
    });
  }
};
