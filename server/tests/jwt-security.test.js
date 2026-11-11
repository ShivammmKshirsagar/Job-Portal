/**
 * CareerConnect — Dedicated JWT Security & Validation Test Suite
 * 
 * Verifies:
 * 1. Missing JWT_SECRET rejects and fails fast
 * 2. Short JWT_SECRET (< 32 chars) rejects with descriptive error
 * 3. Valid JWT_SECRET (>= 32 chars) passes validation
 * 4. Token signing and verification uses the exact same configured secret
 * 5. Expired and tampered tokens are properly rejected
 * 6. Server process refuses to boot when JWT_SECRET is unset
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret, validateJwtConfig, getJwtExpire, MIN_JWT_SECRET_LENGTH } from '../src/config/jwt.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runJwtSecurityTests() {
  console.log('================================================================');
  console.log('  CAREERCONNECT — JWT SECURITY & FAIL-FAST VALIDATION SUITE');
  console.log('================================================================\n');

  const originalSecret = process.env.JWT_SECRET;

  try {
    // 1. Test: Missing JWT_SECRET
    console.log('--- 1. Testing Fail-Fast on Missing JWT_SECRET ---');
    delete process.env.JWT_SECRET;
    let missingError = null;
    try {
      validateJwtConfig();
    } catch (err) {
      missingError = err;
    }
    assert(
      missingError !== null && missingError.message.includes('missing or empty'),
      'validateJwtConfig() throws Error when JWT_SECRET is missing'
    );

    // 2. Test: Empty / whitespace JWT_SECRET
    console.log('\n--- 2. Testing Fail-Fast on Empty JWT_SECRET ---');
    process.env.JWT_SECRET = '   ';
    let emptyError = null;
    try {
      validateJwtConfig();
    } catch (err) {
      emptyError = err;
    }
    assert(
      emptyError !== null && emptyError.message.includes('missing or empty'),
      'validateJwtConfig() throws Error when JWT_SECRET is empty string'
    );

    // 3. Test: Short JWT_SECRET (< 32 chars)
    console.log('\n--- 3. Testing Fail-Fast on Short JWT_SECRET ---');
    process.env.JWT_SECRET = 'too_short_secret_only_24';
    let shortError = null;
    try {
      validateJwtConfig();
    } catch (err) {
      shortError = err;
    }
    assert(
      shortError !== null && shortError.message.includes('too short'),
      `validateJwtConfig() throws Error when JWT_SECRET is under ${MIN_JWT_SECRET_LENGTH} characters`
    );

    // 4. Test: Valid JWT_SECRET (>= 32 chars)
    console.log('\n--- 4. Testing Validation with Compliant Secret ---');
    const validTestSecret = 'a_secure_test_key_that_exceeds_thirty_two_chars_long!';
    process.env.JWT_SECRET = validTestSecret;
    let validResult = false;
    try {
      validResult = validateJwtConfig();
    } catch (err) {
      validResult = false;
    }
    assert(validResult === true, 'validateJwtConfig() succeeds with secret >= 32 characters');
    assert(getJwtSecret() === validTestSecret, 'getJwtSecret() returns configured secret string');

    // 5. Test: Token Sign & Verify Consistency
    console.log('\n--- 5. Testing Cryptographic Signing & Verification ---');
    const payload = { id: 'user_12345', role: 'candidate' };
    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
    const decoded = jwt.verify(token, getJwtSecret());
    assert(decoded.id === 'user_12345' && decoded.role === 'candidate', 'Token successfully signs and verifies with centralized secret');

    // 6. Test: Tampered / Wrong Secret Rejection
    console.log('\n--- 6. Testing Rejection of Invalid / Foreign Tokens ---');
    const foreignSecret = 'another_totally_different_secret_key_32_chars!';
    const foreignToken = jwt.sign(payload, foreignSecret, { expiresIn: '1h' });
    let foreignError = null;
    try {
      jwt.verify(foreignToken, getJwtSecret());
    } catch (err) {
      foreignError = err;
    }
    assert(
      foreignError !== null && foreignError.name === 'JsonWebTokenError',
      'Token signed with different secret is rejected (JsonWebTokenError: invalid signature)'
    );

    // 7. Test: Expired Token Rejection
    console.log('\n--- 7. Testing Expired Token Rejection ---');
    const expiredToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '-1s' });
    let expiredError = null;
    try {
      jwt.verify(expiredToken, getJwtSecret());
    } catch (err) {
      expiredError = err;
    }
    assert(
      expiredError !== null && expiredError.name === 'TokenExpiredError',
      'Expired token is rejected (TokenExpiredError: jwt expired)'
    );

    // 8. Test: Process Startup Abort when JWT_SECRET is unset or empty
    console.log('\n--- 8. Testing Node Process Refuses to Start Without JWT_SECRET ---');
    const serverDir = fileURLToPath(new URL('..', import.meta.url));
    const envWithoutJwt = { ...process.env, JWT_SECRET: '' };
    
    // Spawn server.js directly with empty JWT_SECRET
    const child = spawnSync(process.execPath, ['src/server.js'], {
      cwd: serverDir,
      env: envWithoutJwt,
      encoding: 'utf-8',
    });

    assert(
      child.status !== 0,
      `Backend process exits with non-zero code (${child.status}) when JWT_SECRET is empty`
    );
    const output = (child.stderr || '') + (child.stdout || '');
    assert(
      output.includes('Security Configuration Error'),
      'Backend logs clear Security Configuration Error on startup abort'
    );
    assert(
      child.stderr.includes('Security Configuration Error') || child.stdout.includes('Security Configuration Error'),
      'Backend logs clear Security Configuration Error on startup abort'
    );

    console.log('\n================================================================');
    console.log(`  JWT SECURITY TEST RESULTS: ${passed}/${total} PASSED`);
    console.log('================================================================\n');

  } finally {
    process.env.JWT_SECRET = originalSecret;
  }
}

runJwtSecurityTests();
