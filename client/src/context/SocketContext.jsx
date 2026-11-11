import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getBackendOrigin } from '../services/api';

const SocketContext = createContext(null);

/**
 * Resolves the Socket.IO server connection URL.
 * 1. Uses explicit VITE_SOCKET_URL if configured.
 * 2. Derives origin from VITE_API_URL (e.g. Render backend).
 * 3. Falls back to window.location.origin for local development (uses Vite proxy).
 */
export const getSocketUrl = () => {
  const socketEnv = import.meta.env.VITE_SOCKET_URL;
  if (socketEnv && socketEnv.trim()) {
    return socketEnv.trim().replace(/\/+$/, '');
  }
  const backendOrigin = getBackendOrigin();
  if (backendOrigin) {
    return backendOrigin;
  }
  return window.location.origin;
};

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const socketUrl = getSocketUrl();

    // Initialize authenticated socket
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('[SocketClient] Connected to server at:', socketUrl, 'ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[SocketClient] Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
