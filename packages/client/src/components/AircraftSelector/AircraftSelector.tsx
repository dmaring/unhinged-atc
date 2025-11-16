import { Aircraft } from 'shared';
import styles from './AircraftSelector.module.css';

interface AircraftSelectorProps {
  aircraft: Aircraft[];
  selectedAircraftId: string | null;
  onAircraftSelect: (id: string) => void;
}

export function AircraftSelector({
  aircraft,
  selectedAircraftId,
  onAircraftSelect,
}: AircraftSelectorProps) {
  const handlePrevious = () => {
    if (aircraft.length === 0) return;

    const currentIndex = aircraft.findIndex(ac => ac.id === selectedAircraftId);
    if (currentIndex === -1) {
      // No selection, select first aircraft
      onAircraftSelect(aircraft[0].id);
    } else {
      // Select previous, wrap around to end
      const prevIndex = (currentIndex - 1 + aircraft.length) % aircraft.length;
      onAircraftSelect(aircraft[prevIndex].id);
    }
  };

  const handleNext = () => {
    if (aircraft.length === 0) return;

    const currentIndex = aircraft.findIndex(ac => ac.id === selectedAircraftId);
    if (currentIndex === -1) {
      // No selection, select first aircraft
      onAircraftSelect(aircraft[0].id);
    } else {
      // Select next, wrap around to start
      const nextIndex = (currentIndex + 1) % aircraft.length;
      onAircraftSelect(aircraft[nextIndex].id);
    }
  };

  const currentIndex = aircraft.findIndex(ac => ac.id === selectedAircraftId);
  const displayIndex = currentIndex === -1 ? 0 : currentIndex + 1;

  if (aircraft.length === 0) {
    return null;
  }

  return (
    <div className={styles.selector}>
      <button
        className={styles.navButton}
        onClick={handlePrevious}
        aria-label="Previous aircraft"
      >
        ◀
      </button>
      <div className={styles.info}>
        <div className={styles.counter}>
          {displayIndex} / {aircraft.length}
        </div>
        {selectedAircraftId && (
          <div className={styles.callsign}>
            {aircraft.find(ac => ac.id === selectedAircraftId)?.callsign || 'NONE'}
          </div>
        )}
      </div>
      <button
        className={styles.navButton}
        onClick={handleNext}
        aria-label="Next aircraft"
      >
        ▶
      </button>
    </div>
  );
}
