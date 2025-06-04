/**
 * script.js  – scrape + render Dia Browser campus icons
 *
 * 1.  GET  https://www.diabrowser.com/campuses
 *     → collect every <a href="/{slug}">  (≈250+ slugs)
 * 2.  FOR  each slug:
 *       • visit https://www.diabrowser.com/{slug}
 *       • wait until at least one SVG is in the DOM
 *       • pick the largest SVG (width ≥ 100 px) → save svgs/{slug}.svg
 * 3.  RENDER every saved SVG → pngs/{slug}.png   (512×512, 85 % occupancy)
 *
 *  node script.js
 */

const fs         = require('fs');
const path       = require('path');
const puppeteer  = require('puppeteer');

const ROOT   = __dirname;
const SVG_OUT = path.join(ROOT, 'svgs');
const PNG_OUT = path.join(ROOT, 'pngs');
const START  = 'https://www.diabrowser.com/campuses';

const VIEWPORT   = 512;
const OCCUPANCY  = 0.85;        // 85 % of 512 ⇒ ~435 px

// ── helpers ────────────────────────────────────────────────────────────
function ensure(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir); }
function delay(ms)   { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  ensure(SVG_OUT);
  ensure(PNG_OUT);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page    = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  /* ───────────────── 1. grab campus slugs ───────────────── */
  console.log('⏳  Loading campuses list…');
  await page.goto(START, { waitUntil: 'networkidle0' });

  const slugs = await page.$$eval('a[href^="/"]', as =>
    Array.from(new Set(
      as
        .map(a => a.getAttribute('href') || '')
        // keep only bare “/slug” paths (no external, no /# etc.)
        .filter(h => /^\/[a-z0-9_-]+$/i.test(h))
        .map(h => h.slice(1))     // drop leading slash
    ))
  );

  console.log(`🔎  Found ${slugs.length} campuses.`);
  if (!slugs.length) { console.error('❌  Nothing to do.'); process.exit(1); }

  /* ───────────── 2. visit each campus & save SVG ─────────── */
  await page.setViewport({ width: 1024, height: 800 });

  for (const slug of slugs) {
    const url = `https://www.diabrowser.com/${slug}`;
    console.log(`→ ${slug}…`);

    try {
      await page.goto(url, { waitUntil: 'networkidle0' });
      // wait for at least one SVG element to show up
      await page.waitForSelector('svg', { timeout: 6000 });
      // pick the *largest* svg (width ≥ 100 px) – that’s always the logo
      const svgHTML = await page.$$eval('svg', svgs => {
        let biggest = null, area = 0;
        svgs.forEach(s => {
          const r = s.getBoundingClientRect();
          const a = r.width * r.height;
          if (r.width >= 100 && a > area) { biggest = s.outerHTML; area = a; }
        });
        return biggest;
      });

      if (!svgHTML) { console.warn(`   ⚠️  no suitable SVG on ${slug}`); continue; }
      fs.writeFileSync(path.join(SVG_OUT, `${slug}.svg`), svgHTML, 'utf8');
      console.log(`   ✔︎ saved ${slug}.svg`);
    } catch (err) {
      console.warn(`   ⚠️  failed for ${slug}: ${err.message}`);
      continue;
    }
  }

  /* ───────────── 3. render every saved SVG ──────────────── */
  await page.setViewport({ width: VIEWPORT, height: VIEWPORT });

  const svgFiles = fs.readdirSync(SVG_OUT).filter(f => f.endsWith('.svg'));
  console.log(`\n🎨  Rendering ${svgFiles.length} SVGs → PNGs…`);

  for (const file of svgFiles) {
    const slug    = file.replace(/\.svg$/, '');
    const svgPath = path.join(SVG_OUT, file);
    const pngPath = path.join(PNG_OUT, `${slug}.png`);
    const rawSVG  = fs.readFileSync(svgPath, 'utf8');

    // ensure a viewBox exists – required for reliable scaling
    const svg = /viewBox=/.test(rawSVG)
      ? rawSVG
      : rawSVG.replace(/<svg([^>]*)>/,
          (m, attrs) => `<svg${attrs} viewBox="0 0 173 174">`);

    // build a tiny HTML stage
    const html = `
      <html><body style="margin:0;background:transparent">
        <div id="wrap" style="position:relative;width:${VIEWPORT}px;height:${VIEWPORT}px">
          <div id="svg" style="position:absolute">${svg}</div>
        </div>
      </body></html>`;

    await page.setContent(html, { waitUntil: 'load' });
    await delay(200);

    // measure real bbox of the inline svg (includes filters)
    const { w, h } = await page.evaluate(() => {
      const r = document.getElementById('svg').getBoundingClientRect();
      return { w: r.width, h: r.height };
    });

    const scale   = (VIEWPORT * OCCUPANCY) / Math.max(w, h);
    const offsetX = (VIEWPORT - w * scale) / 2;
    const offsetY = (VIEWPORT - h * scale) / 2;

    await page.evaluate(({ x, y, s }) => {
      const el = document.getElementById('svg');
      el.style.transformOrigin = 'top left';
      el.style.transform = `scale(${s})`;
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
    }, { x: offsetX, y: offsetY, s: scale });

    await page.screenshot({
      path: pngPath,
      clip: { x: 0, y: 0, width: VIEWPORT, height: VIEWPORT },
      omitBackground: true
    });

    console.log(`   ✔︎ ${slug}.png`);
  }

  await browser.close();
  console.log('\n✅  Done — check ./svgs and ./pngs');
})();