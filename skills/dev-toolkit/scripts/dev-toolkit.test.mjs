import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  analyze, buildContext, checkCommitMessage, detect, hookFindings, listRules, main, runDoctor, stripCode, PLUGIN_ROOT,
} from "./dev-toolkit.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIX = path.join(HERE, "fixtures")

function filesIn(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...filesIn(full))
    else out.push(full)
  }
  return out
}

/** Analyze every file of a fixture variant ("bad", "good", ...) with the variant dir as project root. */
function scanVariant(caseName, variant) {
  const root = path.join(FIX, caseName, variant)
  const { findings } = detect({ targets: [root], root, useConfig: false })
  return findings
}

// [fixture case, rule id, minimum findings expected in bad]
const CASES = [
  ["http-put-update-py", "http-put-update", 2],
  ["http-put-update-ts", "http-put-update", 1],
  ["float-money-units", "float-money-units", 4],
  ["non-utc-datetime", "non-utc-datetime", 6],
  ["ddd-layer-violation", "ddd-layer-violation", 5],
  ["error-envelope", "error-envelope", 2],
  ["query-param-convention-py", "query-param-convention", 4],
  ["query-param-convention-ts", "query-param-convention", 3],
  ["fetch-bypasses-client", "fetch-bypasses-client", 2],
  ["raw-format", "raw-format", 4],
  ["utc-iso-format", "utc-iso-format", 1],
  ["shadcn-ui-forbidden", "shadcn-ui-forbidden", 3],
  ["raw-palette-color", "raw-palette-color", 3],
  ["class-concat", "class-concat", 1],
  ["a11y-label", "a11y-label", 6],
]

for (const [name, ruleId, min] of CASES) {
  test(`rule ${ruleId}: fixture ${name} (bad flags, good is clean)`, () => {
    const bad = scanVariant(name, "bad").filter((f) => f.rule === ruleId)
    assert.ok(bad.length >= min, `expected >= ${min} ${ruleId} findings, got ${bad.length}: ${JSON.stringify(bad.map((f) => [f.file, f.line, f.message]))}`)
    for (const f of bad) {
      assert.ok(f.line >= 1 && f.column >= 1 && f.file && f.message, "finding has location and message")
    }
    const good = scanVariant(name, "good")
    assert.deepEqual(good, [], `good fixture must be clean, got ${JSON.stringify(good)}`)
  })
}

test("error-envelope: HTTPException is fine when a project exception handler exists", () => {
  const root = path.join(FIX, "error-envelope", "good-handler")
  const { findings } = detect({ targets: [root], root, useConfig: false })
  assert.deepEqual(findings, [])
})

test("every rule has at least one fixture", () => {
  const covered = new Set(CASES.map((c) => c[1]).concat("commit-msg"))
  for (const r of listRules()) assert.ok(covered.has(r.id), `rule ${r.id} has no fixture`)
})

test("a11y-label: findings point at the right lines", () => {
  const f = scanVariant("a11y-label", "bad").filter((x) => x.rule === "a11y-label")
  const lines = f.map((x) => x.line)
  assert.ok(lines.includes(6) && lines.includes(7) && lines.includes(8) && lines.includes(9) && lines.includes(10), `lines ${lines}`)
})

test("ddd-layer-violation: severities (framework error, pydantic warn)", () => {
  const r = analyze({ rel: "apps/x/domain/e.py", text: "import pydantic\nfrom dataclasses import dataclass\n" })
  assert.equal(r.length, 1)
  assert.equal(r[0].severity, "warn")
  const app = analyze({ rel: "apps/x/application/s.py", text: "from sqlalchemy.orm import Session\n" })
  assert.equal(app[0].severity, "warn")
  const dom = analyze({ rel: "apps/x/domain/e.py", text: "from sqlalchemy import Column\n" })
  assert.equal(dom[0].severity, "error")
})

test("false-positive guards: percent is not cents, tabIndex=-1 may drop outline, Field label wrapper", () => {
  assert.deepEqual(analyze({ rel: "src/a.tsx", text: "const w = progress_percent / 100\n" }), [])
  assert.deepEqual(analyze({ rel: "src/a.tsx", text: "const x = <main tabIndex={-1} className=\"outline-none\">x</main>\n" }), [])
  assert.deepEqual(analyze({ rel: "src/a.tsx", text: "const x = <Field label=\"Email\"><Input type=\"email\" /></Field>\n" }), [])
  assert.deepEqual(analyze({ rel: "src/a.tsx", text: "const x = <DialogContent title=\"Hi\"><p/></DialogContent>\n" }), [])
  assert.deepEqual(analyze({ rel: "src/b.ts", text: "const x = api.refetch()\nconst y = globalThis.fetch\n" }), [])
  assert.deepEqual(analyze({ rel: "svc/a.py", text: "# datetime.utcnow()\n\"\"\"datetime.now()\"\"\"\n" }), [])
})

test("stripCode blanks comments but keeps offsets and strings", () => {
  const src = "a = 'x # y'  # c\nb = 1\n"
  const out = stripCode(src, "py")
  assert.equal(out.length, src.length)
  assert.ok(out.includes("'x # y'"))
  assert.ok(!out.includes("# c"))
  const ts = stripCode("const u = \"http://x\" // c\n/* m */ fetch(1)", "ts")
  assert.ok(ts.includes("http://x") && !ts.includes("// c") && !ts.includes("/* m */"))
})

test("inline suppression and file suppression", () => {
  const line = analyze({ rel: "svc/a.py", text: "x = datetime.utcnow()  # dev-toolkit-ignore non-utc-datetime\n" })
  assert.deepEqual(line, [])
  const prev = analyze({ rel: "svc/a.py", text: "# dev-toolkit-ignore\nx = datetime.utcnow()\n" })
  assert.deepEqual(prev, [])
  const file = analyze({ rel: "svc/a.py", text: "# dev-toolkit-ignore-file non-utc-datetime\nx = datetime.utcnow()\n" })
  assert.deepEqual(file, [])
  const other = analyze({ rel: "svc/a.py", text: "x = datetime.utcnow()  # dev-toolkit-ignore float-money-units\n" })
  assert.equal(other.length, 1)
})

test("config: ignoreRules, ignoreFiles and severity override", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-cfg-"))
  fs.mkdirSync(path.join(dir, ".dev-toolkit"))
  fs.mkdirSync(path.join(dir, "svc"))
  fs.writeFileSync(path.join(dir, "svc", "a.py"), "x = datetime.utcnow()\n")
  fs.writeFileSync(path.join(dir, "svc", "b.py"), "y = datetime.utcnow()\n")
  const run = () => detect({ targets: [dir], root: dir }).findings
  assert.equal(run().length, 2)
  fs.writeFileSync(path.join(dir, ".dev-toolkit", "config.json"), JSON.stringify({ ignoreFiles: ["svc/b.py"] }))
  assert.deepEqual(run().map((f) => f.file), ["svc/a.py"])
  fs.writeFileSync(path.join(dir, ".dev-toolkit", "config.json"), JSON.stringify({ ignoreRules: ["non-utc-datetime"] }))
  assert.equal(run().length, 0)
  fs.writeFileSync(path.join(dir, ".dev-toolkit", "config.json"), JSON.stringify({ severity: { "non-utc-datetime": "error" } }))
  assert.equal(run()[0].severity, "error")
})

test("commit-msg check", () => {
  assert.deepEqual(checkCommitMessage("✨ feat(searcher): add travel options endpoint\n\nRefs: SMP-1234\n"), [])
  assert.deepEqual(checkCommitMessage(":sparkles: fix(api): handle empty body\n\nRefs: X-1"), [])
  assert.deepEqual(checkCommitMessage("feat(api): no emoji is fine\n\nRefs: X-1"), [])
  const bad = checkCommitMessage("added some stuff")
  assert.ok(bad.some((f) => f.severity === "error"))
  const noRefs = checkCommitMessage("feat(api): ok title")
  assert.equal(noRefs.length, 1)
  assert.equal(noRefs[0].severity, "warn")
  assert.ok(checkCommitMessage("wat(api): x\n\nRefs: 1").some((f) => f.severity === "error"))
  assert.equal(checkCommitMessage("chore(deps): bump\n\nRefs: 1")[0].severity, "warn")
  assert.deepEqual(checkCommitMessage("Merge branch 'x'"), [])
})

test("CLI: detect --json, exit codes, commit-msg via fixtures", () => {
  const out = []
  const io = { out: (s) => out.push(s), err: (s) => out.push(s) }
  const bad = path.join(FIX, "http-put-update-py", "bad")
  const code = main(["detect", bad, "--json"], io)
  assert.equal(code, 1)
  const parsed = JSON.parse(out.join("\n"))
  assert.ok(parsed.findings.every((f) => f.file && f.rule && f.severity))
  out.length = 0
  assert.equal(main(["detect", path.join(FIX, "http-put-update-py", "good")], io), 0)
  assert.equal(main(["commit-msg", path.join(FIX, "commit-msg", "bad.txt")], io), 1)
  assert.equal(main(["commit-msg", path.join(FIX, "commit-msg", "good.txt")], io), 0)
  assert.equal(main(["nope"], io), 2)
})

test("detect --list-rules lists every rule with a skill source", () => {
  const rules = listRules()
  assert.ok(rules.length >= 13)
  for (const r of rules) assert.ok(r.skill && r.summary && r.id)
})

test("hook: surfaces findings concisely, respects hooks off and ignoreFiles, never throws", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-hook-"))
  fs.mkdirSync(path.join(dir, ".git"))
  fs.writeFileSync(path.join(dir, "pyproject.toml"), "[project]\ndependencies=['fastapi']\n")
  fs.mkdirSync(path.join(dir, "api"))
  const file = path.join(dir, "api", "router.py")
  fs.writeFileSync(file, "@router.put('/x')\ndef f(): ...\n")
  const input = { tool_name: "Edit", tool_input: { file_path: file }, cwd: dir }
  const msg = hookFindings(input, {})
  assert.match(msg, /http-put-update/)
  assert.ok(msg.split("\n").length <= 8)
  assert.equal(hookFindings(input, { DEV_TOOLKIT_HOOKS: "off" }), null)
  fs.mkdirSync(path.join(dir, ".dev-toolkit"))
  fs.writeFileSync(path.join(dir, ".dev-toolkit", "config.json"), JSON.stringify({ hooks: "off" }))
  assert.equal(hookFindings(input, {}), null)
  fs.writeFileSync(path.join(dir, ".dev-toolkit", "config.json"), JSON.stringify({ ignoreFiles: ["api/**"] }))
  assert.equal(hookFindings(input, {}), null)
  assert.equal(hookFindings({ tool_input: { file_path: path.join(dir, "README.md") } }, {}), null)
  assert.equal(hookFindings({}, {}), null)
  assert.equal(hookFindings({ tool_input: { file_path: "/nonexistent/file.py" } }, {}), null)
})

test("hook is fast on a single file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-fast-"))
  fs.mkdirSync(path.join(dir, ".git"))
  fs.writeFileSync(path.join(dir, "package.json"), "{}")
  const file = path.join(dir, "a.tsx")
  fs.writeFileSync(file, "export const A = () => <div>hi</div>\n".repeat(2000))
  const t = performance.now()
  hookFindings({ tool_input: { file_path: file }, cwd: dir }, {})
  assert.ok(performance.now() - t < 500, "hook analysis under 500ms")
})

test("hooks on/off/status and ignore write .dev-toolkit/config.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-toggle-"))
  fs.mkdirSync(path.join(dir, ".git"))
  const prev = process.cwd()
  process.chdir(dir)
  try {
    const out = []
    const io = { out: (s) => out.push(s), err: (s) => out.push(s) }
    assert.equal(main(["hooks", "off"], io), 0)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".dev-toolkit", "config.json"), "utf8")).hooks, "off")
    assert.equal(main(["hooks", "on"], io), 0)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".dev-toolkit", "config.json"), "utf8")).hooks, "on")
    assert.equal(main(["ignore", "rule", "class-concat"], io), 0)
    assert.equal(main(["ignore", "rule", "does-not-exist"], io), 2)
    assert.equal(main(["ignore", "file", "legacy/**"], io), 0)
    out.length = 0
    main(["hooks", "status"], io)
    const status = JSON.parse(out.join("\n"))
    assert.deepEqual(status.ignoreRules, ["class-concat"])
    assert.deepEqual(status.ignoreFiles, ["legacy/**"])
  } finally { process.chdir(prev) }
})

function tmpProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-ctx-"))
  fs.mkdirSync(path.join(dir, ".git"))
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), content)
  }
  return dir
}

test("context: detects FastAPI + DDD layers", () => {
  const dir = tmpProject({
    "pyproject.toml": "[project]\ndependencies = ['fastapi', 'sqlalchemy', 'pydantic']\n",
    "src/app/trip/domain/trip.py": "x = 1\n",
    "src/app/trip/application/uc.py": "x = 1\n",
    "src/app/trip/infrastructure/repo.py": "x = 1\n",
  })
  const ctx = buildContext(dir)
  assert.deepEqual(ctx.stacks, ["fastapi"])
  assert.equal(ctx.projects[0].ddd, true)
  assert.ok(ctx.skills.includes("backend-fastapi"))
  assert.ok(ctx.directives.length > 0)
})

test("context: detects DRF, Django DaaS and a React+Vite+shadcn monorepo", () => {
  const dir = tmpProject({
    "backend/pyproject.toml": "[project]\nname='x-daas'\ndependencies = ['django', 'djangorestframework']\n",
    "frontend/package.json": JSON.stringify({ dependencies: { react: "19", zod: "4", "@tanstack/react-query": "5" }, devDependencies: { vite: "8", vitest: "3" } }),
    "frontend/components.json": "{}",
    "frontend/src/features/vehicles/api/keys.ts": "export {}\n",
  })
  const ctx = buildContext(dir)
  assert.ok(ctx.stacks.includes("drf") && ctx.stacks.includes("react-vite") && ctx.stacks.includes("django-daas"))
  const fe = ctx.projects.find((p) => p.path === "frontend")
  assert.equal(fe.features.shadcn, true)
  assert.equal(fe.layout.featureBased, true)
  assert.deepEqual(fe.layout.features, ["vehicles"])
  assert.equal(ctx.git.isRepo, false) // .git is an empty dir, not a worktree
})

test("context: unsupported project yields a directive and no stacks", () => {
  const dir = tmpProject({ "README.md": "hi" })
  const ctx = buildContext(dir)
  assert.deepEqual(ctx.stacks, [])
  assert.match(ctx.directives[0], /No supported stack/)
})

test("doctor: the plugin itself is healthy", () => {
  const checks = runDoctor(PLUGIN_ROOT)
  const errors = checks.filter((c) => c.level === "error")
  assert.deepEqual(errors, [], JSON.stringify(errors))
})

test("doctor: reports broken plugin layout and project config drift", () => {
  const plugin = tmpProject({ ".claude-plugin/plugin.json": JSON.stringify({ name: "dev-toolkit", version: "9.9.9", skills: "./nope/" }) })
  const checks = runDoctor(plugin, plugin)
  assert.ok(checks.some((c) => c.level === "error" && c.name === "plugin.json"))
  assert.ok(checks.some((c) => c.level === "error" && c.name === "orchestrator"))

  const proj = tmpProject({
    "pyproject.toml": "[project]\ndependencies=['fastapi']\n",
    ".dev-toolkit/config.json": JSON.stringify({ ignoreRules: ["ghost-rule"] }),
    ".dev-toolkit/context.json": JSON.stringify({ stacks: ["react-vite"] }),
  })
  const drift = runDoctor(proj, PLUGIN_ROOT)
  assert.ok(drift.some((c) => c.name === "project config" && c.level === "warn"))
  assert.ok(drift.some((c) => c.name === "context.json" && c.level === "warn"))
})
