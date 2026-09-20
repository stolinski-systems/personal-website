/**
 * apply-kpis.js — regenerate index.html's stats section from data/kpis.json.
 *
 * data/kpis.json is the canonical KPI data for this site. The stats markup in
 * index.html between the `<!-- kpis:begin -->` / `<!-- kpis:end -->` markers
 * is GENERATED — never hand-edit it. To change a KPI: edit data/kpis.json,
 * run `node tools/apply-kpis.js`, then `node tools/gate.js` before pushing.
 *
 * Why a generator for five divs: the Secretary General's Office has a KPI
 * page whose Save dispatches a mission that rewrites kpis.json and runs this
 * script. A deterministic renderer is what lets that mission (and the gate)
 * prove the HTML matches the data byte for byte, instead of hoping an edit
 * to hand-written markup landed cleanly.
 *
 * Plain CommonJS, no dependencies — this repo has no package.json and needs
 * none; GitHub Pages serves it as-is.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const KPIS_PATH = path.join(ROOT, "data", "kpis.json");
const INDEX_PATH = path.join(ROOT, "index.html");

const BEGIN_MARKER = "<!-- kpis:begin (generated from data/kpis.json — run `node tools/apply-kpis.js`; do not hand-edit) -->";
const END_MARKER = "<!-- kpis:end -->";

/** Caps mirrored by the Office's KPI form — keep the two in step. */
const MAX_KPIS = 12;
const MAX_VALUE_CHARS = 16;
const MAX_SUFFIX_CHARS = 4;
const MAX_LABEL_CHARS = 80;

const ID_SLUG = /^[a-z0-9][a-z0-9-]*$/;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Validate the parsed kpis.json shape. Returns a list of problems, empty when
 * the data is good — the gate prints every problem rather than the first.
 */
function kpiProblems(data) {
  const problems = [];
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return ["kpis.json must be an object with a \"kpis\" array"];
  }
  const kpis = data.kpis;
  if (!Array.isArray(kpis)) return ["kpis.json must have a \"kpis\" array"];
  if (kpis.length === 0) problems.push("\"kpis\" must not be empty");
  if (kpis.length > MAX_KPIS) problems.push(`"kpis" holds ${kpis.length} entries; the cap is ${MAX_KPIS}`);

  const seen = new Set();
  kpis.forEach((kpi, index) => {
    const at = `kpis[${index}]`;
    if (kpi === null || typeof kpi !== "object") {
      problems.push(`${at} must be an object`);
      return;
    }
    if (typeof kpi.id !== "string" || !ID_SLUG.test(kpi.id)) {
      problems.push(`${at}.id must be a lowercase slug`);
    } else if (seen.has(kpi.id)) {
      problems.push(`${at}.id "${kpi.id}" appears twice`);
    } else {
      seen.add(kpi.id);
    }
    if (typeof kpi.value !== "string" || kpi.value.trim() === "" || kpi.value.length > MAX_VALUE_CHARS) {
      problems.push(`${at}.value must be a non-empty string of at most ${MAX_VALUE_CHARS} characters`);
    }
    if (kpi.suffix !== undefined && (typeof kpi.suffix !== "string" || kpi.suffix === "" || kpi.suffix.length > MAX_SUFFIX_CHARS)) {
      problems.push(`${at}.suffix, when present, must be a non-empty string of at most ${MAX_SUFFIX_CHARS} characters`);
    }
    if (typeof kpi.label !== "string" || kpi.label.trim() === "" || kpi.label.length > MAX_LABEL_CHARS) {
      problems.push(`${at}.label must be a non-empty string of at most ${MAX_LABEL_CHARS} characters`);
    }
    const known = new Set(["id", "value", "suffix", "label"]);
    for (const key of Object.keys(kpi)) {
      if (!known.has(key)) problems.push(`${at} has an unknown field "${key}"`);
    }
  });
  return problems;
}

/** Render the full generated block, markers included, matching the site's
 *  existing two-space indentation so the diff around it stays quiet. */
function renderKpiBlock(data) {
  const lines = [BEGIN_MARKER, '  <section class="stats">'];
  for (const kpi of data.kpis) {
    const suffix = kpi.suffix ? `<span>${escapeHtml(kpi.suffix)}</span>` : "";
    lines.push("    <div>");
    lines.push(`      <div class="stat-value">${escapeHtml(kpi.value)}${suffix}</div>`);
    lines.push(`      <div class="stat-label">${escapeHtml(kpi.label)}</div>`);
    lines.push("    </div>");
  }
  lines.push("  </section>");
  lines.push(`  ${END_MARKER}`);
  return lines.join("\n");
}

function readKpis() {
  const raw = fs.readFileSync(KPIS_PATH, "utf8");
  return JSON.parse(raw);
}

/** Replace the marked block in an index.html string. Throws with a plain
 *  sentence when the markers are missing or doubled — a marker mistake must
 *  never become a silently unchanged page. */
function applyToHtml(html, data) {
  const begin = html.indexOf(BEGIN_MARKER);
  if (begin === -1) throw new Error(`index.html is missing the "${BEGIN_MARKER.slice(0, 20)}…" marker`);
  if (html.indexOf(BEGIN_MARKER, begin + 1) !== -1) throw new Error("index.html has two kpis:begin markers");
  const endIndex = html.indexOf(END_MARKER, begin);
  if (endIndex === -1) throw new Error("index.html is missing the kpis:end marker after kpis:begin");
  const before = html.slice(0, begin);
  const after = html.slice(endIndex + END_MARKER.length);
  return before + renderKpiBlock(data) + after;
}

function main() {
  const data = readKpis();
  const problems = kpiProblems(data);
  if (problems.length > 0) {
    console.error("data/kpis.json is not valid:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const next = applyToHtml(html, data);
  if (next === html) {
    console.log("index.html already matches data/kpis.json — nothing to do.");
    return;
  }
  fs.writeFileSync(INDEX_PATH, next);
  console.log(`index.html regenerated from data/kpis.json (${data.kpis.length} KPIs).`);
}

module.exports = {
  BEGIN_MARKER,
  END_MARKER,
  MAX_KPIS,
  MAX_VALUE_CHARS,
  MAX_SUFFIX_CHARS,
  MAX_LABEL_CHARS,
  kpiProblems,
  renderKpiBlock,
  applyToHtml,
  readKpis,
  KPIS_PATH,
  INDEX_PATH,
};

if (require.main === module) main();
