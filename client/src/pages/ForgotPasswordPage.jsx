import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState('');
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) {
        showToast({
          title: 'Reset Token Generated',
          message: 'Please check your email or proceed below using the generated token.',
          type: 'info',
        });
        if (res.data.devResetToken) {
          setDevToken(res.data.devResetToken);
        }
      }
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
            <span className="material-symbols-outlined text-[24px]">lock_reset</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">Forgot Password</h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your account email to generate a secure password reset token.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Send Reset Instructions'}
          </button>
        </form>

        {devToken && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs">
            <span className="font-bold text-emerald-800 block">
              Development Mode Token:
            </span>
            <code className="mt-1 block font-mono bg-white p-2 rounded-lg border border-emerald-200 text-emerald-900 break-all select-all">
              {devToken}
            </code>
            <button
              onClick={() => navigate(`/reset-password?token=${devToken}`)}
              className="mt-3 w-full rounded-xl bg-emerald-600 py-2 text-center text-xs font-bold text-white hover:bg-emerald-700"
            >
              Continue to Reset Password →
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-xs font-semibold text-slate-500">
          Remember your password?{' '}
          <Link to="/auth?mode=login" className="text-blue-600 hover:underline">
            Back to Log In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

