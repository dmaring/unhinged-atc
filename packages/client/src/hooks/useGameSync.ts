import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, StateDelta, Controller, ChaosType } from 'shared';
import { useGameStore } from '../stores/gameStore';

export interface QueueCallbacks {
  onQueueJoined?: (data: { position: number; totalInQueue: number; activePlayerCount: number }) => void;
  onQueuePositionUpdated?: (data: { position: number }) => void;
  onPromotedFromQueue?: () => void;
  onGameFull?: (data: { message: string }) => void;
  onPlayerEnteredGame?: (data: { username: string; playerId: string }) => void;
  onPlayerLeftGame?: (data: { username: string; playerId: string }) => void;
}

export function useGameSync(
  socket: Socket | null,
  isConnected: boolean,
  username: string,
  email: string,
  onJoinError?: (error: string) => void,
  queueCallbacks?: QueueCallbacks
) {
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
  const resetStore = useGameStore((state) => state.reset);

  useEffect(() => {
    if (!socket || !isConnected || !username || !email) return;

    // Join default room with provided username and email
    console.log(`[GameSync] Joining room with username: ${username}, email: ${email}`);
    socket.emit('join_room', { roomId: 'default', username, email });

    // Handle initial game state
    const onGameState = (state: GameState) => {
      console.log('[GameSync] Received initial game state:', state);
      setGameState(state);
    };

    // Handle state updates (60 FPS from server)
    const onStateUpdate = (delta: StateDelta) => {
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

    // Handle game reset
    const onGameReset = (state: GameState) => {
      console.log('[GameSync] Game reset - received new state');
      // Clear local state first
      resetStore();
      // Set the new game state
      setGameState(state);
    };

    // Handle join errors (username taken, profanity, etc.)
    const handleJoinError = (data: { message: string }) => {
      console.error('[GameSync] Join error:', data.message);
      if (onJoinError) {
        onJoinError(data.message);
      }
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
    socket.on('game_reset', onGameReset);
    socket.on('join_error', handleJoinError);

    // Queue event handlers
    const onQueueJoined = (data: { position: number; totalInQueue: number; activePlayerCount: number }) => {
      console.log('[GameSync] Queue joined:', data);
      queueCallbacks?.onQueueJoined?.(data);
    };

    const onQueuePositionUpdated = (data: { position: number }) => {
      console.log('[GameSync] Queue position updated:', data);
      queueCallbacks?.onQueuePositionUpdated?.(data);
    };

    const onPromotedFromQueue = () => {
      console.log('[GameSync] Promoted from queue');
      queueCallbacks?.onPromotedFromQueue?.();
    };

    const onGameFull = (data: { message: string }) => {
      console.log('[GameSync] Game full:', data);
      queueCallbacks?.onGameFull?.(data);
    };

    const onPlayerEnteredGame = (data: { username: string; playerId: string }) => {
      console.log('[GameSync] Player entered game:', data);
      queueCallbacks?.onPlayerEnteredGame?.(data);
    };

    const onPlayerLeftGame = (data: { username: string; playerId: string }) => {
      console.log('[GameSync] Player left game:', data);
      queueCallbacks?.onPlayerLeftGame?.(data);
    };

    // Register queue event listeners
    socket.on('queue_joined', onQueueJoined);
    socket.on('queue_position_updated', onQueuePositionUpdated);
    socket.on('promoted_from_queue', onPromotedFromQueue);
    socket.on('game_full', onGameFull);
    socket.on('player_entered_game', onPlayerEnteredGame);
    socket.on('player_left_game', onPlayerLeftGame);

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
      socket.off('game_reset', onGameReset);
      socket.off('join_error', handleJoinError);
      socket.off('queue_joined', onQueueJoined);
      socket.off('queue_position_updated', onQueuePositionUpdated);
      socket.off('promoted_from_queue', onPromotedFromQueue);
      socket.off('game_full', onGameFull);
      socket.off('player_entered_game', onPlayerEnteredGame);
      socket.off('player_left_game', onPlayerLeftGame);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isConnected, username, email, onJoinError]);
  // Note: Zustand store selectors are intentionally excluded from dependencies
  // They are stable references and including them causes infinite re-renders

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

  /**
   * Reset the game (admin function)
   */
  const resetGame = () => {
    if (!socket || !isConnected) {
      console.warn('[GameSync] Cannot reset game: not connected');
      return;
    }

    console.log('[GameSync] Requesting game reset...');
    socket.emit('reset_game');
  };

  return { sendCommand, setTimeScale, sendChaosCommand, spawnAircraft, resetGame };
}
