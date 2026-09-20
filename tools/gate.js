/**
 * gate.js — this repo's test gate (the command AGENT-OPS.md and the
 * secgen registry name).
 *
 * A push to main IS the deploy: GitHub Pages rebuilds patrickstolinski.com
 * from it. There is no framework and no unit suite here, so the gate proves
 * the things that can actually break unattended:
 *
 *   1. Every data/ file parses and satisfies its schema — including the two
 *      integrity rules WordPress never had: every image reference names a
 *      file that exists in img/, and every internal link points at a journal
 *      post id that exists.
 *   2. Every generated surface is IN SYNC with its data, byte for byte:
 *      the five marked blocks in index.html, the whole of journal.html,
 *      feed.xml, and the data/media.json manifest. An edit to the data that
 *      skipped `node tools/apply-content.js`, or a hand-edit to generated
 *      markup, goes red here instead of shipping a page that contradicts
 *      its data.
 *   3. Every script in the repo parses (`node --check`).
 *
 * Exit 0 green, exit 1 red with every problem listed. Run from anywhere:
 * paths resolve relative to this file.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const render = require("./render.js");
const kpis = require("./apply-kpis.js");
const { loadAll } = require("./apply-content.js");

const ROOT = path.join(__dirname, "..");

function main() {
  const { failures, sections, posts, kpiData, imageFiles } = loadAll();

  // 2. Generated surfaces in sync — only meaningful once the data is valid.
  if (failures.length === 0) {
    const html = fs.readFileSync(kpis.INDEX_PATH, "utf8");
    try {
      let expected = kpis.applyToHtml(html, kpiData);
      for (const section of sections) {
        expected = render.spliceBlock(expected, section.marker, section.render(section.data));
      }
      if (expected !== html) {
        failures.push("index.html's generated blocks do not match data/ — run `node tools/apply-content.js` and commit the result");
      }
    } catch (error) {
      failures.push(`index.html: ${error.message}`);
    }

    const inSync = (file, content) => {
      const full = path.join(ROOT, file);
      if (!fs.existsSync(full)) {
        failures.push(`${file} is missing — run \`node tools/apply-content.js\``);
      } else if (fs.readFileSync(full, "utf8") !== content) {
        failures.push(`${file} does not match data/ — run \`node tools/apply-content.js\` and commit the result`);
      }
    };
    inSync("journal.html", render.renderJournalHtml(posts));
    inSync("feed.xml", render.renderFeedXml(posts));
    inSync("data/media.json", render.renderMediaJson(imageFiles));
  }

  // 3. Every script parses. `node --check` is a parse, not a run.
  for (const file of ["script.js", "tools/apply-kpis.js", "tools/apply-content.js", "tools/render.js", "tools/gate.js"]) {
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
  console.log("Gate green: data valid, index.html/journal.html/feed.xml/media.json in sync, scripts parse.");
}

main();
