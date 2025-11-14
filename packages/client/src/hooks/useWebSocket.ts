import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { wsService } from '../services/websocket';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    const sock = wsService.connect();
    setSocket(sock);

    // Set up connection state listeners
    const onConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onError = (error: Error) => {
      setConnectionError(error.message);
    };

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('connect_error', onError);

    // Cleanup on unmount
    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('connect_error', onError);
      // Don't disconnect here - let the service manage it
    };
  }, []);

  return {
    socket,
    isConnected,
    connectionError,
  };
}
