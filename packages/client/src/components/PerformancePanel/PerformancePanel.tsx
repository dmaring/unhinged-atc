import { useState } from 'react';
import styles from './PerformancePanel.module.css';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { isMobileDevice } from '../../utils/deviceDetection';

export function PerformancePanel() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { metrics, settings, setBatteryMode } = usePerformanceMonitor(true);

  // Only show on mobile devices
  if (!isMobileDevice()) {
    return null;
  }

  return (
    <div className={`${styles.panel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.title}>
          PERFORMANCE {metrics.isLowPerformance && '⚠️'}
        </div>
        <button className={styles.collapseButton} aria-label="Toggle performance panel">
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className={styles.content}>
          <div className={styles.metrics}>
            <div className={styles.metricRow}>
              <span className={styles.label}>FPS:</span>
              <span className={`${styles.value} ${metrics.isLowPerformance ? styles.warning : ''}`}>
                {metrics.fps}
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.label}>Avg FPS:</span>
              <span className={`${styles.value} ${metrics.isLowPerformance ? styles.warning : ''}`}>
                {metrics.avgFps}
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.label}>Frame Time:</span>
              <span className={styles.value}>
                {metrics.frameTime.toFixed(2)}ms
              </span>
            </div>
          </div>

          <div className={styles.controls}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.batteryMode}
                onChange={(e) => setBatteryMode(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Battery Saver Mode (30 FPS)</span>
            </label>
            {metrics.isLowPerformance && (
              <div className={styles.suggestion}>
                Low FPS detected. Consider enabling Battery Saver Mode.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
