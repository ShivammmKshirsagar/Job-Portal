import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { JobProvider } from './context/JobContext';

// Views
import HomePage from './pages/HomePage';
import JobListings from './pages/JobListings';
import JobDetailsPage from './pages/JobDetailsPage';
import CandidateDashboard from './pages/CandidateDashboard';
import EmployerDashboard from './pages/EmployerDashboard';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import CompanyProfilePage from './pages/CompanyProfilePage';
import CompanyListPage from './pages/CompanyListPage';
import MessagingPage from './pages/MessagingPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <JobProvider>
              <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased font-sans">
                <Navbar />
                <main className="flex-1">
                  <Routes>
                    {/* Public Views */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/jobs" element={<JobListings />} />
                    <Route path="/jobs/:id" element={<JobDetailsPage />} />
                    <Route path="/companies" element={<CompanyListPage />} />
                    <Route path="/companies/:id" element={<CompanyProfilePage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
                    <Route path="/register" element={<Navigate to="/auth?mode=signup" replace />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    {/* Candidate Protected Views */}
                    <Route
                      path="/candidate/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['candidate']}>
                          <CandidateDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Employer Protected Views */}
                    <Route
                      path="/employer/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['employer', 'admin']}>
                          <EmployerDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Admin Protected Views */}
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Messaging Protected View (Candidate & Employer) */}
                    <Route
                      path="/messages"
                      element={
                        <ProtectedRoute allowedRoles={['candidate', 'employer', 'admin']}>
                          <MessagingPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </JobProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
