/**
 * CareerConnect — Project-Wide Hardcoded Data and Fake Statistics Audit Test Suite
 *
 * Verifies:
 * 1. Public Platform Stats API (GET /api/jobs/public-stats):
 *    - Dynamically computes active jobs, hiring companies, candidates, and applications.
 *    - Returns zeros on empty database, strictly avoiding fabricated static numbers (10,000+, 2,500+, 500k+).
 *    - Filters only Active jobs and active companies.
 * 2. Employer Dashboard Metrics & Scoping (GET /api/jobs/employer/my-jobs):
 *    - Fresh employer with 0 jobs/applicants receives strictly 0 for all metrics (not 142 or 28).
 *    - Computes real applicant counts and status breakdowns (pending, in-review, shortlisted, rejected).
 *    - Multi-tenant isolation: Employer A never sees or counts Employer B's jobs or applicants.
 * 3. Admin Platform Analytics (GET /api/admin/stats):
 *    - Real counts for totalUsers, totalEmployers, totalCandidates, totalJobs, activeJobs, totalApplications, totalCompanies.
 *    - Zero defaults instead of '1.2M', '45k', '120k'.
 *    - Genuine system health derivation.
 * 4. Static Frontend Integrity & Prohibited Token Scanner:
 *    - Scans HomePage, EmployerDashboard, AdminDashboard, CompanyProfilePage, JobDetailsPage, JobListings.
 *    - Ensures zero instances of fake counts, fabricated MoM/YoY growth strings, and mock sparklines.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';
import Company from '../src/models/Company.js';
import User from '../src/models/User.js';
import Application from '../src/models/Application.js';
import { getPublicStats, getEmployerJobs } from '../src/controllers/jobController.js';
import { getAdminStats } from '../src/controllers/adminController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

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

async function runProjectWideAuditTests() {
  console.log('\n================================================================');
  console.log('  CAREERCONNECT — PROJECT-WIDE HARDCODED DATA AUDIT TESTS');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: Public Platform Stats API Verification (Homepage dynamic metrics)
  // ==========================================================================
  console.log('--- 1. Testing Public Platform Statistics Endpoint (GET /api/jobs/public-stats) ---');

  // Test 1.1: Empty Database returns strictly zeros
  const origJobCount = Job.countDocuments;
  const origCompanyCount = Company.countDocuments;
  const origUserCount = User.countDocuments;
  const origAppCount = Application.countDocuments;

  Job.countDocuments = async (query = {}) => (query.status === 'Active' ? 0 : 0);
  Company.countDocuments = async (query = {}) => (query.status === 'active' ? 0 : 0);
  User.countDocuments = async (query = {}) => (query.role === 'candidate' ? 0 : 0);
  Application.countDocuments = async () => 0;

  const mockReqPublic = {};
  let publicStatsResult = null;
  const mockResPublic = {
    status(code) {
      assert(code === 200, 'Public stats responds with HTTP 200');
      return {
        json(data) {
          publicStatsResult = data;
        },
      };
    },
  };

  await getPublicStats(mockReqPublic, mockResPublic, (err) => {
    if (err) console.error(err);
  });

  assert(publicStatsResult?.success === true, 'Public stats response reports success: true');
  assert(publicStatsResult?.stats?.activeJobs === 0, 'Empty DB activeJobs is 0 (not 10,000+)');
  assert(publicStatsResult?.stats?.hiringCompanies === 0, 'Empty DB hiringCompanies is 0 (not 2,500+)');
  assert(publicStatsResult?.stats?.totalCandidates === 0, 'Empty DB totalCandidates is 0 (not 500k+)');
  assert(publicStatsResult?.stats?.totalApplications === 0, 'Empty DB totalApplications is 0');

  // Test 1.2: Database with real records returns accurate counts
  Job.countDocuments = async (query = {}) => (query.status === 'Active' ? 18 : 22);
  Company.countDocuments = async (query = {}) => (query.status === 'active' ? 6 : 7);
  User.countDocuments = async (query = {}) => (query.role === 'candidate' ? 45 : 60);
  Application.countDocuments = async () => 89;

  let realPublicResult = null;
  const mockResReal = {
    status(code) {
      assert(code === 200, 'Real public stats responds with HTTP 200');
      return {
        json(data) {
          realPublicResult = data;
        },
      };
    },
  };

  await getPublicStats(mockReqPublic, mockResReal, (err) => {
    if (err) console.error(err);
  });

  assert(realPublicResult?.stats?.activeJobs === 18, 'Active jobs matches exact database count (18)');
  assert(realPublicResult?.stats?.hiringCompanies === 6, 'Hiring companies matches active approved count (6)');
  assert(realPublicResult?.stats?.totalCandidates === 45, 'Total candidates matches registered candidate count (45)');
  assert(realPublicResult?.stats?.totalApplications === 89, 'Total applications matches submitted count (89)');

  // ==========================================================================
  // SECTION 2: Employer Dashboard Scoping & Metrics Verification
  // ==========================================================================
  console.log('\n--- 2. Testing Employer Dashboard Metrics & Scoping (GET /api/jobs/employer/my-jobs) ---');

  const employerAId = new mongoose.Types.ObjectId();
  const employerBId = new mongoose.Types.ObjectId();
  const jobA1 = new mongoose.Types.ObjectId();
  const jobA2 = new mongoose.Types.ObjectId();
  const jobB1 = new mongoose.Types.ObjectId();

  const mockDbJobs = [
    {
      _id: jobA1,
      title: 'Senior React Engineer',
      postedBy: employerAId,
      status: 'Active',
      toObject() { return { ...this }; },
    },
    {
      _id: jobA2,
      title: 'DevOps Architect',
      postedBy: employerAId,
      status: 'Closed',
      toObject() { return { ...this }; },
    },
    {
      _id: jobB1,
      title: 'Product Designer',
      postedBy: employerBId,
      status: 'Active',
      toObject() { return { ...this }; },
    },
  ];

  const mockDbApplications = [
    { _id: new mongoose.Types.ObjectId(), jobId: jobA1, status: 'Applied' },
    { _id: new mongoose.Types.ObjectId(), jobId: jobA1, status: 'In Review' },
    { _id: new mongoose.Types.ObjectId(), jobId: jobA1, status: 'Shortlisted' },
    { _id: new mongoose.Types.ObjectId(), jobId: jobA2, status: 'Rejected' },
    // Employer B applications
    { _id: new mongoose.Types.ObjectId(), jobId: jobB1, status: 'Shortlisted' },
    { _id: new mongoose.Types.ObjectId(), jobId: jobB1, status: 'Applied' },
  ];

  const origJobFind = Job.find;
  const origAppFind = Application.find;

  // Mock Job.find
  Job.find = (query = {}) => {
    let result = mockDbJobs;
    if (query.postedBy) {
      result = result.filter((j) => j.postedBy.toString() === query.postedBy.toString());
    }
    return {
      populate() {
        return {
          sort() {
            return Promise.resolve(result);
          },
        };
      },
    };
  };

  // Mock Application.find
  Application.find = (query = {}) => {
    let result = mockDbApplications;
    if (query.jobId && query.jobId.$in) {
      const idStrs = query.jobId.$in.map((id) => id.toString());
      result = result.filter((a) => idStrs.includes(a.jobId.toString()));
    }
    return Promise.resolve(result);
  };

  // Test 2.1: Fresh Employer (Employer C with 0 jobs) returns all zeros
  const employerCId = new mongoose.Types.ObjectId();
  const mockReqEmpC = { user: { _id: employerCId, role: 'employer' } };
  let empCResult = null;
  const mockResEmpC = {
    status(code) {
      assert(code === 200, 'Fresh employer endpoint responds with HTTP 200');
      return {
        json(data) {
          empCResult = data;
        },
      };
    },
  };

  await getEmployerJobs(mockReqEmpC, mockResEmpC, (err) => {
    if (err) console.error(err);
  });

  assert(empCResult?.success === true, 'Fresh employer response is success');
  assert(empCResult?.metrics?.totalPostings === 0, 'Fresh employer totalPostings is strictly 0');
  assert(empCResult?.metrics?.activeJobs === 0, 'Fresh employer activeJobs is strictly 0');
  assert(empCResult?.metrics?.totalApplicants === 0, 'Fresh employer totalApplicants is strictly 0 (not 142)');
  assert(empCResult?.metrics?.shortlistedApplicants === 0, 'Fresh employer shortlisted is strictly 0 (not 28)');
  assert(empCResult?.metrics?.pendingApplicants === 0, 'Fresh employer pending is strictly 0');
  assert(empCResult?.jobs?.length === 0, 'Fresh employer has 0 job items');

  // Test 2.2: Active Employer A receives strictly their metrics
  const mockReqEmpA = { user: { _id: employerAId, role: 'employer' } };
  let empAResult = null;
  const mockResEmpA = {
    status(code) {
      assert(code === 200, 'Employer A endpoint responds with HTTP 200');
      return {
        json(data) {
          empAResult = data;
        },
      };
    },
  };

  await getEmployerJobs(mockReqEmpA, mockResEmpA, (err) => {
    if (err) console.error(err);
  });

  assert(empAResult?.metrics?.totalPostings === 2, 'Employer A total postings is 2');
  assert(empAResult?.metrics?.activeJobs === 1, 'Employer A active jobs is 1 (1 Active, 1 Closed)');
  assert(empAResult?.metrics?.totalApplicants === 4, 'Employer A total applicants is 4 (does not include Employer B)');
  assert(empAResult?.metrics?.pendingApplicants === 1, 'Employer A pending applicants is 1');
  assert(empAResult?.metrics?.inReviewApplicants === 1, 'Employer A in-review applicants is 1');
  assert(empAResult?.metrics?.shortlistedApplicants === 1, 'Employer A shortlisted applicants is 1');
  assert(empAResult?.metrics?.rejectedApplicants === 1, 'Employer A rejected applicants is 1');

  // Check job applicant count breakdown
  const job1WithCount = empAResult?.jobs?.find((j) => j._id.toString() === jobA1.toString());
  const job2WithCount = empAResult?.jobs?.find((j) => j._id.toString() === jobA2.toString());
  assert(job1WithCount?.applicantCount === 3, 'Job A1 has exact applicant count of 3');
  assert(job2WithCount?.applicantCount === 1, 'Job A2 has exact applicant count of 1');

  // ==========================================================================
  // SECTION 3: Admin Platform Analytics Verification (GET /api/admin/stats)
  // ==========================================================================
  console.log('\n--- 3. Testing Admin Platform Analytics (GET /api/admin/stats) ---');

  // Test 3.1: Zero Database Returns Zeros
  User.countDocuments = async (query = {}) => {
    if (query.role === 'employer') return 0;
    if (query.role === 'candidate') return 0;
    return 0;
  };
  Job.countDocuments = async (query = {}) => {
    if (query.status === 'Active') return 0;
    return 0;
  };
  Application.countDocuments = async () => 0;
  Company.countDocuments = async () => 0;

  const mockReqAdmin = { user: { role: 'admin' } };
  let adminStatsResult = null;
  const mockResAdmin = {
    status(code) {
      assert(code === 200, 'Admin stats responds with HTTP 200');
      return {
        json(data) {
          adminStatsResult = data;
        },
      };
    },
  };

  await getAdminStats(mockReqAdmin, mockResAdmin, (err) => {
    if (err) console.error(err);
  });

  assert(adminStatsResult?.success === true, 'Admin stats reports success: true');
  assert(adminStatsResult?.stats?.totalUsers === 0, 'Admin totalUsers is 0 (not 1.2M)');
  assert(adminStatsResult?.stats?.totalEmployers === 0, 'Admin totalEmployers is 0 (not 45k)');
  assert(adminStatsResult?.stats?.totalJobs === 0, 'Admin totalJobs is 0 (not 120k)');
  assert(adminStatsResult?.stats?.activeJobs === 0, 'Admin activeJobs is 0 (not 12)');
  assert(adminStatsResult?.stats?.totalApplications === 0, 'Admin totalApplications is 0');
  assert(adminStatsResult?.stats?.totalCompanies === 0, 'Admin totalCompanies is 0');
  assert(
    adminStatsResult?.stats?.systemHealth === 'Healthy' || adminStatsResult?.stats?.systemHealth === 'Degraded',
    `Admin system health is dynamic: ${adminStatsResult?.stats?.systemHealth}`
  );

  // Restore mocks
  Job.countDocuments = origJobCount;
  Company.countDocuments = origCompanyCount;
  User.countDocuments = origUserCount;
  Application.countDocuments = origAppCount;
  Job.find = origJobFind;
  Application.find = origAppFind;

  // ==========================================================================
  // SECTION 4: Static Codebase Integrity & Prohibited Token Scanner
  // ==========================================================================
  console.log('\n--- 4. Scanning Frontend Components for Prohibited Fake Data Tokens ---');

  const filesToScan = [
    {
      file: 'client/src/pages/HomePage.jsx',
      prohibited: ['10,000+', '2,500+', '500k+'],
      required: ['publicStats.activeJobs', 'publicStats.hiringCompanies', 'publicStats.totalCandidates'],
    },
    {
      file: 'client/src/pages/EmployerDashboard.jsx',
      prohibited: [
        'totalApplicants || 142',
        '+18% vs last month',
        '<span className="text-3xl font-black text-slate-900">28</span>',
        '[40, 60, 50, 80, 70, 90, 85]',
      ],
      required: ['metrics.shortlistedApplicants', 'activeCount', 'totalApplicants'],
    },
    {
      file: 'client/src/pages/AdminDashboard.jsx',
      prohibited: [
        "totalUsers: '1.2M'",
        "totalEmployers: '45k'",
        "totalJobs: '120k'",
        "|| '1.2M'",
        "|| '45k'",
        "|| '120k'",
        '+12% MoM growth',
        '+8% new this week',
        '|| 12',
      ],
      required: ['stats.totalUsers ?? 0', 'stats.totalEmployers ?? 0', 'stats.totalJobs ?? 0'],
    },
    {
      file: 'client/src/pages/CompanyProfilePage.jsx',
      prohibited: [
        'over 200% YoY growth',
        "|| 'technova.io'",
        '|| 2015',
        "|| 'Series B'",
      ],
      required: ['company.foundedYear ||', 'company.stage ||'],
    },
    {
      file: 'client/src/pages/JobDetailsPage.jsx',
      prohibited: ['|| 2015', "|| '500-1000 Employees'"],
      required: ['job.companyId.size ||', 'job.companyId.foundedYear ||'],
    },
    {
      file: 'client/src/pages/JobListings.jsx',
      prohibited: ["count: '2,451'", "count: '842'", "count: '320'", "count: '1,120'"],
      required: ["'Full-Time', 'Contract', 'Part-Time', 'Remote'"],
    },
  ];

  for (const { file, prohibited, required } of filesToScan) {
    const fullPath = path.join(projectRoot, file);
    assert(fs.existsSync(fullPath), `Component file exists: ${file}`);
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const token of prohibited) {
      const containsProhibited = content.includes(token);
      assert(!containsProhibited, `Prohibited token "${token}" is ABSENT in ${file}`);
    }

    for (const token of required) {
      const containsRequired = content.includes(token);
      assert(containsRequired, `Required dynamic expression "${token}" is PRESENT in ${file}`);
    }
  }

  // ==========================================================================
  // SECTION 5: Summary & Exit Status
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  AUDIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProjectWideAuditTests().catch((err) => {
  console.error('Unhandled audit test exception:', err);
  process.exit(1);
});

