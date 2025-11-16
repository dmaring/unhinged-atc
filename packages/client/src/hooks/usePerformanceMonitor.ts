import { useState, useEffect, useRef } from 'react';
import { isMobileDevice } from '../utils/deviceDetection';

interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  frameTime: number;
  isLowPerformance: boolean;
}

interface PerformanceSettings {
  targetFps: number;
  lowFpsThreshold: number;
  batteryMode: boolean;
}

export function usePerformanceMonitor(enabled: boolean = true) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    frameTime: 16.67,
    isLowPerformance: false,
  });

  const [settings, setSettings] = useState<PerformanceSettings>({
    targetFps: isMobileDevice() ? 45 : 60,
    lowFpsThreshold: isMobileDevice() ? 30 : 45,
    batteryMode: false,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const measureFPS = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;

      // Update every 500ms for smoother readings
      if (deltaTime >= 500) {
        const currentFps = Math.round((frameCountRef.current * 1000) / deltaTime);

        // Keep history of last 10 FPS measurements
        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 10) {
          fpsHistoryRef.current.shift();
        }

        // Calculate average FPS
        const avgFps = Math.round(
          fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
        );

        // Determine if performance is low
        const isLowPerformance = avgFps < settings.lowFpsThreshold;

        setMetrics({
          fps: currentFps,
          avgFps,
          frameTime: deltaTime / frameCountRef.current,
          isLowPerformance,
        });

        // Reset counters
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }

      frameCountRef.current++;
      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    rafIdRef.current = requestAnimationFrame(measureFPS);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [enabled, settings.lowFpsThreshold]);

  const setBatteryMode = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      batteryMode: enabled,
      targetFps: enabled ? 30 : (isMobileDevice() ? 45 : 60),
    }));
  };

  return {
    metrics,
    settings,
    setBatteryMode,
  };
}
