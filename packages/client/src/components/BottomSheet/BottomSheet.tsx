import { ReactNode, useRef, useEffect, useState } from 'react';
import styles from './BottomSheet.module.css';

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: number[]; // Heights in pixels for peek, half, full states
  initialSnapPoint?: number; // Index of snapPoints to start at
  onSnapPointChange?: (snapPoint: number, height: number) => void;
}

export function BottomSheet({
  children,
  snapPoints = [120, 400, window.innerHeight * 0.9], // peek, half, full
  initialSnapPoint = 0,
  onSnapPointChange,
}: BottomSheetProps) {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(initialSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const currentHeight = snapPoints[currentSnapPoint];

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow drag from the handle area
    const target = e.target as HTMLElement;
    if (!target.closest(`.${styles.handle}`)) return;

    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setDragStartHeight(currentHeight);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaY = dragStartY - e.touches[0].clientY;
    const newHeight = Math.max(snapPoints[0], Math.min(snapPoints[snapPoints.length - 1], dragStartHeight + deltaY));

    if (sheetRef.current) {
      sheetRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);

    // Snap to nearest snap point
    const currentSheetHeight = sheetRef.current?.offsetHeight || currentHeight;
    let closestSnapPoint = 0;
    let minDistance = Infinity;

    snapPoints.forEach((point, index) => {
      const distance = Math.abs(currentSheetHeight - point);
      if (distance < minDistance) {
        minDistance = distance;
        closestSnapPoint = index;
      }
    });

    setCurrentSnapPoint(closestSnapPoint);
    onSnapPointChange?.(closestSnapPoint, snapPoints[closestSnapPoint]);
  };

  // Scroll lock when sheet is dragged past half
  useEffect(() => {
    if (currentSnapPoint >= 1) {
      // Prevent body scroll when sheet is expanded
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [currentSnapPoint]);

  return (
    <>
      {/* Backdrop - shows when sheet is expanded */}
      {currentSnapPoint >= 2 && (
        <div
          className={styles.backdrop}
          onClick={() => {
            setCurrentSnapPoint(1); // Snap to half
            onSnapPointChange?.(1, snapPoints[1]);
          }}
        />
      )}

      <div
        ref={sheetRef}
        className={styles.bottomSheet}
        style={{
          height: `${currentHeight}px`,
          transition: isDragging ? 'none' : 'height 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.handle}>
          <div className={styles.handleBar} />
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </>
  );
}
