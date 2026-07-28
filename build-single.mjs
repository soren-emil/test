// Inline the Vite build into one self-contained HTML file.
//
//   npm run build && node build-single.mjs
//
// Output: demo/article-50-check.html — no external requests, so it can be
// dropped on any static host or opened from a file share.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';

const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8');

if (js.includes('</script')) {
  throw new Error('Bundle contains a literal </script>; it needs escaping before inlining.');
}

mkdirSync('demo', { recursive: true });
writeFileSync(
  'demo/article-50-check.html',
  `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Article 50 Check</title>
<meta name="description" content="Work out whether AI-generated content needs a disclosure under Article 50(4) of the EU AI Act, and keep a record of the decision.">
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${js}
</script>
</body>
</html>
`,
);
console.log('demo/article-50-check.html written');
