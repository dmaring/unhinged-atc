import { useState, useEffect } from 'react';
import { ChaosType, CHAOS_ABILITIES } from 'shared';
import styles from './ChaosPanel.module.css';

interface ChaosPanelProps {
  chaosAbilities: Record<string, { lastUsed: number; usageCount: number }>;
  onChaosCommand: (chaosType: ChaosType) => void;
}

export function ChaosPanel({ chaosAbilities, onChaosCommand }: ChaosPanelProps) {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Update cooldowns every second
  useEffect(() => {
    const updateCooldowns = () => {
      const now = Date.now();
      const newCooldowns: Record<string, number> = {};

      Object.entries(CHAOS_ABILITIES).forEach(([chaosType, config]) => {
        const state = chaosAbilities[chaosType];
        if (state && state.lastUsed > 0) {
          const timeSinceLastUse = now - state.lastUsed;
          const cooldownRemaining = config.cooldownDuration - timeSinceLastUse;
          newCooldowns[chaosType] = Math.max(0, cooldownRemaining);
        } else {
          newCooldowns[chaosType] = 0;
        }
      });

      setCooldowns(newCooldowns);
    };

    updateCooldowns();
    const interval = setInterval(updateCooldowns, 100); // Update every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [chaosAbilities]);

  const handleChaosClick = (chaosType: ChaosType) => {
    if (cooldowns[chaosType] <= 0) {
      onChaosCommand(chaosType);
    }
  };

  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return 'READY';
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>CHAOS CONTROLS</div>
        <div className={styles.subtitle}>Unhinged Mode</div>
      </div>

      <div className={styles.abilities}>
        {(Object.entries(CHAOS_ABILITIES) as Array<[ChaosType, typeof CHAOS_ABILITIES[ChaosType]]>).map(
          ([chaosType, config]) => {
            const state = chaosAbilities[chaosType];
            const cooldown = cooldowns[chaosType] || 0;
            const isReady = cooldown <= 0;
            const usageCount = state?.usageCount || 0;

            return (
              <button
                key={chaosType}
                className={`${styles.chaosButton} ${isReady ? styles.ready : styles.cooldown}`}
                onClick={() => handleChaosClick(chaosType)}
                disabled={!isReady}
              >
                <div className={styles.buttonContent}>
                  <div className={styles.chaosName}>{config.name}</div>
                  <div className={styles.chaosDescription}>{config.description}</div>
                  <div className={styles.buttonFooter}>
                    <div className={styles.cooldownText}>{formatCooldown(cooldown)}</div>
                    {usageCount > 0 && (
                      <div className={styles.usageCount}>×{usageCount}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
