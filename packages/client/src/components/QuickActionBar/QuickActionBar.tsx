import { Aircraft } from 'shared';
import styles from './QuickActionBar.module.css';
import { isMobileDevice } from '../../utils/deviceDetection';

interface QuickActionBarProps {
  selectedAircraft: Aircraft | null;
  onTurnLeft: () => void;
  onTurnRight: () => void;
  onRandomChaos: () => void;
  availableChaos: string[];
  bottomPosition?: number; // Dynamic bottom position in pixels
}

export function QuickActionBar({
  selectedAircraft,
  onTurnLeft,
  onTurnRight,
  onRandomChaos,
  availableChaos,
  bottomPosition,
}: QuickActionBarProps) {
  // Only show on mobile devices when aircraft is selected
  if (!isMobileDevice() || !selectedAircraft) {
    return null;
  }

  const hasAvailableChaos = availableChaos.length > 0;

  return (
    <div
      className={styles.container}
      style={bottomPosition ? { bottom: `${bottomPosition}px` } : undefined}
    >
      <div className={styles.callsign}>{selectedAircraft.callsign}</div>
      <div className={styles.actions}>
        <button
          className={styles.actionButton}
          onClick={onTurnLeft}
          aria-label="Turn left 10 degrees"
        >
          <span className={styles.icon}>←</span>
          <span className={styles.label}>LEFT 10°</span>
        </button>
        <button
          className={styles.actionButton}
          onClick={onTurnRight}
          aria-label="Turn right 10 degrees"
        >
          <span className={styles.icon}>→</span>
          <span className={styles.label}>RIGHT 10°</span>
        </button>
        <button
          className={`${styles.actionButton} ${styles.chaosButton}`}
          onClick={onRandomChaos}
          disabled={!hasAvailableChaos}
          aria-label="Activate random chaos"
        >
          <span className={styles.icon}>⚡</span>
          <span className={styles.label}>CHAOS</span>
        </button>
      </div>
    </div>
  );
}
