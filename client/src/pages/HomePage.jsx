import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import JobCard from '../components/JobCard';

const HomePage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationTerm, setLocationTerm] = useState('');
  const [featuredJobs, setFeaturedJobs] = useState([]);
  const [topCompanies, setTopCompanies] = useState([]);
  const [publicStats, setPublicStats] = useState({
    activeJobs: 0,
    hiringCompanies: 0,
    totalCandidates: 0,
  });
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, companiesRes, statsRes] = await Promise.all([
          api.get('/jobs/featured'),
          api.get('/companies/top-hiring'),
          api.get('/jobs/public-stats').catch(() => ({ data: { success: false } })),
        ]);

        if (jobsRes.data?.success) {
          setFeaturedJobs(jobsRes.data.jobs);
        }
        if (companiesRes.data?.success) {
          setTopCompanies(companiesRes.data.companies);
        }
        if (statsRes.data?.success && statsRes.data.stats) {
          setPublicStats(statsRes.data.stats);
        }
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (searchTerm) query.append('search', searchTerm);
    if (locationTerm) query.append('location', locationTerm);
    navigate(`/jobs?${query.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200 py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Find your next great opportunity
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Connect with thousands of top companies hiring right now. Effortlessly search for roles that match your ambition.
          </p>

          {/* Search Box */}
          <form
            onSubmit={handleSearch}
            className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-200/50 sm:flex-row sm:items-center sm:p-2"
          >
            {/* Keyword Input */}
            <div className="flex flex-1 items-center gap-3 px-3 py-2 sm:border-r sm:border-slate-200">
              <span className="material-symbols-outlined text-[20px] text-slate-400">
                search
              </span>
              <input
                type="text"
                placeholder="Job title, keywords, or company"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Location Input */}
            <div className="flex flex-1 items-center gap-3 px-3 py-2">
              <span className="material-symbols-outlined text-[20px] text-slate-400">
                location_on
              </span>
              <input
                type="text"
                placeholder="City, state, or 'Remote'"
                value={locationTerm}
                onChange={(e) => setLocationTerm(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 sm:py-3"
            >
              Search Jobs
            </button>
          </form>

          {/* Quick Metrics Cards */}
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-2xl font-black text-slate-900 sm:text-3xl">
                {publicStats.activeJobs > 0 ? `${publicStats.activeJobs}+` : 0}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Jobs
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-2xl font-black text-slate-900 sm:text-3xl">
                {publicStats.hiringCompanies > 0 ? `${publicStats.hiringCompanies}+` : 0}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Hiring Companies
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-2xl font-black text-slate-900 sm:text-3xl">
                {publicStats.totalCandidates > 0 ? `${publicStats.totalCandidates}+` : 0}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered Candidates
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Jobs Section */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1.5 rounded-full bg-blue-600"></div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                Featured Jobs
              </h2>
            </div>
            <Link
              to="/jobs"
              className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              View all jobs
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 rounded-2xl bg-white animate-pulse border border-slate-200"></div>
              ))}
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No featured jobs available right now. Browse our full listings!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredJobs.map((job) => (
                <JobCard key={job._id} job={job} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Hiring Companies Section */}
      <section className="border-t border-slate-200 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-6 w-1.5 rounded-full bg-blue-600"></div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Top Hiring Companies
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topCompanies.map((company) => (
              <Link
                key={company._id}
                to={`/companies/${company._id}`}
                className="group flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 text-center transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg shadow-xs"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-800 text-lg overflow-hidden shadow-xs group-hover:scale-105 transition">
                  {company.logoUrl && company.logoUrl.startsWith('http') ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-black text-blue-600">
                      {company.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition truncate max-w-[180px]">
                    {company.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    {company.size || '500-1000 Employees'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {company.location}
                  </p>
                </div>

                <div className="mt-5 w-full">
                  <span className="inline-block w-full rounded-xl bg-blue-50 py-2 text-xs font-bold text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                    {company.openRoles || 4} Open Roles
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

