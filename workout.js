/* GYMGIUSE - LA MIA SCHEDA (versione autonoma, stile incluso) */
(function () {
  "use strict";

  window.addEventListener("error", function (e) {
    if (!document.body) return;
    var bar = document.createElement("div");
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#b00020;color:#fff;font:13px monospace;padding:10px";
    bar.textContent = "ERRORE: " + e.message + " (" + String(e.filename).split("/").pop() + ":" + e.lineno + ")";
    document.body.appendChild(bar);
  });

  var CUR = "gymgiuse_workout_v2";
  var HIS = "gymgiuse_history_v2";

  function rd(k, f) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? f : v; }
    catch (e) { return f; }
  }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function blank() { return { name: "", startedAt: Date.now(), exercises: [] }; }
  function bset() { return { reps: "", kg: "" }; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  var w = rd(CUR, blank());
  if (!w || !Array.isArray(w.exercises)) w = blank();
  w.exercises.forEach(function (ex) {
    if (!Array.isArray(ex.sets) || !ex.sets.length) ex.sets = [bset()];
  });

  function history() { var h = rd(HIS, []); return Array.isArray(h) ? h : []; }
  function saveW() { wr(CUR, w); }

  function maxKg(ex) {
    var v = (ex.sets || [])
      .map(function (s) { return parseFloat(String(s.kg == null ? "" : s.kg).replace(",", ".")); })
      .filter(function (n) { return isFinite(n); });
    return v.length ? Math.max.apply(null, v) : null;
  }
  function fmt(n) { return String(Math.round(n * 100) / 100).replace(".", ","); }

  function previous(id) {
    var all = history();
    for (var i = all.length - 1; i >= 0; i--) {
      var f = (all[i].exercises || []).filter(function (e) { return String(e.id) === String(id); })[0];
      if (f) return f;
    }
    return null;
  }

  function compareHtml(ex) {
    var p = previous(ex.id);
    if (!p) return "";
    var a = maxKg(ex), b = maxKg(p);
    if (a === null || b === null) return "";
    var d = a - b;
    if (Math.abs(d) < 0.001) return '<div class="gwk-cmp gwk-same">= stesso carico dell\'ultima seduta</div>';
    if (d > 0) return '<div class="gwk-cmp gwk-up">↑ +' + fmt(d) + ' kg rispetto all\'ultima seduta</div>';
    return '<div class="gwk-cmp gwk-down">↓ ' + fmt(d) + ' kg rispetto all\'ultima seduta</div>';
  }

  var CSS = [
    ".gwk-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);opacity:0;pointer-events:none;transition:opacity .25s;z-index:99998}",
    ".gwk-overlay.gwk-open{opacity:1;pointer-events:auto}",
    ".gwk-panel{position:fixed;top:0;right:0;bottom:0;left:auto;width:min(440px,100vw);height:100vh;display:flex;flex-direction:column;background:#111;color:#fff;transform:translateX(110%);transition:transform .3s;z-index:99999;box-shadow:-8px 0 30px rgba(0,0,0,.5);font-family:inherit;box-sizing:border-box}",
    ".gwk-panel *{box-sizing:border-box}",
    ".gwk-panel.gwk-open{transform:translateX(0)}",
    ".gwk-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.12);flex:0 0 auto}",
    ".gwk-head small{display:block;color:#22c55e;letter-spacing:.15em;font-size:11px}",
    ".gwk-head h2{margin:2px 0 0;font-size:22px;color:#fff}",
    ".gwk-close{background:none;border:0;color:#fff;font-size:30px;line-height:1;cursor:pointer;padding:4px 10px}",
    ".gwk-body{flex:1 1 auto;overflow-y:auto;padding:16px 18px 60px}",
    ".gwk-label{display:block;font-size:11px;letter-spacing:.12em;color:#aaa;margin-bottom:6px}",
    ".gwk-name{width:100%;padding:12px;border-radius:10px;border:1px solid #333;background:#1b1b1b;color:#fff;font-size:16px}",
    ".gwk-summary{margin:12px 0;color:#aaa;font-size:14px}",
    ".gwk-empty{margin:24px 0;padding:20px;border:1px dashed #333;border-radius:12px;text-align:center;color:#aaa}",
    ".gwk-empty strong{display:block;color:#fff;margin-bottom:4px}",
    ".gwk-ex{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:14px;margin:12px 0}",
    ".gwk-ex-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}",
    ".gwk-ex-head h3{margin:0;font-size:16px;color:#fff;text-transform:uppercase}",
    ".gwk-x{background:#2a2a2a;border:0;color:#fff;width:32px;height:32px;border-radius:8px;font-size:20px;cursor:pointer;flex:0 0 auto}",
    ".gwk-x:hover{background:#b00020}",
    ".gwk-set{display:grid;grid-template-columns:28px 1fr 1fr 32px;gap:8px;align-items:end;margin-bottom:8px}",
    ".gwk-num{color:#22c55e;font-weight:800;text-align:center;padding-bottom:10px}",
    ".gwk-set label span{display:block;font-size:10px;color:#aaa;letter-spacing:.1em;margin-bottom:3px}",
    ".gwk-in{width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#111;color:#fff;font-size:16px}",
    ".gwk-addset{width:100%;margin-top:6px;padding:10px;border-radius:8px;border:1px dashed #444;background:none;color:#fff;cursor:pointer;font-weight:700}",
    ".gwk-cmp{margin-top:10px;font-size:13px;font-weight:700}",
    ".gwk-up{color:#22c55e}.gwk-same{color:#facc15}.gwk-down{color:#f87171}",
    ".gwk-finish{width:100%;margin-top:18px;padding:16px;border:0;border-radius:12px;background:#22c55e;color:#04130a;font-weight:900;letter-spacing:.06em;font-size:15px;cursor:pointer}",
    ".gwk-hist{margin-top:28px}",
    ".gwk-hist h3{font-size:12px;letter-spacing:.15em;color:#aaa}",
    ".gwk-hist details{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:10px 12px;margin:8px 0}",
    ".gwk-hist summary{cursor:pointer;display:flex;justify-content:space-between;gap:8px}",
    ".gwk-hist ul{margin:10px 0 0;padding-left:18px;font-size:13px;color:#ccc}",
    ".gwk-fab{position:fixed;right:20px;bottom:20px;z-index:99997;display:flex;align-items:center;gap:10px;padding:14px 20px;border:0;border-radius:999px;background:#22c55e;color:#04130a;font-weight:900;letter-spacing:.05em;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}",
    ".gwk-badge{background:#04130a;color:#22c55e;border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;padding:0 6px}",
    "button.gg-add-workout.gwk-added{background:#22c55e !important;border-color:#22c55e !important;color:#04130a !important;font-weight:800 !important}"
  ].join("\n");

  function init() {
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    var overlay = document.createElement("div");
    overlay.className = "gwk-overlay";

    var panel = document.createElement("aside");
    panel.className = "gwk-panel";
    panel.innerHTML =
      '<div class="gwk-head"><div><small>GYMGIUSE</small><h2>La mia scheda</h2></div>' +
      '<button type="button" class="gwk-close" aria-label="Chiudi">×</button></div>' +
      '<div class="gwk-body">' +
      '<label class="gwk-label">NOME ALLENAMENTO</label>' +
      '<input class="gwk-name" type="text" placeholder="Es. Petto e tricipiti" autocomplete="off">' +
      '<div class="gwk-summary"></div>' +
      '<div class="gwk-list"></div>' +
      '<div class="gwk-empty"><strong>La tua scheda è vuota</strong>Premi + AGGIUNGI su un esercizio per iniziare.</div>' +
      '<button type="button" class="gwk-finish">TERMINA ALLENAMENTO</button>' +
      '<div class="gwk-hist"></div></div>';

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "gwk-fab";
    fab.innerHTML = '<span>+ SCHEDA</span><b class="gwk-badge">0</b>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    document.body.appendChild(fab);

    var $ = function (s) { return panel.querySelector(s); };
    var nameIn = $(".gwk-name"), summary = $(".gwk-summary"), list = $(".gwk-list"),
      empty = $(".gwk-empty"), finish = $(".gwk-finish"), hist = $(".gwk-hist"),
      badge = fab.querySelector(".gwk-badge");

    function open() { panel.classList.add("gwk-open"); overlay.classList.add("gwk-open"); }
    function close() { panel.classList.remove("gwk-open"); overlay.classList.remove("gwk-open"); }

    function refreshButtons() {
      var btns = document.querySelectorAll("button.gg-add-workout");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var has = w.exercises.some(function (e) { return String(e.id) === String(b.getAttribute("data-exercise-id")); });
        var txt = has ? "✓ AGGIUNTO" : "+ AGGIUNGI";
        if (b.textContent !== txt) b.textContent = txt;
        if (b.classList.contains("gwk-added") !== has) b.classList.toggle("gwk-added", has);
      }
    }

    function renderEx(ex, i) {
      var sets = ex.sets.map(function (s, j) {
        return '<div class="gwk-set"><span class="gwk-num">' + (j + 1) + '</span>' +
          '<label><span>REP</span><input class="gwk-in" data-f="reps" data-e="' + i + '" data-s="' + j + '" type="text" inputmode="numeric" value="' + esc(s.reps) + '" autocomplete="off"></label>' +
          '<label><span>KG</span><input class="gwk-in" data-f="kg" data-e="' + i + '" data-s="' + j + '" type="text" inputmode="decimal" value="' + esc(s.kg) + '" autocomplete="off"></label>' +
          '<button type="button" class="gwk-x" data-act="delset" data-e="' + i + '" data-s="' + j + '" aria-label="Elimina serie">×</button></div>';
      }).join("");
      return '<article class="gwk-ex"><div class="gwk-ex-head"><h3>' + esc(ex.name) + '</h3>' +
        '<button type="button" class="gwk-x" data-act="delex" data-e="' + i + '" aria-label="Elimina esercizio">×</button></div>' +
        sets +
        '<button type="button" class="gwk-addset" data-act="addset" data-e="' + i + '">+ AGGIUNGI SERIE</button>' +
        compareHtml(ex) + '</article>';
    }

    function renderHist() {
      var all = history();
      if (!all.length) { hist.innerHTML = ""; return; }
      var items = all.slice().reverse().slice(0, 15).map(function (it) {
        var d = new Date(it.endedAt || it.startedAt).toLocaleDateString("it-IT");
        var lis = (it.exercises || []).map(function (ex) {
          var sets = (ex.sets || []).map(function (s) { return (s.reps || "-") + "×" + (s.kg || "-") + "kg"; }).join(", ");
          return "<li><strong>" + esc(ex.name) + "</strong><br>" + esc(sets) + "</li>";
        }).join("");
        return "<details><summary><strong>" + esc(it.name || "Allenamento") + "</strong><span>" + d + "</span></summary><ul>" + lis + "</ul></details>";
      }).join("");
      hist.innerHTML = "<h3>STORICO ALLENAMENTI</h3>" + items;
    }

    function render() {
      if (document.activeElement !== nameIn) nameIn.value = w.name || "";
      badge.textContent = w.exercises.length;
      summary.textContent = w.exercises.length ? w.exercises.length + " esercizi nella scheda" : "";
      empty.style.display = w.exercises.length ? "none" : "";
      finish.style.display = w.exercises.length ? "" : "none";
      list.innerHTML = w.exercises.map(renderEx).join("");
      renderHist();
      refreshButtons();
    }

    function toggle(id, name) {
      if (!id) return;
      var idx = -1;
      w.exercises.forEach(function (e, k) { if (String(e.id) === String(id)) idx = k; });
      if (idx >= 0) w.exercises.splice(idx, 1);
      else w.exercises.push({ id: String(id), name: name || ("Esercizio " + id), sets: [bset()] });
      saveW();
      render();
    }

    // Click su + AGGIUNGI / ✓ AGGIUNTO (intercetta prima di tutto il resto)
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("button.gg-add-workout");
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      toggle(b.getAttribute("data-exercise-id"), b.getAttribute("data-exercise-name"));
    }, true);

    nameIn.addEventListener("input", function () { w.name = nameIn.value; saveW(); });

    list.addEventListener("input", function (ev) {
      var t = ev.target;
      var f = t.getAttribute("data-f");
      if (!f) return;
      var ex = w.exercises[Number(t.getAttribute("data-e"))];
      var s = ex && ex.sets[Number(t.getAttribute("data-s"))];
      if (!s) return;
      s[f] = t.value;
      saveW();
    });

    list.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-act]");
      if (!b) return;
      var i = Number(b.getAttribute("data-e"));
      var ex = w.exercises[i];
      var act = b.getAttribute("data-act");
      if (!ex) return;
      if (act === "addset") ex.sets.push(bset());
      else if (act === "delset") {
        ex.sets.splice(Number(b.getAttribute("data-s")), 1);
        if (!ex.sets.length) ex.sets.push(bset());
      } else if (act === "delex") w.exercises.splice(i, 1);
      saveW();
      render();
    });

    finish.addEventListener("click", function () {
      if (!w.exercises.length) return;
      var all = history();
      var done = JSON.parse(JSON.stringify(w));
      done.name = (w.name || "").trim() || ("Allenamento " + new Date().toLocaleDateString("it-IT"));
      done.endedAt = Date.now();
      all.push(done);
      wr(HIS, all);
      w = blank();
      saveW();
      render();
    });

    fab.addEventListener("click", open);
    panel.querySelector(".gwk-close").addEventListener("click", close);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // Quando le card vengono ridisegnate (filtri, ricerca), riallinea i pulsanti
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; refreshButtons(); });
    }).observe(document.body, { childList: true, subtree: true });

    render();

    window.GymGiuseWorkout = {
      open: open,
      render: render,
      addFromButton: function (b) { toggle(b.getAttribute("data-exercise-id"), b.getAttribute("data-exercise-name")); },
      add: function (id, name) { toggle(String(id), name); }
    };
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
