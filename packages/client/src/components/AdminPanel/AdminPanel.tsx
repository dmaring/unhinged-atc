import { useState, useEffect } from 'react';
import styles from './AdminPanel.module.css';

interface AdminPanelProps {
  password: string;
  onLogout: () => void;
}

interface ActivePlayer {
  id: string;
  username: string;
  email: string;
  joinedAt: number;
  commandsIssued: number;
  score: number;
}

interface QueuedPlayer {
  socketId: string;
  username: string;
  email: string;
  position: number;
  joinedQueueAt: number;
  waitTime: number;
}

interface GameState {
  score: number;
  planesCleared: number;
  crashCount: number;
  successfulLandings: number;
  nearMisses: number;
  collisions: number;
  aircraftCount: number;
  timeScale: number;
  gameTime: number;
}

interface AdminData {
  stats: {
    totalRooms: number;
    totalControllers: number;
    totalAircraft: number;
  };
  activePlayers: ActivePlayer[];
  queuedPlayers: QueuedPlayer[];
  gameState?: GameState;
}

export function AdminPanel({ password, onLogout }: AdminPanelProps) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/admin/status`, {
        headers: {
          'Authorization': `Bearer ${password}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch admin data');
      }

      const adminData = await response.json();
      setData(adminData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    // Auto-refresh every 2 seconds
    const interval = setInterval(fetchAdminData, 2000);

    return () => clearInterval(interval);
  }, [password]);

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    return `${seconds}s ago`;
  };

  const formatWaitTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatGameTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !data) {
    return (
      <div className={styles.container}>
        <div className={styles.scanline} />
        <div className={styles.loading}>LOADING ADMIN DATA...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.scanline} />
        <div className={styles.error}>
          <div className={styles.errorTitle}>ERROR</div>
          <div className={styles.errorMessage}>{error}</div>
          <button onClick={onLogout} className={styles.button}>
            BACK TO LOGIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scanline} />

      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>ADMIN CONSOLE</div>
            <div className={styles.subtitle}>System Status Monitor</div>
          </div>
          <button onClick={onLogout} className={styles.logoutButton}>
            LOGOUT
          </button>
        </div>

        {/* Game Statistics */}
        {data?.gameState && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>GAME STATUS</div>
            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>SCORE</div>
                <div className={styles.statValue}>{data.gameState.score}</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>AIRCRAFT</div>
                <div className={styles.statValue}>{data.gameState.aircraftCount}</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>CLEARED</div>
                <div className={styles.statValue}>{data.gameState.planesCleared}</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>CRASHES</div>
                <div className={styles.statValue}>{data.gameState.crashCount}</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>SPEED</div>
                <div className={styles.statValue}>{data.gameState.timeScale}x</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statLabel}>TIME</div>
                <div className={styles.statValue}>{formatGameTime(data.gameState.gameTime)}</div>
              </div>
            </div>
          </div>
        )}

        {/* System Stats */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>SYSTEM STATUS</div>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>ROOMS</div>
              <div className={styles.statValue}>{data?.stats.totalRooms || 0}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>CONTROLLERS</div>
              <div className={styles.statValue}>{data?.stats.totalControllers || 0}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>TOTAL AIRCRAFT</div>
              <div className={styles.statValue}>{data?.stats.totalAircraft || 0}</div>
            </div>
          </div>
        </div>

        {/* Active Players */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            ACTIVE PLAYERS ({data?.activePlayers.length || 0}/5)
          </div>
          {data?.activePlayers && data.activePlayers.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>USERNAME</th>
                    <th>EMAIL</th>
                    <th>JOINED</th>
                    <th>COMMANDS</th>
                    <th>SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activePlayers.map((player) => (
                    <tr key={player.id}>
                      <td>{player.username}</td>
                      <td>{player.email}</td>
                      <td>{formatTime(player.joinedAt)}</td>
                      <td>{player.commandsIssued}</td>
                      <td>{player.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>No active players</div>
          )}
        </div>

        {/* Queue */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            QUEUE ({data?.queuedPlayers.length || 0}/20)
          </div>
          {data?.queuedPlayers && data.queuedPlayers.length > 0 ? (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>POSITION</th>
                    <th>USERNAME</th>
                    <th>EMAIL</th>
                    <th>WAIT TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queuedPlayers.map((player) => (
                    <tr key={player.socketId}>
                      <td>#{player.position}</td>
                      <td>{player.username}</td>
                      <td>{player.email}</td>
                      <td>{formatWaitTime(player.waitTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>Queue is empty</div>
          )}
        </div>

        <div className={styles.footer}>
          Auto-refresh: 2s | Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
