#!/usr/bin/env node
import { chromium } from 'playwright';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

function serveStatic(root, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(root, decodeURIComponent((req.url || '/').split('?')[0]));
      if (p.endsWith('/')) p += 'index.html';
      if (!fs.existsSync(p) || !p.startsWith(root)) {
        res.writeHead(404); return res.end('not found');
      }
      const ext = path.extname(p);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function runChecks(page, label) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(page.__url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof switchView === 'function', { timeout: 15000 });

  const checks = [
    { name: 'switchView calendar', fn: () => switchView('calendar') },
    { name: 'switchView profile', fn: () => switchView('profile') },
    { name: 'switchView narrative', fn: () => switchView('narrative') },
    { name: 'toggleTheme', fn: () => toggleTheme() },
    { name: 'toggleSensitiveBlinded', fn: () => toggleSensitiveBlinded() },
    { name: 'openAddModal task', fn: () => openAddModal('task', { group: 'urgent' }) },
    { name: 'copyWhatWeDo', fn: () => copyWhatWeDo() },
  ];

  for (const c of checks) {
    try {
      await page.evaluate(c.fn);
    } catch (e) {
      errors.push(`${label} ${c.name}: ${e.message}`);
    }
  }

  const modalOpen = await page.evaluate(() => document.getElementById('add-modal-overlay').classList.contains('open'));
  if (!modalOpen) errors.push(`${label} openAddModal: modal not open`);

  await page.evaluate(() => closeAddModal());
  const modalClosed = await page.evaluate(() => !document.getElementById('add-modal-overlay').classList.contains('open'));
  if (!modalClosed) errors.push(`${label} closeAddModal: modal still open`);

  if (typeof page.__mobile === 'boolean' && page.__mobile) {
    await page.evaluate(() => mobileSwitchView('grants'));
    await page.evaluate(() => toggleMobileMore(true));
    await page.evaluate(() => mobileSwitchView('profile'));
    await page.evaluate(() => toggleMobileMore(false));
  }

  return errors;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const allErrors = [];

  const server = await serveStatic(ROOT, 9878);
  const contexts = [
    { url: `http://127.0.0.1:9878/SBCC/command-center.html`, mobile: false, label: 'http-desktop' },
    { url: `http://127.0.0.1:9878/SBCC/mobile/command-center.html`, mobile: true, label: 'http-mobile' },
    { url: `file://${ROOT}/SBCC/command-center.html`, mobile: false, label: 'file-desktop' },
  ];

  for (const ctx of contexts) {
    const page = await browser.newPage();
    page.__url = ctx.url;
    page.__mobile = ctx.mobile;
    const errs = await runChecks(page, ctx.label);
    allErrors.push(...errs);
    await page.close();
  }

  await browser.close();
  server.close();

  if (allErrors.length) {
    console.error('FAILURES:\n' + allErrors.join('\n'));
    process.exit(1);
  }
  console.log('All button smoke checks passed (http + file).');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
