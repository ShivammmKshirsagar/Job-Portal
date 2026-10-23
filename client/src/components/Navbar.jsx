import React, { useState } from 'react';
import { useJobs } from '../context/JobContext';

const Navbar = () => {
  // useState for responsive navigation
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // useContext for shared application state
  const { registeredJobs } = useJobs();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 text-white shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">

        {/* Logo */}
        <a
          href="#jobs"
          className="flex items-center gap-3"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 font-black shadow-lg shadow-blue-900/30">
            J
          </div>

          <div>
            <p className="text-lg font-black tracking-tight">
              JobConnect
            </p>

            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:block">
              Career marketplace
            </p>
          </div>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-7 md:flex">

          <a
            href="#jobs"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            Find Jobs
          </a>

          <a
            href="#registered"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            My Applications

            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {registeredJobs.length}
            </span>
          </a>

          <button
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold transition hover:border-blue-500 hover:bg-slate-800"
          >
            Employer Login
          </button>

        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() =>
            setIsMenuOpen((open) => !open)
          }
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-700 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined">
            {isMenuOpen ? 'close' : 'menu'}
          </span>
        </button>

      </div>

      {/* Conditional rendering of mobile menu */}
      {isMenuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-4 pb-5 pt-4 md:hidden">

          <div className="flex flex-col gap-3">

            <a
              href="#jobs"
              onClick={() =>
                setIsMenuOpen(false)
              }
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              Find Jobs
            </a>

            <a
              href="#registered"
              onClick={() =>
                setIsMenuOpen(false)
              }
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 hover:text-white"
            >
              My Applications ({registeredJobs.length})
            </a>

            <button className="rounded-lg bg-blue-600 px-3 py-2 text-left text-sm font-semibold text-white">
              Employer Login
            </button>

          </div>

        </div>
      )}
    </nav>
  );
};

export default Navbar;