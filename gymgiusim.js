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
    return { id: String(ex.id ?? uid('ex')), name: String(ex.name || 'Esercizio'), originalName: String(ex.originalName || ex.name || 'Esercizio'), target: Array.isArray(rawTarget) ? rawTarget.join(', ') : String(rawTarget), equipment: String(ex.equipment || ''), image: String(ex.image || ''), gif_url: String(ex.gif_url || ''), description: String((typeof ex.description === 'object' ? (ex.description.it || ex.description.en || '') : ex.description) || ex.notes || ''), instructions: extractInstructions(ex), secondaryMuscles: Array.isArray(rawSecondary) ? rawSecondary.map(String) : [], sets: Array.isArray(ex.sets) && ex.sets.length ? ex.sets.map(s => createSet(s.reps, s.kg)) : [createSet()], custom: Boolean(ex.custom), notes: String(ex.notes || '') };
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
    const p = getActivePlan(); const exercises = currentExercises();
    ui.planName.value = state.workout ? state.workout.name : (p ? p.name : '');
    ui.planName.readOnly = Boolean(state.workout);
    ui.workoutHeading.textContent = state.workout ? `${state.workout.name} · in corso` : (p ? p.name : 'La tua scheda');
    ui.exerciseTotal.textContent = `${exercises.length} ${exercises.length === 1 ? 'esercizio' : 'esercizi'}`;
    ui.emptyWorkout.hidden = exercises.length > 0;
    ui.workoutList.innerHTML = exercises.map((ex,index) => {
      const thumbnail = ex.image ? mediaUrl(ex.image) : '';
      const target = muscleLabel(ex.target || ex.muscles || '');
      const equipment = equipmentLabel(ex.equipment);
      return `<article class="exercise-card" data-exercise-id="${escapeHtml(ex.id)}">
        <div class="exercise-card-top">
          <button class="mini-media-button" type="button" data-action="details" data-id="${escapeHtml(ex.id)}" aria-label="Vedi animazione e istruzioni di ${escapeHtml(ex.name)}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="no-image">${ex.custom ? '✎' : '＋'}</span>`}<span class="play-overlay">▶</span></button>
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
    const btn = event.target.closest('button[data-action]'); if (!btn) return;
    const { action, id } = btn.dataset; const exercises = activeStorageTarget(); const index = exercises.findIndex(ex => String(ex.id) === String(id)); if (index < 0) return;
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
  function renamePlan() { if (state.workout) return; const plan = getActivePlan(); if (!plan) return; const name = ui.planName.value.trim(); if (!name) { ui.planName.value = plan.name; showToast('Il nome non può essere vuoto'); return; } plan.name = name; plan.updatedAt = Date.now(); savePlans(); renderPlanSelect(); ui.planName.value = name; ui.workoutHeading.textContent = name; }
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
  function matchesExercise(ex, query) {
    const textBase = [ex.name, ex.originalName, italianName(ex.originalName || ex.name), ex.target, ex.equipment, ...(ex.secondaryMuscles || [])].join(' ');
    const normalizedBase = normalize(textBase);
    const aliases = [];
    for (const [english, italian] of italianSearchAliases) {
      const key = normalize(english);
      if ((` ${normalizedBase} `).includes(` ${key} `) || normalizedBase.split(' ').some(part => part.startsWith(key))) aliases.push(italian);
    }
    const text = normalize(textBase + ' ' + aliases.join(' '));
    return normalize(query).split(' ').filter(Boolean).every(word => text.includes(word));
  }
  function getCatalogName(ex) { return italianName(ex.name); }
  function renderSearchResults() {
    const query = ui.search.value.trim(); ui.clearSearch.hidden = !query;
    if (query.length < 2) { ui.searchResults.hidden = true; ui.searchResults.innerHTML = ''; state.visibleResults = []; ui.catalogStatus.textContent = state.catalog.length ? 'Scrivi almeno 2 lettere. Cerca in italiano o in inglese.' : 'Carico il catalogo esercizi…'; return; }
    const results = [...state.catalog,...state.customExercises].filter(ex => matchesExercise(ex,query)).slice(0,35); state.visibleResults = results;
    ui.searchResults.hidden = false;
    if (!results.length) { ui.searchResults.innerHTML = `<div class="history-empty">Nessun esercizio trovato. Puoi crearne uno personalizzato qui sotto.</div>`; ui.catalogStatus.textContent = state.catalog.length ? 'Nessun risultato per questa ricerca.' : 'Catalogo non ancora caricato: puoi comunque creare esercizi personali.'; return; }
    ui.searchResults.innerHTML = results.map(ex => {
      const translated = getCatalogName(ex); const img = ex.image ? mediaUrl(ex.image) : '';
      const added = activeStorageTarget().some(item => String(item.id) === String(ex.id));
      return `<div class="result-row"><button class="mini-media-button result-thumb-button" type="button" data-result-detail="${escapeHtml(ex.id)}" aria-label="Dettagli ${escapeHtml(translated)}">${img?`<img class="result-thumb" src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.style.display='none'">`:`<span class="result-thumb fallback-thumb">✦</span>`}</button><div class="result-copy"><strong>${escapeHtml(translated)}</strong><small>${escapeHtml(muscleLabel(ex.target || ex.muscles))} · ${escapeHtml(equipmentLabel(ex.equipment))}</small>${normalize(ex.name)!==normalize(translated)?`<small class="english-name">${escapeHtml(ex.name)}</small>`:''}</div><button class="add-result" type="button" data-result-add="${escapeHtml(ex.id)}" aria-label="Aggiungi ${escapeHtml(translated)}" ${added?'disabled':''}>${added?'✓':'+'}</button></div>`;
    }).join('');
    ui.catalogStatus.textContent = `${results.length}${results.length===35?'+':''} risultati · premi + per aggiungere`;
  }
  function updateSearchDisplay() { renderSearchResults(); }
  function findCatalogExercise(id) { return [...state.catalog,...state.customExercises].find(ex => String(ex.id) === String(id)); }
  function openDetail(ex) {
    state.detailExercise = ex;
    $('detailTitle').textContent = ex.name;
    $('detailMuscle').textContent = muscleLabel(ex.target || ex.muscles);
    $('detailEquipment').textContent = `Attrezzatura: ${equipmentLabel(ex.equipment)}`;
    $('detailDescription').textContent = ex.description || ex.notes || 'Nessuna descrizione aggiuntiva disponibile per questo esercizio.';
    $('detailMuscles').textContent = [muscleLabel(ex.target || ex.muscles), ...(ex.secondaryMuscles || []).map(muscleLabel)].filter(Boolean).join(' · ');
    const media = $('detailMedia');
    const gif = ex.gif_url ? mediaUrl(ex.gif_url) : (ex.image ? mediaUrl(ex.image) : '');
    media.innerHTML = gif ? `<img src="${escapeHtml(gif)}" alt="Animazione di ${escapeHtml(ex.name)}" loading="eager" onerror="this.onerror=null;this.src='${escapeHtml(ex.image?mediaUrl(ex.image):'')}';if(!this.src)this.style.display='none'">` : `<div class="history-empty">Animazione non disponibile per questo esercizio.</div>`;
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
  async function loadCatalog() {
    const cached = safeRead(KEYS.catalog, []); if(Array.isArray(cached) && cached.length) state.catalog=ensureUniqueExerciseIds(cached.map(normalizeExercise), 'catalog');
    if (state.catalog.length) { ui.catalogStatus.textContent=`Catalogo pronto · ${state.catalog.length} esercizi`; renderSearchResults(); }
    try {
      const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),12000);
      const response = await fetch(DATA_URL,{signal:controller.signal,cache:'force-cache'}); clearTimeout(timer); if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data=await response.json(); if(!Array.isArray(data)) throw new Error('Formato catalogo non valido');
      state.catalog=ensureUniqueExerciseIds(data.map(item=>normalizeExercise({...item,name:getCatalogName(item),originalName:item.name,aliases:[item.name,item.target,item.equipment].join(' '),instructions:Array.isArray(item.instructions)?item.instructions:(item.instructions?[item.instructions]:[])})), 'catalog');
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
    ui.planName.addEventListener('change',renamePlan); ui.planName.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ui.planName.blur();}}); $('renameHint').addEventListener('click',()=>{if(!state.workout){ui.planName.focus();ui.planName.select();}}); $('deletePlanButton').addEventListener('click',deleteCurrentPlan);
    ui.search.addEventListener('input',renderSearchResults); ui.clearSearch.addEventListener('click',()=>{ui.search.value='';renderSearchResults();ui.search.focus();});
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
