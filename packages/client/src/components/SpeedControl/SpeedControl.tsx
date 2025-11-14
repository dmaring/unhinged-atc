import { useState } from 'react';
import styles from './SpeedControl.module.css';

interface SpeedControlProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export function SpeedControl({ currentSpeed, onSpeedChange }: SpeedControlProps) {
  const [speed, setSpeed] = useState(currentSpeed);

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const presetSpeeds = [1, 5, 10, 15, 20, 30];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>SIMULATION SPEED</div>
        <div className={styles.currentSpeed}>{speed}x</div>
      </div>

      <div className={styles.controls}>
        {/* Preset buttons */}
        <div className={styles.presets}>
          {presetSpeeds.map((presetSpeed) => (
            <button
              key={presetSpeed}
              className={`${styles.presetButton} ${
                speed === presetSpeed ? styles.active : ''
              }`}
              onClick={() => handleSpeedChange(presetSpeed)}
            >
              {presetSpeed}x
            </button>
          ))}
        </div>

        {/* Fine control */}
        <div className={styles.fineControl}>
          <button
            className={styles.adjustButton}
            onClick={() => handleSpeedChange(Math.max(1, speed - 1))}
            disabled={speed <= 1}
          >
            -
          </button>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
            className={styles.slider}
          />
          <button
            className={styles.adjustButton}
            onClick={() => handleSpeedChange(Math.min(30, speed + 1))}
            disabled={speed >= 30}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
