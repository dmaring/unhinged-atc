import { useEffect, useState } from 'react';
import styles from './ChaosAlert.module.css';

interface ChaosAlertProps {
  chaosName: string | null;
  chaosDescription: string | null;
}

export function ChaosAlert({ chaosName, chaosDescription }: ChaosAlertProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (chaosName && chaosDescription) {
      setIsVisible(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [chaosName, chaosDescription]);

  if (!isVisible || !chaosName) return null;

  return (
    <div className={styles.container}>
      <div className={styles.alert}>
        <div className={styles.header}>
          <span className={styles.icon}>🌪️</span>
          <span className={styles.title}>CHAOS ACTIVATED</span>
          <span className={styles.icon}>🌪️</span>
        </div>
        <div className={styles.content}>
          <div className={styles.chaosName}>{chaosName}</div>
          <div className={styles.chaosDescription}>{chaosDescription}</div>
        </div>
      </div>
    </div>
  );
}
