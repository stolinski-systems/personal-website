/**
 * apply-content.js — regenerate every generated surface from data/.
 *
 * One command, idempotent, safe to run after editing ANY data file:
 *
 *   node tools/apply-content.js
 *
 * It validates all the data first (all problems printed, exit 1, nothing
 * written on a red), then writes:
 *
 *   index.html    the five marked blocks (stats via apply-kpis.js's own
 *                 renderer — one renderer per block, ever)
 *   journal.html  the whole file, from data/posts.json
 *   feed.xml      RSS, same data
 *   data/media.json  the img/ manifest the Office's media picker reads
 *
 * `tools/gate.js` re-derives all of this and compares byte-for-byte, so an
 * edit that skipped this step cannot ship.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const render = require("./render.js");
const kpis = require("./apply-kpis.js");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");

const SECTIONS = [
  { file: "work.json", problems: render.workProblems, render: render.renderWorkSection, marker: render.MARKERS.work },
  { file: "highlights.json", problems: render.highlightsProblems, render: render.renderHighlightsSection, marker: render.MARKERS.highlights },
  { file: "flight-log.json", problems: render.flightLogProblems, render: render.renderFlightLogSection, marker: render.MARKERS.flightLog },
  { file: "gallery.json", problems: render.galleryProblems, render: render.renderGallerySection, marker: render.MARKERS.gallery },
];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function listImages() {
  return fs.readdirSync(path.join(ROOT, "img")).filter((name) => !name.startsWith("."));
}

/** Load every data file, validate everything, return {refs, sections, posts}
 *  or print all problems and exit. Shared with gate.js. */
function loadAll() {
  const failures = [];
  const images = new Set(listImages().map((name) => `img/${name}`));

  let posts = null;
  try {
    posts = readJson("posts.json");
  } catch (error) {
    failures.push(`data/posts.json did not parse: ${error.message}`);
  }
  const postIds = new Set(
    posts && Array.isArray(posts.posts) ? posts.posts.map((post) => post && post.id).filter((id) => typeof id === "string") : [],
  );
  const refs = { images, postIds };
  if (posts !== null) {
    for (const problem of render.postsProblems(posts, refs)) failures.push(`data/posts.json: ${problem}`);
  }

  const sections = [];
  for (const section of SECTIONS) {
    try {
      const data = readJson(section.file);
      for (const problem of section.problems(data, refs)) failures.push(`data/${section.file}: ${problem}`);
      sections.push({ ...section, data });
    } catch (error) {
      failures.push(`data/${section.file} did not parse: ${error.message}`);
    }
  }

  let kpiData = null;
  try {
    kpiData = kpis.readKpis();
    for (const problem of kpis.kpiProblems(kpiData)) failures.push(`data/kpis.json: ${problem}`);
  } catch (error) {
    failures.push(`data/kpis.json did not parse: ${error.message}`);
  }

  return { failures, refs, sections, posts, kpiData, imageFiles: listImages() };
}

function main() {
  const { failures, sections, posts, kpiData, imageFiles } = loadAll();
  if (failures.length > 0) {
    console.error("Content is not valid — nothing written:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  let html = fs.readFileSync(kpis.INDEX_PATH, "utf8");
  html = kpis.applyToHtml(html, kpiData);
  for (const section of sections) {
    html = render.spliceBlock(html, section.marker, section.render(section.data));
  }
  const writes = [];
  const write = (file, content) => {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full) && fs.readFileSync(full, "utf8") === content) return;
    fs.writeFileSync(full, content);
    writes.push(file);
  };
  write("index.html", html);
  write("journal.html", render.renderJournalHtml(posts));
  write("feed.xml", render.renderFeedXml(posts));
  write("data/media.json", render.renderMediaJson(imageFiles));

  console.log(writes.length === 0 ? "Everything already in sync — nothing to do." : `Regenerated: ${writes.join(", ")}.`);
}

module.exports = { loadAll, SECTIONS };

if (require.main === module) main();
