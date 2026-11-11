import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { useNotification } from '../context/NotificationContext';
import { formatJobSalary } from '../utils/salary';

const JobDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, role } = useAuth();
  const { applyToJob } = useJobs();
  const { showToast } = useNotification();

  const [job, setJob] = useState(null);
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Application Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [selectedResumeFile, setSelectedResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchJobDetails = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/jobs/${id}`);
        if (res.data.success) {
          setJob(res.data.job);
          setRelatedJobs(res.data.relatedJobs || []);
          setHasApplied(res.data.hasApplied || false);
          setApplicationStatus(res.data.applicationStatus || null);
        }
      } catch (err) {
        console.error('Error fetching job:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
    window.scrollTo(0, 0);
  }, [id]);

  const handleApplyClick = () => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login', { state: { from: `/jobs/${id}` } });
      return;
    }
    if (role !== 'candidate') {
      showToast({
        title: 'Recruiter Notice',
        message: 'Only candidates can submit job applications.',
        type: 'info',
      });
      return;
    }
    setIsApplyModalOpen(true);
  };

  const handleMessageEmployer = () => {
    if (!isAuthenticated) {
      navigate('/auth?mode=login', { state: { from: `/jobs/${id}` } });
      return;
    }

    const employerId =
      job?.postedBy?._id ||
      job?.postedBy ||
      job?.companyId?.employerId?._id ||
      job?.companyId?.employerId;

    if (!employerId && !job?.companyId?._id) {
      showToast({
        title: 'Recruiter Unavailable',
        message: 'Direct messaging for this posting is currently being linked.',
        type: 'info',
      });
      return;
    }

    const params = new URLSearchParams();
    if (employerId) params.append('partnerId', employerId);
    if (job?._id) params.append('jobId', job._id);
    navigate(`/messages?${params.toString()}`);
  };

  const handleApplicationSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await applyToJob(job._id, {
        coverNote,
        portfolioUrl,
        resume: selectedResumeFile,
      });

      const wasWithdrawn = applicationStatus === 'Withdrawn';
      setHasApplied(true);
      setApplicationStatus('Applied');
      setIsApplyModalOpen(false);

      showToast({
        title: wasWithdrawn ? 'Application Re-submitted!' : 'Application Submitted!',
        message: `Your application for ${job.title} was delivered to ${job.companyId?.name}.`,
        type: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Application Failed',
        message: err.response?.data?.message || err.message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h2 className="text-2xl font-black text-slate-900">Job Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          This job posting may have been removed or closed.
        </p>
        <Link
          to="/jobs"
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          Back to Job Listings
        </Link>
      </div>
    );
  }

  const salaryDisplay = formatJobSalary(job);

  return (
    <div className="min-h-screen bg-slate-50 pb-28 pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/jobs" className="hover:text-blue-600 transition">
            Jobs
          </Link>
          <span>/</span>
          <span className="text-slate-700">{job.category || 'General'}</span>
          <span>/</span>
          <span className="text-slate-900 truncate max-w-xs">{job.title}</span>
        </div>

        {/* 2-Column Main Section (Figure 8.3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Job Description and Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Main Header Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-100 border border-slate-200 font-black text-blue-600 text-lg overflow-hidden shadow-xs">
                    {job.companyId?.logoUrl ? (
                      <img
                        src={job.companyId.logoUrl}
                        alt={job.companyId.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      job.companyId?.name?.slice(0, 2).toUpperCase() || 'CC'
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                      {job.title}
                    </h1>
                    <Link
                      to={`/companies/${job.companyId?._id}`}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
                    >
                      {job.companyId?.name || 'Company'}
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                    </Link>
                  </div>
                </div>

                <div className="flex sm:flex-col sm:items-end justify-between gap-1 text-xs text-slate-500">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
                    Active Recruiting
                  </span>
                  <span className="text-slate-400">
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Quick Tags */}
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                    location_on
                  </span>
                  {job.location}
                </span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                    schedule
                  </span>
                  {job.jobType}
                </span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                    workspace_premium
                  </span>
                  {job.experienceLevel || 'Mid Level'}
                </span>
                <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-700">
                  {salaryDisplay}
                </span>
              </div>
            </div>

            {/* About the Role */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-4">
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                About the Role
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>

            {/* Key Responsibilities */}
            {job.responsibilities && job.responsibilities.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-4">
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                  Key Responsibilities
                </h2>
                <ul className="space-y-3">
                  {job.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requirements & Required Skills */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                  Required Technical Skills
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.skillsRequired?.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {job.requirements && job.requirements.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Qualifications & Experience
                  </h3>
                  <ul className="space-y-2.5">
                    {job.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0 mt-0.5">
                          arrow_right
                        </span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Company Info and Similar Jobs */}
          <div className="space-y-6">
            {/* About Company Card */}
            {job.companyId && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                <h3 className="font-black text-slate-900 text-base">
                  About {job.companyId.name}
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Industry</span>
                    <span className="text-slate-800 font-bold">
                      {job.companyId.industry || 'Technology'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Company Size</span>
                    <span className="text-slate-800 font-bold">
                      {job.companyId.size || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Founded</span>
                    <span className="text-slate-800 font-bold">
                      {job.companyId.foundedYear || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Location</span>
                    <span className="text-slate-800 font-bold truncate block">
                      {job.companyId.location || job.location || 'Not specified'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleMessageEmployer}
                    className="rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-center text-xs font-bold text-blue-700 hover:bg-blue-100 transition flex items-center justify-center gap-1.5 cursor-pointer w-full"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Message Employer
                  </button>
                  {job.companyId.website && (
                    <a
                      href={job.companyId.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">public</span>
                      Visit Website
                    </a>
                  )}
                  <Link
                    to={`/companies/${job.companyId._id}`}
                    className="rounded-xl bg-blue-50 py-2.5 text-center text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    View Company Profile
                  </Link>
                </div>
              </div>
            )}

            {/* Similar Jobs */}
            {relatedJobs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="font-black text-slate-900 text-base">Similar Jobs</h3>
                <div className="divide-y divide-slate-100">
                  {relatedJobs.map((rJob) => (
                    <Link
                      key={rJob._id}
                      to={`/jobs/${rJob._id}`}
                      className="block py-3 hover:bg-slate-50 transition group rounded-lg px-2"
                    >
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                        {rJob.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {rJob.companyId?.name} • {rJob.location}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Figure 8.3) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md py-4 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <h3 className="text-base font-black text-slate-900 hidden sm:block">
              {job.title}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {job.companyId?.name} • <span className="text-blue-600 font-bold">{salaryDisplay}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMessageEmployer}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">chat</span>
              Message Employer
            </button>
            {hasApplied && applicationStatus !== 'Withdrawn' ? (
              <button
                disabled
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-7 py-3 text-sm font-bold text-emerald-700 cursor-not-allowed flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Applied ({applicationStatus || 'Under Review'})
              </button>
            ) : applicationStatus === 'Withdrawn' ? (
              <div className="flex items-center gap-2">
                <span
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3 text-xs font-bold text-slate-500 flex items-center gap-1.5"
                  title="Your previous application was withdrawn"
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-400">cancel</span>
                  Application Withdrawn
                </span>
                <button
                  type="button"
                  onClick={handleApplyClick}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  Apply Again
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleApplyClick}
                className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer"
              >
                Apply Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Application Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {applicationStatus === 'Withdrawn'
                    ? `Re-apply for ${job.title}`
                    : `Apply for ${job.title}`}
                </h3>
                <p className="text-xs text-slate-500">{job.companyId?.name}</p>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleApplicationSubmit} className="mt-6 space-y-4">
              {/* Resume Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Resume / CV (PDF or DOCX, max 5MB)
                </label>
                {user?.resumeUrl ? (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600 text-[18px]">
                        description
                      </span>
                      <span className="font-semibold text-slate-800">
                        {user.resumeOriginalName || 'Current Profile Resume'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700">DEFAULT</span>
                  </div>
                ) : null}

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setSelectedResumeFile(e.target.files[0])}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {/* Cover Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cover Note / Pitch (Optional)
                </label>
                <textarea
                  rows={4}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Introduce yourself and explain why you're a great fit for this role..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              {/* Portfolio Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Portfolio / GitHub Link (Optional)
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://myportfolio.dev"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : applicationStatus === 'Withdrawn'
                    ? 'Re-submit Application'
                    : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailsPage;

