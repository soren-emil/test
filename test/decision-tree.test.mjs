// Unit tests for the decision tree.
//
//   node --test test/
//
// These run in milliseconds against the pure module, with no browser and no
// build. verify.mjs still exercises the same outcomes through the real UI —
// this layer exists so the logic can be checked on every commit, and so a
// wrong answer is caught before it is ever rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluate,
  questionsFor,
  MEDIA_QUESTIONS,
  TEXT_QUESTIONS,
  MODIFIER_QUESTION,
  VERDICTS,
  CRITERIA_VERSION,
  CRITERIA_CHANGELOG,
} from '../src/decision-tree.js';

const media = (o) => evaluate('media', o);
const text = (o) => evaluate('text', o);
const ALL_HOLD = { ai: true, real: true, resemblance: true, authentic: true };

test('media: every criterion breaking the chain gives no obligation', () => {
  assert.equal(media({ ai: false }).verdict, 'none');
  assert.equal(media({ ai: true, real: false }).verdict, 'none');
  assert.equal(media({ ai: true, real: true, resemblance: false }).verdict, 'none');
  assert.equal(media({ ...ALL_HOLD, authentic: false }).verdict, 'none');
});

test('media: the break is reported at the criterion that actually failed', () => {
  assert.equal(media({ ai: false }).brokenAt, 0);
  assert.equal(media({ ai: true, real: false }).brokenAt, 1);
  assert.equal(media({ ai: true, real: true, resemblance: false }).brokenAt, 2);
  assert.equal(media({ ...ALL_HOLD, authentic: false }).brokenAt, 3);
});

test('media: all four holding is a deep fake, and the modifier picks the flavour', () => {
  assert.equal(media({ ...ALL_HOLD }).done, false, 'still needs the modifier answer');
  assert.equal(media({ ...ALL_HOLD, artistic: false }).verdict, 'full');
  assert.equal(media({ ...ALL_HOLD, artistic: true }).verdict, 'attenuated');
});

test('artistic never rescues advertising: the modifier only softens placement', () => {
  // The guidelines close this loophole explicitly — commercial or informative
  // content cannot claim the creative carve-out. Answering "not creative"
  // must always land on full disclosure, never on none.
  assert.equal(media({ ...ALL_HOLD, artistic: false }).verdict, 'full');
  assert.notEqual(media({ ...ALL_HOLD, artistic: true }).verdict, 'none');
});

test('text: needs AI drafting and public interest, and no editorial owner', () => {
  assert.equal(text({ ai: false }).verdict, 'none');
  assert.equal(text({ ai: true, publicInterest: false }).verdict, 'none');
  assert.equal(text({ ai: true, publicInterest: true, review: true }).verdict, 'none');
  assert.equal(text({ ai: true, publicInterest: true, review: false }).verdict, 'text');
});

test('text: the editorial exemption is the third link, inverted on purpose', () => {
  // review === true means a named person is responsible, which breaks the
  // chain and removes the duty. The link must hold on false.
  assert.equal(questionsFor('text')[2].holdsOn, false);
  assert.equal(text({ ai: true, publicInterest: true, review: true }).brokenAt, 2);
});

test('a partially answered flow is never reported as done', () => {
  for (const answers of [{}, { ai: true }, { ai: true, real: true }, { ...ALL_HOLD }]) {
    assert.equal(media(answers).done, false);
    assert.equal(media(answers).verdict, null);
  }
});

test('the cursor always points at the next unanswered question', () => {
  assert.equal(media({}).cursor, 0);
  assert.equal(media({ ai: true }).cursor, 1);
  assert.equal(media({ ai: true, real: true }).cursor, 2);
  assert.equal(media({ ...ALL_HOLD }).cursor, MEDIA_QUESTIONS.length);
});

test('evaluate is pure: it does not mutate the answers it is given', () => {
  const answers = { ...ALL_HOLD, artistic: false };
  const copy = structuredClone(answers);
  evaluate('media', answers);
  assert.deepEqual(answers, copy);
});

test('exhaustive: every reachable combination lands on a known verdict', () => {
  const bools = [true, false];
  let leaves = 0;
  for (const ai of bools) for (const real of bools) for (const res of bools) {
    for (const auth of bools) for (const art of bools) {
      const r = media({ ai, real, resemblance: res, authentic: auth, artistic: art });
      assert.equal(r.done, true);
      assert.ok(VERDICTS[r.verdict], `unknown verdict ${r.verdict}`);
      leaves += 1;
    }
  }
  for (const ai of bools) for (const pi of bools) for (const rev of bools) {
    const r = text({ ai, publicInterest: pi, review: rev });
    assert.equal(r.done, true);
    assert.ok(VERDICTS[r.verdict], `unknown verdict ${r.verdict}`);
    leaves += 1;
  }
  assert.equal(leaves, 40);
});

test('every question carries the copy the UI renders', () => {
  for (const q of [...MEDIA_QUESTIONS, ...TEXT_QUESTIONS, MODIFIER_QUESTION]) {
    for (const field of ['question', 'explain', 'yesLabel', 'noLabel', 'yesExample', 'noExample', 'chain', 'n']) {
      assert.ok(q[field]?.length, `${q.key} is missing ${field}`);
    }
    assert.ok(q.question.endsWith('?'), `${q.key} question should be a question`);
  }
});

test('criteria keys are unique within a path', () => {
  for (const path of ['media', 'text']) {
    const keys = questionsFor(path).map((q) => q.key);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('the version stamp has a matching changelog entry', () => {
  // The record cites this version as the reading it was decided under, so an
  // unexplained version is a record that cannot be traced.
  assert.ok(CRITERIA_CHANGELOG.some((e) => e.version === CRITERIA_VERSION));
});
