import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatJobSalary } from '../utils/salary';

const CompanyProfilePage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('about'); // 'about', 'culture', 'roles'
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  // Edit Company Profile modal for owner
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: '',
    size: '',
    location: '',
    website: '',
    description: '',
    culture: '',
  });

  useEffect(() => {
    const fetchCompanyData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/companies/${id}`);
        if (res.data.success) {
          setCompany(res.data.company);
          setJobs(res.data.jobs || []);
          setCompanyForm({
            name: res.data.company.name || '',
            industry: res.data.company.industry || '',
            size: res.data.company.size || '',
            location: res.data.company.location || '',
            website: res.data.company.website || '',
            description: res.data.company.description || '',
            culture: res.data.company.culture || '',
          });
        }
      } catch (err) {
        console.error('Failed to load company profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
    window.scrollTo(0, 0);
  }, [id]);

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/companies/${id}`, companyForm);
      if (res.data.success) {
        setCompany(res.data.company);
        setIsEditModalOpen(false);
        showToast({
          title: 'Profile Updated',
          message: 'Company profile details updated successfully.',
          type: 'success',
        });
      }
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const isOwner =
    user && (user.role === 'admin' || user._id === company?.employerId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading company profile...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h2 className="text-2xl font-black text-slate-900">Company Not Found</h2>
        <Link
          to="/companies"
          className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
        >
          Browse All Companies
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Company Banner (Figure 8.8) */}
      <div className="relative h-56 sm:h-72 w-full bg-slate-900 overflow-hidden">
        {company.bannerUrl ? (
          <img
            src={company.bannerUrl}
            alt={company.name}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="h-full w-full bg-linear-to-r from-blue-900 to-indigo-950 opacity-90"></div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Company Header Identity Card */}
        <div className="relative -mt-16 sm:-mt-20 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Logo Box */}
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white border-2 border-slate-100 shadow-md overflow-hidden">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-black text-blue-600 text-3xl">
                    {company.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                    {company.name}
                  </h1>
                  <span
                    className="material-symbols-outlined text-blue-600 text-[20px]"
                    title="Verified Company"
                  >
                    verified
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">
                      domain
                    </span>
                    {company.industry || 'Technology'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">
                      groups
                    </span>
                    {company.size || '500-1000 Employees'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">
                      location_on
                    </span>
                    {company.location || 'Bengaluru, Karnataka'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {isOwner && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                >
                  Edit Profile
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  showToast({
                    title: 'Comparison Tool',
                    message: `Added ${company.name} to side-by-side comparison list.`,
                    type: 'info',
                  });
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFollowing(!isFollowing);
                  showToast({
                    title: isFollowing ? 'Unfollowed' : 'Following Company',
                    message: isFollowing
                      ? `You unfollowed ${company.name}`
                      : `You will receive updates whenever ${company.name} posts new jobs.`,
                    type: 'success',
                  });
                }}
                className={`rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-xs ${
                  isFollowing
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isFollowing ? 'Following ✓' : 'Follow Company'}
              </button>
            </div>
          </div>

          {/* Tab Navigation (Figure 8.8) */}
          <div className="mt-8 flex border-b border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('about')}
              className={`pb-3 pr-6 transition ${
                activeTab === 'about'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              About Us
            </button>
            <button
              onClick={() => setActiveTab('culture')}
              className={`pb-3 px-6 transition ${
                activeTab === 'culture'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Culture & Tech
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`pb-3 px-6 transition flex items-center gap-1.5 ${
                activeTab === 'roles'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Open Roles
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {jobs.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Mission & Highlights */}
              <div className="lg:col-span-2 space-y-6">
                {/* Mission Statement (Figure 8.8) */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-3">
                  <h3 className="font-black text-slate-900 text-base">Mission Statement</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {company.description ||
                      `At ${company.name}, we are building the operational nervous system for modern enterprises. We believe that software should be intuitive, seamlessly integrated, and genuinely enjoyable to use.`}
                  </p>
                </div>

                {/* Feature Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 mb-3">
                      <span className="material-symbols-outlined text-[20px]">trending_up</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Rapid Growth</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      Expanding our global footprint with over 200% YoY growth and a passionate customer base.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 mb-3">
                      <span className="material-symbols-outlined text-[20px]">public</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Remote First</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      Work from anywhere. We support a distributed team across multiple countries and timezones.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Headquarters & Key Stats */}
              <div className="space-y-6">
                {/* Headquarters Box */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-blue-600 text-[18px]">
                      location_city
                    </span>
                    Headquarters
                  </h3>

                  {/* Mini Map Visual Representation */}
                  <div className="h-32 w-full rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                    <div className="relative flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white grid place-items-center shadow-lg shadow-blue-500/50">
                        <span className="material-symbols-outlined text-[18px]">place</span>
                      </div>
                      <span className="mt-1 text-[11px] font-bold text-blue-900">
                        {company.location || 'Bengaluru'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {company.location || 'Outer Ring Road, Bengaluru, Karnataka 560103'}<br />
                    India
                  </p>
                </div>

                {/* Key Stats Box */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                  <h3 className="font-black text-slate-900 text-sm">Key Stats</h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Founded</span>
                      <span className="font-bold text-slate-800">{company.foundedYear || 2015}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Funding Stage</span>
                      <span className="font-bold text-slate-800">{company.stage || 'Series B'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Website</span>
                      <a
                        href={company.website || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-blue-600 hover:underline"
                      >
                        {company.website?.replace('https://', '') || 'technova.io'}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'culture' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
              <h3 className="text-lg font-black text-slate-900">Engineering & Culture</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {company.culture ||
                  `${company.name} fosters a culture of radical transparency, technical curiosity, and ownership. Our teams have high autonomy to explore new architectures, propose modern technologies, and iterate fast.`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-900 text-xs">Tech Stack</h4>
                  <p className="mt-1 text-xs text-slate-500">React, TypeScript, Node.js, MongoDB, WebSockets, Tailwind CSS</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-900 text-xs">Work Perks</h4>
                  <p className="mt-1 text-xs text-slate-500">Flexible hours, remote equipment stipend, unlimited PTO, health insurance</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-900 text-xs">Team Rituals</h4>
                  <p className="mt-1 text-xs text-slate-500">Weekly tech talks, virtual coffee chats, quarterly offsite retreats</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="text-lg font-black text-slate-900 mb-6">
                Active Openings at {company.name}
              </h3>

              {jobs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  There are currently no active job postings for this company.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {jobs.map((job) => (
                    <div
                      key={job._id}
                      className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <Link
                          to={`/jobs/${job._id}`}
                          className="text-base font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{job.location}</span>
                          <span>•</span>
                          <span>{job.jobType}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-800">
                            {formatJobSalary(job, 'Competitive')}
                          </span>
                        </div>
                      </div>

                      <Link
                        to={`/jobs/${job._id}`}
                        className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs text-center"
                      >
                        View & Apply
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Company Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Edit Company Profile</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Size</label>
                  <input
                    type="text"
                    value={companyForm.size}
                    placeholder="500-1000 Employees"
                    onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={companyForm.location}
                    onChange={(e) => setCompanyForm({ ...companyForm, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">About Company / Mission</label>
                <textarea
                  rows={3}
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfilePage;

