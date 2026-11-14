#!/usr/bin/env node
// dev-toolkit installer and CLI front door. Zero dependencies.
import { createHash } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, rmdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(process.env.DEV_TOOLKIT_SOURCE || join(HERE, ".."));
const MANIFEST = ".dev-toolkit-manifest.json";
const BLOCK_START = "<!-- dev-toolkit:start -->";
const BLOCK_END = "<!-- dev-toolkit:end -->";

const HELP = `dev-toolkit: skills, agents and commands for full-stack development

Usage
  npx dev-toolkit <command> [options]

Installer
  install     Copy skills, agents, commands and hooks into a tool's folder
  update      Re-sync installed files with this version (same rules as install)
  uninstall   Remove the files this tool installed (only unmodified ones)
  status      Show installed files and whether they were edited or are outdated

CLI (delegated to skills/dev-toolkit/scripts/dev-toolkit.mjs)
  detect      Detect the project's stack
  context     Print the project context used by /dev-toolkit commands
  doctor      Check the project and the install for problems

Options
  --target <claude|generic>  Where to install (default: claude)
  --scope <user|project>     user = ~/.claude, project = ./.claude (default: user)
  --dir <path>               Override the destination folder (generic: default ./.agents)
  --dry-run                  Print what would change, write nothing
  --force                    Overwrite or remove files even if you edited them
  -h, --help                 Show this help
  -v, --version              Show the version

Files you edited are never overwritten or deleted without --force.
`;

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const posix = (p) => p.split(sep).join("/");

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h") out.flags.help = true;
    else if (a === "-v") out.flags.version = true;
    else if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (["dry-run", "force", "help", "version"].includes(k)) out.flags[k] = true;
      else out.flags[k] = v ?? argv[++i];
    } else out._.push(a);
  }
  return out;
}

function walk(dir, base = dir) {
  const res = [];
  if (!existsSync(dir)) return res;
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (name === ".DS_Store" || name === "node_modules") continue;
    if (statSync(full).isDirectory()) res.push(...walk(full, base));
    else res.push(relative(base, full));
  }
  return res;
}

/** Map of destination-relative path -> absolute source path. */
function plan(target) {
  const files = {};
  const add = (srcDir, destDir) => {
    for (const rel of walk(join(SOURCE, srcDir))) files[posix(join(destDir, rel))] = join(SOURCE, srcDir, rel);
  };
  add("skills", "skills");
  add("agents", "agents");
  add("commands", "commands");
  add("hooks", target === "claude" ? "hooks/dev-toolkit" : "hooks");
  return files;
}

function resolveBase(flags) {
  const target = flags.target || "claude";
  if (!["claude", "generic"].includes(target)) fail(`Unknown --target "${target}" (use claude or generic)`);
  const scope = flags.scope || "user";
  if (!["user", "project"].includes(scope)) fail(`Unknown --scope "${scope}" (use user or project)`);
  const folder = target === "claude" ? ".claude" : ".agents";
  const base = flags.dir
    ? resolve(flags.dir)
    : scope === "user" ? join(homedir(), folder) : join(process.cwd(), folder);
  return { target, scope, base };
}

function fail(msg, code = 1) {
  console.error(`dev-toolkit: ${msg}`);
  process.exit(code);
}

function loadManifest(base) {
  try {
    return JSON.parse(readFileSync(join(base, MANIFEST), "utf8"));
  } catch {
    return { version: null, files: {}, agentsMd: null };
  }
}

function version() {
  return JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf8")).version;
}

function agentsBlock() {
  const skills = readdirSync(join(SOURCE, "skills")).filter((d) => existsSync(join(SOURCE, "skills", d, "SKILL.md")));
  const lines = skills.map((s) => {
    const m = readFileSync(join(SOURCE, "skills", s, "SKILL.md"), "utf8").match(/^description:\s*(.+)$/m);
    const d = (m ? m[1] : "").replace(/^["']|["']$/g, "");
    return `- \`${s}\`: ${d.split(/\. /)[0].replace(/\.$/, "")}`;
  });
  return [
    BLOCK_START,
    "## dev-toolkit conventions",
    "",
    "Before backend or frontend work, read the matching convention file in `.agents/skills/<name>/SKILL.md`:",
    "",
    ...lines,
    BLOCK_END,
  ].join("\n");
}

function log(dry, msg) {
  console.log(`${dry ? "[dry-run] " : ""}${msg}`);
}

function install(flags, verb) {
  const dry = !!flags["dry-run"];
  const force = !!flags.force;
  const { target, scope, base } = resolveBase(flags);
  const manifest = loadManifest(base);
  const files = plan(target);
  if (!Object.keys(files).length) fail(`nothing to install: no skills/agents/commands found in ${SOURCE}`);
  const next = { ...manifest.files };
  const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, removed: 0 };

  for (const [rel, src] of Object.entries(files)) {
    const dest = join(base, rel);
    const data = readFileSync(src);
    const h = sha(data);
    if (!existsSync(dest)) {
      log(dry, `create   ${rel}`);
      if (!dry) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, data); }
      next[rel] = h; counts.created++;
      continue;
    }
    const cur = sha(readFileSync(dest));
    if (cur === h) { next[rel] = h; counts.unchanged++; continue; }
    const tracked = manifest.files[rel];
    if (force || (tracked && tracked === cur)) {
      log(dry, `update   ${rel}${force && tracked !== cur ? " (forced, local edits lost)" : ""}`);
      if (!dry) writeFileSync(dest, data);
      next[rel] = h; counts.updated++;
    } else {
      log(dry, `skip     ${rel} (${tracked ? "edited locally" : "exists and is not managed"}; use --force)`);
      counts.skipped++;
    }
  }

  // Files removed upstream: delete if untouched.
  for (const [rel, tracked] of Object.entries(manifest.files)) {
    if (files[rel]) continue;
    const dest = join(base, rel);
    if (!existsSync(dest)) { delete next[rel]; continue; }
    if (force || sha(readFileSync(dest)) === tracked) {
      log(dry, `remove   ${rel} (no longer shipped)`);
      if (!dry) rmSync(dest);
      delete next[rel]; counts.removed++;
    } else {
      log(dry, `keep     ${rel} (no longer shipped, but edited locally)`);
    }
  }

  let agentsMd = manifest.agentsMd;
  if (target === "generic" && scope === "project" && !flags.dir) {
    const p = join(process.cwd(), "AGENTS.md");
    const block = agentsBlock();
    const existing = existsSync(p) ? readFileSync(p, "utf8") : "";
    const re = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`);
    const m = existing.match(re);
    const edited = m && manifest.agentsMd && sha(m[0]) !== manifest.agentsMd;
    if (edited && !force) log(dry, "skip     AGENTS.md block (edited locally; use --force)");
    else if (m && m[0] === block) agentsMd = sha(block);
    else {
      log(dry, `${m ? "update" : "create"}   AGENTS.md (managed block)`);
      if (!dry) {
        const out = m ? existing.replace(re, () => block) : `${existing}${existing && !existing.endsWith("\n\n") ? "\n\n" : ""}${block}\n`;
        writeFileSync(p, out);
      }
      agentsMd = sha(block);
    }
  }

  if (!dry) {
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, MANIFEST), JSON.stringify({ version: version(), target, files: next, agentsMd }, null, 2) + "\n");
  }
  console.log(`\n${dry ? "Would " : ""}${verb}: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.skipped} skipped, ${counts.removed} removed`);
  console.log(`Destination: ${base}`);
  if (counts.skipped) console.log("Some files were skipped because they differ from what was installed. Re-run with --force to overwrite them.");
  if (target === "claude" && Object.keys(files).some((f) => f.startsWith("hooks/"))) {
    console.log("Hooks were copied to hooks/dev-toolkit/. Register them in settings.json, or install the plugin from the marketplace to get them wired automatically.");
  }
  if (target === "claude") console.log("Restart Claude Code to load the new skills, agents and commands.");
}

function pruneEmpty(dir, stop) {
  while (dir.startsWith(stop) && dir !== stop) {
    try { if (readdirSync(dir).length) return; rmdirSync(dir); } catch { return; }
    dir = dirname(dir);
  }
}

function uninstall(flags) {
  const dry = !!flags["dry-run"];
  const force = !!flags.force;
  const { base } = resolveBase(flags);
  const manifest = loadManifest(base);
  if (!Object.keys(manifest.files).length) { console.log(`Nothing to uninstall in ${base} (no manifest).`); return; }
  let removed = 0, kept = 0;
  const left = {};
  for (const [rel, tracked] of Object.entries(manifest.files)) {
    const dest = join(base, rel);
    if (!existsSync(dest)) continue;
    if (force || sha(readFileSync(dest)) === tracked) {
      log(dry, `remove   ${rel}`);
      if (!dry) { rmSync(dest); pruneEmpty(dirname(dest), base); }
      removed++;
    } else {
      log(dry, `keep     ${rel} (edited locally; use --force)`);
      left[rel] = tracked; kept++;
    }
  }
  if (manifest.agentsMd) {
    const p = join(process.cwd(), "AGENTS.md");
    if (existsSync(p)) {
      const text = readFileSync(p, "utf8");
      const re = new RegExp(`\\n*${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`);
      const m = text.match(re);
      if (m && (force || sha(m[0].trim()) === manifest.agentsMd)) {
        log(dry, "remove   AGENTS.md managed block");
        if (!dry) writeFileSync(p, text.replace(re, "\n").replace(/^\n+/, "") || "");
      } else if (m) log(dry, "keep     AGENTS.md block (edited locally; use --force)");
    }
  }
  if (!dry) {
    if (kept) writeFileSync(join(base, MANIFEST), JSON.stringify({ ...manifest, files: left }, null, 2) + "\n");
    else rmSync(join(base, MANIFEST), { force: true });
  }
  console.log(`\n${dry ? "Would remove" : "Removed"} ${removed} file(s), kept ${kept}.`);
}

function status(flags) {
  const { target, base } = resolveBase(flags);
  const manifest = loadManifest(base);
  const files = plan(target);
  const rows = { ok: 0, modified: 0, missing: 0, outdated: 0, new: 0 };
  for (const [rel, tracked] of Object.entries(manifest.files)) {
    const dest = join(base, rel);
    let state = "ok";
    if (!existsSync(dest)) state = "missing";
    else if (sha(readFileSync(dest)) !== tracked) state = "modified";
    else if (files[rel] && sha(readFileSync(files[rel])) !== tracked) state = "outdated";
    rows[state]++;
    if (state !== "ok") console.log(`${state.padEnd(9)}${rel}`);
  }
  for (const rel of Object.keys(files)) if (!manifest.files[rel]) { rows.new++; console.log(`${"new".padEnd(9)}${rel}`); }
  console.log(`\nDestination: ${base}`);
  console.log(`Installed version: ${manifest.version ?? "none"} (package ${version()})`);
  console.log(Object.entries(rows).map(([k, v]) => `${v} ${k}`).join(", "));
}

function delegate(cmd, rest) {
  const candidates = [join(SOURCE, "skills/dev-toolkit/scripts/dev-toolkit.mjs")];
  const script = candidates.find(existsSync);
  if (!script) {
    fail(`"${cmd}" needs skills/dev-toolkit/scripts/dev-toolkit.mjs, which is not present in this version (${SOURCE}).`, 2);
  }
  const r = spawnSync(process.execPath, [script, cmd, ...rest], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const { _: pos, flags } = parseArgs(process.argv.slice(2));
const cmd = pos[0];
if (flags.version) { console.log(version()); process.exit(0); }
if (!cmd || flags.help || cmd === "help") { console.log(HELP); process.exit(cmd || flags.help ? 0 : 1); }
switch (cmd) {
  case "install": install(flags, "install"); break;
  case "update": install(flags, "update"); break;
  case "uninstall": uninstall(flags); break;
  case "status": status(flags); break;
  case "detect": case "context": case "doctor": delegate(cmd, process.argv.slice(3)); break;
  default: fail(`unknown command "${cmd}". Run with --help.`);
}
