#!/usr/bin/env node
// dev-toolkit CLI: context, detect, commit-msg, hook, hooks, doctor.
// Node 18+, ESM, zero dependencies. Rules are derived from the plugin's convention skills.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
export const PLUGIN_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..")
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".venv", "venv", "env", "__pycache__", "migrations",
  ".next", "coverage", ".dev-toolkit", "fixtures", ".mypy_cache", ".pytest_cache", ".ruff_cache", "site-packages",
])
const SEV_ORDER = { error: 3, warn: 2, info: 1 }

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const posix = (p) => p.split(path.sep).join("/")
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return null }
}
const exists = (p) => { try { fs.accessSync(p); return true } catch { return false } }

function globToRegex(glob) {
  let re = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++ } else re += "[^/]*"
    } else if (c === "?") re += "[^/]"
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`(^|/)${re}$`)
}

/** Blank comments (and Python triple-quoted strings) keeping offsets and newlines intact. */
export function stripCode(text, lang) {
  const out = text.split("")
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== "\n") out[k] = " " }
  let i = 0
  const n = text.length
  if (lang === "py") {
    while (i < n) {
      const c = text[i]
      if (c === "#") { let j = i; while (j < n && text[j] !== "\n") j++; blank(i, j); i = j; continue }
      const tri = text.startsWith('"""', i) ? '"""' : text.startsWith("'''", i) ? "'''" : null
      if (tri) {
        const end = text.indexOf(tri, i + 3)
        const stop = end === -1 ? n : end + 3
        blank(i, stop); i = stop; continue
      }
      if (c === '"' || c === "'") {
        let j = i + 1
        while (j < n && text[j] !== c && text[j] !== "\n") { if (text[j] === "\\") j++; j++ }
        i = j + 1; continue
      }
      i++
    }
  } else {
    while (i < n) {
      const c = text[i]
      if (c === "/" && text[i + 1] === "/") { let j = i; while (j < n && text[j] !== "\n") j++; blank(i, j); i = j; continue }
      if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); const stop = e === -1 ? n : e + 2; blank(i, stop); i = stop; continue }
      if (c === '"' || c === "'") {
        let j = i + 1
        while (j < n && text[j] !== c && text[j] !== "\n") { if (text[j] === "\\") j++; j++ }
        i = j + 1; continue
      }
      if (c === "`") {
        let j = i + 1
        while (j < n && text[j] !== "`") { if (text[j] === "\\") j++; j++ }
        i = j + 1; continue
      }
      i++
    }
  }
  return out.join("")
}

function lineIndex(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1)
  return (offset) => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1 }
    return { line: lo + 1, column: offset - starts[lo] + 1 }
  }
}

// ---------------------------------------------------------------------------
// Rule context
// ---------------------------------------------------------------------------

const PY_LAYERS = [
  ["domain", "domain"], ["application", "application"], ["infrastructure", "infrastructure"],
  ["api", "api"], ["interfaces", "api"], ["presentation", "api"], ["views", "api"],
]

function pyLayer(rel) {
  const segs = rel.toLowerCase().split("/").slice(0, -1)
  for (const seg of segs) for (const [name, layer] of PY_LAYERS) if (seg === name) return layer
  return null
}

const isPyTest = (rel) => /(^|\/)(tests?|__tests__)\//.test(rel) || /(^|\/)(test_[^/]+|conftest|[^/]+_test)\.py$/.test(rel)
const isTsTest = (rel) => /\.(test|spec|stories)\.[jt]sx?$/.test(rel) || /(^|\/)(test|tests|__tests__|e2e)\//.test(rel)
const isGenerated = (text) => /@generated|auto-?generated|DO NOT EDIT/i.test(text.slice(0, 400))

function makeCtx(rel, text, project) {
  const ext = path.extname(rel).toLowerCase()
  const lang = ext === ".py" ? "py" : [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext) ? "ts" : null
  const code = lang ? stripCode(text, lang) : text
  return {
    rel, text, code, lang, ext, project: project || {},
    lines: code.split("\n"),
    at: lineIndex(text),
    layer: lang === "py" ? pyLayer(rel) : null,
    isTest: lang === "py" ? isPyTest(rel) : isTsTest(rel),
    inUi: /(^|\/)components\/ui\//.test(rel),
  }
}

const F = (ctx, offset, rule, severity, message, fix) => ({ rule, severity, ...ctx.at(offset), message, fix })
function eachMatch(ctx, regex, cb) {
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g")
  let m
  while ((m = re.exec(ctx.code))) { cb(m); if (m[0] === "") re.lastIndex++ }
}

// ---------------------------------------------------------------------------
// Project facts (lazy, bounded)
// ---------------------------------------------------------------------------

function walkFiles(dir, exts, limit = 600) {
  const out = []
  const stack = [dir]
  while (stack.length && out.length < limit) {
    const d = stack.pop()
    let entries = []
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".") { if (e.isDirectory()) continue }
      const full = path.join(d, e.name)
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) stack.push(full) }
      else if (exts.includes(path.extname(e.name))) out.push(full)
    }
  }
  return out
}

function makeProject(root, config) {
  let handler
  return {
    root, config: config || {},
    /** True when the backend registers its own exception handlers (HTTPException is then translated). */
    get hasErrorHandler() {
      if (handler !== undefined) return handler
      if (this.config.errorHandler !== undefined) return (handler = !!this.config.errorHandler)
      handler = false
      for (const f of walkFiles(root, [".py"], 400)) {
        try {
          if (fs.statSync(f).size > 300_000) continue
          const t = fs.readFileSync(f, "utf8")
          if (/exception_handler\s*\(|add_exception_handler\s*\(/.test(t)) { handler = true; break }
        } catch { /* ignore */ }
      }
      return handler
    },
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const MONEY_NAME = "(?:price|amount|cost|fee|fare|total|balance|salary|money|cents|distance|duration|meters|seconds|length)"
const EXCLUDE_WORDS = new Set(["rate", "ratio", "percent", "percentage", "pct", "score", "count", "lat", "lon", "lng", "latitude", "longitude", "id", "factor", "weight", "avg", "average", "threshold"])
const NAME_EXCLUDE = { test: (name) => name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split("_").some((w) => EXCLUDE_WORDS.has(w)) }

const RULES = []
const rule = (r) => RULES.push(r)

rule({
  id: "http-put-update", severity: "error", langs: ["py", "ts"], skill: "backend-api-design / frontend-data-fetching",
  summary: "Updates must use PATCH (never PUT or POST) with only the changed fields.",
  check(ctx) {
    const out = []
    const msg = "Partial updates use PATCH, never PUT/POST."
    if (ctx.lang === "py") {
      if (ctx.isTest) return out
      eachMatch(ctx, /@\w+\.put\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "error", msg, "Change the decorator to .patch() and accept only the fields being changed.")))
      eachMatch(ctx, /@\w+\.post\s*\(\s*["'][^"']*\/(update|edit)[^"']*["']/, (m) => out.push(F(ctx, m.index, this.id, "error", "POST used for an update.", "Use PATCH on the resource URL.")))
      eachMatch(ctx, /methods\s*=\s*\[[^\]]*["']PUT["']/, (m) => out.push(F(ctx, m.index, this.id, "error", msg, "Use methods=[\"PATCH\"].")))
      eachMatch(ctx, /^\s*def\s+put\s*\(\s*self/m, (m) => out.push(F(ctx, m.index, this.id, "error", msg, "Implement def patch(self, ...) instead of put.")))
      // DRF classes that expose PUT by default and do not restrict http_method_names.
      const re = /^class\s+(\w+)\s*\(([^)]*)\)\s*:/gm
      let m
      const starts = []
      while ((m = re.exec(ctx.code))) starts.push({ name: m[1], bases: m[2], index: m.index })
      starts.forEach((c, i) => {
        if (!/(ModelViewSet|UpdateModelMixin|UpdateAPIView|RetrieveUpdateAPIView|RetrieveUpdateDestroyAPIView)/.test(c.bases)) return
        const body = ctx.code.slice(c.index, i + 1 < starts.length ? starts[i + 1].index : undefined)
        if (!/http_method_names/.test(body)) out.push(F(ctx, c.index, this.id, "warn", `${c.name} exposes PUT by default.`, "Set http_method_names = [\"get\", \"post\", \"patch\", \"delete\", \"head\", \"options\"]."))
      })
    } else {
      if (ctx.isTest) return out
      eachMatch(ctx, /method\s*:\s*["'`]PUT["'`]/i, (m) => out.push(F(ctx, m.index, this.id, "error", msg, "Use method: \"PATCH\" with the changed fields.")))
      eachMatch(ctx, /(?<![\w$])(?:api|http|client|axios)\.put\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "error", msg, "Use PATCH through the typed client.")))
    }
    return out
  },
})

rule({
  id: "float-money-units", severity: "warn", langs: ["py"], skill: "backend-units-of-measurement",
  summary: "Money, distance and duration are integers (cents, meters, seconds), never float/Decimal.",
  check(ctx) {
    if (ctx.isTest) return []
    const out = []
    const re = new RegExp(
      `(?:^|[\\s,(])(\\w*${MONEY_NAME}\\w*)\\s*(?::\\s*(?:Mapped\\[\\s*)?(?:Optional\\[\\s*)?(float|Decimal)\\b|(?::[^=\\n]+)?=\\s*(?:\\w+\\.)*(?:(?:mapped_)?[Cc]olumn\\s*\\(\\s*(?:\\w+\\.)*)?(FloatField|DecimalField|Float|Numeric|Decimal)\\s*[(),])`,
      "gim",
    )
    let m
    while ((m = re.exec(ctx.code))) {
      const name = m[1]
      if (NAME_EXCLUDE.test(name)) continue
      out.push(F(ctx, m.index + m[0].indexOf(name), this.id, "warn", `"${name}" is a ${m[2] || m[3]}; units must be integers.`, "Store currency as integer cents, distance as meters, duration as seconds (IntegerField / int)."))
    }
    return out
  },
})

rule({
  id: "non-utc-datetime", severity: "warn", langs: ["py"], skill: "backend-units-of-measurement",
  summary: "Datetimes are timezone-aware UTC (%Y-%m-%dT%H:%M:%SZ).",
  check(ctx) {
    if (ctx.isTest) return []
    const out = []
    const hit = (m, why) => out.push(F(ctx, m.index, this.id, "warn", why, "Use datetime.now(UTC) (timezone-aware) and serialize as %Y-%m-%dT%H:%M:%SZ."))
    eachMatch(ctx, /\bdatetime\.utcnow\s*\(\s*\)/, (m) => hit(m, "datetime.utcnow() returns a naive datetime."))
    eachMatch(ctx, /\bdatetime\.(?:today|now)\s*\(\s*\)/, (m) => hit(m, `${m[0].replace(/\s+/g, "")} is naive local time.`))
    eachMatch(ctx, /\bdate\.today\s*\(\s*\)/, (m) => hit(m, "date.today() uses the machine timezone."))
    eachMatch(ctx, /\bdatetime\.fromtimestamp\s*\(([^()]*(?:\([^()]*\))?[^()]*)\)/, (m) => { if (!/tz\s*=|UTC|utc/.test(m[1])) hit(m, "datetime.fromtimestamp() without tz is naive.") })
    eachMatch(ctx, /\bdatetime\.now\s*\(([^()]+(?:\([^()]*\))?[^()]*)\)/, (m) => { if (!/UTC|utc/.test(m[1])) hit(m, "datetime.now() with a non-UTC timezone.") })
    eachMatch(ctx, /^\s*TIME_ZONE\s*=\s*["'](?!UTC["'])[^"']+["']/m, (m) => hit(m, "TIME_ZONE must be UTC."))
    return out
  },
})

const FRAMEWORKS_ALL = ["fastapi", "starlette", "django", "rest_framework", "sqlalchemy", "alembic", "requests", "httpx", "redis", "celery", "boto3", "psycopg", "psycopg2", "asyncpg", "pymongo", "aiohttp", "flask"]
const FRAMEWORKS_WEB = ["fastapi", "starlette", "django", "rest_framework", "flask"]

rule({
  id: "ddd-layer-violation", severity: "error", langs: ["py"], skill: "backend-microservices-directory-structure",
  summary: "Dependencies flow inward: api -> application -> domain <- infrastructure.",
  check(ctx) {
    if (ctx.isTest || (ctx.layer !== "domain" && ctx.layer !== "application")) return []
    const out = []
    const re = /^[ \t]*(?:from\s+(\.*[\w.]*)\s+import\s+([^\n(]+|\([^)]*\))|import\s+([\w., \t]+))/gm
    let m
    while ((m = re.exec(ctx.code))) {
      const mods = m[1] !== undefined ? [m[1]] : m[3].split(",").map((s) => s.trim().split(/\s+as\s+/)[0])
      for (const mod of mods) {
        const segs = mod.replace(/^\.+/, "").split(".").filter(Boolean)
        const root = segs[0]
        const outward = ctx.layer === "domain" ? ["infrastructure", "api", "interfaces", "presentation", "application", "views"] : ["infrastructure", "api", "interfaces", "presentation", "views"]
        const bad = segs.find((s) => outward.includes(s))
        const frameworks = ctx.layer === "domain" ? FRAMEWORKS_ALL : [...FRAMEWORKS_WEB, "sqlalchemy"]
        let why = null
        let sev = "error"
        if (bad) why = `${ctx.layer} imports "${mod}" (${bad} layer)`
        else if (frameworks.includes(root)) { why = `${ctx.layer} imports framework "${root}"`; if (ctx.layer === "application" && root === "sqlalchemy") sev = "warn" }
        if (why) out.push(F(ctx, m.index + m[0].indexOf(mod), this.id, sev, `${why}; dependencies must point inward.`, "Depend on an interface in domain/ (repositories.py) and implement it in infrastructure/."))
        else if (ctx.layer === "domain" && root === "pydantic") out.push(F(ctx, m.index, this.id, "warn", "domain imports pydantic; the domain layer should be pure Python.", "Use dataclasses in domain and Pydantic schemas in the api layer."))
      }
    }
    return out
  },
})

rule({
  id: "error-envelope", severity: "warn", langs: ["py"], skill: "backend-api-design",
  summary: "Errors go through the shared error envelope, not ad-hoc JSON bodies.",
  check(ctx) {
    if (ctx.isTest || ctx.layer === "domain") return []
    const out = []
    const handled = ctx.project.hasErrorHandler
    if (!handled) {
      eachMatch(ctx, /\braise\s+HTTPException\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "warn", "HTTPException bypasses the {messages:[...]} error envelope (no exception handler registered).", "Raise a domain/API exception and register a handler that renders the envelope (see backend-api-design).")))
    }
    eachMatch(ctx, /\b(?:JSONResponse|Response)\s*\(\s*(?:content\s*=\s*)?\{\s*["'](error|detail|message|errors)["']/, (m) => {
      const around = ctx.code.slice(m.index, m.index + 200)
      if (/status(?:_code)?\s*=\s*(?:status\.HTTP_)?[45]\d\d|status\.HTTP_[45]/.test(around) || /["']detail["']|["']error["']/.test(m[0])) {
        out.push(F(ctx, m.index, this.id, "warn", `Ad-hoc error body {"${m[1]}": ...} instead of the shared envelope.`, "Raise an exception handled by the envelope handler."))
      }
    })
    return out
  },
})

const BAD_QP = "page_size|per_page|perPage|sort_by|order_by|orderBy|sortBy|sort_order|sortOrder"
rule({
  id: "query-param-convention", severity: "warn", langs: ["py", "ts"], skill: "backend-url-query-params / frontend-data-tables",
  summary: "Pagination is limit/offset, sorting is ordering, filters use from_/to_/plural names (no Django __lookups).",
  check(ctx) {
    if (ctx.isTest) return []
    const out = []
    const lookup = /["']\w+__(gte|gt|lte|lt|in|isnull|icontains|contains|startswith|exact)["']/g
    if (ctx.lang === "py") {
      const apiish = ctx.layer === "api" || /(router|routes|views|filters?|endpoints)\.py$/.test(ctx.rel)
      if (!apiish) return out
      eachMatch(ctx, /Query\s*\([^)]*alias\s*=\s*["']\w+__\w+["']/, (m) => out.push(F(ctx, m.index, this.id, "warn", "Django-style __lookup exposed as a query param.", "Use from_/to_/above_/below_/plural names (backend-url-query-params).")))
      eachMatch(ctx, /request\.(?:query_params|GET)\.get\(\s*["']\w+__\w+["']/, (m) => out.push(F(ctx, m.index, this.id, "warn", "Django-style __lookup read from the query string.", "Use from_/to_/plural names.")))
      eachMatch(ctx, new RegExp(`^\\s*(${BAD_QP}|page|size|skip|sort|min_\\w+|max_\\w+|\\w+_from|\\w+_to|start_date|end_date)\\s*:\\s*[^=\\n]*(?:Query\\s*\\(|\\|\\s*None|Optional)`, "m"), (m) => {
        // only inside a function signature or a *Filters/*Params/*Query model
        const before = ctx.code.slice(Math.max(0, m.index - 400), m.index)
        const lastDef = Math.max(before.lastIndexOf("def "), before.search(/class\s+\w*(Filter|Params?|Query)\w*\s*\(/))
        if (lastDef === -1) return
        const name = m[1]
        const fix = /^(min_|max_)/.test(name) ? "Use from_<field>/to_<field>." : /_from$|_to$|date$/.test(name) ? "Use from_<field>/to_<field>." : /^(sort|order|sort_by|order_by|sortBy|orderBy|sort_order|sortOrder)$/.test(name) ? "Use `ordering` (\"-\" prefix = descending)." : "Use limit/offset for pagination."
        out.push(F(ctx, m.index + m[0].indexOf(name), this.id, "warn", `Non-standard query param "${name}".`, fix))
      })
      eachMatch(ctx, /page_size_query_param\s*=|\bPageNumberPagination\b/, (m) => out.push(F(ctx, m.index, this.id, "warn", "Page-number pagination; the convention is limit/offset.", "Use LimitOffsetPagination (limit, offset).")))
    } else {
      if (/(^|\/)lib\/api\//.test(ctx.rel)) return out
      eachMatch(ctx, new RegExp(`["'](${BAD_QP})["']|\\b(page_size|per_page|sort_by|order_by)\\s*:`), (m) => out.push(F(ctx, m.index, this.id, "warn", `Non-standard query param "${m[1] || m[2]}".`, "Pagination is limit/offset; sorting is `ordering` with a \"-\" prefix.")))
      eachMatch(ctx, lookup, (m) => out.push(F(ctx, m.index, this.id, "warn", `Django-style __lookup "${m[0]}" used as a query param.`, "Use from_/to_/above_/below_/plural names.")))
    }
    return out
  },
})

const API_CLIENT_FILE = /(^|\/)(lib\/api\/|app\/api(\.|\/)|api\/client|api-client|http-client|client\.ts$|sw\.ts$|vite\.config|\.config\.[mc]?[jt]s$)/
rule({
  id: "fetch-bypasses-client", severity: "error", langs: ["ts"], skill: "frontend-data-fetching",
  summary: "Components never call fetch/axios directly; use the typed client through feature api hooks.",
  check(ctx) {
    if (ctx.isTest || API_CLIENT_FILE.test(ctx.rel) || /(^|\/)public\//.test(ctx.rel)) return []
    const out = []
    eachMatch(ctx, /(?<![.\w$])fetch\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "error", "Direct fetch() call bypasses the typed API client.", "Add a query/mutation in features/<feature>/api/ that uses apiRequest/the shared client.")))
    eachMatch(ctx, /\bfrom\s+["'](axios|ky|ofetch|superagent)["']|\baxios\.(get|post|patch|delete|request)\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "error", "HTTP library used outside the single API client.", "Route the call through the typed client.")))
    return out
  },
})

const FORMAT_FILE = /(^|\/)(lib\/format|format|formatters?|i18n)(\.|\/)/
rule({
  id: "raw-format", severity: "warn", langs: ["ts"], skill: "frontend-units-and-formatting",
  summary: "Dates, money and numbers are formatted by lib/format helpers (Intl), not inline.",
  check(ctx) {
    if (ctx.isTest || FORMAT_FILE.test(ctx.rel) || ctx.inUi) return []
    const out = []
    eachMatch(ctx, /\.toLocale(?:Date|Time)?String\s*\(/, (m) => out.push(F(ctx, m.index, this.id, "warn", `${m[0]} formats inline with the machine locale.`, "Use formatDateTime/formatMoney from lib/format (Intl with explicit locale/timeZone).")))
    const notMoney = (m) => /percent|pct|progress|ratio/i.test(m[0])
    eachMatch(ctx, new RegExp(`\\b\\w*(?:cents?|amount|price|total|fee|balance)\\w*\\s*\\/\\s*100\\b`, "i"), (m) => notMoney(m) || out.push(F(ctx, m.index, this.id, "warn", "Inline cents -> currency conversion.", "Use formatMoney(cents, currency) from lib/format.")))
    eachMatch(ctx, /\b\w*(?:meters?|distance)\w*\s*\/\s*1000\b/i, (m) => out.push(F(ctx, m.index, this.id, "warn", "Inline meters -> km conversion.", "Use formatDistance(meters) from lib/format.")))
    eachMatch(ctx, /[€£¥]\s*\{|\}\s*[€£¥]|`\$\$\{|["']\s*[€£¥]\s*["']\s*\+|\+\s*["']\s*[€£¥]/, (m) => out.push(F(ctx, m.index, this.id, "warn", "Hardcoded currency symbol next to a value.", "Use Intl.NumberFormat via formatMoney with the resource currency code.")))
    eachMatch(ctx, /\b\w*(?:cents?|amount|price|total|fee|balance)\w*\s*\.toFixed\s*\(/i, (m) => notMoney(m) || out.push(F(ctx, m.index, this.id, "warn", "toFixed() used to format a money value.", "Use formatMoney(cents, currency).")))
    return out
  },
})

rule({
  id: "utc-iso-format", severity: "warn", langs: ["ts"], skill: "frontend-units-and-formatting",
  summary: "Backend datetimes are %Y-%m-%dT%H:%M:%SZ (no milliseconds): use toUtcIso.",
  check(ctx) {
    if (ctx.isTest || FORMAT_FILE.test(ctx.rel)) return []
    const out = []
    eachMatch(ctx, /\.toISOString\s*\(\s*\)(?!\s*\.(?:replace|slice|split|substring))/, (m) => {
      // allow date-only slices: .toISOString().slice(0, 10)
      out.push(F(ctx, m.index, this.id, "warn", "toISOString() adds milliseconds; the backend format has none.", "Use toUtcIso(date) from lib/format."))
    })
    return out
  },
})

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"
rule({
  id: "shadcn-ui-forbidden", severity: "error", langs: ["ts"], skill: "frontend-shadcn-ui",
  summary: "components/ui is vendored: no API calls, app state, or feature imports.",
  check(ctx) {
    if (!ctx.inUi) return []
    const out = []
    const bad = [
      [/(?<![.\w$])fetch\s*\(|\bapiRequest\s*\(/, "API call inside a vendored primitive"],
      [/\b(useQuery|useMutation|useQueryClient|useAuth|useNavigate|useSearchParams)\s*\(/, "app/server state hook inside a vendored primitive"],
      [/from\s+["']@\/(features|lib\/api|app)\b[^"']*["']/, "import from app code inside a vendored primitive"],
      [/from\s+["']@tanstack\/react-query["']|from\s+["']react-router[^"']*["']/, "app-level dependency inside a vendored primitive"],
      [/\buser\.(can|is|role|permissions?)\w*/, "permission logic inside a vendored primitive"],
    ]
    for (const [re, why] of bad) eachMatch(ctx, re, (m) => out.push(F(ctx, m.index, this.id, "error", `${why}.`, "Keep ui/ primitives generic; compose them in src/components/ or a feature.")))
    return out
  },
})

rule({
  id: "raw-palette-color", severity: "warn", langs: ["ts"], skill: "frontend-theming / frontend-shadcn-ui",
  summary: "Use semantic theme tokens, never raw palette colors.",
  check(ctx) {
    if (ctx.isTest) return []
    const out = []
    eachMatch(ctx, new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow|accent|decoration)-(?:${PALETTE})-\\d{2,3}(?:/\\d+)?\\b`), (m) => out.push(F(ctx, m.index, this.id, "warn", `Raw palette color "${m[0]}".`, "Use tokens such as bg-primary, text-muted-foreground, text-destructive (frontend-theming).")))
    return out
  },
})

rule({
  id: "class-concat", severity: "info", langs: ["ts"], skill: "frontend-shadcn-ui",
  summary: "Merge classes with cn(); declare variants with cva.",
  check(ctx) {
    if (ctx.isTest) return []
    const out = []
    eachMatch(ctx, /className\s*=\s*\{\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/, (m) => out.push(F(ctx, m.index, this.id, "info", "className built by string concatenation.", "Use cn() from @/lib/utils (and cva for variants).")))
    return out
  },
})

/** True when the tag sits inside an unclosed <Field label="..."> wrapper (custom wrapper wires the label). */
function insideLabelledField(code, index) {
  const before = code.slice(Math.max(0, index - 1500), index)
  const re = /<(\/?)Field(?=[\s>])([^>]*)>/g
  const stack = []
  let m
  while ((m = re.exec(before))) {
    if (m[1]) stack.pop()
    else if (!/\/\s*$/.test(m[2])) stack.push(m[2])
  }
  return stack.length > 0 && /\blabel\s*=/.test(stack[stack.length - 1])
}

function parseJsxTags(code, names) {
  const tags = []
  const re = new RegExp(`<(${names.join("|")})(?=[\\s/>])`, "g")
  let m
  while ((m = re.exec(code))) {
    let i = m.index + m[0].length, depth = 0, quote = null
    const start = i
    while (i < code.length) {
      const c = code[i]
      if (quote) { if (c === quote) quote = null }
      else if (c === '"' || c === "'") quote = c
      else if (c === "{") depth++
      else if (c === "}") depth--
      else if (c === ">" && depth <= 0) break
      i++
    }
    const attrs = code.slice(start, i)
    const selfClosing = code[i - 1] === "/"
    let children = ""
    if (!selfClosing) {
      const close = code.indexOf(`</${m[1]}>`, i)
      children = close === -1 ? "" : code.slice(i + 1, close)
    }
    tags.push({ name: m[1], index: m.index, attrs, selfClosing, children })
  }
  return tags
}

rule({
  id: "a11y-label", severity: "warn", langs: ["ts"], skill: "frontend-accessibility",
  summary: "Interactive controls need accessible names; dialogs need titles; no clickable divs.",
  check(ctx) {
    if (ctx.ext !== ".tsx" && ctx.ext !== ".jsx") return []
    if (ctx.isTest && !/\.stories\./.test(ctx.rel)) return []
    const out = []
    const tags = parseJsxTags(ctx.code, ["Button", "button", "IconButton", "Toggle", "Input", "input", "Textarea", "textarea", "SelectTrigger", "img", "Image", "div", "span", "li", "p"])
    for (const t of tags) {
      const hasSpread = /\{\s*\.\.\.\s*\w+\s*\}/.test(t.attrs) && /\{\s*\.\.\.\s*(props|rest|restProps|others)\s*\}/.test(t.attrs)
      if (/^(Button|button|IconButton|Toggle)$/.test(t.name)) {
        if (hasSpread || t.selfClosing) continue
        const named = /aria-label(ledby)?\s*=|\btitle\s*=/.test(t.attrs)
        const text = t.children.replace(/<[A-Za-z][^<>]*\/>/g, "").replace(/<[^<>]+>/g, "").trim()
        const sizeIcon = /size\s*=\s*\{?\s*["']icon/.test(t.attrs)
        const onlyIcons = /<[A-Z]\w*[^<>]*\/>/.test(t.children) && text === ""
        if ((sizeIcon || onlyIcons) && !named && text === "" && !/sr-only/.test(t.children)) {
          out.push(F(ctx, t.index, this.id, "warn", `Icon-only <${t.name}> has no accessible name.`, "Add aria-label=\"...\" (or a visually hidden <span className=\"sr-only\">)."))
        }
      } else if (/^(Input|input|Textarea|textarea|SelectTrigger)$/.test(t.name)) {
        if (ctx.inUi || hasSpread) continue
        if (insideLabelledField(ctx.code, t.index)) continue
        if (/type\s*=\s*["'](hidden|submit|button|reset)["']/.test(t.attrs)) continue
        if (!/\bid\s*=|aria-label(ledby)?\s*=/.test(t.attrs)) out.push(F(ctx, t.index, this.id, "warn", `<${t.name}> has no id/aria-label, so no label can be linked.`, "Pair it with <FieldLabel htmlFor> and an id (frontend-forms), or add aria-label."))
      } else if (t.name === "img" || t.name === "Image") {
        if (!/\balt\s*=/.test(t.attrs) && !hasSpread) out.push(F(ctx, t.index, this.id, "warn", "<img> without alt.", "Add alt text, or alt=\"\" when decorative."))
      } else if (/^(div|span|li|p)$/.test(t.name)) {
        if (/\bonClick\s*=/.test(t.attrs) && !/\brole\s*=/.test(t.attrs) && !hasSpread) out.push(F(ctx, t.index, this.id, "warn", `<${t.name} onClick> is not keyboard accessible.`, "Use <button> (or Button), or add role, tabIndex and key handlers."))
      }
    }
    if (!ctx.inUi) {
      for (const [content, title] of [["DialogContent", "DialogTitle"], ["SheetContent", "SheetTitle"], ["AlertDialogContent", "AlertDialogTitle"], ["DrawerContent", "DrawerTitle"]]) {
        const idx = ctx.code.search(new RegExp(`<${content}[\\s>]`))
        const tagText = idx === -1 ? "" : (parseJsxTags(ctx.code.slice(idx), [content])[0]?.attrs ?? "")
        if (idx !== -1 && !ctx.code.includes(`<${title}`) && !/\btitle\s*=/.test(tagText)) out.push(F(ctx, idx, this.id, "warn", `<${content}> without <${title}>.`, `Add <${title}> (use className="sr-only" if it must be hidden).`))
      }
      eachMatch(ctx, /className\s*=\s*(?:\{\s*)?["'`][^"'`\n]*\boutline-none\b[^"'`\n]*["'`]/, (m) => {
        const tagStart = ctx.code.lastIndexOf("<", m.index)
        const tagText = ctx.code.slice(tagStart === -1 ? m.index : tagStart, m.index + m[0].length + 200)
        const programmatic = /tabIndex\s*=\s*\{?\s*["']?-1/.test(tagText) // focus target for skip links / route changes
        if (!/focus|ring|data-\[(highlighted|selected|state)/.test(m[0]) && !programmatic) out.push(F(ctx, m.index, this.id, "warn", "outline-none removes the focus indicator without a replacement.", "Use focus-visible:ring-* (the theme ring token)."))
      })
    }
    return out
  },
})

// ---------------------------------------------------------------------------
// Commit message check
// ---------------------------------------------------------------------------

const CORE_TYPES = ["feat", "fix", "test", "docs"]
const EXTRA_TYPES = ["refactor", "chore", "style", "perf", "build", "ci", "revert"]

export function checkCommitMessage(message) {
  const findings = []
  const lines = message.replace(/\r/g, "").split("\n").filter((l, i, a) => !(l.startsWith("#") && i >= 0)).map((l) => l)
  const title = (lines.find((l) => l.trim() !== "") || "").trim()
  const f = (severity, msg, fix) => findings.push({ rule: "commit-msg", severity, file: "COMMIT_EDITMSG", line: 1, column: 1, message: msg, fix })
  if (!title) { f("error", "Empty commit message."); return findings }
  if (/^(Merge|Revert|fixup!|squash!)\b/.test(title)) return findings
  const m = title.match(/^(?:(:[\w-]+:|\p{Extended_Pictographic}️?)\s*)?(\w+)\(([\w\-./]*)\)(!)?: (.+)$/u)
  if (!m) {
    f("error", `Title "${title}" does not match "[gitmoji ]type(scope): description".`, "Example: ✨ feat(searcher): add travel options endpoint")
  } else {
    const type = m[2].toLowerCase()
    if (!CORE_TYPES.includes(type)) {
      if (EXTRA_TYPES.includes(type)) f("warn", `Type "${type}" is not in the gitlint regex (${CORE_TYPES.join("|")}).`, "Use feat, fix, test or docs, or extend .gitlint.")
      else f("error", `Unknown commit type "${m[2]}".`, `Use one of: ${CORE_TYPES.join(", ")}.`)
    }
    if (m[2] !== type) f("error", "Commit type must be lowercase.")
    if (title.length > 100) f("warn", `Title is ${title.length} characters; keep it short.`)
  }
  const body = lines.join("\n")
  if (!/^Refs:\s*\S+/m.test(body)) f("warn", "Missing mandatory footer \"Refs: <Task>\".", "Add a footer such as: Refs: SMP-1234")
  return findings
}

// ---------------------------------------------------------------------------
// Config, analysis, detection
// ---------------------------------------------------------------------------

export function findRoot(from) {
  let dir = path.resolve(from)
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir) } catch { dir = path.dirname(dir) }
  const start = dir
  for (;;) {
    if (exists(path.join(dir, ".dev-toolkit")) || exists(path.join(dir, ".git"))) return dir
    const up = path.dirname(dir)
    if (up === dir) return start
    dir = up
  }
}

export function loadConfig(root) {
  const cfg = readJson(path.join(root, ".dev-toolkit", "config.json")) || {}
  return {
    hooks: cfg.hooks === "off" || cfg.hooks === false ? "off" : "on",
    ignoreRules: Array.isArray(cfg.ignoreRules) ? cfg.ignoreRules : [],
    ignoreFiles: Array.isArray(cfg.ignoreFiles) ? cfg.ignoreFiles : [],
    severity: cfg.severity && typeof cfg.severity === "object" ? cfg.severity : {},
    errorHandler: cfg.errorHandler,
    _raw: cfg,
  }
}

export const listRules = () => RULES.map(({ id, severity, langs, skill, summary }) => ({ id, severity, langs, skill, summary })).concat([{ id: "commit-msg", severity: "error", langs: [], skill: "backend-commits", summary: "Commit message: [gitmoji ]type(scope): description + Refs footer." }])

/** Analyze one in-memory file. `rel` is the posix path relative to the project root. */
export function analyze({ rel, text, project, config }) {
  const ctx = makeCtx(rel, text, project)
  if (!ctx.lang || isGenerated(text)) return []
  const cfg = config || { ignoreRules: [], severity: {} }
  const fileIgnore = text.match(/dev-toolkit-ignore-file(?:\s+([\w,\- ]+))?/)
  const rawLines = text.split("\n")
  const out = []
  for (const r of RULES) {
    if (!r.langs.includes(ctx.lang) || cfg.ignoreRules.includes(r.id)) continue
    if (fileIgnore && (!fileIgnore[1] || fileIgnore[1].split(/[\s,]+/).includes(r.id))) continue
    let found = []
    try { found = r.check.call(r, ctx) } catch (e) { found = [] }
    for (const f of found) {
      const here = rawLines[f.line - 1] || "", prev = rawLines[f.line - 2] || ""
      const sup = /dev-toolkit-ignore(?!-file)(?:\s+([\w,\- ]+))?/
      const s = here.match(sup) || prev.match(sup)
      if (s && (!s[1] || s[1].split(/[\s,]+/).includes(f.rule))) continue
      const sev = cfg.severity[f.rule] || f.severity
      if (sev === "off") continue
      out.push({ ...f, severity: sev, file: rel })
    }
  }
  return out.sort((a, b) => a.line - b.line || a.column - b.column)
}

function collectTargets(targets, root, ignoreFiles) {
  const files = []
  const ignoreRes = ignoreFiles.map(globToRegex)
  const addFile = (abs) => {
    const rel = posix(path.relative(root, abs))
    if (ignoreRes.some((re) => re.test(rel))) return
    files.push(abs)
  }
  for (const t of targets) {
    const abs = path.resolve(t)
    let st
    try { st = fs.statSync(abs) } catch { continue }
    if (st.isFile()) addFile(abs)
    else for (const f of walkFiles(abs, [".py", ".ts", ".tsx", ".js", ".jsx", ".mjs"], 5000)) addFile(f)
  }
  return files
}

export function detect({ targets, root, useConfig = true, minSeverity = "info", ruleFilter = null }) {
  const config = useConfig ? loadConfig(root) : { ignoreRules: [], ignoreFiles: [], severity: {} }
  const project = makeProject(root, config)
  const files = collectTargets(targets, root, config.ignoreFiles)
  const findings = []
  let scanned = 0
  for (const abs of files) {
    let text
    try { if (fs.statSync(abs).size > 1_000_000) continue; text = fs.readFileSync(abs, "utf8") } catch { continue }
    scanned++
    const rel = posix(path.relative(root, abs))
    for (const f of analyze({ rel, text, project, config })) {
      if (SEV_ORDER[f.severity] < SEV_ORDER[minSeverity]) continue
      if (ruleFilter && !ruleFilter.includes(f.rule)) continue
      findings.push(f)
    }
  }
  return { scanned, findings }
}

// ---------------------------------------------------------------------------
// Context (stack detection)
// ---------------------------------------------------------------------------

function git(root, args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim() } catch { return null }
}

function readText(file) { try { return fs.readFileSync(file, "utf8") } catch { return "" } }

function inspectProject(dir, root) {
  const rel = posix(path.relative(root, dir)) || "."
  const pkg = readJson(path.join(dir, "package.json"))
  const py = ["pyproject.toml", "requirements.txt", "requirements/base.txt", "setup.py", "Pipfile"].map((f) => readText(path.join(dir, f))).join("\n").toLowerCase()
  const stacks = []
  const features = {}
  if (py) {
    if (/\bfastapi\b/.test(py)) stacks.push("fastapi")
    if (/djangorestframework|rest_framework/.test(py)) stacks.push("drf")
    else if (/\bdjango\b/.test(py)) stacks.push("django")
    if (stacks.includes("django") || stacks.includes("drf")) {
      const hint = (readText(path.join(dir, "README.md")) + py + dir).toLowerCase()
      if (/\bdaas\b|data as a service/.test(hint)) stacks.push("django-daas")
    }
    if (/sqlalchemy/.test(py)) features.sqlalchemy = true
    if (/pydantic/.test(py)) features.pydantic = true
  }
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    const has = (n) => Object.prototype.hasOwnProperty.call(deps, n)
    if (has("react") && has("vite")) stacks.push("react-vite")
    else if (has("react")) stacks.push("react")
    if (exists(path.join(dir, "components.json"))) features.shadcn = true
    for (const [k, n] of [["tailwind", "tailwindcss"], ["tanstackQuery", "@tanstack/react-query"], ["tanstackTable", "@tanstack/react-table"], ["reactHookForm", "react-hook-form"], ["zod", "zod"], ["vitest", "vitest"], ["msw", "msw"]]) if (has(n)) features[k] = true
  }
  if (!stacks.length) return null
  const layers = new Set()
  const srcDirs = ["src", "app", "apps", "."].map((d) => path.join(dir, d)).filter((d) => exists(d))
  let dddHits = 0
  for (const s of srcDirs.slice(0, 1)) {
    for (const f of walkFiles(s, [".py"], 300)) {
      const l = pyLayer(posix(path.relative(dir, f)))
      if (l) { layers.add(l); dddHits++ }
    }
  }
  const layout = {}
  layout.topLevel = (() => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name)).map((e) => e.name).slice(0, 20) } catch { return [] } })()
  if (stacks.some((s) => s.startsWith("react"))) {
    layout.features = (() => { try { return fs.readdirSync(path.join(dir, "src", "features")) } catch { return [] } })()
    layout.featureBased = layout.features.length > 0
  }
  if (layers.size) layout.dddLayers = [...layers].sort()
  return { path: rel, stacks, features, layout, ddd: layers.has("domain") && layers.has("application") }
}

const STACK_SKILLS = {
  fastapi: ["backend-fastapi", "backend-api-design", "backend-url-query-params", "backend-units-of-measurement", "backend-microservices-directory-structure", "backend-commits"],
  drf: ["backend-django-drf", "backend-api-design", "backend-url-query-params", "backend-units-of-measurement", "backend-microservices-directory-structure", "backend-permission-management", "backend-commits"],
  django: ["backend-django-drf", "backend-microservices-baas-daas", "backend-units-of-measurement", "backend-commits"],
  "django-daas": ["backend-microservices-baas-daas", "backend-chassis-pattern"],
  "react-vite": ["frontend-directory-structure", "frontend-shadcn-ui", "frontend-data-fetching", "frontend-forms", "frontend-data-tables", "frontend-units-and-formatting", "frontend-accessibility", "frontend-theming", "frontend-testing"],
  react: ["frontend-accessibility", "frontend-data-fetching", "frontend-testing"],
}

export function buildContext(cwd) {
  const root = findRoot(cwd)
  const candidates = new Set([root])
  for (const sub of ["backend", "frontend", "web", "api", "server", "client", "app"]) candidates.add(path.join(root, sub))
  for (const group of ["apps", "services", "packages"]) {
    try { for (const e of fs.readdirSync(path.join(root, group), { withFileTypes: true })) if (e.isDirectory() && !SKIP_DIRS.has(e.name)) candidates.add(path.join(root, group, e.name)) } catch { /* none */ }
  }
  try { for (const e of fs.readdirSync(root, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name)) candidates.add(path.join(root, e.name)) } catch { /* none */ }
  const projects = [...candidates].filter(exists).map((d) => inspectProject(d, root)).filter(Boolean)
  const stacks = [...new Set(projects.flatMap((p) => p.stacks))]
  const skills = [...new Set(stacks.flatMap((s) => STACK_SKILLS[s] || []))]
  const config = loadConfig(root)
  const gitInfo = git(root, ["rev-parse", "--is-inside-work-tree"]) === "true"
    ? {
        isRepo: true,
        branch: git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
        dirtyFiles: (git(root, ["status", "--porcelain"]) || "").split("\n").filter(Boolean).length,
        lastCommit: git(root, ["log", "-1", "--pretty=%h %s"]),
      }
    : { isRepo: false }
  const files = {
    config: exists(path.join(root, ".dev-toolkit", "config.json")),
    contextJson: exists(path.join(root, ".dev-toolkit", "context.json")),
    conventionsMd: exists(path.join(root, "CONVENTIONS.md")),
    claudeMd: exists(path.join(root, "CLAUDE.md")),
  }
  const directives = []
  if (!stacks.length) directives.push("No supported stack detected (FastAPI, DRF, Django DaaS, React+Vite+shadcn). Use `/dev-toolkit plan` to start, or `/dev-toolkit scaffold` for a frontend.")
  for (const p of projects) {
    if (p.stacks.some((s) => ["fastapi", "drf", "django"].includes(s)) && !p.ddd) directives.push(`${p.path}: no DDD layers found (domain/application/infrastructure); see skill backend-microservices-directory-structure before adding code.`)
    if (p.stacks.some((s) => s.startsWith("react")) && !p.features.shadcn) directives.push(`${p.path}: no components.json; shadcn/ui is not initialised (see /dev-toolkit scaffold).`)
    if (p.stacks.some((s) => s.startsWith("react")) && p.layout.featureBased === false) directives.push(`${p.path}: no src/features/; follow frontend-directory-structure for new code.`)
  }
  if (stacks.length) directives.push("Load only the convention skills for the files you touch (list in `skills`).")
  if (!files.contextJson && stacks.length) directives.push("No .dev-toolkit/context.json: run `/dev-toolkit document` after the first build.")
  if (config.hooks === "off") directives.push("Edit hook is OFF for this project (.dev-toolkit/config.json).")
  if (gitInfo.isRepo && gitInfo.dirtyFiles > 0) directives.push(`Working tree has ${gitInfo.dirtyFiles} uncommitted file(s); \`/dev-toolkit review --changed\` audits them.`)
  directives.push("Run `node <skill-dir>/scripts/dev-toolkit.mjs detect <paths>` before finishing a change.")
  return { root, stacks, projects, skills, git: gitInfo, files, hooks: config.hooks, directives }
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export function runDoctor(cwd, pluginRoot = PLUGIN_ROOT) {
  const checks = []
  const add = (level, name, detail) => checks.push({ level, name, detail })
  const nodeMajor = Number(process.versions.node.split(".")[0])
  add(nodeMajor >= 18 ? "ok" : "error", "node", `Node ${process.versions.node} (needs 18+)`)

  const plugin = readJson(path.join(pluginRoot, ".claude-plugin", "plugin.json"))
  if (!plugin) add("error", "plugin.json", "missing or invalid .claude-plugin/plugin.json")
  else {
    add("ok", "plugin.json", `${plugin.name}@${plugin.version}`)
    if (!plugin.skills) add("warn", "plugin.json", "no \"skills\" path declared")
    else if (!exists(path.join(pluginRoot, plugin.skills))) add("error", "plugin.json", `skills path ${plugin.skills} does not exist`)
    if (plugin.hooks && typeof plugin.hooks === "string" && !exists(path.join(pluginRoot, plugin.hooks))) add("error", "plugin.json", `hooks file ${plugin.hooks} does not exist`)
  }
  const market = readJson(path.join(pluginRoot, ".claude-plugin", "marketplace.json"))
  if (!market) add("warn", "marketplace.json", "missing or invalid")
  else {
    const entry = (market.plugins || []).find((p) => p.name === plugin?.name)
    if (!entry) add("error", "marketplace.json", "plugin entry not found")
    else if (entry.version && plugin && entry.version !== plugin.version) add("error", "marketplace.json", `version ${entry.version} != plugin.json ${plugin.version}`)
    else add("ok", "marketplace.json", "consistent with plugin.json")
  }

  const skillFile = path.join(pluginRoot, "skills", "dev-toolkit", "SKILL.md")
  const skillText = readText(skillFile)
  if (!skillText) add("error", "orchestrator", "skills/dev-toolkit/SKILL.md missing")
  else {
    const v = skillText.match(/^version:\s*([\w.\-]+)/m)
    if (v && plugin && v[1] !== plugin.version) add("error", "orchestrator", `SKILL.md version ${v[1]} != plugin.json ${plugin.version}`)
    const refs = [...skillText.matchAll(/reference\/([\w\-]+\.md)/g)].map((m) => m[1])
    const missing = [...new Set(refs)].filter((r) => !exists(path.join(pluginRoot, "skills", "dev-toolkit", "reference", r)))
    add(missing.length ? "error" : "ok", "reference files", missing.length ? `missing: ${missing.join(", ")}` : `${new Set(refs).size} routed files present`)
    const refDir = path.join(pluginRoot, "skills", "dev-toolkit", "reference")
    const orphan = (exists(refDir) ? fs.readdirSync(refDir) : []).filter((f) => f.endsWith(".md") && !refs.includes(f))
    if (orphan.length) add("warn", "reference files", `not routed from SKILL.md: ${orphan.join(", ")}`)
  }
  add(exists(path.join(SCRIPT_DIR, "dev-toolkit.mjs")) ? "ok" : "error", "cli", "scripts/dev-toolkit.mjs")

  const hooksFile = path.join(pluginRoot, "hooks", "hooks.json")
  const hooks = readJson(hooksFile)
  if (!hooks) add("warn", "hooks", "hooks/hooks.json missing or invalid")
  else {
    const cmds = JSON.stringify(hooks)
    add(/dev-toolkit\.mjs/.test(cmds) ? "ok" : "warn", "hooks", /dev-toolkit\.mjs/.test(cmds) ? "PostToolUse hook wired to the CLI" : "hooks.json does not call dev-toolkit.mjs")
  }

  const skillsDir = path.join(pluginRoot, "skills")
  let skillCount = 0
  for (const d of exists(skillsDir) ? fs.readdirSync(skillsDir) : []) {
    const f = path.join(skillsDir, d, "SKILL.md")
    if (!exists(f)) continue
    skillCount++
    const fm = readText(f).match(/^---\n([\s\S]*?)\n---/)
    const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1].trim()
    if (!fm || name !== d) add("error", `skill ${d}`, `frontmatter name "${name ?? "-"}" must equal the directory name`)
  }
  add("ok", "skills", `${skillCount} skills`)
  for (const kind of ["agents", "commands"]) {
    const dir = path.join(pluginRoot, kind)
    let bad = 0, n = 0
    for (const f of exists(dir) ? fs.readdirSync(dir) : []) {
      if (!f.endsWith(".md")) continue
      n++
      const t = readText(path.join(dir, f))
      if (!/^---\n[\s\S]*?description:/.test(t)) bad++
    }
    add(bad ? "info" : "ok", kind, bad ? `${bad} of ${n} without frontmatter description` : `${n} files`)
  }

  // Project drift
  const root = findRoot(cwd)
  const cfgFile = path.join(root, ".dev-toolkit", "config.json")
  if (exists(cfgFile)) {
    const raw = readJson(cfgFile)
    if (!raw) add("error", "project config", ".dev-toolkit/config.json is not valid JSON")
    else {
      const known = new Set(listRules().map((r) => r.id))
      const unknown = (raw.ignoreRules || []).filter((r) => !known.has(r))
      add(unknown.length ? "warn" : "ok", "project config", unknown.length ? `unknown ignoreRules: ${unknown.join(", ")}` : `hooks ${raw.hooks === "off" || raw.hooks === false ? "off" : "on"}`)
    }
  } else add("info", "project config", "no .dev-toolkit/config.json (defaults apply)")
  const ctxFile = path.join(root, ".dev-toolkit", "context.json")
  const saved = readJson(ctxFile)
  if (saved) {
    const live = buildContext(cwd)
    const a = [...(saved.stacks || [])].sort().join(","), b = [...live.stacks].sort().join(",")
    add(a === b ? "ok" : "warn", "context.json", a === b ? "stacks match the code" : `drift: saved stacks [${a}] vs detected [${b}]; run /dev-toolkit document`)
  } else add("info", "context.json", "not generated yet (/dev-toolkit document)")
  if (exists(path.join(root, ".dev-toolkit")) && !exists(path.join(root, "CONVENTIONS.md")) && saved) add("warn", "CONVENTIONS.md", "context.json exists but CONVENTIONS.md is missing")
  return checks
}

// ---------------------------------------------------------------------------
// Hook entry (PostToolUse on Edit/Write). Never blocks, never throws.
// ---------------------------------------------------------------------------

const HOOK_EXTS = new Set([".py", ".ts", ".tsx", ".js", ".jsx"])

export function hookFindings(input, env = process.env) {
  if (env.DEV_TOOLKIT_HOOKS === "off") return null
  const file = input?.tool_input?.file_path || input?.tool_response?.filePath
  if (!file || !HOOK_EXTS.has(path.extname(file).toLowerCase())) return null
  const abs = path.resolve(input.cwd || process.cwd(), file)
  if (/(^|[\\/])(node_modules|\.git|dist|build|\.venv|fixtures)[\\/]/.test(abs)) return null
  const root = findRoot(abs)
  const config = loadConfig(root)
  if (config.hooks === "off") return null
  const stackish = ["pyproject.toml", "requirements.txt", "package.json", "manage.py"].some((f) => exists(path.join(root, f)) || exists(path.join(path.dirname(abs), "..", f)))
  if (!stackish && !exists(path.join(root, ".dev-toolkit"))) return null
  const rel = posix(path.relative(root, abs))
  if (globsMatch(config.ignoreFiles, rel)) return null
  let text
  try { if (fs.statSync(abs).size > 400_000) return null; text = fs.readFileSync(abs, "utf8") } catch { return null }
  const findings = analyze({ rel, text, project: makeProject(root, config), config }).filter((f) => f.severity !== "info")
  if (!findings.length) return null
  const shown = findings.slice(0, 5).map((f) => `- ${f.file}:${f.line} [${f.rule}] ${f.message}${f.fix ? ` Fix: ${f.fix}` : ""}`)
  if (findings.length > 5) shown.push(`- ...and ${findings.length - 5} more (run \`dev-toolkit.mjs detect ${rel}\`)`)
  return `dev-toolkit: ${findings.length} convention finding(s) in the file you just edited. Fix them in your next edit, or silence with \`dev-toolkit-ignore <rule>\` / .dev-toolkit/config.json.\n${shown.join("\n")}`
}

const globsMatch = (globs, rel) => globs.some((g) => globToRegex(g).test(rel))

function runHook() {
  let raw = ""
  try { raw = fs.readFileSync(0, "utf8") } catch { /* no stdin */ }
  try {
    const input = raw ? JSON.parse(raw) : {}
    const msg = hookFindings(input)
    if (msg) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }) + "\n")
  } catch { /* never block */ }
  process.exit(0)
}

// ---------------------------------------------------------------------------
// hooks on|off|status, ignore
// ---------------------------------------------------------------------------

function writeConfig(root, mutate) {
  const file = path.join(root, ".dev-toolkit", "config.json")
  const cfg = readJson(file) || {}
  mutate(cfg)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n")
  return file
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {}, rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=")
      if (v !== undefined) flags[k] = v
      else if (["severity", "rule", "fail-on", "m", "cwd"].includes(k) && argv[i + 1] && !argv[i + 1].startsWith("--")) flags[k] = argv[++i]
      else flags[k] = true
    } else if (a === "-m" && argv[i + 1] !== undefined) flags.m = argv[++i]
    else rest.push(a)
  }
  return { flags, rest }
}

function formatFindings(findings, scanned) {
  if (!findings.length) return `dev-toolkit detect: no findings (${scanned} files scanned).`
  const lines = findings.map((f) => `${f.file}:${f.line}:${f.column}  ${f.severity.padEnd(5)}  ${f.rule}  ${f.message}${f.fix ? `\n    fix: ${f.fix}` : ""}`)
  const counts = { error: 0, warn: 0, info: 0 }
  findings.forEach((f) => counts[f.severity]++)
  return `${lines.join("\n")}\n\n${findings.length} finding(s): ${counts.error} error, ${counts.warn} warn, ${counts.info} info (${scanned} files scanned).`
}

function changedFiles(root) {
  const a = git(root, ["diff", "--name-only", "HEAD"]) || ""
  const b = git(root, ["ls-files", "--others", "--exclude-standard"]) || ""
  return [...new Set((a + "\n" + b).split("\n").filter(Boolean))].map((f) => path.join(root, f)).filter(exists)
}

const HELP = `dev-toolkit CLI
  context [--json]                     Detect stack, layout, git state and which conventions apply
  detect [paths] [--json] [--changed] [--severity warn] [--rule id] [--fail-on error|warn|never] [--no-config] [--list-rules]
  commit-msg <file> | -m "message"     Check a commit message (gitmoji + conventional + Refs footer)
  hooks on|off|status                  Toggle the PostToolUse hook for this project
  ignore rule <id> | file <glob>       Add an ignore to .dev-toolkit/config.json
  doctor [--json]                      Check plugin files, versions and project config drift
  hook                                 (internal) PostToolUse entry point, reads JSON on stdin`

export function main(argv, io = { out: (s) => process.stdout.write(s + "\n"), err: (s) => process.stderr.write(s + "\n") }) {
  const [cmd, ...args] = argv
  const { flags, rest } = parseArgs(args)
  const cwd = process.cwd()
  switch (cmd) {
    case "context": {
      const ctx = buildContext(flags.cwd || cwd)
      if (flags.json) io.out(JSON.stringify(ctx, null, 2))
      else { io.out(JSON.stringify(ctx, null, 2)); io.out("\nDirectives:\n" + ctx.directives.map((d) => `- ${d}`).join("\n")) }
      return 0
    }
    case "detect": {
      if (flags["list-rules"]) { io.out(flags.json ? JSON.stringify(listRules(), null, 2) : listRules().map((r) => `${r.id.padEnd(26)} ${r.severity.padEnd(5)} ${r.summary}`).join("\n")); return 0 }
      const base = rest[0] ? path.resolve(rest[0]) : cwd
      const root = findRoot(base)
      let targets = rest.length ? rest : [cwd]
      if (flags.changed) targets = changedFiles(root)
      if (flags["commit-msg"]) { const f = checkCommitMessage(readText(String(flags["commit-msg"]))); io.out(flags.json ? JSON.stringify({ findings: f }, null, 2) : formatFindings(f, 1)); return f.some((x) => x.severity === "error") ? 1 : 0 }
      const { scanned, findings } = detect({ targets, root, useConfig: !flags["no-config"], minSeverity: typeof flags.severity === "string" ? flags.severity : "info", ruleFilter: typeof flags.rule === "string" ? flags.rule.split(",") : null })
      io.out(flags.json ? JSON.stringify({ root, scanned, findings }, null, 2) : formatFindings(findings, scanned))
      const failOn = typeof flags["fail-on"] === "string" ? flags["fail-on"] : "error"
      if (failOn === "never") return 0
      return findings.some((f) => SEV_ORDER[f.severity] >= SEV_ORDER[failOn]) ? 1 : 0
    }
    case "commit-msg": {
      const msg = flags.m !== undefined ? String(flags.m) : rest[0] ? readText(rest[0]) : ""
      const findings = checkCommitMessage(msg)
      io.out(flags.json ? JSON.stringify({ findings }, null, 2) : formatFindings(findings, 1))
      return findings.some((f) => f.severity === "error") ? 1 : 0
    }
    case "hooks": {
      const root = findRoot(cwd)
      const action = rest[0] || "status"
      if (action === "on" || action === "off") {
        const file = writeConfig(root, (c) => { c.hooks = action })
        io.out(`dev-toolkit hooks ${action} (${posix(path.relative(cwd, file)) || file})`)
      } else if (action === "status") {
        const c = loadConfig(root)
        io.out(JSON.stringify({ hooks: c.hooks, env: process.env.DEV_TOOLKIT_HOOKS || null, ignoreRules: c.ignoreRules, ignoreFiles: c.ignoreFiles, config: path.join(root, ".dev-toolkit", "config.json") }, null, 2))
      } else { io.err("Usage: hooks on|off|status"); return 2 }
      return 0
    }
    case "ignore": {
      const root = findRoot(cwd)
      const [kind, value] = rest
      if (!["rule", "file"].includes(kind) || !value) { io.err("Usage: ignore rule <id> | ignore file <glob>"); return 2 }
      if (kind === "rule" && !listRules().some((r) => r.id === value)) { io.err(`Unknown rule "${value}". See detect --list-rules.`); return 2 }
      writeConfig(root, (c) => { const key = kind === "rule" ? "ignoreRules" : "ignoreFiles"; c[key] = [...new Set([...(c[key] || []), value])] })
      io.out(`Added ${kind} ignore: ${value}`)
      return 0
    }
    case "doctor": {
      const checks = runDoctor(flags.cwd || cwd)
      if (flags.json) io.out(JSON.stringify(checks, null, 2))
      else io.out(checks.map((c) => `${{ ok: "OK   ", warn: "WARN ", error: "ERROR", info: "INFO " }[c.level]} ${c.name}: ${c.detail}`).join("\n"))
      return checks.some((c) => c.level === "error") ? 1 : 0
    }
    case "hook": return runHook()
    case undefined: case "help": case "--help": io.out(HELP); return 0
    default: io.err(`Unknown command "${cmd}".\n${HELP}`); return 2
  }
}

const invoked = process.argv[1] && (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)) } catch { return false } })()
if (invoked) process.exitCode = main(process.argv.slice(2))
