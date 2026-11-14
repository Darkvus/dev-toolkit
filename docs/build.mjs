#!/usr/bin/env node
// Static docs generator. Reads the plugin's own markdown (skills, commands, agents)
// plus hand-written pages in docs/content and writes docs/dist. Zero dependencies.
//   node docs/build.mjs            build
//   node docs/build.mjs --serve    build, then serve docs/dist on http://localhost:4321
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, cpSync, statSync } from "node:fs";
import { dirname, join, posix, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const DOCS = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DOCS, "..");
const DIST = join(DOCS, "dist");
const SRC = join(DOCS, "src");
const CONTENT = join(DOCS, "content");

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
let REPO = "https://github.com/Darkvus/dev-toolkit";
try {
  const pj = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8"));
  if (pj.repository) REPO = pj.repository;
} catch { /* keep default */ }

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[`*_]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") || "section";
const read = (p) => readFileSync(p, "utf8");
const list = (d) => (existsSync(d) ? readdirSync(d).sort() : []);

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const k = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].trim().replace(/^["']|["']$/g, "");
  }
  return { fm, body: text.slice(m[0].length) };
}

function splitDescription(d = "") {
  const i = d.search(/\bUse (this|when|it)\b/);
  if (i > 0) return { summary: d.slice(0, i).trim(), when: d.slice(i).trim() };
  return { summary: d.trim(), when: "" };
}

// ---------- content model ----------
const items = []; // every page
const byKey = new Map(); // "skill:name" -> item

function add(item) {
  items.push(item);
  if (item.key) byKey.set(item.key, item);
  return item;
}

function loadContent() {
  // Skills
  for (const name of list(join(ROOT, "skills"))) {
    const p = join(ROOT, "skills", name, "SKILL.md");
    if (!existsSync(p)) continue;
    const { fm, body } = frontmatter(read(p));
    const group = name.startsWith("backend-") ? "Backend" : name.startsWith("frontend-") ? "Frontend" : "Orchestrator";
    add({
      key: `skill:${name}`, kind: "skill", section: "Skills", group, url: `skills/${name}/`, title: fm.name || name,
      description: fm.description || "", fm, body, source: `skills/${name}/SKILL.md`, v3: name === "dev-toolkit",
      order: name === "dev-toolkit" ? 0 : 1,
    });
  }
  // Commands (source of truth)
  for (const f of list(join(ROOT, "commands")).filter((x) => x.endsWith(".md"))) {
    const name = f.replace(/\.md$/, "");
    const { fm, body } = frontmatter(read(join(ROOT, "commands", f)));
    add({
      key: `command:${name}`, kind: "command", section: "Commands", group: "Workflows", url: `commands/${name}/`, title: `/${name}`,
      name, description: fm.description || "", fm, body, source: `commands/${f}`, order: 100,
    });
  }
  // Agents
  for (const f of list(join(ROOT, "agents")).filter((x) => x.endsWith(".md"))) {
    const name = f.replace(/\.md$/, "");
    const { fm, body } = frontmatter(read(join(ROOT, "agents", f)));
    add({
      key: `agent:${name}`, kind: "agent", section: "Agents", group: name.startsWith("dev-toolkit-") ? "Orchestrator" : "Planners", url: `agents/${name}/`,
      title: fm.name || name, description: fm.description || "", fm, body, source: `agents/${f}`, v3: name.startsWith("dev-toolkit-"),
    });
  }
  loadOrchestratorCommands();
  // Hand-written pages
  for (const f of list(CONTENT)) {
    const full = join(CONTENT, f);
    if (statSync(full).isDirectory()) {
      for (const g of list(full).filter((x) => x.endsWith(".md"))) addHand(join(full, g), `commands/${g.replace(/\.md$/, "")}/`, `docs/content/${f}/${g}`);
    } else if (f.endsWith(".md")) {
      addHand(full, null, `docs/content/${f}`);
    }
  }
}


// v3 front door: one page per routing-table row of skills/dev-toolkit/SKILL.md, body from reference/<name>.md
const EXAMPLES_V3 = {
  plan: ['/dev-toolkit plan "vehicle fleet tracking"'],
  scaffold: ["/dev-toolkit scaffold frontend admin-panel", "/dev-toolkit scaffold backend billing"],
  crud: ["/dev-toolkit crud vehicle /api/v1/vehicles"],
  api: ['/dev-toolkit api "list vehicles with filters"'],
  review: ["/dev-toolkit review --changed", "/dev-toolkit review src/features/vehicles"],
  commit: ["/dev-toolkit commit"],
  audit: ["/dev-toolkit audit", "/dev-toolkit audit backend/"],
  document: ["/dev-toolkit document"],
  doctor: ["/dev-toolkit doctor"],
  context: ["/dev-toolkit context"],
  hooks: ["/dev-toolkit hooks status", "/dev-toolkit hooks off"],
};
function loadOrchestratorCommands() {
  const skillPath = join(ROOT, "skills/dev-toolkit/SKILL.md");
  if (!existsSync(skillPath)) return;
  const { body } = frontmatter(read(skillPath));
  let order = 0;
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*`([a-z-]+)([^`]*)`\s*\|\s*(.+?)\s*\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|$/);
    if (!m) continue;
    const [, name, args, what, ref] = m;
    const refPath = join(ROOT, "skills/dev-toolkit", ref);
    if (!existsSync(refPath)) continue;
    const usageArgs = args.replace(/\\\|/g, "|").trim();
    add({
      key: `command:dev-toolkit-${name}`, kind: "command", section: "Commands", group: "Front door", url: `commands/dev-toolkit-${name}/`,
      title: `/dev-toolkit ${name}`, name: `dev-toolkit ${name}`, description: what.replace(/`/g, ""), fm: { "argument-hint": usageArgs }, body: read(refPath),
      source: `skills/dev-toolkit/${ref}`, v3: true, order: ++order, examples: EXAMPLES_V3[name] || [], orchestrator: true,
    });
  }
}

function includeDirective(kind) {
  const fence = (lang, t) => "```" + lang + "\n" + t.replace(/\n$/, "") + "\n```";
  const script = join(ROOT, "skills/dev-toolkit/scripts/dev-toolkit.mjs");
  if (kind === "hooks-reference") {
    const p = join(ROOT, "skills/dev-toolkit/reference/hooks.md");
    return existsSync(p) ? read(p).replace(/^# .*\n+/, "") : "";
  }
  if (kind === "hooks-json") {
    const p = join(ROOT, "hooks/hooks.json");
    return existsSync(p) ? `## Registered hooks\n\nThe plugin's \`hooks/hooks.json\`, copied verbatim at build time:\n\n${fence("json", read(p))}` : "";
  }
  if (!existsSync(script)) return "";
  try {
    if (kind === "cli-help") return fence("text", execFileSync(process.execPath, [script, "--help"], { encoding: "utf8" }));
    if (kind === "cli-rules") {
      const rows = execFileSync(process.execPath, [script, "detect", "--list-rules"], { encoding: "utf8" }).trim().split("\n")
        .map((l) => l.match(/^(\S+)\s+(error|warn|info)\s+(.*)$/)).filter(Boolean)
        .map((m) => `| \`${m[1]}\` | ${m[2]} | ${m[3].replace(/\|/g, "\\|")} |`);
      return `| Rule | Severity | What it enforces |\n|---|---|---|\n${rows.join("\n")}`;
    }
  } catch { /* script failed: omit */ }
  return "";
}

const PAGE_URL = { cli: "cli/", hooks: "hooks/", "getting-started": "getting-started/", install: "install/" };
function addHand(path, forcedUrl, source) {
  const { fm, body: raw } = frontmatter(read(path));
  const body = raw.replace(/^@@include ([a-z-]+)\s*$/gm, (_, k) => includeDirective(k));
  const base = path.split("/").pop().replace(/\.md$/, "");
  const url = forcedUrl || (fm.slug ? `${fm.slug}/` : PAGE_URL[base] || `${base}/`);
  add({
    key: `page:${url}`, kind: "page", section: fm.section, group: fm.group || "", url, title: fm.title, description: fm.description || "",
    fm, body, source, order: Number(fm.order || 50), v3: fm.v3 === "true" || /^v3$/m.test(fm.v3 || ""), hand: true,
  });
}

// ---------- markdown ----------
function makeLinkResolver(page) {
  return (href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [pathPart, hash] = href.split("#");
    if (page.hand) return rel(page.url, pathPart.replace(/^\//, "")) + (hash ? `#${hash}` : "");
    // Links inside source skills/commands/agents point at files in the repo.
    const srcDir = posix.dirname(page.source);
    const target = posix.normalize(posix.join(srcDir, pathPart));
    const skill = target.match(/^skills\/([^/]+)\/SKILL\.md$/);
    if (skill && byKey.has(`skill:${skill[1]}`)) return rel(page.url, `skills/${skill[1]}/`) + (hash ? `#${hash}` : "");
    return `${REPO}/blob/main/${target}`;
  };
}

function rel(fromUrl, toUrl) {
  // Both are directory-style site paths ("a/b/") or file paths; result is relative to the page's directory.
  const from = fromUrl.replace(/\/$/, "") || ".";
  const to = toUrl.replace(/\/$/, "") || ".";
  const r = posix.relative(from, to) || ".";
  return toUrl === "" || toUrl.endsWith("/") ? `${r}/` : r;
}

function inline(text, page, stash) {
  const resolve_ = makeLinkResolver(page);
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\[\[([a-z0-9-]+)\]\]/g, (_, n) => {
    const t = byKey.get(`skill:${n}`) || byKey.get(`agent:${n}`) || byKey.get(`command:${n}`);
    return t ? `<a href="${rel(page.url, t.url)}"><code>${n}</code></a>` : `<code>${n}</code>`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => `<a href="${esc(resolve_(h.replace(/&amp;/g, "&")))}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?![\w*])/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_([^_\s][^_]*)_(?![\w])/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  // Allow the one piece of HTML hand-written pages use.
  s = s.replace(/&lt;span class=&quot;badge&quot;&gt;(.*?)&lt;\/span&gt;/g, '<span class="badge">$1</span>');
  void stash;
  return s;
}

function codeBlock(lang, code) {
  const label = lang || "text";
  return `<div class="code"><div class="code-head"><span class="lang">${esc(label)}</span><button class="copy" type="button" aria-label="Copy ${esc(label)} code to clipboard">Copy</button></div><pre tabindex="0"><code>${esc(code)}</code></pre></div>`;
}

function renderMarkdown(src, page, toc = [], stash = []) {
  const put = (html) => { stash.push(html); return `@@PH${stash.length - 1}@@`; };
  const ids = new Map();
  const uniqueId = (t) => { const b = slugify(t); const n = ids.get(b) || 0; ids.set(b, n + 1); return n ? `${b}-${n}` : b; };

  // 1. fenced code (possibly indented inside lists)
  src = src.replace(/^([ \t]*)(`{3,})([^\n`]*)\n([\s\S]*?)\n\1\2[ \t]*$/gm, (_, indent, _f, info, code) => {
    const dedent = code.split("\n").map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l)).join("\n");
    return `\n${indent}${put(codeBlock(info.trim().split(/\s+/)[0], dedent))}\n`;
  });
  // 2. tabs (hand-written install page)
  if (src.includes("@@tab ")) {
    src = src.replace(/(^|\n)@@tab [\s\S]*?\n@@end(?=\n|$)/g, (block) => {
      const parts = block.trim().split(/\n(?=@@tab )/).map((p) => p.replace(/\n@@end$/, ""));
      const tabs = parts.map((p) => {
        const nl = p.indexOf("\n");
        return { title: p.slice("@@tab ".length, nl).trim(), body: p.slice(nl + 1) };
      });
      const gid = `tabs-${ids.size}-${stash.length}`;
      const head = tabs.map((t, i) => `<button role="tab" id="${gid}-t${i}" aria-controls="${gid}-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t.title)}</button>`).join("");
      const panels = tabs.map((t, i) => `<div role="tabpanel" id="${gid}-p${i}" aria-labelledby="${gid}-t${i}" tabindex="0"${i ? " hidden" : ""} data-tab-title="${esc(t.title)}"><h3 class="tab-print-title">${esc(t.title)}</h3>${renderMarkdown(t.body, page, [], stash).html}</div>`).join("");
      return `\n\n${put(`<div class="tabs"><div role="tablist" aria-label="Installation method">${head}</div>${panels}</div>`)}\n\n`;
    });
  }
  // 3. <example>/<commentary> blocks used by agents
  const callout = (tag, label) => {
    const re = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "g");
    src = src.replace(re, (_, inner) => `\n\n${put(`<div class="callout callout-${tag}"><p class="callout-label">${label}</p>${renderMarkdown(inner, page, [], stash).html}</div>`)}\n\n`);
  };
  callout("commentary", "Why");
  callout("example", "Example");
  src = src.replace(/<!--[\s\S]*?-->/g, "");

  const lines = src.split("\n");
  const out = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,6})\s/.test(l) || /^\s*([-*+]|\d+\.)\s+/.test(l) || /^>/.test(l) || /^\|/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l) || /^\s*@@PH\d+@@\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^\s*@@PH(\d+)@@\s*$/))) { out.push(stash[Number(m[1])]); i++; continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const level = m[1].length;
      const text = m[2];
      i++;
      if (level === 1 && page.dropH1 !== false && !out.length) continue; // page title is rendered by the template
      const id = uniqueId(text);
      if (level === 2 || level === 3) toc.push({ level, id, text: text.replace(/[`*]/g, "") });
      const lv = Math.max(level, 2);
      out.push(`<h${lv} id="${id}">${inline(text, page)}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${lv}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l) => l.replace(/^\||\|\s*$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c, page)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, page)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${renderMarkdown(buf.join("\n"), { ...page, dropH1: false }, [], stash).html}</blockquote>`);
      continue;
    }
    if ((m = line.match(/^(\s*)([-*+]|\d+\.)\s+/))) {
      const baseIndent = m[1].length;
      const ordered = /\d/.test(m[2]);
      const itemsHtml = [];
      while (i < lines.length) {
        const im = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!im || im[1].length !== baseIndent) break;
        const contentIndent = im[1].length + im[2].length + 1;
        const buf = [im[3]];
        i++;
        while (i < lines.length) {
          const l = lines[i];
          if (!l.trim()) {
            // blank line continues the item only if the next non-blank line is indented deeper
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length && lines[j].match(/^\s*/)[0].length >= contentIndent) { buf.push(""); i++; continue; }
            break;
          }
          const ind = l.match(/^\s*/)[0].length;
          const sib = l.match(/^(\s*)([-*+]|\d+\.)\s+/);
          if (sib && sib[1].length <= baseIndent) break;
          if (ind >= contentIndent || !isBlockStart(l)) { buf.push(l.slice(Math.min(ind, contentIndent))); i++; continue; }
          break;
        }
        let html = renderMarkdown(buf.join("\n"), { ...page, dropH1: false }, [], stash).html;
        html = html.replace(/^<p>([\s\S]*?)<\/p>(?=$|<(ul|ol)\b)/, "$1");
        itemsHtml.push(`<li>${html}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${itemsHtml.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i]))) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join("\n"), page)}</p>`);
  }
  return { html: out.join("\n"), toc };
}

const plainText = (md) => md.replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ").replace(/[#>*_`|\[\]()-]+/g, " ").replace(/\s+/g, " ").trim();

// ---------- examples for classic commands (kept short; usage comes from the source) ----------
const EXAMPLES = {
  "explore-plan": ["/explore-plan add driver assignment to vehicles"],
  "start-working-on-technical-plan": ["/start-working-on-technical-plan docs/specs/fleet.md"],
  "scaffold-frontend": ["/scaffold-frontend admin-panel"],
  "add-crud-page": ["/add-crud-page vehicle /api/v1/vehicles", "/add-crud-page vehicle /api/v1/vehicles --plan docs/features/fleet/frontend.md"],
};

// ---------- templates ----------
const NAV_SECTIONS = ["Getting started", "Commands", "Skills", "Agents", "CLI", "Hooks", "Conventions"];
const SECTION_HOME = { Commands: "commands/", Skills: "skills/", Agents: "agents/" };

function buildNav() {
  const nav = [];
  for (const section of NAV_SECTIONS) {
    const pages = items.filter((p) => p.section === section);
    if (!pages.length && !SECTION_HOME[section]) continue;
    const groups = new Map();
    const homeUrl = SECTION_HOME[section];
    for (const p of pages) {
      const g = p.group || "";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    }
    const groupOrder = { "Front door": 0, Workflows: 1, Orchestrator: 0, Backend: 1, Frontend: 2, Planners: 1, "": 0 };
    const gs = [...groups.entries()].sort((a, b) => (groupOrder[a[0]] ?? 9) - (groupOrder[b[0]] ?? 9));
    for (const [, arr] of gs) arr.sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || String(a.title).localeCompare(String(b.title)));
    nav.push({ section, homeUrl, groups: gs });
  }
  return nav;
}

let NAV = [];
let FLAT = [];

function sidebarHtml(page) {
  const here = page.url;
  const link = (p, label) => `<a href="${rel(here, p.url)}"${p.url === here ? ' aria-current="page"' : ""}>${label}${p.v3 ? ' <span class="badge">v3</span>' : ""}</a>`;
  return NAV.map(({ section, homeUrl, groups }) => {
    const open = groups.some(([, arr]) => arr.some((p) => p.url === here)) || here === homeUrl || (here === "" && section === "Getting started");
    const body = groups.map(([g, arr]) => `${g ? `<p class="nav-group">${esc(g)}</p>` : ""}<ul>${arr.map((p) => `<li>${link(p, esc(p.kind === "page" || p.section === "Getting started" ? p.title : p.title.replace(/^\/dev-toolkit /, "/dev-toolkit ")))}</li>`).join("")}</ul>`).join("");
    const head = homeUrl
      ? `<a class="nav-head" href="${rel(here, homeUrl)}"${here === homeUrl ? ' aria-current="page"' : ""}>${section}</a>`
      : `<span class="nav-head">${section}</span>`;
    return `<details class="nav-section"${open ? " open" : ""}><summary>${head}<span class="chev" aria-hidden="true"></span></summary>${body}</details>`;
  }).join("");
}

function layout(page, bodyHtml, { toc = [], wide = false, eyebrow = "", home = false } = {}) {
  const here = page.url;
  const r = (u) => rel(here, u);
  const idx = FLAT.findIndex((p) => p.url === here);
  const prev = idx > 0 ? FLAT[idx - 1] : null;
  const next = idx >= 0 && idx < FLAT.length - 1 ? FLAT[idx + 1] : null;
  const title = home ? "dev-toolkit documentation" : `${page.title} · dev-toolkit`;
  const desc = esc((page.description || "").slice(0, 300));
  const tocHtml = toc.length > 1 ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ul>${toc.map((t) => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ul></nav>` : "";
  const pager = prev || next ? `<nav class="pager" aria-label="Previous and next page">${prev ? `<a rel="prev" href="${r(prev.url)}"><span>Previous</span>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a rel="next" href="${r(next.url)}"><span>Next</span>${esc(next.title)}</a>` : ""}</nav>` : "";
  const edit = page.source ? `<a class="edit" href="${REPO}/blob/main/${page.source}">View source on GitHub</a>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${desc}">
<meta name="color-scheme" content="light dark">
<script>try{var t=localStorage.getItem("dtk-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}document.documentElement.classList.add("js")</script>
<link rel="stylesheet" href="${r("assets/style.css")}">
<link rel="icon" href="${r("assets/favicon.svg")}" type="image/svg+xml">
</head>
<body data-root="${r("")}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="sidebar"><span class="sr">Menu</span><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
  <a class="brand" href="${r("")}"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1.5" y="1.5" width="19" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 8l3 3-3 3M11.5 14h4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>dev-toolkit</span></a>
  <button class="search-btn" type="button" aria-haspopup="dialog"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span class="search-label">Search docs</span><kbd>/</kbd></button>
  <a class="gh" href="${REPO}" aria-label="GitHub repository">GitHub</a>
  <button class="theme-btn" type="button" aria-label="Toggle color theme"><svg class="i-sun" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><svg class="i-moon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M14.5 10.8A6 6 0 017.2 3.5a6 6 0 107.3 7.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
</header>
<div class="shell${wide ? " shell-wide" : ""}">
  <aside class="side" id="sidebar" aria-label="Documentation"><nav>${sidebarHtml(page)}</nav></aside>
  <main id="main" tabindex="-1">
    <article class="doc${home ? " home" : ""}">
${bodyHtml}
${home ? "" : `<footer class="doc-foot">${edit}${pager}</footer>`}
    </article>
  </main>
  ${tocHtml}
</div>
<footer class="site-foot"><p>dev-toolkit ${esc(pkg.version)} · generated from the repository's markdown at build time · <a href="${REPO}">Source</a></p></footer>
<dialog class="search" aria-label="Search documentation"><form method="dialog"><label class="sr" for="q">Search</label><input id="q" type="search" placeholder="Search skills, commands, agents" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="results"><button class="close" value="close" aria-label="Close search">Esc</button></form><ul id="results" role="listbox" aria-label="Search results"></ul><p class="hint" id="hint">Type to search. Arrow keys to move, Enter to open.</p></dialog>
<script src="${r("assets/app.js")}" defer></script>
</body>
</html>
`;
}

function pageHeader(page, extra = "") {
  const badge = page.v3 ? ' <span class="badge">v3</span>' : "";
  const crumb = page.section && page.kind !== "home" ? `<p class="eyebrow">${esc(page.section)}${page.group ? ` / ${esc(page.group)}` : ""}</p>` : "";
  return `${crumb}<h1${["skill", "agent", "command"].includes(page.kind) ? ' class="mono"' : ""}>${esc(page.title)}${badge}</h1>${page.description ? `<p class="lede">${esc(splitDescription(page.description).summary || page.description)}</p>` : ""}${extra}`;
}

const cmdBox = (text, label = "Copy") => `<div class="cmd"><code>${esc(text)}</code><button class="copy" type="button" aria-label="${label} command">Copy</button></div>`;

function renderItem(page) {
  const { html, toc } = renderMarkdown(page.body, page);
  let extra = "";
  if (page.kind === "skill") {
    const { when } = splitDescription(page.description);
    extra = `${when ? `<p class="when">${esc(when)}</p>` : ""}<dl class="meta"><div><dt>Loaded</dt><dd>Automatically, when the task matches</dd></div><div><dt>Ask for it</dt><dd><code>Use the ${esc(page.title)} skill</code></dd></div><div><dt>Source</dt><dd><a href="${REPO}/blob/main/${page.source}"><code>${esc(page.source)}</code></a></dd></div></dl>`;
  } else if (page.kind === "command") {
    const hint = page.fm["argument-hint"];
    const usage = `${page.title}${hint ? ` ${hint}` : ""}`;
    const ex = page.examples || EXAMPLES[page.name] || [];
    extra = `<h2 id="usage">Usage<a class="anchor" href="#usage" aria-label="Link to this section">#</a></h2>${codeBlock("text", usage)}${ex.length ? `<h2 id="examples">Examples<a class="anchor" href="#examples" aria-label="Link to this section">#</a></h2>${codeBlock("text", ex.join("\n"))}` : ""}<h2 id="workflow">${page.orchestrator ? "How it runs" : "Workflow"}<a class="anchor" href="#workflow" aria-label="Link to this section">#</a></h2>`;
    toc.unshift({ level: 2, id: "usage", text: "Usage" }, ...(ex.length ? [{ level: 2, id: "examples", text: "Examples" }] : []), { level: 2, id: "workflow", text: page.orchestrator ? "How it runs" : "Workflow" });
  } else if (page.kind === "agent") {
    const f = page.fm;
    extra = `<dl class="meta"><div><dt>Model</dt><dd>${esc(f.model || "inherit")}</dd></div><div><dt>Tools</dt><dd>${esc(f.tools || "all")}</dd></div><div><dt>Invoke</dt><dd><code>Use the ${esc(page.title)} agent to ...</code></dd></div></dl>`;
  }
  const inProse = page.kind === "command";
  const head = pageHeader(page, inProse ? "" : extra);
  return layout(page, `${head}\n<div class="prose">${inProse ? extra : ""}${html}</div>`, { toc });
}

function indexPage(page, inner) {
  const { toc = [] } = {};
  return layout(page, `${pageHeader(page)}<div class="prose">${inner}</div>`, { toc });
}

function cardList(arr, here) {
  return `<ul class="ruled">${arr.map((p) => `<li><a href="${rel(here, p.url)}"><span class="r-title${["skill", "command", "agent"].includes(p.kind) ? " mono" : ""}">${esc(p.title)}${p.v3 ? ' <span class="badge">v3</span>' : ""}</span><span class="r-desc">${esc(splitDescription(p.description).summary || p.description)}</span></a></li>`).join("")}</ul>`;
}

// ---------- build ----------
function build() {
  loadContent();

  // Virtual index pages.
  add({ key: "page:commands/", kind: "page", section: "Commands", group: "", url: "commands/", title: "Command reference", description: "Every slash command, generated from commands/*.md and the v3 orchestrator.", order: 0, virtual: true });
  add({ key: "page:skills/", kind: "page", section: "Skills", group: "", url: "skills/", title: "Skills", description: "Convention references Claude loads automatically when a task matches.", order: 0, virtual: true });
  add({ key: "page:agents/", kind: "page", section: "Agents", group: "", url: "agents/", title: "Agents", description: "Planning and review subagents.", order: 0, virtual: true });

  NAV = buildNav();
  // The section index pages are the nav heads; keep them out of group lists.
  for (const n of NAV) for (const g of n.groups) g[1] = g[1].filter((p) => !p.virtual);
  FLAT = [];
  for (const n of NAV) {
    if (n.homeUrl) FLAT.push(byKey.get(`page:${n.homeUrl}`));
    for (const [, arr] of n.groups) FLAT.push(...arr);
  }

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(join(DIST, "assets"), { recursive: true });
  cpSync(join(SRC, "style.css"), join(DIST, "assets/style.css"));
  cpSync(join(SRC, "app.js"), join(DIST, "assets/app.js"));
  cpSync(join(SRC, "favicon.svg"), join(DIST, "assets/favicon.svg"));
  writeFileSync(join(DIST, ".nojekyll"), "");

  let written = 0;
  const out = (url, html) => {
    written++;
    const dir = join(DIST, url);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
  };

  const skills = items.filter((p) => p.kind === "skill");
  const agents = items.filter((p) => p.kind === "agent");
  const commandsSrc = items.filter((p) => p.kind === "command" && !p.orchestrator);
  const commandsV3 = items.filter((p) => p.orchestrator).sort((a, b) => a.order - b.order);

  for (const p of items) {
    if (p.virtual) continue;
    out(p.url, renderItem(p));
  }

  // Command reference
  {
    const page = byKey.get("page:commands/");
    const orchestrator = byKey.get("skill:dev-toolkit");
    const v3rows = commandsV3.map((p) => `<tr><td><a href="${rel(page.url, p.url)}"><code>${esc(`${p.title} ${p.fm["argument-hint"] || ""}`.trim())}</code></a></td><td>${esc(p.description)}</td></tr>`).join("");
    const classic = commandsSrc.map((p) => {
      const hint = p.fm["argument-hint"] || "";
      return `<tr><td><a href="${rel(page.url, p.url)}"><code>${esc(p.title)}</code></a></td><td>${hint ? `<code>${esc(hint)}</code>` : ""}</td><td>${esc(p.description)}</td></tr>`;
    }).join("");
    const inner = `<h2 id="front-door">Front door <span class="badge">v3</span><a class="anchor" href="#front-door" aria-label="Link to this section">#</a></h2>
<p>One command, many sub-commands. <code>/dev-toolkit &lt;command&gt;</code> picks the right workflow, agent and skills for you.${orchestrator ? ` Full routing rules are in the <a href="${rel(page.url, orchestrator.url)}">dev-toolkit skill</a>.` : ""}</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Front door commands"><table><thead><tr><th scope="col">Command</th><th scope="col">What it does</th></tr></thead><tbody>${v3rows}</tbody></table></div>
<h2 id="workflows">Workflow commands<a class="anchor" href="#workflows" aria-label="Link to this section">#</a></h2>
<p>The original commands. They keep working and the front door routes to them.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Workflow commands"><table><thead><tr><th scope="col">Command</th><th scope="col">Arguments</th><th scope="col">What it does</th></tr></thead><tbody>${classic}</tbody></table></div>`;
    out(page.url, layout(page, `${pageHeader(page)}<div class="prose">${inner}</div>`, { toc: [{ level: 2, id: "front-door", text: "Front door" }, { level: 2, id: "workflows", text: "Workflow commands" }] }));
  }
  // Skills index
  {
    const page = byKey.get("page:skills/");
    const sections = ["Orchestrator", "Backend", "Frontend"].map((g) => {
      const arr = skills.filter((s) => s.group === g);
      return arr.length ? `<h2 id="${slugify(g)}">${g}<a class="anchor" href="#${slugify(g)}" aria-label="Link to this section">#</a></h2>${cardList(arr, page.url)}` : "";
    }).join("");
    const toc = ["Orchestrator", "Backend", "Frontend"].filter((g) => skills.some((s) => s.group === g)).map((g) => ({ level: 2, id: slugify(g), text: g }));
    out(page.url, layout(page, `${pageHeader(page)}<div class="prose">${sections}</div>`, { toc }));
  }
  // Agents index
  {
    const page = byKey.get("page:agents/");
    const groups = ["Orchestrator", "Planners"].map((g) => {
      const arr = agents.filter((a) => a.group === g);
      return arr.length ? `<h2 id="${slugify(g)}">${g}<a class="anchor" href="#${slugify(g)}" aria-label="Link to this section">#</a></h2>${cardList(arr, page.url)}` : "";
    }).join("");
    const toc = ["Orchestrator", "Planners"].filter((g) => agents.some((a) => a.group === g)).map((g) => ({ level: 2, id: slugify(g), text: g }));
    out(page.url, layout(page, `${pageHeader(page)}<div class="prose">${groups}</div>`, { toc }));
  }

  // Shipped hooks list (appended knowledge on the hooks page) is read from hooks/ if present.
  const hookFiles = list(join(ROOT, "hooks"));
  if (hookFiles.length) {
    const hp = byKey.get("page:hooks/");
    const extra = renderMarkdown(`## Shipped hooks\n\n${hookFiles.map((f) => `- \`hooks/${f}\``).join("\n")}\n`, hp).html;
    const file = join(DIST, hp.url, "index.html");
    writeFileSync(file, read(file).replace(/<\/div>\n(<footer class="doc-foot">)/, `${extra}</div>\n$1`));
  }

  // Home
  {
    const home = { url: "", title: "dev-toolkit", description: "Conventions for a DDD Python backend and a React + Vite + shadcn/ui frontend, as skills, agents and commands for Claude Code.", section: "", kind: "home" };
    const orchestrator = commandsV3;
    const nCommands = commandsSrc.length + orchestrator.length;
    const rows = orchestrator.map((p) => `<li><a href="${rel("", p.url)}"><span class="r-title mono">${esc(p.title)}</span><span class="r-desc">${esc(p.description)}</span></a></li>`).join("");
    const body = `<section class="hero">
<p class="eyebrow">Plugin for Claude Code · v${esc(pkg.version)}</p>
<h1>One contract, both sides of the wire.</h1>
<p class="lede">dev-toolkit teaches your coding agent how a Domain-Driven Design Python backend and a React + Vite + shadcn/ui frontend fit together: the same error envelope, the same units, the same query parameters, PATCH-only updates.</p>
${cmdBox("npx dev-toolkit install")}
<p class="hero-links"><a class="btn" href="install/">Install</a><a class="btn ghost" href="getting-started/">Introduction</a><a class="btn ghost" href="conventions/">Read the conventions</a></p>
<ul class="stats" aria-label="What is included"><li><strong>${skills.length}</strong><span>skills</span></li><li><strong>${nCommands}</strong><span>commands</span></li><li><strong>${agents.length}</strong><span>agents</span></li></ul>
</section>
<section>
<h2>The front door <span class="badge">v3</span></h2>
<p>Type <code>/dev-toolkit</code> and a sub-command. It routes to the right workflow, agents and skills.</p>
<ul class="ruled">${rows}</ul>
<p><a href="commands/">Full command reference</a></p>
</section>
<section>
<h2>The contract</h2>
<p>Four rules every skill assumes. Backend and frontend skills cross-reference each other so Claude finds the matching half.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="The contract"><table><thead><tr><th scope="col">Rule</th><th scope="col">On the wire</th></tr></thead><tbody>
<tr><td><a href="conventions/patch-only-updates/">Updates</a></td><td><code>PATCH</code> with changed fields only</td></tr>
<tr><td><a href="conventions/units/">Units</a></td><td>integer cents, meters, seconds; UTC timestamps</td></tr>
<tr><td><a href="conventions/error-envelope/">Errors</a></td><td><code>{ "messages": [...], "trace_id": ... }</code></td></tr>
<tr><td><a href="conventions/query-parameters/">Lists</a></td><td><code>limit</code>, <code>offset</code>, <code>ordering</code>, <code>from_</code> / <code>to_</code> filters</td></tr>
</tbody></table></div>
</section>
<section>
<h2>Browse</h2>
<ul class="ruled">
<li><a href="skills/"><span class="r-title">Skills</span><span class="r-desc">${skills.length} convention references, loaded automatically.</span></a></li>
<li><a href="agents/"><span class="r-title">Agents</span><span class="r-desc">${agents.length} planning and review subagents.</span></a></li>
<li><a href="cli/"><span class="r-title">CLI</span><span class="r-desc">Installer plus <code>detect</code>, <code>context</code> and <code>doctor</code>.</span></a></li>
<li><a href="hooks/"><span class="r-title">Hooks</span><span class="r-desc">Scripts that run on events, whether or not the model remembers.</span></a></li>
</ul>
</section>`;
    out("", layout(home, body, { home: true }));
  }

  // 404 (absolute-free; links back by relative root of the site if served at root)
  writeFileSync(join(DIST, "404.html"), layout({ url: "", title: "Not found", description: "" }, `<h1>Page not found</h1><p class="lede">That page does not exist. Try the search, or go to the <a href="./">home page</a>.</p>`, { home: true }));

  // Search index
  const index = items.filter((p) => !p.virtual).map((p) => {
    const toc = []; renderMarkdown(p.body, p, toc);
    return { t: p.title, u: p.url, k: p.section || "Page", d: splitDescription(p.description).summary || p.description, h: toc.map((x) => x.text).join(" | "), x: plainText(p.body).slice(0, 2500) };
  });
  index.push({ t: "Command reference", u: "commands/", k: "Commands", d: "Every slash command", h: "", x: "" }, { t: "Skills", u: "skills/", k: "Skills", d: "Convention references", h: "", x: "" }, { t: "Agents", u: "agents/", k: "Agents", d: "Planning and review subagents", h: "", x: "" });
  writeFileSync(join(DIST, "assets/search-index.json"), JSON.stringify(index));

  console.log(`Built ${written} pages into ${DIST} (${skills.length} skills, ${commandsSrc.length} commands + ${commandsV3.length} v3 commands, ${agents.length} agents)`);
}

build();

if (process.argv.includes("--serve")) {
  const port = Number(process.env.PORT || 4321);
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404, { "content-type": types[".html"] }).end(read(join(DIST, "404.html"))); return; }
    res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }).end(readFileSync(f));
  }).listen(port, () => console.log(`Preview: http://localhost:${port}/`));
}
