import { create } from 'zustand';
import { Aircraft, GameState, GameEvent, Controller } from 'shared';

interface GameStore {
  // Game state
  gameState: GameState | null;
  selectedAircraftId: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  updateAircraft: (id: string, updates: Partial<Aircraft>) => void;
  addAircraft: (aircraft: Aircraft) => void;
  removeAircraft: (id: string) => void;
  setSelectedAircraft: (id: string | null) => void;
  addEvent: (event: GameEvent) => void;
  updateController: (controller: Controller) => void;
  removeController: (id: string) => void;
  reset: () => void;
}

const initialState = {
  gameState: null,
  selectedAircraftId: null,
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

  reset: () => set(initialState),
}));
