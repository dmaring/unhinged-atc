import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { GAME_CONFIG } from 'shared';
import styles from './PlayersPanel.module.css';

export function PlayersPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const controllers = useGameStore((state) => state.gameState?.controllers);
  const queueInfo = useGameStore((state) => state.queueInfo);

  // Convert controllers object to array and sort by join time
  const controllerList = controllers
    ? Object.values(controllers).sort((a, b) => a.joinedAt - b.joinedAt)
    : [];

  const activeCount = controllerList.length;
  const maxControllers = GAME_CONFIG.MAX_CONTROLLERS_PER_ROOM;
  const queueCount = queueInfo?.count ?? 0;

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.title}>
          CONTROLLERS ({activeCount}/{maxControllers})
        </div>
        <button className={styles.collapseButton}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className={styles.content}>
          {controllerList.length === 0 ? (
            <div className={styles.emptyState}>
              NO ACTIVE CONTROLLERS
            </div>
          ) : (
            <>
              <div className={styles.playerList}>
                {controllerList.map((controller) => (
                  <div key={controller.id} className={styles.playerRow}>
                    <span className={styles.indicator} style={{ color: controller.color }}>●</span>
                    <span className={styles.username} style={{ color: controller.color }}>{controller.username}</span>
                  </div>
                ))}
              </div>
              {queueCount > 0 && (
                <div className={styles.queueInfo}>
                  {queueCount} in queue
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
