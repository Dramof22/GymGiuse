/* GymGiuse Workout V5 - schede riutilizzabili, modificabili e mobile-safe */
(function () {
  "use strict";

  var VERSION = 5;
  var SESSION_KEY = "gymgiuse_workout_v5";
  var PLANS_KEY = "gymgiuse_plans_v5";
  var HISTORY_KEY = "gymgiuse_history_v2";

  var OLD_SESSION_KEY = "gymgiuse_workout_v2";
  var OLD_PLANS_KEY = "gymgiuse_schede_salvate_v4";

  function now() { return Date.now(); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "ggw-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("GymGiuse storage error:", e);
      return false;
    }
  }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function norm(value) { return String(value == null ? "" : value).trim(); }
  function number(value) {
    var n = parseFloat(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  function blankSet() { return { reps: "", kg: "" }; }
  function normalizeSet(set) {
    set = set && typeof set === "object" ? set : {};
    return { reps: String(set.reps == null ? "" : set.reps), kg: String(set.kg == null ? "" : set.kg) };
  }
  function normalizeExercise(ex) {
    ex = ex && typeof ex === "object" ? ex : {};
    var sets = Array.isArray(ex.sets) && ex.sets.length ? ex.sets.map(normalizeSet) : [blankSet()];
    return {
      id: String(ex.id == null ? uid() : ex.id),
      name: String(ex.name || "Esercizio"),
      sets: sets
    };
  }
  function normalizeExercises(list) {
    return Array.isArray(list) ? list.map(normalizeExercise) : [];
  }
  function blankSession() {
    return {
      version: VERSION,
      planId: null,
      name: "",
      startedAt: now(),
      exercises: []
    };
  }
  function normalizeSession(value) {
    if (!value || typeof value !== "object") return blankSession();
    return {
      version: VERSION,
      planId: value.planId || null,
      name: String(value.name || ""),
      startedAt: Number(value.startedAt) || now(),
      exercises: normalizeExercises(value.exercises)
    };
  }
  function normalizePlan(value, fallbackName) {
    value = value && typeof value === "object" ? value : {};
    return {
      id: String(value.id || uid()),
      name: String(value.name || fallbackName || "Scheda"),
      createdAt: Number(value.createdAt) || now(),
      updatedAt: Number(value.updatedAt) || now(),
      exercises: normalizeExercises(value.exercises)
    };
  }
  function getPlans() {
    var raw = read(PLANS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(function (p) { return normalizePlan(p); });
  }
  function putPlans(plans) {
    return write(PLANS_KEY, plans);
  }
  function getHistory() {
    var h = read(HISTORY_KEY, []);
    return Array.isArray(h) ? h : [];
  }
  function putHistory(h) {
    return write(HISTORY_KEY, h);
  }
  function getSession() {
    return normalizeSession(read(SESSION_KEY, blankSession()));
  }
  function putSession(session) {
    session.version = VERSION;
    return write(SESSION_KEY, session);
  }

  function migrateLegacy() {
    if (localStorage.getItem(PLANS_KEY) == null) {
      var oldPlans = read(OLD_PLANS_KEY, {});
      var migrated = [];
      if (oldPlans && typeof oldPlans === "object" && !Array.isArray(oldPlans)) {
        Object.keys(oldPlans).forEach(function (name) {
          var p = normalizePlan(oldPlans[name], name);
          p.name = name;
          migrated.push(p);
        });
      }
      putPlans(migrated);
    }

    if (localStorage.getItem(SESSION_KEY) == null) {
      var oldSession = read(OLD_SESSION_KEY, null);
      var next = normalizeSession(oldSession || blankSession());
      if (next.name) {
        var plans = getPlans();
        var match = plans.find(function (p) {
          return p.name.toLocaleLowerCase("it") === next.name.trim().toLocaleLowerCase("it");
        });
        if (match) next.planId = match.id;
      }
      putSession(next);
    }
  }

  function planFromSession(session, existing) {
    return {
      id: existing ? existing.id : uid(),
      name: norm(session.name),
      createdAt: existing ? existing.createdAt : now(),
      updatedAt: now(),
      exercises: clone(normalizeExercises(session.exercises))
    };
  }
  function sessionFromPlan(plan) {
    return {
      version: VERSION,
      planId: plan.id,
      name: plan.name,
      startedAt: now(),
      exercises: clone(normalizeExercises(plan.exercises))
    };
  }
  function comparableFromSession(s) {
    return {
      name: norm(s.name),
      exercises: normalizeExercises(s.exercises).map(function (ex) {
        return {
          id: String(ex.id),
          name: ex.name,
          sets: ex.sets.map(function (set) {
            return { reps: String(set.reps), kg: String(set.kg) };
          })
        };
      })
    };
  }
  function comparableFromPlan(p) {
    return comparableFromSession({ name: p.name, exercises: p.exercises });
  }
  function isDirty(session, plans) {
    if (!session.planId) {
      return !!(norm(session.name) || session.exercises.length);
    }
    var p = plans.find(function (x) { return x.id === session.planId; });
    if (!p) return true;
    return JSON.stringify(comparableFromSession(session)) !== JSON.stringify(comparableFromPlan(p));
  }

  function maxKg(ex) {
    var vals = (ex.sets || []).map(function (s) { return number(s.kg); })
      .filter(function (n) { return n != null; });
    return vals.length ? Math.max.apply(null, vals) : null;
  }
  function volume(ex) {
    return (ex.sets || []).reduce(function (sum, s) {
      var kg = number(s.kg), reps = number(s.reps);
      return sum + (kg != null && reps != null ? kg * reps : 0);
    }, 0);
  }
  function bestE1RM(ex) {
    var best = null;
    (ex.sets || []).forEach(function (s) {
      var kg = number(s.kg), reps = number(s.reps);
      if (kg == null || reps == null || reps <= 0) return;
      var e = kg * (1 + Math.min(reps, 30) / 30);
      if (best == null || e > best) best = e;
    });
    return best;
  }
  function fmt(n) {
    if (n == null || !Number.isFinite(n)) return "-";
    return String(Math.round(n * 100) / 100).replace(".", ",");
  }
  function previousExercise(history, id, beforeTime) {
    for (var i = history.length - 1; i >= 0; i--) {
      var item = history[i];
      var t = Number(item.endedAt || item.startedAt) || 0;
      if (beforeTime && t >= beforeTime) continue;
      var exs = Array.isArray(item.exercises) ? item.exercises : [];
      for (var j = 0; j < exs.length; j++) {
        if (String(exs[j].id) === String(id)) return exs[j];
      }
    }
    return null;
  }

  migrateLegacy();
  var session = getSession();
  var historyExpanded = false;
  var lockedScrollY = 0;
  var resumeAfterExercise = false;

  function init() {
    if (document.querySelector(".ggw-panel")) return;

    var overlay = document.createElement("div");
    overlay.className = "ggw-overlay";

    var panel = document.createElement("aside");
    panel.className = "ggw-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<header class="ggw-head">' +
        '<div><small>GYMGIUSE</small><h2>La mia scheda</h2></div>' +
        '<button type="button" class="ggw-close" aria-label="Chiudi">×</button>' +
      '</header>' +
      '<div class="ggw-body">' +
        '<section class="ggw-editor">' +
          '<div class="ggw-field">' +
            '<label for="ggw-name">NOME SCHEDA</label>' +
            '<input id="ggw-name" class="ggw-name" type="text" maxlength="80" placeholder="Es. Lunedì — Petto e tricipiti" autocomplete="off">' +
          '</div>' +
          '<div class="ggw-planbox">' +
            '<div class="ggw-planrow">' +
              '<label for="ggw-plan-select">LE MIE SCHEDE</label>' +
              '<span class="ggw-status" aria-live="polite"></span>' +
            '</div>' +
            '<select id="ggw-plan-select" class="ggw-plan-select"><option value="">Nuova scheda</option></select>' +
            '<div class="ggw-plan-actions">' +
              '<button type="button" class="ggw-new">+ NUOVA</button>' +
              '<button type="button" class="ggw-save">SALVA MODIFICHE</button>' +
              '<button type="button" class="ggw-delete">ELIMINA</button>' +
            '</div>' +
          '</div>' +
          '<div class="ggw-summary"></div>' +
          '<div class="ggw-list"></div>' +
          '<div class="ggw-empty"><strong>La tua scheda è vuota</strong><span>Premi “+ AGGIUNGI” su un esercizio per iniziare.</span></div>' +
          '<button type="button" class="ggw-finish">TERMINA ALLENAMENTO</button>' +
        '</section>' +
        '<section class="ggw-history"></section>' +
      '</div>' +
      '<div class="ggw-toast" role="status" aria-live="polite"></div>';

    var fab = document.createElement("button");
    fab.type = "button";
    fab.className = "ggw-fab";
    fab.innerHTML = '<span>+ SCHEDA</span><b class="ggw-badge">0</b>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    document.body.appendChild(fab);

    var nameInput = panel.querySelector(".ggw-name");
    var planSelect = panel.querySelector(".ggw-plan-select");
    var list = panel.querySelector(".ggw-list");
    var summary = panel.querySelector(".ggw-summary");
    var empty = panel.querySelector(".ggw-empty");
    var finish = panel.querySelector(".ggw-finish");
    var status = panel.querySelector(".ggw-status");
    var hist = panel.querySelector(".ggw-history");
    var toastEl = panel.querySelector(".ggw-toast");
    var badge = fab.querySelector(".ggw-badge");
    var toastTimer = null;

    function toast(message) {
      clearTimeout(toastTimer);
      toastEl.textContent = message;
      toastEl.classList.add("is-show");
      toastTimer = setTimeout(function () {
        toastEl.classList.remove("is-show");
      }, 2200);
    }

    function updateViewport() {
      var vv = window.visualViewport;
      var height = vv ? vv.height : window.innerHeight;

      /*
       * Safari iOS:
       * usiamo VisualViewport solo per l'altezza disponibile.
       * Non spostiamo verticalmente il pannello con offsetTop,
       * perché durante scroll/transizioni può creare una fascia
       * scoperta sopra al pannello.
       */
      document.documentElement.style.setProperty(
        "--ggw-vh",
        Math.round(height) + "px"
      );
      document.documentElement.style.setProperty("--ggw-vtop", "0px");
    }
    function lockPage() {
      if (document.body.classList.contains("ggw-page-locked")) return;
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.top = "-" + lockedScrollY + "px";
      document.body.classList.add("ggw-page-locked");
    }
    function unlockPage() {
      if (!document.body.classList.contains("ggw-page-locked")) return;
      document.body.classList.remove("ggw-page-locked");
      document.body.style.top = "";
      window.scrollTo(0, lockedScrollY);
    }
    function bindViewport(on) {
      var vv = window.visualViewport;
      if (on) {
        updateViewport();
        window.addEventListener("resize", updateViewport, { passive: true });
        window.addEventListener("orientationchange", updateViewport, { passive: true });
        if (vv) {
          vv.addEventListener("resize", updateViewport, { passive: true });
          vv.addEventListener("scroll", updateViewport, { passive: true });
        }
      } else {
        window.removeEventListener("resize", updateViewport);
        window.removeEventListener("orientationchange", updateViewport);
        if (vv) {
          vv.removeEventListener("resize", updateViewport);
          vv.removeEventListener("scroll", updateViewport);
        }
      }
    }
    function openPanel() {
      updateViewport();
      lockPage();
      bindViewport(true);
      overlay.classList.add("is-open");
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      render();
      requestAnimationFrame(function () {
        var body = panel.querySelector(".ggw-body");
        if (body) body.focus && body.focus({ preventScroll: true });
      });
    }
    function closePanel() {
      panel.classList.remove("is-open");
      overlay.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      bindViewport(false);
      unlockPage();
    }

    function refreshButtons() {
      var buttons = document.querySelectorAll("button.gg-add-workout");
      buttons.forEach(function (b) {
        var id = b.getAttribute("data-exercise-id");
        var has = session.exercises.some(function (e) { return String(e.id) === String(id); });
        b.textContent = has ? "✓ AGGIUNTO" : "+ AGGIUNGI";
        b.classList.toggle("ggw-added", has);
      });
    }

    function renderPlanSelect(plans) {
      var current = planSelect.value;
      planSelect.innerHTML = '<option value="">Nuova scheda</option>';
      plans.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
      }).forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        planSelect.appendChild(opt);
      });
      if (session.planId && plans.some(function (p) { return p.id === session.planId; })) {
        planSelect.value = session.planId;
      } else if (!session.planId) {
        planSelect.value = "";
      } else {
        planSelect.value = current || "";
      }
    }

    function comparisonHtml(ex) {
      var prev = previousExercise(getHistory(), ex.id, session.startedAt);
      if (!prev) return "";
      var curMax = maxKg(ex), prevMax = maxKg(prev);
      var curVol = volume(ex), prevVol = volume(prev);
      var curE = bestE1RM(ex), prevE = bestE1RM(prev);
      if (curMax == null && curVol === 0) return "";

      var bits = [];
      if (curMax != null && prevMax != null) {
        var dk = curMax - prevMax;
        bits.push((dk > 0 ? "↑ +" : dk < 0 ? "↓ " : "= ") + (dk ? fmt(dk) + " kg max" : "stesso carico max"));
      }
      if (curVol > 0 && prevVol > 0) {
        var pct = ((curVol - prevVol) / prevVol) * 100;
        bits.push((pct > 0 ? "↑ +" : pct < 0 ? "↓ " : "= ") + (pct ? fmt(pct) + "% volume" : "stesso volume"));
      }
      if (curE != null && prevE != null) {
        var de = curE - prevE;
        if (Math.abs(de) >= 0.05) bits.push((de > 0 ? "↑ +" : "↓ ") + fmt(de) + " kg forza stimata");
      }
      if (!bits.length) return "";
      var cls = (curE != null && prevE != null && curE > prevE + 0.05) || (curVol > prevVol) ? "is-up" : "";
      return '<div class="ggw-compare ' + cls + '">' + esc(bits.join(" · ")) + '</div>';
    }

    function renderExercise(ex, index) {
      var media = window.GymGiuseExerciseMedia ? window.GymGiuseExerciseMedia(ex.id) : null;
      var preview = media && media.image
        ? '<img src="' + esc(media.image) + '" alt="" loading="lazy">'
        : '<span>▶</span>';
      var sets = ex.sets.map(function (set, si) {
        return '<div class="ggw-set">' +
          '<span class="ggw-setnum">' + (si + 1) + '</span>' +
          '<label><span>REP</span><input class="ggw-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-field="reps" data-e="' + index + '" data-s="' + si + '" value="' + esc(set.reps) + '"></label>' +
          '<label><span>KG</span><input class="ggw-input" type="text" inputmode="decimal" autocomplete="off" data-field="kg" data-e="' + index + '" data-s="' + si + '" value="' + esc(set.kg) + '"></label>' +
          '<button type="button" class="ggw-iconbtn ggw-delset" data-act="delset" data-e="' + index + '" data-s="' + si + '" aria-label="Elimina serie">×</button>' +
        '</div>';
      }).join("");

      return '<article class="ggw-ex">' +
        '<div class="ggw-exhead">' +
          '<button type="button" class="ggw-preview" data-act="view" data-e="' + index + '" aria-label="Apri esercizio">' + preview + '</button>' +
          '<h3>' + esc(ex.name) + '</h3>' +
          '<div class="ggw-extools">' +
            '<button type="button" class="ggw-move" data-act="up" data-e="' + index + '" aria-label="Sposta su">↑</button>' +
            '<button type="button" class="ggw-move" data-act="down" data-e="' + index + '" aria-label="Sposta giù">↓</button>' +
            '<button type="button" class="ggw-iconbtn" data-act="delex" data-e="' + index + '" aria-label="Elimina esercizio">×</button>' +
          '</div>' +
        '</div>' +
        '<div class="ggw-sets">' + sets + '</div>' +
        '<button type="button" class="ggw-addset" data-act="addset" data-e="' + index + '">+ AGGIUNGI SERIE</button>' +
        comparisonHtml(ex) +
      '</article>';
    }

    function renderHistory() {
      var all = getHistory();
      if (!all.length) {
        hist.innerHTML = "";
        return;
      }
      var reversed = all.slice().reverse();
      var visible = historyExpanded ? reversed : reversed.slice(0, 12);
      var html = visible.map(function (it) {
        var originalIndex = all.indexOf(it);
        var date = new Date(it.endedAt || it.startedAt || now());
        var when = date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
        var exs = normalizeExercises(it.exercises);
        var rows = exs.map(function (ex) {
          var sets = ex.sets.map(function (s) {
            return (norm(s.reps) || "–") + "×" + (norm(s.kg) || "–") + "kg";
          }).join(", ");
          return '<li><strong>' + esc(ex.name) + '</strong><span>' + esc(sets) + '</span></li>';
        }).join("");
        return '<details class="ggw-historyitem">' +
          '<summary><strong>' + esc(it.name || "Allenamento") + '</strong><span>' + esc(when) + '</span></summary>' +
          '<ul>' + rows + '</ul>' +
          '<button type="button" class="ggw-history-delete" data-hindex="' + originalIndex + '">ELIMINA DALLO STORICO</button>' +
        '</details>';
      }).join("");
      if (all.length > 12) {
        html += '<button type="button" class="ggw-history-more">' +
          (historyExpanded ? "MOSTRA MENO" : "MOSTRA TUTTO (" + all.length + ")") +
        '</button>';
      }
      hist.innerHTML = '<div class="ggw-section-title">STORICO ALLENAMENTI</div>' + html;
    }

    function render() {
      var plans = getPlans();
      if (document.activeElement !== nameInput) nameInput.value = session.name || "";
      badge.textContent = session.exercises.length;
      summary.textContent = session.exercises.length
        ? session.exercises.length + (session.exercises.length === 1 ? " esercizio" : " esercizi") + " nella scheda"
        : "";
      empty.hidden = session.exercises.length > 0;
      finish.hidden = session.exercises.length === 0;
      list.innerHTML = session.exercises.map(renderExercise).join("");
      renderPlanSelect(plans);
      renderHistory();
      refreshButtons();

      var dirty = isDirty(session, plans);
      status.textContent = dirty ? "MODIFICHE NON SALVATE" : (session.planId ? "SALVATA" : "");
      status.classList.toggle("is-dirty", dirty);
      panel.querySelector(".ggw-delete").disabled = !session.planId;
    }

    function persistAndRender() {
      putSession(session);
      render();
    }

    function savePlan(showToast) {
      var name = norm(session.name);
      if (!name) {
        toast("Dai un nome alla scheda");
        nameInput.focus();
        return false;
      }
      if (!session.exercises.length) {
        toast("Aggiungi almeno un esercizio");
        return false;
      }

      var plans = getPlans();
      var existing = session.planId
        ? plans.find(function (p) { return p.id === session.planId; })
        : null;

      var duplicate = plans.find(function (p) {
        return p.id !== (existing && existing.id) &&
          p.name.trim().toLocaleLowerCase("it") === name.toLocaleLowerCase("it");
      });
      if (duplicate && !window.confirm('Esiste già una scheda chiamata "' + name + '". Vuoi sostituirla?')) {
        return false;
      }

      if (duplicate && !existing) {
        existing = duplicate;
        session.planId = duplicate.id;
      } else if (duplicate && existing && duplicate.id !== existing.id) {
        plans = plans.filter(function (p) { return p.id !== duplicate.id; });
      }

      var saved = planFromSession(session, existing);
      session.planId = saved.id;
      session.name = saved.name;

      var idx = plans.findIndex(function (p) { return p.id === saved.id; });
      if (idx >= 0) plans[idx] = saved;
      else plans.push(saved);

      if (!putPlans(plans) || !putSession(session)) {
        toast("Errore durante il salvataggio");
        return false;
      }
      render();
      if (showToast) toast(existing ? "Modifiche salvate" : "Scheda salvata");
      return true;
    }

    function confirmDiscardIfDirty() {
      var plans = getPlans();
      if (!isDirty(session, plans)) return true;
      return window.confirm("Hai modifiche non salvate. Vuoi continuare e perderle?");
    }

    function newPlan() {
      if (!confirmDiscardIfDirty()) return;
      session = blankSession();
      putSession(session);
      render();
      nameInput.focus();
    }

    function loadPlan(id) {
      if (!id) {
        newPlan();
        return;
      }
      if (id === session.planId) return;
      if (!confirmDiscardIfDirty()) {
        render();
        return;
      }
      var p = getPlans().find(function (x) { return x.id === id; });
      if (!p) {
        toast("Scheda non trovata");
        render();
        return;
      }
      session = sessionFromPlan(p);
      putSession(session);
      render();
      panel.querySelector(".ggw-body").scrollTop = 0;
      toast('Scheda "' + p.name + '" aperta');
    }

    function deletePlan() {
      if (!session.planId) return;
      var plans = getPlans();
      var p = plans.find(function (x) { return x.id === session.planId; });
      if (!p) return;
      if (!window.confirm('Eliminare definitivamente la scheda "' + p.name + '"? Lo storico non verrà cancellato.')) return;
      plans = plans.filter(function (x) { return x.id !== p.id; });
      putPlans(plans);
      session = blankSession();
      putSession(session);
      render();
      toast("Scheda eliminata");
    }

    function toggleExercise(id, name) {
      if (!id) return;
      var idx = session.exercises.findIndex(function (e) { return String(e.id) === String(id); });
      if (idx >= 0) session.exercises.splice(idx, 1);
      else session.exercises.push({ id: String(id), name: name || ("Esercizio " + id), sets: [blankSet()] });
      persistAndRender();
    }

    function finishWorkout() {
      if (!session.exercises.length) return;
      var title = norm(session.name);
      if (!title) {
        toast("Dai un nome alla scheda prima di terminare");
        nameInput.focus();
        return;
      }

      if (!savePlan(false)) return;

      var h = getHistory();
      var done = {
        id: uid(),
        planId: session.planId,
        name: title,
        startedAt: session.startedAt,
        endedAt: now(),
        exercises: clone(normalizeExercises(session.exercises))
      };
      h.push(done);
      if (!putHistory(h)) {
        toast("Non riesco a salvare lo storico");
        return;
      }

      var p = getPlans().find(function (x) { return x.id === session.planId; });
      session = p ? sessionFromPlan(p) : normalizeSession(session);
      session.startedAt = now();
      putSession(session);
      historyExpanded = false;
      render();
      toast("Allenamento registrato ✓");
    }

    nameInput.addEventListener("input", function () {
      session.name = nameInput.value;
      putSession(session);
      var plans = getPlans();
      var dirty = isDirty(session, plans);
      status.textContent = dirty ? "MODIFICHE NON SALVATE" : (session.planId ? "SALVATA" : "");
      status.classList.toggle("is-dirty", dirty);
    });

    planSelect.addEventListener("change", function () {
      var id = planSelect.value;
      if (!id) {
        if (session.planId || session.exercises.length || norm(session.name)) newPlan();
        return;
      }
      loadPlan(id);
    });

    panel.querySelector(".ggw-save").addEventListener("click", function () { savePlan(true); });
    panel.querySelector(".ggw-new").addEventListener("click", newPlan);
    panel.querySelector(".ggw-delete").addEventListener("click", deletePlan);
    finish.addEventListener("click", finishWorkout);

    list.addEventListener("input", function (ev) {
      var t = ev.target;
      var field = t.getAttribute("data-field");
      if (!field) return;
      var ei = Number(t.getAttribute("data-e"));
      var si = Number(t.getAttribute("data-s"));
      var ex = session.exercises[ei];
      var set = ex && ex.sets[si];
      if (!set) return;
      set[field] = t.value;
      putSession(session);
      var plans = getPlans();
      var dirty = isDirty(session, plans);
      status.textContent = dirty ? "MODIFICHE NON SALVATE" : (session.planId ? "SALVATA" : "");
      status.classList.toggle("is-dirty", dirty);
    });

    list.addEventListener("change", function (ev) {
      var t = ev.target;
      if (!t.matches(".ggw-input")) return;
      var val = norm(t.value);
      if (val === "") return;
      var n = number(val);
      if (n == null || n < 0) {
        t.value = "";
        t.dispatchEvent(new Event("input", { bubbles: true }));
        toast("Inserisci un numero valido");
      }
    });

    list.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-act]");
      if (!b) return;
      var i = Number(b.getAttribute("data-e"));
      var ex = session.exercises[i];
      if (!ex) return;
      var act = b.getAttribute("data-act");

      if (act === "view") {
        if (window.GymGiuseOpenExerciseById) {
          resumeAfterExercise = true;
          closePanel();
          window.GymGiuseOpenExerciseById(ex.id);
        }
        return;
      }
      if (act === "addset") {
        var last = ex.sets.length ? ex.sets[ex.sets.length - 1] : blankSet();
        ex.sets.push({ reps: last.reps, kg: last.kg });
      } else if (act === "delset") {
        var si = Number(b.getAttribute("data-s"));
        ex.sets.splice(si, 1);
        if (!ex.sets.length) ex.sets.push(blankSet());
      } else if (act === "delex") {
        session.exercises.splice(i, 1);
      } else if (act === "up" && i > 0) {
        var up = session.exercises.splice(i, 1)[0];
        session.exercises.splice(i - 1, 0, up);
      } else if (act === "down" && i < session.exercises.length - 1) {
        var down = session.exercises.splice(i, 1)[0];
        session.exercises.splice(i + 1, 0, down);
      }
      persistAndRender();
    });

    hist.addEventListener("click", function (ev) {
      var del = ev.target.closest(".ggw-history-delete");
      if (del) {
        var idx = Number(del.getAttribute("data-hindex"));
        var h = getHistory();
        if (!Number.isInteger(idx) || idx < 0 || idx >= h.length) return;
        if (!window.confirm("Eliminare questo allenamento dallo storico?")) return;
        h.splice(idx, 1);
        putHistory(h);
        renderHistory();
        toast("Allenamento eliminato");
        return;
      }
      var more = ev.target.closest(".ggw-history-more");
      if (more) {
        historyExpanded = !historyExpanded;
        renderHistory();
      }
    });

    fab.addEventListener("click", openPanel);
    panel.querySelector(".ggw-close").addEventListener("click", closePanel);
    overlay.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && panel.classList.contains("is-open")) closePanel();
    });

    document.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("button.gg-add-workout");
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      toggleExercise(b.getAttribute("data-exercise-id"), b.getAttribute("data-exercise-name"));
    }, true);

    var mutationPending = false;
    new MutationObserver(function () {
      if (mutationPending) return;
      mutationPending = true;
      requestAnimationFrame(function () {
        mutationPending = false;
        refreshButtons();
      });
    }).observe(document.body, { childList: true, subtree: true });

    var exerciseModal = document.getElementById("exerciseModal");
    if (exerciseModal) {
      new MutationObserver(function () {
        if (!resumeAfterExercise) return;
        if (exerciseModal.classList.contains("hidden")) {
          resumeAfterExercise = false;
          setTimeout(openPanel, 0);
        }
      }).observe(exerciseModal, { attributes: true, attributeFilter: ["class"] });
    }

    render();

    window.GymGiuseWorkout = {
      open: openPanel,
      close: closePanel,
      render: render,
      addFromButton: function (b) {
        if (!b) return;
        toggleExercise(b.getAttribute("data-exercise-id"), b.getAttribute("data-exercise-name"));
      },
      add: function (id, name) { toggleExercise(String(id), name); },
      version: VERSION
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
