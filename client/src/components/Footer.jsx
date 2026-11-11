import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-blue-600 font-bold text-white text-xs">
            <span className="material-symbols-outlined text-[14px]">hub</span>
          </div>
          <p className="text-xs font-medium text-slate-600">
            © 2026 CareerConnect. Empowering careers everywhere.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
          <Link to="/jobs" className="hover:text-blue-600 transition">
            Explore Jobs
          </Link>
          <Link to="/companies" className="hover:text-blue-600 transition">
            Companies
          </Link>
          <a href="#privacy" className="hover:text-blue-600 transition">
            Privacy Policy
          </a>
          <a href="#terms" className="hover:text-blue-600 transition">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

