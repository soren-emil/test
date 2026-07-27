// Verification harness for Article 50 Check.
//
//   npm run build && npx vite preview --port 4173
//   node verify.mjs
//
// Covers every leaf of the decision tree, then sweeps the built page for
// horizontal overflow, missing focus rings, heading order and contrast.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const errors = [];
const URL = 'http://localhost:4173/';

async function fresh(width = 1280, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text());
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  return { ctx, page };
}
const click = (page, name) => page.getByRole('button', { name, exact: false }).first().click();

async function start(page, path) {
  await click(page, 'Check my content');
  await click(page, path === 'text' ? 'Text' : 'Image, video or audio');
}
async function answer(page, labels) {
  for (const l of labels) {
    await click(page, l);
    await page.waitForTimeout(120);
  }
}
async function verdictOf(page) {
  await page.waitForTimeout(700);
  return (await page.locator('h1').first().innerText()).trim();
}

console.log('--- decision tree: every leaf ---');
const cases = [
  { name: 'media-q1-no',  path: 'media', labels: ['No, it is camera-original'], expect: 'No disclosure required' },
  { name: 'media-q2-no',  path: 'media', labels: ['Yes, AI made or changed it', 'No, it is obviously impossible'], expect: 'No disclosure required' },
  { name: 'media-q3-no',  path: 'media', labels: ['Yes, AI made or changed it', 'Yes, it could be real', 'No, there is no real likeness'], expect: 'No disclosure required' },
  { name: 'media-q4-no',  path: 'media', labels: ['Yes, AI made or changed it', 'Yes, it could be real', 'Yes, it looks like the subject', 'No, nothing is misrepresented'], expect: 'No disclosure required' },
  { name: 'media-full',   path: 'media', labels: ['Yes, AI made or changed it', 'Yes, it could be real', 'Yes, it looks like the subject', 'Yes, it could pass as real', 'No, it is advertising or promotional'], expect: 'Disclosure required' },
  { name: 'media-atten',  path: 'media', labels: ['Yes, AI made or changed it', 'Yes, it could be real', 'Yes, it looks like the subject', 'Yes, it could pass as real', 'Yes, it is a creative work'], expect: 'Attenuated disclosure' },
  { name: 'text-q1-no',   path: 'text',  labels: ['No, I wrote it'], expect: 'No disclosure required' },
  { name: 'text-q2-no',   path: 'text',  labels: ['Yes, AI drafted it', 'No, it is marketing or internal'], expect: 'No disclosure required' },
  { name: 'text-exempt',  path: 'text',  labels: ['Yes, AI drafted it', 'Yes, it informs the public', 'Yes, a named person is responsible'], expect: 'No disclosure required' },
  { name: 'text-required',path: 'text',  labels: ['Yes, AI drafted it', 'Yes, it informs the public', 'No, nobody reviewed or owns it'], expect: 'Text disclosure required' },
];


let pass = 0;
for (const c of cases) {
  const { ctx, page } = await fresh();
  await start(page, c.path);
  await answer(page, c.labels);
  const v = await verdictOf(page);
  const ok = v === c.expect;
  if (ok) pass++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(16)} -> ${v}${ok ? '' : `   (expected ${c.expect})`}`);
  await ctx.close();
}
console.log(`  ${pass}/${cases.length} leaves correct`);

const widths = [320, 390, 768, 1024, 1440];
const flows = {
  'intro': [],
  'question-1': ['Check my content', 'Image, video or audio'],
  'broken': ['Check my content', 'Image, video or audio', 'Yes, AI made or changed it', 'Yes, it could be real', 'No, there is no real likeness'],
  'result-full': ['Check my content', 'Image, video or audio', 'Yes, AI made or changed it', 'Yes, it could be real', 'Yes, it looks like the subject', 'Yes, it could pass as real', 'No, it is advertising or promotional'],
  'text-result': ['Check my content', 'Text', 'Yes, AI drafted it', 'Yes, it informs the public', 'No, nobody reviewed or owns it'],
  'label': ['Label an image'],
};

console.log('--- horizontal overflow (body scrollWidth vs viewport) ---');
let bad = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const [name, steps] of Object.entries(flows)) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (const s of steps) await click(page, s);
    await page.waitForTimeout(250);
    const o = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      culprits: [...document.querySelectorAll('*')]
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 3)
        .map((e) => `${e.tagName.toLowerCase()}.${(e.className.baseVal ?? e.className ?? '').toString().split(' ').slice(0, 3).join('.')}`),
    }));
    const over = o.doc > o.vw + 1;
    if (over) { bad++; console.log(`  OVERFLOW ${w}px ${name}: ${o.doc} > ${o.vw}  ${o.culprits.join(' | ')}`); }
  }
  await ctx.close();
}
console.log(bad === 0 ? '  none at any width' : `  ${bad} overflowing screens`);

console.log('\n--- focus visibility (every interactive element gets a ring) ---');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (const s of flows['result-full']) await click(page, s);
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])')];
    const out = [];
    for (const el of els) {
      el.focus();
      const cs = getComputedStyle(el);
      const ring = cs.boxShadow !== 'none' || cs.outlineStyle !== 'none';
      if (!ring) out.push(el.tagName.toLowerCase() + ': ' + (el.textContent || el.type || '').trim().slice(0, 40));
    }
    return { total: els.length, missing: out };
  });
  console.log(`  ${res.total} focusable, ${res.missing.length} without a visible ring`);
  res.missing.forEach((m) => console.log('    MISSING ' + m));
  await ctx.close();
}

console.log('\n--- heading order + landmarks ---');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (const [name, steps] of Object.entries(flows)) {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    for (const s of steps) await click(page, s);
    await page.waitForTimeout(200);
    const h = await page.evaluate(() =>
      [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => e.tagName + ' ' + e.textContent.trim().slice(0, 34)));
    console.log(`  ${name}: ${h.join(' / ') || '(none)'}`);
  }
  await ctx.close();
}

console.log('\n--- contrast of the accent on its tint ---');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (const s of flows['result-full']) await click(page, s);
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => {
    const lum = (hex) => {
      const [r, g, b] = hex.match(/\d+/g).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const h2 = document.querySelector('main section h1');
    const kicker = h2.previousElementSibling;
    const panel = getComputedStyle(h2.parentElement).backgroundColor;
    return {
      verdict: ratio(getComputedStyle(h2).color, panel).toFixed(2),
      kicker: ratio(getComputedStyle(kicker).color, panel).toFixed(2),
      body: ratio(getComputedStyle(document.querySelectorAll('main li span')[1]).color, 'rgb(232,236,240)').toFixed(2),
    };
  });
  console.log('  verdict on tint:', c.verdict, '| kicker on tint:', c.kicker, '| body on ground:', c.body);
  await ctx.close();
}


console.log('\nerrors:', errors.length ? errors : 'none');
await browser.close();
