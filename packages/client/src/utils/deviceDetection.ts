/**
 * Device detection utilities for responsive behavior
 */

export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - msMaxTouchPoints is IE specific
    navigator.msMaxTouchPoints > 0
  );
}

export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Check for mobile devices
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent);
}

export function isTablet(): boolean {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Check for tablets
  const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet/i;
  return tabletRegex.test(userAgent);
}

export function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (isTablet()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
}

export function getScreenSize(): 'small' | 'medium' | 'large' {
  const width = window.innerWidth;

  if (width < 768) return 'small';
  if (width < 1024) return 'medium';
  return 'large';
}

export function getTapTolerance(): number {
  // Apple recommends 44x44pt minimum touch target
  // Use 44px for touch devices, 15px for mouse
  return isTouchDevice() ? 44 : 15;
}

export function getAircraftIconSize(): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'mobile':
      return 12; // Larger for easier tapping
    case 'tablet':
      return 10;
    default:
      return 8; // Desktop default
  }
}

export function getFontScale(): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'mobile':
      return 1.3; // 30% larger fonts on mobile
    case 'tablet':
      return 1.15; // 15% larger on tablet
    default:
      return 1; // Default desktop size
  }
}

export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

export function isLandscape(): boolean {
  return window.innerWidth > window.innerHeight;
}

export function supportsHaptic(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Gets safe area insets for notched devices (iPhone X+, etc.)
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const style = getComputedStyle(document.documentElement);

  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10) || 0,
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10) || 0,
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10) || 0,
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10) || 0,
  };
}
