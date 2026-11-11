import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const AuthPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated, role } = useAuth();
  const { showToast } = useNotification();

  // Mode: 'login' or 'signup'
  const modeParam = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState(modeParam);

  // Role: 'candidate' or 'employer'
  const [selectedRole, setSelectedRole] = useState('candidate');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'employer') {
        navigate('/employer/dashboard', { replace: true });
      } else {
        navigate('/candidate/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, role, navigate, location]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSearchParams({ mode: newMode });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        showToast({
          title: 'Welcome back!',
          message: `Logged in as ${res.user.name}`,
          type: 'success',
        });
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const payload = {
          name,
          email,
          password,
          role: selectedRole,
          companyName: selectedRole === 'employer' ? companyName : undefined,
          companyWebsite: selectedRole === 'employer' ? companyWebsite : undefined,
        };

        const res = await register(payload);
        showToast({
          title: 'Account Created',
          message: `Welcome to CareerConnect, ${res.user.name}!`,
          type: 'success',
        });
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Authentication failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center bg-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Split-Panel Authentication Container (Figure 8.6) */}
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl grid grid-cols-1 md:grid-cols-2">
        {/* Left Blue Promotional Panel */}
        <div className="bg-linear-to-br from-blue-600 to-blue-800 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 backdrop-blur-md text-white font-bold mb-6">
              <span className="material-symbols-outlined text-[22px]">hub</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">
              Accelerate your career trajectory.
            </h2>
            <p className="mt-4 text-xs sm:text-sm text-blue-100 leading-relaxed max-w-sm">
              Connect with top-tier organizations and discover roles that match your expertise and ambition.
            </p>
          </div>

          <div className="relative z-10 mt-12 pt-8 border-t border-blue-500/40">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-600 object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="User"
                />
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-600 object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                  alt="User"
                />
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-blue-600 object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                  alt="User"
                />
              </div>
              <span className="text-xs font-bold text-white">
                Join 50,000+ professionals
              </span>
            </div>
          </div>

          {/* Decorative Circles */}
          <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-blue-500/20 blur-2xl"></div>
          <div className="absolute top-1/4 -left-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-xl"></div>
        </div>

        {/* Right Form Container */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          {/* Role-Switcher Toggle (Figure 8.6) */}
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedRole('candidate')}
              className={`rounded-lg py-2 transition ${
                selectedRole === 'candidate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('employer')}
              className={`rounded-lg py-2 transition ${
                selectedRole === 'employer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Employer
            </button>
          </div>

          {/* Login / Sign Up Tabs */}
          <div className="flex border-b border-slate-200 mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              className={`flex-1 pb-3 text-center transition ${
                mode === 'login'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('signup')}
              className={`flex-1 pb-3 text-center transition ${
                mode === 'signup'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'signup' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Password</label>
                {mode === 'login' && (
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {mode === 'signup' && selectedRole === 'employer' && (
              <>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TechNova Solutions"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Company Website (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://technova.io"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {mode === 'login' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="remember" className="text-slate-600 font-medium">
                  Remember me for 30 days
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In →'
                : 'Create Account →'}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <span className="relative bg-white px-2 text-[10px] font-bold text-slate-400 uppercase">
              or
            </span>
          </div>

          {/* Social Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                showToast({
                  title: 'Demo OAuth',
                  message: 'Social sign-in simulated. Please use test email/password credentials.',
                  type: 'info',
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <span className="font-black text-red-500">G</span> Continue with Google
            </button>
            <button
              type="button"
              onClick={() => {
                showToast({
                  title: 'Demo OAuth',
                  message: 'Social sign-in simulated. Please use test email/password credentials.',
                  type: 'info',
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <span className="font-black text-blue-700">in</span> Continue with LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

