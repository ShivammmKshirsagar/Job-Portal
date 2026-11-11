import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsProfileOpen(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 font-black text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition">
            Career<span className="text-blue-600">Connect</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <Link
            to="/jobs"
            className={`transition hover:text-blue-600 ${
              isActive('/jobs') ? 'text-blue-600 font-bold' : ''
            }`}
          >
            Search Jobs
          </Link>
          <Link
            to="/companies"
            className={`transition hover:text-blue-600 ${
              isActive('/companies') ? 'text-blue-600 font-bold' : ''
            }`}
          >
            Companies
          </Link>
          <Link
            to="/jobs?salaryMin=100000"
            className="transition hover:text-blue-600"
          >
            Salaries
          </Link>
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* Messages Center Link */}
              <Link
                to="/messages"
                className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
                title="Messages Center"
              >
                <span className="material-symbols-outlined text-[22px]">chat</span>
              </Link>

              {/* Notifications Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
                  aria-label="Notifications"
                >
                  <span className="material-symbols-outlined text-[22px]">notifications</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl z-50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <span className="font-bold text-sm text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div
                            key={n._id}
                            onClick={() => {
                              markAsRead(n._id);
                              if (n.link) navigate(n.link);
                              setIsNotifOpen(false);
                            }}
                            className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition ${
                              !n.read ? 'bg-blue-50/50' : ''
                            }`}
                          >
                            <p className="font-bold text-slate-900">{n.title}</p>
                            <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 p-1 pl-3 hover:border-slate-300 transition"
                >
                  <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">
                    {user?.name}
                  </span>
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 font-bold text-white text-xs">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      user?.name?.charAt(0) || 'U'
                    )}
                  </div>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                      <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 capitalize">
                        {user?.role}
                      </span>
                    </div>

                    {user?.role === 'candidate' && (
                      <Link
                        to="/candidate/dashboard"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">
                          dashboard
                        </span>
                        Candidate Dashboard
                      </Link>
                    )}

                    {user?.role === 'employer' && (
                      <Link
                        to="/employer/dashboard"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">
                          business_center
                        </span>
                        Employer Dashboard
                      </Link>
                    )}

                    {user?.role === 'admin' && (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[18px] text-slate-400">
                          admin_panel_settings
                        </span>
                        Admin Dashboard
                      </Link>
                    )}

                    <Link
                      to="/messages"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400">
                        chat
                      </span>
                      Messages
                    </Link>

                    <div className="border-t border-slate-100 my-1"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 text-left"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/auth?mode=login"
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:text-blue-600 transition"
              >
                Log In
              </Link>
              <Link
                to="/auth?mode=signup"
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          {isAuthenticated && (
            <Link
              to="/messages"
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-600"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
            </Link>
          )}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600"
            aria-label="Toggle Menu"
          >
            <span className="material-symbols-outlined">
              {isMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            <Link
              to="/jobs"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Search Jobs
            </Link>
            <Link
              to="/companies"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Companies
            </Link>
            <Link
              to="/jobs?salaryMin=100000"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Salaries
            </Link>

            <div className="my-2 border-t border-slate-100"></div>

            {isAuthenticated ? (
              <>
                {user?.role === 'candidate' && (
                  <Link
                    to="/candidate/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Candidate Dashboard
                  </Link>
                )}
                {user?.role === 'employer' && (
                  <Link
                    to="/employer/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Employer Dashboard
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Admin Dashboard
                  </Link>
                )}
                <Link
                  to="/messages"
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Messages Center
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-left text-sm font-semibold text-red-600"
                >
                  Log Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/auth?mode=login"
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-xl border border-slate-200 py-2.5 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?mode=signup"
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-xl bg-blue-600 py-2.5 text-center text-sm font-bold text-white shadow-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
