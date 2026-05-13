const { chromium, devices } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const baseURL = process.env.WMS_URL || 'http://localhost:4101';
const apiURL = process.env.WMS_API_URL || 'http://localhost:5000';
const outDir = path.resolve(__dirname, '..', 'qa-screenshots', 'mobile');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  ensureDir(outDir);
  let vite;
  const ready = await waitForHttp(`${baseURL}/login`, 2000);
  if (!ready) {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/c', 'npm.cmd', 'run', 'dev'] : ['run', 'dev'];
    vite = spawn(command, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    vite.stdout.on('data', () => {});
    vite.stderr.on('data', (chunk) => process.stderr.write(chunk));
    const started = await waitForHttp(`${baseURL}/login`, 30000);
    if (!started) throw new Error(`Vite did not become ready at ${baseURL}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  });
  const page = await context.newPage();
  const errors = [];
  const results = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) errors.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.method()} ${req.url()} ${req.failure()?.errorText}`));

  const health = await fetch(`${apiURL}/health`).then((r) => r.ok).catch(() => false);
  const loginRes = await fetch(`${apiURL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
  });
  if (!loginRes.ok) throw new Error(`API login failed: ${loginRes.status} ${await loginRes.text()}`);
  const loginJson = await loginRes.json();
  const authData = loginJson.data;
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ user, tenant, token }) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant', JSON.stringify(tenant));
    localStorage.setItem('token', token);
    localStorage.setItem('wms_view_mode', 'mobile');
  }, authData);

  const routes = [
    { name: 'dashboard', url: '/m/dashboard', mustHave: ['Dashboard'] },
    { name: 'booking', url: '/m/booking?bulan=5&tahun=2026', mustHave: ['Booking'] },
    { name: 'hpp', url: '/m/lainnya/services/hpp', mustHave: ['Setup HPP'] },
    { name: 'layanan', url: '/m/layanan', mustHave: ['Layanan'] },
    { name: 'pengeluaran', url: '/m/lainnya/pengeluaran', mustHave: ['Pengeluaran'] },
    { name: 'aliran-kas', url: '/m/lainnya/aliran-kas', mustHave: ['Aliran Kas'] },
  ];

  for (const route of routes) {
    await page.goto(`${baseURL}${route.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    if (route.name === 'hpp') {
      const category = page.locator('button:has-text("Paint Protection Film (PPF) Glossy")').first();
      if (await category.count()) await category.click();
      await page.waitForTimeout(300);
      const packageButton = page.locator('button:has-text("PPF Full Car Glossy - Medium"), button:has-text("Full Large Glossy")').first();
      if (await packageButton.count()) await packageButton.click();
      await page.waitForTimeout(700);
    }

    const screenshot = path.join(outDir, `${route.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyText: document.body.innerText,
      buttons: document.querySelectorAll('button').length,
      inputs: document.querySelectorAll('input,select,textarea').length,
    }));
    const missing = route.mustHave.filter((text) => !metrics.bodyText.includes(text));

    results.push({
      route: route.name,
      url: route.url,
      screenshot,
      ok: missing.length === 0 && metrics.scrollWidth <= metrics.clientWidth + 2,
      missing,
      horizontalOverflow: metrics.scrollWidth - metrics.clientWidth,
      controls: { buttons: metrics.buttons, inputs: metrics.inputs },
      viewport: page.viewportSize(),
    });
  }

  await browser.close();
  if (vite) vite.kill();
  console.log(JSON.stringify({ health, results, errors: [...new Set(errors)].slice(0, 30) }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
