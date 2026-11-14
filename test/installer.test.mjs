import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "dev-toolkit.mjs");

/** Fixture source tree so tests do not depend on the real skills. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "dtk-"));
  const src = join(root, "src");
  mkdirSync(join(src, "skills/alpha"), { recursive: true });
  mkdirSync(join(src, "agents"), { recursive: true });
  mkdirSync(join(src, "commands"), { recursive: true });
  writeFileSync(join(src, "package.json"), '{"version":"9.9.9"}');
  writeFileSync(join(src, "skills/alpha/SKILL.md"), "---\nname: alpha\ndescription: \"Alpha rules. More.\"\n---\nv1\n");
  writeFileSync(join(src, "agents/a.md"), "agent v1\n");
  writeFileSync(join(src, "commands/c.md"), "command v1\n");
  const home = join(root, "home");
  const proj = join(root, "proj");
  mkdirSync(home); mkdirSync(proj);
  const run = (args, extra = {}) =>
    spawnSync(process.execPath, [BIN, ...args], {
      cwd: proj, encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, DEV_TOOLKIT_SOURCE: src, ...extra },
    });
  return { root, src, home, proj, run, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("install to user scope copies skills, agents and commands", () => {
  const f = fixture();
  const r = f.run(["install"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(f.home, ".claude/skills/alpha/SKILL.md")));
  assert.ok(existsSync(join(f.home, ".claude/agents/a.md")));
  assert.ok(existsSync(join(f.home, ".claude/commands/c.md")));
  assert.ok(existsSync(join(f.home, ".claude/.dev-toolkit-manifest.json")));
  f.cleanup();
});

test("project scope writes to ./.claude and not to HOME", () => {
  const f = fixture();
  assert.equal(f.run(["install", "--scope", "project"]).status, 0);
  assert.ok(existsSync(join(f.proj, ".claude/skills/alpha/SKILL.md")));
  assert.ok(!existsSync(join(f.home, ".claude")));
  f.cleanup();
});

test("--dry-run writes nothing", () => {
  const f = fixture();
  const r = f.run(["install", "--dry-run"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /\[dry-run\] create/);
  assert.ok(!existsSync(join(f.home, ".claude")));
  f.cleanup();
});

test("update applies upstream changes to untouched files", () => {
  const f = fixture();
  f.run(["install"]);
  writeFileSync(join(f.src, "agents/a.md"), "agent v2\n");
  const r = f.run(["update"]);
  assert.equal(r.status, 0);
  assert.equal(readFileSync(join(f.home, ".claude/agents/a.md"), "utf8"), "agent v2\n");
  f.cleanup();
});

test("user-edited files are not overwritten without --force", () => {
  const f = fixture();
  f.run(["install"]);
  const p = join(f.home, ".claude/agents/a.md");
  writeFileSync(p, "my edit\n");
  writeFileSync(join(f.src, "agents/a.md"), "agent v2\n");
  const r = f.run(["update"]);
  assert.match(r.stdout, /skip .*agents\/a\.md/);
  assert.equal(readFileSync(p, "utf8"), "my edit\n");
  assert.equal(f.run(["update", "--force"]).status, 0);
  assert.equal(readFileSync(p, "utf8"), "agent v2\n");
  f.cleanup();
});

test("pre-existing unmanaged file is preserved", () => {
  const f = fixture();
  mkdirSync(join(f.home, ".claude/commands"), { recursive: true });
  writeFileSync(join(f.home, ".claude/commands/c.md"), "mine\n");
  const r = f.run(["install"]);
  assert.match(r.stdout, /not managed/);
  assert.equal(readFileSync(join(f.home, ".claude/commands/c.md"), "utf8"), "mine\n");
  f.cleanup();
});

test("uninstall removes unmodified files, keeps edited ones, prunes empty dirs", () => {
  const f = fixture();
  f.run(["install"]);
  writeFileSync(join(f.home, ".claude/commands/c.md"), "edited\n");
  const r = f.run(["uninstall"]);
  assert.equal(r.status, 0);
  assert.ok(!existsSync(join(f.home, ".claude/skills")));
  assert.ok(!existsSync(join(f.home, ".claude/agents/a.md")));
  assert.equal(readFileSync(join(f.home, ".claude/commands/c.md"), "utf8"), "edited\n");
  assert.equal(f.run(["uninstall", "--force"]).status, 0);
  assert.ok(!existsSync(join(f.home, ".claude/commands/c.md")));
  assert.ok(!existsSync(join(f.home, ".claude/.dev-toolkit-manifest.json")));
  f.cleanup();
});

test("status reports modified, outdated and new files", () => {
  const f = fixture();
  f.run(["install"]);
  writeFileSync(join(f.home, ".claude/commands/c.md"), "edited\n");
  writeFileSync(join(f.src, "agents/a.md"), "agent v2\n");
  writeFileSync(join(f.src, "agents/b.md"), "new\n");
  const out = f.run(["status"]).stdout;
  assert.match(out, /modified\s+commands\/c\.md/);
  assert.match(out, /outdated\s+agents\/a\.md/);
  assert.match(out, /new\s+agents\/b\.md/);
  f.cleanup();
});

test("update removes files no longer shipped when untouched", () => {
  const f = fixture();
  f.run(["install"]);
  rmSync(join(f.src, "commands/c.md"));
  f.run(["update"]);
  assert.ok(!existsSync(join(f.home, ".claude/commands/c.md")));
  f.cleanup();
});

test("generic target installs to ./.agents and manages an AGENTS.md block", () => {
  const f = fixture();
  writeFileSync(join(f.proj, "AGENTS.md"), "# Mine\n");
  const r = f.run(["install", "--target", "generic", "--scope", "project"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(f.proj, ".agents/skills/alpha/SKILL.md")));
  const md = readFileSync(join(f.proj, "AGENTS.md"), "utf8");
  assert.match(md, /^# Mine/);
  assert.match(md, /`alpha`: Alpha rules/);
  f.run(["uninstall", "--target", "generic", "--scope", "project"]);
  assert.equal(readFileSync(join(f.proj, "AGENTS.md"), "utf8").trim(), "# Mine");
  assert.ok(!existsSync(join(f.proj, ".agents/skills")));
  f.cleanup();
});

test("--dir overrides the destination", () => {
  const f = fixture();
  const dest = join(f.root, "custom");
  assert.equal(f.run(["install", "--dir", dest]).status, 0);
  assert.ok(existsSync(join(dest, "skills/alpha/SKILL.md")));
  f.cleanup();
});

test("invalid options fail with a message", () => {
  const f = fixture();
  const r = f.run(["install", "--scope", "galaxy"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown --scope/);
  assert.equal(f.run(["bogus"]).status, 1);
  f.cleanup();
});

test("detect delegates to the skill script when present, errors clearly when absent", () => {
  const f = fixture();
  let r = f.run(["detect"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not present/);
  mkdirSync(join(f.src, "skills/dev-toolkit/scripts"), { recursive: true });
  writeFileSync(join(f.src, "skills/dev-toolkit/scripts/dev-toolkit.mjs"), "console.log('delegated:' + process.argv.slice(2).join(','))\n");
  r = f.run(["detect", "--json"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /delegated:detect,--json/);
  f.cleanup();
});

test("real repository tree installs cleanly", () => {
  const root = mkdtempSync(join(tmpdir(), "dtk-real-"));
  const r = spawnSync(process.execPath, [BIN, "install", "--dir", join(root, "out")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(root, "out/skills")));
  rmSync(root, { recursive: true, force: true });
});
