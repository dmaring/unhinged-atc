import { useEffect, useState } from 'react';
import { GameEndData } from 'shared';
import styles from './GameEndModal.module.css';

interface GameEndModalProps {
  gameEndData: GameEndData | null;
  countdown: number; // seconds remaining
}

export function GameEndModal({ gameEndData, countdown }: GameEndModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (gameEndData) {
      // Trigger fade-in animation
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
    }
  }, [gameEndData]);

  if (!gameEndData) return null;

  const reasonText = gameEndData.reason === 'crash' ? 'CRASH DETECTED' : 'TIME LIMIT REACHED';
  const reasonIcon = gameEndData.reason === 'crash' ? '💥' : '⏰';

  return (
    <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.icon}>{reasonIcon}</span>
          <span className={styles.title}>GAME OVER</span>
          <span className={styles.icon}>{reasonIcon}</span>
        </div>

        <div className={styles.content}>
          <div className={styles.reason}>
            {reasonText}
          </div>

          <div className={styles.funnyMessage}>
            "{gameEndData.funnyMessage}"
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>FINAL SCORE</div>
              <div className={styles.statValue}>{gameEndData.finalScore}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>PLANES CLEARED</div>
              <div className={styles.statValue}>{gameEndData.planesCleared}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>SUCCESSFUL LANDINGS</div>
              <div className={styles.statValue}>{gameEndData.successfulLandings}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>CRASHES</div>
              <div className={styles.statValue}>{gameEndData.crashCount}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>GAME DURATION</div>
              <div className={styles.statValue}>
                {Math.floor(gameEndData.gameDuration / 60)}:{String(Math.floor(gameEndData.gameDuration % 60)).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className={styles.countdown}>
            <div className={styles.countdownLabel}>Returning to login in</div>
            <div className={styles.countdownValue}>{countdown}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
