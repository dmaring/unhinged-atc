import { useEffect, useState } from 'react';
import styles from './QueueScreen.module.css';

interface QueueScreenProps {
  position: number;
  totalInQueue: number;
  activePlayerCount: number;
}

export function QueueScreen({ position, totalInQueue, activePlayerCount }: QueueScreenProps) {
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.queueBox}>
        <div className={styles.header}>
          <div className={styles.title}>UNHINGED ATC</div>
          <div className={styles.subtitle}>QUEUE STATUS</div>
        </div>

        <div className={styles.content}>
          <div className={styles.statusSection}>
            <div className={styles.statusLine}>
              <span className={styles.prompt}>{'>'}</span>
              <span className={styles.text}>WAITING FOR CLEARANCE{dots}</span>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>YOUR POSITION</div>
              <div className={styles.statValue}>{position}</div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>TOTAL IN QUEUE</div>
              <div className={styles.statValue}>{totalInQueue}</div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>ACTIVE CONTROLLERS</div>
              <div className={styles.statValue}>{activePlayerCount} / 5</div>
            </div>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>You will automatically enter when a slot opens</span>
            </div>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>Keep this window open to maintain your position</span>
            </div>
            <div className={styles.infoLine}>
              <span className={styles.bullet}>•</span>
              <span>Your position will update as players join or leave</span>
            </div>
          </div>

          <div className={styles.waitingAnimation}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} />
            </div>
            <div className={styles.waitingText}>
              Monitoring airspace traffic{dots}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.scanline}></div>
    </div>
  );
}
