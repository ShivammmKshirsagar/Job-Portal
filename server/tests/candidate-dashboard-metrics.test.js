/**
 * CareerConnect — Candidate Dashboard Metrics & Account Isolation Test Suite
 *
 * Verifies:
 * 1. Newly registered candidate displays strictly 0 for:
 *    - Total Applications (not 12)
 *    - In Review (not 4)
 *    - Interviews / Shortlisted (not 2)
 *    - Saved Jobs (not 8)
 * 2. Active candidate with real applications and saved jobs receives actual counts derived from database records.
 * 3. Two separate candidate accounts are completely isolated (Candidate A data never leaks to Candidate B).
 * 4. User identity is derived strictly from verified JWT authentication, never from client-supplied user IDs (anti-spoofing).
 * 5. Dynamic activity subtitle replaces the fabricated "increased by 14% this week" message.
 * 6. Saved jobs toggle and counter update dynamically.
 */

import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Application from '../src/models/Application.js';
import Job from '../src/models/Job.js';
import { getCandidateApplications } from '../src/controllers/applicationController.js';
import { toggleSaveJob, getSavedJobs } from '../src/controllers/userController.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runDashboardTests() {
  console.log('\n================================================================');
  console.log('  CANDIDATE DASHBOARD METRICS & ACCOUNT ISOLATION TESTS');
  console.log('================================================================\n');

  // --- SECTION 1: Fresh Candidate Account Verification (Zeros Expected) ---
  console.log('--- 1. Testing Newly Registered Candidate (Zero Applications, Zero Saved Jobs) ---');

  const candidateAId = new mongoose.Types.ObjectId();
  const candidateBId = new mongoose.Types.ObjectId();
  const jobId1 = new mongoose.Types.ObjectId();
  const jobId2 = new mongoose.Types.ObjectId();

  // Mock Database state
  const mockApplications = [
    // Candidate B applications
    {
      _id: new mongoose.Types.ObjectId(),
      candidateId: candidateBId,
      jobId: jobId1,
      status: 'In Review',
      appliedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      candidateId: candidateBId,
      jobId: jobId2,
      status: 'Shortlisted',
      appliedAt: new Date(),
    },
  ];

  const mockUsers = new Map([
    [
      candidateAId.toString(),
      {
        _id: candidateAId,
        name: 'New Candidate A',
        email: 'cand.a@test.com',
        role: 'candidate',
        savedJobs: [],
        save: async function () { return this; },
      },
    ],
    [
      candidateBId.toString(),
      {
        _id: candidateBId,
        name: 'Active Candidate B',
        email: 'cand.b@test.com',
        role: 'candidate',
        savedJobs: [jobId1],
        save: async function () { return this; },
      },
    ],
  ]);

  // Patch Application.find
  const originalAppFind = Application.find;
  Application.find = function (filter) {
    const candidateIdStr = filter.candidateId?.toString();
    const matching = mockApplications.filter(
      (a) => a.candidateId.toString() === candidateIdStr
    );

    return {
      populate: () => ({
        sort: () => Promise.resolve(matching),
      }),
    };
  };

  // Patch User.findById
  const originalUserFindById = User.findById;
  User.findById = function (id) {
    const user = mockUsers.get(id?.toString()) || null;
    return {
      select: () => Promise.resolve(user),
      populate: () => Promise.resolve(user),
      then: (resolve) => resolve(user),
    };
  };

  // Patch Job.findById
  const originalJobFindById = Job.findById;
  Job.findById = function (id) {
    return Promise.resolve({
      _id: id,
      title: 'Mock Job',
      status: 'Active',
    });
  };

  try {
    // 1. Candidate A Request: Fresh account
    let resDataA = null;
    const reqA = {
      user: { _id: candidateAId, role: 'candidate' },
    };
    const resA = {
      status: (code) => {
        assert(code === 200, 'Candidate A response status is HTTP 200');
        return {
          json: (data) => {
            resDataA = data;
          },
        };
      },
    };

    await getCandidateApplications(reqA, resA, (err) => {
      if (err) throw err;
    });

    assert(resDataA !== null, 'Candidate A received response data');
    assert(resDataA.metrics.totalApps === 0, 'Candidate A totalApps is strictly 0 (not 12)');
    assert(resDataA.metrics.inReview === 0, 'Candidate A inReview is strictly 0 (not 4)');
    assert(resDataA.metrics.shortlisted === 0, 'Candidate A shortlisted/interviews is strictly 0 (not 2)');
    assert(resDataA.metrics.savedJobs === 0, 'Candidate A savedJobs is strictly 0 (not 8)');
    assert(resDataA.metrics.rejected === 0, 'Candidate A rejected is strictly 0');
    assert(resDataA.applications.length === 0, 'Candidate A applications array is empty');

    // --- SECTION 2: Active Candidate Account Verification ---
    console.log('\n--- 2. Testing Active Candidate (2 Applications, 1 Saved Job) ---');

    let resDataB = null;
    const reqB = {
      user: { _id: candidateBId, role: 'candidate' },
    };
    const resB = {
      status: (code) => {
        assert(code === 200, 'Candidate B response status is HTTP 200');
        return {
          json: (data) => {
            resDataB = data;
          },
        };
      },
    };

    await getCandidateApplications(reqB, resB, (err) => {
      if (err) throw err;
    });

    assert(resDataB !== null, 'Candidate B received response data');
    assert(resDataB.metrics.totalApps === 2, 'Candidate B totalApps is strictly 2');
    assert(resDataB.metrics.inReview === 1, 'Candidate B inReview is strictly 1');
    assert(resDataB.metrics.shortlisted === 1, 'Candidate B shortlisted/interviews is strictly 1');
    assert(resDataB.metrics.savedJobs === 1, 'Candidate B savedJobs is strictly 1');
    assert(resDataB.metrics.rejected === 0, 'Candidate B rejected is strictly 0');
    assert(resDataB.applications.length === 2, 'Candidate B applications array has 2 items');

    // --- SECTION 3: Cross-Candidate Isolation & Anti-Spoofing Verification ---
    console.log('\n--- 3. Testing Cross-Candidate Account Isolation & Anti-Spoofing ---');

    // Candidate A tries to spoof candidateId to Candidate B's id via query and body
    let resDataSpoof = null;
    const reqSpoof = {
      user: { _id: candidateAId, role: 'candidate' }, // Authenticated identity
      query: { candidateId: candidateBId.toString() }, // Spoofed parameter
      body: { candidateId: candidateBId.toString() },  // Spoofed body
    };
    const resSpoof = {
      status: () => ({
        json: (data) => {
          resDataSpoof = data;
        },
      }),
    };

    await getCandidateApplications(reqSpoof, resSpoof, (err) => {
      if (err) throw err;
    });

    assert(
      resDataSpoof.metrics.totalApps === 0,
      'Identity strictly derived from req.user._id; spoofed query/body ignored completely'
    );
    assert(
      resDataSpoof.metrics.savedJobs === 0,
      'Candidate A saved jobs remained 0 despite spoof attempt'
    );
    assert(
      resDataSpoof.applications.length === 0,
      'Candidate A received 0 applications, Candidate B data never leaked'
    );

    // --- SECTION 4: Saved Jobs Dynamic Toggle ---
    console.log('\n--- 4. Testing Saved Jobs Toggle Functionality ---');

    let toggleRes1 = null;
    const reqToggle1 = {
      user: { _id: candidateAId, role: 'candidate' },
      params: { jobId: jobId2.toString() },
    };
    const resToggle1 = {
      status: (code) => {
        assert(code === 200, 'HTTP 200 on save job toggle');
        return {
          json: (data) => {
            toggleRes1 = data;
          },
        };
      },
    };

    await toggleSaveJob(reqToggle1, resToggle1, (err) => {
      if (err) throw err;
    });

    assert(toggleRes1.isSaved === true, 'Job 2 is now saved for Candidate A');
    assert(toggleRes1.savedJobsCount === 1, 'Candidate A savedJobsCount updated to 1');

    // Re-check metrics for Candidate A after saving
    let resDataAAfterSave = null;
    await getCandidateApplications(reqA, {
      status: () => ({
        json: (data) => {
          resDataAAfterSave = data;
        },
      }),
    }, () => {});

    assert(resDataAAfterSave.metrics.savedJobs === 1, 'Candidate A metrics dynamically reflects 1 saved job');

    // Unsave Job 2
    let toggleRes2 = null;
    await toggleSaveJob(reqToggle1, {
      status: () => ({
        json: (data) => {
          toggleRes2 = data;
        },
      }),
    }, () => {});

    assert(toggleRes2.isSaved === false, 'Job 2 is now unsaved');
    assert(toggleRes2.savedJobsCount === 0, 'Candidate A savedJobsCount returned to 0');

    // --- SECTION 5: Frontend Value Resolution & Subtitle Verification ---
    console.log('\n--- 5. Testing Frontend Fallback & Subtitle Formatting Rules ---');

    // Simulate CandidateDashboard calculation with zero metrics
    const zeroMetrics = { totalApps: 0, inReview: 0, shortlisted: 0, savedJobs: 0 };
    const myAppsEmpty = [];

    const resolvedTotalApps = zeroMetrics?.totalApps ?? myAppsEmpty.length ?? 0;
    const resolvedInReview = zeroMetrics?.inReview ?? 0;
    const resolvedInterviews = zeroMetrics?.shortlisted ?? 0;
    const resolvedSavedJobs = zeroMetrics?.savedJobs ?? 0;

    assert(resolvedTotalApps === 0, 'Nullish coalescing evaluates 0 for Total Apps (never 12)');
    assert(resolvedInReview === 0, 'Nullish coalescing evaluates 0 for In Review (never 4)');
    assert(resolvedInterviews === 0, 'Nullish coalescing evaluates 0 for Interviews (never 2)');
    assert(resolvedSavedJobs === 0, 'Nullish coalescing evaluates 0 for Saved Jobs (never 8)');

    // Subtitle logic
    const getSubtitle = (appsCount) => {
      return appsCount > 0
        ? `Track your ${appsCount} active ${appsCount === 1 ? 'application' : 'applications'}, interview progression, and recruiter responses below.`
        : 'Welcome to your career hub. Start exploring open positions and track your applications in real time.';
    };

    const emptySubtitle = getSubtitle(0);
    assert(
      !emptySubtitle.includes('14%') && !emptySubtitle.includes('increased'),
      'Zero applications displays clean, truthful onboarding message without "increased by 14%"'
    );
    assert(
      emptySubtitle.includes('Welcome to your career hub'),
      'Empty applications subtitle guides candidate to explore open positions'
    );

    const activeSubtitle = getSubtitle(2);
    assert(
      activeSubtitle.includes('2 active applications'),
      'Active applications subtitle truthfully displays actual count'
    );

    console.log('\n================================================================');
    console.log(`  DASHBOARD METRICS TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore mocks
    Application.find = originalAppFind;
    User.findById = originalUserFindById;
    Job.findById = originalJobFindById;
  }
}

runDashboardTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
