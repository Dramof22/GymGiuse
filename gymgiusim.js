/* GymGiusim - applicazione semplice, gratuita e pensata per iPhone. */
(() => {
  'use strict';

  const DATA_URL = 'https://raw.githubusercontent.com/babyskill/gym-dataset/main/data/exercises.json';
  const MEDIA_BASE = 'https://raw.githubusercontent.com/babyskill/gym-dataset/main/';
  const KEYS = { plans: 'gymgiusim_plans_v1', active: 'gymgiusim_active_v1', history: 'gymgiusim_history_v1', catalog: 'gymgiusim_catalog_cache_v1' };
  const $ = (id) => document.getElementById(id);
  const state = { plans: [], activePlanId: null, workout: null, history: [], catalog: [], visibleResults: [], detailExercise: null, customExercises: [], toastTimer: null, activeSince: null, drafts: {}, editingHistoryId: null };
  const ui = {
    planSelect: $('planSelect'), planName: $('planName'), saveStatus: $('saveStatus'), search: $('exerciseSearch'), clearSearch: $('clearSearch'), searchResults: $('searchResults'), catalogStatus: $('catalogStatus'), workoutList: $('workoutList'), emptyWorkout: $('emptyWorkout'), exerciseTotal: $('exerciseTotal'), workoutHeading: $('workoutHeading'), detailDialog: $('detailDialog'), historyDialog: $('historyDialog'), customDialog: $('customDialog'), toast: $('toast')
  };

  function uid(prefix = 'gg') { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function safeRead(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch (_) { return fallback; } }
  function saveKey(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); ui.saveStatus.textContent = 'Salvato automaticamente sul telefono'; return true; }
    catch (error) { console.error(error); ui.saveStatus.textContent = 'Spazio del browser pieno: esporta un backup'; showToast('Non riesco a salvare. Esporta subito un backup.'); return false; }
  }
  function showToast(message) { ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400); }
  function dateKey(date = new Date()) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
  function formatDate(value) { const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value || ''); return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' }); }
  function createSet(reps = '', kg = '') { return { reps: String(reps ?? ''), kg: String(kg ?? '') }; }
  function extractInstructions(ex) {
    const directSteps = ex.instruction_steps && Array.isArray(ex.instruction_steps.it) ? ex.instruction_steps.it : null;
    if (directSteps && directSteps.length) return directSteps.map(String);
    let text = ex.instructions;
    if (text && typeof text === 'object' && !Array.isArray(text)) text = text.it || text.en || '';
    if (Array.isArray(text)) return text.map(String);
    if (typeof text === 'string' && text.trim()) return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(part => part.trim()).filter(Boolean) || [text.trim()];
    if (ex.notes) return [String(ex.notes)];
    return [];
  }
  function normalizeExercise(ex) {
    const rawTarget = ex.target || ex.muscles || ex.muscle_group || 'Muscoli non indicati';
    const rawSecondary = ex.secondaryMuscles || ex.secondary_muscles || [];
    return { id: String(ex.id ?? uid('ex')), name: String(ex.name || 'Esercizio'), originalName: String(ex.originalName || ex.name || 'Esercizio'), target: Array.isArray(rawTarget) ? rawTarget.join(', ') : String(rawTarget), equipment: String(ex.equipment || ''), image: String(ex.image || ''), gif_url: String(ex.gif_url || ''), video_url: String(ex.video_url || ''), description: String((typeof ex.description === 'object' ? (ex.description.it || ex.description.en || '') : ex.description) || ex.notes || ''), instructions: extractInstructions(ex), aliases: String(ex.aliases || ''), secondaryMuscles: Array.isArray(rawSecondary) ? rawSecondary.map(String) : [], sets: Array.isArray(ex.sets) && ex.sets.length ? ex.sets.map(s => createSet(s.reps, s.kg)) : [createSet()], custom: Boolean(ex.custom), notes: String(ex.notes || '') };
  }

  function exerciseFingerprint(ex) {
    const raw = normalize([
      ex.originalName || ex.name || '',
      ex.name || '',
      ex.equipment || '',
      ex.target || ex.muscles || '',
      ex.image || '',
      ex.gif_url || ''
    ].join('|'));

    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function ensureUniqueExerciseIds(items, scope = 'exercise') {
    const seen = new Set();

    return (Array.isArray(items) ? items : []).map((item) => {
      const ex = { ...item };
      let id = String(ex.id ?? '').trim();

      if (!id || seen.has(id)) {
        const base = `${scope}-${exerciseFingerprint(ex)}`;
        id = base;
        let suffix = 2;

        while (seen.has(id)) {
          id = `${base}-${suffix++}`;
        }
      }

      seen.add(id);
      ex.id = id;
      return ex;
    });
  }

  function normalizePlan(plan) { return { id: String(plan.id || uid('plan')), name: String(plan.name || 'Nuova scheda'), exercises: Array.isArray(plan.exercises) ? plan.exercises.map(normalizeExercise) : [], updatedAt: plan.updatedAt || Date.now() }; }
  function getActivePlan() { return state.plans.find(plan => plan.id === state.activePlanId) || null; }
  function savePlans() { saveKey(KEYS.plans, state.plans); saveKey(KEYS.active, { planId: state.activePlanId, workout: state.workout, activeSince: state.activeSince, drafts: state.drafts, editingHistoryId: state.editingHistoryId }); }
  function persistAll() { savePlans(); saveKey(KEYS.history, state.history); }
  function currentExercises() { const p = getActivePlan(); return state.workout ? state.workout.exercises : (p ? p.exercises : []); }
  function currentName() { const p = getActivePlan(); return state.workout ? state.workout.name : (p ? p.name : 'Nuova scheda'); }
  function mediaUrl(path) { if (!path) return ''; if (/^https?:\/\//i.test(path)) return path; return MEDIA_BASE + String(path).split('/').map(encodeURIComponent).join('/'); }
  function italianName(name) {
    let text = String(name || 'Esercizio');
    const replacements = [
      [/reverse grip/ig,'presa inversa'], [/close grip/ig,'presa stretta'], [/wide grip/ig,'presa larga'], [/neutral grip/ig,'presa neutra'], [/one arm/ig,'a un braccio'], [/single arm/ig,'a un braccio'], [/barbell bench press/ig,'panca piana con bilanciere'], [/dumbbell bench press/ig,'panca con manubri'], [/incline dumbbell press/ig,'spinte inclinate con manubri'], [/incline bench press/ig,'panca inclinata'], [/decline bench press/ig,'panca declinata'], [/bench press/ig,'panca piana'], [/chest press/ig,'spinte per il petto'], [/shoulder press/ig,'spinte per le spalle'], [/military press/ig,'lento avanti'], [/leg press/ig,'pressa per le gambe'], [/leg extension/ig,'leg extension'], [/lat pulldown/ig,'lat machine'], [/pulldown/ig,'lat machine'], [/pull-up/ig,'trazioni'], [/pull up/ig,'trazioni'], [/chin-up/ig,'trazioni presa supina'], [/chin up/ig,'trazioni presa supina'], [/push-up/ig,'piegamenti'], [/push up/ig,'piegamenti'], [/hip thrust/ig,'hip thrust'], [/glute bridge/ig,'ponte per i glutei'], [/calf raise/ig,'calf raise'], [/lateral raise/ig,'alzate laterali'], [/front raise/ig,'alzate frontali'], [/rear delt/ig,'deltoidi posteriori'], [/bent over row/ig,'rematore piegato'], [/seated row/ig,'rematore da seduto'], [/deadlift/ig,'stacco'], [/romanian/ig,'rumeno'], [/squat/ig,'squat'], [/lunge/ig,'affondo'], [/crunch/ig,'crunch'], [/sit-up/ig,'sit-up'], [/sit up/ig,'sit-up'], [/side bend/ig,'flessione laterale'], [/hip abduction/ig,"abduzione dell'anca"], [/hip adduction/ig,"adduzione dell'anca"], [/bicep curl/ig,'curl per bicipiti'], [/biceps curl/ig,'curl per bicipiti'], [/triceps extension/ig,'estensione tricipiti'], [/barbell/ig,'con bilanciere'], [/dumbbell/ig,'con manubri'], [/cable/ig,'ai cavi'], [/band/ig,'con elastico'], [/kettlebell/ig,'con kettlebell'], [/bodyweight/ig,'a corpo libero'], [/standing/ig,'in piedi'], [/seated/ig,'da seduto'], [/lying/ig,'da sdraiato'], [/kneeling/ig,'in ginocchio'], [/incline/ig,'inclinato'], [/decline/ig,'declinato'], [/alternating/ig,'alternato'], [/biceps/ig,'bicipiti'], [/triceps/ig,'tricipiti'], [/shoulders/ig,'spalle'], [/chest/ig,'petto'], [/back/ig,'schiena'], [/glutes/ig,'glutei'], [/quadriceps/ig,'quadricipiti'], [/hamstrings/ig,'femorali'], [/calves/ig,'polpacci'], [/forearms/ig,'avambracci'], [/raise/ig,'alzata'], [/extension/ig,'estensione']
    ];
    for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
    return text.replace(/\s+/g, ' ').trim().replace(/^./, c => c.toLocaleUpperCase('it-IT'));
  }
  const muscleMap = { chest:'Pettorali', pectorals:'Pettorali', back:'Schiena', shoulders:'Spalle', 'upper arms':'Braccia', 'lower arms':'Avambracci', 'upper legs':'Gambe', 'lower legs':'Polpacci', waist:'Addominali', abs:'Addominali', glutes:'Glutei', neck:'Collo', biceps:'Bicipiti', triceps:'Tricipiti', lats:'Gran dorsale', 'latissimus dorsi':'Gran dorsale', delts:'Deltoidi', quadriceps:'Quadricipiti', hamstrings:'Femorali', calves:'Polpacci', quads:'Quadricipiti', traps:'Trapezio', trapezius:'Trapezio', obliques:'Obliqui', abdominals:'Addominali', forearms:'Avambracci', adductors:'Adduttori', abductors:'Abduttori', 'hip flexors':"Flessori dell'anca", 'lower back':'Lombari', 'upper back':'Schiena alta' };
  function muscleLabel(value) { const raw = String(value || '').replace(/[\[\]"]/g, ''); return raw.split(',').map(part => muscleMap[normalize(part)] || part.trim()).filter(Boolean).join(', ') || 'Muscoli non indicati'; }
  const equipmentMap = { 'body weight':'Corpo libero', dumbbell:'Manubri', barbell:'Bilanciere', cable:'Cavi', band:'Elastico', 'resistance band':'Elastico', kettlebell:'Kettlebell', 'smith machine':'Smith Machine', 'leverage machine':'Macchina', assisted:'Macchina assistita', 'ez barbell':'Bilanciere EZ', 'stability ball':'Fitball', 'medicine ball':'Palla medica', weighted:'Con sovraccarico', 'stationary bike':'Cyclette', 'elliptical machine':'Ellittica' };
  function equipmentLabel(value) { const key = normalize(value); return equipmentMap[key] || value || 'Attrezzatura non indicata'; }

  function renderPlanSelect() {
    ui.planSelect.innerHTML = '';
    if (!state.plans.length) { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Crea la prima scheda'; ui.planSelect.appendChild(opt); return; }
    [...state.plans].sort((a,b) => a.name.localeCompare(b.name,'it',{sensitivity:'base'})).forEach(plan => { const opt = document.createElement('option'); opt.value = plan.id; opt.textContent = plan.name; ui.planSelect.appendChild(opt); });
    ui.planSelect.value = state.activePlanId || state.plans[0].id;
  }
  function renderWorkout() {
    const historyMode = Boolean(state.editingHistoryId);
    const previouslyInHistory = document.body.classList.contains('history-review');
    const expandedHistoryIds = historyMode && previouslyInHistory
      ? new Set(
          [...ui.workoutList.querySelectorAll('.exercise-card:not(.history-collapsed)')]
            .map(card => String(card.dataset.exerciseId))
        )
      : new Set();

    document.body.classList.toggle('history-review', historyMode);

    // Usa il colore effettivo del pulsante originale "Termina allenamento".
    const finishButton = document.getElementById('finishWorkoutButton');
    if (finishButton) {
      document.documentElement.style.setProperty(
        '--gymgiuse-finish-bg',
        getComputedStyle(finishButton).backgroundColor
      );
    }

    const p = getActivePlan(); const exercises = currentExercises();
    ui.planName.value = state.workout ? state.workout.name : (p ? p.name : '');
    ui.planName.readOnly = Boolean(state.workout);
    ui.workoutHeading.textContent = state.workout ? `${state.workout.name} · in corso` : (p ? p.name : 'La tua scheda');
    ui.exerciseTotal.textContent = `${exercises.length} ${exercises.length === 1 ? 'esercizio' : 'esercizi'}`;
    ui.emptyWorkout.hidden = exercises.length > 0;
    ui.workoutList.innerHTML = exercises.map((ex,index) => {
      const video = ex.video_url || VITAL_VIDEO_BY_ID[String(ex.id)] || '';
      const poster = video && video.split('?')[0].toLowerCase().endsWith('.mp4')
        ? video.split('?')[0].replace(/\/videos\/([^/]+)\.mp4$/i, '/posters/$1.jpg')
        : '';
      const thumbnail = poster || (ex.image ? mediaUrl(ex.image) : '');
      const target = muscleLabel(ex.target || ex.muscles || '');
      const equipment = equipmentLabel(ex.equipment);
      const historyExpanded = historyMode && expandedHistoryIds.has(String(ex.id));
      const cardState = historyMode && !historyExpanded ? ' history-collapsed' : '';
      const expandedText = historyExpanded ? 'true' : 'false';
      const arrow = historyExpanded ? '⌃' : '⌄';

      return `<article class="exercise-card${cardState}" data-exercise-id="${escapeHtml(ex.id)}">
        <button class="exercise-accordion-toggle" type="button"
          data-action="toggle-exercise"
          data-id="${escapeHtml(ex.id)}"
          aria-expanded="${expandedText}">
          <span class="exercise-accordion-number">${index + 1}</span>
          <span class="exercise-accordion-name">${escapeHtml(ex.name)}</span>
          <span class="exercise-accordion-arrow" aria-hidden="true">${arrow}</span>
        </button>
        <div class="exercise-card-top">
          <button class="mini-media-button" type="button" data-action="details" data-id="${escapeHtml(ex.id)}" aria-label="Vedi animazione e istruzioni di ${escapeHtml(ex.name)}">${thumbnail
            ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<span class="no-image">${video ? '▶' : (ex.custom ? '✎' : '＋')}</span>`}<span class="play-overlay">▶</span></button>
          <div class="exercise-title-wrap"><h2>${escapeHtml(ex.name)}</h2><p>${escapeHtml(target)}</p><p class="equipment">${escapeHtml(equipment)}</p></div>
          <div class="exercise-tools"><button class="small-icon" type="button" data-action="up" data-id="${escapeHtml(ex.id)}" aria-label="Sposta su" ${index===0?'disabled':''}>↑</button><button class="small-icon" type="button" data-action="down" data-id="${escapeHtml(ex.id)}" aria-label="Sposta giù" ${index===exercises.length-1?'disabled':''}>↓</button><button class="small-icon remove" type="button" data-action="remove" data-id="${escapeHtml(ex.id)}" aria-label="Rimuovi esercizio">×</button></div>
        </div>
        <div class="sets-table"><div class="sets-header"><span>Serie</span><span>Rip.</span><span>Kg</span></div>
          ${ex.sets.map((set,setIndex) => `<div class="set-row"><span class="set-number">${setIndex+1}</span><input class="set-input" inputmode="numeric" pattern="[0-9]*" type="text" value="${escapeHtml(set.reps)}" placeholder="—" aria-label="Ripetizioni serie ${setIndex+1} di ${escapeHtml(ex.name)}" data-field="reps" data-id="${escapeHtml(ex.id)}" data-set="${setIndex}"><input class="set-input" inputmode="decimal" type="text" value="${escapeHtml(set.kg)}" placeholder="—" aria-label="Chilogrammi serie ${setIndex+1} di ${escapeHtml(ex.name)}" data-field="kg" data-id="${escapeHtml(ex.id)}" data-set="${setIndex}"></div>`).join('')}
          <div class="set-actions"><button class="set-action" type="button" data-action="add-set" data-id="${escapeHtml(ex.id)}">＋ Serie</button><button class="set-action" type="button" data-action="remove-set" data-id="${escapeHtml(ex.id)}" ${ex.sets.length<=1?'disabled':''}>− Ultima serie</button></div>
        </div>
        <div class="exercise-card-bottom"><button class="detail-link" type="button" data-action="details" data-id="${escapeHtml(ex.id)}">ANIMAZIONE E ISTRUZIONI ↗</button><small>${ex.custom ? 'Personalizzato' : 'Scheda modificabile'}</small></div>
      </article>`;
    }).join('');
  }

  function activeStorageTarget() { return state.workout ? state.workout.exercises : (getActivePlan()?.exercises || []); }
  function persistEditorChange(message = 'Modifica salvata') {
    if (state.workout) { if (!state.editingHistoryId) { state.drafts[state.workout.planId || state.activePlanId] = clone(state.workout); saveKey('gymgiusim_drafts_v1', state.drafts); } saveKey(KEYS.active, { planId: state.activePlanId, workout: state.workout, activeSince: state.activeSince, drafts: state.drafts, editingHistoryId: state.editingHistoryId }); }
    else { const plan = getActivePlan(); if (plan) { plan.updatedAt = Date.now(); saveKey(KEYS.plans, state.plans); } }
    ui.saveStatus.textContent = message;
  }
  function locateExercise(id) { return activeStorageTarget().find(ex => String(ex.id) === String(id)); }
  function updateSet(input) {
    const ex = locateExercise(input.dataset.id); if (!ex) return;
    const set = ex.sets[Number(input.dataset.set)]; if (!set) return;
    set[input.dataset.field] = input.value;
    persistEditorChange();
  }
  function reRenderPreservingFocus(oldInput) {
    const info = { id:oldInput?.dataset.id, set:oldInput?.dataset.set, field:oldInput?.dataset.field, start:oldInput?.selectionStart, end:oldInput?.selectionEnd };
    renderWorkout();
    if (info.id) { const selector = `.set-input[data-id="${CSS.escape(info.id)}"][data-set="${info.set}"][data-field="${info.field}"]`; const next = ui.workoutList.querySelector(selector); if (next) { next.focus({preventScroll:true}); try { next.setSelectionRange(info.start,info.end); } catch (_) {} } }
  }
  function currentSetValueFor(exerciseId, field, index) { const ex = locateExercise(exerciseId); return ex?.sets[index]?.[field] ?? ''; }
  function lastHistoryExercise(id) {
    for (let i = state.history.length - 1; i >= 0; i--) { const found = (state.history[i].exercises || []).find(ex => String(ex.id) === String(id)); if (found) return found; }
    return null;
  }
  function addExercise(exercise) {
    const target = activeStorageTarget();
    const identity = (ex) => normalize([
      ex.originalName || ex.name || '',
      ex.equipment || '',
      ex.target || ex.muscles || ''
    ].join('|'));

    if (target.some(ex =>
      String(ex.id) === String(exercise.id) ||
      (identity(ex) && identity(ex) === identity(exercise))
    )) {
      showToast('Questo esercizio è già nella scheda');
      return;
    }
    const previous = lastHistoryExercise(exercise.id);
    const baseSets = previous?.sets?.length ? clone(previous.sets) : [createSet()];
    target.push(normalizeExercise({ ...exercise, sets: baseSets }));
    persistEditorChange('Esercizio aggiunto e salvato'); renderWorkout();
    ui.search.value = ''; updateSearchDisplay(); ui.search.blur(); showToast('Esercizio aggiunto alla scheda');
  }
  function onWorkoutClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;

    // Apertura e chiusura della nuvoletta nello Storico.
    // Non ricostruisce l'esercizio e non altera i dati salvati.
    if (action === 'toggle-exercise') {
      const card = btn.closest('.exercise-card');
      if (!card) return;

      const collapsed = card.classList.toggle('history-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));

      const arrow = btn.querySelector('.exercise-accordion-arrow');
      if (arrow) arrow.textContent = collapsed ? '⌄' : '⌃';
      return;
    }

    const exercises = activeStorageTarget();
    const index = exercises.findIndex(ex => String(ex.id) === String(id));
    if (index < 0) return;
    if (action === 'details') { openDetail(exercises[index]); return; }
    if (action === 'remove') { if (confirm(`Rimuovere "${exercises[index].name}" dalla scheda?`)) { exercises.splice(index,1); persistEditorChange(); renderWorkout(); } return; }
    if (action === 'up' && index > 0) [exercises[index-1],exercises[index]] = [exercises[index],exercises[index-1]];
    if (action === 'down' && index < exercises.length-1) [exercises[index+1],exercises[index]] = [exercises[index],exercises[index+1]];
    if (action === 'add-set') { const last = exercises[index].sets.at(-1) || createSet(); exercises[index].sets.push(createSet(last.reps,last.kg)); }
    if (action === 'remove-set' && exercises[index].sets.length > 1) exercises[index].sets.pop();
    persistEditorChange(); renderWorkout();
  }
  function createPlan(name = 'Nuova scheda') { if (state.workout) { state.drafts[state.workout.planId || state.activePlanId] = clone(state.workout); saveKey('gymgiusim_drafts_v1',state.drafts); } const plan = { id:uid('plan'), name, exercises:[], updatedAt:Date.now() }; state.plans.push(plan); state.activePlanId = plan.id; state.workout = null; state.activeSince = null; state.editingHistoryId=null; savePlans(); renderPlanSelect(); renderWorkout(); ui.planName.focus(); ui.planName.select(); showToast('Nuova scheda creata'); }
  function changePlan(id) {
    if (state.workout) state.drafts[state.workout.planId || state.activePlanId] = clone(state.workout);
    state.activePlanId = id;
    state.workout = state.drafts[id] ? clone(state.drafts[id]) : null;
    state.activeSince = state.workout ? (state.workout.startedAt || Date.now()) : null;
    state.editingHistoryId = state.workout ? (state.workout.editingHistoryId || null) : null;
    savePlans(); renderPlanSelect(); renderWorkout();
  }
  function renamePlan() {
    if (state.workout) return;
    const plan = getActivePlan();
    if (!plan) return;
    const name = ui.planName.value.trim();
    if (!name) {
      ui.planName.value = plan.name;
      showToast('Il nome non può essere vuoto');
      return;
    }
    plan.name = name;
    plan.updatedAt = Date.now();
    savePlans();
    renderPlanSelect();
    ui.planName.value = name;
    ui.workoutHeading.textContent = name;
    showToast('Nome della scheda salvato');
  }
  function deleteCurrentPlan() { const plan = getActivePlan(); if (!plan) return; if (!confirm(`Eliminare definitivamente la scheda "${plan.name}"? Lo storico degli allenamenti non verrà eliminato.`)) return; state.plans = state.plans.filter(p => p.id !== plan.id); state.activePlanId = state.plans[0]?.id || null; state.workout = null; state.activeSince = null; if (!state.plans.length) createPlan('La mia scheda'); else { savePlans(); renderPlanSelect(); renderWorkout(); } showToast('Scheda eliminata'); }
  function startWorkout() { const plan = getActivePlan(); if (!plan) return; if (state.workout) { showToast('Hai già un allenamento o una seduta aperta'); return; } if (state.drafts[plan.id]) { state.workout=clone(state.drafts[plan.id]); state.activeSince=state.workout.startedAt||Date.now(); state.editingHistoryId=state.workout.editingHistoryId||null; } else { state.workout = { id:uid('workout'), planId:plan.id, name:plan.name, date:dateKey(), startedAt:Date.now(), exercises:clone(plan.exercises) }; state.activeSince = Date.now(); state.editingHistoryId=null; } saveKey(KEYS.active,{planId:state.activePlanId,workout:state.workout,activeSince:state.activeSince,drafts:state.drafts,editingHistoryId:state.editingHistoryId}); renderWorkout(); showToast('Allenamento aperto: le modifiche vengono salvate'); }
  function finishWorkout() {
    if (!state.workout) {
      const plan = getActivePlan(); if (!plan) return;
      if (!confirm('Non hai avviato un allenamento. Vuoi registrare questa scheda nello storico adesso?')) return;
      state.workout = { id:uid('workout'), planId:plan.id, name:plan.name, date:dateKey(), startedAt:Date.now(), exercises:clone(plan.exercises) };
    }
    if (!state.workout.exercises.length && !confirm('La scheda non contiene esercizi. Vuoi salvarla comunque nello storico?')) return;
    const dateInput = prompt('Data dell’allenamento (AAAA-MM-GG):', state.workout.date || dateKey());
    if (dateInput === null) return;
    const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim()) ? dateInput.trim() : dateKey();
    const record = { ...clone(state.workout), id:state.editingHistoryId || state.workout.id || uid('workout'), date:chosenDate, endedAt:Date.now(), exerciseCount:state.workout.exercises.length };
    if (state.editingHistoryId) { const oldIndex = state.history.findIndex(item => item.id === state.editingHistoryId); if (oldIndex >= 0) state.history[oldIndex] = record; else state.history.push(record); }
    else state.history.push(record);
    saveKey(KEYS.history,state.history);
    const plan = state.plans.find(p => p.id === record.planId);
    if (plan && !state.editingHistoryId && confirm('Allenamento salvato. Vuoi aggiornare la scheda con i pesi e le ripetizioni appena registrati?')) { plan.exercises = clone(record.exercises); plan.updatedAt = Date.now(); saveKey(KEYS.plans,state.plans); }
    delete state.drafts[record.planId]; saveKey('gymgiusim_drafts_v1',state.drafts);
    state.workout = null; state.activeSince = null; state.editingHistoryId=null; saveKey(KEYS.active,{planId:state.activePlanId,workout:null,activeSince:null,drafts:state.drafts,editingHistoryId:null}); renderWorkout(); showToast('Allenamento salvato nello storico');
  }
  const italianSearchAliases = [
    ['bench press','panca piana panche distensioni'],['chest press','spinte petto'],['incline','inclinata inclinato'],['decline','declinata declinato'],['flat','piana piano'],['fly','croci aperture'],['butterfly','croci pettorali'],['crossover','croci cavi'],['squat','accosciata'],['deadlift','stacco stacchi'],['romanian','rumeno rumeni'],['lunge','affondo affondi'],['leg press','pressa gambe'],['leg extension','estensioni gambe'],['leg curl','flessioni gambe'],['pull up','trazioni sbarra'],['pull-up','trazioni sbarra'],['chin up','trazioni presa inversa'],['pulldown','trazioni lat machine'],['push up','piegamenti flessioni'],['push-up','piegamenti flessioni'],['row','rematore remata'],['curl','bicipiti'],['lateral raise','alzate laterali'],['front raise','alzate frontali'],['shoulder press','spinte spalle'],['military press','lento avanti'],['overhead press','spinte spalle'],['rear delt','deltoidi posteriori'],['hip thrust','glutei spinta bacino'],['glute bridge','ponte glutei'],['calf raise','polpacci'],['shrug','scrollate'],['crunch','addominali'],['sit up','addominali'],['plank','addominali'],['dip','parallele'],['chest','petto pettorali'],['back','schiena dorso dorsali'],['shoulder','spalle deltoidi'],['biceps','bicipiti'],['glutes','glutei'],['quadriceps','quadricipiti'],['hamstrings','femorali'],['calves','polpacci'],['waist','addome addominali'],['abs','addominali'],['dumbbell','manubri manubrio'],['barbell','bilanciere'],['cable','cavi cavo'],['machine','macchina macchinario'],['body weight','corpo libero'],['band','elastico'],['seated','seduto seduta'],['standing','in piedi']
  ];
  
  // Genera nomi alternativi per migliorare la ricerca degli esercizi.
  // Conserva il nome originale e non crea nuovi esercizi.
  function buildExerciseAliases(item) {
    const aliases = new Set();

    const add = value => {
      if (value == null) return;
      const text = String(value).trim();
      if (text) aliases.add(text);
    };

    const original = String(item.originalName || item.name || '')
      .replace(/\s+v\.\s*\d+\s*$/i, '')
      .trim();

    const name = String(item.name || '').trim();
    const equipment = String(item.equipment || '').toLowerCase().trim();
    const target = String(item.target || '').toLowerCase().trim();

    add(name);
    add(original);
    add(item.originalName);
    add(item.target);
    add(item.equipment);
    add(item.aliases);

    const lower = original.toLowerCase();
    add(lower);

    // Varianti di denominazione delle macchine.
    const machinePrefixes = [
      'lever ',
      'machine ',
      'smith machine ',
      'cable ',
      'dumbbell ',
      'barbell ',
      'kettlebell ',
      'resistance band ',
      'band '
    ];

    for (const prefix of machinePrefixes) {
      if (lower.startsWith(prefix)) {
        const movement = lower.slice(prefix.length).trim();
        add(movement);

        if (prefix === 'lever ') {
          add(movement + ' machine');
          add('machine ' + movement);
          add('lever machine ' + movement);
        }

        if (prefix === 'dumbbell ') {
          add(movement + ' dumbbell');
          add(movement + ' with dumbbells');
          add(movement + ' con manubri');
        }

        if (prefix === 'barbell ') {
          add(movement + ' barbell');
          add(movement + ' with barbell');
          add(movement + ' con bilanciere');
        }

        if (prefix === 'cable ') {
          add(movement + ' cable');
          add(movement + ' ai cavi');
          add(movement + ' al cavo');
        }

        if (prefix === 'smith machine ') {
          add(movement + ' smith machine');
          add(movement + ' multipower');
          add('multipower ' + movement);
        }

        if (prefix === 'kettlebell ') {
          add(movement + ' kettlebell');
          add(movement + ' con kettlebell');
        }

        if (prefix === 'resistance band ' || prefix === 'band ') {
          add(movement + ' resistance band');
          add(movement + ' con elastico');
          add(movement + ' con elastici');
        }
      }
    }

    // Sinonimi italiani e inglesi delle principali famiglie di esercizi.
    const phrases = [
      ['shoulder press', [
        'shoulder press machine',
        'machine shoulder press',
        'pressa per le spalle',
        'pressa spalle',
        'spinte per le spalle',
        'distensioni per le spalle'
      ]],
      ['lateral raise', [
        'alzate laterali',
        'alzata laterale',
        'sollevamenti laterali'
      ]],
      ['front raise', [
        'alzate frontali',
        'alzata frontale',
        'sollevamenti frontali'
      ]],
      ['rear lateral raise', [
        'alzate posteriori',
        'alzate posteriori delle spalle'
      ]],
      ['reverse fly', [
        'aperture inverse',
        'aperture posteriori',
        'aperture per deltoidi posteriori'
      ]],
      ['upright row', [
        'tirate al mento',
        'tirata al mento'
      ]],
      ['chest press', [
        'pressa per il petto',
        'spinte per il petto',
        'distensioni per il petto'
      ]],
      ['bench press', [
        'panca piana',
        'distensioni su panca',
        'spinte su panca'
      ]],
      ['incline press', [
        'panca inclinata',
        'spinte su panca inclinata',
        'distensioni su panca inclinata'
      ]],
      ['decline press', [
        'panca declinata',
        'spinte su panca declinata'
      ]],
      ['lat pulldown', [
        'lat machine',
        'trazioni alla lat machine',
        'tirate alla lat machine'
      ]],
      ['seated row', [
        'rematore da seduto',
        'rematore seduto',
        'pulley basso'
      ]],
      ['bent over row', [
        'rematore piegato',
        'rematore busto inclinato'
      ]],
      ['leg press', [
        'pressa per le gambe',
        'pressa gambe'
      ]],
      ['leg extension', [
        'estensioni delle gambe',
        'leg extension'
      ]],
      ['leg curl', [
        'flessioni delle gambe',
        'leg curl'
      ]],
      ['biceps curl', [
        'curl bicipiti',
        'curl per bicipiti',
        'flessioni dei bicipiti'
      ]],
      ['triceps extension', [
        'estensioni tricipiti',
        'estensioni per tricipiti'
      ]],
      ['calf raise', [
        'sollevamenti polpacci',
        'calf raise'
      ]],
      ['deadlift', [
        'stacco da terra',
        'stacco'
      ]],
      ['squat', [
        'squat',
        'accosciata'
      ]],
      ['pull up', [
        'trazioni alla sbarra',
        'trazioni'
      ]],
      ['chin up', [
        'trazioni presa inversa',
        'trazioni supine'
      ]],
      ['push up', [
        'piegamenti',
        'flessioni'
      ]],
      ['plank', [
        'plank',
        'plancia'
      ]],
      ['crunch', [
        'crunch addominali',
        'piegamenti addominali'
      ]],
      ['hip thrust', [
        'spinte d anca',
        'spinta d anca',
        'hip thrust'
      ]],
      ['glute bridge', [
        'ponte per i glutei',
        'glute bridge'
      ]],
      ['face pull', [
        'tirate al viso',
        'face pull ai cavi'
      ]]
    ];

    for (const [phrase, variants] of phrases) {
      if (lower.includes(phrase)) {
        for (const variant of variants) add(variant);
      }
    }

    // Varianti per esercizi alla macchina a leva.
    if (
      equipment.includes('leverage') ||
      lower.startsWith('lever ')
    ) {
      const movement = lower.replace(/^lever\s+/, '').trim();

      add(movement + ' machine');
      add('machine ' + movement);
      add('lever ' + movement);
      add('macchina ' + movement);
    }

    // Sinonimi dei principali nomi delle attrezzature.
    if (equipment.includes('leverage')) {
      add('machine');
      add('macchina');
      add('macchina a leve');
      add('macchinario');
    }

    if (equipment.includes('dumbbell')) {
      add('manubri');
      add('manubrio');
    }

    if (equipment.includes('barbell')) {
      add('bilanciere');
      add('bilancieri');
    }

    if (equipment.includes('cable')) {
      add('cavo');
      add('cavi');
      add('ai cavi');
    }

    // Sinonimi dei gruppi muscolari.
    const muscleAliases = {
      delts: ['spalle', 'deltoidi', 'muscoli delle spalle'],
      pectorals: ['petto', 'pettorali', 'muscoli pettorali'],
      lats: ['schiena', 'gran dorsale', 'dorsali'],
      'upper back': ['schiena alta', 'parte alta della schiena'],
      biceps: ['bicipiti', 'muscoli bicipiti'],
      triceps: ['tricipiti', 'muscoli tricipiti'],
      quads: ['quadricipiti', 'cosce anteriori'],
      hamstrings: ['femorali', 'posteriori della coscia'],
      glutes: ['glutei', 'muscoli glutei'],
      abs: ['addominali', 'addome'],
      calves: ['polpacci', 'muscoli del polpaccio'],
      forearms: ['avambracci'],
      traps: ['trapezi', 'trapezio'],
      traps: ['trapezi', 'trapezio'],
      adductors: ['adduttori'],
      abductors: ['abduttori', 'muscoli abduttori']
    };

    for (const [muscle, variants] of Object.entries(muscleAliases)) {
      if (target.includes(muscle)) {
        for (const variant of variants) add(variant);
      }
    }

    return [...aliases];
  }


  // Genera sinonimi di ricerca dinamici per ogni esercizio del catalogo.
  // Non crea esercizi e non modifica GIF, immagini o schede.
  function buildExerciseSearchAliases(ex) {
    const aliases = new Set();

    const add = value => {
      if (value == null) return;
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      const text = String(value).trim();
      if (text) aliases.add(text);
    };

    const name = normalize(ex.name || '');
    const original = normalize(ex.originalName || ex.name || '');
    const equipment = normalize(ex.equipment || '');
    const target = normalize(
      [ex.target, ex.muscles, ex.secondaryMuscles].flat().filter(Boolean).join(' ')
    );

    add(ex.name);
    add(ex.originalName);
    add(ex.target);
    add(ex.equipment);

    // Attrezzature: riconosce vari modi comuni di descrivere lo stesso mezzo.
    const equipmentVariants = [
      {
        terms: ['lever', 'leverage', 'machine'],
        aliases: [
          'machine', 'macchina', 'macchine',
          'macchina guidata', 'macchina a leve'
        ]
      },
      {
        terms: ['dumbbell'],
        aliases: ['manubrio', 'manubri', 'con manubri']
      },
      {
        terms: ['barbell'],
        aliases: ['bilanciere', 'bilancieri', 'con bilanciere']
      },
      {
        terms: ['cable'],
        aliases: ['cavo', 'cavi', 'ai cavi', 'al cavo']
      },
      {
        terms: ['smith'],
        aliases: ['smith machine', 'multipower', 'macchina multipower']
      },
      {
        terms: ['kettlebell'],
        aliases: ['kettlebell', 'con kettlebell']
      },
      {
        terms: ['band', 'resistance band'],
        aliases: ['elastico', 'elastici', 'banda elastica']
      },
      {
        terms: ['bodyweight', 'body only'],
        aliases: ['corpo libero', 'senza attrezzi']
      },
      {
        terms: ['ez bar'],
        aliases: ['barra ez', 'bilanciere ez']
      },
      {
        terms: ['trap bar'],
        aliases: ['barra esagonale', 'trap bar']
      }
    ];

    for (const group of equipmentVariants) {
      if (group.terms.some(term => original.includes(normalize(term)) ||
                                  equipment.includes(normalize(term)))) {
        add(group.aliases);
      }
    }

    // Varianti di nome per le principali famiglie di movimenti.
    // Vengono aggiunte soltanto quando il nome originale contiene il movimento.
    const movementVariants = [
      ['shoulder press', [
        'shoulder press machine',
        'machine shoulder press',
        'pressa per le spalle',
        'spinte per le spalle',
        'distensioni per le spalle'
      ]],
      ['lateral raise', [
        'alzate laterali', 'alzata laterale',
        'sollevamenti laterali'
      ]],
      ['front raise', [
        'alzate frontali', 'alzata frontale',
        'sollevamenti frontali'
      ]],
      ['rear delt', [
        'deltoidi posteriori', 'spalle posteriori'
      ]],
      ['reverse fly', [
        'aperture inverse', 'aperture posteriori'
      ]],
      ['chest press', [
        'chest press machine', 'pressa per il petto',
        'spinte per il petto'
      ]],
      ['bench press', [
        'panca piana', 'distensioni su panca',
        'spinte su panca'
      ]],
      ['incline press', [
        'panca inclinata', 'spinte su panca inclinata',
        'distensioni su panca inclinata'
      ]],
      ['decline press', [
        'panca declinata', 'spinte su panca declinata'
      ]],
      ['lat pulldown', [
        'lat machine', 'tirate alla lat machine',
        'trazioni alla lat machine'
      ]],
      ['seated row', [
        'rematore seduto', 'rematore da seduto', 'pulley basso'
      ]],
      ['bent over row', [
        'rematore piegato', 'rematore a busto inclinato'
      ]],
      ['upright row', [
        'tirate al mento', 'tirata al mento'
      ]],
      ['biceps curl', [
        'curl bicipiti', 'curl per bicipiti',
        'flessioni dei bicipiti'
      ]],
      ['triceps extension', [
        'estensioni tricipiti', 'estensioni per tricipiti'
      ]],
      ['leg press', [
        'pressa per le gambe', 'pressa gambe'
      ]],
      ['leg extension', [
        'leg extension', 'estensioni delle gambe'
      ]],
      ['leg curl', [
        'leg curl', 'flessioni delle gambe'
      ]],
      ['calf raise', [
        'sollevamenti polpacci', 'polpacci'
      ]],
      ['deadlift', [
        'stacco da terra', 'stacco'
      ]],
      ['squat', [
        'accosciata', 'squat'
      ]],
      ['lunge', [
        'affondi', 'affondo'
      ]],
      ['pull up', [
        'trazioni alla sbarra', 'trazioni'
      ]],
      ['chin up', [
        'trazioni presa inversa', 'trazioni supine'
      ]],
      ['push up', [
        'piegamenti', 'flessioni'
      ]],
      ['crunch', [
        'crunch addominali', 'addominali'
      ]],
      ['plank', [
        'plancia', 'plank addominale'
      ]],
      ['hip thrust', [
        'spinte d anca', 'spinta d anca'
      ]],
      ['glute bridge', [
        'ponte per i glutei', 'ponte glutei'
      ]],
      ['face pull', [
        'tirate al viso', 'face pull ai cavi'
      ]],
      ['shrug', [
        'scrollate', 'scrollate delle spalle'
      ]],
      ['wrist curl', [
        'curl polsi', 'flessioni dei polsi'
      ]],
      ['hip abduction', [
        'abduzioni dell anca', 'abduzioni anche'
      ]],
      ['hip adduction', [
        'adduzioni dell anca', 'adduzioni anche'
      ]]
    ];

    for (const [english, alternatives] of movementVariants) {
      if (original.includes(normalize(english))) {
        add(alternatives);
      }
    }

    // Varianti di ordine del nome, mantenendo il movimento originale.
    // Esempio: "lever shoulder press" -> "shoulder press machine".
    const prefixes = [
      ['lever ', ['machine ', '', 'macchina ']],
      ['dumbbell ', ['', 'con manubri ', 'manubri ']],
      ['barbell ', ['', 'con bilanciere ', 'bilanciere ']],
      ['cable ', ['', 'ai cavi ', 'al cavo ']],
      ['smith machine ', ['', 'multipower ']],
      ['kettlebell ', ['', 'con kettlebell ']],
      ['resistance band ', ['', 'con elastico ']],
      ['band ', ['', 'con elastico ']]
    ];

    for (const [prefix, replacements] of prefixes) {
      if (!original.startsWith(normalize(prefix))) continue;

      const movement = original.slice(normalize(prefix).length).trim();

      for (const replacement of replacements) {
        add((replacement + movement).trim());
      }

      if (prefix === 'lever ') {
        add(movement + ' machine');
        add(movement + ' alla macchina');
        add(movement + ' macchina');
      }

      if (prefix === 'dumbbell ') {
        add(movement + ' con manubri');
        add(movement + ' dumbbell');
      }

      if (prefix === 'barbell ') {
        add(movement + ' con bilanciere');
        add(movement + ' barbell');
      }

      if (prefix === 'cable ') {
        add(movement + ' ai cavi');
        add(movement + ' cable');
      }
    }

    // Nomi dei gruppi muscolari, applicati in base ai campi del record.
    const muscleVariants = [
      ['delts', ['spalle', 'deltoidi']],
      ['shoulder', ['spalle', 'deltoidi']],
      ['pectorals', ['petto', 'pettorali']],
      ['chest', ['petto', 'pettorali']],
      ['lats', ['dorsali', 'schiena']],
      ['back', ['schiena', 'dorsali']],
      ['biceps', ['bicipiti']],
      ['triceps', ['tricipiti']],
      ['forearms', ['avambracci']],
      ['quads', ['quadricipiti', 'cosce']],
      ['hamstrings', ['femorali', 'posteriori della coscia']],
      ['glutes', ['glutei']],
      ['glute', ['glutei']],
      ['abs', ['addominali', 'addome']],
      ['abdominals', ['addominali', 'addome']],
      ['calves', ['polpacci']],
      ['traps', ['trapezi', 'trapezio']],
      ['adductors', ['adduttori']],
      ['abductors', ['abduttori']]
    ];

    for (const [english, italian] of muscleVariants) {
      if (target.includes(normalize(english)) ||
          original.includes(normalize(english))) {
        add(italian);
      }
    }


    // Riconosce le varianti "one arm" e "single arm".
    // Genera sinonimi di ricerca, senza creare nuovi esercizi.
    const unilateralAlias = [...aliases];

    for (const alias of unilateralAlias) {
      const normalizedAlias = normalize(alias);

      if (/\bone arm\b/.test(normalizedAlias)) {
        add(normalizedAlias.replace(/\bone arm\b/g, 'single arm'));
      }

      if (/\bsingle arm\b/.test(normalizedAlias)) {
        add(normalizedAlias.replace(/\bsingle arm\b/g, 'one arm'));
      }

      if (/\bunilateral\b/.test(normalizedAlias)) {
        add(normalizedAlias.replace(/\bunilateral\b/g, 'one arm'));
        add(normalizedAlias.replace(/\bunilateral\b/g, 'single arm'));
      }
    }


    // GYMGIUSE_EXACT_VARIANT_ALIAS_MAP
    // Sinonimi per varianti già presenti nel catalogo.
    // Non crea esercizi e non cambia le animazioni.

    const extraExerciseAliases = {
      'lever calf press': [
        'machine calf press',
        'calf press machine',
        'pressa per i polpacci alla macchina'
      ],
      'lever high row': [
        'machine high row',
        'high row machine',
        'rematore alto alla macchina'
      ],
      'lever pullover': [
        'machine pullover',
        'pullover machine',
        'pullover alla macchina'
      ],
      'lever seated dip': [
        'machine seated dip',
        'seated dip machine',
        'dip alla macchina da seduto'
      ],
      'lever seated fly': [
        'machine seated fly',
        'seated fly machine',
        'aperture al petto alla macchina'
      ],
      'lever shrug': [
        'machine shrug',
        'shrug machine',
        'scrollate alla macchina'
      ],
      'lever t bar row': [
        'machine t bar row',
        't bar row machine',
        'rematore t bar alla macchina'
      ],
      'lever one arm shoulder press': [
        'machine single arm shoulder press',
        'single arm shoulder press machine',
        'one arm shoulder press machine',
        'spinte per le spalle alla macchina a un braccio'
      ],
      'lever one arm lateral high row': [
        'machine single arm lateral high row',
        'single arm lateral high row machine',
        'rematore alto alla macchina a un braccio'
      ],
      'cable one arm lateral bent over': [
        'single arm bent over cable lateral raise',
        'one arm bent over cable lateral raise',
        'alzata laterale al cavo piegato a un braccio'
      ],
      'roller seated shoulder flexor depresor retractor': [
        'seated roller shoulder flexion and retraction',
        'roller seated shoulder flexion',
        'flessione e retrazione delle spalle da seduto con rullo'
      ],
      'basic toe touch male': [
        'standing toe touch',
        'standing toe touches',
        'tocco delle punte dei piedi in piedi'
      ]
    };

    const exerciseAliasBase = original.replace(/\s+v\s+\d+$/, '');

    for (const [exerciseName, synonyms] of Object.entries(extraExerciseAliases)) {
      if (exerciseAliasBase === exerciseName) {
        add(synonyms);
      }
    }

    return [...aliases].join(' ');
  }


  // GYMGIUSE_FUZZY_SEARCH_V1
  // Ricerca tollerante agli errori di digitazione per tutto il catalogo.
  function searchEditDistance(a, b) {
    a = normalize(a);
    b = normalize(b);

    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);

    let previous = Array.from(
      { length: b.length + 1 },
      (_, i) => i
    );

    for (let i = 1; i <= a.length; i++) {
      const current = [i];

      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );

        // Riconosce anche lettere adiacenti digitate al contrario.
        if (
          i > 1 && j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          current[j] = Math.min(current[j], previous[j - 2] + 1);
        }
      }

      previous = current;
    }

    return previous[b.length];
  }

  function searchTokenMatches(queryWord, catalogWord) {
    if (queryWord === catalogWord) return true;

    // Continua a supportare le ricerche parziali.
    if (
      queryWord.length >= 3 &&
      catalogWord.startsWith(queryWord)
    ) {
      return true;
    }

    const longest = Math.max(queryWord.length, catalogWord.length);

    // Per le parole brevi evitiamo corrispondenze troppo permissive.
    if (longest < 4) return false;

    const distance = searchEditDistance(queryWord, catalogWord);

    // Una modifica per parole brevi/medie, due per parole lunghe.
    const allowedDistance = longest >= 8 ? 2 : 1;

    return distance <= allowedDistance;
  }

  function matchesExercise(ex, query) {
    const textBase = [ex.name, ex.originalName, italianName(ex.originalName || ex.name), ex.target, ex.equipment, ...(ex.secondaryMuscles || [])].join(' ');
    const normalizedBase = normalize(textBase);
    const aliases = [];
    for (const [english, italian] of italianSearchAliases) {
      const key = normalize(english);
      if ((` ${normalizedBase} `).includes(` ${key} `) || normalizedBase.split(' ').some(part => part.startsWith(key))) aliases.push(italian);
    }
    const text = normalize(textBase + ' ' + aliases.join(' ') + ' ' + buildExerciseSearchAliases(ex));
    const queryWords = normalize(query).split(' ').filter(Boolean);
    const textWords = text.split(' ').filter(Boolean);

    if (!queryWords.length) return true;

    // Ogni termine cercato deve corrispondere a una parola del catalogo.
    // Il confronto tollera lettere mancanti, errate o invertite.
    return queryWords.every(word =>
      textWords.some(token => searchTokenMatches(word, token))
    );
  }

  // Ordina i risultati in base alla corrispondenza con il movimento
  // richiesto e con l'attrezzatura specificata dall'utente.

  // GYMGIUSIM_FAST_SEARCH_V4
  function scoreExerciseSearch(ex, query) {

    const clean = value => normalize(String(value || '')).trim();

    let q = clean(query);

    if (!q) return 0;

    q = q.replace(/\bpeck\b/g, 'pec');

    const names = [
      clean(ex.name),
      clean(ex.originalName || ex.name),
      clean(typeof italianName === 'function'
        ? italianName(ex.name || '')
        : '')
    ].filter(Boolean);

    const words = names.flatMap(name => name.split(/\s+/));

    // Una sola lettera: cerca dall'inizio del nome.
    if (q.length === 1) {
      return names.some(name => name.startsWith(q)) ? 3000 : 0;
    }

    // Corrispondenza dall'inizio del nome.
    if (names.some(name => name.startsWith(q))) return 3000;

    // Corrispondenza dall'inizio di una parola.
    if (words.some(word => word.startsWith(q))) return 2500;

    // Corrispondenza parziale.
    if (names.some(name => name.includes(q))) return 2000;

    // Mantiene sinonimi, muscoli e attrezzature.
    return originalScoreExerciseSearch(ex, q);
  }

  function originalScoreExerciseSearch(ex, query) {
    const q = normalize(query);
    const name = normalize(ex.name || '');
    const original = normalize(ex.originalName || ex.name || '');
    const equipment = normalize(ex.equipment || '');

    const machineWords = [
      'machine', 'macchina', 'macchine',
      'lever', 'leverage', 'multipower'
    ];
    const dumbbellWords = ['dumbbell', 'dumbbells', 'manubri', 'manubrio'];
    const barbellWords = ['barbell', 'bilanciere', 'bilancieri'];
    const cableWords = ['cable', 'cables', 'cavo', 'cavi'];
    const bodyweightWords = [
      'bodyweight', 'corpo libero', 'senza attrezzi'
    ];
    const smithWords = ['smith', 'multipower'];

    const hasAny = (text, words) =>
      words.some(word => (' ' + text + ' ').includes(' ' + normalize(word) + ' '));

    const wantsMachine = hasAny(q, machineWords);
    const wantsDumbbell = hasAny(q, dumbbellWords);
    const wantsBarbell = hasAny(q, barbellWords);
    const wantsCable = hasAny(q, cableWords);
    const wantsBodyweight = hasAny(q, bodyweightWords);
    const wantsSmith = hasAny(q, smithWords);

    // Togli dalla query le parole che specificano soltanto l'attrezzatura.
    let movementQuery = q;

    const equipmentPhrases = [
      'bodyweight', 'corpo libero', 'senza attrezzi',
      'dumbbells', 'dumbbell', 'manubri', 'manubrio',
      'bilancieri', 'bilanciere', 'barbell',
      'macchine', 'macchina', 'machine',
      'multipower', 'leverage', 'lever',
      'cables', 'cable', 'cavi', 'cavo'
    ];

    for (const phrase of equipmentPhrases) {
      movementQuery = movementQuery
        .replace(new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), ' ')
        .trim();
    }

    movementQuery = movementQuery.replace(/\s+/g, ' ').trim();

    // La query deve identificare il movimento. Le sole parole
    // dell'attrezzatura non sono sufficienti a scegliere un esercizio.
    if (!movementQuery) return 0;

    if (!matchesExercise(ex, movementQuery)) return 0;

    let score = 100;

    // Premia il nome dell'esercizio quando contiene la query completa.
    if (name === q || original === q) score += 500;

    if (name.includes(movementQuery)) score += 180;
    if (original.includes(movementQuery)) score += 160;

    // Premia corrispondenze più precise all'inizio del nome.
    if (name.startsWith(movementQuery)) score += 80;
    if (original.startsWith(movementQuery)) score += 60;

    const machineEquipment =
      /machine|leverage|lever|plate loaded|macchina/.test(equipment) ||
      /^(lever|machine)\s/.test(original);

    const dumbbellEquipment =
      /dumbbell|manubri|manubrio/.test(equipment) ||
      /\bdumbbell\b/.test(original);

    const barbellEquipment =
      /barbell|bilanciere/.test(equipment) ||
      /\bbarbell\b/.test(original);

    const cableEquipment =
      /cable|cavi|cavo/.test(equipment) ||
      /\bcable\b/.test(original);

    const bodyweightEquipment =
      /bodyweight|body only|corpo libero/.test(equipment);

    const smithEquipment =
      /smith|multipower/.test(equipment) ||
      /smith machine|multipower/.test(original);

    // L'attrezzatura richiesta pesa molto nell'ordine dei risultati.
    if (wantsMachine) {
      if (machineEquipment) score += 350;
      else score -= 120;
    }

    if (wantsDumbbell) {
      if (dumbbellEquipment) score += 350;
      else score -= 180;
    }

    if (wantsBarbell) {
      if (barbellEquipment) score += 350;
      else score -= 180;
    }

    if (wantsCable) {
      if (cableEquipment) score += 350;
      else score -= 180;
    }

    if (wantsBodyweight) {
      if (bodyweightEquipment) score += 350;
      else score -= 180;
    }

    if (wantsSmith) {
      if (smithEquipment) score += 250;
      else score -= 100;
    }


    // Evita di mettere davanti le varianti a un solo braccio
    // quando l'utente cerca genericamente un esercizio alla macchina.
    const unilateralTerms = [
      'one arm', 'one-arm', 'single arm', 'single-arm',
      'unilateral', 'alternating', 'un braccio', 'a un braccio'
    ];

    const queryRequestsUnilateral = hasAny(q, unilateralTerms);
    const exerciseIsUnilateral = hasAny(original, unilateralTerms)
      || hasAny(name, unilateralTerms);

    if (exerciseIsUnilateral && !queryRequestsUnilateral) {
      score -= 350;
    }

    // Premia la variante generica alla macchina, quando richiesta.
    if (
      wantsMachine &&
      machineEquipment &&
      !exerciseIsUnilateral &&
      /shoulder press/.test(movementQuery)
    ) {
      score += 100;
    }

    // A parità di movimento e attrezzatura, preferisce il nome originale
    // più direttamente corrispondente alla ricerca.
    const queryWords = movementQuery.split(' ').filter(Boolean);
    const nameWords = original.split(' ').filter(Boolean);
    const matchedWords = queryWords.filter(word =>
      nameWords.some(nameWord => nameWord.includes(word))
    ).length;

    score += matchedWords * 8;

    
    // Premia il nome dell'esercizio quando la query contiene refusi.
    const requestedWords = normalize(movementQuery).split(' ').filter(Boolean);
    const exerciseNameWords = [...new Set(
      (name + ' ' + original).split(' ').filter(Boolean)
    )];

    if (
      requestedWords.length &&
      requestedWords.every(word =>
        exerciseNameWords.some(token => searchTokenMatches(word, token))
      )
    ) {
      score += 220;
    }

    return score;
  }

  function getCatalogName(ex) { return italianName(ex.name); }
  function renderSearchResults() {
    const query = ui.search.value.trim(); ui.clearSearch.hidden = !query;
    if (query.length < 1) { ui.searchResults.hidden = true; ui.searchResults.innerHTML = ''; state.visibleResults = []; ui.catalogStatus.textContent = state.catalog.length ? 'Scrivi almeno 2 lettere. Cerca in italiano o in inglese.' : 'Carico il catalogo esercizi…'; return; }
    const results = [...state.catalog, ...state.customExercises]
      .map((ex, index) => ({
        ex,
        index,
        score: scoreExerciseSearch(ex, query)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.ex);
    state.visibleResults = results.slice(0, 40);
    ui.searchResults.hidden = false;
    if (!results.length) { ui.searchResults.innerHTML = `<div class="history-empty">Nessun esercizio trovato. Puoi crearne uno personalizzato qui sotto.</div>`; ui.catalogStatus.textContent = state.catalog.length ? 'Nessun risultato per questa ricerca.' : 'Catalogo non ancora caricato: puoi comunque creare esercizi personali.'; return; }
    ui.searchResults.innerHTML = state.visibleResults.map(ex => {
      const translated = getCatalogName(ex); const img = ex.image ? mediaUrl(ex.image) : '';
      const vitalVideo = ex.video_url || VITAL_VIDEO_BY_ID[String(ex.id)] || '';
      const added = activeStorageTarget().some(item => String(item.id) === String(ex.id));
      return `<div class="result-row"><button class="mini-media-button result-thumb-button" type="button" data-result-detail="${escapeHtml(ex.id)}" aria-label="Dettagli ${escapeHtml(translated)}">${vitalVideo
      ? `<img class="result-thumb" src="${escapeHtml(vitalVideo.split('?')[0].replace(/\/videos\/([^/]+)\.mp4$/i, '/posters/$1.jpg'))}" alt="" loading="lazy">`
      : img
      ? `<img class="result-thumb" src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<span class="result-thumb fallback-thumb">✦</span>`}</button><div class="result-copy"><strong>${escapeHtml(translated)}</strong><small>${escapeHtml(muscleLabel(ex.target || ex.muscles))} · ${escapeHtml(equipmentLabel(ex.equipment))}</small>${normalize(ex.name)!==normalize(translated)?`<small class="english-name">${escapeHtml(ex.name)}</small>`:''}</div><button class="add-result" type="button" data-result-add="${escapeHtml(ex.id)}" aria-label="Aggiungi ${escapeHtml(translated)}" ${added?'disabled':''}>${added?'✓':'+'}</button></div>`;
    }).join('');
    ui.catalogStatus.textContent = `${results.length} risultati · premi + per aggiungere`;
    observeSearchVideos();
  }

  let searchVideoObserver = null;

  function observeSearchVideos() {
    if (searchVideoObserver) {
      searchVideoObserver.disconnect();
    }

    const videos = ui.searchResults.querySelectorAll('video.result-thumb');

    if (!('IntersectionObserver' in window)) {
      videos.forEach(video => {
        video.src = video.dataset.src;
        video.play().catch(() => {});
      });
      return;
    }

    searchVideoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target;

        if (entry.isIntersecting) {
          if (!video.src) {
            video.src = video.dataset.src;
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, {
      root: ui.searchResults,
      rootMargin: '100px 0px',
      threshold: 0.1
    });

    videos.forEach(video => searchVideoObserver.observe(video));
  }

  function updateSearchDisplay() { renderSearchResults(); }
  function findCatalogExercise(id) { return [...state.catalog,...state.customExercises].find(ex => String(ex.id) === String(id)); }

  // GYMGIUSIM_VITAL_OVERRIDES_V1
  const VITAL_VIDEO_BY_ID = {
  "0042": "./vital-animations/videos/0056.mp4",
  "0085": "./vital-animations/videos/0060.mp4",
  "1760": "./vital-animations/videos/0064.mp4",
  "0549": "./vital-animations/videos/0072.mp4",
  "0120": "./vital-animations/videos/0089.mp4",
  "0437": "./vital-animations/videos/0091.mp4"
};

  function openDetail(ex) {
    state.detailExercise = ex;
    $('detailTitle').textContent = ex.name;
    $('detailMuscle').textContent = muscleLabel(ex.target || ex.muscles);
    $('detailEquipment').textContent = `Attrezzatura: ${equipmentLabel(ex.equipment)}`;
    $('detailDescription').textContent = ex.description || ex.notes || 'Nessuna descrizione aggiuntiva disponibile per questo esercizio.';
    $('detailMuscles').textContent = [muscleLabel(ex.target || ex.muscles), ...(ex.secondaryMuscles || []).map(muscleLabel)].filter(Boolean).join(' · ');
    const media = $('detailMedia');
    const gif = ex.gif_url ? mediaUrl(ex.gif_url) : (ex.image ? mediaUrl(ex.image) : '');
    const video =
      ex.video_url ||
      VITAL_VIDEO_BY_ID[String(ex.id)] ||
      '';
    media.innerHTML = video
      ? `<video src="${escapeHtml(video)}" autoplay muted loop playsinline preload="metadata" controls style="width:100%;height:auto;max-height:420px;object-fit:contain;border-radius:12px;"></video>`
      : gif
      ? `<img src="${escapeHtml(gif)}" alt="Animazione di ${escapeHtml(ex.name)}" loading="eager" onerror="this.onerror=null;this.src='${escapeHtml(ex.image?mediaUrl(ex.image):'')}';if(!this.src)this.style.display='none'">`
      : `<div class="history-empty">Animazione non disponibile per questo esercizio.</div>`;
    const instructions = $('detailInstructions'); instructions.innerHTML = '';
    const instructionList = Array.isArray(ex.instructions) ? ex.instructions : (ex.instructions ? [ex.instructions] : []);
    const fallback = instructionList.length ? instructionList : ['Posiziona il corpo e l’attrezzatura in modo stabile.', 'Esegui il movimento in modo controllato, senza slanci.', 'Mantieni la respirazione regolare e interrompi se senti dolore.'];
    fallback.forEach(item => { const li = document.createElement('li'); li.textContent = String(item); instructions.appendChild(li); });
    $('detailAddButton').textContent = activeStorageTarget().some(item => String(item.id)===String(ex.id)) ? '✓ Già nella scheda' : '＋ Aggiungi alla scheda';
    $('detailAddButton').disabled = activeStorageTarget().some(item => String(item.id)===String(ex.id));
    ui.detailDialog.hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeDialogs() { document.querySelectorAll('.dialog-backdrop').forEach(dialog => dialog.hidden = true); document.body.style.overflow = ''; }

  function renderHistory() {
    const list = $('historyList'); const records = [...state.history].sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')) || Number(b.endedAt||0)-Number(a.endedAt||0));
    if (!records.length) { list.innerHTML = '<div class="history-empty">Ancora nessun allenamento salvato. Premi “Termina allenamento” quando hai finito.</div>'; return; }
    list.innerHTML = records.map(record => `<article class="history-item"><div class="history-item-top"><h3>${escapeHtml(record.name || 'Allenamento')}</h3><time>${escapeHtml(formatDate(record.date || record.endedAt))}</time></div><p class="history-summary">${(record.exercises||[]).length} esercizi · ${escapeHtml((record.exercises||[]).map(ex=>ex.name).slice(0,3).join(', '))}${(record.exercises||[]).length>3?'…':''}</p><div class="history-actions"><button type="button" data-history="open" data-id="${escapeHtml(record.id)}">Visualizza / modifica</button><button type="button" data-history="date" data-id="${escapeHtml(record.id)}">Cambia data</button><button class="history-delete" type="button" data-history="delete" data-id="${escapeHtml(record.id)}">Elimina</button></div></article>`).join('');
  }
  function openHistoryRecord(id) {
    const record = state.history.find(item => String(item.id)===String(id)); if (!record) return;
    if (!confirm(`Aprire "${record.name}" del ${formatDate(record.date)} per modificarlo? Le modifiche saranno salvate nello storico, non nella scheda modello.`)) return;
    state.workout = { ...clone(record), planId:record.planId || state.activePlanId, date:record.date || dateKey(), editingHistoryId:record.id }; state.editingHistoryId=record.id; state.activeSince = record.startedAt || Date.now(); state.activePlanId = state.plans.some(p=>p.id===state.workout.planId) ? state.workout.planId : state.activePlanId; saveKey(KEYS.active,{planId:state.activePlanId,workout:state.workout,activeSince:state.activeSince,drafts:state.drafts,editingHistoryId:state.editingHistoryId}); closeDialogs(); renderPlanSelect(); renderWorkout(); showToast('Record aperto: le modifiche si salvano nello stesso storico');
  }
  function historyClick(event) {
    const btn = event.target.closest('button[data-history]'); if (!btn) return; const record = state.history.find(item => String(item.id)===String(btn.dataset.id)); if (!record) return;
    if (btn.dataset.history==='open') openHistoryRecord(record.id);
    if (btn.dataset.history==='date') { const next = prompt('Nuova data (AAAA-MM-GG):',record.date || dateKey()); if (next && /^\d{4}-\d{2}-\d{2}$/.test(next.trim())) { record.date=next.trim(); saveKey(KEYS.history,state.history); renderHistory(); showToast('Data aggiornata'); } }
    if (btn.dataset.history==='delete' && confirm(`Eliminare dallo storico l’allenamento "${record.name}"?`)) { state.history = state.history.filter(item=>item.id!==record.id); saveKey(KEYS.history,state.history); renderHistory(); }
  }
  function newCustomExercise(event) {
    event.preventDefault(); const name = $('customName').value.trim(); if (!name) return;
    const ex = normalizeExercise({ id:uid('custom'), name, originalName:name, target:$('customMuscle').value.trim() || 'Muscoli non indicati', equipment:$('customEquipment').value.trim() || 'Non indicata', notes:$('customNotes').value.trim(), description:$('customNotes').value.trim(), custom:true, instructions:$('customNotes').value.trim() ? [$('customNotes').value.trim()] : [] });
    state.customExercises.push(ex); saveKey('gymgiusim_custom_exercises_v1',state.customExercises); closeDialogs(); $('customExerciseForm').reset(); addExercise(ex);
  }
  function downloadJson(filename, data) { const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  function exportBackup() { const data={app:'GymGiusim',version:1,exportedAt:new Date().toISOString(),plans:state.plans,activePlanId:state.activePlanId,history:state.history,customExercises:state.customExercises,activeWorkout:state.workout,activeSince:state.activeSince}; downloadJson(`gymgiusim-backup-${dateKey()}.json`,data); showToast('Backup esportato'); }
  function exportPlan() { const plan=getActivePlan(); if(!plan) return; downloadJson(`gymgiusim-${normalize(plan.name).replace(/\s+/g,'-')||'scheda'}.json`,{app:'GymGiusim',version:1,plan}); }
  async function importBackup(file) {
    if (!file) return; try { const data=JSON.parse(await file.text()); if (!data || !Array.isArray(data.plans)) throw new Error('Il file non contiene schede GymGiusim.'); if (!confirm('Importare il backup? Le schede e lo storico attuali verranno sostituiti.')) return;
      state.plans=data.plans.map(normalizePlan); state.activePlanId=state.plans.some(p=>p.id===data.activePlanId)?data.activePlanId:state.plans[0]?.id||null; state.history=Array.isArray(data.history)?data.history:[]; state.customExercises=Array.isArray(data.customExercises)?data.customExercises.map(normalizeExercise):[]; state.workout=data.activeWorkout||null; state.activeSince=data.activeSince||null; if(!state.plans.length) createPlan('La mia scheda'); persistAll(); saveKey('gymgiusim_custom_exercises_v1',state.customExercises); renderPlanSelect();renderWorkout();renderHistory();showToast('Backup importato correttamente');
    } catch(error) { alert(`Non riesco a importare il backup. ${error.message}`); } finally { $('importBackupInput').value=''; $('backupFileInput').value=''; }
  }
  // GYMGIUSE_TRAINAI_HIP_THRUSTS_V1
  // GIF e istruzioni provenienti da TrainAI; mantenere l'attribuzione.
  const GYMGIUSE_EXTRA_HIP_EXERCISES = [{"id": "gymgiuse-trainai-barbell-hip-thrust", "name": "Barbell hip thrust", "originalName": "Barbell hip thrust", "target": "glutes", "equipment": "Bilanciere e panca", "image": "https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fexercises%2F2026-10-03-v1%2Ftrainai-barbell-hip-thrust-f1de4a98b365.png?alt=media&token=03595053-e5e5-4bfb-a879-b9749fc4d9c0", "gif_url": "https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fexercises%2F2026-10-03-v1%2Ftrainai-barbell-hip-thrust-3b905aede1b1.gif?alt=media&token=20d9e441-309a-4c7e-b808-e0073f1c2da3", "description": "Hip Thrust con bilanciere: esercizio per allenare soprattutto i glutei, con il supporto di posteriori della coscia e adduttori.", "instructions": ["Siediti a terra con la parte alta della schiena appoggiata a una panca stabile. Posiziona il bilanciere sulle anche, utilizzando un apposito cuscinetto.", "Piega le ginocchia e appoggia entrambi i piedi a terra, all'incirca alla larghezza delle anche. Mantieni il bilanciere stabile con le mani.", "Espira e spingi attraverso i piedi per sollevare le anche. Contrai i glutei fino ad allineare spalle, anche e ginocchia.", "Mantieni l'addome attivo ed evita di inarcare eccessivamente la zona lombare. Fermati brevemente nella posizione più alta.", "Inspira e abbassa lentamente le anche, mantenendo il controllo del movimento. Ripeti senza rimbalzare nella posizione inferiore."], "aliases": "hip thrust | bilanciere hip thrust | spinta d'anca con bilanciere | hip thrust con bilanciere | glute thrust con bilanciere", "secondaryMuscles": [], "notes": "Fonte media: TrainAI. Conservare l'attribuzione richiesta."}, {"id": "gymgiuse-trainai-machine-hip-thrust", "name": "Machine hip thrust", "originalName": "Machine hip thrust", "target": "glutes", "equipment": "Macchina Hip Thrust", "image": "https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fexercises%2F2026-10-03-v1%2Ftrainai-machine-hip-thrust-1adbb00b645c.png?alt=media&token=3d50d138-4a8e-4349-b906-e5b2a1d3c3f1", "gif_url": "https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fexercises%2F2026-10-03-v1%2Ftrainai-machine-hip-thrust-e3427d01bb84.gif?alt=media&token=519dd121-2e0d-4442-a8d7-4b04a2ed2471", "description": "Hip Thrust alla macchina: esercizio per allenare soprattutto i glutei utilizzando una macchina specifica per l'estensione dell'anca.", "instructions": ["Regola la macchina secondo la tua altezza. Posiziona la schiena contro il supporto e il cuscinetto sulle anche, seguendo le indicazioni della macchina.", "Appoggia bene i piedi sulla pedana e mantieni le ginocchia piegate. Afferra le impugnature, se presenti, per stabilizzare il corpo.", "Espira e spingi attraverso i piedi per estendere le anche. Solleva il bacino contraendo i glutei, senza inarcare eccessivamente la schiena.", "Fermati brevemente quando spalle, anche e ginocchia sono approssimativamente allineate. Mantieni l'addome attivo.", "Inspira e ritorna lentamente alla posizione iniziale, controllando la resistenza durante tutta la discesa."], "aliases": "hip thrust machine | glute drive | hip thrust alla macchina | spinta d'anca alla macchina | glute machine hip thrust", "secondaryMuscles": [], "notes": "Fonte media: TrainAI. Conservare l'attribuzione richiesta."}];

  async function loadCatalog() {
    const cached = safeRead(KEYS.catalog, []); if(Array.isArray(cached) && cached.length) state.catalog=ensureUniqueExerciseIds(cached.map(item=>normalizeExercise({...item,aliases:[...new Set([String(item.aliases||''),...buildExerciseAliases(item)])].join(' ')})), 'catalog');
    if (state.catalog.length) { ui.catalogStatus.textContent=`Catalogo pronto · ${state.catalog.length} esercizi`; renderSearchResults(); }
    try {
      const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
      const response = await fetch(DATA_URL,{signal:controller.signal,cache:'force-cache'}); clearTimeout(timer); if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data=await response.json(); if(!Array.isArray(data)) throw new Error('Formato catalogo non valido');
      const mergedData = [...data];

// GYMGIUSIM_VITAL_CATALOG_V1
try {
  const vitalResponse = await fetch(
    './vital-animations/exercises.json',
    { cache: 'no-cache' }
  );

  if (!vitalResponse.ok) {
    throw new Error('Catalogo Vital non disponibile');
  }

  const vitalExercises = await vitalResponse.json();

  if (!Array.isArray(vitalExercises)) {
    throw new Error('Formato Vital non valido');
  }

  for (const vital of vitalExercises) {
    if (!mergedData.some(item =>
      String(item.id) === String(vital.id)
    )) {
      mergedData.push({
        ...vital,
        originalName: vital.name,
        name: vital.name,
        video_url: vital.video_url,
        instructions: Array.isArray(vital.instructions)
          ? vital.instructions
          : vital.instructions
            ? [vital.instructions]
            : []
      });
    }
  }

  console.log(
    '✅ Vital Animations caricati:',
    vitalExercises.length
  );
} catch (error) {
  console.warn('Vital Animations non disponibili:', error);
}
      for (const extra of GYMGIUSE_EXTRA_HIP_EXERCISES) {
        const alreadyPresent = mergedData.some(item =>
          normalize(item.name || '') === normalize(extra.name || '') ||
          normalize(item.originalName || '') === normalize(extra.originalName || '')
        );
        if (!alreadyPresent) mergedData.push(extra);
      }
      state.catalog=ensureUniqueExerciseIds(mergedData.map(item=>normalizeExercise({...item,name:getCatalogName(item),originalName:item.originalName || item.name,aliases:[String(item.aliases || ''),buildExerciseAliases(item).join(' ')].filter(Boolean).join(' '),instructions:Array.isArray(item.instructions)?item.instructions:(item.instructions?[item.instructions]:[])})), 'catalog');
      saveKey(KEYS.catalog,state.catalog); ui.catalogStatus.textContent=`Catalogo pronto · ${state.catalog.length} esercizi`; renderSearchResults();
    } catch(error) { console.warn('Catalogo remoto non disponibile:',error); ui.catalogStatus.textContent=state.catalog.length?'Catalogo salvato disponibile; connessione non raggiungibile.':'Catalogo non disponibile: controlla la connessione. Le schede salvate continuano a funzionare.'; renderSearchResults(); }
  }

  function init() {
    state.plans=safeRead(KEYS.plans,[]).map(normalizePlan); state.history=safeRead(KEYS.history,[]); state.customExercises=safeRead('gymgiusim_custom_exercises_v1',[]).map(normalizeExercise);
    const active=safeRead(KEYS.active,{}); state.activePlanId=active.planId||state.plans[0]?.id||null; state.workout=active.workout||null; state.activeSince=active.activeSince||null; state.drafts=active.drafts||safeRead('gymgiusim_drafts_v1',{}); state.editingHistoryId=active.editingHistoryId||state.workout?.editingHistoryId||null;
    // Riparazione conservativa degli ID duplicati già salvati.
    state.customExercises = ensureUniqueExerciseIds(
      state.customExercises, 'custom'
    );

    state.plans.forEach((plan, index) => {
      plan.exercises = ensureUniqueExerciseIds(
        plan.exercises, `plan-${index}`
      );
    });

    state.history.forEach((record, index) => {
      record.exercises = ensureUniqueExerciseIds(
        record.exercises, `history-${index}`
      );
    });

    if (state.workout && Array.isArray(state.workout.exercises)) {
      state.workout.exercises = ensureUniqueExerciseIds(
        state.workout.exercises, 'workout'
      );
    }

    Object.entries(state.drafts).forEach(([key, draft]) => {
      if (draft && Array.isArray(draft.exercises)) {
        draft.exercises = ensureUniqueExerciseIds(
          draft.exercises, `draft-${key}`
        );
      }
    });

    // Rende persistenti le riparazioni, senza cancellare lo storico.
    saveKey(KEYS.plans, state.plans);
    saveKey(KEYS.history, state.history);
    saveKey(KEYS.active, {
      planId: state.activePlanId,
      workout: state.workout,
      activeSince: state.activeSince,
      drafts: state.drafts,
      editingHistoryId: state.editingHistoryId
    });
    saveKey('gymgiusim_drafts_v1', state.drafts);
    saveKey('gymgiusim_custom_exercises_v1', state.customExercises);

    if (!state.plans.length) { state.plans=[{id:uid('plan'),name:'La mia scheda',exercises:[],updatedAt:Date.now()}]; state.activePlanId=state.plans[0].id; saveKey(KEYS.plans,state.plans); }
    if (!state.plans.some(p=>p.id===state.activePlanId)) state.activePlanId=state.plans[0].id;
    renderPlanSelect(); renderWorkout();
    ui.planSelect.addEventListener('change',()=>changePlan(ui.planSelect.value));
    $('newPlanButton').addEventListener('click',()=>{ if(state.workout && !confirm('Hai un allenamento in corso. Salvalo nello storico prima di creare una scheda nuova? Se scegli Annulla puoi continuare.')) return; createPlan('Nuova scheda'); });
    ui.planName.addEventListener('change',renamePlan); ui.planName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ui.planName.blur();}}); $('renameHint').addEventListener('click',()=>{
      if(state.workout){
        showToast('Termina l’allenamento prima di rinominare la scheda');
        return;
      }
      const plan=getActivePlan();
      if(!plan) return;
      const nuovoNome=prompt('Come vuoi chiamare questa scheda?',plan.name);
      if(nuovoNome===null) return;
      const nomePulito=nuovoNome.trim();
      if(!nomePulito){
        showToast('Inserisci un nome valido');
        return;
      }
      ui.planName.value=nomePulito;
      renamePlan();
    }); $('deletePlanButton').addEventListener('click',deleteCurrentPlan);
    let searchDebounceTimer;
    ui.search.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(renderSearchResults, 150);
    }); ui.clearSearch.addEventListener('click',()=>{ui.search.value='';renderSearchResults();ui.search.focus();});
    ui.searchResults.addEventListener('click',event=>{const add=event.target.closest('[data-result-add]'); if(add){const ex=findCatalogExercise(add.dataset.resultAdd);if(ex)addExercise(ex);return;} const detail=event.target.closest('[data-result-detail]');if(detail){const ex=findCatalogExercise(detail.dataset.resultDetail);if(ex)openDetail(ex);}});
    ui.workoutList.addEventListener('click',onWorkoutClick); ui.workoutList.addEventListener('input',event=>{if(event.target.matches('.set-input'))updateSet(event.target);});
    $('finishWorkoutButton').addEventListener('click',finishWorkout); $('startWorkoutButton').addEventListener('click',startWorkout); $('exportButton').addEventListener('click',exportPlan); $('backupButton').addEventListener('click',exportBackup); $('exportBackupButton').addEventListener('click',exportBackup); $('historyButton').addEventListener('click',()=>{renderHistory();ui.historyDialog.hidden=false;document.body.style.overflow='hidden';}); $('historyList').addEventListener('click',historyClick);
    $('addCustomExerciseButton').addEventListener('click',()=>{ui.customDialog.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>$('customName').focus(),100);}); $('customExerciseForm').addEventListener('submit',newCustomExercise); $('detailAddButton').addEventListener('click',()=>{if(state.detailExercise){addExercise(state.detailExercise);closeDialogs();}});
    document.querySelectorAll('[data-close-dialog]').forEach(btn=>btn.addEventListener('click',closeDialogs)); document.querySelectorAll('.dialog-backdrop').forEach(backdrop=>backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeDialogs();})); document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDialogs();}); $('importBackupInput').addEventListener('change',event=>importBackup(event.target.files?.[0]));
    // Mantiene il pulsante di importazione in un solo punto, dentro lo storico.
    $('backupFileInput').addEventListener('change',event=>importBackup(event.target.files?.[0]));
    if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker non registrato:',err));
    loadCatalog();
  }
  init();
})();
