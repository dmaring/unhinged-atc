import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, StateDelta, GameEvent, Controller } from 'shared';
import { useGameStore } from '../stores/gameStore';

export function useGameSync(socket: Socket | null, isConnected: boolean) {
  const setGameState = useGameStore((state) => state.setGameState);
  const updateAircraft = useGameStore((state) => state.updateAircraft);
  const addAircraft = useGameStore((state) => state.addAircraft);
  const removeAircraft = useGameStore((state) => state.removeAircraft);
  const addEvent = useGameStore((state) => state.addEvent);
  const updateController = useGameStore((state) => state.updateController);
  const removeController = useGameStore((state) => state.removeController);
  const updateTimeScale = useGameStore((state) => state.updateTimeScale);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Auto-join default room
    const username = `Controller${Math.floor(Math.random() * 1000)}`;
    socket.emit('join_room', { roomId: 'default', username });

    // Handle initial game state
    const onGameState = (state: GameState) => {
      console.log('[GameSync] Received initial game state:', state);
      setGameState(state);
    };

    // Handle state updates (60 FPS from server)
    const onStateUpdate = (delta: StateDelta) => {
      // Debug logging
      if (delta.aircraftUpdates && delta.aircraftUpdates.length > 0) {
        console.log('[GameSync] Received aircraft updates:', delta.aircraftUpdates.length);
      }

      // Update aircraft
      delta.aircraftUpdates?.forEach((update) => {
        if (update.id) {
          updateAircraft(update.id, update);
        }
      });

      // Add new aircraft
      delta.newAircraft?.forEach((aircraft) => {
        addAircraft(aircraft);
      });

      // Remove aircraft
      delta.removedAircraftIds?.forEach((id) => {
        removeAircraft(id);
      });

      // Add events
      delta.newEvents?.forEach((event) => {
        addEvent(event);
      });

      // Update controller
      if (delta.controllerUpdate) {
        if (delta.controllerUpdate.type === 'joined') {
          updateController(delta.controllerUpdate.controller);
        } else if (delta.controllerUpdate.type === 'left') {
          removeController(delta.controllerUpdate.controller.id);
        }
      }
    };

    // Handle game events
    const onGameEvent = (event: GameEvent) => {
      console.log('[GameSync] Event:', event.message);
      addEvent(event);
    };

    // Handle controller updates
    const onControllerUpdate = (data: { type: 'joined' | 'left'; controller: Controller }) => {
      if (data.type === 'joined') {
        updateController(data.controller);
      } else {
        removeController(data.controller.id);
      }
    };

    // Handle command issued feedback
    const onCommandIssued = (data: { controllerId: string; aircraftId: string; commandType: string }) => {
      console.log(`[GameSync] Command issued: ${data.commandType} on ${data.aircraftId}`);
    };

    // Handle time scale updates
    const onTimeScaleUpdated = (data: { timeScale: number }) => {
      console.log(`[GameSync] Time scale updated: ${data.timeScale}x`);
      // Update the game state with new time scale
      updateTimeScale(data.timeScale);
    };

    // Register event listeners
    socket.on('game_state', onGameState);
    socket.on('state_update', onStateUpdate);
    socket.on('game_event', onGameEvent);
    socket.on('controller_update', onControllerUpdate);
    socket.on('command_issued', onCommandIssued);
    socket.on('time_scale_updated', onTimeScaleUpdated);

    // Cleanup
    return () => {
      socket.off('game_state', onGameState);
      socket.off('state_update', onStateUpdate);
      socket.off('game_event', onGameEvent);
      socket.off('controller_update', onControllerUpdate);
      socket.off('command_issued', onCommandIssued);
      socket.off('time_scale_updated', onTimeScaleUpdated);
    };
  }, [
    socket,
    isConnected,
    setGameState,
    updateAircraft,
    addAircraft,
    removeAircraft,
    addEvent,
    updateController,
    removeController,
    updateTimeScale,
  ]);

  /**
   * Send an aircraft command
   */
  const sendCommand = (aircraftId: string, commandType: string, params: any) => {
    if (!socket || !isConnected) {
      console.warn('[GameSync] Cannot send command: not connected');
      return;
    }

    socket.emit('aircraft_command', {
      aircraftId,
      type: commandType,
      params,
    });
  };

  /**
   * Set time scale
   */
  const setTimeScale = (scale: number) => {
    if (!socket || !isConnected) {
      console.warn('[GameSync] Cannot set time scale: not connected');
      return;
    }

    socket.emit('set_time_scale', { scale });
  };

  return { sendCommand, setTimeScale };
}
