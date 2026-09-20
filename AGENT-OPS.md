# AGENT-OPS.md — personal-website

Guardrails for missions that target this repo (Secretary General `DESIGN §3.2`).
A mission reads this file before touching anything.

## What this repo is

Patrick Stolinski's personal site, **patrickstolinski.com** — a static
GitHub Pages site (plain HTML/CSS/JS, no framework, no package.json, no build
step). **A push to `main` IS the deploy**: GitHub Pages rebuilds and serves it
within a couple of minutes. There is no production host pulling a branch and
no revert timer beyond git itself — keep one commit per mission so the
Office's one-tap revert means something.

## The content pipeline — the one rule specific to this repo

`data/` is the canonical content for every generated surface (the site's
mini-CMS, edited from the Secretary General's Office):

- `data/kpis.json` → the stats strip (marked block in `index.html`)
- `data/work.json` → the "BY DESIGN: THE WORK" tiles (marked block)
- `data/highlights.json` → the "RECENT HIGHLIGHTS" cards (marked block)
- `data/flight-log.json` → the flight-log timeline (marked block)
- `data/gallery.json` → the "FROM THE FIELD" grid (marked block)
- `data/posts.json` → **all of `journal.html`** plus `feed.xml`
- `data/media.json` → GENERATED manifest of `img/` (never hand-edited)

To change content: edit the data file, run `node tools/apply-content.js`
(regenerates everything that follows from data — `tools/apply-kpis.js`
remains the KPI-only subset), and commit the data with the regenerated
files together.

- Never hand-edit a generated block, `journal.html`, `feed.xml`, or
  `data/media.json`. The gate re-derives all of them and compares
  byte-for-byte; a mismatch is red.
- Validation is part of the pipeline: every image reference must exist in
  `img/`, every internal link must point at a real journal post id, and a
  save that breaks either goes red instead of live.
- A journal post body is the small markdown dialect documented at the top
  of `tools/render.js` (paragraphs, `### headings`, `**bold**`,
  `[text](https://…)` links, image lines that render as an inline photo or
  a photo grid). Posts with `"draft": true` stay in the data and off the
  internet.
- The Office's Personal Website desk dispatches missions that do exactly
  this; those missions must change nothing else in the repo. A media-upload
  mission additionally copies its attached file from `.secgen/attachments/`
  into `img/` before running the apply script.
- Hand-authored and NOT part of the pipeline: the hero, about, brands,
  PROTO band, and contact sections of `index.html`, plus `styles.css` and
  `script.js` — ordinary edits there go through the normal mission lanes.

## Test gate

From the repo root:

```
node tools/gate.js
```

Green means: `data/kpis.json` parses and satisfies the schema, the generated
KPI block in `index.html` is in sync with it, and every script in the repo
parses (`node --check`). Red halts the mission — report the output verbatim,
never weaken the gate to pass it. There is no unit suite beyond this; that is
an honest description of a static site, not a gap to paper over with invented
commands.

## Guardrail paths

- **`AGENT-OPS.md`** — this file. A guardrail an agent can widen by itself is
  not a guardrail.
- **`CNAME`** — the custom-domain binding. A wrong edit here takes
  patrickstolinski.com off the internet until DNS/Pages are reconciled by
  hand; nothing in this repo can revert the outage window.

## Rules that bind every mission here

1. The test gate never bends. `node tools/gate.js` green before any push.
2. Push only to `main`, never force-push, one commit per mission where
   practical.
3. This is a public website: no secrets, tokens, or private data in any file —
   everything committed here is served to the internet.
4. Media files (`img/`, `drone-footage.mp4`) are Patrick's own content; a
   mission may reference them but never deletes or replaces them unless the
   request names the file.
5. Report honestly: a mission that half-finished says so.
