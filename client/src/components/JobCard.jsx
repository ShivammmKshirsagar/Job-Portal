import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useJobs } from '../context/JobContext';
import { useAuth } from '../context/AuthContext';
import { formatJobSalary } from '../utils/salary';

const JobCard = ({ job, _onRegistered }) => {
  const navigate = useNavigate();
  const { isRegistered } = useJobs();
  const { isAuthenticated, role } = useAuth();

  const jobId = job._id || job.id;
  const registered = isRegistered(jobId);

  const companyName = job.companyId?.name || job.company || 'Company';
  const companyLogo = job.companyId?.logoUrl || job.logo || null;
  const companyId = job.companyId?._id || job.companyId;

  const salaryDisplay = formatJobSalary(job);

  const skills = job.skillsRequired || job.skills || [];

  const handleApplyClick = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/auth?mode=login', { state: { from: `/jobs/${jobId}` } });
      return;
    }
    if (role === 'candidate') {
      navigate(`/jobs/${jobId}`);
    } else {
      navigate(`/jobs/${jobId}`);
    }
  };

  return (
    <article
      onClick={() => navigate(`/jobs/${jobId}`)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md cursor-pointer md:p-6"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {/* Company Logo or Initials */}
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-800 text-sm overflow-hidden shadow-xs">
              {companyLogo && typeof companyLogo === 'string' && companyLogo.startsWith('http') ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-black text-blue-600">
                  {typeof companyLogo === 'string' ? companyLogo : companyName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate md:text-lg">
                {job.title}
              </h3>

              {companyId ? (
                <Link
                  to={`/companies/${companyId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  {companyName}
                  <span className="material-symbols-outlined text-[13px]">verified</span>
                </Link>
              ) : (
                <p className="mt-0.5 text-xs font-semibold text-slate-600">
                  {companyName}
                </p>
              )}
            </div>
          </div>

          {/* Bookmark & Featured */}
          <div className="flex items-center gap-1.5 shrink-0">
            {job.featured && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                Featured
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition"
              title="Save Job"
            >
              <span className="material-symbols-outlined text-[18px]">bookmark</span>
            </button>
          </div>
        </div>

        {/* Snippet / Description if available */}
        {job.description && (
          <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {job.description}
          </p>
        )}

        {/* Tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {job.category && (
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {job.category}
            </span>
          )}
          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {job.jobType || job.type || 'Full-Time'}
          </span>
          {(job.experienceLevel || job.experience) && (
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {job.experienceLevel || job.experience}
            </span>
          )}
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {skill}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                +{skills.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar: Location, Salary & Apply */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-[16px] text-slate-400">
              location_on
            </span>
            <span className="truncate max-w-[120px]">{job.location}</span>
          </span>
          <span className="font-bold text-slate-900">{salaryDisplay}</span>
        </div>

        <button
          onClick={handleApplyClick}
          className={`rounded-xl px-4 py-2 font-bold transition shadow-xs ${
            registered
              ? 'bg-emerald-50 text-emerald-700 font-semibold cursor-default'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {registered ? 'Applied ✓' : 'View & Apply'}
        </button>
      </div>
    </article>
  );
};

export default JobCard;
