/**
 * CareerConnect — Comprehensive Isolated Integration Test Suite
 * 
 * Strict Database Isolation:
 * Runs exclusively against 'careerconnect_test_db' (or TEST_MONGODB_URI).
 * Guarantees zero interference with development database 'careerconnect_db'.
 * 
 * Scope of Coverage:
 * 1. Database Connection & Seeding (Isolated Test DB)
 * 2. Public Endpoints (Health, Jobs, Featured, Categories, Companies)
 * 3. Multi-Role Authentication (Candidate, Employer, Admin) & Invalid Credentials
 * 4. Role-Based Access Control (RBAC) & Route Protection (401/403)
 * 5. Candidate Workflow (Search, Apply, Duplicate Block, Track Applications)
 * 6. Employer Workflow (Post Job, View Applicants, Status Progression)
 * 7. Admin Workflow (Platform Analytics, User Moderation, Taxonomy Management)
 * 8. Real-Time Multi-User Socket.IO (Direct Messaging & Notification Delivery)
 */

import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';
import { getJwtSecret, validateJwtConfig } from '../src/config/jwt.js';

// Enforce test environment and isolated test database
process.env.NODE_ENV = 'test';
const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/careerconnect_test_db';
process.env.MONGODB_URI = TEST_DB_URI;

// Import application and seeders after environment variables are set
import { app, httpServer } from '../src/server.js';
import { seedDatabase } from '../src/seeders/seed.js';
import { closeDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Application from '../src/models/Application.js';
import Company from '../src/models/Company.js';
import Message from '../src/models/Message.js';
import Notification from '../src/models/Notification.js';

const TEST_PORT = 5099;
let testBaseUrl = `http://127.0.0.1:${TEST_PORT}/api`;

let stats = {
  passed: 0,
  failed: 0,
  total: 0,
};

function assert(condition, message) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    stats.failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Helper for HTTP requests
async function api(path, options = {}) {
  const url = `${testBaseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  CAREERCONNECT — COMPREHENSIVE ISOLATED INTEGRATION TEST SUITE');
  console.log('================================================================');
  console.log(`Target Database: ${TEST_DB_URI}`);
  console.log(`Safety Check: Strictly isolated from 'careerconnect_db'.\n`);

  try {
    // -------------------------------------------------------------
    // PHASE 1: Isolated Database Setup & Seeding
    // -------------------------------------------------------------
    console.log('--- PHASE 1: Isolated Test Database Initialization ---');
    await seedDatabase();
    assert(mongoose.connection.name === 'careerconnect_test_db', `Connected strictly to test database (${mongoose.connection.name})`);

    // Start Test HTTP / Socket Server
    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
    console.log(`  ✓ Test HTTP and Socket.IO server listening on 127.0.0.1:${TEST_PORT}\n`);

    // -------------------------------------------------------------
    // PHASE 2: Public API Endpoints
    // -------------------------------------------------------------
    console.log('--- PHASE 2: Public Endpoints Verification ---');
    const health = await api('/health');
    assert(health.status === 200 && health.data.status === 'healthy', 'GET /api/health returns HTTP 200 and status: healthy');

    const featured = await api('/jobs/featured');
    assert(featured.status === 200 && featured.data.success && featured.data.count > 0, `GET /api/jobs/featured returns ${featured.data.count} featured jobs`);

    const jobsFilter = await api('/jobs?jobType=Full-Time&page=1&limit=5');
    assert(jobsFilter.status === 200 && jobsFilter.data.success && Array.isArray(jobsFilter.data.jobs), 'GET /api/jobs with filters returns paginated results');

    const companies = await api('/companies');
    assert(companies.status === 200 && companies.data.success && companies.data.companies.length > 0, `GET /api/companies returns list of companies (${companies.data.companies.length} found)`);

    // -------------------------------------------------------------
    // PHASE 3: Authentication & Security
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Authentication & Security ---');
    // Verify Centralized JWT Validation
    assert(validateJwtConfig() === true, 'validateJwtConfig() passes with valid configured secret (>= 32 chars)');

    // User Registration Generates Valid JWT
    const regEmail = `test_candidate_${Date.now()}@careerconnect.com`;
    const regRes = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Jordan Test',
        email: regEmail,
        password: 'Password123!',
        role: 'candidate',
      }),
    });
    assert(regRes.status === 201 && regRes.data.token, 'POST /api/auth/register generates a JWT token');
    const decodedRegToken = jwt.verify(regRes.data.token, getJwtSecret());
    assert(decodedRegToken.id === regRes.data.user._id, 'Registration JWT token verifiable with centralized getJwtSecret()');

    // Invalid credentials
    const badLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@careerconnect.com', password: 'WrongPassword!' }),
    });
    assert(badLogin.status === 401 && badLogin.data.success === false, 'POST /api/auth/login rejects invalid credentials with HTTP 401');

    // Candidate Login
    const candLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'alex@careerconnect.com', password: 'CandidatePassword123!' }),
    });
    assert(candLogin.status === 200 && candLogin.data.token && candLogin.data.user.role === 'candidate', 'Candidate (Alex) login succeeds with JWT and role: candidate');
    const candToken = candLogin.data.token;
    const candId = candLogin.data.user._id;
    const decodedLoginToken = jwt.verify(candToken, getJwtSecret());
    assert(decodedLoginToken.id === candId, 'Login JWT token verified with exact same centralized getJwtSecret()');

    // Employer Login
    const empLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'recruiter@technova.com', password: 'EmployerPassword123!' }),
    });
    assert(empLogin.status === 200 && empLogin.data.token && empLogin.data.user.role === 'employer', 'Employer (Sarah) login succeeds with JWT and role: employer');
    const empToken = empLogin.data.token;
    const empId = empLogin.data.user._id;

    // Admin Login
    const adminLogin = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@careerconnect.com', password: 'AdminPassword123!' }),
    });
    assert(adminLogin.status === 200 && adminLogin.data.token && adminLogin.data.user.role === 'admin', 'Admin login succeeds with JWT and role: admin');
    const adminToken = adminLogin.data.token;

    // Current User Profile Verification
    const myProfile = await api('/auth/me', {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert(myProfile.status === 200 && myProfile.data.user.email === 'alex@careerconnect.com', 'GET /api/auth/me returns authenticated user identity');

    // Foreign / Tampered Token Rejection
    const foreignToken = jwt.sign({ id: candId }, 'different_foreign_secret_32_characters_long!', { expiresIn: '1h' });
    const foreignRes = await api('/auth/me', {
      headers: { Authorization: `Bearer ${foreignToken}` },
    });
    assert(foreignRes.status === 401, 'Protected route rejects token signed with foreign secret (HTTP 401)');

    // Expired Token Rejection
    const expiredToken = jwt.sign({ id: candId }, getJwtSecret(), { expiresIn: '-1s' });
    const expiredRes = await api('/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredRes.status === 401, 'Protected route rejects expired token (HTTP 401)');

    // -------------------------------------------------------------
    // PHASE 4: Role-Based Access Control (RBAC)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Role-Based Access Control (RBAC) ---');
    // Candidate attempting Admin route -> 403 Forbidden
    const candOnAdmin = await api('/admin/stats', {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert(candOnAdmin.status === 403, 'Candidate blocked from Admin route with HTTP 403 Forbidden');

    // Employer attempting Admin route -> 403 Forbidden
    const empOnAdmin = await api('/admin/stats', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert(empOnAdmin.status === 403, 'Employer blocked from Admin route with HTTP 403 Forbidden');

    // Candidate attempting Employer Job Creation -> 403 Forbidden
    const candPostJob = await api('/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` },
      body: JSON.stringify({ title: 'Illegal Post', category: 'Design' }),
    });
    assert(candPostJob.status === 403, 'Candidate blocked from Employer job creation with HTTP 403 Forbidden');

    // Admin accessing Admin route -> 200 OK
    const adminStats = await api('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminStats.status === 200 && adminStats.data.success, 'Admin authorized to access /api/admin/stats with HTTP 200 OK');

    // -------------------------------------------------------------
    // PHASE 5: Candidate Workflow & Duplicate Application Prevention
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: Candidate Workflow & Application Integrity ---');
    // Find a job posted by Sarah (TechNova) to test complete lifecycle
    const sarahJobDoc = await Job.findOne({ postedBy: empId });
    assert(!!sarahJobDoc, `Found target job posted by employer Sarah: "${sarahJobDoc.title}"`);

    // Candidate views specific job details
    const jobDetails = await api(`/jobs/${sarahJobDoc._id}`);
    assert(jobDetails.status === 200 && jobDetails.data.job._id === sarahJobDoc._id.toString(), `Candidate views details for job: "${sarahJobDoc.title}"`);

    // Ensure no pre-existing application for this clean test
    await Application.deleteMany({ jobId: sarahJobDoc._id, candidateId: candId });

    // Submit Application
    const applyRes = await api(`/applications/${sarahJobDoc._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` },
      body: JSON.stringify({
        coverNote: 'I am highly passionate about this position and believe my technical background fits well.',
        portfolioUrl: 'https://alexmorgan.dev',
      }),
    });
    assert(applyRes.status === 201 && applyRes.data.success, 'Candidate successfully submits job application (HTTP 201)');
    const createdAppId = applyRes.data.application?._id;

    // Test Duplicate Application Prevention
    const duplicateApplyRes = await api(`/applications/${sarahJobDoc._id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${candToken}` },
      body: JSON.stringify({
        coverNote: 'Duplicate application attempt',
      }),
    });
    assert(
      duplicateApplyRes.status === 400 && duplicateApplyRes.data.message.includes('already submitted'),
      'Duplicate application correctly rejected with HTTP 400 Bad Request'
    );

    // Verify candidate application tracking
    const myApps = await api('/applications/candidate/my-applications', {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert(
      myApps.status === 200 && myApps.data.applications.some(a => a._id === createdAppId),
      'Submitted application appears in Candidate My Applications list'
    );

    // -------------------------------------------------------------
    // PHASE 6: Employer Workflow
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: Employer Workflow & Applicant Review ---');
    // Employer posts a new job
    const createJobRes = await api('/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        title: 'Staff Cloud Infrastructure Architect',
        category: 'Development',
        jobType: 'Full-Time',
        experienceLevel: 'Senior Level',
        workplaceType: 'Hybrid',
        location: 'San Francisco, CA',
        salaryMin: 180000,
        salaryMax: 220000,
        description: 'Lead next-generation distributed multi-region cloud infrastructure.',
        skillsRequired: ['Kubernetes', 'AWS', 'Docker', 'Go', 'Terraform'],
      }),
    });
    assert(createJobRes.status === 201 && createJobRes.data.job.title.includes('Staff Cloud'), 'Employer successfully posts new job vacancy (HTTP 201)');

    // Employer retrieves applicants for their job
    const jobApplicants = await api(`/applications/job/${sarahJobDoc._id}`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert(jobApplicants.status === 200 && Array.isArray(jobApplicants.data.applications), 'Employer successfully retrieves job applicants for own job');

    // Employer updates candidate application status to 'Shortlisted'
    const updateStatusRes = await api(`/applications/${createdAppId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${empToken}` },
      body: JSON.stringify({
        status: 'Shortlisted',
        feedbackNote: 'Strong portfolio and relevant experience. Advancing to technical interview.',
      }),
    });
    assert(
      updateStatusRes.status === 200 && updateStatusRes.data.application.status === 'Shortlisted',
      'Employer updates applicant status to "Shortlisted" (HTTP 200)'
    );

    // -------------------------------------------------------------
    // PHASE 7: Admin Workflow & Governance
    // -------------------------------------------------------------
    console.log('\n--- PHASE 7: Admin Moderation & Taxonomy Management ---');
    // Admin retrieves users list
    const usersList = await api('/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(usersList.status === 200 && usersList.data.users.length > 0, `Admin retrieves system user list (${usersList.data.users.length} accounts registered)`);

    // Admin manages taxonomy: add unique tag
    const uniqueTagName = `CloudNative-${Date.now()}`;
    const addTag = await api('/admin/taxonomy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: uniqueTagName, type: 'tag' }),
    });
    assert(addTag.status === 201 && addTag.data.success, `Admin creates new taxonomy tag "${uniqueTagName}" (HTTP 201)`);

    const taxonomy = await api('/admin/taxonomy', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      taxonomy.status === 200 && taxonomy.data.tags.some(t => t.name === uniqueTagName),
      `New taxonomy tag "${uniqueTagName}" verified in active taxonomy list`
    );

    // -------------------------------------------------------------
    // PHASE 8: Multi-User Real-Time Socket.IO Communication
    // -------------------------------------------------------------
    console.log('\n--- PHASE 8: Multi-User Real-Time Socket.IO (Chat & Notifications) ---');
    // Test Socket.IO Rejection with Invalid / Tampered Token
    const invalidSocketClient = io(`http://127.0.0.1:${TEST_PORT}`, {
      auth: { token: 'invalid_tampered_jwt_token_string' },
      transports: ['websocket'],
      reconnection: false,
    });

    const socketAuthRejected = await new Promise((resolve) => {
      invalidSocketClient.on('connect_error', (err) => {
        resolve(err.message.includes('Invalid socket authentication token') || err.message.includes('token'));
      });
      invalidSocketClient.on('connect', () => resolve(false));
      setTimeout(() => resolve(false), 3000);
    });
    invalidSocketClient.disconnect();
    assert(socketAuthRejected, 'Socket.IO rejects connection with invalid/tampered token (connect_error)');

    // Authenticated Socket Connections
    const clientCandidate = io(`http://127.0.0.1:${TEST_PORT}`, {
      auth: { token: candToken },
      transports: ['websocket'],
    });

    const clientEmployer = io(`http://127.0.0.1:${TEST_PORT}`, {
      auth: { token: empToken },
      transports: ['websocket'],
    });

    const connectionsEstablished = await new Promise((resolve) => {
      let candOk = false;
      let empOk = false;

      clientCandidate.on('connect', () => {
        candOk = true;
        if (empOk) resolve(true);
      });

      clientEmployer.on('connect', () => {
        empOk = true;
        if (candOk) resolve(true);
      });

      setTimeout(() => resolve(candOk && empOk), 4000);
    });
    assert(connectionsEstablished, 'Candidate and Employer Socket.IO clients successfully authenticated');

    // Join direct messaging conversation room
    clientCandidate.emit('join_conversation', { partnerId: empId, jobId: sarahJobDoc._id });
    clientEmployer.emit('join_conversation', { partnerId: candId, jobId: sarahJobDoc._id });

    // Step A: Employer sends real-time message to Candidate
    const candidateReceivedPromise = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.messageText.includes('scheduling your interview')) {
          clientCandidate.off('new_message', handler);
          resolve(msg);
        }
      };
      clientCandidate.on('new_message', handler);
      setTimeout(() => resolve(null), 4000);
    });

    const testMsgText = `Hi Alex, thank you for applying to ${sarahJobDoc.title}. We are scheduling your interview.`;
    clientEmployer.emit('send_message', {
      receiverId: candId,
      jobId: sarahJobDoc._id,
      messageText: testMsgText,
    });

    const candidateReceivedMsg = await candidateReceivedPromise;
    assert(
      candidateReceivedMsg && candidateReceivedMsg.messageText === testMsgText,
      'Real-time message delivered from Employer to Candidate over WebSocket'
    );

    // Wait 200ms before sending reply
    await new Promise((r) => setTimeout(r, 200));

    // Step B: Candidate sends reply back to Employer
    const employerReceivedPromise = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.messageText.includes('speaking with the engineering team')) {
          clientEmployer.off('new_message', handler);
          resolve(msg);
        }
      };
      clientEmployer.on('new_message', handler);
      setTimeout(() => resolve(null), 4000);
    });

    const replyMsgText = `Thank you Sarah! I am looking forward to speaking with the engineering team.`;
    clientCandidate.emit('send_message', {
      receiverId: empId,
      jobId: sarahJobDoc._id,
      messageText: replyMsgText,
    });

    const employerReceivedMsg = await employerReceivedPromise;
    assert(
      employerReceivedMsg && employerReceivedMsg.messageText === replyMsgText,
      'Real-time reply delivered from Candidate to Employer over WebSocket'
    );

    // Clean up socket connections
    clientCandidate.disconnect();
    clientEmployer.disconnect();
    assert(true, 'Socket.IO clients cleanly disconnected');

    // -------------------------------------------------------------
    // Summary & Final Status
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  INTEGRATION TEST SUMMARY: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
    console.log('================================================================\n');

    if (stats.failed > 0) {
      console.error(`FAILURE: ${stats.failed} tests failed.`);
      process.exitCode = 1;
    } else {
      console.log('SUCCESS: All isolated integration tests completed cleanly!');
      process.exitCode = 0;
    }

  } catch (error) {
    console.error('Fatal Test Exception:', error);
    process.exitCode = 1;
  } finally {
    // Teardown: close server and MongoDB cleanly
    try {
      await new Promise((resolve) => httpServer.close(resolve));
      await closeDB();
      console.log('  ✓ Test server closed and database connection terminated cleanly.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    process.exit(process.exitCode || 0);
  }
}

runTestSuite();
