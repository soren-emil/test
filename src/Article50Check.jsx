import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
 * Article 50 Check
 * Decision support for the disclosure duty in Article 50(4) of the EU AI Act.
 *
 * No backend, no accounts, no storage. Every answer lives in React state and
 * is gone when the tab closes. The triage below is a plain decision tree, not
 * a model call, and nothing on this page inspects content to guess whether it
 * was made by AI — the user tells us.
 * ========================================================================== */

/* --------------------------------------------------------------------------
 * EMAIL CAPTURE ENDPOINT
 * Left empty on purpose. Point this at a form endpoint and the single email
 * field on the result screen starts posting { email, verdict, date }. While
 * it is empty the form makes no network request at all and says so.
 * -------------------------------------------------------------------------- */
const WEBHOOK_URL = '';

/* --------------------------------------------------------------------------
 * PLACEHOLDER BADGE ASSETS
 * The Commission has not published official disclosure marks yet. These are
 * stand-ins. To swap them, replace the SVG string returned by badgeSvg() and
 * update the width/height on each entry — the label tool reads its geometry
 * from here and nothing else in the file needs to change.
 * -------------------------------------------------------------------------- */
const BADGE_HEIGHT = 64;

const BADGE_ASSETS = {
  basic: { key: 'basic', name: 'Basic AI disclosure', label: 'AI disclosure', width: 244 },
  generated: { key: 'generated', name: 'Fully AI-generated', label: 'Fully AI-generated', width: 306 },
  modified: { key: 'modified', name: 'Partially AI-modified', label: 'Partially AI-modified', width: 336 },
};

function badgeSvg(badge) {
  const w = badge.width;
  const h = BADGE_HEIGHT;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${(h - 3) / 2}" fill="#0D1219" stroke="#FFFFFF" stroke-width="3"/>`,
    `<circle cx="33" cy="32" r="19" fill="#FFFFFF"/>`,
    `<text x="33" y="39" text-anchor="middle" fill="#0D1219" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="0.5">AI</text>`,
    `<text x="64" y="40" fill="#FFFFFF" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="500">${badge.label}</text>`,
    `</svg>`,
  ].join('');
}

function badgeDataUrl(badge) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(badge))}`;
}

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
      'Does it show a person, object, place, entity or event that exists in reality, or that could plausibly exist?',
    explain:
      'The subject has to be something a viewer could believe is real — either an actual person or thing, or an invented one realistic enough to pass for one.',
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
      'This includes making a product look different, better or more capable than it actually is. The question is not whether you meant to mislead — it is whether an ordinary viewer, seeing it in context, could take it as a true record.',
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

function reasoningFor(path, answers, result) {
  const { verdict, brokenAt } = result;
  if (path === 'text') {
    if (brokenAt === 0) {
      return 'The chain breaks at the first criterion. The text was not AI-generated or substantially AI-drafted, so the Article 50(4) text duty does not reach it at all.';
    }
    if (brokenAt === 1) {
      return 'The chain breaks at the second criterion. The text is not published to inform the public on a matter of public interest, and the text duty in Article 50(4) is limited to that kind of publication. Marketing and internal material sit outside it.';
    }
    if (brokenAt === 2) {
      return 'The chain breaks at the third criterion, and that is the express exemption. A human genuinely reviewed the text and a named person or organisation holds editorial responsibility for it. That exemption rests on real review — a superficial spellcheck does not count, and the named owner has to be answerable for what the text says.';
    }
    return 'All three criteria hold. The text is AI-generated or substantially AI-drafted, it is published to inform the public on a matter of public interest, and no human has taken genuine editorial responsibility for it. That combination triggers the text disclosure in Article 50(4).';
  }

  if (brokenAt === 0) {
    return 'The chain breaks at the first criterion. The content was not generated or meaningfully altered by AI, and Article 50(4) only reaches synthetic or AI-manipulated material. Nothing further applies.';
  }
  if (brokenAt === 1) {
    return 'The chain breaks at the second criterion. The content does not depict anything that exists or could plausibly exist. A deep fake has to resemble something real, and obviously impossible imagery cannot.';
  }
  if (brokenAt === 2) {
    return 'The chain breaks at the third criterion. There is no appreciable resemblance to a real or plausible subject, so there is nobody and nothing a viewer could be misled about. It is not a deep fake, whatever tool made it.';
  }
  if (brokenAt === 3) {
    return 'The chain breaks at the fourth criterion. A viewer would not take this as an authentic record of something real, and the subject itself is not misrepresented. This is the criterion most likely to change if the content is edited, so re-check it if the material changes.';
  }
  if (verdict === 'attenuated') {
    return 'All four criteria hold, so this is a deep fake and disclosure is required. Because the work is evidently artistic, creative, satirical or fictional and is not driven by a commercial or informative purpose, the disclosure can be presented in a way that does not spoil the work.';
  }
  return 'All four criteria hold: the content is AI-generated or AI-altered, it depicts a real or plausible subject, it appreciably resembles that subject, and a viewer could take it as an authentic record. That makes it a deep fake under Article 50(4). The work is commercial, informative or promotional, so the artistic exception does not apply — being creative in style does not rescue an advert.';
}

function practiceFor(verdict) {
  if (verdict === 'none') {
    return [
      'Nothing to label under Article 50(4).',
      'Keep the record below in case the decision is questioned later.',
      'Re-check if the content changes or you use it in a different context. Whether something reads as an authentic record depends heavily on where it appears.',
    ];
  }
  if (verdict === 'attenuated') {
    return [
      'Disclosure is still required. What changes is where it goes.',
      'Place it in the credits, or alongside the work, in a way that does not interfere with the experience.',
      'It still has to be findable by someone who wants to know. Attenuated is not optional.',
      'If the same material is cut into an advert or a trailer, the exception stops applying and full disclosure returns.',
    ];
  }
  if (verdict === 'text') {
    return [
      'State plainly, at the top of the piece or immediately alongside it, that the text was generated or substantially drafted by AI.',
      'It has to be clear and distinguishable from the text itself, not folded into the body copy.',
      'Machine-readable marking in the file is a separate duty that falls on the provider of the AI system. Yours is the visible one.',
    ];
  }
  return [
    'The disclosure has to be clear, distinguishable from the rest of the content, and visible at first exposure.',
    'For video, one label at the start is not enough if viewers might join partway through. Keep it present, or repeat it.',
    'It has to survive the formats you actually publish in — crops, thumbnails, autoplay previews, reposts.',
    'Deliver it at first exposure, not in a caption someone has to expand.',
  ];
}

/* --------------------------------------------------------------------------
 * Decision record
 * -------------------------------------------------------------------------- */

function answeredRows(path, answers) {
  const qs = questionsFor(path);
  const rows = [];
  qs.forEach((q) => {
    if (answers[q.key] === undefined) return;
    rows.push({ n: q.n, label: q.chain, answer: answers[q.key] ? 'Yes' : 'No' });
  });
  if (path !== 'text' && answers[MODIFIER_QUESTION.key] !== undefined) {
    // Marked "--" rather than 05: it is not a criterion, it only decides how
    // prominent the disclosure has to be.
    rows.push({
      n: '--',
      label: 'Evidently artistic, non-commercial',
      answer: answers[MODIFIER_QUESTION.key] ? 'Yes' : 'No',
    });
  }
  return rows;
}

function buildRecord({ path, answers, result, reference, now }) {
  const rows = answeredRows(path, answers);
  const width = Math.max(...rows.map((r) => r.label.length), 20);
  const stamp = now.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const lines = [
    'ARTICLE 50 CHECK — DECISION RECORD',
    '='.repeat(58),
    '',
    `Date          ${stamp}`,
    `Content type  ${path === 'text' ? 'Text' : 'Image, video or audio'}`,
    `Reference     ${reference.trim() || '—'}`,
    '',
    'CRITERIA  (every one must hold for the duty to attach)',
    ...rows.map((r) => `  ${r.n}  ${r.label.padEnd(width + 2, ' ')}${r.answer}`),
    '',
    'VERDICT',
    `  ${VERDICTS[result.verdict].title}`,
    '',
    'REASONING',
    ...wrap(reasoningFor(path, answers, result), 74).map((l) => `  ${l}`),
    '',
    'WHAT THIS MEANS IN PRACTICE',
    ...practiceFor(result.verdict).flatMap((p) => {
      const [first, ...rest] = wrap(p, 72);
      return [`  - ${first}`, ...rest.map((l) => `    ${l}`)];
    }),
    '',
    'BASIS',
    ...wrap(
      'Article 50(4) of Regulation (EU) 2024/1689 (the AI Act), read with the European Commission’s guidelines on transparency for AI-generated content. Those guidelines are not legally binding. This record is decision support, not legal advice.',
      74,
    ).map((l) => `  ${l}`),
    '',
  ];
  return lines.join('\n');
}

function wrap(text, width) {
  const out = [];
  let line = '';
  text.split(/\s+/).forEach((word) => {
    if (!line.length) {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line += ` ${word}`;
    } else {
      out.push(line);
      line = word;
    }
  });
  if (line.length) out.push(line);
  return out;
}

/* --------------------------------------------------------------------------
 * The chain — the signature element
 *
 * One link per criterion on a single spine. A link that holds fills solid; a
 * link that fails splits in two and the halves pull apart, severing the spine.
 * Nothing below a break carries load, so it goes slack. No colour is used: the
 * accent belongs to the verdict alone.
 * -------------------------------------------------------------------------- */

const SPINE = {
  held: { borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: '#0D1219' },
  pending: { borderLeftWidth: '2px', borderLeftStyle: 'dotted', borderLeftColor: '#98A1AB' },
  slack: { borderLeftWidth: '2px', borderLeftStyle: 'dotted', borderLeftColor: '#CBD2D9' },
};

// The spine below a link carries load only if that link held. A broken link
// passes nothing on, so everything under it hangs slack.
function spineBelow(state) {
  if (state === 'held') return SPINE.held;
  if (state === 'broken' || state === 'slack') return SPINE.slack;
  return SPINE.pending;
}

function spineAbove(state) {
  if (state === 'held' || state === 'broken') return SPINE.held;
  if (state === 'slack') return SPINE.slack;
  return SPINE.pending;
}

const MOTION =
  'transition-transform duration-500 ease-out motion-reduce:transition-none';

// Capsule occupies the full 28x30 viewBox. overflow stays visible so the two
// halves can travel outside it when the link fails.
const TOP_ARC = 'M 5,15 L 5,9 A 9,9 0 0 1 14,0 A 9,9 0 0 1 23,9 L 23,15';
const BOTTOM_ARC = 'M 23,15 L 23,21 A 9,9 0 0 1 14,30 A 9,9 0 0 1 5,21 L 5,15';

function Ring({ state, rotated }) {
  const [apart, setApart] = useState(false);

  useEffect(() => {
    if (state !== 'broken') {
      setApart(false);
      return undefined;
    }
    // Two frames: mount joined, then travel, so the break is something you
    // watch happen rather than something that was already true.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setApart(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [state]);

  const broken = state === 'broken';
  const held = state === 'held';
  const slack = state === 'slack';
  const stroke = held || broken ? '#0D1219' : slack ? '#CBD2D9' : '#98A1AB';
  const dx = apart ? 5 : 0;
  const dy = apart ? 4 : 0;

  return (
    <svg
      width={28}
      height={30}
      viewBox="0 0 28 30"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      style={{ overflow: 'visible', transform: rotated ? 'rotate(-90deg)' : undefined }}
    >
      {broken ? (
        <>
          <g className={MOTION} style={{ transform: `translate(${-dx}px, ${-dy}px)` }}>
            <path d={TOP_ARC} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
          </g>
          <g className={MOTION} style={{ transform: `translate(${dx}px, ${dy}px)` }}>
            <path d={BOTTOM_ARC} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </>
      ) : (
        <rect
          x={5}
          y={0}
          width={18}
          height={30}
          rx={9}
          fill={held ? '#0D1219' : 'none'}
          stroke={held ? 'none' : stroke}
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}

// The spine sections are flex-1, so they stretch to whatever height the row
// needs. A label that wraps to two lines pulls the chain longer instead of
// leaving the spine floating clear of the link below it.
function ChainSegment({ state, first, last }) {
  return (
    <span className="flex w-7 shrink-0 flex-col items-center self-stretch">
      <span className="min-h-3 flex-1" style={first ? undefined : spineAbove(state)} />
      <Ring state={state} />
      <span className="min-h-3 flex-1" style={last ? undefined : spineBelow(state)} />
    </span>
  );
}

function linkStates(path, answers, result) {
  const qs = questionsFor(path);
  return qs.map((q, i) => {
    if (result.brokenAt === i) return 'broken';
    if (result.brokenAt !== null && i > result.brokenAt) return 'slack';
    if (answers[q.key] !== undefined) return 'held';
    return 'pending';
  });
}

function ChainRail({ path, answers, result }) {
  const qs = questionsFor(path);
  const states = linkStates(path, answers, result);
  const cursor = result.cursor;
  const showModifier = path !== 'text' && result.brokenAt === null;
  const modifierAnswered = answers[MODIFIER_QUESTION.key] !== undefined;

  return (
    <div className="text-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">The test</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-2">
        {qs.length} criteria. Every one has to hold.
      </p>

      <ul className="mt-6">
        {qs.map((q, i) => {
          const state = states[i];
          const active = cursor === i;
          return (
            <li key={q.key} className="flex items-stretch gap-3">
              <ChainSegment
                state={state}
                first={i === 0}
                last={i === qs.length - 1 && !showModifier}
              />
              <span className="flex min-h-16 flex-col justify-center py-2">
                <span
                  className={`font-mono text-xs ${
                    state === 'pending' ? 'text-ink-3' : 'text-ink-2'
                  }`}
                >
                  {q.n}
                </span>
                <span
                  className={[
                    'text-sm leading-snug',
                    state === 'broken'
                      ? 'text-ink line-through'
                      : state === 'held' || active
                        ? 'text-ink'
                        : state === 'slack'
                          ? 'text-ink-3'
                          : 'text-ink-3',
                    active ? 'font-medium' : '',
                  ].join(' ')}
                >
                  {q.chain}
                </span>
                {state === 'broken' && (
                  <span className="mt-1 font-mono text-xs uppercase tracking-wider text-ink">
                    Chain broken
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {showModifier && (
        <div className="mt-2 flex gap-3 border-t border-rule pt-4">
          <span className="flex w-7 shrink-0 justify-center pt-2">
            <span
              className={`block h-2 w-2 rounded-full ${
                modifierAnswered ? 'bg-ink' : 'border border-ink-3'
              }`}
            />
          </span>
          <span className="flex flex-col">
            <span className="font-mono text-xs text-ink-2">{MODIFIER_QUESTION.n}</span>
            <span
              className={`text-sm leading-snug ${
                modifierAnswered || cursor === qs.length ? 'text-ink' : 'text-ink-3'
              }`}
            >
              {MODIFIER_QUESTION.chain}
            </span>
            <span className="mt-1 text-xs leading-relaxed text-ink-2">
              Not part of the test. Decides where the disclosure goes.
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function ChainStrip({ path, answers, result }) {
  const qs = questionsFor(path);
  const states = linkStates(path, answers, result);
  const cursor = result.cursor;
  const current = cursor !== null && cursor < qs.length ? qs[cursor] : null;
  const brokenQ = result.brokenAt !== null ? qs[result.brokenAt] : null;

  return (
    <div className="border-b border-rule bg-surface px-5 py-4 lg:hidden">
      <div className="flex items-center justify-center">
        {qs.map((q, i) => {
          const connector = spineBelow(states[i - 1]);
          return (
            <span key={q.key} className="flex items-center">
              {i > 0 && (
                <span
                  className="h-0 w-8"
                  style={{
                    borderTopWidth: connector.borderLeftWidth,
                    borderTopStyle: connector.borderLeftStyle,
                    borderTopColor: connector.borderLeftColor,
                  }}
                />
              )}
              <span className="flex h-8 w-8 items-center justify-center">
                <Ring state={states[i]} rotated />
              </span>
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-center font-mono text-xs uppercase tracking-wider text-ink-2">
        {brokenQ
          ? `Chain broken at ${brokenQ.n} \u00b7 ${brokenQ.chain}`
          : current
            ? `${current.n} \u00b7 ${current.chain}`
            : cursor === qs.length
              ? `${MODIFIER_QUESTION.n} \u00b7 ${MODIFIER_QUESTION.chain}`
              : 'Chain holds'}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Shared controls
 * -------------------------------------------------------------------------- */

const FOCUS =
  'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-ground';

function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-sm bg-ink px-5 py-3 text-sm font-medium text-surface transition-colors duration-150 hover:bg-ink-2 motion-reduce:transition-none ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function QuietButton({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-sm border border-rule bg-surface px-4 py-2.5 text-sm text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink motion-reduce:transition-none ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function AnswerButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-sm border border-rule bg-surface px-5 py-4 text-left transition-colors duration-150 hover:border-ink hover:bg-ground motion-reduce:transition-none ${FOCUS}`}
    >
      <span className="text-base font-medium text-ink">{children}</span>
    </button>
  );
}

/* --------------------------------------------------------------------------
 * Screens
 * -------------------------------------------------------------------------- */

function Intro({ onStart, onLabel }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-2">
        In force 2 August 2026
      </p>
      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        Do you have to label this?
      </h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-2">
        <p>
          From 2 August 2026, whoever publishes AI-generated content in the EU has to
          disclose some of it. Not the agency you hired, not the model provider. You.
        </p>
        <p>
          This works out whether one specific image, video, audio file or piece of text
          is caught, and tells you which criterion decided it. Four criteria, and all
          four have to hold. Break one and there is no obligation.
        </p>
      </div>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onStart}>Check my content</PrimaryButton>
        <QuietButton onClick={onLabel}>Label an image</QuietButton>
      </div>
      <p className="mt-8 font-mono text-xs leading-relaxed text-ink-3">
        Takes about a minute. Nothing you enter leaves your browser.
      </p>
    </div>
  );
}

function PathChoice({ onPick, onBack }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">Step one</p>
      <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-3xl">
        What are you checking?
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-2">
        The rule works differently for the two. Pick one.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick('media')}
          className={`rounded-sm border border-rule bg-surface p-5 text-left transition-colors duration-150 hover:border-ink motion-reduce:transition-none ${FOCUS}`}
        >
          <span className="block text-lg font-medium text-ink">
            Image, video or audio
          </span>
          <span className="mt-2 block text-sm leading-relaxed text-ink-2">
            The deep fake test. Four criteria.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onPick('text')}
          className={`rounded-sm border border-rule bg-surface p-5 text-left transition-colors duration-150 hover:border-ink motion-reduce:transition-none ${FOCUS}`}
        >
          <span className="block text-lg font-medium text-ink">Text</span>
          <span className="mt-2 block text-sm leading-relaxed text-ink-2">
            A narrower rule. Three criteria.
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className={`mt-8 rounded-sm text-sm text-ink-2 underline underline-offset-4 hover:text-ink ${FOCUS}`}
      >
        Back
      </button>
    </div>
  );
}

function QuestionCard({ q, total, onAnswer, onBack, canGoBack }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">
        {q.n === MODIFIER_QUESTION.n ? 'Final question' : `Criterion ${q.n} of ${total}`}
      </p>
      <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-3xl">
        {q.question}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-2">{q.explain}</p>

      <div className="mt-8 space-y-3">
        <AnswerButton onClick={() => onAnswer(true)}>{q.yesLabel}</AnswerButton>
        <AnswerButton onClick={() => onAnswer(false)}>{q.noLabel}</AnswerButton>
      </div>

      <dl className="mt-8 space-y-4 border-t border-rule pt-6">
        <div className="sm:flex sm:gap-5">
          <dt className="font-mono text-xs uppercase tracking-wider text-ink-3 sm:w-14 sm:shrink-0 sm:pt-1">
            Yes
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-2 sm:mt-0">
            {q.yesExample}
          </dd>
        </div>
        <div className="sm:flex sm:gap-5">
          <dt className="font-mono text-xs uppercase tracking-wider text-ink-3 sm:w-14 sm:shrink-0 sm:pt-1">
            No
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-2 sm:mt-0">
            {q.noExample}
          </dd>
        </div>
      </dl>

      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className={`mt-8 rounded-sm text-sm text-ink-2 underline underline-offset-4 hover:text-ink ${FOCUS}`}
        >
          Back
        </button>
      )}
    </div>
  );
}

function DecisionRecord({ record }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    setCopied(false);
    setCopyFailed(false);
  }, [record]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(record);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([record], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `article-50-decision-record-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-12 border-t border-rule pt-10">
      <h2 className="text-xl font-semibold tracking-tight text-ink">Decision record</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
        The answers, the verdict and the reasoning, with today&rsquo;s date. Keep it with
        the asset. If anyone asks later why the content was or was not labelled, this is
        the answer.
      </p>

      <pre
        tabIndex={0}
        role="region"
        aria-label="Decision record"
        className={`mt-6 max-h-80 overflow-auto rounded-sm border border-rule bg-surface p-5 font-mono text-xs leading-relaxed text-ink-2 ${FOCUS}`}
      >
        {record}
      </pre>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={copy}>Copy decision record</PrimaryButton>
        <QuietButton onClick={download}>Download as .txt</QuietButton>
        <span aria-live="polite" className="font-mono text-xs text-ink-2">
          {copied ? 'Copied.' : copyFailed ? 'Copy blocked. Use download instead.' : ''}
        </span>
      </div>
    </section>
  );
}

function EmailCapture({ verdict }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!WEBHOOK_URL) {
      setState('noEndpoint');
      return;
    }
    setState('sending');
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), verdict, date: new Date().toISOString() }),
      });
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <section className="mt-12 border-t border-rule pt-10">
      <h2 className="text-lg font-semibold tracking-tight text-ink">
        One email when the rule takes effect
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
        On 2 August 2026, the current guidance and anything that has changed since. One
        email, then nothing.
      </p>
      <form onSubmit={submit} className="mt-5 flex flex-wrap items-center gap-3">
        <label htmlFor="a50-email" className="sr-only">
          Email address
        </label>
        <input
          id="a50-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`w-full max-w-xs rounded-sm border border-rule bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 ${FOCUS}`}
        />
        <PrimaryButton
          type="submit"
          disabled={state === 'sending'}
          className="disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending' : 'Send me the guidance'}
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className={`rounded-sm text-sm text-ink-2 underline underline-offset-4 hover:text-ink ${FOCUS}`}
        >
          No thanks
        </button>
      </form>
      <p aria-live="polite" className="mt-3 font-mono text-xs text-ink-2">
        {state === 'sent' && 'Saved. One email, on 2 August 2026.'}
        {state === 'failed' && 'That did not go through. Try again later.'}
        {state === 'noEndpoint' &&
          'No endpoint is configured on this build, so nothing was sent and nothing was stored.'}
      </p>
    </section>
  );
}

function Result({ path, answers, result, onRestart, onLabel }) {
  const [reference, setReference] = useState('');
  const [now] = useState(() => new Date());
  const verdict = VERDICTS[result.verdict];
  const reasoning = reasoningFor(path, answers, result);
  const practice = practiceFor(result.verdict);
  const record = useMemo(
    () => buildRecord({ path, answers, result, reference, now }),
    [path, answers, result, reference, now],
  );
  const needsLabel = result.verdict === 'full' || result.verdict === 'attenuated';

  return (
    <div>
      {/* The verdict is the only thing on the page allowed to use the accent. */}
      <section className="border border-accent bg-accent-tint p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          {verdict.kicker}
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-accent sm:text-4xl">
          {verdict.title}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink">{reasoning}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          What this means in practice
        </h2>
        <ul className="mt-5 space-y-3">
          {practice.map((p) => (
            <li key={p} className="flex gap-3 text-base leading-relaxed text-ink-2">
              <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-ink-3" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <label
          htmlFor="a50-ref"
          className="font-mono text-xs uppercase tracking-widest text-ink-3"
        >
          Reference (optional)
        </label>
        <input
          id="a50-ref"
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Asset name, job number, campaign"
          className={`mt-3 w-full max-w-md rounded-sm border border-rule bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 ${FOCUS}`}
        />
        <p className="mt-2 text-xs leading-relaxed text-ink-2">
          Written into the record below so it can be filed against the job.
        </p>
      </section>

      <DecisionRecord record={record} />

      {needsLabel && (
        <section className="mt-12 border-t border-rule pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Apply a label</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
            Drop the image in, pick a badge, put it where it will be seen. The file stays
            in your browser.
          </p>
          <QuietButton onClick={onLabel} className="mt-5">
            Label an image
          </QuietButton>
        </section>
      )}

      <EmailCapture verdict={result.verdict} />

      <div className="mt-12 border-t border-rule pt-8">
        <QuietButton onClick={onRestart}>Check something else</QuietButton>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Label tool
 *
 * Canvas only. The image is read with createObjectURL, drawn locally and
 * exported with toBlob. It is never sent anywhere.
 * -------------------------------------------------------------------------- */

function badgeWidthFor(naturalWidth) {
  return Math.max(140, Math.min(520, Math.round(naturalWidth * 0.24)));
}

function LabelTool({ onBack }) {
  const [file, setFile] = useState(null);
  const [src, setSrc] = useState('');
  const [dims, setDims] = useState(null);
  const [badgeKey, setBadgeKey] = useState('basic');
  const [pos, setPos] = useState({ x: 0.03, y: 0.85 });
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const frameRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const badge = BADGE_ASSETS[badgeKey];

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const geometry = useMemo(() => {
    if (!dims) return null;
    const w = badgeWidthFor(dims.w);
    const h = (w / badge.width) * BADGE_HEIGHT;
    return { w, h, rw: w / dims.w, rh: h / dims.h };
  }, [dims, badge.width]);

  const clampPos = useCallback(
    (p) => {
      if (!geometry) return p;
      return {
        x: Math.min(Math.max(p.x, 0), 1 - geometry.rw),
        y: Math.min(Math.max(p.y, 0), 1 - geometry.rh),
      };
    },
    [geometry],
  );

  const accept = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('That is not an image file.');
      return;
    }
    setError('');
    if (src) URL.revokeObjectURL(src);
    const url = URL.createObjectURL(f);
    const probe = new Image();
    probe.onload = () => {
      setDims({ w: probe.naturalWidth, h: probe.naturalHeight });
      setPos({ x: 0.03, y: 0.85 });
    };
    probe.onerror = () => setError('That image could not be read.');
    probe.src = url;
    setFile(f);
    setSrc(url);
  };

  const startDrag = (e) => {
    if (!frameRef.current || !geometry) return;
    const rect = frameRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: (e.clientX - rect.left) / rect.width - pos.x,
      y: (e.clientY - rect.top) / rect.height - pos.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveDrag = (e) => {
    if (!dragging || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    setPos(
      clampPos({
        x: (e.clientX - rect.left) / rect.width - dragOffset.current.x,
        y: (e.clientY - rect.top) / rect.height - dragOffset.current.y,
      }),
    );
  };

  const endDrag = (e) => {
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const nudge = (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const map = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    setPos((p) => clampPos({ x: p.x + d.x, y: p.y + d.y }));
  };

  const toCorner = (corner) => {
    if (!geometry || !dims) return;
    const mx = 0.03;
    const my = (0.03 * dims.w) / dims.h;
    const left = mx;
    const right = 1 - geometry.rw - mx;
    const top = my;
    const bottom = 1 - geometry.rh - my;
    const map = {
      tl: { x: left, y: top },
      tr: { x: right, y: top },
      bl: { x: left, y: bottom },
      br: { x: right, y: bottom },
    };
    setPos(clampPos(map[corner]));
  };

  const download = async () => {
    if (!src || !dims || !geometry) return;
    setError('');
    try {
      const [photo, mark] = await Promise.all([
        loadImage(src),
        loadImage(badgeDataUrl(badge)),
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(photo, 0, 0, dims.w, dims.h);
      ctx.drawImage(mark, pos.x * dims.w, pos.y * dims.h, geometry.w, geometry.h);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) {
        setError('The image could not be rendered.');
        return;
      }
      const base = (file?.name || 'image').replace(/\.[^.]+$/, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}-labelled.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('The image could not be rendered.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-3">Label tool</p>
      <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-ink sm:text-3xl">
        Put a badge on an image
      </h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-2">
        Placeholder badges until the Commission publishes official marks. Put the badge
        where a viewer will see it at first exposure, not tucked into a corner it will be
        cropped out of.
      </p>

      {!src && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={`mt-8 rounded-sm border border-dashed p-10 text-center transition-colors duration-150 motion-reduce:transition-none ${
            over ? 'border-ink bg-surface' : 'border-rule bg-surface'
          }`}
        >
          <p className="text-base text-ink">Drop an image here</p>
          <label
            className={`mt-4 inline-flex cursor-pointer items-center justify-center rounded-sm border border-rule bg-surface px-4 py-2.5 text-sm text-ink-2 hover:border-ink-3 hover:text-ink ${FOCUS}`}
          >
            Choose a file
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => accept(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      <p className="mt-4 font-mono text-xs leading-relaxed text-ink-2">
        Everything happens on a canvas in your browser. The file is never uploaded, so
        there is nothing to store and nothing to leak.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-ink">
          {error}
        </p>
      )}

      {src && dims && geometry && (
        <>
          <fieldset className="mt-8">
            <legend className="font-mono text-xs uppercase tracking-widest text-ink-3">
              Badge
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.values(BADGE_ASSETS).map((b) => (
                <label
                  key={b.key}
                  className={`flex cursor-pointer flex-col gap-3 rounded-sm border p-4 transition-colors duration-150 motion-reduce:transition-none ${
                    b.key === badgeKey ? 'border-ink bg-surface' : 'border-rule bg-surface hover:border-ink-3'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="a50-badge"
                      value={b.key}
                      checked={b.key === badgeKey}
                      onChange={() => setBadgeKey(b.key)}
                      className={`h-4 w-4 accent-ink ${FOCUS}`}
                    />
                    <span className="text-sm font-medium text-ink">{b.name}</span>
                  </span>
                  <img
                    src={badgeDataUrl(b)}
                    alt=""
                    className="h-6 w-auto max-w-full self-start"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div
            ref={frameRef}
            className="relative mt-8 select-none overflow-hidden border border-rule bg-surface"
          >
            <img src={src} alt="" className="block w-full" draggable={false} />
            <button
              type="button"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={nudge}
              aria-label="Badge position. Drag it, or use the arrow keys to move it."
              className={`absolute touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${FOCUS}`}
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                width: `${geometry.rw * 100}%`,
              }}
            >
              <img
                src={badgeDataUrl(badge)}
                alt=""
                className="pointer-events-none block w-full"
                draggable={false}
              />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-3">
              Snap
            </span>
            {[
              ['tl', 'Top left'],
              ['tr', 'Top right'],
              ['bl', 'Bottom left'],
              ['br', 'Bottom right'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => toCorner(k)}
                className={`rounded-sm border border-rule bg-surface px-3 py-1.5 text-xs text-ink-2 hover:border-ink-3 hover:text-ink ${FOCUS}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={download}>Download labelled image</PrimaryButton>
            <QuietButton
              onClick={() => {
                if (src) URL.revokeObjectURL(src);
                setSrc('');
                setFile(null);
                setDims(null);
                setError('');
              }}
            >
              Use a different image
            </QuietButton>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onBack}
        className={`mt-10 rounded-sm text-sm text-ink-2 underline underline-offset-4 hover:text-ink ${FOCUS}`}
      >
        Back
      </button>
    </div>
  );
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/* --------------------------------------------------------------------------
 * Root
 * -------------------------------------------------------------------------- */

export default function Article50Check() {
  const [stage, setStage] = useState('intro');
  const [path, setPath] = useState(null);
  const [answers, setAnswers] = useState({});
  const [order, setOrder] = useState([]);

  const result = useMemo(
    () => (path ? evaluate(path, answers) : { done: false, cursor: 0, brokenAt: null, verdict: null }),
    [path, answers],
  );

  const qs = path ? questionsFor(path) : [];
  const currentQuestion =
    !result.done && result.cursor !== null
      ? result.cursor < qs.length
        ? qs[result.cursor]
        : MODIFIER_QUESTION
      : null;

  const answer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setOrder((prev) => [...prev, key]);
  };

  const back = () => {
    if (!order.length) {
      setPath(null);
      setStage('path');
      return;
    }
    const last = order[order.length - 1];
    setOrder((prev) => prev.slice(0, -1));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
  };

  const restart = () => {
    setAnswers({});
    setOrder([]);
    setPath(null);
    setStage('intro');
  };

  // Returning from the label tool must not throw away a check in progress.
  const [returnTo, setReturnTo] = useState('intro');
  const openLabel = () => {
    setReturnTo(stage === 'label' ? returnTo : stage);
    setStage('label');
  };
  const goCheck = () => setStage(stage === 'label' ? returnTo : stage);

  const inTriage = stage === 'triage' && path;

  return (
    <div className="flex min-h-screen flex-col bg-ground font-sans text-ink antialiased">
      <a
        href="#a50-main"
        className={`sr-only rounded-sm bg-ink px-4 py-2 text-sm text-surface focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 ${FOCUS}`}
      >
        Skip to content
      </a>

      <header className="shrink-0 border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <button
            type="button"
            onClick={goCheck}
            className={`rounded-sm text-left ${FOCUS}`}
          >
            <span className="block text-sm font-semibold tracking-tight text-ink">
              Article 50 Check
            </span>
            <span className="mt-0.5 block font-mono text-xs uppercase tracking-widest text-ink-3">
              EU AI Act &middot; Art. 50(4)
            </span>
          </button>
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={goCheck}
              className={`rounded-sm px-3 py-2 text-sm ${
                stage === 'label' ? 'text-ink-2 hover:text-ink' : 'text-ink'
              } ${FOCUS}`}
            >
              Check
            </button>
            <button
              type="button"
              onClick={openLabel}
              className={`rounded-sm px-3 py-2 text-sm ${
                stage === 'label' ? 'text-ink' : 'text-ink-2 hover:text-ink'
              } ${FOCUS}`}
            >
              Label
            </button>
          </nav>
        </div>
      </header>

      <main id="a50-main" className="flex-1">
        {stage === 'intro' && (
          <Intro onStart={() => setStage('path')} onLabel={openLabel} />
        )}

        {stage === 'path' && (
          <PathChoice
            onPick={(p) => {
              setPath(p);
              setAnswers({});
              setOrder([]);
              setStage('triage');
            }}
            onBack={() => setStage('intro')}
          />
        )}

        {stage === 'label' && <LabelTool onBack={goCheck} />}

        {inTriage && (
          <>
            <ChainStrip path={path} answers={answers} result={result} />
            <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
              <div className="lg:flex lg:gap-14">
                <aside className="hidden w-56 shrink-0 lg:block">
                  <div className="sticky top-10">
                    <ChainRail path={path} answers={answers} result={result} />
                  </div>
                </aside>
                <div className="min-w-0 flex-1 lg:max-w-2xl">
                  <p className="sr-only" aria-live="polite">
                    {result.brokenAt !== null
                      ? `Chain broken at criterion ${qs[result.brokenAt].n}. ${VERDICTS[result.verdict].title}.`
                      : result.done
                        ? VERDICTS[result.verdict].title
                        : ''}
                  </p>
                  {currentQuestion ? (
                    <QuestionCard
                      q={currentQuestion}
                      total={qs.length}
                      onAnswer={(v) => answer(currentQuestion.key, v)}
                      onBack={back}
                      canGoBack
                    />
                  ) : (
                    <Result
                      path={path}
                      answers={answers}
                      result={result}
                      onRestart={restart}
                      onLabel={openLabel}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-rule bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-8">
          <p className="max-w-3xl text-xs leading-relaxed text-ink-2">
            Guidance based on the European Commission&rsquo;s guidelines on transparency
            for AI-generated content under Article 50 of the AI Act. Those guidelines are
            not legally binding, and this is not legal advice. It is decision support and
            a record of how you decided.
          </p>
        </div>
      </footer>
    </div>
  );
}
