import { useState } from 'react';
import styles from './AdminLogin.module.css';

interface AdminLoginProps {
  onLogin: (password: string) => void;
  error?: string | null;
}

export function AdminLogin({ onLogin, error }: AdminLoginProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.trim()) {
      onLogin(password);
    }
  };

  const handleBack = () => {
    window.location.hash = '';
  };

  return (
    <div className={styles.container}>
      <div className={styles.scanline} />

      <div className={styles.loginBox}>
        <div className={styles.header}>
          <div className={styles.title}>ADMIN ACCESS</div>
          <div className={styles.subtitle}>Restricted Area</div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              PASSWORD:
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter admin password"
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && (
            <div className={styles.error}>
              ERROR: {error}
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.loginButton}>
              AUTHENTICATE
            </button>
            <button type="button" onClick={handleBack} className={styles.backButton}>
              BACK TO GAME
            </button>
          </div>
        </form>

        <div className={styles.footer}>
          <div className={styles.footerLine}>
            UNAUTHORIZED ACCESS WILL BE LOGGED
          </div>
        </div>
      </div>
    </div>
  );
}
