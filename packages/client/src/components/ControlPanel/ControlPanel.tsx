import { useState, useEffect } from 'react';
import { Aircraft } from 'shared';
import styles from './ControlPanel.module.css';
import { NumericStepper } from '../NumericStepper';
import { AircraftSelector } from '../AircraftSelector';
import { isTouchDevice } from '../../utils/deviceDetection';

interface ControlPanelProps {
  selectedAircraft: Aircraft | null;
  allAircraft?: Aircraft[];
  onCommand: (aircraftId: string, commandType: string, params: any) => void;
  onAircraftSelect?: (id: string) => void;
  readOnly?: boolean;
}

export function ControlPanel({ selectedAircraft, allAircraft = [], onCommand, onAircraftSelect, readOnly = false }: ControlPanelProps) {
  const [heading, setHeading] = useState('');
  const [altitude, setAltitude] = useState('');
  const [speed, setSpeed] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isTouch = isTouchDevice();

  // Stepper values for touch devices
  const [stepperHeading, setStepperHeading] = useState(0);
  const [stepperAltitude, setStepperAltitude] = useState(0);
  const [stepperSpeed, setStepperSpeed] = useState(0);

  // Update stepper values when aircraft changes
  useEffect(() => {
    if (selectedAircraft) {
      setStepperHeading(Math.round(selectedAircraft.targetHeading));
      setStepperAltitude(Math.round(selectedAircraft.targetAltitude));
      setStepperSpeed(Math.round(selectedAircraft.targetSpeed));
    }
  }, [selectedAircraft]);

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
    const hdg = parseInt(heading, 10);
    if (isNaN(hdg) || hdg < 0 || hdg > 360) return;
    onCommand(selectedAircraft.id, 'turn', { heading: hdg });
    setHeading('');
  };

  const handleSetAltitude = () => {
    if (!selectedAircraft || !altitude) return;
    const alt = parseInt(altitude, 10);
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
    const spd = parseInt(speed, 10);
    if (isNaN(spd)) return;
    onCommand(selectedAircraft.id, 'speed', { speed: spd });
    setSpeed('');
  };

  // Stepper handlers for touch devices
  const handleStepperHeadingSubmit = () => {
    if (!selectedAircraft) return;
    onCommand(selectedAircraft.id, 'turn', { heading: stepperHeading });
  };

  const handleStepperAltitudeSubmit = () => {
    if (!selectedAircraft) return;
    if (stepperAltitude > selectedAircraft.altitude) {
      onCommand(selectedAircraft.id, 'climb', { altitude: stepperAltitude });
    } else if (stepperAltitude < selectedAircraft.altitude) {
      onCommand(selectedAircraft.id, 'descend', { altitude: stepperAltitude });
    }
  };

  const handleStepperSpeedSubmit = () => {
    if (!selectedAircraft) return;
    onCommand(selectedAircraft.id, 'speed', { speed: stepperSpeed });
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
          {/* Aircraft selector for touch devices */}
          {isTouch && onAircraftSelect && allAircraft.length > 0 && (
            <div className={styles.section}>
              <AircraftSelector
                aircraft={allAircraft}
                selectedAircraftId={selectedAircraft.id}
                onAircraftSelect={onAircraftSelect}
              />
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.aircraftInfo}>
              <div className={styles.callsign}>{selectedAircraft.callsign}</div>
              <div className={styles.type}>{selectedAircraft.type}</div>
              {readOnly && <div style={{ color: '#FF0000', fontWeight: 'bold', marginLeft: '10px' }}>LOCKED</div>}
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
              <button onClick={handleTurnLeft} disabled={readOnly}>⬅ LEFT 10°</button>
              <button onClick={handleTurnRight} disabled={readOnly}>⮕ RIGHT 10°</button>
              <button onClick={handleClimb} disabled={readOnly}>⬆ CLIMB 1000ft</button>
              <button onClick={handleDescend} disabled={readOnly}>⬇ DESCEND 1000ft</button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>PRECISE CONTROL</div>

            {isTouch ? (
              // Touch-friendly steppers for mobile
              <>
                <NumericStepper
                  value={stepperHeading}
                  min={0}
                  max={359}
                  step={5}
                  unit="°"
                  label="Heading"
                  onChange={setStepperHeading}
                  onSubmit={handleStepperHeadingSubmit}
                />
                <NumericStepper
                  value={stepperAltitude}
                  min={0}
                  max={45000}
                  step={1000}
                  unit="ft"
                  label="Altitude"
                  onChange={setStepperAltitude}
                  onSubmit={handleStepperAltitudeSubmit}
                />
                <NumericStepper
                  value={stepperSpeed}
                  min={100}
                  max={600}
                  step={10}
                  unit="kts"
                  label="Speed"
                  onChange={setStepperSpeed}
                  onSubmit={handleStepperSpeedSubmit}
                />
                <button
                  className={styles.applyButton}
                  onClick={() => {
                    handleStepperHeadingSubmit();
                    handleStepperAltitudeSubmit();
                    handleStepperSpeedSubmit();
                  }}
                >
                  APPLY ALL
                </button>
              </>
            ) : (
              // Traditional inputs for desktop
              <>
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
                      disabled={readOnly}
                    />
                    <button onClick={handleSetHeading} disabled={readOnly}>SET</button>
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
                      disabled={readOnly}
                    />
                    <button onClick={handleSetAltitude} disabled={readOnly}>SET</button>
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
                      disabled={readOnly}
                    />
                    <button onClick={handleSetSpeed} disabled={readOnly}>SET</button>
                  </div>
                </div>
              </>
            )}
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
