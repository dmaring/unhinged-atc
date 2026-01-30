import { useState, useEffect } from 'react';
import styles from './NumericStepper.module.css';

interface NumericStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  label: string;
  onChange: (value: number) => void;
  onSubmit?: () => void;
}

export function NumericStepper({
  value,
  min,
  max,
  step,
  unit = '',
  label,
  onChange,
  onSubmit,
}: NumericStepperProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleIncrement = () => {
    const newValue = Math.min(max, localValue + step);
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, localValue - step);
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (inputValue === '') {
      setLocalValue(min);
      return;
    }

    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      setLocalValue(clampedValue);
      onChange(clampedValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className={styles.stepper}>
      <label className={styles.label}>{label}</label>
      <div className={styles.controls}>
        <button
          className={styles.decrementButton}
          onClick={handleDecrement}
          disabled={localValue <= min}
          type="button"
        >
          −
        </button>
        <div className={styles.valueDisplay}>
          <input
            type="number"
            className={styles.valueInput}
            value={localValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            min={min}
            max={max}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        <button
          className={styles.incrementButton}
          onClick={handleIncrement}
          disabled={localValue >= max}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
