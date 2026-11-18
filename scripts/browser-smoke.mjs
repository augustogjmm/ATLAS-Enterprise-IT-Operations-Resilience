import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';

const root = resolve('dist');
const artifacts = resolve('test-artifacts');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const errors = [];

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relativePath = relative(root, filename);
    if (relativePath.startsWith('..') || relativePath.startsWith('/') || relativePath === '..') {
      res.writeHead(403).end('Forbidden'); return;
    }
    const contents = await readFile(filename);
    res.writeHead(200, { 'content-type': types[extname(filename)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(contents);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const browser = await chromium.launch({ headless: true });
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const url = 'http://127.0.0.1:' + address.port;
  await mkdir(artifacts, { recursive: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  desktop.on('pageerror', error => errors.push('Desktop: ' + error.message));
  await desktop.goto(url, { waitUntil: 'networkidle' });
  assert.match(await desktop.title(), /ATLAS/);
  assert.match(await desktop.locator('h1').innerText(), /decisiones/i);
  assert.equal(await desktop.locator('link[href="./premium.css"]').count(), 1);
  assert.equal(await desktop.locator('.hero-visual svg').count(), 1);
  assert.match(await desktop.locator('#brief-headline').innerText(), /recuperación/i);
  const premiumStyles = await desktop.locator('.hero').evaluate(el => ({
    borderRadius: getComputedStyle(el).borderRadius,
    backgroundColor: getComputedStyle(el).backgroundColor
  }));
  assert.ok(parseFloat(premiumStyles.borderRadius) >= 12, 'El hero debe tener el nuevo diseño premium');
  assert.equal(await desktop.locator('#metric-services').innerText(), '6');
  assert.equal(await desktop.locator('#scenario-select').inputValue(), 'dc-north');
  assert.ok(Number(await desktop.locator('#metric-affected').innerText()) > 0);

  await desktop.locator('#scenario-select').selectOption('dc-south');
  assert.equal(await desktop.locator('#metric-affected').innerText(), '0');
  assert.match(await desktop.locator('#brief-headline').innerText(), /redundancia/i);
  assert.match(await desktop.locator('#posture-redundancy').innerText(), /ruta alternativa/i);

  await desktop.locator('#scenario-select').selectOption('dual-network');
  assert.ok(Number(await desktop.locator('#metric-affected').innerText()) >= 3);
  assert.equal(await desktop.locator('#executive-brief').getAttribute('data-severity'), 'high');

  await desktop.locator('#scenario-select').selectOption('data-loss');
  assert.ok(Number(await desktop.locator('#metric-breaches').innerText()) > 0);

  await desktop.locator('#scenario-select').selectOption('dc-north');
  await desktop.locator('#intervention-select').selectOption('runbooks');
  assert.match(await desktop.locator('#investment-name').innerText(), /contingencia/i);
  assert.match(await desktop.locator('#budget-change').innerText(), /CAPEX/);
  await desktop.screenshot({ path: resolve(artifacts, 'atlas-escritorio.png'), fullPage: true });
  await desktop.locator('#scenario-select').selectOption('baseline');
  await desktop.screenshot({ path: resolve(artifacts, 'atlas-escritorio-normal.png'), fullPage: true });
  await desktop.locator('#scenario-select').selectOption('dc-north');

  const [download] = await Promise.all([
    desktop.waitForEvent('download'),
    desktop.locator('#export-btn').click()
  ]);
  assert.match(download.suggestedFilename(), /^atlas-dc-north-assessment\.json$/);
  const report = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(report.scenario.id, 'dc-north');
  assert.equal(report.intervention.id, 'runbooks');
  assert.equal(report.services.length, 6);
  assert.match(report.classification, /FICTICIA/);

  const tablet = await browser.newPage({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 });
  tablet.on('pageerror', error => errors.push('Tablet: ' + error.message));
  await tablet.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await tablet.locator('#metric-services').innerText(), '6');
  const tabletOverflow = await tablet.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(tabletOverflow <= 1, 'La interfaz no debe desbordar horizontalmente en tablet: ' + tabletOverflow);
  await tablet.screenshot({ path: resolve(artifacts, 'atlas-tablet.png'), fullPage: true });
  await tablet.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push('Mobile: ' + error.message));
  await mobile.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await mobile.locator('#metric-services').innerText(), '6');
  assert.ok(await mobile.locator('.executive-brief').isVisible());
  await mobile.locator('#scenario-select').selectOption('cloud-outage');
  assert.ok(Number(await mobile.locator('#metric-affected').innerText()) >= 1);
  const overflow = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, 'Mobile layout overflow: ' + JSON.stringify(overflow));
  await mobile.screenshot({ path: resolve(artifacts, 'atlas-movil.png'), fullPage: true });
  await mobile.close();
  await desktop.close();
  assert.deepEqual(errors, []);
  console.log('OK: escenarios, RTO/RPO, inversión, exportación JSON, escritorio y móvil.');
} finally {
  await browser.close();
  server.close();
}
