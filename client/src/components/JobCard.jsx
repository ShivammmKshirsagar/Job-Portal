import React from 'react';
import { useJobs } from '../context/JobContext';

const JobCard = ({ job, onRegistered }) => {
  const {
    registerForJob,
    isRegistered,
  } = useJobs();

  const registered = isRegistered(job.id);

  const handleRegistration = () => {
    if (!registered) {
      registerForJob(job);

      if (onRegistered) {
        onRegistered(job.title);
      }
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60 md:p-6">

      {/* Featured Badge */}
      {job.featured && (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
          Featured
        </div>
      )}

      {/* Company + Job Title */}
      <div className="flex items-start gap-4">

        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-sm">
          {job.logo}
        </div>

        <div className="min-w-0 flex-1 pr-16">

          <h3 className="truncate text-lg font-black text-slate-900 md:text-xl">
            {job.title}
          </h3>

          <p className="mt-1 text-sm font-semibold text-blue-600">
            {job.company}
          </p>

        </div>

      </div>

      {/* Tags */}
      <div className="mt-5 flex flex-wrap gap-2">

        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {job.category}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {job.type}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {job.experience}
        </span>

      </div>

      {/* Job Information */}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-500">

        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-400">
            location_on
          </span>

          <span className="truncate">
            {job.location}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-slate-400">
            schedule
          </span>

          <span>
            {job.posted}
          </span>
        </div>

        <div className="col-span-2 flex items-center gap-2 font-bold text-slate-800">
          <span className="material-symbols-outlined text-[20px] text-emerald-500">
            payments
          </span>

          <span>
            {job.salary}
          </span>
        </div>

      </div>

      {/* Skills */}
      <div className="mt-5 flex flex-wrap gap-2">

        {job.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500"
          >
            {skill}
          </span>
        ))}

      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">

        <button className="text-sm font-bold text-slate-500 transition hover:text-blue-600">
          View details
        </button>

        <button
          onClick={handleRegistration}
          disabled={registered}
          className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
            registered
              ? 'cursor-not-allowed bg-emerald-50 text-emerald-700'
              : 'bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700'
          }`}
        >
          {registered
            ? 'Registered ✓'
            : 'Register now'}
        </button>

      </div>

    </article>
  );
};

export default JobCard;