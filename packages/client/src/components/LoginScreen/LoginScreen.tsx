import { useState, useEffect } from 'react';
import { Filter } from 'bad-words';
import styles from './LoginScreen.module.css';

const filter = new Filter();

interface LoginScreenProps {
  onLogin: (username: string, email: string) => void;
  error?: string | null;
}

export function LoginScreen({ onLogin, error }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    // Boot animation
    setTimeout(() => setIsBooting(false), 1500);
  }, []);

  const validateUsername = (value: string): boolean => {
    setUsernameError('');

    if (!value || value.trim().length === 0) {
      setUsernameError('Screen name is required');
      return false;
    }

    if (value.length < 3) {
      setUsernameError('Screen name must be at least 3 characters');
      return false;
    }

    if (value.length > 20) {
      setUsernameError('Screen name must be 20 characters or less');
      return false;
    }

    // Check for profanity
    if (filter.isProfane(value)) {
      setUsernameError('Screen name contains inappropriate language');
      return false;
    }

    return true;
  };

  const validateEmail = (value: string): boolean => {
    setEmailError('');

    if (!value || value.trim().length === 0) {
      setEmailError('Email is required');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isUsernameValid = validateUsername(username);
    const isEmailValid = validateEmail(email);

    if (isUsernameValid && isEmailValid) {
      onLogin(username.trim(), email.trim());
    }
  };

  const handleUsernameBlur = () => {
    if (username) {
      validateUsername(username);
    }
  };

  const handleEmailBlur = () => {
    if (email) {
      validateEmail(email);
    }
  };

  if (isBooting) {
    return (
      <div className={styles.container}>
        <div className={styles.bootScreen}>
          <div className={styles.bootLine}>INITIALIZING UNHINGED ATC SYSTEM...</div>
          <div className={styles.bootLine}>LOADING CONTROL MODULES...</div>
          <div className={styles.bootLine}>ESTABLISHING TOWER CONNECTION...</div>
          <div className={styles.cursor}>_</div>
        </div>
        <div className={styles.scanline}></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <div className={styles.title}>UNHINGED ATC</div>
          <div className={styles.subtitle}>CROWDSOURCED AIR TRAFFIC CONTROL</div>
        </div>

        <div className={styles.content}>
          <div className={styles.welcome}>
            <div className={styles.prompt}>{'>'}</div>
            <div className={styles.text}>AUTHENTICATION REQUIRED</div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>
                <span className={styles.prompt}>{'$'}</span> SCREEN NAME
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={handleUsernameBlur}
                className={styles.input}
                placeholder="Enter your callsign..."
                autoFocus
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
              />
              {usernameError && (
                <div className={styles.error}>
                  <span className={styles.errorIcon}>⚠</span> {usernameError}
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                <span className={styles.prompt}>{'$'}</span> EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                className={styles.input}
                placeholder="pilot@example.com"
                autoComplete="email"
                spellCheck={false}
              />
              {emailError && (
                <div className={styles.error}>
                  <span className={styles.errorIcon}>⚠</span> {emailError}
                </div>
              )}
            </div>

            {error && (
              <div className={styles.serverError}>
                <span className={styles.errorIcon}>✖</span> {error}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!username || !email}
            >
              {'>'} JOIN AIRSPACE
            </button>
          </form>

          <div className={styles.info}>
            <div className={styles.infoLine}>
              • Your screen name will be visible to other controllers
            </div>
            <div className={styles.infoLine}>
              • Email is logged but never displayed to others
            </div>
            <div className={styles.infoLine}>
              • Choose wisely - you can't change it during the session
            </div>
          </div>
        </div>
      </div>
      <div className={styles.scanline}></div>
    </div>
  );
}
