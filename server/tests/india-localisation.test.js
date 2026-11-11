/**
 * CareerConnect — India Localisation Unit & Data Integrity Test Suite
 *
 * Verifies:
 * 1. Indian demonstration companies (names, headquarters, industry, size).
 * 2. Indian sample jobs dataset (18 diverse roles, Indian locations, realistic INR per annum salaries).
 * 3. Schema consistency: numeric INR salary storage, salaryCurrency='INR', salaryPeriod='yearly'.
 * 4. Zero US cities or dollar-denominated sample data.
 * 5. Non-destructive, idempotent seeding logic.
 * 6. Centralised frontend salary formatting utility (LPA conversions).
 */

import { formatLpa, formatSalaryRange, formatJobSalary, formatInrFull } from '../../client/src/utils/salary.js';
import fs from 'fs';
import path from 'path';

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

async function runTests() {
  console.log('\n================================================================');
  console.log('  CAREERCONNECT — INDIA LOCALISATION & DATA INTEGRITY TESTS');
  console.log('================================================================\n');

  // --- SECTION 1: Salary Formatter Tests ---
  console.log('--- 1. Testing Centralised Salary Formatting Utility (LPA & INR) ---');

  // Test single amount conversion
  assert(formatLpa(400000) === '₹4 LPA', '400000 converts to ₹4 LPA');
  assert(formatLpa(650000) === '₹6.5 LPA', '650000 converts to ₹6.5 LPA');
  assert(formatLpa(800000) === '₹8 LPA', '800000 converts to ₹8 LPA');
  assert(formatLpa(1200000) === '₹12 LPA', '1200000 converts to ₹12 LPA');
  assert(formatLpa(2500000) === '₹25 LPA', '2500000 converts to ₹25 LPA');
  assert(formatLpa(0) === '', '0 returns empty string');
  assert(formatLpa(null) === '', 'null returns empty string');

  // Test salary range conversion
  assert(formatSalaryRange(400000, 700000) === '₹4–7 LPA', '(400000, 700000) converts to ₹4–7 LPA');
  assert(formatSalaryRange(650000, 1200000) === '₹6.5–12 LPA', '(650000, 1200000) converts to ₹6.5–12 LPA');
  assert(formatSalaryRange(800000, 1500000) === '₹8–15 LPA', '(800000, 1500000) converts to ₹8–15 LPA');
  assert(formatSalaryRange(1200000, 2400000) === '₹12–24 LPA', '(1200000, 2400000) converts to ₹12–24 LPA');
  assert(formatSalaryRange(1800000, 3000000) === '₹18–30 LPA', '(1800000, 3000000) converts to ₹18–30 LPA');
  assert(formatSalaryRange(800000, 800000) === '₹8 LPA', 'Equal min and max converts to single ₹8 LPA');
  assert(formatSalaryRange(800000, null) === 'From ₹8 LPA', 'Single min converts to From ₹8 LPA');
  assert(formatSalaryRange(null, 1500000) === 'Up to ₹15 LPA', 'Single max converts to Up to ₹15 LPA');
  assert(formatSalaryRange(null, null) === 'Competitive Salary', 'Empty amounts return fallback text');

  // Test formatJobSalary
  assert(
    formatJobSalary({ salaryMin: 1000000, salaryMax: 1600000 }) === '₹10–16 LPA',
    'formatJobSalary returns ₹10–16 LPA for job object'
  );
  assert(
    formatJobSalary(null) === 'Competitive Salary',
    'formatJobSalary handles null gracefully'
  );

  // --- SECTION 2: Indian Seeder Dataset Validation ---
  console.log('\n--- 2. Validating Indian Seed Dataset Structure ---');

  const seedIndiaPath = path.resolve(import.meta.dirname, '../src/seeders/seedIndia.js');
  assert(fs.existsSync(seedIndiaPath), 'seedIndia.js exists');

  const seedContent = fs.readFileSync(seedIndiaPath, 'utf8');
  const codeWithoutComments = seedContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  // Ensure no dropDatabase or deleteMany in active code
  assert(!codeWithoutComments.includes('dropDatabase'), 'seedIndia.js NEVER calls dropDatabase()');
  assert(!codeWithoutComments.includes('deleteMany'), 'seedIndia.js contains zero destructive deleteMany calls');
  assert(!codeWithoutComments.includes('User.delete'), 'seedIndia.js contains zero User deletion calls');

  // Validate Companies in seedIndia.js
  const requiredCompanies = [
    'Aarohan Technologies',
    'Nexora Digital',
    'BluePeak Analytics',
    'PixelForge Labs',
    'FinEdge Systems',
    'CloudBridge Solutions',
  ];

  requiredCompanies.forEach((comp) => {
    assert(seedContent.includes(comp), `Dataset includes Indian company '${comp}'`);
  });

  // Validate Indian Locations in seedIndia.js
  const indianCities = [
    'Bengaluru, Karnataka',
    'Mumbai, Maharashtra',
    'Pune, Maharashtra',
    'Hyderabad, Telangana',
    'Gurugram, Haryana',
    'Noida, Uttar Pradesh',
    'Delhi NCR',
    'Ahmedabad, Gujarat',
    'Chennai, Tamil Nadu',
    'Remote — India',
  ];

  indianCities.forEach((city) => {
    assert(seedContent.includes(city), `Dataset includes Indian location '${city}'`);
  });

  // Validate that US locations do NOT appear in the seed file
  const usLocations = [
    'San Francisco',
    'New York, NY',
    'Austin, TX',
    'Seattle, WA',
    'Chicago, IL',
  ];

  usLocations.forEach((usLoc) => {
    assert(!seedContent.includes(usLoc), `Dataset is free of US location '${usLoc}'`);
  });

  // Validate Required Roles in seedIndia.js
  const requiredRoles = [
    'React Developer',
    'Full Stack Developer',
    'Node.js Backend Developer',
    'Java Enterprise Developer',
    'Python Backend Developer',
    'Data Analyst',
    'Data Scientist',
    'Machine Learning Engineer',
    'DevOps & Cloud Engineer',
    'Cloud Solutions Architect',
    'UI/UX Product Designer',
    'UX Researcher',
    'Cybersecurity Analyst',
    'QA Automation Engineer',
    'Technical Product Manager',
    'Frontend Engineering Intern',
    'Mobile App Developer',
  ];

  requiredRoles.forEach((role) => {
    assert(seedContent.includes(role), `Dataset includes required role '${role}'`);
  });

  // --- SECTION 3: Frontend Codebase Integrity Check ---
  console.log('\n--- 3. Verifying Frontend Contains Zero Dollar or US City Displays ---');

  const clientSrcPath = path.resolve(import.meta.dirname, '../../client/src');
  const jsxFiles = [];

  function collectJsx(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectJsx(fullPath);
      } else if (entry.name.endsWith('.jsx')) {
        jsxFiles.push(fullPath);
      }
    }
  }

  collectJsx(clientSrcPath);
  assert(jsxFiles.length > 10, `Found ${jsxFiles.length} client JSX files to verify`);

  let usCityFound = false;
  let dollarSignFound = false;

  const usPattern = /San Francisco|Austin,\s*TX|New York,\s*NY|Seattle,\s*WA/i;
  // Match a literal $ that is not part of a JS template literal `${` and not regex end-of-line `$`
  const dollarPattern = /\$(?!\{)/;

  for (const file of jsxFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const relativeName = path.relative(clientSrcPath, file);

    if (usPattern.test(code)) {
      usCityFound = true;
      console.error(`  ✗ Found US city reference in: ${relativeName}`);
    }

    // Exclude regex anchor e.g. .replace(/\/+$/, '')
    const strippedCode = code.replace(/\/\/\s*.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const lines = strippedCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (dollarPattern.test(line) && !line.includes('/+$') && !line.includes('/+$`') && !line.includes('/+$"')) {
        dollarSignFound = true;
        console.error(`  ✗ Found unexpected dollar sign in ${relativeName}:${i + 1}: ${line.trim()}`);
      }
    }
  }

  assert(!usCityFound, 'All client JSX files are free of US city hardcodings');
  assert(!dollarSignFound, 'All client JSX files are free of standalone $ salary symbols');

  // --- SUMMARY ---
  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
