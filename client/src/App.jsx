import React from 'react';
import Navbar from './components/Navbar';
import JobListings from './pages/JobListings';
import { JobProvider } from './context/JobContext';

function App() {
  return (
    <JobProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <JobListings />
      </div>
    </JobProvider>
  );
}

export default App;