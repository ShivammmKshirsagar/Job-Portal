import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { openFile } from '../services/fileService';

const EmployerDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalPostings: 0,
    activeJobs: 0,
    totalApplicants: 0,
    pendingApplicants: 0,
    inReviewApplicants: 0,
    shortlistedApplicants: 0,
    rejectedApplicants: 0,
  });
  const [loading, setLoading] = useState(true);

  // Post / Edit Job modal state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({
    title: '',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    location: '',
    salaryMin: 800000,
    salaryMax: 1500000,
    description: '',
    responsibilities: '',
    requirements: '',
    skillsRequired: '',
  });

  // View Applicants modal state
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
  const [selectedJobForApplicants, setSelectedJobForApplicants] = useState(null);
  const [jobApplicants, setJobApplicants] = useState([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  // Fetch employer's jobs
  const fetchMyJobs = useCallback(async () => {
    try {
      const res = await api.get('/jobs/employer/my-jobs');
      if (res.data.success) {
        setJobs(res.data.jobs);
        if (res.data.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load employer jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyJobs();
  }, [fetchMyJobs]);

  const handleOpenJobModal = (jobToEdit = null) => {
    if (jobToEdit) {
      setEditingJob(jobToEdit);
      setJobForm({
        title: jobToEdit.title,
        category: jobToEdit.category || 'Development',
        jobType: jobToEdit.jobType || 'Full-Time',
        experienceLevel: jobToEdit.experienceLevel || 'Mid Level',
        location: jobToEdit.location || '',
        salaryMin: jobToEdit.salaryMin || 80000,
        salaryMax: jobToEdit.salaryMax || 120000,
        description: jobToEdit.description || '',
        responsibilities: jobToEdit.responsibilities?.join('\n') || '',
        requirements: jobToEdit.requirements?.join('\n') || '',
        skillsRequired: jobToEdit.skillsRequired?.join(', ') || '',
      });
    } else {
      setEditingJob(null);
      setJobForm({
        title: '',
        category: 'Development',
        jobType: 'Full-Time',
        experienceLevel: 'Mid Level',
        location: 'Bengaluru, Karnataka (Hybrid)',
        salaryMin: 800000,
        salaryMax: 1500000,
        description: '',
        responsibilities: '',
        requirements: '',
        skillsRequired: '',
      });
    }
    setIsJobModalOpen(true);
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: jobForm.title,
        category: jobForm.category,
        jobType: jobForm.jobType,
        experienceLevel: jobForm.experienceLevel,
        location: jobForm.location,
        salaryMin: Number(jobForm.salaryMin),
        salaryMax: Number(jobForm.salaryMax),
        description: jobForm.description,
        responsibilities: jobForm.responsibilities
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
        requirements: jobForm.requirements
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
        skillsRequired: jobForm.skillsRequired
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (editingJob) {
        await api.put(`/jobs/${editingJob._id}`, payload);
        showToast({ title: 'Success', message: 'Job posting updated.', type: 'success' });
      } else {
        await api.post('/jobs', payload);
        showToast({ title: 'Success', message: 'New job posted successfully.', type: 'success' });
      }

      setIsJobModalOpen(false);
      fetchMyJobs();
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.response?.data?.message || err.message,
        type: 'error',
      });
    }
  };

  const handleToggleStatus = async (jobId) => {
    try {
      const res = await api.patch(`/jobs/${jobId}/status`);
      if (res.data.success) {
        setJobs((prev) =>
          prev.map((j) => (j._id === jobId ? { ...j, status: res.data.job.status } : j))
        );
        showToast({
          title: 'Status Updated',
          message: `Job is now ${res.data.job.status}.`,
          type: 'info',
        });
      }
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job posting? This cannot be undone.')) {
      return;
    }
    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
      showToast({ title: 'Deleted', message: 'Job removed.', type: 'info' });
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const handleOpenApplicants = async (job) => {
    setSelectedJobForApplicants(job);
    setIsApplicantsModalOpen(true);
    setApplicantsLoading(true);
    try {
      const res = await api.get(`/applications/job/${job._id}`);
      if (res.data.success) {
        setJobApplicants(res.data.applications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setApplicantsLoading(false);
    }
  };

  const handleUpdateApplicantStatus = async (applicationId, newStatus) => {
    try {
      const res = await api.patch(`/applications/${applicationId}/status`, {
        status: newStatus,
      });
      if (res.data.success) {
        setJobApplicants((prev) =>
          prev.map((app) => (app._id === applicationId ? { ...app, status: newStatus } : app))
        );
        showToast({
          title: 'Applicant Status Updated',
          message: `Candidate is now marked as "${newStatus}".`,
          type: 'success',
        });
      }
    } catch (err) {
      showToast({ title: 'Error', message: err.message, type: 'error' });
    }
  };

  const totalApplicants =
    metrics.totalApplicants ?? jobs.reduce((sum, j) => sum + (j.applicantCount || 0), 0);
  const activeCount = metrics.activeJobs ?? jobs.filter((j) => j.status === 'Active').length;
  const shortlistedCount = metrics.shortlistedApplicants ?? 0;
  const pendingCount = metrics.pendingApplicants ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header (Figure 8.5) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl flex items-center gap-2">
              Employer Dashboard
              <span className="material-symbols-outlined text-blue-600 text-[26px]">
                monitoring
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Manage your active job postings, track applicant volume, and streamline your hiring pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {user?.companyId && (
              <Link
                to={`/companies/${user.companyId._id || user.companyId}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                View Public Profile
              </Link>
            )}
            <button
              onClick={() => handleOpenJobModal()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Post a New Job
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Cards (Figure 8.5) */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Job Postings
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900">{activeCount}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {activeCount > 0 ? 'Active' : 'Draft'}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {jobs.length} total job {jobs.length === 1 ? 'posting' : 'postings'}
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{
                  width: `${jobs.length > 0 ? Math.round((activeCount / jobs.length) * 100) : 0}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Applicants
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900">
                {totalApplicants}
              </span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {pendingCount > 0 ? `${pendingCount} Pending` : 'Up to Date'}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {pendingCount > 0
                ? `${pendingCount} awaiting initial review`
                : totalApplicants > 0
                ? 'All applications reviewed'
                : 'No applicants yet'}
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    totalApplicants > 0
                      ? Math.round(((totalApplicants - pendingCount) / totalApplicants) * 100)
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Shortlisted Candidates
            </span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black text-slate-900">
                {shortlistedCount}
              </span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                Pipeline
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {shortlistedCount > 0
                ? `${shortlistedCount} candidate${shortlistedCount > 1 ? 's' : ''} qualified for interview`
                : 'No candidates shortlisted yet'}
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    totalApplicants > 0
                      ? Math.round((shortlistedCount / totalApplicants) * 100)
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Active Listings Table Section (Figure 8.5) */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
            <h2 className="text-lg font-black text-slate-900">Active Listings</h2>
            <span className="text-xs font-semibold text-slate-400">
              Showing {jobs.length} postings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Job Title</th>
                  <th className="pb-3">Date Posted</th>
                  <th className="pb-3">Applicants</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Loading job listings...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      You haven't posted any jobs yet. Click "Post a New Job" to begin!
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job._id} className="hover:bg-slate-50 transition">
                      <td className="py-4 font-bold text-slate-900">
                        <Link
                          to={`/jobs/${job._id}`}
                          className="hover:text-blue-600 transition truncate max-w-xs block"
                        >
                          {job.title}
                        </Link>
                        <span className="text-[11px] font-normal text-slate-400 block mt-0.5">
                          {job.location} • {job.jobType}
                        </span>
                      </td>

                      <td className="py-4 text-slate-500 whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-4">
                        <button
                          onClick={() => handleOpenApplicants(job)}
                          className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700 hover:bg-blue-100 transition"
                        >
                          {job.applicantCount || 0}
                        </button>
                      </td>

                      <td className="py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(job._id)}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold transition flex items-center gap-1.5 ${
                            job.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              job.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {job.status}
                        </button>
                      </td>

                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenApplicants(job)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="View Applicants"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              group
                            </span>
                          </button>
                          <button
                            onClick={() => handleOpenJobModal(job)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit Job"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job._id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="Delete Job"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Post / Edit Job Modal */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">
                {editingJob ? 'Edit Job Posting' : 'Post a New Job'}
              </h3>
              <button
                onClick={() => setIsJobModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleJobSubmit} className="mt-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={jobForm.title}
                  placeholder="e.g. Senior Frontend Engineer"
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={jobForm.category}
                    onChange={(e) => setJobForm({ ...jobForm, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Data">Data</option>
                    <option value="Management">Management</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Job Type</label>
                  <select
                    value={jobForm.jobType}
                    onChange={(e) => setJobForm({ ...jobForm, jobType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Remote">Remote</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Experience</label>
                  <select
                    value={jobForm.experienceLevel}
                    onChange={(e) =>
                      setJobForm({ ...jobForm, experienceLevel: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Entry Level">Entry Level</option>
                    <option value="Mid Level">Mid Level</option>
                    <option value="Senior Level">Senior Level</option>
                    <option value="Lead / Executive">Lead / Executive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={jobForm.location}
                    placeholder="e.g. Bengaluru, Karnataka (Hybrid)"
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Salary Min (₹ / INR Annual)</label>
                  <input
                    type="number"
                    value={jobForm.salaryMin}
                    placeholder="e.g. 800000"
                    onChange={(e) =>
                      setJobForm({ ...jobForm, salaryMin: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Salary Max (₹ / INR Annual)</label>
                  <input
                    type="number"
                    value={jobForm.salaryMax}
                    placeholder="e.g. 1500000"
                    onChange={(e) =>
                      setJobForm({ ...jobForm, salaryMax: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Required Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={jobForm.skillsRequired}
                  placeholder="React, TypeScript, Tailwind CSS, GraphQL"
                  onChange={(e) =>
                    setJobForm({ ...jobForm, skillsRequired: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description *</label>
                <textarea
                  rows={4}
                  required
                  value={jobForm.description}
                  placeholder="Comprehensive description of the role and team..."
                  onChange={(e) =>
                    setJobForm({ ...jobForm, description: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Key Responsibilities (one per line)
                </label>
                <textarea
                  rows={3}
                  value={jobForm.responsibilities}
                  placeholder="Lead architecture&#10;Mentor junior engineers"
                  onChange={(e) =>
                    setJobForm({ ...jobForm, responsibilities: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsJobModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  {editingJob ? 'Save Changes' : 'Publish Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Applicants Modal */}
      {isApplicantsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Applicants: {selectedJobForApplicants?.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Review resumes and advance candidate statuses
                </p>
              </div>
              <button
                onClick={() => setIsApplicantsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-6">
              {applicantsLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading applicants...
                </div>
              ) : jobApplicants.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No candidates have applied to this position yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {jobApplicants.map((app) => (
                    <div key={app._id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 font-bold text-white text-xs shrink-0">
                          {app.candidateId?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {app.candidateId?.name}
                          </h4>
                          <p className="text-xs text-slate-500">{app.candidateId?.email}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {app.candidateId?.skills?.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {app.resumeUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              openFile(app.resumeUrl, {
                                filename: app.resumeOriginalName || 'Candidate_Resume.pdf',
                              })
                            }
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-slate-50 cursor-pointer"
                          >
                            View Resume
                          </button>
                        )}

                        <select
                          value={app.status}
                          onChange={(e) =>
                            handleUpdateApplicantStatus(app._id, e.target.value)
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                        >
                          <option value="Applied">Applied</option>
                          <option value="In Review">In Review</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Rejected">Rejected</option>
                        </select>

                        <Link
                          to={`/messages`}
                          className="rounded-xl bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                          title="Message Candidate"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            chat
                          </span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerDashboard;

