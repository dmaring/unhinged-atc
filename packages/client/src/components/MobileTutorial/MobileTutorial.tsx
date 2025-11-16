import { useState, useEffect } from 'react';
import styles from './MobileTutorial.module.css';
import { isMobileDevice } from '../../utils/deviceDetection';

const TUTORIAL_DISMISSED_KEY = 'atc_mobile_tutorial_dismissed';

export function MobileTutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialSteps = [
    {
      title: 'Welcome to Mobile ATC!',
      description: 'Tap on any aircraft to select it and see its details.',
      icon: '✈️',
    },
    {
      title: 'Zoom & Pan',
      description: 'Pinch to zoom (0.5x - 3x) and use two fingers to pan around the airspace.',
      icon: '🔍',
    },
    {
      title: 'Control Aircraft',
      description: 'Use the stepper buttons to adjust heading, altitude, and speed. Tap "APPLY ALL" to send all commands at once.',
      icon: '🎮',
    },
    {
      title: 'Navigate Aircraft',
      description: 'Use Previous/Next buttons to cycle through aircraft when multiple are selected.',
      icon: '⬅️➡️',
    },
    {
      title: 'Quick Actions',
      description: 'Swipe up the bottom sheet (portrait) or collapse the sidebar (landscape) for more radar space.',
      icon: '📱',
    },
  ];

  useEffect(() => {
    // Only show on mobile devices
    if (!isMobileDevice()) return;

    // Check if user has dismissed the tutorial
    const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY);
    if (!dismissed) {
      // Show tutorial after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handleSkip = () => {
    handleDismiss();
  };

  const handleDismiss = () => {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible || !isMobileDevice()) {
    return null;
  }

  const step = tutorialSteps[currentStep];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>{step.icon}</div>
        <div className={styles.title}>{step.title}</div>
        <div className={styles.description}>{step.description}</div>

        <div className={styles.progress}>
          {tutorialSteps.map((_, index) => (
            <div
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.active : ''}`}
            />
          ))}
        </div>

        <div className={styles.buttons}>
          <button className={styles.skipButton} onClick={handleSkip}>
            Skip
          </button>
          <button className={styles.nextButton} onClick={handleNext}>
            {currentStep < tutorialSteps.length - 1 ? 'Next' : 'Got It!'}
          </button>
        </div>
      </div>
    </div>
  );
}
