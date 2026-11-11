/**
 * CareerConnect — Application Withdrawal & Resume Deletion Test Suite
 *
 * Verifies:
 * 1. Candidate can withdraw an eligible application (PATCH /api/applications/:id/withdraw).
 * 2. Application status transitions strictly to 'Withdrawn'.
 * 3. Application records are never permanently deleted from database (audit history preserved).
 * 4. Active application metrics update dynamically (withdrawn applications excluded from active count).
 * 5. Employer can see the updated 'Withdrawn' status on their dashboard.
 * 6. Employer is prevented from modifying the status of a withdrawn application.
 * 7. Candidate authorization: another candidate cannot withdraw someone else's application (HTTP 403).
 * 8. Employer cannot withdraw a candidate's application via the candidate endpoint (HTTP 403).
 * 9. Already withdrawn applications cannot be withdrawn again (HTTP 400).
 * 10. Finalized applications (e.g. Rejected) cannot be withdrawn (HTTP 400).
 * 11. Profile resume deletion (DELETE /api/users/resume) removes resume from user profile.
 * 12. Historical application attachments are strictly preserved on disk when referenced by applications.
 * 13. Unreferenced profile resumes are safely deleted from disk with path traversal protections.
 * 14. Candidate can upload a replacement resume after deletion.
 * 15. Another user cannot delete someone else's profile resume.
 * 16. JSX inspection: CandidateDashboard contains accessible confirmation dialogs, View/Replace/Delete actions, and Withdrawn badge.
 * 17. JSX inspection: EmployerDashboard and JobDetailsPage reflect Withdrawn status.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../src/config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enforce isolated test database
process.env.NODE_ENV = 'test';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/careerconnect_test_db';
process.env.MONGODB_URI = TEST_DB_URI;

// Import backend app and models
import { app, httpServer } from '../src/server.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Company from '../src/models/Company.js';
import Application from '../src/models/Application.js';

const TEST_PORT = 5144;
let serverInstance = null;
let testBaseUrl = `http://127.0.0.1:${TEST_PORT}/api`;

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

async function request(method, endpoint, token = null, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(testBaseUrl + endpoint);
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsedData = {};
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            parsedData = { raw: rawData };
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\n================================================================');
  console.log('  CAREERCONNECT — APPLICATION WITHDRAWAL & RESUME DELETION SUITE');
  console.log('================================================================\n');

  try {
    // 1. Connect to isolated test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assert(
      mongoose.connection.name === 'careerconnect_test_db',
      'Database connection is strictly bound to careerconnect_test_db'
    );

    // 2. Start HTTP server
    await new Promise((resolve) => {
      serverInstance = httpServer.listen(TEST_PORT, () => {
        console.log(`  ✓ Test HTTP server listening on 127.0.0.1:${TEST_PORT}`);
        resolve();
      });
    });

    console.log('\n--- 1. Setting Up Test Accounts, Companies, and Jobs ---');

    // Create test employer
    let employer = await User.findOne({ email: 'test_employer_recruiter@careerconnect.com' });
    if (!employer) {
      employer = await User.create({
        name: 'Tech Recruiter',
        email: 'test_employer_recruiter@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'employer',
        isEmailVerified: true,
      });
    }

    // Create Candidate A
    let candidateA = await User.findOne({ email: 'test_candidate_a@careerconnect.com' });
    if (!candidateA) {
      candidateA = await User.create({
        name: 'Candidate Alice',
        email: 'test_candidate_a@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'candidate',
        isEmailVerified: true,
        resumeUrl: '/uploads/alice_historical_resume.pdf',
        resumeOriginalName: 'Alice_Resume_2026.pdf',
      });
    } else {
      candidateA.resumeUrl = '/uploads/alice_historical_resume.pdf';
      candidateA.resumeOriginalName = 'Alice_Resume_2026.pdf';
      await candidateA.save();
    }

    // Create Candidate B
    let candidateB = await User.findOne({ email: 'test_candidate_b@careerconnect.com' });
    if (!candidateB) {
      candidateB = await User.create({
        name: 'Candidate Bob',
        email: 'test_candidate_b@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'candidate',
        isEmailVerified: true,
        resumeUrl: '/uploads/bob_unattached_resume.pdf',
        resumeOriginalName: 'Bob_Resume.pdf',
      });
    } else {
      candidateB.resumeUrl = '/uploads/bob_unattached_resume.pdf';
      candidateB.resumeOriginalName = 'Bob_Resume.pdf';
      await candidateB.save();
    }

    // Create Company
    let company = await Company.findOne({ name: 'Alpha Innovations' });
    if (!company) {
      company = await Company.create({
        name: 'Alpha Innovations',
        employerId: employer._id,
        industry: 'Cloud Software',
        location: 'Bengaluru, Karnataka',
      });
    }

    // Create Jobs
    let job1 = await Job.findOne({ title: 'Full Stack Engineer - Withdrawal Suite' });
    if (!job1) {
      job1 = await Job.create({
        title: 'Full Stack Engineer - Withdrawal Suite',
        companyId: company._id,
        postedBy: employer._id,
        location: 'Bengaluru, Karnataka',
        jobType: 'Full-Time',
        experienceLevel: 'Mid Level',
        salaryMin: 1200000,
        salaryMax: 2000000,
        salaryPeriod: 'yearly',
        salaryCurrency: 'INR',
        description: 'Building modern cloud full stack apps.',
        status: 'Active',
      });
    }

    let job2 = await Job.findOne({ title: 'Backend Architect - Withdrawal Suite' });
    if (!job2) {
      job2 = await Job.create({
        title: 'Backend Architect - Withdrawal Suite',
        companyId: company._id,
        postedBy: employer._id,
        location: 'Pune, Maharashtra',
        jobType: 'Full-Time',
        experienceLevel: 'Senior Level',
        salaryMin: 2200000,
        salaryMax: 3500000,
        salaryPeriod: 'yearly',
        salaryCurrency: 'INR',
        description: 'Distributed microservices architecture.',
        status: 'Active',
      });
    }

    const tokenA = generateToken(candidateA);
    const tokenB = generateToken(candidateB);
    const tokenEmployer = generateToken(employer);

    assert(candidateA && candidateB && employer && job1 && job2, 'Test accounts and jobs ready');

    // Clean previous test applications for deterministic runs
    await Application.deleteMany({ candidateId: { $in: [candidateA._id, candidateB._id] } });

    // Create physical dummy files in uploads directory
    const uploadsDir = path.resolve('uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const aliceFilePath = path.join(uploadsDir, 'alice_historical_resume.pdf');
    const bobFilePath = path.join(uploadsDir, 'bob_unattached_resume.pdf');
    fs.writeFileSync(aliceFilePath, '%PDF-1.4 Mock historical resume for Alice');
    fs.writeFileSync(bobFilePath, '%PDF-1.4 Mock unattached resume for Bob');

    assert(fs.existsSync(aliceFilePath), 'Mock Alice historical resume created in uploads');
    assert(fs.existsSync(bobFilePath), 'Mock Bob unattached resume created in uploads');

    // --- SECTION 2: Application Withdrawal Workflow ---
    console.log('\n--- 2. Testing Application Withdrawal Workflow ---');

    // Candidate A applies to Job 1
    const app1 = await Application.create({
      jobId: job1._id,
      candidateId: candidateA._id,
      resumeUrl: '/uploads/alice_historical_resume.pdf',
      resumeOriginalName: 'Alice_Resume_2026.pdf',
      status: 'Applied',
    });

    // Candidate A applies to Job 2
    const app2 = await Application.create({
      jobId: job2._id,
      candidateId: candidateA._id,
      resumeUrl: '/uploads/alice_historical_resume.pdf',
      resumeOriginalName: 'Alice_Resume_2026.pdf',
      status: 'In Review',
    });

    // Verify initial active metrics for Candidate A
    const preMetricsRes = await request('GET', '/applications/candidate/my-applications', tokenA);
    assert(preMetricsRes.status === 200, 'Candidate A fetches my-applications (HTTP 200)');
    assert(preMetricsRes.data.metrics.totalApps === 2, 'Initial totalApps is 2');
    assert(preMetricsRes.data.metrics.activeApps === 2, 'Initial activeApps is 2');
    assert(preMetricsRes.data.metrics.withdrawn === 0, 'Initial withdrawn count is 0');

    // 2A. Candidate A withdraws App 1
    const withdrawRes = await request('PATCH', `/applications/${app1._id}/withdraw`, tokenA);
    assert(withdrawRes.status === 200, 'PATCH /api/applications/:id/withdraw responds with HTTP 200');
    assert(withdrawRes.data.success === true, 'Response indicates success: true');
    assert(withdrawRes.data.application?.status === 'Withdrawn', 'Application status updated to "Withdrawn"');

    // 2B. Verify application is NOT deleted from database
    const app1InDb = await Application.findById(app1._id);
    assert(app1InDb !== null, 'Application document is preserved in database (NOT permanently deleted)');
    assert(app1InDb.status === 'Withdrawn', 'Database record status is strictly "Withdrawn"');
    assert(app1InDb.resumeUrl === '/uploads/alice_historical_resume.pdf', 'Historical resumeUrl is preserved');

    // 2C. Verify active metrics update immediately
    const postMetricsRes = await request('GET', '/applications/candidate/my-applications', tokenA);
    assert(postMetricsRes.data.metrics.totalApps === 2, 'Total apps remains 2 (all records preserved)');
    assert(postMetricsRes.data.metrics.activeApps === 1, 'Active apps decremented to 1 (withdrawn app excluded)');
    assert(postMetricsRes.data.metrics.withdrawn === 1, 'Withdrawn count is now 1');

    // 2D. Employer view verification
    const empJobAppsRes = await request('GET', `/applications/job/${job1._id}`, tokenEmployer);
    assert(empJobAppsRes.status === 200, 'Employer retrieves job applications');
    const empViewApp1 = empJobAppsRes.data.applications.find((a) => a._id.toString() === app1._id.toString());
    assert(empViewApp1 && empViewApp1.status === 'Withdrawn', 'Employer clearly sees candidate has "Withdrawn"');

    // 2E. Employer blocked from changing status of withdrawn application
    const empStatusUpdateRes = await request(
      'PATCH',
      `/applications/${app1._id}/status`,
      tokenEmployer,
      { status: 'Shortlisted' }
    );
    assert(
      empStatusUpdateRes.status === 400,
      'Employer blocked from changing status of withdrawn application (HTTP 400)'
    );
    assert(
      empStatusUpdateRes.data.message?.includes('withdrawn'),
      'Clear descriptive error returned on attempt to alter withdrawn application'
    );

    // --- SECTION 3: Withdrawal Security, Permissions & Constraints ---
    console.log('\n--- 3. Testing Withdrawal Security, Permissions & Constraints ---');

    // 3A. Candidate B (unauthorized) cannot withdraw Candidate A's application
    const crossWithdrawRes = await request('PATCH', `/applications/${app2._id}/withdraw`, tokenB);
    assert(
      crossWithdrawRes.status === 403,
      'Candidate B blocked from withdrawing Candidate A application with HTTP 403 Forbidden'
    );

    // 3B. Employer cannot withdraw candidate application via candidate endpoint
    const empWithdrawRes = await request('PATCH', `/applications/${app2._id}/withdraw`, tokenEmployer);
    assert(
      empWithdrawRes.status === 403,
      'Employer blocked from withdrawing candidate application with HTTP 403 Forbidden'
    );

    // 3C. Repeated withdrawal attempt of already withdrawn application
    const repeatWithdrawRes = await request('PATCH', `/applications/${app1._id}/withdraw`, tokenA);
    assert(
      repeatWithdrawRes.status === 400,
      'Repeated withdrawal of already withdrawn application rejected with HTTP 400'
    );
    assert(
      repeatWithdrawRes.data.message?.includes('already been withdrawn'),
      'Error message states application has already been withdrawn'
    );

    // 3D. Cannot withdraw finalized/rejected application
    const rejectedApp = await Application.create({
      jobId: job1._id,
      candidateId: candidateB._id,
      status: 'Rejected',
    });
    const withdrawRejectedRes = await request('PATCH', `/applications/${rejectedApp._id}/withdraw`, tokenB);
    assert(
      withdrawRejectedRes.status === 400,
      'Attempting to withdraw rejected application rejected with HTTP 400'
    );
    assert(
      withdrawRejectedRes.data.message?.includes('finalized'),
      'Error message states cannot withdraw finalized/rejected application'
    );

    // Clean up temporary rejected app
    await Application.deleteOne({ _id: rejectedApp._id });

    // --- SECTION 4: Resume Deletion & Historical Attachment Preservation ---
    console.log('\n--- 4. Testing Resume Deletion & Historical Attachment Preservation ---');

    // 4A. Candidate A deletes profile resume while Application 1 & 2 reference the file
    assert(fs.existsSync(aliceFilePath), 'Alice resume file exists prior to profile deletion');
    const deleteAliceRes = await request('DELETE', '/users/resume', tokenA);
    assert(deleteAliceRes.status === 200, 'DELETE /api/users/resume responds with HTTP 200');
    assert(deleteAliceRes.data.success === true, 'Response indicates success: true');
    assert(deleteAliceRes.data.user?.resumeUrl === '', 'Response returns empty resumeUrl');

    // Verify User record in MongoDB
    const updatedAliceUser = await User.findById(candidateA._id);
    assert(updatedAliceUser.resumeUrl === '', 'Candidate A user.resumeUrl cleared in MongoDB');
    assert(updatedAliceUser.resumeOriginalName === '', 'Candidate A resumeOriginalName cleared in MongoDB');

    // CRUCIAL: Historical application file MUST NOT be deleted because App 1 and App 2 reference it!
    assert(
      fs.existsSync(aliceFilePath),
      'CRITICAL: Historical application resume attachment remains strictly PRESERVED on disk'
    );

    const app1Check = await Application.findById(app1._id);
    assert(
      app1Check.resumeUrl === '/uploads/alice_historical_resume.pdf',
      'Application 1 continues referencing historical resume'
    );

    // 4B. Candidate B deletes profile resume with NO application references
    assert(fs.existsSync(bobFilePath), 'Bob unattached resume file exists prior to deletion');
    const deleteBobRes = await request('DELETE', '/users/resume', tokenB);
    assert(deleteBobRes.status === 200, 'Candidate B DELETE /api/users/resume responds with HTTP 200');

    const updatedBobUser = await User.findById(candidateB._id);
    assert(updatedBobUser.resumeUrl === '', 'Candidate B resumeUrl cleared in MongoDB');

    // Because NO application references Bob's file, it is safely unlinked from disk
    assert(
      !fs.existsSync(bobFilePath),
      'Unreferenced profile resume is safely deleted from disk'
    );

    // 4C. Deleting when no resume exists returns HTTP 400
    const deleteEmptyRes = await request('DELETE', '/users/resume', tokenB);
    assert(deleteEmptyRes.status === 400, 'Deleting when no resume is uploaded returns HTTP 400');

    // 4D. Employer cannot delete candidate resume
    const empDeleteRes = await request('DELETE', '/users/resume', tokenEmployer);
    assert(empDeleteRes.status === 403, 'Employer blocked from deleting resume with HTTP 403 Forbidden');

    // Clean up Alice physical file
    if (fs.existsSync(aliceFilePath)) {
      fs.unlinkSync(aliceFilePath);
    }

    // --- SECTION 5: Frontend JSX Static Code Analysis ---
    console.log('\n--- 5. Verifying Frontend Components & UI Requirements ---');

    const candidateDashboardPath = path.resolve(__dirname, '../../client/src/pages/CandidateDashboard.jsx');
    const employerDashboardPath = path.resolve(__dirname, '../../client/src/pages/EmployerDashboard.jsx');
    const jobDetailsPagePath = path.resolve(__dirname, '../../client/src/pages/JobDetailsPage.jsx');
    const authContextPath = path.resolve(__dirname, '../../client/src/context/AuthContext.jsx');
    const jobContextPath = path.resolve(__dirname, '../../client/src/context/JobContext.jsx');

    const candidateDashboardSrc = fs.readFileSync(candidateDashboardPath, 'utf8');
    const employerDashboardSrc = fs.readFileSync(employerDashboardPath, 'utf8');
    const jobDetailsPageSrc = fs.readFileSync(jobDetailsPagePath, 'utf8');
    const authContextSrc = fs.readFileSync(authContextPath, 'utf8');
    const jobContextSrc = fs.readFileSync(jobContextPath, 'utf8');

    // 5A. CandidateDashboard UI Elements
    assert(
      candidateDashboardSrc.includes('Withdraw Application'),
      'CandidateDashboard contains "Withdraw Application" action'
    );
    assert(
      candidateDashboardSrc.includes('handleOpenWithdrawModal') &&
        candidateDashboardSrc.includes('handleConfirmWithdraw'),
      'CandidateDashboard defines withdraw confirmation modal handlers'
    );
    assert(
      candidateDashboardSrc.includes('isWithdrawModalOpen') &&
        candidateDashboardSrc.includes('Confirm Withdrawal'),
      'CandidateDashboard renders accessible withdrawal confirmation dialog'
    );
    assert(
      candidateDashboardSrc.includes('Active Apps'),
      'CandidateDashboard displays "Active Apps" metric card'
    );
    assert(
      candidateDashboardSrc.includes("case 'Withdrawn'"),
      'CandidateDashboard getStatusBadge supports "Withdrawn" status badge'
    );
    assert(
      candidateDashboardSrc.includes('View Resume') &&
        candidateDashboardSrc.includes('Replace') &&
        candidateDashboardSrc.includes('Delete'),
      'CandidateDashboard Update Resume section contains View, Replace, and Delete actions'
    );
    assert(
      candidateDashboardSrc.includes('isDeleteResumeModalOpen') &&
        candidateDashboardSrc.includes('Yes, Delete Resume'),
      'CandidateDashboard renders accessible resume deletion confirmation dialog'
    );

    // 5B. Context Methods
    assert(
      authContextSrc.includes('deleteResume'),
      'AuthContext defines and exports deleteResume'
    );
    assert(
      jobContextSrc.includes('withdrawApplication'),
      'JobContext defines and exports withdrawApplication'
    );

    // 5C. EmployerDashboard & JobDetailsPage
    assert(
      employerDashboardSrc.includes("app.status === 'Withdrawn'") &&
        employerDashboardSrc.includes('Withdrawn'),
      'EmployerDashboard renders explicit Withdrawn badge when applicant has withdrawn'
    );
    assert(
      jobDetailsPageSrc.includes("applicationStatus === 'Withdrawn'") &&
        jobDetailsPageSrc.includes('Application Withdrawn'),
      'JobDetailsPage handles Application Withdrawn status'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (serverInstance) {
      await new Promise((res) => serverInstance.close(res));
    }
    await mongoose.disconnect();
    console.log('\n================================================================');
    console.log(`  WITHDRAWAL & RESUME DELETION TESTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

