import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const CompanyListPage = () => {
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (industry && industry !== 'All') params.append('industry', industry);

        const res = await api.get(`/companies?${params.toString()}`);
        if (res.data.success) {
          setCompanies(res.data.companies);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [search, industry]);

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-black text-slate-900">Explore Top Companies</h1>
          <p className="mt-2 text-sm text-slate-600">
            Research company culture, benefits, headquarters, and open job roles across innovative teams.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs">
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input
              type="text"
              placeholder="Search by company name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-medium text-slate-900 focus:outline-none"
            />
          </div>

          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs focus:outline-none"
          >
            <option value="All">All Industries</option>
            <option value="Enterprise Software">Enterprise Software</option>
            <option value="Design & Marketing">Design & Marketing</option>
            <option value="FinTech">FinTech</option>
            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
            <option value="Consumer Tech">Consumer Tech</option>
          </select>
        </div>

        {/* Grid of Companies */}
        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse"></div>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            No companies found matching your search.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <Link
                key={company._id}
                to={`/companies/${company._id}`}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg transition"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-800 text-base overflow-hidden">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
                    ) : (
                      company.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition text-base">
                      {company.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{company.industry || 'Technology'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{company.location}</p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {company.description || 'Innovative organization hiring ambitious professionals.'}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                  <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                    {company.openRoles || 0} Open Positions
                  </span>
                  <span className="font-semibold text-slate-500 group-hover:text-blue-600 transition flex items-center gap-1">
                    View Profile
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyListPage;

