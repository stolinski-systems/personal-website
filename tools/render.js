/**
 * render.js — every generated surface of patrickstolinski.com, as pure
 * functions from data to markup.
 *
 * The site's content model (the "mini CMS"): each editable section is a
 * canonical file under data/, and the HTML the internet sees is GENERATED
 * from it — marked blocks inside index.html, and the whole of journal.html.
 * `tools/apply-content.js` does the writing; `tools/gate.js` proves data and
 * markup never disagree; the Secretary General's Office is the editor that
 * rewrites the data files (one pinned mission per save).
 *
 *   data/kpis.json        → the stats strip        (renderer in apply-kpis.js)
 *   data/work.json        → "BY DESIGN: THE WORK" tiles
 *   data/highlights.json  → "RECENT HIGHLIGHTS" cards
 *   data/flight-log.json  → "THE FLIGHT LOG" timeline
 *   data/gallery.json     → "FROM THE FIELD" photo grid
 *   data/posts.json       → journal.html, whole file, plus feed.xml
 *   data/media.json       → GENERATED manifest of img/ (never hand-edited;
 *                           the Office's media picker reads it from the
 *                           live site)
 *
 * Two integrity rules the validators enforce that WordPress never could:
 * every image reference must name a file that actually exists in img/, and
 * every internal link must point at a journal post id that actually exists —
 * so a save that would ship a broken image or a dead anchor goes red in the
 * gate instead of live.
 *
 * ── The journal body dialect ────────────────────────────────────────────────
 *
 * A post body is one string in a deliberately small markdown subset, blocks
 * separated by blank lines:
 *
 *   ### Heading            → <h3>
 *   ![alt](img/x.jpg)      → a block of ONLY image lines: one image renders
 *                            as an inline photo, two or more as the
 *                            side-by-side photo grid
 *   anything else          → a paragraph; inline **bold** → <strong>,
 *                            [text](https://…) → a safe external link
 *
 * That is the whole language. It covers every construct the hand-written
 * journal used, and nothing else — a smaller surface for a save to break.
 *
 * Plain CommonJS, no dependencies, same as apply-kpis.js.
 */

"use strict";

const SITE_ORIGIN = "https://patrickstolinski.com";

/** Caps mirrored by the Office's editors — keep the two in step. */
const CAPS = {
  sectionTitle: 80,
  sectionTag: 80,
  sectionIntro: 400,
  itemTitle: 200,
  itemKicker: 200,
  itemText: 2000,
  chip: 40,
  postBody: 20000,
  maxItems: 100,
};

const ID_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const IMAGE_REF = /^img\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const OBJECT_POSITION = /^\d{1,3}% \d{1,3}%$/;
const DOTS = new Set(["navy", "mid", "sky"]);
const TILE_VARIANTS = new Set(["featured", "wide", "normal"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(text) {
  return escapeHtml(text).replace(/'/g, "&apos;");
}

/* ────────────────────────────── validators ─────────────────────────────── */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkString(problems, at, value, cap, { optional = false } = {}) {
  if (value === undefined && optional) return;
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${at} must be a non-empty string`);
    return;
  }
  if (value.length > cap) problems.push(`${at} is ${value.length} characters; the cap is ${cap}`);
}

function checkImage(problems, at, value, images, { optional = false } = {}) {
  if (value === undefined && optional) return;
  if (typeof value !== "string" || !IMAGE_REF.test(value)) {
    problems.push(`${at} must look like "img/<filename>"`);
    return;
  }
  if (images && !images.has(value)) {
    problems.push(`${at} names ${value}, which does not exist in img/`);
  }
}

function checkHref(problems, at, value, postIds, { optional = false } = {}) {
  if (value === undefined && optional) return;
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${at} must be a non-empty string`);
    return;
  }
  const anchor = value.match(/^journal\.html#([a-z0-9-]+)$/);
  if (anchor) {
    if (postIds && !postIds.has(anchor[1])) {
      problems.push(`${at} points at journal.html#${anchor[1]}, but no journal post has the id "${anchor[1]}"`);
    }
    return;
  }
  if (/^https:\/\/[^\s"']+$/.test(value)) return;
  if (/^index\.html(#[a-z0-9-]+)?$/.test(value)) return;
  problems.push(`${at} must be https://…, journal.html#<post-id>, or index.html#<anchor>, got ${JSON.stringify(value)}`);
}

function checkSectionChrome(problems, data, name) {
  checkString(problems, `${name}.title`, data.title, CAPS.sectionTitle);
  checkString(problems, `${name}.tag`, data.tag, CAPS.sectionTag);
  checkString(problems, `${name}.intro`, data.intro, CAPS.sectionIntro, { optional: name === "gallery" });
}

function checkItems(problems, data, name, key) {
  const items = data[key];
  if (!Array.isArray(items)) {
    problems.push(`${name}.${key} must be an array`);
    return null;
  }
  if (items.length === 0) problems.push(`${name}.${key} must not be empty`);
  if (items.length > CAPS.maxItems) problems.push(`${name}.${key} holds ${items.length} entries; the cap is ${CAPS.maxItems}`);
  return items;
}

/**
 * Each validator: (data, {images, postIds}) → string[] of problems, empty
 * when shippable. `images` is the set of files actually in img/; `postIds`
 * the set of journal post ids — both injected so these stay pure.
 */

function workProblems(data, refs = {}) {
  const problems = [];
  if (!isPlainObject(data)) return ["work.json must be an object"];
  checkSectionChrome(problems, data, "work");
  const tiles = checkItems(problems, data, "work", "tiles");
  if (!tiles) return problems;
  tiles.forEach((tile, index) => {
    const at = `tiles[${index}]`;
    if (!isPlainObject(tile)) return problems.push(`${at} must be an object`);
    checkString(problems, `${at}.title`, tile.title, CAPS.itemTitle);
    checkString(problems, `${at}.desc`, tile.desc, CAPS.itemText);
    checkImage(problems, `${at}.image`, tile.image, refs.images);
    checkString(problems, `${at}.alt`, tile.alt, CAPS.itemTitle);
    if (tile.variant !== undefined && !TILE_VARIANTS.has(tile.variant)) {
      problems.push(`${at}.variant must be one of featured, wide, normal`);
    }
    if (tile.imagePosition !== undefined && !OBJECT_POSITION.test(String(tile.imagePosition))) {
      problems.push(`${at}.imagePosition must look like "50% 35%"`);
    }
    checkHref(problems, `${at}.href`, tile.href, refs.postIds, { optional: true });
    if (tile.chips !== undefined) {
      if (!Array.isArray(tile.chips)) problems.push(`${at}.chips must be an array of short strings`);
      else tile.chips.forEach((chip, i) => checkString(problems, `${at}.chips[${i}]`, chip, CAPS.chip));
    }
  });
  return problems;
}

function highlightsProblems(data, refs = {}) {
  const problems = [];
  if (!isPlainObject(data)) return ["highlights.json must be an object"];
  checkSectionChrome(problems, data, "highlights");
  const cards = checkItems(problems, data, "highlights", "cards");
  if (!cards) return problems;
  cards.forEach((card, index) => {
    const at = `cards[${index}]`;
    if (!isPlainObject(card)) return problems.push(`${at} must be an object`);
    checkString(problems, `${at}.kicker`, card.kicker, CAPS.itemKicker);
    checkString(problems, `${at}.title`, card.title, CAPS.itemTitle);
    checkString(problems, `${at}.text`, card.text, CAPS.itemText);
    checkImage(problems, `${at}.image`, card.image, refs.images);
    checkString(problems, `${at}.alt`, card.alt, CAPS.itemTitle);
    if (card.imagePosition !== undefined && !OBJECT_POSITION.test(String(card.imagePosition))) {
      problems.push(`${at}.imagePosition must look like "50% 20%"`);
    }
    checkHref(problems, `${at}.href`, card.href, refs.postIds, { optional: true });
  });
  return problems;
}

function flightLogProblems(data, refs = {}) {
  const problems = [];
  if (!isPlainObject(data)) return ["flight-log.json must be an object"];
  checkSectionChrome(problems, data, "flight-log");
  const entries = checkItems(problems, data, "flight-log", "entries");
  if (!entries) return problems;
  entries.forEach((entry, index) => {
    const at = `entries[${index}]`;
    if (!isPlainObject(entry)) return problems.push(`${at} must be an object`);
    checkString(problems, `${at}.date`, entry.date, 20);
    if (!DOTS.has(entry.dot)) problems.push(`${at}.dot must be one of navy, mid, sky`);
    checkString(problems, `${at}.title`, entry.title, CAPS.itemTitle);
    checkString(problems, `${at}.org`, entry.org, CAPS.itemKicker, { optional: true });
    checkString(problems, `${at}.text`, entry.text, CAPS.itemText);
    checkImage(problems, `${at}.image`, entry.image, refs.images);
  });
  return problems;
}

function galleryProblems(data, refs = {}) {
  const problems = [];
  if (!isPlainObject(data)) return ["gallery.json must be an object"];
  checkString(problems, "gallery.title", data.title, CAPS.sectionTitle);
  const items = checkItems(problems, data, "gallery", "items");
  if (!items) return problems;
  items.forEach((item, index) => {
    const at = `items[${index}]`;
    if (!isPlainObject(item)) return problems.push(`${at} must be an object`);
    checkImage(problems, `${at}.image`, item.image, refs.images);
    checkString(problems, `${at}.alt`, item.alt, CAPS.itemTitle);
    if (item.wide !== undefined && typeof item.wide !== "boolean") problems.push(`${at}.wide must be true or false`);
  });
  return problems;
}

function postsProblems(data, refs = {}) {
  const problems = [];
  if (!isPlainObject(data)) return ["posts.json must be an object"];
  const journal = data.journal;
  if (!isPlainObject(journal)) problems.push("posts.json needs a \"journal\" object (description, ogImage)");
  else {
    checkString(problems, "journal.description", journal.description, CAPS.sectionIntro);
    checkImage(problems, "journal.ogImage", journal.ogImage, refs.images);
  }
  const posts = checkItems(problems, data, "posts", "posts");
  if (!posts) return problems;
  const seen = new Set();
  posts.forEach((post, index) => {
    const at = `posts[${index}]`;
    if (!isPlainObject(post)) return problems.push(`${at} must be an object`);
    if (typeof post.id !== "string" || !ID_SLUG.test(post.id)) problems.push(`${at}.id must be a lowercase slug`);
    else if (seen.has(post.id)) problems.push(`${at}.id "${post.id}" appears twice`);
    else seen.add(post.id);
    checkString(problems, `${at}.pill`, post.pill, CAPS.itemKicker);
    checkString(problems, `${at}.kicker`, post.kicker, CAPS.itemKicker);
    checkString(problems, `${at}.title`, post.title, CAPS.itemTitle);
    checkImage(problems, `${at}.hero`, post.hero, refs.images);
    checkString(problems, `${at}.heroAlt`, post.heroAlt, CAPS.itemTitle);
    checkString(problems, `${at}.body`, post.body, CAPS.postBody);
    if (post.draft !== undefined && typeof post.draft !== "boolean") problems.push(`${at}.draft must be true or false`);
    if (post.date !== undefined && !ISO_DATE.test(String(post.date))) problems.push(`${at}.date must look like 2026-04-02`);
    if (post.link !== undefined) {
      if (!isPlainObject(post.link)) problems.push(`${at}.link must be {label, href}`);
      else {
        checkString(problems, `${at}.link.label`, post.link.label, CAPS.itemKicker);
        checkHref(problems, `${at}.link.href`, post.link.href, refs.postIds);
      }
    }
    // Every image line in the body must also point at a real file.
    if (typeof post.body === "string" && refs.images) {
      for (const match of post.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
        if (!refs.images.has(match[1])) problems.push(`${at}.body references ${match[1]}, which does not exist in img/`);
      }
    }
  });
  return problems;
}

/* ─────────────────────────── section renderers ─────────────────────────── */

const MARKERS = {
  work: {
    begin: "<!-- work:begin (generated from data/work.json — run `node tools/apply-content.js`; do not hand-edit) -->",
    end: "<!-- work:end -->",
  },
  highlights: {
    begin: "<!-- highlights:begin (generated from data/highlights.json — run `node tools/apply-content.js`; do not hand-edit) -->",
    end: "<!-- highlights:end -->",
  },
  flightLog: {
    begin: "<!-- flight-log:begin (generated from data/flight-log.json — run `node tools/apply-content.js`; do not hand-edit) -->",
    end: "<!-- flight-log:end -->",
  },
  gallery: {
    begin: "<!-- gallery:begin (generated from data/gallery.json — run `node tools/apply-content.js`; do not hand-edit) -->",
    end: "<!-- gallery:end -->",
  },
};

function imgAttrs(image, alt, { position, lazy = true } = {}) {
  const style = position ? ` style="object-position:${escapeHtml(position)}"` : "";
  const loading = lazy ? ' loading="lazy"' : "";
  return `src="${escapeHtml(image)}" alt="${escapeHtml(alt)}"${style}${loading}`;
}

function renderWorkSection(data) {
  const lines = [MARKERS.work.begin];
  lines.push('  <section id="work" class="section section-white">');
  lines.push('    <div class="section-head">');
  lines.push(`      <h2 class="section-title">${escapeHtml(data.title)}</h2>`);
  lines.push(`      <div class="section-tag">${escapeHtml(data.tag)}</div>`);
  lines.push("    </div>");
  lines.push(`    <p class="section-intro">${escapeHtml(data.intro)}</p>`);
  lines.push("");
  lines.push('    <div class="work-grid">');
  data.tiles.forEach((tile, index) => {
    const variant = tile.variant === "featured" ? " tile-featured" : tile.variant === "wide" ? " tile-wide" : "";
    const tag = tile.href ? "a" : "div";
    const href = tile.href ? ` href="${escapeHtml(tile.href)}"` : "";
    lines.push(`      <${tag}${href} class="tile${variant}">`);
    // The first tile is above the fold in the grid — it loads eagerly, the
    // rest lazily, which is exactly the hand-written page's behaviour.
    lines.push(`        <img ${imgAttrs(tile.image, tile.alt, { position: tile.imagePosition, lazy: index > 0 })}>`);
    lines.push('        <div class="tile-shade"></div>');
    lines.push('        <div class="tile-caption">');
    lines.push(`          <div class="tile-title">${escapeHtml(tile.title)}</div>`);
    lines.push(`          <div class="tile-desc">${escapeHtml(tile.desc)}</div>`);
    if (tile.chips && tile.chips.length > 0) {
      const chips = tile.chips.map((chip) => `<span class="mono-chip">${escapeHtml(chip)}</span>`).join("");
      lines.push(`          <div class="tile-chips">${chips}</div>`);
    }
    lines.push("        </div>");
    lines.push(`      </${tag}>`);
  });
  lines.push("    </div>");
  lines.push("  </section>");
  lines.push(`  ${MARKERS.work.end}`);
  return lines.join("\n");
}

function renderHighlightsSection(data) {
  const lines = [MARKERS.highlights.begin];
  lines.push('  <section class="section section-light">');
  lines.push('    <div class="section-head">');
  lines.push(`      <h2 class="section-title">${escapeHtml(data.title)}</h2>`);
  lines.push(`      <div class="section-tag">${escapeHtml(data.tag)}</div>`);
  lines.push("    </div>");
  lines.push(`    <p class="section-intro">${escapeHtml(data.intro)}</p>`);
  lines.push("");
  lines.push('    <div class="highlights-grid">');
  for (const card of data.cards) {
    const tag = card.href ? "a" : "div";
    const href = card.href ? ` href="${escapeHtml(card.href)}"` : "";
    lines.push(`      <${tag}${href} class="card">`);
    lines.push(`        <img ${imgAttrs(card.image, card.alt, { position: card.imagePosition })}>`);
    lines.push('        <div class="card-body">');
    lines.push(`          <div class="card-kicker">${escapeHtml(card.kicker)}</div>`);
    lines.push(`          <div class="card-title">${escapeHtml(card.title)}</div>`);
    lines.push(`          <div class="card-text">${escapeHtml(card.text)}</div>`);
    lines.push("        </div>");
    lines.push(`      </${tag}>`);
  }
  lines.push("    </div>");
  lines.push("  </section>");
  lines.push(`  ${MARKERS.highlights.end}`);
  return lines.join("\n");
}

function renderFlightLogSection(data) {
  const lines = [MARKERS.flightLog.begin];
  lines.push('  <section id="flight" class="section section-white">');
  lines.push('    <div class="section-head">');
  lines.push(`      <h2 class="section-title">${escapeHtml(data.title)}</h2>`);
  lines.push(`      <div class="section-tag">${escapeHtml(data.tag)}</div>`);
  lines.push("    </div>");
  lines.push(`    <p class="section-intro">${escapeHtml(data.intro)}</p>`);
  lines.push("");
  lines.push('    <div class="log">');
  for (const entry of data.entries) {
    lines.push('      <div class="log-row">');
    lines.push(`        <div class="log-dot dot-${entry.dot}"></div>`);
    lines.push(`        <div class="log-date">${escapeHtml(entry.date)}</div>`);
    lines.push('        <div class="log-main">');
    lines.push('          <div class="log-title-row">');
    lines.push(`            <div class="log-title">${escapeHtml(entry.title)}</div>`);
    if (entry.org) lines.push(`            <div class="log-org">${escapeHtml(entry.org)}</div>`);
    lines.push("          </div>");
    lines.push(`          <div class="log-text">${escapeHtml(entry.text)}</div>`);
    lines.push("        </div>");
    lines.push(`        <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.title)}" class="log-img" loading="lazy">`);
    lines.push("      </div>");
  }
  lines.push("    </div>");
  lines.push("  </section>");
  lines.push(`  ${MARKERS.flightLog.end}`);
  return lines.join("\n");
}

const GALLERY_PILL = [
  '        <div class="gallery-hover">',
  '          <div class="gallery-pill"><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#fff"',
  '              stroke-width="1.6" stroke-linecap="round">',
  '              <path d="M4.5 1H1v3.5M7.5 1H11v3.5M4.5 11H1V7.5M7.5 11H11V7.5"></path>',
  "            </svg>VIEW FULL</div>",
  "        </div>",
];

function renderGallerySection(data) {
  const lines = [MARKERS.gallery.begin];
  lines.push('  <section class="gallery">');
  lines.push(`    <h2 class="gallery-title">${escapeHtml(data.title)}</h2>`);
  lines.push('    <div class="gallery-grid">');
  for (const item of data.items) {
    const wide = item.wide ? " wide" : "";
    lines.push(`      <div class="gallery-item${wide}" data-full="${escapeHtml(item.image)}">`);
    lines.push(`        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy">`);
    lines.push(...GALLERY_PILL);
    lines.push("      </div>");
  }
  lines.push("    </div>");
  lines.push("  </section>");
  lines.push(`  ${MARKERS.gallery.end}`);
  return lines.join("\n");
}

/* ───────────────────────── journal body dialect ────────────────────────── */

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/** Inline pass: **bold** and [text](https://…). Everything else is escaped
 *  text. Applied AFTER escaping, on the escaped string, using placeholders —
 *  simpler: parse the raw string into segments first, escape each. */
function renderInline(raw) {
  let out = "";
  let rest = String(raw);
  const token = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/;
  while (rest.length > 0) {
    const match = rest.match(token);
    if (!match) {
      out += escapeHtml(rest);
      break;
    }
    out += escapeHtml(rest.slice(0, match.index));
    if (match[1] !== undefined) {
      out += `<strong>${escapeHtml(match[1])}</strong>`;
    } else {
      out += `<a href="${escapeHtml(match[3])}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[2])}</a>`;
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

/** One post body → the lines inside <div class="post-body">. */
function renderPostBody(body) {
  const lines = [];
  const blocks = String(body)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
  for (const block of blocks) {
    const blockLines = block.split("\n").map((line) => line.trim());
    if (blockLines.every((line) => IMAGE_LINE.test(line))) {
      const images = blockLines.map((line) => line.match(IMAGE_LINE));
      if (images.length === 1) {
        lines.push(
          `      <img src="${escapeHtml(images[0][2])}" alt="${escapeHtml(images[0][1])}" class="post-inline-img" loading="lazy">`,
        );
      } else {
        lines.push('      <div class="post-photo-grid">');
        for (const image of images) {
          lines.push(`        <img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy">`);
        }
        lines.push("      </div>");
      }
      continue;
    }
    const heading = block.match(/^###\s+(.+)$/);
    if (heading) {
      lines.push(`      <h3>${renderInline(heading[1])}</h3>`);
      continue;
    }
    lines.push(`      <p>${renderInline(block.replace(/\n/g, " "))}</p>`);
  }
  return lines;
}

/* ─────────────────────────── journal + feed ────────────────────────────── */

const ANALYTICS = [
  "  <!-- Google tag (gtag.js) -->",
  '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-W208R3FY4E"></script>',
  "  <script>",
  "    window.dataLayer = window.dataLayer || [];",
  "    function gtag() { dataLayer.push(arguments); }",
  "    gtag('js', new Date());",
  "    gtag('config', 'G-W208R3FY4E');",
  "  </script>",
];

const FONTS = [
  '  <link rel="icon" type="image/svg+xml" href="favicon.svg">',
  '  <link rel="preconnect" href="https://fonts.googleapis.com">',
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  "  <link",
  '    href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap"',
  '    rel="stylesheet">',
  '  <link rel="stylesheet" href="styles.css">',
];

function publishedPosts(data) {
  return data.posts.filter((post) => post.draft !== true);
}

/** The whole of journal.html. Drafts are simply not rendered — they live in
 *  the data, invisible to the internet, WordPress's draft drawer. */
function renderJournalHtml(data) {
  const posts = publishedPosts(data);
  const lines = [];
  lines.push("<!DOCTYPE html>", '<html lang="en">', "", "<head>");
  lines.push('  <meta charset="utf-8">');
  lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1">');
  lines.push("  <title>The Journal · Patrick Stolinski</title>");
  lines.push("");
  lines.push('  <meta name="description"');
  lines.push(`    content="${escapeHtml(data.journal.description)}">`);
  lines.push("");
  lines.push('  <meta property="og:title" content="The Journal · Patrick Stolinski">');
  lines.push(`  <meta property="og:description" content="${escapeHtml(data.journal.description)}">`);
  lines.push(`  <meta property="og:image" content="${SITE_ORIGIN}/${escapeHtml(data.journal.ogImage)}">`);
  lines.push('  <meta property="og:type" content="website">');
  lines.push(`  <meta property="og:url" content="${SITE_ORIGIN}/journal.html">`);
  lines.push("");
  lines.push(...ANALYTICS);
  lines.push("");
  lines.push(...FONTS);
  lines.push("</head>", "", "<body>", "");
  lines.push("  <!-- NAV -->");
  lines.push('  <nav class="nav">');
  lines.push('    <a href="index.html" class="nav-logo">PS<span>.</span></a>');
  lines.push('    <div class="nav-links">');
  lines.push('      <a href="index.html">← BACK TO SITE</a>');
  lines.push('      <a href="index.html#contact" class="nav-cta">CONTACT</a>');
  lines.push("    </div>");
  lines.push("  </nav>", "");
  lines.push("  <!-- HEADER -->");
  lines.push('  <header class="journal-header">');
  lines.push('    <div class="kicker">NOTES FROM THE FIELD</div>');
  lines.push('    <h1 class="journal-title">THE JOURNAL</h1>');
  lines.push('    <div class="journal-pills">');
  for (const post of posts) {
    lines.push(`      <a href="#${escapeHtml(post.id)}">${escapeHtml(post.pill)}</a>`);
  }
  lines.push("    </div>");
  lines.push("  </header>");
  posts.forEach((post, index) => {
    lines.push("");
    lines.push(`  <!-- POST: ${post.id.toUpperCase()} -->`);
    lines.push(`  <article id="${escapeHtml(post.id)}" class="post">`);
    lines.push(`    <div class="post-kicker">${escapeHtml(post.kicker)}</div>`);
    lines.push(`    <h2 class="post-title">${escapeHtml(post.title)}</h2>`);
    lines.push(
      `    <img src="${escapeHtml(post.hero)}" alt="${escapeHtml(post.heroAlt)}" class="post-hero"${index > 0 ? ' loading="lazy"' : ""}>`,
    );
    lines.push('    <div class="post-body">');
    lines.push(...renderPostBody(post.body));
    lines.push("    </div>");
    if (post.link) {
      lines.push(
        `    <a href="${escapeHtml(post.link.href)}" target="_blank" rel="noopener noreferrer" class="post-link">${escapeHtml(post.link.label)}</a>`,
      );
    }
    lines.push("  </article>");
    if (index < posts.length - 1) {
      lines.push('  <div class="post-divider">', "    <div></div>", "  </div>");
    }
  });
  lines.push("");
  lines.push("  <!-- FOOTER -->");
  lines.push('  <footer class="footer">');
  lines.push('    <div class="footer-copy">© 2026 Patrick Stolinski</div>');
  lines.push('    <div class="footer-logo">PS<span>.</span></div>');
  lines.push('    <div class="footer-links">');
  lines.push('      <a href="index.html">← BACK TO SITE</a>');
  lines.push("    </div>");
  lines.push("  </footer>", "", "</body>", "", "</html>", "");
  return lines.join("\n");
}

/** The first paragraph of a body, as plain text — the RSS description. */
function firstParagraphText(body) {
  const blocks = String(body)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "" && !block.startsWith("###") && !IMAGE_LINE.test(block.split("\n")[0].trim()));
  if (blocks.length === 0) return "";
  return blocks[0]
    .replace(/\n/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, "$1");
}

/** feed.xml — the WordPress RSS parity piece, generated from the same data. */
function renderFeedXml(data) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<rss version="2.0">');
  lines.push("  <channel>");
  lines.push("    <title>The Journal · Patrick Stolinski</title>");
  lines.push(`    <link>${SITE_ORIGIN}/journal.html</link>`);
  lines.push(`    <description>${escapeXml(data.journal.description)}</description>`);
  for (const post of publishedPosts(data)) {
    lines.push("    <item>");
    lines.push(`      <title>${escapeXml(post.title)}</title>`);
    lines.push(`      <link>${SITE_ORIGIN}/journal.html#${escapeXml(post.id)}</link>`);
    lines.push(`      <guid isPermaLink="true">${SITE_ORIGIN}/journal.html#${escapeXml(post.id)}</guid>`);
    if (post.date) {
      lines.push(`      <pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate>`);
    }
    lines.push(`      <description>${escapeXml(firstParagraphText(post.body))}</description>`);
    lines.push("    </item>");
  }
  lines.push("  </channel>");
  lines.push("</rss>");
  lines.push("");
  return lines.join("\n");
}

/** data/media.json — the generated manifest the Office's media picker reads
 *  from the live site. `images` arrives as a directory listing. */
function renderMediaJson(imageFiles) {
  const sorted = [...imageFiles].sort((a, b) => a.localeCompare(b));
  const lines = sorted.map((name) => `    ${JSON.stringify(`img/${name}`)}`);
  return `{\n  "images": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

/** Splice one marked block into an html string — apply-kpis.js's rule,
 *  generalized. Throws plainly on missing/doubled markers. */
function spliceBlock(html, marker, rendered) {
  const begin = html.indexOf(marker.begin);
  if (begin === -1) throw new Error(`index.html is missing the "${marker.begin.slice(0, 24)}…" marker`);
  if (html.indexOf(marker.begin, begin + 1) !== -1) throw new Error(`index.html has two copies of the ${marker.begin.slice(5, 20)} marker`);
  const endIndex = html.indexOf(marker.end, begin);
  if (endIndex === -1) throw new Error(`index.html is missing the ${marker.end} marker`);
  return html.slice(0, begin) + rendered + html.slice(endIndex + marker.end.length);
}

module.exports = {
  SITE_ORIGIN,
  CAPS,
  MARKERS,
  workProblems,
  highlightsProblems,
  flightLogProblems,
  galleryProblems,
  postsProblems,
  renderWorkSection,
  renderHighlightsSection,
  renderFlightLogSection,
  renderGallerySection,
  renderPostBody,
  renderJournalHtml,
  renderFeedXml,
  renderMediaJson,
  spliceBlock,
  publishedPosts,
  firstParagraphText,
};
