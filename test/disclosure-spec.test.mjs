// Unit tests for the video and audio disclosure specification.
//
// This document tells someone what to do to a master they cannot undo, so the
// things worth pinning down are: it never contradicts the treatment chosen, it
// never presents our practical readings as if they were the guidance, and the
// hardest case — a viewer joining a video partway through — is always covered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../src/disclosure-spec.js';
import { wrap } from '../src/wrap.js';
import { CRITERIA_VERSION } from '../src/decision-tree.js';

const NOW = new Date('2026-07-28T09:00:00Z');
const spec = (medium, level) => buildSpec({ medium, level, now: NOW });
// The document is hard-wrapped to a fixed column, so any phrase can be split
// across lines. Assert against a whitespace-normalised copy, or these tests
// break every time a sentence shifts by one word.
const flat = (medium, level) => spec(medium, level).replace(/\s+/g, ' ');
const ALL = [
  ['video', 'full'],
  ['video', 'attenuated'],
  ['audio', 'full'],
  ['audio', 'attenuated'],
];

test('every combination produces a complete document', () => {
  for (const [medium, level] of ALL) {
    const s = spec(medium, level);
    for (const section of ['WORDING', 'PLACEMENT', 'TIMING', 'BASIS', 'NOT YOUR OBLIGATION']) {
      assert.ok(s.includes(section), `${medium}/${level} missing ${section}`);
    }
    assert.ok(s.includes(medium.toUpperCase()), `${medium}/${level} should name the medium`);
  }
});

test('full video disclosure always addresses joining partway through', () => {
  // The result screen promises this is handled. If the spec ever stops
  // saying it, the tool is telling people the start card is enough.
  const s = flat('video', 'full');
  assert.match(s, /joining|join partway/);
  assert.match(s, /persistent corner mark|repeat the card/);
});

test('full disclosure is burned in, not a platform toggle', () => {
  const s = flat('video', 'full');
  assert.match(s, /Burned into the picture/);
  assert.match(s, /toggle/);
});

test('attenuated never demands on-screen persistence, and full always does', () => {
  assert.doesNotMatch(flat('video', 'attenuated'), /persistent corner mark/);
  assert.match(flat('video', 'full'), /persistent corner mark/);
});

test('attenuated video warns that a trailer cut loses the exemption', () => {
  // The guidance is explicit that commercial use cannot claim the carve-out.
  assert.match(flat('video', 'attenuated'), /trailer|advert/);
});

test('the machine-readable duty is always disclaimed as someone else’s', () => {
  for (const [medium, level] of ALL) {
    const s = flat(medium, level);
    assert.match(s, /Article 50\(2\)/);
    assert.match(s, /falls on the provider of the AI system/);
    assert.match(s, /Do not treat it as a substitute/);
  }
});

test('our practical readings are never passed off as the guidance', () => {
  // The 60-second interval is ours. Saying so is the difference between
  // decision support and inventing law.
  const s = flat('video', 'full');
  assert.match(s, /60 seconds/);
  assert.match(s, /practical reading of "first exposure", not a figure stated/);
});

test('every spec cites the criteria version it was produced under', () => {
  for (const [medium, level] of ALL) {
    assert.ok(spec(medium, level).includes(CRITERIA_VERSION));
  }
});

test('nothing overflows the fixed-width column', () => {
  for (const [medium, level] of ALL) {
    const longest = Math.max(...spec(medium, level).split('\n').map((l) => l.length));
    assert.ok(longest <= 80, `${medium}/${level} has a ${longest}-char line`);
  }
});

test('the timestamp carries a zone', () => {
  assert.match(spec('video', 'full'), /Date\s+28 July 2026 at \d{2}:\d{2} \S+/);
});

test('wrap hard-breaks a token longer than the column', () => {
  const lines = wrap('x'.repeat(200), 40);
  assert.ok(lines.every((l) => l.length <= 40));
  assert.equal(lines.join(''), 'x'.repeat(200), 'no characters lost');
});

test('wrap keeps ordinary prose intact', () => {
  const text = 'The disclosure has to be clear and distinguishable from the content.';
  assert.equal(wrap(text, 30).join(' '), text);
});
