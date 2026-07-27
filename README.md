# Article 50 Check

A free tool for people who publish AI-generated content in the EU. From 2 August 2026,
whoever publishes the content has to disclose certain AI-generated material under
Article 50(4) of the EU AI Act. This answers one question — do I have to label this, and
why — then lets you apply a label and keep a record of the decision.

```
npm install
npm run dev
```

## What is where

| Path | What it is |
| --- | --- |
| `src/Article50Check.jsx` | The whole app. One self-contained React component. |
| `tailwind.config.js` | The palette and typefaces. |
| `verify.mjs` | Optional Playwright check: every leaf of the decision tree, step focus, revisiting an answer, badge scaling, plus overflow, focus-ring, heading-order and contrast sweeps. |

Everything else is an unmodified Vite host so the component can run.

## The two things you will want to change

Both sit at the top of `src/Article50Check.jsx`, marked with banner comments:

- **`WEBHOOK_URL`** — empty. The email field on the result screen makes no network
  request while it is empty, and says so on screen. Point it at a form endpoint and it
  starts posting `{ email, verdict, date }`.
- **`BADGE_ASSETS` / `badgeSvg()`** — placeholder disclosure badges. The Commission has
  not published official marks yet. Replace the SVG and the per-badge `width`, and the
  label tool picks up the new geometry on its own.

## Design

"Drafting film": a cool light ground, near-black blue ink, monospace for anything
machine-ish (criterion numbers, dates, the record itself).

| Token | Hex | Use |
| --- | --- | --- |
| `ground` | `#E8ECF0` | page |
| `surface` | `#FFFFFF` | panels |
| `ink` | `#0D1219` | primary type, links that hold |
| `ink-2` | `#59636E` | explanations, examples |
| `ink-3` | `#98A1AB` | untested links, metadata |
| `rule` | `#CBD2D9` | hairlines |
| `accent` | `#2438CE` | verdicts, and nothing else |
| `accent-tint` | `#E7E9FB` | verdict panel |

The accent is deliberately neutral in meaning. It marks *this is the answer*, so "no
disclosure required" and "disclosure required" carry the same weight — the tool is not
trying to make you feel one way about the result.

The signature element is the chain. Four criteria on one spine, all of which have to
hold. A link that holds fills solid; a link that fails splits in two and the halves pull
apart, severing the spine, and everything below it hangs slack. No colour does that work,
which is what keeps the accent free for the verdict.

The chain is also the navigation. Any criterion you have already answered is a button
back into that question — everything downstream is discarded, because it was decided on
an answer that is about to change.

## Constraints it is built under

- No backend, no accounts, no database, no `localStorage` or `sessionStorage`. All state
  is React state and is gone when the tab closes.
- No external API calls. The triage is a pure decision tree in `evaluate()`, not a model
  call.
- No AI detection. The tool never claims to tell whether something was made by AI. It
  asks.
- The label tool composites on a `<canvas>` in the browser. The image is never uploaded.

## Printing

The result screen is print-styled. The chrome, the email field and the buttons drop
away; what is left is the verdict, the reasoning, the full decision record and the
disclaimer — a one-piece document you can print or save as PDF and file against the job.

## What it does not claim

This is decision support and a record, not compliance and not legal advice. It is based
on the European Commission's guidelines on transparency for AI-generated content, and
those guidelines are not legally binding. That line is permanent in the footer.
