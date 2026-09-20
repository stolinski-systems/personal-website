/**
 * gate.js — this repo's test gate (the command AGENT-OPS.md names).
 *
 * A push to main IS the deploy: GitHub Pages rebuilds patrickstolinski.com
 * from it. There is no framework and no unit suite here, so the gate proves
 * the three things that can actually break unattended:
 *
 *   1. data/kpis.json parses and satisfies the schema apply-kpis.js defines.
 *   2. index.html's generated KPI block is IN SYNC with data/kpis.json —
 *      byte for byte what apply-kpis.js would render. An edit to the data
 *      that skipped the apply step, or a hand-edit to the generated block,
 *      goes red here instead of shipping a page that contradicts its data.
 *   3. script.js and this repo's own tools parse (`node --check`).
 *
 * Exit 0 green, exit 1 red with every problem listed. Run from anywhere:
 * paths resolve relative to this file.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  kpiProblems,
  renderKpiBlock,
  applyToHtml,
  readKpis,
  INDEX_PATH,
} = require("./apply-kpis.js");

const ROOT = path.join(__dirname, "..");

function main() {
  const failures = [];

  // 1. kpis.json parses and is valid.
  let data = null;
  try {
    data = readKpis();
  } catch (error) {
    failures.push(`data/kpis.json did not parse: ${error.message}`);
  }
  if (data !== null) {
    for (const problem of kpiProblems(data)) failures.push(`data/kpis.json: ${problem}`);
  }

  // 2. index.html's generated block matches the data exactly.
  if (data !== null && failures.length === 0) {
    const html = fs.readFileSync(INDEX_PATH, "utf8");
    try {
      const applied = applyToHtml(html, data);
      if (applied !== html) {
        failures.push(
          "index.html's KPI block does not match data/kpis.json — run `node tools/apply-kpis.js` and commit the result",
        );
      }
      // renderKpiBlock is what applyToHtml splices in; calling it here keeps
      // the "renderer output appears verbatim" property exercised even when
      // the block already matches.
      renderKpiBlock(data);
    } catch (error) {
      failures.push(`index.html: ${error.message}`);
    }
  }

  // 3. Every script parses. `node --check` is a parse, not a run — script.js
  // is browser code and must never execute here.
  for (const file of ["script.js", "tools/apply-kpis.js", "tools/gate.js"]) {
    const result = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
    if (result.status !== 0) {
      failures.push(`${file} does not parse: ${(result.stderr || "").trim()}`);
    }
  }

  if (failures.length > 0) {
    console.error("GATE RED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("Gate green: kpis.json valid, index.html in sync, scripts parse.");
}

main();
