import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import JobCard from '../components/JobCard';
import { useJobs } from '../context/JobContext';

const jobs = [
  {
    id: 1,
    title: 'Frontend Developer',
    company: 'TechNova',
    category: 'Development',
    type: 'Full-time',
    location: 'Remote',
    salary: '$80k - $100k',
    experience: '1–3 yrs',
    posted: '2 days ago',
    skills: ['React', 'JavaScript', 'Tailwind'],
    logo: 'TN',
    featured: true,
  },

  {
    id: 2,
    title: 'UI/UX Designer',
    company: 'Creative Co',
    category: 'Design',
    type: 'Contract',
    location: 'New York, NY',
    salary: '$50/hr',
    experience: '2–4 yrs',
    posted: '4 days ago',
    skills: ['Figma', 'UX Research', 'Prototyping'],
    logo: 'CC',
  },

  {
    id: 3,
    title: 'Backend Engineer',
    company: 'DataStream',
    category: 'Development',
    type: 'Full-time',
    location: 'San Francisco, CA',
    salary: '$120k - $150k',
    experience: '2–5 yrs',
    posted: '1 day ago',
    skills: ['Node.js', 'PostgreSQL', 'APIs'],
    logo: 'DS',
    featured: true,
  },

  {
    id: 4,
    title: 'Product Manager',
    company: 'Innovate LLC',
    category: 'Management',
    type: 'Full-time',
    location: 'Austin, TX',
    salary: '$110k - $130k',
    experience: '3–6 yrs',
    posted: '5 days ago',
    skills: ['Strategy', 'Agile', 'Analytics'],
    logo: 'IL',
  },

  {
    id: 5,
    title: 'React Native Developer',
    company: 'AppWorks',
    category: 'Development',
    type: 'Part-time',
    location: 'Remote',
    salary: '$60k - $80k',
    experience: '1–3 yrs',
    posted: '3 days ago',
    skills: ['React Native', 'Expo', 'Firebase'],
    logo: 'AW',
  },

  {
    id: 6,
    title: 'Data Analyst',
    company: 'Insight Labs',
    category: 'Data',
    type: 'Full-time',
    location: 'Chicago, IL',
    salary: '$75k - $95k',
    experience: '1–3 yrs',
    posted: '6 days ago',
    skills: ['SQL', 'Python', 'Power BI'],
    logo: 'IL',
  },
];

const JobListings = () => {

  // ----------------------------------
  // LOCAL STATE
  // ----------------------------------

  const [searchTerm, setSearchTerm] =
    useState('');

  const [selectedCategory, setSelectedCategory] =
    useState('All');

  const [selectedType, setSelectedType] =
    useState('All');

  const [sortBy, setSortBy] =
    useState('recent');

  const [applicationMessage, setApplicationMessage] =
    useState('');

  // ----------------------------------
  // SHARED STATE FROM CONTEXT
  // ----------------------------------

  const { registeredJobs } = useJobs();

  // ----------------------------------
  // useEffect #1
  // Update browser title when search changes
  // ----------------------------------

  useEffect(() => {

    document.title = searchTerm
      ? `Searching "${searchTerm}" | JobConnect`
      : 'JobConnect | Find Your Next Opportunity';

  }, [searchTerm]);

  // ----------------------------------
  // useEffect #2
  // Automatically hide registration message
  // ----------------------------------

  useEffect(() => {

    if (!applicationMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setApplicationMessage('');
    }, 3000);

    return () => clearTimeout(timer);

  }, [applicationMessage]);

  // ----------------------------------
  // Categories
  // ----------------------------------

  const categories = [
    'All',
    ...new Set(
      jobs.map((job) => job.category)
    ),
  ];

  const jobTypes = [
    'All',
    ...new Set(
      jobs.map((job) => job.type)
    ),
  ];

  // ----------------------------------
  // Search + filter + sorting
  // ----------------------------------

  const filteredJobs = useMemo(() => {

    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    const result = jobs.filter((job) => {

      const searchableText = [
        job.title,
        job.company,
        job.location,
        job.category,
        ...job.skills,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        normalizedSearch === '' ||
        searchableText.includes(
          normalizedSearch
        );

      const matchesCategory =
        selectedCategory === 'All' ||
        job.category === selectedCategory;

      const matchesType =
        selectedType === 'All' ||
        job.type === selectedType;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesType
      );
    });

    // Dynamic sorting
    if (sortBy === 'company') {

      return [...result].sort((a, b) =>
        a.company.localeCompare(b.company)
      );

    }

    if (sortBy === 'salary') {

      return [...result].sort((a, b) => {

        const salaryA =
          parseInt(
            a.salary.replace(/\D/g, ''),
            10
          ) || 0;

        const salaryB =
          parseInt(
            b.salary.replace(/\D/g, ''),
            10
          ) || 0;

        return salaryB - salaryA;
      });
    }

    return result;

  }, [
    searchTerm,
    selectedCategory,
    selectedType,
    sortBy,
  ]);

  // ----------------------------------
  // Reset all filters
  // ----------------------------------

  const clearFilters = () => {

    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedType('All');
    setSortBy('recent');

  };

  // ----------------------------------
  // Statistics
  // ----------------------------------

  const remoteJobs = jobs.filter(
    (job) => job.location === 'Remote'
  ).length;

  const featuredJobs = jobs.filter(
    (job) => job.featured
  ).length;

  return (

    <main className="min-h-screen bg-slate-50">

      {/* =====================================
          HERO SECTION
      ===================================== */}

      <section className="bg-slate-950 text-white">

        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">

          <div className="max-w-3xl">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-300">

              <span className="h-2 w-2 rounded-full bg-blue-400" />

              Your next opportunity starts here

            </div>

            <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">

              Find work that
              <span className="text-blue-500">
                {' '}moves your career
              </span>
              {' '}forward.

            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">

              Discover relevant opportunities,
              explore growing companies and
              keep track of your applications
              in one place.

            </p>

          </div>

          {/* Search Panel */}

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl md:p-5">

            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">

              {/* Search */}

              <label className="relative block">

                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  search
                </span>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search jobs, companies, skills or locations..."
                  className="h-12 w-full rounded-xl border border-slate-700 bg-slate-800 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />

              </label>

              {/* Category */}

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(
                    event.target.value
                  )
                }
                className="h-12 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-white outline-none focus:border-blue-500"
              >

                {categories.map(
                  (category) => (

                    <option
                      key={category}
                      value={category}
                    >
                      {category === 'All'
                        ? 'All categories'
                        : category}
                    </option>

                  )
                )}

              </select>

              {/* Reset */}

              <button
                onClick={clearFilters}
                className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Reset filters
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* =====================================
          STATISTICS
      ===================================== */}

      <div className="mx-auto max-w-7xl px-4 md:px-8">

        <section className="-mt-6 grid gap-3 sm:grid-cols-3">

          {/* Open Roles */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Open roles
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {jobs.length}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Across multiple teams
            </p>

          </div>

          {/* Remote */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Remote roles
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {remoteJobs}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Flexible opportunities
            </p>

          </div>

          {/* Applications */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              My applications
            </p>

            <p className="mt-1 text-2xl font-black text-blue-600">
              {registeredJobs.length}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Shared through Context API
            </p>

          </div>

        </section>

        {/* =====================================
            JOB LISTINGS
        ===================================== */}

        <section
          id="jobs"
          className="mt-10"
        >

          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <p className="text-sm font-semibold text-blue-600">
                Job board
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Latest opportunities
              </h2>

              <p className="mt-1 text-sm text-slate-500">

                {filteredJobs.length}
                {' '}
                matching role
                {filteredJobs.length !== 1
                  ? 's'
                  : ''}

              </p>

            </div>

            {/* Category Buttons */}

            <div className="flex flex-wrap gap-2">

              {categories.map(
                (category) => (

                  <button
                    key={category}
                    onClick={() =>
                      setSelectedCategory(
                        category
                      )
                    }
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      selectedCategory === category
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {category}
                  </button>

                )
              )}

            </div>

          </div>

          {/* =====================================
              FILTER BAR
          ===================================== */}

          <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-wrap items-center gap-2">

              <span className="text-sm font-bold text-slate-700">
                Job type:
              </span>

              {jobTypes.map(
                (type) => (

                  <button
                    key={type}
                    onClick={() =>
                      setSelectedType(type)
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      selectedType === type
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {type}
                  </button>

                )
              )}

            </div>

            <label className="flex items-center gap-2 text-sm text-slate-500">

              <span className="font-semibold">
                Sort:
              </span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 outline-none focus:border-blue-500"
              >

                <option value="recent">
                  Most recent
                </option>

                <option value="company">
                  Company name
                </option>

                <option value="salary">
                  Highest salary
                </option>

              </select>

            </label>

          </div>

          {/* =====================================
              CONDITIONAL RENDERING
          ===================================== */}

          {filteredJobs.length > 0 ? (

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

              {filteredJobs.map(
                (job) => (

                  <JobCard
                    key={job.id}
                    job={job}
                    onRegistered={(title) =>
                      setApplicationMessage(
                        title
                      )
                    }
                  />

                )
              )}

            </div>

          ) : (

            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">

              <span className="material-symbols-outlined text-5xl text-slate-300">
                search_off
              </span>

              <h3 className="mt-4 text-xl font-bold text-slate-800">
                No matching jobs
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Try another keyword,
                category or job type
                to discover more
                opportunities.
              </p>

              <button
                onClick={clearFilters}
                className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
              >
                Clear all filters
              </button>

            </div>

          )}

        </section>

        {/* =====================================
            APPLICATION SUMMARY
        ===================================== */}

        <section
          id="registered"
          className="mt-10 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
        >

          <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/70 p-6 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Context API
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                My applications
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Shared registration state
                available across the application.
              </p>

            </div>

            <span className="w-fit rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              {registeredJobs.length}
              {' '}
              registered
            </span>

          </div>

          {/* Conditional Rendering */}

          {registeredJobs.length > 0 ? (

            <div className="grid gap-3 p-6 md:grid-cols-2">

              {registeredJobs.map(
                (job) => (

                  <div
                    key={job.id}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 p-4"
                  >

                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">
                      {job.logo}
                    </div>

                    <div className="min-w-0">

                      <p className="truncate font-bold text-slate-800">
                        {job.title}
                      </p>

                      <p className="text-sm text-slate-500">
                        {job.company}
                        {' · '}
                        {job.location}
                      </p>

                    </div>

                    <span className="material-symbols-outlined ml-auto text-emerald-500">
                      check_circle
                    </span>

                  </div>

                )
              )}

            </div>

          ) : (

            <div className="p-8 text-center">

              <span className="material-symbols-outlined text-4xl text-slate-300">
                work_history
              </span>

              <p className="mt-2 font-semibold text-slate-700">
                No applications yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Register for a job above
                and it will appear here.
              </p>

            </div>

          )}

        </section>

      </div>

      {/* =====================================
          REGISTRATION NOTIFICATION
      ===================================== */}

      {applicationMessage && (

        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-2xl">

          <span className="material-symbols-outlined text-emerald-400">
            check_circle
          </span>

          Registered for
          {' '}
          {applicationMessage}

        </div>

      )}

    </main>
  );
};

export default JobListings;