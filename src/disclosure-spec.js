// Disclosure specification for video and audio.
//
// Pure text generation, no React, so it can be tested directly.
import { CRITERIA_VERSION, CRITERIA_DATE } from './decision-tree.js';
import { wrap } from './wrap.js';

/* --------------------------------------------------------------------------
 * Disclosure specification for video and audio
 *
 * Compositing a persistent label into video in the browser means decoding,
 * drawing and re-encoding every frame — slow on a laptop, unusable on a
 * phone, and it would hand back a re-encoded master nobody wants. The useful
 * output is not a file. It is an instruction an editor can carry out in the
 * software they already have, which is also where the master lives.
 * -------------------------------------------------------------------------- */

const SPEC_WORDING = {
  full: 'AI-generated',
  attenuated: 'Contains AI-generated content',
};

function buildSpec({ medium, level, now }) {
  const isVideo = medium === 'video';
  const stamp = now.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const placement = isVideo
    ? level === 'attenuated'
      ? [
          'Opening or closing credits, or a card adjacent to the work.',
          'It does not have to sit over the picture. It does have to be findable by someone looking for it.',
          'If the same material is cut into a trailer or an advert, this exemption stops applying and the full treatment below is required instead.',
        ]
      : [
          'Burned into the picture, not set as a platform toggle or a description line. Toggles are stripped on re-upload and descriptions are collapsed by default.',
          'Inside the title-safe area so it survives the 9:16, 1:1 and 16:9 crops the piece will be cut into.',
          'High enough contrast to hold against the footage underneath at every point it appears.',
        ]
    : level === 'attenuated'
      ? [
          'Spoken or written in the credits, show notes, or the episode description.',
          'It has to be findable by someone looking for it, not buried.',
        ]
      : [
          'Spoken at the start, in the same voice and level as the content.',
          'Repeated in the written description where the platform provides one.',
        ];

  const timing = isVideo
    ? level === 'attenuated'
      ? ['Present with the work. No on-screen persistence required.']
      : [
          'At the latest at first exposure (Article 50(5)).',
          'A single card at the start is not enough where viewers can join partway through — live streams, autoplay feeds, scrubbing, clipped excerpts.',
          'Either keep a persistent corner mark for the whole runtime, or repeat the card at intervals no longer than 60 seconds and at every scene the piece is likely to be clipped from.',
        ]
    : level === 'attenuated'
      ? ['Present with the work. No repetition required.']
      : [
          'At the latest at first exposure (Article 50(5)).',
          'For anything longer than a few minutes, repeat at intervals — a listener joining a stream partway has to hear it too.',
        ];

  return [
    `ARTICLE 50 DISCLOSURE SPECIFICATION — ${isVideo ? 'VIDEO' : 'AUDIO'}`,
    '='.repeat(58),
    '',
    `Date          ${stamp}`,
    `Criteria      ${CRITERIA_VERSION} (${CRITERIA_DATE})`,
    `Treatment     ${level === 'attenuated' ? 'Attenuated — evidently artistic or creative work' : 'Full, clearly visible disclosure'}`,
    '',
    'WORDING',
    `  "${SPEC_WORDING[level]}"`,
    ...wrap(
      'Plain language, in the language of the audience. It must be distinguishable from the content itself rather than folded into it.',
      72,
    ).map((l) => `  ${l}`),
    '',
    'PLACEMENT',
    ...placement.flatMap((line) => {
      const [first, ...rest] = wrap(line, 72);
      return [`  - ${first}`, ...rest.map((l) => `    ${l}`)];
    }),
    '',
    'TIMING',
    ...timing.flatMap((line) => {
      const [first, ...rest] = wrap(line, 72);
      return [`  - ${first}`, ...rest.map((l) => `    ${l}`)];
    }),
    '',
    'NOT YOUR OBLIGATION',
    ...wrap(
      'Marking the file in a machine-readable format is a separate duty under Article 50(2), and it falls on the provider of the AI system, not on you. Do not treat it as a substitute for the visible disclosure above.',
      72,
    ).map((l) => `  ${l}`),
    '',
    'BASIS',
    ...wrap(
      'Article 3(60), Article 50(4) and Article 50(5) of Regulation (EU) 2024/1689, read with the European Commission guidelines on transparency of AI-generated content. Those guidelines are not legally binding. This specification is decision support, not legal advice. The intervals above are a practical reading of "first exposure", not a figure stated in the guidance.',
      72,
    ).map((l) => `  ${l}`),
    '',
  ].join('\n');
}

export { buildSpec, SPEC_WORDING };
