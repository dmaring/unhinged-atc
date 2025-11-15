import { useState, useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { EventSeverity } from 'shared';
import styles from './NotificationPanel.module.css';

interface Notification {
  id: string;
  message: string;
  timestamp: number;
  type?: 'info' | 'warning' | 'alert' | 'system';
}

interface NotificationPanelProps {
  maxMessages?: number;
}

// Map game event severity to notification type
function mapSeverityToType(severity: EventSeverity): Notification['type'] {
  switch (severity) {
    case 'critical':
      return 'alert';
    case 'warning':
      return 'warning';
    case 'funny':
      return 'info';
    case 'info':
    default:
      return 'info';
  }
}

// Create boot messages once - outside component to avoid recreation
const BOOT_MESSAGES: Notification[] = [
  {
    id: 'boot-1',
    message: '> SYSTEM INITIALIZED',
    timestamp: Date.now() - 5000,
    type: 'system'
  },
  {
    id: 'boot-2',
    message: '> ATC TERMINAL v2.1 ONLINE',
    timestamp: Date.now() - 4000,
    type: 'system'
  },
  {
    id: 'boot-3',
    message: '> AWAITING TRAFFIC...',
    timestamp: Date.now() - 3000,
    type: 'info'
  }
];

export function NotificationPanel({ maxMessages = 50 }: NotificationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get game events from the store
  const gameEvents = useGameStore((state) => state.gameState?.recentEvents || []);

  // Convert game events to notifications and add system boot messages
  const notifications = useMemo(() => {
    const eventNotifications: Notification[] = gameEvents.map(event => ({
      id: event.id,
      message: event.message,
      timestamp: event.timestamp,
      type: mapSeverityToType(event.severity)
    }));

    // Combine boot messages with game events and limit to maxMessages
    const allNotifications = [...BOOT_MESSAGES, ...eventNotifications];
    return allNotifications.slice(-maxMessages);
  }, [gameEvents, maxMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [notifications]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getMessageClass = (type?: string) => {
    switch (type) {
      case 'warning':
        return styles.warning;
      case 'alert':
        return styles.alert;
      case 'system':
        return styles.system;
      default:
        return styles.info;
    }
  };

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>
            <span className={styles.prompt}>$</span> SYSTEM MESSAGES
          </div>
          <div className={styles.indicator}>
            <span className={styles.blink}>●</span> LIVE
          </div>
        </div>
        <button className={styles.collapseButton}>
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
        <div className={styles.content}>
          <div className={styles.messages}>
            {notifications.map((notification) => (
              <div key={notification.id} className={`${styles.message} ${getMessageClass(notification.type)}`}>
                <span className={styles.timestamp}>[{formatTimestamp(notification.timestamp)}]</span>
                <span className={styles.text}>{notification.message}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.inputLine}>
            <span className={styles.prompt}>{'>'}</span>
            <span className={styles.cursor}>_</span>
          </div>
        </div>
      )}
    </div>
  );
}
