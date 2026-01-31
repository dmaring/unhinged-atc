import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { GameState, StateDelta, Controller, ChaosType, GameEndData } from 'shared';
import { useGameStore } from '../stores/gameStore';

export interface QueueCallbacks {
  onQueueJoined?: (data: { position: number; totalInQueue: number; activePlayerCount: number }) => void;
  onQueuePositionUpdated?: (data: { position: number }) => void;
  onPromotedFromQueue?: () => void;
  onGameFull?: (data: { message: string }) => void;
  onPlayerEnteredGame?: (data: { username: string; playerId: string }) => void;
  onPlayerLeftGame?: (data: { username: string; playerId: string }) => void;
  onGameEnded?: (data: GameEndData) => void;
  onGameRestarting?: (data: { message: string }) => void;
  onReturnToLogin?: (data: { message: string }) => void;
  onAutoChaosActivated?: (data: { chaosName: string; chaosDescription: string }) => void;
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
  const setQueueInfo = useGameStore((state) => state.setQueueInfo);
  const addActionIndicator = useGameStore((state) => state.addActionIndicator);
  const removeActionIndicator = useGameStore((state) => state.removeActionIndicator);
  const resetStore = useGameStore((state) => state.reset);

  // Watchdog: Track last state update time to detect stale connections
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Track action indicator timeouts to clear on unmount
  const actionIndicatorTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    if (!socket || !isConnected || !username || !email) return;

    // Join default room with provided username and email
    console.log(`[GameSync] Joining room with username: ${username}, email: ${email}`);
    socket.emit('join_room', { roomId: 'default', username, email });

    // Handle initial game state
    const onGameState = (state: GameState) => {
      const controllerCount = Object.keys(state.controllers).length;
      const controllerUsernames = Object.values(state.controllers).map(c => c.username);
      console.log('[GameSync] Received initial game state:', {
        roomId: state.roomId,
        controllerCount,
        controllerUsernames,
        aircraftCount: Object.keys(state.aircraft).length,
        gameEpoch: state.gameEpoch
      });
      console.log('[GameSync] Full controllers object:', state.controllers);
      setGameState(state);
    };

    // Handle state updates (60 FPS from server)
    const onStateUpdate = (delta: StateDelta) => {
      // Update watchdog timer - we received an update
      lastUpdateTimeRef.current = Date.now();

      // Validate delta epoch to prevent processing stale data after game reset
      const currentGameState = useGameStore.getState().gameState;
      if (currentGameState && delta.gameEpoch !== undefined) {
        if (delta.gameEpoch < currentGameState.gameEpoch) {
          console.warn('[GameSync] Rejecting stale delta from old game epoch:', {
            deltaEpoch: delta.gameEpoch,
            currentEpoch: currentGameState.gameEpoch
          });
          return; // Ignore this delta - it's from before the reset
        }
      }

      // Add new aircraft first
      if (delta.newAircraft && delta.newAircraft.length > 0) {
        delta.newAircraft.forEach((aircraft) => {
          addAircraft(aircraft);
        });
      }

      // Update aircraft
      delta.aircraftUpdates?.forEach((update) => {
        if (update.id) {
          updateAircraft(update.id, update);
        }
      });

      // Remove aircraft
      delta.removedAircraftIds?.forEach((id) => {
        removeAircraft(id);
      });

      // Add events
      delta.newEvents?.forEach((event) => {
        addEvent(event);

        // Handle auto chaos activation for UI alert
        if (event.type === 'auto_chaos_activated') {
          // Extract chaos type from the event message
          const chaosDescriptions: Record<string, string> = {
            'Reverse Course': 'Flip all aircraft headings 180°',
            'Altitude Roulette': 'Randomize all aircraft altitudes ±5000ft',
            'Speed Lottery': 'Random speed changes to all aircraft',
            'Gravity Well': 'Pull all aircraft toward center',
            'Scatter Blast': 'Push all aircraft away from center',
            'Callsign Shuffle': 'Swap all aircraft callsigns randomly',
          };
          // Parse chaos name from message (format: "🌪️ AUTO CHAOS: Reverse Course - description")
          const match = event.message.match(/AUTO CHAOS: (.*?) -/);
          if (match) {
            const chaosName = match[1];
            queueCallbacks?.onAutoChaosActivated?.({
              chaosName,
              chaosDescription: chaosDescriptions[chaosName] || '',
            });
          }
        }
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

      // Handle action indicators
      if (delta.actionIndicators) {
        delta.actionIndicators.forEach(indicator => {
          addActionIndicator(indicator);

          // Auto-remove after 2 seconds - track timeout for cleanup
          const timeout = setTimeout(() => {
            removeActionIndicator(indicator.id);
            actionIndicatorTimeouts.current.delete(timeout);
          }, 2000);

          actionIndicatorTimeouts.current.add(timeout);
        });
      }
    };

    // Handle game events - REMOVED: events now only come via delta.newEvents
    // This prevents duplicate event handling
    // const onGameEvent = (event: GameEvent) => {
    //   console.log('[GameSync] Event:', event.message);
    //   addEvent(event);
    // };

    // Handle controller updates
    const onControllerUpdate = (data: { type: 'joined' | 'left'; controller: Controller }) => {
      console.log(`[GameSync] Controller update: ${data.type}`, {
        controllerId: data.controller.id,
        username: data.controller.username,
        hasEmail: !!data.controller.email
      });
      if (data.type === 'joined') {
        // Ensure email field exists (defensive programming)
        const controller = {
          ...data.controller,
          email: data.controller.email || '' // Default to empty string if missing
        };
        updateController(controller);
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
      // Update store with queue info
      setQueueInfo({ count: data.totalInQueue, position: data.position });
      queueCallbacks?.onQueueJoined?.(data);
    };

    const onQueuePositionUpdated = (data: { position: number; totalInQueue?: number }) => {
      console.log('[GameSync] Queue position updated (legacy):', data);
      // Update position in store (and count if provided)
      const currentQueue = useGameStore.getState().queueInfo;
      setQueueInfo({
        count: data.totalInQueue ?? currentQueue?.count ?? 0,
        position: data.position
      });
      queueCallbacks?.onQueuePositionUpdated?.(data);
    };

    const onQueueUpdated = (data: { queue: Array<{ position: number; socketId: string }> }) => {
      console.log('[GameSync] Queue updated (batch):', data);
      // Find my position in the queue (only update if I'm in it)
      const mySocketId = socket?.id;
      if (mySocketId) {
        const myQueueEntry = data.queue.find(qp => qp.socketId === mySocketId);
        if (myQueueEntry) {
          // Update my position and total queue count
          setQueueInfo({
            count: data.queue.length,
            position: myQueueEntry.position
          });
          queueCallbacks?.onQueuePositionUpdated?.({ position: myQueueEntry.position });
        }
      }
    };

    const onPromotedFromQueue = () => {
      console.log('[GameSync] Promoted from queue');
      // Clear queue info when promoted (player is now active)
      setQueueInfo(null);
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

    const onGameEnded = (data: GameEndData) => {
      console.log('[GameSync] Game ended:', data);
      queueCallbacks?.onGameEnded?.(data);
    };

    const onGameRestarting = (data: { message: string }) => {
      console.log('[GameSync] Game restarting:', data);
      queueCallbacks?.onGameRestarting?.(data);
    };

    const onReturnToLogin = (data: { message: string }) => {
      console.log('[GameSync] Returning to login:', data);
      queueCallbacks?.onReturnToLogin?.(data);
    };

    // Register queue event listeners
    socket.on('queue_joined', onQueueJoined);
    socket.on('queue_position_updated', onQueuePositionUpdated); // Legacy support
    socket.on('queue_updated', onQueueUpdated); // New batch update
    socket.on('promoted_from_queue', onPromotedFromQueue);
    socket.on('game_full', onGameFull);
    socket.on('player_entered_game', onPlayerEnteredGame);
    socket.on('player_left_game', onPlayerLeftGame);
    socket.on('game_ended', onGameEnded);
    socket.on('game_restarting', onGameRestarting);
    socket.on('return_to_login', onReturnToLogin);

    // Watchdog timer: Check for stale connections every 2 seconds
    const watchdogInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
      const STALE_THRESHOLD = 3000; // 3 seconds without updates is suspicious

      if (timeSinceLastUpdate > STALE_THRESHOLD) {
        console.warn('[GameSync] No state updates received for', timeSinceLastUpdate / 1000, 'seconds');
        console.warn('[GameSync] Connection may be stale. Current state:', {
          isConnected,
          hasGameState: !!useGameStore.getState().gameState,
          gameEpoch: useGameStore.getState().gameState?.gameEpoch,
          aircraftCount: Object.keys(useGameStore.getState().gameState?.aircraft || {}).length,
        });
      }
    }, 2000); // Check every 2 seconds

    // Cleanup
    return () => {
      // Clear all pending action indicator timeouts
      actionIndicatorTimeouts.current.forEach(timeout => clearTimeout(timeout));
      actionIndicatorTimeouts.current.clear();

      clearInterval(watchdogInterval);
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
      socket.off('queue_updated', onQueueUpdated);
      socket.off('promoted_from_queue', onPromotedFromQueue);
      socket.off('game_full', onGameFull);
      socket.off('player_entered_game', onPlayerEnteredGame);
      socket.off('player_left_game', onPlayerLeftGame);
      socket.off('game_ended', onGameEnded);
      socket.off('game_restarting', onGameRestarting);
      socket.off('return_to_login', onReturnToLogin);
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
   * Select an aircraft (request ownership)
   */
  const selectAircraft = (aircraftId: string) => {
    if (!socket || !isConnected) return;

    // Optimistically update selection locally? No, wait for server confirmation via ownership change?
    // Actually, for selection UI we update locally immediately, but for ownership we send command.
    // The server will respond with ownership update.

    socket.emit('aircraft_command', {
      aircraftId,
      type: 'select_aircraft',
      params: {},
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

  return { sendCommand, selectAircraft, setTimeScale, sendChaosCommand, spawnAircraft, resetGame };
}
