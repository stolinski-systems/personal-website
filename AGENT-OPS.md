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

## The KPI pipeline — the one rule specific to this repo

`data/kpis.json` is the canonical data for the stats section ("Flight hours
logged", "University GPA", …). The block in `index.html` between
`<!-- kpis:begin … -->` and `<!-- kpis:end -->` is **generated** from it by
`node tools/apply-kpis.js`.

- To change a KPI: edit `data/kpis.json`, run `node tools/apply-kpis.js`,
  commit both files together.
- Never hand-edit the generated block. The gate compares it byte-for-byte
  against what the renderer would produce and goes red on a mismatch.
- The Office's KPI desk dispatches missions that do exactly this; those
  missions must change nothing else in the repo.

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
