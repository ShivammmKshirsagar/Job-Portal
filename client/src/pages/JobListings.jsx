import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import JobCard from '../components/JobCard';

const JobListings = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state initialized from URL query params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [selectedJobTypes, setSelectedJobTypes] = useState(
    searchParams.get('jobType') ? [searchParams.get('jobType')] : []
  );
  const [selectedExperience, setSelectedExperience] = useState(
    searchParams.get('experienceLevel') ? [searchParams.get('experienceLevel')] : []
  );
  const [salaryMin, setSalaryMin] = useState(searchParams.get('salaryMin') || 40000);
  const [salaryMax, setSalaryMax] = useState(searchParams.get('salaryMax') || 250000);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'recent');
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );

  // Quick filter state
  const [activeQuickFilter, setActiveQuickFilter] = useState('');

  // Results state from backend
  const [jobs, setJobs] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Fetch jobs from backend API
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (search) params.append('search', search);
      if (location) params.append('location', location);
      if (selectedJobTypes.length > 0) {
        params.append('jobType', selectedJobTypes[0]);
      }
      if (selectedExperience.length > 0) {
        params.append('experienceLevel', selectedExperience[0]);
      }
      if (salaryMin) params.append('salaryMin', salaryMin);
      if (salaryMax && salaryMax < 250000) params.append('salaryMax', salaryMax);
      if (sortBy) params.append('sort', sortBy);
      params.append('page', currentPage);
      params.append('limit', 10);

      const res = await api.get(`/jobs?${params.toString()}`);
      if (res.data.success) {
        setJobs(res.data.jobs);
        setTotalJobs(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, location, selectedJobTypes, selectedExperience, salaryMin, salaryMax, sortBy, currentPage]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Sync state to URL
  const updateUrlParams = (newParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    updateUrlParams({ search, location, page: 1 });
    fetchJobs();
  };

  const handleQuickFilter = (filter) => {
    if (activeQuickFilter === filter) {
      setActiveQuickFilter('');
      setSelectedJobTypes([]);
      setSearch('');
      setSalaryMin(40000);
      return;
    }

    setActiveQuickFilter(filter);
    setCurrentPage(1);

    if (filter === 'Remote') {
      setSelectedJobTypes(['Remote']);
      setLocation('Remote');
    } else if (filter === 'Full-Time') {
      setSelectedJobTypes(['Full-Time']);
    } else if (filter === '$100k+') {
      setSalaryMin(100000);
    } else if (filter === 'Tech') {
      setSearch('Frontend Developer React Software Engineer');
    } else if (filter === 'Design') {
      setSearch('Designer UI UX');
    }
  };

  const handleJobTypeToggle = (type) => {
    setSelectedJobTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  const handleExperienceToggle = (exp) => {
    setSelectedExperience((prev) =>
      prev.includes(exp) ? prev.filter((e) => e !== exp) : [...prev, exp]
    );
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setLocation('');
    setSelectedJobTypes([]);
    setSelectedExperience([]);
    setSalaryMin(40000);
    setSalaryMax(250000);
    setSortBy('recent');
    setActiveQuickFilter('');
    setCurrentPage(1);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Search Card (Figure 8.2) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 md:flex-row md:items-center"
          >
            {/* Keyword Input */}
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="material-symbols-outlined text-[20px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Job title, keywords, or company"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Location Input */}
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="material-symbols-outlined text-[20px] text-slate-400">
                location_on
              </span>
              <input
                type="text"
                placeholder="City, state, or zip"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            >
              Find Jobs
            </button>
          </form>

          {/* Quick Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="font-bold text-slate-400 mr-1">Quick filters:</span>
            {['Remote', 'Full-Time', '$100k+', 'Tech', 'Design'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => handleQuickFilter(filter)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  activeQuickFilter === filter
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Filter Sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="font-black text-slate-900 text-base">Filters</h3>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Clear All
                </button>
              </div>

              {/* Job Type */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Job Type
                </h4>
                <div className="space-y-2.5">
                  {[
                    { label: 'Full-Time', count: '2,451' },
                    { label: 'Contract', count: '842' },
                    { label: 'Part-Time', count: '320' },
                    { label: 'Remote', count: '1,120' },
                  ].map(({ label }) => (
                    <label
                      key={label}
                      className="flex items-center justify-between text-sm text-slate-700 cursor-pointer hover:text-blue-600"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedJobTypes.includes(label)}
                          onChange={() => handleJobTypeToggle(label)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Experience Level
                </h4>
                <div className="space-y-2.5">
                  {['Entry Level', 'Mid Level', 'Senior Level', 'Lead / Executive'].map(
                    (level) => (
                      <label
                        key={level}
                        className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer hover:text-blue-600"
                      >
                        <input
                          type="checkbox"
                          checked={selectedExperience.includes(level)}
                          onChange={() => handleExperienceToggle(level)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{level}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Salary Estimate Slider */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Salary Estimate
                  </h4>
                  <span className="text-xs font-bold text-blue-600">
                    ${(salaryMin / 1000).toFixed(0)}k - ${(salaryMax / 1000).toFixed(0)}k+
                  </span>
                </div>
                <input
                  type="range"
                  min="40000"
                  max="250000"
                  step="5000"
                  value={salaryMin}
                  onChange={(e) => {
                    setSalaryMin(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-1">
                  <span>$40k</span>
                  <span>$250k+</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: Job Listings Feed */}
          <main className="lg:col-span-3">
            {/* Header & Sort Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <p className="text-sm font-semibold text-slate-600">
                Showing{' '}
                <span className="font-bold text-slate-900">
                  {jobs.length > 0 ? (currentPage - 1) * 10 + 1 : 0} -{' '}
                  {Math.min(currentPage * 10, totalJobs)}
                </span>{' '}
                of <span className="font-bold text-slate-900">{totalJobs}</span> jobs
              </p>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="salary-desc">Salary: High to Low</option>
                  <option value="salary-asc">Salary: Low to High</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {/* List of Job Cards */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-36 rounded-2xl bg-white border border-slate-200 animate-pulse"
                  ></div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                  <span className="material-symbols-outlined text-[24px]">search_off</span>
                </div>
                <h3 className="font-black text-slate-900 text-lg">No jobs match your criteria</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  Try adjusting your search terms, removing filters, or searching for other roles.
                </p>
                <button
                  onClick={handleClearFilters}
                  className="mt-4 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard key={job._id} job={job} />
                ))}
              </div>
            )}

            {/* Pagination Controls matching Figure 8.2 */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
                  aria-label="Previous Page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && p - arr[idx - 1] > 1 && (
                        <span className="px-1 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`grid h-9 w-9 place-items-center rounded-lg text-xs font-bold transition ${
                          currentPage === p
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
                  aria-label="Next Page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default JobListings;
