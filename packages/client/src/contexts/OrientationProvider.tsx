import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isPortrait, getScreenSize, getDeviceType } from '../utils/deviceDetection';

interface OrientationContextValue {
  orientation: 'portrait' | 'landscape';
  screenSize: 'small' | 'medium' | 'large';
  deviceType: 'desktop' | 'tablet' | 'mobile';
  isMobileLayout: boolean;
}

const OrientationContext = createContext<OrientationContextValue | undefined>(undefined);

export function OrientationProvider({ children }: { children: ReactNode }) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    isPortrait() ? 'portrait' : 'landscape'
  );
  const [screenSize, setScreenSize] = useState<'small' | 'medium' | 'large'>(getScreenSize());
  const [deviceType, setDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>(getDeviceType());

  useEffect(() => {
    const handleResize = () => {
      setOrientation(isPortrait() ? 'portrait' : 'landscape');
      setScreenSize(getScreenSize());
      setDeviceType(getDeviceType());
    };

    // Use matchMedia for more reliable orientation detection
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const landscapeQuery = window.matchMedia('(orientation: landscape)');

    const handleOrientationChange = () => {
      if (portraitQuery.matches) {
        setOrientation('portrait');
      } else if (landscapeQuery.matches) {
        setOrientation('landscape');
      }
      setScreenSize(getScreenSize());
    };

    // Modern browsers
    if (portraitQuery.addEventListener) {
      portraitQuery.addEventListener('change', handleOrientationChange);
      landscapeQuery.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback for older browsers
      // @ts-ignore
      portraitQuery.addListener(handleOrientationChange);
      // @ts-ignore
      landscapeQuery.addListener(handleOrientationChange);
    }

    // Also listen to resize events as fallback
    window.addEventListener('resize', handleResize);

    return () => {
      if (portraitQuery.removeEventListener) {
        portraitQuery.removeEventListener('change', handleOrientationChange);
        landscapeQuery.removeEventListener('change', handleOrientationChange);
      } else {
        // @ts-ignore
        portraitQuery.removeListener(handleOrientationChange);
        // @ts-ignore
        landscapeQuery.removeListener(handleOrientationChange);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Determine if mobile layout should be used
  const isMobileLayout = screenSize === 'small' || (screenSize === 'medium' && deviceType !== 'desktop');

  return (
    <OrientationContext.Provider value={{ orientation, screenSize, deviceType, isMobileLayout }}>
      {children}
    </OrientationContext.Provider>
  );
}

export function useOrientation() {
  const context = useContext(OrientationContext);
  if (context === undefined) {
    throw new Error('useOrientation must be used within an OrientationProvider');
  }
  return context;
}
