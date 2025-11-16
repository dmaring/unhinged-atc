import styles from './GameFullScreen.module.css';

interface GameFullScreenProps {
  message: string;
  activePlayerCount: number;
  onRetry: () => void;
}

export function GameFullScreen({ message, activePlayerCount, onRetry }: GameFullScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.fullBox}>
        <div className={styles.header}>
          <div className={styles.title}>UNHINGED ATC</div>
          <div className={styles.subtitle}>AIRSPACE AT CAPACITY</div>
        </div>

        <div className={styles.content}>
          <div className={styles.statusSection}>
            <div className={styles.errorIcon}>⚠</div>
            <div className={styles.errorTitle}>GAME FULL</div>
          </div>

          <div className={styles.messageBox}>
            <div className={styles.message}>{message}</div>
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>ACTIVE CONTROLLERS</div>
              <div className={styles.statValue}>{activePlayerCount} / 5</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>QUEUE STATUS</div>
              <div className={styles.statValue}>FULL</div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>Maximum of 5 active controllers allowed</span>
            </div>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>Queue is at maximum capacity (20 players)</span>
            </div>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>Please try again later when slots become available</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button onClick={onRetry} className={styles.retryButton}>
              {'>'} RETURN TO LOGIN
            </button>
          </div>
        </div>
      </div>
      <div className={styles.scanline}></div>
    </div>
  );
}
