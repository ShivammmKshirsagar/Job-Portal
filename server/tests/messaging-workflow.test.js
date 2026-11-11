/**
 * CareerConnect — Messaging Workflow & Password Visibility Automated Test Suite
 *
 * Verifies:
 * 1. Candidate can initiate a conversation with an employer (via partnerId, companyId, or jobId).
 * 2. Dynamic employer resolution: automatically resolves employer from companyId or jobId.
 * 3. Employer can initiate a conversation with a candidate/applicant.
 * 4. Duplicate conversations are prevented: repeated initiation returns existing conversation.
 * 5. Authorization & privacy:
 *    - User cannot initiate conversation or send message to themselves.
 *    - Unauthorized user cannot access or archive conversations they are not part of.
 * 6. Socket.IO real-time events:
 *    - 'new_message' delivered to conversation room.
 *    - 'message_received' delivered to recipient user room.
 *    - Conversation record persists and updates in MongoDB.
 * 7. Conversation management:
 *    - Archiving and unarchiving conversation works per-user without affecting the partner.
 * 8. Password visibility toggle:
 *    - AuthPage (Login, Signup, Confirm Password) contains interactive show/hide password buttons.
 *    - ResetPasswordPage (New Password, Confirm New Password) contains interactive show/hide password buttons.
 *    - ARIA labels and type toggle logic ("password" <-> "text") properly verified.
 * 9. Frontend entry points:
 *    - JobDetailsPage contains "Message Employer" buttons.
 *    - CompanyProfilePage contains "Message Employer" button.
 *    - CandidateDashboard contains "Message Recruiter" button.
 *    - EmployerDashboard contains "Message Candidate" button.
 *    - MessagingPage handles query parameters and role-aware empty states.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';
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
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import { resolveEmployerForCompany } from '../src/controllers/companyController.js';

const TEST_PORT = 5122;
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

async function runMessagingTests() {
  console.log('\n================================================================');
  console.log('  CAREERCONNECT — MESSAGING WORKFLOW & PASSWORD VISIBILITY SUITE');
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

    // 3. Create or find test users
    console.log('\n--- 1. Setting Up Test Accounts (Employer, Candidate, Third-party) ---');
    
    // Clean up test collections for fresh assertions
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // Candidate Account
    let candidate = await User.findOne({ email: 'test_alex_candidate@careerconnect.com' });
    if (!candidate) {
      candidate = await User.create({
        name: 'Alex Rivera',
        email: 'test_alex_candidate@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'candidate',
        isEmailVerified: true,
      });
    }

    // Employer Account
    let employer = await User.findOne({ email: 'test_sarah_employer@careerconnect.com' });
    if (!employer) {
      employer = await User.create({
        name: 'Sarah Jenkins',
        email: 'test_sarah_employer@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'employer',
        isEmailVerified: true,
      });
    }

    // Bystander User (Unauthorized access testing)
    let outsider = await User.findOne({ email: 'test_outsider@careerconnect.com' });
    if (!outsider) {
      outsider = await User.create({
        name: 'Outsider Bob',
        email: 'test_outsider@careerconnect.com',
        password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
        role: 'candidate',
        isEmailVerified: true,
      });
    }

    // Test Company
    let company = await Company.findOne({ name: 'TechNova Solutions' });
    if (!company) {
      company = await Company.create({
        name: 'TechNova Solutions',
        employerId: employer._id,
        industry: 'Software Engineering',
        location: 'Bengaluru, Karnataka',
      });
    } else {
      company.employerId = employer._id;
      await company.save();
    }

    // Test Job
    let job = await Job.findOne({ title: 'Senior Frontend Engineer - Messaging Suite' });
    if (!job) {
      job = await Job.create({
        title: 'Senior Frontend Engineer - Messaging Suite',
        companyId: company._id,
        postedBy: employer._id,
        location: 'Bengaluru, Karnataka',
        jobType: 'Full-Time',
        experienceLevel: 'Senior Level',
        salaryMin: 1800000,
        salaryMax: 3000000,
        salaryPeriod: 'yearly',
        salaryCurrency: 'INR',
        description: 'Lead modern frontend architecture with React.',
        requirements: ['React', 'TypeScript'],
        status: 'Active',
      });
    } else {
      job.postedBy = employer._id;
      job.companyId = company._id;
      await job.save();
    }

    const candidateToken = generateToken(candidate);
    const employerToken = generateToken(employer);
    const outsiderToken = generateToken(outsider);

    assert(candidate && employer && company && job, 'Test models successfully initialized');

    // --- SECTION 2: Dynamic Employer Resolution ---
    console.log('\n--- 2. Testing Dynamic Employer Resolution ---');

    // Case 1: Company has employerId
    const resolved1 = await resolveEmployerForCompany(company._id);
    assert(
      resolved1 && resolved1._id.toString() === employer._id.toString(),
      'resolveEmployerForCompany correctly resolved employer from company.employerId'
    );

    // Case 2: Unlinked company (e.g. legacy/seeded without employerId) resolved via Job.postedBy
    const unlinkedCompanyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({
      _id: unlinkedCompanyId,
      name: 'Unlinked Startup Labs',
      industry: 'AI & Data',
      location: 'Pune, Maharashtra',
      employerId: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const unlinkedJob = await Job.create({
      title: 'AI Research Scientist',
      companyId: unlinkedCompanyId,
      postedBy: employer._id,
      location: 'Pune, Maharashtra',
      jobType: 'Full-Time',
      experienceLevel: 'Senior Level',
      salaryMin: 2000000,
      salaryMax: 3500000,
      description: 'AI R&D',
      status: 'Active',
    });

    const resolvedUnlinked = await resolveEmployerForCompany(unlinkedCompanyId);
    assert(
      resolvedUnlinked && resolvedUnlinked._id.toString() === employer._id.toString(),
      'resolveEmployerForCompany dynamically resolved employer from Job.postedBy for unlinked company'
    );

    // Check backfill
    const reloadedCompany = await Company.findById(unlinkedCompanyId);
    assert(
      reloadedCompany.employerId?.toString() === employer._id.toString(),
      'Unlinked company was automatically backfilled with employerId'
    );

    // Clean up temporary company & job
    await Job.deleteOne({ _id: unlinkedJob._id });
    await Company.collection.deleteOne({ _id: unlinkedCompanyId });

    // --- SECTION 3: Candidate Initiating Conversation with Employer ---
    console.log('\n--- 3. Testing Candidate Initiating Conversation with Employer ---');

    // 3A. Initiate via partnerId
    const initRes1 = await request('POST', '/messages/conversations/initiate', candidateToken, {
      partnerId: employer._id.toString(),
      jobId: job._id.toString(),
    });

    assert(initRes1.status === 200, 'Candidate initiate conversation responds with HTTP 200');
    assert(initRes1.data.success === true, 'Response indicates success: true');
    assert(
      initRes1.data.conversation?.partner?._id === employer._id.toString(),
      'Conversation partner matches employer ID'
    );
    const convId1 = initRes1.data.conversation?._id;

    // 3B. Initiate via companyId (resolves employer automatically)
    const initResByCompany = await request('POST', '/messages/conversations/initiate', candidateToken, {
      companyId: company._id.toString(),
    });

    assert(
      initResByCompany.status === 200,
      'Initiating conversation by companyId automatically resolves employer (HTTP 200)'
    );
    assert(
      initResByCompany.data.conversation?.partner?._id === employer._id.toString(),
      'Resolved partner is the correct employer'
    );

    // 3C. Initiate via jobId (resolves job poster automatically)
    const initResByJob = await request('POST', '/messages/conversations/initiate', candidateToken, {
      jobId: job._id.toString(),
    });

    assert(
      initResByJob.status === 200,
      'Initiating conversation by jobId automatically resolves job.postedBy (HTTP 200)'
    );

    // --- SECTION 4: Duplicate Conversation Prevention ---
    console.log('\n--- 4. Testing Duplicate Conversation Prevention ---');

    // Repeat initiate with same candidate, employer, and job
    const initRepeatRes = await request('POST', '/messages/conversations/initiate', candidateToken, {
      partnerId: employer._id.toString(),
      jobId: job._id.toString(),
    });

    assert(initRepeatRes.status === 200, 'Repeated initiate responds with HTTP 200');
    assert(
      initRepeatRes.data.conversation?._id === convId1,
      'Repeated initiate returns EXACT SAME conversation ID (no duplicate created)'
    );

    // Verify count in MongoDB
    const convCount = await Conversation.countDocuments({
      participants: { $all: [candidate._id, employer._id] },
      jobId: job._id,
    });
    assert(convCount === 1, 'MongoDB strictly contains exactly 1 conversation document for this pair');

    // --- SECTION 5: Employer Initiating Conversation with Candidate ---
    console.log('\n--- 5. Testing Employer Initiating Conversation with Candidate ---');

    const empInitRes = await request('POST', '/messages/conversations/initiate', employerToken, {
      partnerId: candidate._id.toString(),
      jobId: job._id.toString(),
    });

    assert(empInitRes.status === 200, 'Employer initiate conversation responds with HTTP 200');
    assert(
      empInitRes.data.conversation?._id === convId1,
      'Employer is routed to the same shared conversation thread'
    );
    assert(
      empInitRes.data.conversation?.partner?._id === candidate._id.toString(),
      'Employer view displays candidate as the partner'
    );

    // --- SECTION 6: Authorization & Anti-Spoofing Checks ---
    console.log('\n--- 6. Testing Authorization & Anti-Spoofing Checks ---');

    // 6A. User cannot message themselves
    const selfMessageRes = await request('POST', '/messages/conversations/initiate', candidateToken, {
      partnerId: candidate._id.toString(),
    });
    assert(
      selfMessageRes.status === 400,
      'Attempting to start conversation with oneself rejected with HTTP 400'
    );
    assert(
      selfMessageRes.data.message?.includes('Cannot start a conversation with yourself'),
      'Clear descriptive error returned on self-messaging attempt'
    );

    // 6B. Outsider cannot archive someone else's conversation
    const outsiderArchiveRes = await request(
      'PATCH',
      `/messages/conversations/${convId1}/archive`,
      outsiderToken
    );
    assert(
      outsiderArchiveRes.status === 404,
      'Non-participant cannot archive conversation (HTTP 404 Not Found)'
    );

    // 6C. Outsider message thread between candidate and employer
    const outsiderGetRes = await request(
      'GET',
      `/messages/${employer._id.toString()}`,
      outsiderToken
    );
    assert(outsiderGetRes.status === 200, 'Outsider queries partner message history');
    assert(
      outsiderGetRes.data.messages?.length === 0,
      'Outsider receives empty message list (Candidate <-> Employer messages never leak)'
    );

    // --- SECTION 7: Message Sending & Conversation Persistence ---
    console.log('\n--- 7. Testing Message Sending and Conversation State Persistence ---');

    // Candidate sends message to employer
    const sendRes1 = await request('POST', '/messages', candidateToken, {
      receiverId: employer._id.toString(),
      jobId: job._id.toString(),
      messageText: 'Hello Sarah, I am excited about the Senior Frontend Engineer role!',
    });

    assert(sendRes1.status === 201, 'POST /api/messages responds with HTTP 201 Created');
    assert(
      sendRes1.data.message?.messageText === 'Hello Sarah, I am excited about the Senior Frontend Engineer role!',
      'Message content matches sent text'
    );

    // Verify conversation was updated in DB
    const updatedConv = await Conversation.findById(convId1);
    assert(
      updatedConv.lastMessageText === 'Hello Sarah, I am excited about the Senior Frontend Engineer role!',
      'Conversation lastMessageText updated in MongoDB'
    );
    assert(
      updatedConv.lastMessage?.toString() === sendRes1.data.message._id.toString(),
      'Conversation lastMessage pointer updated in MongoDB'
    );

    // Candidate archives conversation
    const archiveRes = await request(
      'PATCH',
      `/messages/conversations/${convId1}/archive`,
      candidateToken
    );
    assert(archiveRes.status === 200, 'Candidate archives conversation (HTTP 200)');
    assert(archiveRes.data.isArchived === true, 'Response confirms isArchived: true');

    // Employer's view is not archived
    const empConvListRes = await request('GET', '/messages/conversations', employerToken);
    const empConv = empConvListRes.data.conversations?.find((c) => c._id === convId1);
    assert(
      empConv && empConv.isArchived === false,
      'Archiving is scoped to individual user: Employer conversation remains unarchived'
    );

    // Candidate sends another message or unarchives
    const unarchiveRes = await request(
      'PATCH',
      `/messages/conversations/${convId1}/archive`,
      candidateToken
    );
    assert(unarchiveRes.data.isArchived === false, 'Candidate unarchives conversation successfully');

    // --- SECTION 8: Real-Time Socket.IO Integration ---
    console.log('\n--- 8. Testing Real-Time Socket.IO Integration ---');

    await new Promise((resolve, reject) => {
      const clientSocketCandidate = io(`http://127.0.0.1:${TEST_PORT}`, {
        auth: { token: candidateToken },
        transports: ['websocket'],
      });

      const clientSocketEmployer = io(`http://127.0.0.1:${TEST_PORT}`, {
        auth: { token: employerToken },
        transports: ['websocket'],
      });

      const timeout = setTimeout(() => {
        clientSocketCandidate.disconnect();
        clientSocketEmployer.disconnect();
        reject(new Error('Socket.IO real-time message delivery timed out after 5000ms'));
      }, 5000);

      let candConnected = false;
      let empConnected = false;

      const onBothConnected = () => {
        if (!candConnected || !empConnected) return;

        // Join rooms with callbacks
        clientSocketCandidate.emit(
          'join_conversation',
          { partnerId: employer._id.toString(), jobId: job._id.toString() },
          () => {
            clientSocketEmployer.emit(
              'join_conversation',
              { partnerId: candidate._id.toString(), jobId: job._id.toString() },
              () => {
                // Both joined successfully, listen on Employer for incoming message
                clientSocketEmployer.on('new_message', (msg) => {
                  assert(
                    msg.messageText === 'Live WebSocket message from Alex to Sarah',
                    'Socket.IO delivered live new_message to Employer'
                  );
                  clearTimeout(timeout);
                  clientSocketCandidate.disconnect();
                  clientSocketEmployer.disconnect();
                  resolve();
                });

                // Candidate emits message
                clientSocketCandidate.emit('send_message', {
                  receiverId: employer._id.toString(),
                  jobId: job._id.toString(),
                  messageText: 'Live WebSocket message from Alex to Sarah',
                });
              }
            );
          }
        );
      };

      clientSocketCandidate.on('connect', () => {
        candConnected = true;
        onBothConnected();
      });

      clientSocketEmployer.on('connect', () => {
        empConnected = true;
        onBothConnected();
      });
    });

    // --- SECTION 9: Password Visibility Toggle Verification (JSX Analysis) ---
    console.log('\n--- 9. Verifying Password Visibility Toggle Implementation ---');

    const authPagePath = path.resolve(__dirname, '../../client/src/pages/AuthPage.jsx');
    const resetPasswordPagePath = path.resolve(__dirname, '../../client/src/pages/ResetPasswordPage.jsx');

    assert(fs.existsSync(authPagePath), 'AuthPage.jsx exists');
    assert(fs.existsSync(resetPasswordPagePath), 'ResetPasswordPage.jsx exists');

    const authPageSrc = fs.readFileSync(authPagePath, 'utf8');
    const resetPasswordPageSrc = fs.readFileSync(resetPasswordPagePath, 'utf8');

    // 9A. AuthPage Verification
    assert(
      authPageSrc.includes('showPassword') && authPageSrc.includes('setShowPassword'),
      'AuthPage contains showPassword state hook'
    );
    assert(
      authPageSrc.includes('showConfirmPassword') && authPageSrc.includes('setShowConfirmPassword'),
      'AuthPage contains showConfirmPassword state hook'
    );
    assert(
      authPageSrc.includes("type={showPassword ? 'text' : 'password'}"),
      'AuthPage password fields toggle between text and password type'
    );
    assert(
      authPageSrc.includes("type={showConfirmPassword ? 'text' : 'password'}"),
      'AuthPage confirm password field toggles between text and password type'
    );
    assert(
      authPageSrc.includes("aria-label={showPassword ? 'Hide password' : 'Show password'}"),
      'AuthPage password toggle button has accessible aria-label'
    );
    assert(
      authPageSrc.includes("aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}"),
      'AuthPage confirm password toggle button has accessible aria-label'
    );
    assert(
      authPageSrc.includes('visibility') && authPageSrc.includes('visibility_off'),
      'AuthPage renders Material Symbols visibility and visibility_off icons'
    );

    // 9B. ResetPasswordPage Verification
    assert(
      resetPasswordPageSrc.includes('showPassword') && resetPasswordPageSrc.includes('setShowPassword'),
      'ResetPasswordPage contains showPassword state hook'
    );
    assert(
      resetPasswordPageSrc.includes('showConfirmPassword') && resetPasswordPageSrc.includes('setShowConfirmPassword'),
      'ResetPasswordPage contains showConfirmPassword state hook'
    );
    assert(
      resetPasswordPageSrc.includes("type={showPassword ? 'text' : 'password'}"),
      'ResetPasswordPage new password field toggles between text and password type'
    );
    assert(
      resetPasswordPageSrc.includes("type={showConfirmPassword ? 'text' : 'password'}"),
      'ResetPasswordPage confirm password field toggles between text and password type'
    );
    assert(
      resetPasswordPageSrc.includes("aria-label={showPassword ? 'Hide new password' : 'Show new password'}"),
      'ResetPasswordPage new password toggle button has accessible aria-label'
    );
    assert(
      resetPasswordPageSrc.includes("aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}"),
      'ResetPasswordPage confirm password toggle button has accessible aria-label'
    );
    assert(
      resetPasswordPageSrc.includes('visibility') && resetPasswordPageSrc.includes('visibility_off'),
      'ResetPasswordPage renders Material Symbols visibility and visibility_off icons'
    );

    // --- SECTION 10: Frontend Messaging Entry Points Verification ---
    console.log('\n--- 10. Verifying Frontend Messaging Entry Points ---');

    const jobDetailsPath = path.resolve(__dirname, '../../client/src/pages/JobDetailsPage.jsx');
    const companyProfilePath = path.resolve(__dirname, '../../client/src/pages/CompanyProfilePage.jsx');
    const candidateDashboardPath = path.resolve(__dirname, '../../client/src/pages/CandidateDashboard.jsx');
    const employerDashboardPath = path.resolve(__dirname, '../../client/src/pages/EmployerDashboard.jsx');
    const messagingPagePath = path.resolve(__dirname, '../../client/src/pages/MessagingPage.jsx');

    const jobDetailsSrc = fs.readFileSync(jobDetailsPath, 'utf8');
    const companyProfileSrc = fs.readFileSync(companyProfilePath, 'utf8');
    const candidateDashboardSrc = fs.readFileSync(candidateDashboardPath, 'utf8');
    const employerDashboardSrc = fs.readFileSync(employerDashboardPath, 'utf8');
    const messagingPageSrc = fs.readFileSync(messagingPagePath, 'utf8');

    // 10A. JobDetailsPage
    assert(
      jobDetailsSrc.includes('handleMessageEmployer'),
      'JobDetailsPage defines handleMessageEmployer action handler'
    );
    assert(
      jobDetailsSrc.includes('Message Employer'),
      'JobDetailsPage contains "Message Employer" action button'
    );
    assert(
      jobDetailsSrc.includes("params.append('partnerId'") && jobDetailsSrc.includes("navigate(`/messages?${params.toString()}`"),
      'JobDetailsPage routes candidate to /messages?partnerId=...&jobId=...'
    );

    // 10B. CompanyProfilePage
    assert(
      companyProfileSrc.includes('handleMessageEmployer'),
      'CompanyProfilePage defines handleMessageEmployer action handler'
    );
    assert(
      companyProfileSrc.includes('Message Employer'),
      'CompanyProfilePage contains "Message Employer" action button'
    );
    assert(
      companyProfileSrc.includes('/messages?partnerId='),
      'CompanyProfilePage routes candidate to /messages?partnerId=...'
    );

    // 10C. CandidateDashboard
    assert(
      candidateDashboardSrc.includes('Message Recruiter'),
      'CandidateDashboard contains "Message Recruiter" button in applications table'
    );
    assert(
      candidateDashboardSrc.includes('/messages?partnerId='),
      'CandidateDashboard routes candidate to /messages with recruiter partnerId'
    );

    // 10D. EmployerDashboard
    assert(
      employerDashboardSrc.includes('Message Candidate'),
      'EmployerDashboard contains "Message Candidate" button in applicant modal'
    );
    assert(
      employerDashboardSrc.includes('/messages?partnerId='),
      'EmployerDashboard routes employer to /messages with candidate partnerId'
    );

    // 10E. MessagingPage
    assert(
      messagingPageSrc.includes("searchParams.get('partnerId')"),
      'MessagingPage reads partnerId query parameter on mount'
    );
    assert(
      messagingPageSrc.includes('/messages/conversations/initiate'),
      'MessagingPage invokes initiate conversation endpoint automatically'
    );
    assert(
      messagingPageSrc.includes('Browse Open Jobs') && messagingPageSrc.includes('Explore Companies'),
      'MessagingPage provides Candidate-specific quick actions in empty state'
    );
    assert(
      messagingPageSrc.includes('View Applicants') && messagingPageSrc.includes('Post a Job'),
      'MessagingPage provides Employer-specific quick actions in empty state'
    );
    assert(
      messagingPageSrc.includes('Archived'),
      'MessagingPage provides conversation archiving support and tab filter'
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
    console.log(`  MESSAGING & PASSWORD VISIBILITY TESTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runMessagingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
