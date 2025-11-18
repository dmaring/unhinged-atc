import { create } from 'zustand';
import { Aircraft, GameState, GameEvent, Controller } from 'shared';

interface GameStore {
  // Game state
  gameState: GameState | null;
  selectedAircraftId: string | null;
  queueInfo: { count: number; position: number | null } | null;

  // Actions
  setGameState: (state: GameState) => void;
  updateAircraft: (id: string, updates: Partial<Aircraft>) => void;
  addAircraft: (aircraft: Aircraft) => void;
  removeAircraft: (id: string) => void;
  setSelectedAircraft: (id: string | null) => void;
  addEvent: (event: GameEvent) => void;
  updateController: (controller: Controller) => void;
  removeController: (id: string) => void;
  updateTimeScale: (timeScale: number) => void;
  updateChaosAbilities: (chaosAbilities: Record<string, { lastUsed: number; usageCount: number }>) => void;
  updateScoreMetrics: (metrics: { scoreUpdate?: number; planesCleared?: number; crashCount?: number; gameTime?: number; nextBonusAt?: number }) => void;
  setQueueInfo: (queueInfo: { count: number; position: number | null } | null) => void;
  reset: () => void;
}

const initialState = {
  gameState: null,
  selectedAircraftId: null,
  queueInfo: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setGameState: (state) => set({ gameState: state }),

  updateAircraft: (id, updates) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          aircraft: {
            ...store.gameState.aircraft,
            [id]: {
              ...store.gameState.aircraft[id],
              ...updates,
            },
          },
        },
      };
    }),

  addAircraft: (aircraft) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          aircraft: {
            ...store.gameState.aircraft,
            [aircraft.id]: aircraft,
          },
        },
      };
    }),

  removeAircraft: (id) =>
    set((store) => {
      if (!store.gameState) return store;

      const { [id]: removed, ...remaining } = store.gameState.aircraft;
      return {
        gameState: {
          ...store.gameState,
          aircraft: remaining,
        },
        selectedAircraftId:
          store.selectedAircraftId === id ? null : store.selectedAircraftId,
      };
    }),

  setSelectedAircraft: (id) => set({ selectedAircraftId: id }),

  addEvent: (event) =>
    set((store) => {
      if (!store.gameState) return store;

      // Check for duplicate event IDs to prevent duplicates
      const isDuplicate = store.gameState.recentEvents.some((e) => e.id === event.id);
      if (isDuplicate) {
        console.log('[gameStore] Skipping duplicate event:', event.id);
        return store;
      }

      const recentEvents = [event, ...store.gameState.recentEvents].slice(0, 20);
      return {
        gameState: {
          ...store.gameState,
          recentEvents,
        },
      };
    }),

  updateController: (controller) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          controllers: {
            ...store.gameState.controllers,
            [controller.id]: controller,
          },
        },
      };
    }),

  removeController: (id) =>
    set((store) => {
      if (!store.gameState) return store;

      const { [id]: removed, ...remaining } = store.gameState.controllers;
      return {
        gameState: {
          ...store.gameState,
          controllers: remaining,
        },
      };
    }),

  updateTimeScale: (timeScale) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          timeScale,
        },
      };
    }),

  updateChaosAbilities: (chaosAbilities) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          chaosAbilities,
        },
      };
    }),

  updateScoreMetrics: (metrics) =>
    set((store) => {
      if (!store.gameState) return store;

      return {
        gameState: {
          ...store.gameState,
          ...(metrics.scoreUpdate !== undefined && { score: metrics.scoreUpdate }),
          ...(metrics.planesCleared !== undefined && { planesCleared: metrics.planesCleared }),
          ...(metrics.crashCount !== undefined && { crashCount: metrics.crashCount }),
          ...(metrics.gameTime !== undefined && { gameTime: metrics.gameTime }),
          ...(metrics.nextBonusAt !== undefined && { nextBonusAt: metrics.nextBonusAt }),
        },
      };
    }),

  setQueueInfo: (queueInfo) => set({ queueInfo }),

  reset: () => set(initialState),
}));
