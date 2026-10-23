/* Gemeinsame Hilfen für smoketest.js und screenshots.js:
   kleiner Webserver ohne Abhängigkeiten und Start von Chromium als iPad. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css'
};

function startServer(root) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const file = path.join(root, p);
      if (!file.startsWith(path.resolve(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nicht gefunden'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

function loadPlaywright() {
  const tries = ['playwright', '/opt/npm-tools/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) { /* weiter */ } }
  throw new Error('Playwright fehlt. Abhilfe: npm install playwright && npx playwright install chromium');
}

/* iPad Air 11" im Querformat, iPadOS meldet sich als Mac mit Touch. */
const IPAD = {
  viewport: { width: 1180, height: 820 },
  screen: { width: 1180, height: 820 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: false,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
};

async function launch(opts) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const context = await browser.newContext(Object.assign({}, IPAD, opts || {}));
  /* maxTouchPoints > 1 macht aus dem Mac-Kennzeichen ein iPad (wie auf dem Gerät). */
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  });
  return { browser, context };
}

module.exports = { startServer, launch, IPAD };
