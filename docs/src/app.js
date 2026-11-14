// dev-toolkit docs: theme, drawer, copy buttons, tabs, search. No dependencies.
(function () {
  var root = document.documentElement;
  var base = document.body.getAttribute("data-root") || "./";
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // theme
  document.querySelector(".theme-btn").addEventListener("click", function () {
    var dark = getComputedStyle(root).colorScheme.indexOf("dark") === 0 || root.getAttribute("data-theme") === "dark";
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("dtk-theme", next);
  });

  // drawer
  var menu = document.querySelector(".menu-btn");
  menu.addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    menu.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) { document.body.classList.remove("nav-open"); menu.setAttribute("aria-expanded", "false"); menu.focus(); }
  });
  document.querySelector(".side").addEventListener("click", function (e) {
    if (e.target.closest("a")) document.body.classList.remove("nav-open");
  });

  // copy
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var holder = btn.closest(".code, .cmd");
    var el = holder && (holder.querySelector("pre code") || holder.querySelector("code"));
    if (!el) return;
    var text = el.textContent;
    var done = function () {
      btn.textContent = "Copied"; btn.setAttribute("data-state", "done");
      setTimeout(function () { btn.textContent = "Copy"; btn.removeAttribute("data-state"); }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { btn.textContent = "Press Ctrl+C"; }
      document.body.removeChild(ta);
    }
  });

  // tabs (roving tabindex, arrows/home/end), remembers the choice per page title
  Array.prototype.forEach.call(document.querySelectorAll(".tabs"), function (tabs) {
    var list = tabs.querySelector("[role=tablist]");
    var tabEls = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
    function select(i, focus) {
      tabEls.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tabEls[i].focus();
    }
    tabEls.forEach(function (t, i) { t.addEventListener("click", function () { select(i); if (history.replaceState) history.replaceState(null, "", "#" + slug(t.textContent)); }); });
    list.addEventListener("keydown", function (e) {
      var i = tabEls.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabEls.length;
      else if (e.key === "ArrowLeft") n = (i - 1 + tabEls.length) % tabEls.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = tabEls.length - 1;
      if (n !== null) { e.preventDefault(); select(n, true); }
    });
    var h = location.hash.slice(1);
    tabEls.forEach(function (t, i) { if (slug(t.textContent) === h) select(i); });
  });
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // toc highlight
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { tocLinks.forEach(function (a) { a.classList.remove("active"); }); var a = map[en.target.id]; if (a) a.classList.add("active"); }
      });
    }, { rootMargin: "-10% 0px -80% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // search
  var dlg = document.querySelector("dialog.search");
  var input = document.getElementById("q");
  var results = document.getElementById("results");
  var hint = document.getElementById("hint");
  var index = null, loading = null, sel = -1, shown = [];
  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) loading = fetch(base + "assets/search-index.json").then(function (r) { return r.json(); }).then(function (j) { index = j; return j; }).catch(function () { hint.textContent = "Search index could not be loaded."; index = []; return index; });
    return loading;
  }
  function open() {
    if (typeof dlg.showModal !== "function") { location.href = base + "skills/"; return; }
    load(); dlg.showModal(); input.value = ""; results.innerHTML = ""; sel = -1; input.focus();
  }
  document.querySelector(".search-btn").addEventListener("click", open);
  document.addEventListener("keydown", function (e) {
    var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); open(); }
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  function score(p, terms) {
    var t = p.t.toLowerCase(), d = (p.d || "").toLowerCase(), h = (p.h || "").toLowerCase(), x = (p.x || "").toLowerCase(), s = 0;
    for (var i = 0; i < terms.length; i++) {
      var w = terms[i], hit = 0;
      if (t === w) hit += 20; else if (t.indexOf(w) === 0 || t.indexOf("/" + w) === 0) hit += 12; else if (t.indexOf(w) > -1) hit += 8;
      if (h.indexOf(w) > -1) hit += 4;
      if (d.indexOf(w) > -1) hit += 3;
      if (x.indexOf(w) > -1) hit += 1;
      if (!hit) return 0;
      s += hit;
    }
    return s;
  }
  function render() {
    results.innerHTML = "";
    shown.forEach(function (p, i) {
      var li = document.createElement("li"); li.setAttribute("role", "presentation");
      var a = document.createElement("a"); a.href = base + p.u; a.id = "res-" + i; a.setAttribute("role", "option"); a.setAttribute("aria-selected", String(i === sel));
      var k = document.createElement("span"); k.className = "res-k"; k.textContent = p.k;
      var t = document.createElement("span"); t.className = "res-t"; t.textContent = " " + p.t;
      var d = document.createElement("span"); d.className = "res-d"; d.textContent = (p.d || "").slice(0, 140);
      a.appendChild(k); a.appendChild(t); a.appendChild(d); li.appendChild(a); results.appendChild(li);
    });
    input.setAttribute("aria-activedescendant", sel >= 0 ? "res-" + sel : "");
    hint.textContent = input.value && !shown.length ? "No results." : (shown.length + " result" + (shown.length === 1 ? "" : "s"));
  }
  input.addEventListener("input", function () {
    var terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { shown = []; sel = -1; results.innerHTML = ""; hint.textContent = "Type to search. Arrow keys to move, Enter to open."; return; }
    load().then(function (idx) {
      shown = idx.map(function (p) { return { p: p, s: score(p, terms) }; }).filter(function (r) { return r.s; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (r) { return r.p; });
      sel = shown.length ? 0 : -1; render();
    });
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" && shown.length) { e.preventDefault(); sel = (sel + 1) % shown.length; render(); }
    else if (e.key === "ArrowUp" && shown.length) { e.preventDefault(); sel = (sel - 1 + shown.length) % shown.length; render(); }
    else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); location.href = base + shown[sel].u; }
  });
})();
