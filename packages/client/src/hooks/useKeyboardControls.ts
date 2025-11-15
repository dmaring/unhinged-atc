import { useEffect } from 'react';
import { Aircraft } from 'shared';

interface UseKeyboardControlsProps {
  selectedAircraft: Aircraft | null;
  allAircraft: Aircraft[];
  onCommand: (aircraftId: string, commandType: string, params: any) => void;
  onSelectAircraft: (aircraftId: string | null) => void;
}

export function useKeyboardControls({
  selectedAircraft,
  allAircraft,
  onCommand,
  onSelectAircraft
}: UseKeyboardControlsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          // Cycle through aircraft (forward or backward based on Shift key)
          if (allAircraft.length === 0) {
            onSelectAircraft(null);
            return;
          }

          if (!selectedAircraft) {
            // No aircraft selected
            if (event.shiftKey) {
              // Shift+Tab: select the last one
              onSelectAircraft(allAircraft[allAircraft.length - 1].id);
            } else {
              // Tab: select the first one
              onSelectAircraft(allAircraft[0].id);
            }
          } else {
            // Find current aircraft index
            const currentIndex = allAircraft.findIndex(
              (aircraft) => aircraft.id === selectedAircraft.id
            );

            if (currentIndex === -1) {
              // Current aircraft not found
              if (event.shiftKey) {
                // Shift+Tab: select last
                onSelectAircraft(allAircraft[allAircraft.length - 1].id);
              } else {
                // Tab: select first
                onSelectAircraft(allAircraft[0].id);
              }
            } else {
              if (event.shiftKey) {
                // Shift+Tab: cycle backwards (wrap to end if at start)
                const prevIndex = currentIndex === 0 ? allAircraft.length - 1 : currentIndex - 1;
                onSelectAircraft(allAircraft[prevIndex].id);
              } else {
                // Tab: cycle forwards (wrap to start if at end)
                const nextIndex = (currentIndex + 1) % allAircraft.length;
                onSelectAircraft(allAircraft[nextIndex].id);
              }
            }
          }
          break;

        case 'ArrowLeft':
          // Only process arrow keys if an aircraft is selected
          if (!selectedAircraft) return;
          event.preventDefault();
          // Turn left 10 degrees
          const newHeadingLeft = (selectedAircraft.targetHeading - 10 + 360) % 360;
          onCommand(selectedAircraft.id, 'turn', { heading: newHeadingLeft });
          break;

        case 'ArrowRight':
          // Only process arrow keys if an aircraft is selected
          if (!selectedAircraft) return;
          event.preventDefault();
          // Turn right 10 degrees
          const newHeadingRight = (selectedAircraft.targetHeading + 10) % 360;
          onCommand(selectedAircraft.id, 'turn', { heading: newHeadingRight });
          break;

        case 'ArrowUp':
          // Only process arrow keys if an aircraft is selected
          if (!selectedAircraft) return;
          event.preventDefault();
          // Climb 1000 feet
          const newAltitudeUp = Math.min(45000, selectedAircraft.targetAltitude + 1000);
          onCommand(selectedAircraft.id, 'climb', { altitude: newAltitudeUp });
          break;

        case 'ArrowDown':
          // Only process arrow keys if an aircraft is selected
          if (!selectedAircraft) return;
          event.preventDefault();
          // Descend 1000 feet
          const newAltitudeDown = Math.max(0, selectedAircraft.targetAltitude - 1000);
          onCommand(selectedAircraft.id, 'descend', { altitude: newAltitudeDown });
          break;

        default:
          // Ignore other keys
          break;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAircraft, allAircraft, onCommand, onSelectAircraft]);
}
