import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { useNotification } from '../context/NotificationContext';
import { openFile } from '../services/fileService';

const CandidateDashboard = () => {
  const { user, uploadResume, updateProfile } = useAuth();
  const { myApplications, applicationMetrics, fetchMyApplications } = useJobs();
  const { showToast } = useNotification();

  const [isUploading, setIsUploading] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    title: user?.title || '',
    location: user?.location || '',
    bio: user?.bio || '',
    skills: user?.skills?.join(', ') || '',
  });

  // Calculate metrics derived strictly from authenticated user's actual database records
  const totalApps = applicationMetrics?.totalApps ?? myApplications.length ?? 0;
  const inReview = applicationMetrics?.inReview ?? 0;
  const interviews = applicationMetrics?.shortlisted ?? 0;
  const savedJobs = applicationMetrics?.savedJobs ?? 0;

  // Compute profile strength based on candidate profile completeness
  const profileStrength = (() => {
    let score = 0;
    if (user?.name) score += 20;
    if (user?.title) score += 15;
    if (user?.location) score += 15;
    if (user?.bio) score += 15;
    if (user?.skills?.length > 0) score += 15;
    if (user?.resumeUrl) score += 20;
    return score;
  })();

  useEffect(() => {
    fetchMyApplications();
  }, [fetchMyApplications]);

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast({
        title: 'File Too Large',
        message: 'Resume size must be under 5MB.',
        type: 'error',
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadResume(file);
      showToast({
        title: 'Resume Uploaded!',
        message: 'Your resume has been updated successfully.',
        type: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Upload Failed',
        message: err.message || 'Could not upload resume',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const skillsArray = profileForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await updateProfile({
        name: profileForm.name,
        title: profileForm.title,
        location: profileForm.location,
        bio: profileForm.bio,
        skills: skillsArray,
      });

      setIsEditProfileOpen(false);
      showToast({
        title: 'Profile Updated',
        message: 'Your candidate details have been saved.',
        type: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        message: err.message,
        type: 'error',
      });
    }
  };

  // Determine status badge style
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Shortlisted':
      case 'Interview':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In Review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Applied':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Header Banner (Figure 8.4) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-blue-600">
                Candidate Portal
              </span>
              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                Welcome back, {user?.name?.split(' ')[0] || 'Candidate'}.
              </h1>
              <p className="mt-1 text-xs text-slate-500 max-w-xl">
                {totalApps > 0
                  ? `Track your ${totalApps} active ${
                      totalApps === 1 ? 'application' : 'applications'
                    }, interview progression, and recruiter responses below.`
                  : 'Welcome to your career hub. Start exploring open positions and track your applications in real time.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                Edit Profile
              </button>
              <Link
                to="/jobs"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition"
              >
                Browse Jobs
              </Link>
            </div>
          </div>

          {/* Metric Cards (Figure 8.4) */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <span className="text-xs font-semibold text-slate-400">Total Apps</span>
              <p className="mt-2 text-2xl font-black text-slate-900">{totalApps}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <span className="text-xs font-semibold text-slate-400">In Review</span>
              <p className="mt-2 text-2xl font-black text-amber-600">{inReview}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-blue-50/50 p-4 border-blue-100">
              <span className="text-xs font-bold text-blue-700">Interviews</span>
              <p className="mt-2 text-2xl font-black text-blue-700">{interviews}</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <span className="text-xs font-semibold text-slate-400">Saved Jobs</span>
              <p className="mt-2 text-2xl font-black text-slate-900">{savedJobs}</p>
            </div>
          </div>
        </div>

        {/* 2-Column Dashboard Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: My Applications Table */}
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                <div>
                  <h2 className="text-lg font-black text-slate-900">My Applications</h2>
                  <p className="text-xs text-slate-400">Real-time status updates from recruiters</p>
                </div>
                <Link
                  to="/jobs"
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  View All
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              {/* Dynamic Applications Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-3">Company</th>
                      <th className="pb-3">Job Role</th>
                      <th className="pb-3">Date Applied</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myApplications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          You haven't applied to any jobs yet.{' '}
                          <Link to="/jobs" className="text-blue-600 font-bold hover:underline">
                            Search open roles
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      myApplications.map((app) => (
                        <tr key={app._id} className="hover:bg-slate-50 transition">
                          <td className="py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 font-bold text-slate-700 text-xs shrink-0">
                                {app.jobId?.companyId?.name?.slice(0, 2).toUpperCase() || 'CC'}
                              </div>
                              <span className="font-bold text-slate-900 truncate max-w-[120px]">
                                {app.jobId?.companyId?.name || 'Company'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4">
                            <Link
                              to={`/jobs/${app.jobId?._id}`}
                              className="font-semibold text-slate-800 hover:text-blue-600 transition truncate max-w-[150px] block"
                            >
                              {app.jobId?.title || 'Job Role'}
                            </Link>
                          </td>
                          <td className="py-4 text-slate-500 whitespace-nowrap">
                            {new Date(app.appliedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-4 whitespace-nowrap">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusBadge(
                                app.status === 'Shortlisted' ? 'Interview' : app.status
                              )}`}
                            >
                              {app.status === 'Shortlisted' ? 'Interview' : app.status}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <Link
                              to={`/messages`}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 inline-block"
                              title="Message Recruiter"
                            >
                              <span className="material-symbols-outlined text-[18px]">chat</span>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Widgets */}
          <div className="space-y-6">
            {/* Profile Strength Card (Figure 8.4) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Profile Strength</h3>
                  <p className="text-xs text-slate-400">Stand out to recruiters</p>
                </div>
                <span className="text-lg font-black text-blue-600">{profileStrength}%</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${profileStrength}%` }}
                ></div>
              </div>

              <button
                onClick={() => setIsEditProfileOpen(true)}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                {profileStrength === 100 ? 'Edit Profile Details' : 'Complete Profile ⊕'}
              </button>
            </div>

            {/* Resume Upload Card (Figure 8.4) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900">Update Resume</h3>
                <p className="text-xs text-slate-400">Current resume visible to recruiters</p>
              </div>

              {user?.resumeUrl && (
                <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/40 p-3 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">
                      description
                    </span>
                    <span className="font-bold text-slate-800 truncate">
                      {user.resumeOriginalName || 'Candidate_Resume.pdf'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openFile(user.resumeUrl, {
                        filename: user.resumeOriginalName || 'Candidate_Resume.pdf',
                      })
                    }
                    className="text-xs font-bold text-blue-600 hover:underline shrink-0 ml-2 bg-transparent border-0 cursor-pointer p-0"
                  >
                    View
                  </button>
                </div>
              )}

              {/* Drag & Drop Upload Container */}
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 mb-2">
                  <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">PDF, DOCX up to 5MB</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Expand Your Network Banner (Figure 8.4) */}
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-700 to-indigo-800 p-6 text-white shadow-md">
              <h4 className="text-base font-black">Expand your network</h4>
              <p className="mt-1 text-xs text-blue-100">
                Discover new companies and message recruiters directly on CareerConnect.
              </p>
              <Link
                to="/companies"
                className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition"
              >
                Discover companies →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Edit Profile</h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleProfileUpdate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Professional Title</label>
                <input
                  type="text"
                  value={profileForm.title}
                  placeholder="e.g. Senior Frontend Engineer"
                  onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={profileForm.location}
                  placeholder="e.g. Bengaluru, Karnataka"
                  onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={profileForm.skills}
                  placeholder="React, TypeScript, Tailwind CSS, GraphQL"
                  onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bio / Summary</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateDashboard;

