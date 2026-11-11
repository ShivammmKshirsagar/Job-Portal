import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const JobContext = createContext(null);

export const JobProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  // Backward compatibility state for registered jobs
  const [registeredJobs, setRegisteredJobs] = useState(() => {
    const savedJobs = localStorage.getItem('careerconnect_registered_jobs') || localStorage.getItem('jobconnect_registered_jobs');
    return savedJobs ? JSON.parse(savedJobs) : [];
  });

  // Backend state
  const [jobs, setJobs] = useState([]);
  const [featuredJobs, setFeaturedJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [applicationMetrics, setApplicationMetrics] = useState({
    totalApps: 0,
    inReview: 0,
    shortlisted: 0,
    rejected: 0,
    savedJobs: 0,
  });
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    category: 'All',
    jobType: 'All',
    experienceLevel: 'All',
    location: '',
    salaryMin: '',
    salaryMax: '',
    sort: 'recent',
    page: 1,
  });

  // Sync registeredJobs with localStorage
  useEffect(() => {
    localStorage.setItem('careerconnect_registered_jobs', JSON.stringify(registeredJobs));
  }, [registeredJobs]);

  // Fetch jobs from backend
  const fetchJobs = useCallback(async (customParams = {}) => {
    setLoading(true);
    try {
      const params = { ...filters, ...customParams };
      const queryParams = new URLSearchParams();

      Object.entries(params).forEach(([key, val]) => {
        if (val !== '' && val !== 'All' && val !== null && val !== undefined) {
          queryParams.append(key, val);
        }
      });

      const res = await api.get(`/jobs?${queryParams.toString()}`);
      if (res.data.success) {
        setJobs(res.data.jobs);
        setTotalJobs(res.data.total);
        setTotalPages(res.data.totalPages);
        setCurrentPage(res.data.currentPage);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch featured jobs for homepage
  const fetchFeaturedJobs = async () => {
    try {
      const res = await api.get('/jobs/featured');
      if (res.data.success) {
        setFeaturedJobs(res.data.jobs);
      }
    } catch (err) {
      console.error('Error fetching featured jobs:', err);
    }
  };

  // Fetch candidate's applications from backend
  const fetchMyApplications = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'candidate') return;
    try {
      const res = await api.get('/applications/candidate/my-applications');
      if (res.data.success) {
        setMyApplications(res.data.applications);
        setApplicationMetrics(res.data.metrics);

        // Also sync registeredJobs IDs
        const appliedJobObjects = res.data.applications.map((app) => ({
          id: app.jobId?._id || app._id,
          title: app.jobId?.title || 'Applied Role',
          company: app.jobId?.companyId?.name || 'Company',
          status: app.status,
          appliedAt: app.appliedAt,
        }));
        setRegisteredJobs(appliedJobObjects);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  }, [isAuthenticated, user?.role]);

  // Fetch candidate's saved jobs from backend
  const fetchSavedJobs = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'candidate') return;
    try {
      const res = await api.get('/users/saved-jobs');
      if (res.data.success) {
        setSavedJobs(res.data.savedJobs || []);
        setApplicationMetrics((prev) => ({
          ...prev,
          savedJobs: res.data.count || 0,
        }));
      }
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
    }
  }, [isAuthenticated, user?.role]);

  // Toggle save/unsave a job
  const toggleSaveJob = async (jobId) => {
    if (!isAuthenticated || user?.role !== 'candidate') return false;
    try {
      const res = await api.post(`/users/saved-jobs/${jobId}`);
      if (res.data.success) {
        setApplicationMetrics((prev) => ({
          ...prev,
          savedJobs: res.data.savedJobsCount,
        }));
        await fetchSavedJobs();
        return res.data.isSaved;
      }
    } catch (err) {
      console.error('Error saving job:', err);
      return false;
    }
  };

  const isJobSaved = (jobId) => {
    return savedJobs.some(
      (j) => (j._id || j.id || j).toString() === jobId.toString()
    );
  };

  // Withdraw a candidate application
  const withdrawApplication = async (applicationId) => {
    if (!isAuthenticated || user?.role !== 'candidate') return null;
    try {
      const res = await api.patch(`/applications/${applicationId}/withdraw`);
      if (res.data?.success) {
        await fetchMyApplications();
        return res.data;
      }
    } catch (err) {
      throw new Error(
        err.response?.data?.message || err.message || 'Failed to withdraw application',
        { cause: err }
      );
    }
  };

  useEffect(() => {
    fetchFeaturedJobs();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Reset or load candidate-specific records on authentication change
  useEffect(() => {
    if (isAuthenticated && user?.role === 'candidate') {
      fetchMyApplications();
      fetchSavedJobs();
    } else {
      setMyApplications([]);
      setSavedJobs([]);
      setApplicationMetrics({
        totalApps: 0,
        inReview: 0,
        shortlisted: 0,
        rejected: 0,
        savedJobs: 0,
      });
    }
  }, [isAuthenticated, user?._id, user?.role, fetchMyApplications, fetchSavedJobs]);

  // Apply to job
  const applyToJob = async (jobId, { coverNote = '', portfolioUrl = '', resume = null } = {}) => {
    const formData = new FormData();
    if (coverNote) formData.append('coverNote', coverNote);
    if (portfolioUrl) formData.append('portfolioUrl', portfolioUrl);
    if (resume) formData.append('resume', resume);

    const res = await api.post(`/applications/${jobId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (res.data.success) {
      await fetchMyApplications();
      return res.data;
    }
  };

  // Backward compatibility registration function
  const registerForJob = (job) => {
    setRegisteredJobs((current) => {
      const jobId = job.id || job._id;
      if (current.some((j) => (j.id || j._id) === jobId)) return current;
      return [...current, job];
    });
  };

  const isRegistered = (jobId) => {
    return registeredJobs.some(
      (job) => (job.id || job._id) === jobId || job.jobId?._id === jobId
    );
  };

  return (
    <JobContext.Provider
      value={{
        jobs,
        featuredJobs,
        totalJobs,
        totalPages,
        currentPage,
        loading,
        filters,
        setFilters,
        fetchJobs,
        myApplications,
        applicationMetrics,
        fetchMyApplications,
        savedJobs,
        fetchSavedJobs,
        toggleSaveJob,
        isJobSaved,
        applyToJob,
        withdrawApplication,
        registeredJobs,
        registerForJob,
        isRegistered,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used inside JobProvider');
  }
  return context;
};
