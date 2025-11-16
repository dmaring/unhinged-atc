import { useState } from 'react';
import { Aircraft } from 'shared';
import styles from './ControlPanel.module.css';

interface ControlPanelProps {
  selectedAircraft: Aircraft | null;
  onCommand: (aircraftId: string, commandType: string, params: any) => void;
}

export function ControlPanel({ selectedAircraft, onCommand }: ControlPanelProps) {
  const [heading, setHeading] = useState('');
  const [altitude, setAltitude] = useState('');
  const [speed, setSpeed] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleTurnLeft = () => {
    if (!selectedAircraft) return;
    const newHeading = (selectedAircraft.targetHeading - 10 + 360) % 360;
    onCommand(selectedAircraft.id, 'turn', { heading: newHeading });
  };

  const handleTurnRight = () => {
    if (!selectedAircraft) return;
    const newHeading = (selectedAircraft.targetHeading + 10) % 360;
    onCommand(selectedAircraft.id, 'turn', { heading: newHeading });
  };

  const handleClimb = () => {
    if (!selectedAircraft) return;
    const newAltitude = Math.min(45000, selectedAircraft.targetAltitude + 1000);
    onCommand(selectedAircraft.id, 'climb', { altitude: newAltitude });
  };

  const handleDescend = () => {
    if (!selectedAircraft) return;
    const newAltitude = Math.max(0, selectedAircraft.targetAltitude - 1000);
    onCommand(selectedAircraft.id, 'descend', { altitude: newAltitude });
  };

  const handleSetHeading = () => {
    if (!selectedAircraft || !heading) return;
    const hdg = parseInt(heading);
    if (isNaN(hdg) || hdg < 0 || hdg > 360) return;
    onCommand(selectedAircraft.id, 'turn', { heading: hdg });
    setHeading('');
  };

  const handleSetAltitude = () => {
    if (!selectedAircraft || !altitude) return;
    const alt = parseInt(altitude);
    if (isNaN(alt) || alt < 0 || alt > 45000) return;

    if (alt > selectedAircraft.altitude) {
      onCommand(selectedAircraft.id, 'climb', { altitude: alt });
    } else if (alt < selectedAircraft.altitude) {
      onCommand(selectedAircraft.id, 'descend', { altitude: alt });
    }
    setAltitude('');
  };

  const handleSetSpeed = () => {
    if (!selectedAircraft || !speed) return;
    const spd = parseInt(speed);
    if (isNaN(spd)) return;
    onCommand(selectedAircraft.id, 'speed', { speed: spd });
    setSpeed('');
  };

  if (!selectedAircraft) {
    return (
      <div className={`${styles.panel} ${isCollapsed ? styles.collapsed : ''}`}>
        <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className={styles.title}>CONTROL PANEL</div>
          <button className={styles.collapseButton}>
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
        {!isCollapsed && (
          <div className={styles.noSelection}>
            <p>SELECT AN AIRCRAFT</p>
            <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '8px' }}>
              Click on a plane to control it
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.title}>CONTROL PANEL</div>
        <button className={styles.collapseButton}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className={styles.section}>
            <div className={styles.aircraftInfo}>
              <div className={styles.callsign}>{selectedAircraft.callsign}</div>
              <div className={styles.type}>{selectedAircraft.type}</div>
            </div>

            <div className={styles.dataLine}>
              <span>ALT:</span> <span className={styles.value}>{Math.round(selectedAircraft.altitude)} ft → {Math.round(selectedAircraft.targetAltitude)} ft</span>
            </div>
            <div className={styles.dataLine}>
              <span>HDG:</span> <span className={styles.value}>{Math.round(selectedAircraft.heading)}° → {Math.round(selectedAircraft.targetHeading)}°</span>
            </div>
            <div className={styles.dataLine}>
              <span>SPD:</span> <span className={styles.value}>{Math.round(selectedAircraft.speed)} kts → {Math.round(selectedAircraft.targetSpeed)} kts</span>
            </div>
            <div className={styles.dataLine}>
              <span>FUEL:</span> <span className={styles.value}>{Math.round(selectedAircraft.fuel)}%</span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>QUICK COMMANDS</div>
            <div className={styles.buttonGrid}>
              <button onClick={handleTurnLeft}>⬅ LEFT 10°</button>
              <button onClick={handleTurnRight}>⮕ RIGHT 10°</button>
              <button onClick={handleClimb}>⬆ CLIMB 1000ft</button>
              <button onClick={handleDescend}>⬇ DESCEND 1000ft</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>PRECISE CONTROL</div>

            <div className={styles.inputGroup}>
              <label>Heading (0-360°)</label>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  placeholder="270"
                  min="0"
                  max="360"
                />
                <button onClick={handleSetHeading}>SET</button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Altitude (ft)</label>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  value={altitude}
                  onChange={(e) => setAltitude(e.target.value)}
                  placeholder="25000"
                  min="0"
                  max="45000"
                />
                <button onClick={handleSetAltitude}>SET</button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Speed (kts)</label>
              <div className={styles.inputRow}>
                <input
                  type="number"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  placeholder="350"
                />
                <button onClick={handleSetSpeed}>SET</button>
              </div>
            </div>
          </div>

          {selectedAircraft.emergencyType && (
            <div className={styles.emergency}>
              ⚠️ EMERGENCY: {selectedAircraft.emergencyType.toUpperCase()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
