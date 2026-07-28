// The record: reasoning, practical guidance, and the plain-text decision record.
//
// All of the legal prose lives here rather than in the component, so a lawyer
// reviewing wording never has to read JSX. Pure functions, no React.
import { CRITERIA_VERSION, CRITERIA_DATE, VERDICTS, questionsFor, MODIFIER_QUESTION } from './decision-tree.js';
import { wrap } from './wrap.js';

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
  // The zone is part of the record. A bare local time is ambiguous on a
  // document whose whole purpose is answering "when did you decide this".
  const stamp = now.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const lines = [
    'ARTICLE 50 CHECK — DECISION RECORD',
    '='.repeat(58),
    '',
    `Date          ${stamp}`,
    `Content type  ${path === 'text' ? 'Text' : 'Image, video or audio'}`,
    `Criteria      ${CRITERIA_VERSION} (${CRITERIA_DATE})`,
    ...referenceLines(reference),
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
      'Deep fake definition: Article 3(60) of Regulation (EU) 2024/1689 (the AI ' +
        'Act). Disclosure duty: Article 50(4). Manner and timing of disclosure: ' +
        'Article 50(5). Read with the European Commission guidelines on ' +
        'transparency of AI-generated content. Those guidelines are not legally ' +
        'binding, and this record is decision support, not legal advice.',
      74,
    ).map((l) => `  ${l}`),
    '',
    `  Criteria set ${CRITERIA_VERSION}, as at ${CRITERIA_DATE}. Article 3(60) states three`,
    '  cumulative elements; criteria 01 and 02-03 below split the second of them',
    '  into two questions so it can be answered one step at a time. Criterion 04',
    '  covers a product shown as better than it is, which is our reading rather',
    '  than a case the guidelines address directly.',
    '',
  ];
  return lines.join('\n');
}

function referenceLines(reference) {
  const value = reference.trim();
  if (!value) return ['Reference     —'];
  // Wrapped, not truncated: the reference is the user's own filing key and
  // losing the tail of it would make the record harder to match to the job.
  const [first, ...rest] = wrap(value, 64);
  return [`Reference     ${first}`, ...rest.map((l) => `              ${l}`)];
}

export { reasoningFor, practiceFor, answeredRows, buildRecord, referenceLines };
