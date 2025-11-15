import { useState, useEffect, useRef } from 'react';
import styles from './ResetConfirmationModal.module.css';

interface ResetConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResetConfirmationModal({
  isOpen,
  onConfirm,
  onCancel
}: ResetConfirmationModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect platform for shortcut hint
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutHint = isMac ? 'Cmd+Shift+Alt+R' : 'Ctrl+Shift+Alt+R';

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.toUpperCase() === 'RESET') {
      onConfirm();
      setInputValue('');
    } else {
      // Shake animation on wrong input
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={`${styles.modal} ${isShaking ? styles.shake : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.prompt}>!</span>
          <span className={styles.title}>ADMIN RESET CONFIRMATION</span>
          <span className={styles.blink}>●</span>
        </div>

        <div className={styles.content}>
          <div className={styles.warning}>
            <div className={styles.warningLine}>
              <span className={styles.warningIcon}>⚠</span> WARNING: GAME RESET IMMINENT
            </div>
            <div className={styles.warningText}>
              This action will reset the entire game state for ALL players:
            </div>
            <ul className={styles.resetList}>
              <li>All aircraft will be cleared</li>
              <li>All scores and statistics will be reset</li>
              <li>All game events will be cleared</li>
              <li>New aircraft will spawn immediately</li>
            </ul>
            <div className={styles.warningText}>
              This action cannot be undone.
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="reset-input" className={styles.label}>
              Type <span className={styles.highlight}>RESET</span> to confirm:
            </label>
            <input
              ref={inputRef}
              id="reset-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="Type RESET here..."
              autoComplete="off"
              spellCheck={false}
            />
          </form>

          <div className={styles.buttons}>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={inputValue.toUpperCase() !== 'RESET'}
              className={`${styles.button} ${styles.confirmButton}`}
            >
              [CONFIRM RESET]
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${styles.button} ${styles.cancelButton}`}
            >
              [CANCEL]
            </button>
          </div>

          <div className={styles.hint}>
            Press ESC to cancel • Shortcut: {shortcutHint}
          </div>
        </div>
      </div>
    </div>
  );
}
