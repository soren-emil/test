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

console.log('\n--- focus visibility (every rendered interactive element gets a ring) ---');
for (const w of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (const s of flows['result-full']) await click(page, s);
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])')];
    // Only judge what is actually rendered. The responsive chain (rail vs
    // strip) keeps both variants in the DOM, and a display:none element
    // cannot take focus, so it would report a missing ring forever.
    const rendered = all.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
    const missing = [];
    for (const el of rendered) {
      el.focus();
      const cs = getComputedStyle(el);
      if (cs.boxShadow === 'none' && cs.outlineStyle === 'none') {
        missing.push((el.getAttribute('aria-label') || el.textContent || el.type || '').trim().slice(0, 44));
      }
    }
    return { total: all.length, rendered: rendered.length, missing };
  });
  console.log(`  ${w}px: ${res.rendered} rendered of ${res.total}, ${res.missing.length} without a visible ring`);
  res.missing.forEach((m) => console.log('    MISSING ' + m));
  await ctx.close();
}

console.log('\n--- step focus and revisiting an answer ---');
{
  const { ctx, page } = await fresh();
  const at = () => page.evaluate(() => {
    const a = document.activeElement;
    return a === document.body ? 'BODY (focus lost)' : a.tagName;
  });
  await click(page, 'Check my content');
  await click(page, 'Image, video or audio');
  await click(page, 'Yes, AI made or changed it');
  await page.waitForTimeout(250);
  // Focus must land on the new heading, not linger on the reused button.
  console.log(`  focus after answering    : ${await at()} ${(await at()) === 'H1' ? 'PASS' : 'FAIL'}`);

  for (const l of ['Yes, it could be real', 'Yes, it looks like the subject', 'Yes, it could pass as real', 'No, it is advertising or promotional']) {
    await click(page, l);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  console.log(`  focus on the verdict     : ${await at()} ${(await at()) === 'H1' ? 'PASS' : 'FAIL'}`);

  await page.getByRole('button', { name: /Change your answer to criterion 02/ }).click();
  await page.waitForTimeout(300);
  const left = await page.getByRole('button', { name: /Change your answer to criterion/ }).count();
  console.log(`  revisit 02 discards 03-05: ${left} link(s) still answered ${left === 1 ? 'PASS' : 'FAIL'}`);
  await click(page, 'No, it is obviously impossible');
  await page.waitForTimeout(600);
  const v = (await page.locator('h1').first().innerText()).trim();
  console.log(`  re-answered verdict      : ${v} ${v === 'No disclosure required' ? 'PASS' : 'FAIL'}`);
  await ctx.close();
}

{
  const { ctx, page } = await fresh(390, 844);
  await click(page, 'Check my content');
  await click(page, 'Image, video or audio');
  await click(page, 'Yes, AI made or changed it');
  await page.waitForTimeout(250);
  const box = await page.getByRole('button', { name: /Change your answer to criterion 01/ }).boundingBox();
  const ok = box.width >= 44 && box.height >= 44;
  console.log(`  mobile ring hit area     : ${Math.round(box.width)}x${Math.round(box.height)} ${ok ? 'PASS (>=44px)' : 'FAIL'}`);
  await ctx.close();
}

console.log('\n--- badge scales with the image, not against it ---');
{
  const { ctx, page } = await fresh();
  const fsm = await import('fs');
  await click(page, 'Label an image');
  for (const [w, h] of [[400, 300], [8000, 5000]]) {
    const bytes = await page.evaluate(async ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#b8c2cc'; x.fillRect(0, 0, w, h);
      const bl = await new Promise((r) => c.toBlob(r, 'image/png'));
      return Array.from(new Uint8Array(await bl.arrayBuffer()));
    }, [w, h]);
    const f = `/tmp/a50-scale-${w}.png`;
    fsm.writeFileSync(f, Buffer.from(bytes));
    await page.setInputFiles('input[type=file]', f);
    await page.waitForTimeout(400);
    const out = [];
    for (const sz of ['Small', 'Medium', 'Large']) {
      await click(page, sz);
      await page.waitForTimeout(120);
      out.push(`${sz}=${await page.getByRole('button', { name: /Badge position/ }).evaluate((el) => el.style.width)}`);
    }
    console.log(`  ${String(w).padStart(4)}px wide image  : ${out.join('  ')}`);
    fsm.unlinkSync(f);
    const again = page.getByRole('button', { name: 'Use a different image' });
    if (await again.count()) await again.click();
    await page.waitForTimeout(200);
  }
  await ctx.close();
}

console.log('\n--- print: the record is the deliverable ---');
{
  const { ctx, page } = await fresh();
  for (const s of flows['result-full']) await click(page, s);
  await page.waitForTimeout(400);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const shown = (sel) => {
      const e = document.querySelector(sel);
      return e ? e.offsetParent !== null || getComputedStyle(e).position === 'fixed' : false;
    };
    const pre = document.querySelector('pre');
    return {
      headerHidden: !shown('header'),
      emailHidden: !shown('#a50-email'),
      buttonsHidden: !shown('button'),
      recordWhole: pre.scrollHeight <= pre.clientHeight + 2,
      identityLine: !!shown('main p'),
    };
  });
  const ok = r.headerHidden && r.emailHidden && r.buttonsHidden && r.recordWhole;
  console.log(`  header/email/buttons hidden: ${r.headerHidden}/${r.emailHidden}/${r.buttonsHidden}`);
  console.log(`  record prints unclipped    : ${r.recordWhole} ${ok ? 'PASS' : 'FAIL'}`);
  await ctx.close();
}

console.log('\n--- forced colours and the export busy state ---');
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    forcedColors: 'active',
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await click(page, 'Check my content');
  await click(page, 'Image, video or audio');
  await click(page, 'Yes, AI made or changed it');
  await page.waitForTimeout(250);
  // A fixed hex here would leave the solid links invisible on a dark
  // high-contrast background while the CSS spine turned white.
  const fill = await page.evaluate(() => document.querySelector('aside svg rect')?.getAttribute('fill'));
  console.log(`  chain draws in currentColor : ${fill} ${fill === 'currentColor' ? 'PASS' : 'FAIL'}`);
  await ctx.close();
}
{
  const { ctx, page } = await fresh();
  const fsm = await import('fs');
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 6000; c.height = 4000;
    const x = c.getContext('2d'); x.fillStyle = '#9aa5b1'; x.fillRect(0, 0, 6000, 4000);
    const bl = await new Promise((r) => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await bl.arrayBuffer()));
  });
  const f = '/tmp/a50-verify-big.png';
  fsm.writeFileSync(f, Buffer.from(bytes));
  await click(page, 'Label an image');
  await page.setInputFiles('input[type=file]', f);
  await page.waitForTimeout(600);
  // Watch the button itself: a name-based locator stops matching the moment
  // the label changes, which reads as "no busy state" when there is one.
  await page.evaluate(() => {
    window.__log = [];
    const btn = [...document.querySelectorAll('button')].find((e) => e.textContent.includes('Download labelled'));
    window.__btn = btn;
    new MutationObserver(() => window.__log.push(btn.textContent.trim()))
      .observe(btn, { childList: true, subtree: true, characterData: true, attributes: true });
  });
  const dl = page.waitForEvent('download');
  await page.evaluate(() => window.__btn.click());
  await dl;
  const log = await page.evaluate(() => window.__log);
  const busy = log.some((t) => t.includes('Rendering'));
  console.log(`  export shows a busy state   : ${JSON.stringify(log)} ${busy ? 'PASS' : 'FAIL'}`);
  fsm.unlinkSync(f);
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
