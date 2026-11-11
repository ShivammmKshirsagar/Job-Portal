import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9224;
const TEMP_PROFILE = path.join(process.env.TEMP || 'C:\\temp', `careerconnect_docker_cdp_${Date.now()}`);
const HTML_FILE = 'file:///' + path.resolve('scripts/render-docker-status.html').replace(/\\/g, '/');
const OUTPUT_FILE = path.resolve('screenshots/10-docker-compose-running.png');

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
        } catch (e) {}
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
    if (this.ws) this.ws.close();
  }
}

async function capture() {
  const browserProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    'about:blank',
  ]);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const tabs = await res.json();
        const tab = tabs[0];
        const cdp = new CDPClient(tab.webSocketDebuggerUrl);
        await cdp.connect();

        await cdp.send('Page.enable');
        await cdp.send('Page.navigate', { url: HTML_FILE });
        await new Promise(r => setTimeout(r, 1200));

        const screenshotRes = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(OUTPUT_FILE, Buffer.from(screenshotRes.data, 'base64'));
        console.log(`✓ Saved: ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB)`);

        cdp.close();
        browserProc.kill();
        fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
        process.exit(0);
      }
    } catch {}
  }
  browserProc.kill();
  process.exit(1);
}

capture();

