import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('careerconnect_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('careerconnect_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
          }
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem('careerconnect_token');
          localStorage.removeItem('careerconnect_user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('careerconnect_token', res.data.token);
      localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
      return res.data;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    if (res.data.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('careerconnect_token', res.data.token);
      localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
      return res.data;
    }
    throw new Error(res.data.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore error on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('careerconnect_token');
      localStorage.removeItem('careerconnect_user');
    }
  };

  const updateProfile = async (profileData) => {
    const res = await api.put('/users/profile', profileData);
    if (res.data.success) {
      setUser(res.data.user);
      localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
      return res.data;
    }
  };

  const uploadResume = async (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await api.post('/users/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (res.data.success) {
      setUser(res.data.user);
      localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
      return res.data;
    }
  };

  const deleteResume = async () => {
    const res = await api.delete('/users/resume');
    if (res.data.success) {
      setUser(res.data.user);
      localStorage.setItem('careerconnect_user', JSON.stringify(res.data.user));
      return res.data;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        role: user?.role || null,
        login,
        register,
        logout,
        updateProfile,
        uploadResume,
        deleteResume,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
