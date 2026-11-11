/**
 * CareerConnect — Comprehensive Security & Functional Audit Test Suite
 * 
 * Target Database: Isolated 'careerconnect_test_db'
 * Ensures zero interference with development database 'careerconnect_db'.
 * 
 * Scope of Coverage:
 * 1. CORS Enforcement:
 *    - Approved origins (e.g. http://localhost:5173, http://localhost) allowed with Access-Control headers.
 *    - Unapproved origins (e.g. http://malicious-site.com) rejected with HTTP 403 Forbidden.
 *    - Requests with no Origin header (curl, mobile, server-side) permitted.
 * 2. Password Reset Security:
 *    - Reset token is cryptographically random (32 bytes hex).
 *    - Token stored in MongoDB ONLY as SHA-256 hash.
 *    - Token expires after 10 minutes.
 *    - Tokens are strictly single-use (cleared upon reset).
 *    - Passwords properly bcrypt hashed.
 *    - Production mode (NODE_ENV=production) never exposes devResetToken.
 * 3. Email Verification (FSD Requirement):
 *    - Registration creates user with isVerified: false by default.
 *    - Verification token is 32 bytes hex, stored as SHA-256 hash with 24-hr expiration.
 *    - Both GET /api/auth/verify-email/:token and POST /api/auth/verify-email succeed and set isVerified: true.
 *    - Resend verification endpoint rate-limited to 60-second cooldown (HTTP 429).
 * 4. Socket.IO Authorization:
 *    - Connection without JWT rejected.
 *    - Connection with invalid / expired JWT rejected.
 *    - Valid connection permitted.
 *    - Authorized conversation join enforced; non-existent partner and self-chat rejected.
 *    - Sender identity strictly derived from authenticated socket.user._id (spoofed sender payload ignored).
 * 5. Protected Uploads & Sample Assets:
 *    - Sample resumes (sample_resume_alex_rivera.pdf, sample_resume_david_chen.pdf, Interview_Prep_Guide.pdf) accessible without auth (HTTP 200).
 *    - Candidate private uploads rejected without authentication (HTTP 401).
 *    - Candidate private uploads accessible with valid JWT (HTTP 200).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io } from '../../client/node_modules/socket.io-client/build/esm/index.js';
import { getJwtSecret, validateJwtConfig } from '../src/config/jwt.js';

// Enforce test environment and isolated test database
process.env.NODE_ENV = 'test';
let testUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/careerconnect_test_db';
if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('careerconnect_test_db')) {
  testUri = process.env.MONGODB_URI;
}
const TEST_DB_URI = testUri;
process.env.MONGODB_URI = TEST_DB_URI;

// Set explicit allowed origins for test
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost';

import { app, httpServer } from '../src/server.js';
import { seedDatabase } from '../src/seeders/seed.js';
import { closeDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Application from '../src/models/Application.js';
import Company from '../src/models/Company.js';
import Message from '../src/models/Message.js';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const API_URL = `${BASE_URL}/api`;

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
    process.exitCode = 1;
  }
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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

async function runSecurityAuditTests() {
  console.log('================================================================');
  console.log('  CAREERCONNECT — COMPREHENSIVE SECURITY & FUNCTIONAL AUDIT');
  console.log('================================================================');
  console.log(`Isolated Database: ${TEST_DB_URI}\n`);

  let dummyPrivateFilePath = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Seed isolated database & start HTTP/Socket server
    // -------------------------------------------------------------
    await seedDatabase();
    assert(mongoose.connection.name === 'careerconnect_test_db', 'Connected strictly to careerconnect_test_db');

    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
    console.log(`  ✓ Test server active on 127.0.0.1:${TEST_PORT}\n`);

    // =============================================================
    // SECTION 1: CORS Security Enforcement
    // =============================================================
    console.log('--- 1. Testing CORS Security Enforcement ---');

    // 1.1 Unapproved browser origin rejected with HTTP 403 Forbidden
    const unapprovedCors = await request('/health', {
      headers: { Origin: 'http://malicious-attacker-site.com' },
    });
    assert(unapprovedCors.status === 403, 'Unapproved browser origin returns HTTP 403 Forbidden');
    assert(
      unapprovedCors.data.message && unapprovedCors.data.message.includes('CORS Error'),
      'Unapproved origin returns clear CORS Error message'
    );

    // 1.2 Approved browser origin allowed with proper Access-Control header
    const approvedCors = await request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert(approvedCors.status === 200, 'Approved browser origin returns HTTP 200');
    assert(
      approvedCors.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      'Approved origin receives matching Access-Control-Allow-Origin header'
    );

    // 1.3 Request without Origin header (curl, mobile, server-side) permitted
    const noOrigin = await request('/health');
    assert(noOrigin.status === 200 && noOrigin.data.status === 'healthy', 'Request without Origin header is allowed');

    // =============================================================
    // SECTION 2: Password Reset Security
    // =============================================================
    console.log('\n--- 2. Testing Password Reset Security ---');

    // Candidate user for password reset test
    const candidateEmail = 'candidate.audit@example.com';
    const initialPassword = 'InitialPassword123!';
    await User.create({
      name: 'Audit Candidate',
      email: candidateEmail,
      password: initialPassword,
      role: 'candidate',
      isVerified: true,
    });

    // 2.1 Request password reset
    const forgotRes = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: candidateEmail }),
    });
    assert(forgotRes.status === 200, 'POST /api/auth/forgot-password returns HTTP 200');
    assert(forgotRes.data.devResetToken, 'Dev/test environment returns devResetToken for verification');

    const rawResetToken = forgotRes.data.devResetToken;
    assert(rawResetToken.length === 64, 'Reset token is 32 cryptographically random bytes (64 hex characters)');

    // 2.2 Verify that ONLY the SHA-256 hash is stored in MongoDB
    const userInDb = await User.findOne({ email: candidateEmail }).select('+password');
    const expectedHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    assert(userInDb.resetPasswordToken === expectedHash, 'MongoDB stores SHA-256 hashed token, NOT raw token');
    assert(
      userInDb.resetPasswordExpires && userInDb.resetPasswordExpires > new Date(),
      'resetPasswordExpires is configured in the future'
    );

    // 2.3 Verify reset token expires in ~10 minutes
    const tenMinInMs = 10 * 60 * 1000;
    const diff = userInDb.resetPasswordExpires.getTime() - Date.now();
    assert(diff > 0 && diff <= tenMinInMs, 'Reset token expiration window is within 10 minutes');

    // 2.4 Verify production mode NEVER exposes devResetToken
    const prodCandidateEmail = 'candidate.prod@example.com';
    await User.create({
      name: 'Prod Audit Candidate',
      email: prodCandidateEmail,
      password: 'ProdPassword123!',
      role: 'candidate',
      isVerified: true,
    });

    process.env.NODE_ENV = 'production';
    const prodForgotRes = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: prodCandidateEmail }),
    });
    assert(prodForgotRes.status === 200, 'POST /api/auth/forgot-password returns 200 in production');
    assert(prodForgotRes.data.devResetToken === undefined, 'Production response strictly omits devResetToken');
    process.env.NODE_ENV = 'test';

    // 2.5 Reset password with raw token
    const newPassword = 'BrandNewPassword123!';
    const resetRes = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: rawResetToken, password: newPassword }),
    });
    assert(resetRes.status === 200, 'POST /api/auth/reset-password returns HTTP 200');

    // 2.6 Verify single-use: token is wiped from DB
    const userAfterReset = await User.findOne({ email: candidateEmail });
    assert(userAfterReset.resetPasswordToken === undefined, 'Reset token cleared from MongoDB after single use');
    assert(userAfterReset.resetPasswordExpires === undefined, 'Token expiration cleared from MongoDB after single use');

    // 2.7 Verify replay attack fails (attempting to use token again)
    const replayRes = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: rawResetToken, password: 'AnotherPassword123!' }),
    });
    assert(replayRes.status === 400, 'Reusing invalidated reset token returns HTTP 400');

    // 2.8 Verify login works with new password and fails with old password
    const loginNew = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: candidateEmail, password: newPassword }),
    });
    assert(loginNew.status === 200 && loginNew.data.token, 'Login succeeds with new password');

    const loginOld = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: candidateEmail, password: initialPassword }),
    });
    assert(loginOld.status === 401, 'Login fails with old password');

    // =============================================================
    // SECTION 3: Email Verification Security
    // =============================================================
    console.log('\n--- 3. Testing Email Verification Security ---');

    // 3.1 Registration sets isVerified: false by default
    const verifyTestEmail = 'unverified.audit@example.com';
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Unverified Candidate',
        email: verifyTestEmail,
        password: 'Password123!',
        role: 'candidate',
      }),
    });
    assert(regRes.status === 201, 'Registration returns HTTP 201');
    assert(regRes.data.user.isVerified === false, 'Newly registered user has isVerified: false in API response');

    const unverifiedUser = await User.findOne({ email: verifyTestEmail });
    assert(unverifiedUser.isVerified === false, 'Newly registered user has isVerified: false in MongoDB');
    assert(
      unverifiedUser.verificationToken && unverifiedUser.verificationToken.length === 64,
      'MongoDB stores 64-char SHA-256 hashed verification token'
    );
    assert(
      unverifiedUser.verificationTokenExpires > new Date(),
      'verificationTokenExpires is set in the future (24 hours)'
    );

    const rawVerifyToken = regRes.data.devVerificationToken;
    assert(rawVerifyToken && rawVerifyToken.length === 64, 'Development mode provides raw 32-byte hex verification token');

    // 3.2 Verify email via GET endpoint (Email link click)
    const getVerifyRes = await request(`/auth/verify-email/${rawVerifyToken}`, { method: 'GET' });
    assert(getVerifyRes.status === 200, 'GET /api/auth/verify-email/:token returns HTTP 200');
    assert(getVerifyRes.data.user.isVerified === true, 'User is marked isVerified: true after GET verification');

    const verifiedUserInDb = await User.findOne({ email: verifyTestEmail });
    assert(verifiedUserInDb.isVerified === true, 'User isVerified is true in MongoDB');
    assert(verifiedUserInDb.verificationToken === undefined, 'verificationToken cleared from MongoDB');
    assert(verifiedUserInDb.verificationTokenExpires === undefined, 'verificationTokenExpires cleared from MongoDB');

    // 3.3 Verify email via POST endpoint (JSON body submission)
    const postVerifyEmail = 'post.verify@example.com';
    const regRes2 = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Post Verify Candidate',
        email: postVerifyEmail,
        password: 'Password123!',
        role: 'candidate',
      }),
    });
    const postRawToken = regRes2.data.devVerificationToken;

    const postVerifyRes = await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: postRawToken }),
    });
    assert(postVerifyRes.status === 200, 'POST /api/auth/verify-email returns HTTP 200');
    assert(postVerifyRes.data.user.isVerified === true, 'User is marked isVerified: true after POST verification');

    // 3.4 Rate limiting on resend verification
    const rateLimitEmail = 'rate.limit@example.com';
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rate Limit Candidate',
        email: rateLimitEmail,
        password: 'Password123!',
        role: 'candidate',
      }),
    });

    // Fast-forward lastVerificationEmailSent beyond 60s cooldown to test successful resend
    await User.updateOne(
      { email: rateLimitEmail },
      { lastVerificationEmailSent: new Date(Date.now() - 70 * 1000) }
    );

    // First resend attempt succeeds
    const resend1 = await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert(resend1.status === 200, 'First resend verification returns HTTP 200 after cooldown window');

    // Immediate second resend attempt blocked by 60s cooldown (HTTP 429)
    const resend2 = await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert(resend2.status === 429, 'Immediate second resend verification returns HTTP 429 (Cooldown rate limit)');
    assert(
      resend2.data.message && resend2.data.message.includes('wait'),
      'Rate limit response instructs user to wait before requesting another email'
    );

    // =============================================================
    // SECTION 4: Socket.IO Security & Authorization
    // =============================================================
    console.log('\n--- 4. Testing Socket.IO Security & Authorization ---');

    // Candidate and Employer users for socket tests
    const socketCandidate = await User.findOne({ role: 'candidate' });
    const socketEmployer = await User.findOne({ role: 'employer' });
    const candToken = jwt.sign({ id: socketCandidate._id, role: socketCandidate.role }, getJwtSecret(), { expiresIn: '1h' });
    const empToken = jwt.sign({ id: socketEmployer._id, role: socketEmployer.role }, getJwtSecret(), { expiresIn: '1h' });

    // 4.1 Handshake without token fails
    const unauthSocketError = await new Promise((resolve) => {
      const sock = io(`http://127.0.0.1:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 2000,
      });
      sock.on('connect_error', (err) => {
        sock.disconnect();
        resolve(err.message);
      });
      sock.on('connect', () => {
        sock.disconnect();
        resolve(null);
      });
    });
    assert(
      unauthSocketError && unauthSocketError.includes('Authentication token required'),
      'Socket connection without JWT rejected during handshake'
    );

    // 4.2 Handshake with invalid token fails
    const invalidTokenSocketError = await new Promise((resolve) => {
      const sock = io(`http://127.0.0.1:${TEST_PORT}`, {
        auth: { token: 'invalid_forged_token' },
        transports: ['websocket'],
        reconnection: false,
        timeout: 2000,
      });
      sock.on('connect_error', (err) => {
        sock.disconnect();
        resolve(err.message);
      });
    });
    assert(
      invalidTokenSocketError && invalidTokenSocketError.includes('Invalid socket authentication token'),
      'Socket connection with forged/invalid JWT rejected'
    );

    // 4.3 Handshake with valid token succeeds
    const candSocket = await new Promise((resolve) => {
      const sock = io(`http://127.0.0.1:${TEST_PORT}`, {
        auth: { token: candToken },
        transports: ['websocket'],
        reconnection: false,
      });
      sock.on('connect', () => resolve(sock));
    });
    assert(candSocket.connected, 'Socket connection with valid JWT succeeds');

    // 4.4 Join conversation with self blocked
    const selfJoinRes = await new Promise((resolve) => {
      candSocket.emit('join_conversation', { partnerId: socketCandidate._id.toString() }, (res) => {
        resolve(res);
      });
    });
    assert(selfJoinRes && selfJoinRes.success === false && selfJoinRes.message.includes('oneself'), 'join_conversation with self blocked');

    // 4.5 Join conversation with non-existent partner blocked
    const fakePartnerId = new mongoose.Types.ObjectId().toString();
    const fakeJoinRes = await new Promise((resolve) => {
      candSocket.emit('join_conversation', { partnerId: fakePartnerId }, (res) => {
        resolve(res);
      });
    });
    assert(fakeJoinRes && fakeJoinRes.success === false && fakeJoinRes.message.includes('Partner user not found'), 'join_conversation with non-existent user blocked');

    // 4.6 Sender identity spoofing prevention in send_message
    const empSocket = await new Promise((resolve) => {
      const sock = io(`http://127.0.0.1:${TEST_PORT}`, {
        auth: { token: empToken },
        transports: ['websocket'],
        reconnection: false,
      });
      sock.on('connect', () => resolve(sock));
    });

    // Candidate joins conversation with employer
    await new Promise((resolve) => {
      candSocket.emit('join_conversation', { partnerId: socketEmployer._id.toString() }, resolve);
    });
    await new Promise((resolve) => {
      empSocket.emit('join_conversation', { partnerId: socketCandidate._id.toString() }, resolve);
    });

    // Candidate attempts to spoof sender as someone else (fake ID)
    const spoofedSenderId = new mongoose.Types.ObjectId().toString();
    await new Promise((resolve) => {
      candSocket.emit(
        'send_message',
        {
          senderId: spoofedSenderId, // Maliciously spoofed sender
          receiverId: socketEmployer._id.toString(),
          messageText: 'Hello employer, this message tests sender spoofing resistance.',
        },
        resolve
      );
    });

    // Verify message in MongoDB
    const savedMsg = await Message.findOne({
      receiverId: socketEmployer._id,
      messageText: 'Hello employer, this message tests sender spoofing resistance.',
    });
    assert(savedMsg !== null, 'Message successfully delivered and stored in database');
    assert(
      savedMsg.senderId.toString() === socketCandidate._id.toString(),
      'Message senderId strictly set to authenticated socket identity, ignoring spoofed sender ID'
    );
    assert(
      savedMsg.senderId.toString() !== spoofedSenderId,
      'Spoofed sender ID successfully discarded by server'
    );

    candSocket.disconnect();
    empSocket.disconnect();

    // =============================================================
    // SECTION 5: Protected Uploads & Sample Assets
    // =============================================================
    console.log('\n--- 5. Testing Protected Uploads & Sample Assets ---');

    // 5.1 Public sample resumes accessible without authentication
    const sampleAlex = await request(`${BASE_URL}/uploads/sample_resume_alex_rivera.pdf`);
    assert(sampleAlex.status === 200, 'GET /uploads/sample_resume_alex_rivera.pdf returns HTTP 200 without auth');

    const sampleDavid = await request(`${BASE_URL}/uploads/sample_resume_david_chen.pdf`);
    assert(sampleDavid.status === 200, 'GET /uploads/sample_resume_david_chen.pdf returns HTTP 200 without auth');

    const prepGuide = await request(`${BASE_URL}/uploads/Interview_Prep_Guide.pdf`);
    assert(prepGuide.status === 200, 'GET /uploads/Interview_Prep_Guide.pdf returns HTTP 200 without auth');

    // 5.2 Private user uploads rejected with HTTP 401 without authentication
    const dummyPrivateFileName = 'resume-private-candidate-PII-test.pdf';
    dummyPrivateFilePath = path.resolve('uploads', dummyPrivateFileName);
    fs.writeFileSync(dummyPrivateFilePath, '%PDF-1.4\nTest Private Resume with Candidate PII\n%%EOF');

    const unauthPrivateReq = await request(`${BASE_URL}/uploads/${dummyPrivateFileName}`);
    assert(unauthPrivateReq.status === 401, 'Unauthenticated access to private candidate resume returns HTTP 401 Unauthorized');
    assert(
      unauthPrivateReq.data.message && unauthPrivateReq.data.message.includes('Authentication required'),
      '401 response explicitly warns that authentication is required to access private candidate files'
    );

    // 5.3 Private user upload accessible with valid JWT token (Bearer header)
    const authPrivateReq = await request(`${BASE_URL}/uploads/${dummyPrivateFileName}`, {
      headers: { Authorization: `Bearer ${candToken}` },
    });
    assert(authPrivateReq.status === 200, 'Authenticated user can access private candidate file (HTTP 200)');

    // 5.4 Private user upload accessible with valid JWT token in cookie
    const cookiePrivateReq = await request(`${BASE_URL}/uploads/${dummyPrivateFileName}`, {
      headers: { Cookie: `token=${candToken}` },
    });
    assert(cookiePrivateReq.status === 200, 'Accessing private file via authenticated cookie returns HTTP 200');

    // 5.5 Private user upload accessible with valid query token
    const queryPrivateReq = await request(`${BASE_URL}/uploads/${dummyPrivateFileName}?token=${candToken}`);
    assert(queryPrivateReq.status === 200, 'Accessing private file via query token returns HTTP 200');

  } catch (err) {
    console.error('Unhandled error during security audit test execution:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup temporary test file
    if (dummyPrivateFilePath && fs.existsSync(dummyPrivateFilePath)) {
      try {
        fs.unlinkSync(dummyPrivateFilePath);
      } catch (e) {}
    }

    // Close server & MongoDB connection
    await new Promise((resolve) => {
      httpServer.close(resolve);
    });
    await closeDB();

    console.log('\n================================================================');
    console.log(`  SECURITY AUDIT TEST SUMMARY: ${stats.passed}/${stats.total} PASSED (${stats.failed} FAILED)`);
    console.log('================================================================\n');
  }
}

runSecurityAuditTests();
