// The decision tree, its copy, and the version stamp.
//
// Separated from the component for one reason: this is the only part of the
// product where being wrong has consequences, and a pure module can be tested
// in milliseconds instead of through a browser. It also gives copy edits a
// file that contains no rendering.
//
// No React, no DOM. Keep it that way.

/* --------------------------------------------------------------------------
 * CRITERIA VERSION
 * Article 50 will be read and re-read by regulators and courts for years, and
 * the Commission's guidance will move with it. A record produced today asserts
 * a decision under today's reading, so the reading is stamped into the record.
 * A record from 2026 stays defensible in 2028 because it says which version of
 * the test produced it.
 *
 * Bump CRITERIA_VERSION and add a CRITERIA_CHANGELOG entry whenever a question,
 * an outcome or a reasoning string changes in a way that could alter a verdict.
 * -------------------------------------------------------------------------- */
const CRITERIA_VERSION = '1.0';
const CRITERIA_DATE = '28 July 2026';

const CRITERIA_CHANGELOG = [
  {
    version: '1.0',
    date: '28 July 2026',
    note:
      'First source-checked version. Criteria derived from Article 3(60) and ' +
      'Article 50(4)-(5) of Regulation (EU) 2024/1689, read with the European ' +
      'Commission guidelines on transparency of AI-generated content.',
  },
];


/* --------------------------------------------------------------------------
 * The test
 *
 * Every criterion below must hold for the disclosure duty to attach. Break one
 * and there is no obligation. `holdsOn` is the answer that keeps the chain
 * intact — it is false for the text path's third criterion, where a human
 * editorial owner is what breaks the chain.
 * -------------------------------------------------------------------------- */

const MEDIA_QUESTIONS = [
  {
    key: 'ai',
    n: '01',
    chain: 'AI-generated or altered',
    holdsOn: true,
    question: 'Was this generated or meaningfully altered by AI?',
    explain:
      'Article 50(4) reaches synthetic material, and material an AI system has meaningfully changed. Cropping, straightening and ordinary colour work by hand do not count.',
    yesLabel: 'Yes, AI made or changed it',
    noLabel: 'No, it is camera-original',
    yesExample:
      'A product shot where the lighting, the background or the object itself was produced by a generative model.',
    noExample: 'A photograph you took, straightened and colour-graded by hand.',
  },
  {
    key: 'real',
    n: '02',
    chain: 'Real or plausible subject',
    holdsOn: true,
    question:
      'Does it show a person, object, place, entity or event that exists, could plausibly exist, or could plausibly have existed?',
    explain:
      'The subject has to be something that could be real. An invented person counts: the guidelines put a photorealistic portrait of someone who does not exist inside the definition, because such a person plausibly could exist.',
    yesLabel: 'Yes, it could be real',
    noLabel: 'No, it is obviously impossible',
    yesExample:
      'A synthetic influencer who looks like an ordinary person, testing a real sponsored product.',
    noExample:
      'A sphinx flying over the Eiffel Tower. Nobody takes it for a record of an event.',
  },
  {
    key: 'resemblance',
    n: '03',
    chain: 'Appreciable resemblance',
    holdsOn: true,
    question: 'Is there an appreciable resemblance to that real or plausible subject?',
    explain:
      'The output has to actually look like the person, object or place in question — close enough that a viewer would connect the two.',
    yesLabel: 'Yes, it looks like the subject',
    noLabel: 'No, there is no real likeness',
    yesExample:
      'An AI video of a company CEO, recognisably them, congratulating staff.',
    noExample:
      'Mice arguing about cheese in an ad. There is no real subject anyone could be misled about.',
  },
  {
    key: 'authentic',
    n: '04',
    chain: 'Could pass as authentic',
    holdsOn: true,
    question:
      'Could a viewer reasonably take it as an authentic record of something real?',
    explain:
      'The duty applies even with no intent to deceive: what matters is whether an ordinary viewer, seeing it in context, could take it as a true record. Our reading is that this also covers making a product look different, better or more capable than it is — the guidelines do not address that case directly.',
    yesLabel: 'Yes, it could pass as real',
    noLabel: 'No, nothing is misrepresented',
    yesExample:
      'An AI product photo that gives the item a finish, a size or a capability it does not have.',
    noExample:
      'A real car, really photographed, placed against an AI-generated landscape. The car itself is not misrepresented.',
  },
];

const MODIFIER_QUESTION = {
  key: 'artistic',
  n: '05',
  chain: 'Presentation',
  question:
    'Is the work evidently artistic, creative, satirical or fictional, with no commercial or informative purpose driving it?',
  explain:
    'This does not remove the obligation. It changes where the disclosure can go, so it does not spoil the work.',
  yesLabel: 'Yes, it is a creative work',
  noLabel: 'No, it is advertising or promotional',
  yesExample:
    'A de-aged actor in a feature film. The disclosure belongs in the credits.',
  noExample:
    'A teleshopping-style ad with synthetic presenters. Creative in style, but it is selling, so full disclosure applies.',
};

const TEXT_QUESTIONS = [
  {
    key: 'ai',
    n: '01',
    chain: 'AI-drafted',
    holdsOn: true,
    question: 'Is the text AI-generated or substantially AI-drafted?',
    explain:
      'Using AI to research, outline or tidy up your own writing is not the same as having it write the piece.',
    yesLabel: 'Yes, AI drafted it',
    noLabel: 'No, I wrote it',
    yesExample: 'An article the model wrote from a brief, which you then edited.',
    noExample: 'Your own draft, run through a grammar checker.',
  },
  {
    key: 'publicInterest',
    n: '02',
    chain: 'Public interest',
    holdsOn: true,
    question: 'Is it published to inform the public on a matter of public interest?',
    explain:
      'News and current affairs, health, safety, politics, consumer matters. Marketing copy, product descriptions and internal documents are not caught by this part of Article 50.',
    yesLabel: 'Yes, it informs the public',
    noLabel: 'No, it is marketing or internal',
    yesExample: 'A news explainer about a change in the law.',
    noExample: 'A product description, a customer newsletter, an internal report.',
  },
  {
    key: 'review',
    n: '03',
    chain: 'No editorial owner',
    holdsOn: false,
    question:
      'Did a human genuinely review it, and does a named person or organisation hold editorial responsibility for it?',
    explain:
      'A superficial spellcheck does not count. Someone has to have checked the substance and be answerable for what it says. If that is true, the text is exempt.',
    yesLabel: 'Yes, a named person is responsible',
    noLabel: 'No, nobody reviewed or owns it',
    yesExample:
      'An editor read it against the sources, and it carries a byline and a masthead.',
    noExample: 'Published as generated, with nobody named as responsible.',
  },
];

const VERDICTS = {
  none: { title: 'No disclosure required', kicker: 'Article 50(4) does not attach' },
  full: { title: 'Disclosure required', kicker: 'Deep fake — full, visible disclosure' },
  attenuated: { title: 'Attenuated disclosure', kicker: 'Deep fake — disclosure can be placed discreetly' },
  text: { title: 'Text disclosure required', kicker: 'AI-drafted text on a matter of public interest' },
};

/* --------------------------------------------------------------------------
 * Pure decision tree
 * -------------------------------------------------------------------------- */

function questionsFor(path) {
  return path === 'text' ? TEXT_QUESTIONS : MEDIA_QUESTIONS;
}

function evaluate(path, answers) {
  const qs = questionsFor(path);
  for (let i = 0; i < qs.length; i += 1) {
    const q = qs[i];
    const a = answers[q.key];
    if (a === undefined) return { done: false, cursor: i, brokenAt: null, verdict: null };
    if (a !== q.holdsOn) return { done: true, cursor: null, brokenAt: i, verdict: 'none' };
  }
  if (path === 'text') return { done: true, cursor: null, brokenAt: null, verdict: 'text' };
  const artistic = answers[MODIFIER_QUESTION.key];
  if (artistic === undefined) {
    return { done: false, cursor: qs.length, brokenAt: null, verdict: null };
  }
  return {
    done: true,
    cursor: null,
    brokenAt: null,
    verdict: artistic ? 'attenuated' : 'full',
  };
}

export {
  CRITERIA_VERSION,
  CRITERIA_DATE,
  CRITERIA_CHANGELOG,
  MEDIA_QUESTIONS,
  MODIFIER_QUESTION,
  TEXT_QUESTIONS,
  VERDICTS,
  questionsFor,
  evaluate,
};
