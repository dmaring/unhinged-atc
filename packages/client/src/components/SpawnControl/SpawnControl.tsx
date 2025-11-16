import { useState } from 'react';
import styles from './SpawnControl.module.css';

interface SpawnControlProps {
  onSpawnAircraft: (count: number) => void;
}

export function SpawnControl({ onSpawnAircraft }: SpawnControlProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.title}>AIRCRAFT SPAWNING</div>
        <button className={styles.collapseButton}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className={styles.content}>
          <div className={styles.description}>
            Manually spawn aircraft at random airspace entry points
          </div>
          <div className={styles.buttonGrid}>
            <button
              className={styles.spawnButton}
              onClick={() => onSpawnAircraft(1)}
            >
              ✈ SPAWN 1
            </button>
            <button
              className={styles.spawnButton}
              onClick={() => onSpawnAircraft(3)}
            >
              ✈✈✈ SPAWN 3
            </button>
            <button
              className={`${styles.spawnButton} ${styles.chaosButton}`}
              onClick={() => onSpawnAircraft(20)}
            >
              🌪️ AIRCRAFT APOCALYPSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
