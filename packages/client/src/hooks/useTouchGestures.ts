import { useRef, useCallback, RefObject } from 'react';

export interface TouchGestureState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface TouchGestureCallbacks {
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (panX: number, panY: number) => void;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
}

interface TouchPoint {
  x: number;
  y: number;
  id: number;
}

export function useTouchGestures(
  elementRef: RefObject<HTMLElement>,
  callbacks: TouchGestureCallbacks = {}
) {
  const touchStateRef = useRef({
    initialTouches: [] as TouchPoint[],
    lastTouches: [] as TouchPoint[],
    initialDistance: 0,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false,
    tapStartTime: 0,
    tapStartPos: { x: 0, y: 0 },
    lastTapTime: 0,
    lastTapPos: { x: 0, y: 0 },
  });

  // Current gesture state
  const gestureState = useRef<TouchGestureState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });

  // Calculate distance between two touch points
  const getDistance = (touch1: TouchPoint, touch2: TouchPoint): number => {
    const dx = touch2.x - touch1.x;
    const dy = touch2.y - touch1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point of two touches
  const getCenter = (touch1: TouchPoint, touch2: TouchPoint): { x: number; y: number } => {
    return {
      x: (touch1.x + touch2.x) / 2,
      y: (touch1.y + touch2.y) / 2,
    };
  };

  // Convert touch to TouchPoint
  const touchToPoint = (touch: Touch, rect: DOMRect): TouchPoint => {
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      id: touch.identifier,
    };
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!elementRef.current) return;

    const rect = elementRef.current.getBoundingClientRect();
    const touches: TouchPoint[] = Array.from(e.touches).map(t => touchToPoint(t, rect));
    const state = touchStateRef.current;

    state.initialTouches = touches;
    state.lastTouches = touches;

    if (touches.length === 1) {
      // Single touch - potential tap or drag
      state.tapStartTime = Date.now();
      state.tapStartPos = { x: touches[0].x, y: touches[0].y };
      state.isPinching = false;
      state.isPanning = false;
    } else if (touches.length === 2) {
      // Two touches - pinch or pan
      state.initialDistance = getDistance(touches[0], touches[1]);
      state.initialZoom = gestureState.current.zoom;
      state.initialPan = { x: gestureState.current.panX, y: gestureState.current.panY };
      state.isPinching = true;
      state.isPanning = true;
    }
  }, [elementRef]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!elementRef.current) return;

    e.preventDefault(); // Prevent page scrolling during gestures

    const rect = elementRef.current.getBoundingClientRect();
    const touches: TouchPoint[] = Array.from(e.touches).map(t => touchToPoint(t, rect));
    const state = touchStateRef.current;

    if (touches.length === 2 && state.isPinching) {
      // Pinch to zoom
      const currentDistance = getDistance(touches[0], touches[1]);
      const scale = currentDistance / state.initialDistance;
      const newZoom = Math.max(0.5, Math.min(3, state.initialZoom * scale));

      gestureState.current.zoom = newZoom;
      callbacks.onZoomChange?.(newZoom);

      // Two-finger pan
      const currentCenter = getCenter(touches[0], touches[1]);
      const initialCenter = getCenter(state.initialTouches[0], state.initialTouches[1]);
      const deltaX = currentCenter.x - initialCenter.x;
      const deltaY = currentCenter.y - initialCenter.y;

      const newPanX = state.initialPan.x + deltaX;
      const newPanY = state.initialPan.y + deltaY;

      gestureState.current.panX = newPanX;
      gestureState.current.panY = newPanY;
      callbacks.onPanChange?.(newPanX, newPanY);
    } else if (touches.length === 1) {
      // Single finger - check if it's moved too much for a tap
      const dx = touches[0].x - state.tapStartPos.x;
      const dy = touches[0].y - state.tapStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        // Moved too much, not a tap
        state.tapStartTime = 0;
      }
    }

    state.lastTouches = touches;
  }, [elementRef, callbacks]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const state = touchStateRef.current;
    const remainingTouches = e.touches.length;

    if (remainingTouches === 0) {
      // All touches ended
      const tapDuration = Date.now() - state.tapStartTime;

      // Check if this was a tap (short duration, minimal movement)
      if (state.tapStartTime > 0 && tapDuration < 300) {
        const now = Date.now();
        const timeSinceLastTap = now - state.lastTapTime;
        const dx = state.tapStartPos.x - state.lastTapPos.x;
        const dy = state.tapStartPos.y - state.lastTapPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if this is a double-tap (within 400ms and near same position)
        if (timeSinceLastTap < 400 && distance < 50 && state.lastTapTime > 0) {
          // Double-tap detected
          callbacks.onDoubleTap?.(state.tapStartPos.x, state.tapStartPos.y);

          // Trigger haptic feedback if available
          if ('vibrate' in navigator) {
            navigator.vibrate([10, 50, 10]);
          }

          // Reset tap timing to prevent triple-tap
          state.lastTapTime = 0;
        } else {
          // Single tap
          callbacks.onTap?.(state.tapStartPos.x, state.tapStartPos.y);

          // Trigger haptic feedback if available
          if ('vibrate' in navigator) {
            navigator.vibrate(10);
          }

          // Record this tap for double-tap detection
          state.lastTapTime = now;
          state.lastTapPos = { x: state.tapStartPos.x, y: state.tapStartPos.y };
        }
      }

      state.isPinching = false;
      state.isPanning = false;
      state.tapStartTime = 0;
    } else if (remainingTouches === 1 && state.isPinching) {
      // Went from 2+ touches to 1 touch - reset pinch state
      state.isPinching = false;
      state.isPanning = false;
    }
  }, [callbacks]);

  const attachListeners = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const resetGestures = useCallback(() => {
    gestureState.current = {
      zoom: 1,
      panX: 0,
      panY: 0,
    };
  }, []);

  const getGestureState = useCallback(() => gestureState.current, []);

  return {
    attachListeners,
    resetGestures,
    getGestureState,
  };
}
