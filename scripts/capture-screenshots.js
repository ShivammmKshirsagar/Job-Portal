/**
 * CareerConnect — Automated High-Resolution Screenshot Capture Tool
 * Uses Chrome DevTools Protocol (CDP) natively over Node.js 22 WebSocket.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BROWSER_BIN = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

const DEBUG_PORT = 9223;
const TEMP_PROFILE = path.join(process.env.TEMP || 'C:\\temp', `careerconnect_cdp_${Date.now()}`);
const OUTPUT_DIR = path.resolve('screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to interact with Chrome DevTools Protocol via WebSocket
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.id && this.pending.has(res.id)) {
            const { resolve: resFn, reject: rejFn } = this.pending.get(res.id);
            this.pending.delete(res.id);
            if (res.error) rejFn(res.error);
            else resFn(res.result);
          }
        } catch (e) {
          console.error('CDP parse error:', e);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Launching headless browser:', BROWSER_BIN);

  // Spawn headless browser with remote debugging
  const browserProc = spawn(BROWSER_BIN, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ]);

  browserProc.on('error', (err) => {
    console.error('Failed to spawn browser:', err);
  });

  // Wait for CDP endpoint to become ready
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    throw new Error('Could not connect to Chrome DevTools Protocol endpoint.');
  }

  console.log('Connected to CDP endpoint:', versionData.webSocketDebuggerUrl);

  // Get existing tab or create new target tab
  const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const tabs = await listRes.json();
  const targetTab = tabs.find(t => t.type === 'page') || (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new`, { method: 'PUT' })).json());
  const cdp = new CDPClient(targetTab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Helper to navigate and screenshot
  async function takeScreenshot(url, filename, authUser = null, waitTime = 1200) {
    console.log(`\nCapturing: ${filename} -> ${url}`);
    
    // If auth required, inject into localStorage
    if (authUser) {
      await cdp.send('Page.navigate', { url: 'http://localhost:80/' });
      await sleep(500);
      const evalScript = `
        localStorage.setItem('careerconnect_token', '${authUser.token}');
        localStorage.setItem('careerconnect_user', JSON.stringify(${JSON.stringify(authUser.user)}));
      `;
      await cdp.send('Runtime.evaluate', { expression: evalScript });
    } else {
      // Clear auth for public views
      await cdp.send('Runtime.evaluate', {
        expression: `
          localStorage.removeItem('careerconnect_token');
          localStorage.removeItem('careerconnect_user');
        `,
      });
    }

    await cdp.send('Page.navigate', { url });
    await sleep(waitTime);

    const screenshotRes = await cdp.send('Page.captureScreenshot', {
      format: 'png',
    });

    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(screenshotRes.data, 'base64'));
    console.log(`✓ Saved: ${filePath} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  }

  try {
    // Obtain test auth tokens via API
    console.log('Obtaining authentication tokens from backend...');
    const candRes = await fetch('http://localhost:80/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@careerconnect.com', password: 'CandidatePassword123!' }),
    }).then(r => r.json());

    const empRes = await fetch('http://localhost:80/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recruiter@technova.com', password: 'EmployerPassword123!' }),
    }).then(r => r.json());

    const admRes = await fetch('http://localhost:80/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@careerconnect.com', password: 'AdminPassword123!' }),
    }).then(r => r.json());

    // Fetch jobs and companies for dynamic IDs
    const jobsData = await fetch('http://localhost:80/api/jobs').then(r => r.json());
    const targetJobId = jobsData.jobs?.[0]?._id;

    const compData = await fetch('http://localhost:80/api/companies').then(r => r.json());
    const targetCompId = compData.companies?.[0]?._id;

    // 1. Home Page (Figure 8.1)
    await takeScreenshot('http://localhost:80/', '01-home-page.png', null, 1500);

    // 2. Job Listings (Figure 8.2)
    await takeScreenshot('http://localhost:80/jobs', '02-job-listings.png', null, 1500);

    // 3. Job Details (Figure 8.3)
    if (targetJobId) {
      await takeScreenshot(`http://localhost:80/jobs/${targetJobId}`, '03-job-details.png', candRes, 1500);
    }

    // 4. Candidate Dashboard (Figure 8.4)
    await takeScreenshot('http://localhost:80/candidate/dashboard', '04-candidate-dashboard.png', candRes, 1500);

    // 5. Employer Dashboard (Figure 8.5)
    await takeScreenshot('http://localhost:80/employer/dashboard', '05-employer-dashboard.png', empRes, 1500);

    // 6. Auth Login (Figure 8.6)
    await takeScreenshot('http://localhost:80/auth', '06-auth-login.png', null, 1200);

    // 7. Admin Dashboard (Figure 8.7)
    await takeScreenshot('http://localhost:80/admin/dashboard', '07-admin-dashboard.png', admRes, 1500);

    // 8. Company Profile (Figure 8.8)
    if (targetCompId) {
      await takeScreenshot(`http://localhost:80/companies/${targetCompId}`, '08-company-profile.png', null, 1500);
    }

    // 9. Messaging Center (Figure 8.9)
    await takeScreenshot('http://localhost:80/messages', '09-messaging-center.png', candRes, 1800);

    console.log('\n=================================================');
    console.log('✓ All 9 FSD wireframe view screenshots captured!');
    console.log('=================================================');

  } catch (err) {
    console.error('Screenshot capture failed:', err);
  } finally {
    cdp.close();
    browserProc.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
}

capture();
