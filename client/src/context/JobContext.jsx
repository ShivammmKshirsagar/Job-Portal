import React, { createContext, useContext, useEffect, useState } from 'react';

const JobContext = createContext(null);

export const JobProvider = ({ children }) => {
  // Shared application state
  const [registeredJobs, setRegisteredJobs] = useState(() => {
    const savedJobs = localStorage.getItem('jobconnect_registered_jobs');

    return savedJobs ? JSON.parse(savedJobs) : [];
  });

  // useEffect:
  // Save registration state whenever registeredJobs changes.
  useEffect(() => {
    localStorage.setItem(
      'jobconnect_registered_jobs',
      JSON.stringify(registeredJobs)
    );
  }, [registeredJobs]);

  // State update function
  const registerForJob = (job) => {
    setRegisteredJobs((currentJobs) => {
      // Prevent duplicate registration
      if (
        currentJobs.some(
          (registeredJob) => registeredJob.id === job.id
        )
      ) {
        return currentJobs;
      }

      return [...currentJobs, job];
    });
  };

  // Check whether a job has already been registered
  const isRegistered = (jobId) => {
    return registeredJobs.some(
      (job) => job.id === jobId
    );
  };

  return (
    <JobContext.Provider
      value={{
        registeredJobs,
        registerForJob,
        isRegistered,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

// Custom hook using useContext
// eslint-disable-next-line react-refresh/only-export-components
export const useJobs = () => {
  const context = useContext(JobContext);

  if (!context) {
    throw new Error(
      'useJobs must be used inside JobProvider'
    );
  }

  return context;
};