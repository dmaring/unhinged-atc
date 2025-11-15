import { useState } from 'react';
import styles from './SpawnControl.module.css';

interface SpawnControlProps {
  onSpawnAircraft: () => void;
}

export function SpawnControl({ onSpawnAircraft }: SpawnControlProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
            Manually spawn a new aircraft at a random airspace entry point
          </div>
          <button className={styles.spawnButton} onClick={onSpawnAircraft}>
            ✈ SPAWN AIRCRAFT
          </button>
        </div>
      )}
    </div>
  );
}
