import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, StateDelta, GameEvent, Controller, ChaosType } from 'shared';
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
  const updateChaosAbilities = useGameStore((state) => state.updateChaosAbilities);
  const updateScoreMetrics = useGameStore((state) => state.updateScoreMetrics);

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

      // Update score metrics
      updateScoreMetrics({
        scoreUpdate: delta.scoreUpdate,
        planesCleared: delta.planesCleared,
        crashCount: delta.crashCount,
        gameTime: delta.gameTime,
        nextBonusAt: delta.nextBonusAt,
      });
    };

    // Handle game events - REMOVED: events now only come via delta.newEvents
    // This prevents duplicate event handling
    // const onGameEvent = (event: GameEvent) => {
    //   console.log('[GameSync] Event:', event.message);
    //   addEvent(event);
    // };

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

    // Handle chaos activated
    const onChaosActivated = (data: { chaosType: string; controllerId: string; message: string; timestamp: number }) => {
      console.log(`[GameSync] Chaos activated: ${data.message}`);
      // The event will be added through the normal event system
    };

    // Handle chaos state updates
    const onChaosStateUpdated = (data: { chaosAbilities: Record<string, { lastUsed: number; usageCount: number }> }) => {
      console.log('[GameSync] Chaos abilities updated');
      updateChaosAbilities(data.chaosAbilities);
    };

    // Handle chaos failed
    const onChaosFailed = (data: { chaosType: string; message: string }) => {
      console.warn(`[GameSync] Chaos failed: ${data.message}`);
      // Could show a toast notification here
    };

    // Register event listeners
    socket.on('game_state', onGameState);
    socket.on('state_update', onStateUpdate);
    // socket.on('game_event', onGameEvent); // REMOVED: events now only come via delta.newEvents
    socket.on('controller_update', onControllerUpdate);
    socket.on('command_issued', onCommandIssued);
    socket.on('time_scale_updated', onTimeScaleUpdated);
    socket.on('chaos_activated', onChaosActivated);
    socket.on('chaos_state_updated', onChaosStateUpdated);
    socket.on('chaos_failed', onChaosFailed);

    // Cleanup
    return () => {
      socket.off('game_state', onGameState);
      socket.off('state_update', onStateUpdate);
      // socket.off('game_event', onGameEvent); // REMOVED: events now only come via delta.newEvents
      socket.off('controller_update', onControllerUpdate);
      socket.off('command_issued', onCommandIssued);
      socket.off('time_scale_updated', onTimeScaleUpdated);
      socket.off('chaos_activated', onChaosActivated);
      socket.off('chaos_state_updated', onChaosStateUpdated);
      socket.off('chaos_failed', onChaosFailed);
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
    updateChaosAbilities,
    updateScoreMetrics,
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

  /**
   * Send chaos command
   */
  const sendChaosCommand = (chaosType: ChaosType) => {
    if (!socket || !isConnected) {
      console.warn('[GameSync] Cannot send chaos command: not connected');
      return;
    }

    socket.emit('chaos_command', { type: chaosType });
  };

  /**
   * Spawn a new aircraft
   */
  const spawnAircraft = (count: number = 1) => {
    if (!socket || !isConnected) {
      console.warn('[GameSync] Cannot spawn aircraft: not connected');
      return;
    }

    socket.emit('spawn_aircraft', { count });
  };

  return { sendCommand, setTimeScale, sendChaosCommand, spawnAircraft };
}
