import { Calendar } from '@fullcalendar/core';
import itLocale from '@fullcalendar/core/locales/it';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from './supabase.js';
import './style.css';

// ------------------------------------------------------------------ utilità
const $ = (sel, root = document) => root.querySelector(sel);
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora */ }
  },
};

function toast(text, isError = false) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function errText(error) {
  const m = error?.message || String(error);
  if (/Invalid login credentials/i.test(m)) return 'Email o password errati.';
  if (/Email not confirmed/i.test(m)) return 'Devi prima confermare l\'email (controlla la posta).';
  if (/already registered/i.test(m)) return 'Questa email è già iscritta.';
  return m;
}

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addHours = (d, n) => new Date(d.getTime() + n * 3600_000);

// ------------------------------------------------------------------ stato
const state = {
  user: null,
  profile: null,
  teams: [],                 // [{ id, name, invite_code, role, share_events }]
  teamId: store.get('rc.team', null),
  members: [],               // membri del gruppo selezionato
  profiles: new Map(),       // user_id -> { display_name, color }
  hidden: new Set(store.get('rc.hidden', [])), // colleghi che NON voglio vedere
  calendar: null,
  channel: null,
  editing: null,             // riga evento in modifica (o null se nuovo)
};

// ================================================================== ACCESSO
function showAuth(mode = 'login') {
  $('#app-view').hidden = true;
  $('#auth-view').hidden = false;
  setAuthTab(mode);
}

function setAuthTab(mode) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === mode));
  $('.tabs').hidden = mode === 'recovery';
  $('#login-form').hidden = mode !== 'login';
  $('#signup-form').hidden = mode !== 'signup';
  $('#recovery-form').hidden = mode !== 'recovery';
  authMsg('');
}

function authMsg(text, isError = false) {
  const el = $('#auth-msg');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

document.querySelectorAll('.tabs button').forEach((b) =>
  b.addEventListener('click', () => setAuthTab(b.dataset.tab)));

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  authMsg('Accesso in corso…');
  const { error } = await supabase.auth.signInWithPassword({
    email: f.get('email').trim(), password: f.get('password'),
  });
  if (error) authMsg(errText(error), true);
});

$('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  authMsg('Creazione account…');
  const { data, error } = await supabase.auth.signUp({
    email: f.get('email').trim(),
    password: f.get('password'),
    options: { data: { display_name: f.get('name').trim() }, emailRedirectTo: location.origin },
  });
  if (error) return authMsg(errText(error), true);
  if (!data.session) {
    authMsg('Fatto! Ti abbiamo mandato una email: clicca il link per confermare e poi accedi.');
    e.target.reset();
  }
});

$('#forgot-btn').addEventListener('click', async () => {
  const email = $('#login-form [name=email]').value.trim();
  if (!email) return authMsg('Scrivi prima la tua email qui sopra.', true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
  authMsg(error ? errText(error) : 'Ti abbiamo mandato una email per reimpostare la password.', !!error);
});

$('#recovery-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = new FormData(e.target).get('password');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return authMsg(errText(error), true);
  toast('Password aggiornata');
  const { data } = await supabase.auth.getSession();
  if (data.session) startApp(data.session.user);
});

$('#logout-btn').addEventListener('click', () => supabase.auth.signOut());

// ------------------------------------------------------------------ accesso libero (prove)
// Con VITE_ACCESSO_LIBERO=1 il sito entra senza iscrizione: Supabase crea un
// utente "ospite" (anonimo) legato a questo browser. I dati restano salvati.
const ACCESSO_LIBERO = import.meta.env.VITE_ACCESSO_LIBERO === '1';

async function enterAsGuest() {
  authMsg('Apertura…');
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    showAuth('login');
    authMsg('Accesso libero non attivo su Supabase: abilita "Allow anonymous sign-ins". (' + errText(error) + ')', true);
  }
}

$('#guest-btn').hidden = !ACCESSO_LIBERO;
$('#guest-btn').addEventListener('click', async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) { $('#auth-view').hidden = true; $('#app-view').hidden = false; }
  else enterAsGuest();
});

$('#login-btn').addEventListener('click', () => showAuth('login'));

supabase.auth.onAuthStateChange((event, session) => {
  // le chiamate a Supabase vanno fuori dalla callback (evita blocchi)
  setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') return showAuth('recovery');
    if (session?.user) {
      if (state.user?.id !== session.user.id) startApp(session.user);
    } else {
      stopApp();
      if (ACCESSO_LIBERO) enterAsGuest();
      else showAuth('login');
    }
  }, 0);
});

// ================================================================== APP
async function startApp(user) {
  state.user = user;
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  const guest = !!user.is_anonymous;
  $('#guest-badge').hidden = !guest;
  $('#login-btn').hidden = !guest;
  $('#logout-btn').hidden = guest;   // un ospite che "esce" perderebbe i suoi dati

  await loadProfile();
  initCalendar();
  await loadTeams();
  subscribeRealtime();
}

function stopApp() {
  state.user = null;
  state.profile = null;
  if (state.channel) supabase.removeChannel(state.channel);
  state.channel = null;
  if (state.calendar) state.calendar.destroy();
  state.calendar = null;
}

// ------------------------------------------------------------------ profilo
async function loadProfile() {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
  if (error) return toast(errText(error), true);
  state.profile = data;
  state.profiles.set(data.id, data);
  $('#me-name').textContent = data.display_name;
  $('#me-dot').style.background = data.color;
}

$('#profile-btn').addEventListener('click', () => {
  const f = $('#profile-form');
  f.display_name.value = state.profile.display_name;
  f.color.value = state.profile.color;
  $('#profile-email').textContent = state.user.email || 'Ospite (modalità prova, senza email)';
  $('#profile-dialog').returnValue = '';
  $('#profile-dialog').showModal();
});

$('#profile-dialog').addEventListener('close', async () => {
  if ($('#profile-dialog').returnValue !== 'ok') return;
  const f = $('#profile-form');
  const { error } = await supabase.from('profiles')
    .update({ display_name: f.display_name.value.trim(), color: f.color.value })
    .eq('id', state.user.id);
  if (error) return toast(errText(error), true);
  await loadProfile();
  await loadMembers();
  state.calendar?.refetchEvents();
});

// ------------------------------------------------------------------ gruppi
async function loadTeams() {
  const { data, error } = await supabase
    .from('team_members')
    .select('role, share_events, team:teams(id, name, invite_code)')
    .eq('user_id', state.user.id)
    .order('joined_at');
  if (error) return toast(errText(error), true);

  state.teams = data.filter((r) => r.team).map((r) => ({ ...r.team, role: r.role, share_events: r.share_events }));
  if (!state.teams.some((t) => t.id === state.teamId)) state.teamId = state.teams[0]?.id ?? null;
  store.set('rc.team', state.teamId);

  const sel = $('#team-select');
  sel.innerHTML = '';
  for (const t of state.teams) sel.add(new Option(t.name, t.id, false, t.id === state.teamId));

  $('#no-team').hidden = state.teams.length > 0;
  $('#team-box').hidden = state.teams.length === 0;
  await loadMembers();
}

const currentTeam = () => state.teams.find((t) => t.id === state.teamId);

async function loadMembers() {
  const team = currentTeam();
  state.members = [];
  if (team) {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, role, share_events, profile:profiles(id, display_name, color)')
      .eq('team_id', team.id);
    if (error) return toast(errText(error), true);
    state.members = data.filter((m) => m.profile);
    for (const m of state.members) state.profiles.set(m.user_id, m.profile);
  }
  renderTeamPanel();
  state.calendar?.refetchEvents();
}

function renderTeamPanel() {
  const team = currentTeam();
  if (!team) return;
  $('#invite-code').textContent = team.invite_code;
  $('#regen-code').hidden = team.role !== 'owner';

  const me = state.members.find((m) => m.user_id === state.user.id);
  $('#share-toggle').checked = me ? me.share_events : true;

  const list = $('#member-list');
  list.innerHTML = '';
  const sorted = [...state.members].sort((a, b) =>
    (a.user_id === state.user.id ? -1 : b.user_id === state.user.id ? 1 : 0) ||
    a.profile.display_name.localeCompare(b.profile.display_name));

  for (const m of sorted) {
    const isMe = m.user_id === state.user.id;
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isMe || (m.share_events && !state.hidden.has(m.user_id));
    cb.disabled = isMe || !m.share_events;
    cb.title = isMe ? 'Sei tu' : m.share_events ? 'Mostra/nascondi nel mio calendario' : 'Ha scelto di non condividere';
    cb.addEventListener('change', () => {
      cb.checked ? state.hidden.delete(m.user_id) : state.hidden.add(m.user_id);
      store.set('rc.hidden', [...state.hidden]);
      state.calendar?.refetchEvents();
    });

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.profile.color;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = m.profile.display_name + (isMe ? ' (tu)' : '');

    li.append(cb, dot, name);

    if (m.role === 'owner') li.append(badge('admin'));
    if (!m.share_events) li.append(badge('non condivide', 'off'));

    if (team.role === 'owner' && !isMe) {
      const x = document.createElement('button');
      x.className = 'btn ghost icon small';
      x.textContent = '✕';
      x.title = 'Rimuovi dal gruppo';
      x.addEventListener('click', () => removeMember(m));
      li.append(x);
    }
    list.append(li);
  }
}

function badge(text, cls = '') {
  const b = document.createElement('span');
  b.className = `badge ${cls}`;
  b.textContent = text;
  return b;
}

$('#team-select').addEventListener('change', (e) => {
  state.teamId = e.target.value;
  store.set('rc.team', state.teamId);
  loadMembers();
});

$('#share-toggle').addEventListener('change', async (e) => {
  const { error } = await supabase.from('team_members')
    .update({ share_events: e.target.checked })
    .eq('team_id', state.teamId).eq('user_id', state.user.id);
  if (error) { e.target.checked = !e.target.checked; return toast(errText(error), true); }
  toast(e.target.checked ? 'I tuoi impegni sono visibili al gruppo' : 'I tuoi impegni ora sono nascosti al gruppo');
  await loadTeams();
});

$('#copy-code').addEventListener('click', async () => {
  const code = currentTeam().invite_code;
  if (window.RenkoApp?.copy) { window.RenkoApp.copy(code); return toast('Codice copiato'); } // app Android
  try { await navigator.clipboard.writeText(code); toast('Codice copiato'); }
  catch { toast('Copia non riuscita: selezionalo a mano', true); }
});

$('#regen-code').addEventListener('click', async () => {
  if (!confirm('Generare un nuovo codice? Quello vecchio smetterà di funzionare.')) return;
  const { error } = await supabase.rpc('regenerate_invite', { p_team: state.teamId });
  if (error) return toast(errText(error), true);
  await loadTeams();
});

$('#create-team').addEventListener('click', async () => {
  const name = await ask('Nuovo gruppo', 'Nome del gruppo');
  if (!name) return;
  const { data, error } = await supabase.rpc('create_team', { p_name: name });
  if (error) return toast(errText(error), true);
  state.teamId = data.id;
  await loadTeams();
  toast(`Gruppo creato. Codice invito: ${data.invite_code}`);
});

$('#join-team').addEventListener('click', async () => {
  const code = await ask('Entra in un gruppo', 'Codice invito');
  if (!code) return;
  const { data, error } = await supabase.rpc('join_team', { p_code: code });
  if (error) return toast(errText(error), true);
  state.teamId = data.id;
  await loadTeams();
  toast(`Sei entrato in ${data.name}`);
});

$('#leave-team').addEventListener('click', async () => {
  const team = currentTeam();
  if (!team || !confirm(`Uscire dal gruppo "${team.name}"?`)) return;
  const { error } = await supabase.from('team_members')
    .delete().eq('team_id', team.id).eq('user_id', state.user.id);
  if (error) return toast(errText(error), true);
  await loadTeams();
});

async function removeMember(m) {
  if (!confirm(`Rimuovere ${m.profile.display_name} dal gruppo?`)) return;
  const { error } = await supabase.from('team_members')
    .delete().eq('team_id', state.teamId).eq('user_id', m.user_id);
  if (error) return toast(errText(error), true);
  await loadMembers();
}

// sidebar a scomparsa su telefono
$('#team-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#team-close').addEventListener('click', () => $('#sidebar').classList.remove('open'));

function ask(title, label) {
  const dlg = $('#ask-dialog');
  $('#ask-title').textContent = title;
  $('#ask-label').textContent = label;
  $('#ask-input').value = '';
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'ok' ? $('#ask-input').value.trim() : null);
    }, { once: true });
  });
}

// ================================================================== CALENDARIO
function initCalendar() {
  if (state.calendar) state.calendar.destroy();
  const mobile = isMobile();

  state.calendar = new Calendar($('#calendar'), {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    locale: itLocale,
    timeZone: 'local',
    initialView: store.get('rc.view', mobile ? 'timeGridDay' : 'timeGridWeek'),
    headerToolbar: mobile
      ? { left: 'prev,next', center: 'title', right: 'today' }
      : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
    footerToolbar: mobile ? { center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' } : false,
    height: '100%',
    nowIndicator: true,
    firstDay: 1,
    slotMinTime: '06:00:00',
    slotMaxTime: '23:00:00',
    scrollTime: '08:00:00',
    allDayText: 'giorno',
    selectable: true,
    selectMirror: true,
    longPressDelay: 350,
    editable: true,
    eventStartEditable: true,
    dayMaxEvents: true,
    events: fetchEvents,
    select: (info) => { openEventDialog(null, info); state.calendar.unselect(); },
    eventClick: (info) => openEventDialog(info.event.extendedProps.row),
    eventDrop: moveEvent,
    eventResize: moveEvent,
    datesSet: (info) => store.set('rc.view', info.view.type),
  });
  state.calendar.render();
}

async function fetchEvents(info, success, failure) {
  if (!state.user) return success([]);
  // RLS di Supabase restituisce già solo: i miei + quelli condivisi dei colleghi
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .lt('start_at', info.end.toISOString())
    .gte('end_at', info.start.toISOString())
    .order('start_at');
  if (error) { toast(errText(error), true); return failure(error); }

  const teamMembers = new Set(state.members.map((m) => m.user_id));
  const me = state.user.id;

  success(data
    .filter((ev) => ev.owner_id === me || (teamMembers.has(ev.owner_id) && !state.hidden.has(ev.owner_id)))
    .map((ev) => {
      const mine = ev.owner_id === me;
      const owner = state.profiles.get(ev.owner_id);
      const color = owner?.color || '#64748b';
      return {
        id: ev.id,
        title: mine ? (ev.is_private ? `🔒 ${ev.title}` : ev.title) : `${owner?.display_name ?? '?'} · ${ev.title}`,
        start: ev.start_at,
        end: ev.end_at,
        allDay: ev.all_day,
        backgroundColor: color,
        borderColor: color,
        editable: mine,
        classNames: mine ? ['ev-mine'] : ['ev-other'],
        extendedProps: { row: ev },
      };
    }));
}

async function moveEvent(info) {
  const ev = info.event;
  const end = ev.end ?? (ev.allDay ? addDays(ev.start, 1) : addHours(ev.start, 1));
  const { error } = await supabase.from('events').update({
    start_at: ev.start.toISOString(), end_at: end.toISOString(), all_day: ev.allDay,
  }).eq('id', ev.id);
  if (error) { info.revert(); toast(errText(error), true); }
}

// ------------------------------------------------------------------ dialog impegno
const form = $('#event-form');

function setTimeVisibility() {
  const allDay = form.all_day.checked;
  form.querySelectorAll('.time').forEach((el) => (el.hidden = allDay));
  form.start_time.required = !allDay;
  form.end_time.required = !allDay;
}
form.all_day.addEventListener('change', setTimeVisibility);

// se sposto l'inizio dopo la fine, la fine segue
form.start_date.addEventListener('change', () => {
  if (form.end_date.value < form.start_date.value) form.end_date.value = form.start_date.value;
});

function openEventDialog(row, selection) {
  state.editing = row;
  const mine = !row || row.owner_id === state.user.id;
  form.reset();
  $('#event-msg').textContent = '';

  let start, end, allDay;
  if (row) {
    start = new Date(row.start_at); end = new Date(row.end_at); allDay = row.all_day;
    form.title.value = row.title;
    form.location.value = row.location || '';
    form.description.value = row.description || '';
    form.is_private.checked = row.is_private;
  } else if (selection) {
    start = selection.start; end = selection.end; allDay = selection.allDay;
  } else {
    start = new Date(); start.setMinutes(0, 0, 0); start = addHours(start, 1);
    end = addHours(start, 1); allDay = false;
  }

  // nei giorni interi la fine è esclusiva: nel form mostro l'ultimo giorno incluso
  const shownEnd = allDay ? addDays(end, -1) : end;
  form.all_day.checked = allDay;
  form.start_date.value = dateStr(start);
  form.start_time.value = allDay ? '09:00' : timeStr(start);
  form.end_date.value = dateStr(shownEnd < start ? start : shownEnd);
  form.end_time.value = allDay ? '10:00' : timeStr(end);
  setTimeVisibility();

  $('#event-dialog-title').textContent = row ? (mine ? 'Modifica impegno' : 'Impegno del collega') : 'Nuovo impegno';
  const owner = row && !mine ? state.profiles.get(row.owner_id) : null;
  $('#event-owner').hidden = !owner;
  $('#event-owner').textContent = owner ? `Di ${owner.display_name}` : '';

  form.querySelectorAll('input, textarea').forEach((el) => (el.disabled = !mine));
  $('#event-save').hidden = !mine;
  $('#event-delete').hidden = !(row && mine);
  $('#event-dialog').showModal();
}

$('#event-cancel').addEventListener('click', () => $('#event-dialog').close());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const allDay = form.all_day.checked;
  let start, end;
  if (allDay) {
    start = new Date(`${form.start_date.value}T00:00`);
    end = addDays(new Date(`${form.end_date.value}T00:00`), 1);
  } else {
    start = new Date(`${form.start_date.value}T${form.start_time.value}`);
    end = new Date(`${form.end_date.value}T${form.end_time.value}`);
  }
  if (!(end > start)) {
    $('#event-msg').textContent = 'La fine deve essere dopo l\'inizio.';
    return;
  }

  const payload = {
    title: form.title.value.trim(),
    location: form.location.value.trim(),
    description: form.description.value.trim(),
    is_private: form.is_private.checked,
    all_day: allDay,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  };

  $('#event-save').disabled = true;
  const { error } = state.editing
    ? await supabase.from('events').update(payload).eq('id', state.editing.id)
    : await supabase.from('events').insert(payload);
  $('#event-save').disabled = false;

  if (error) { $('#event-msg').textContent = errText(error); return; }
  $('#event-dialog').close();
  state.calendar.refetchEvents();
});

$('#event-delete').addEventListener('click', async () => {
  if (!state.editing || !confirm('Eliminare questo impegno?')) return;
  const { error } = await supabase.from('events').delete().eq('id', state.editing.id);
  if (error) { $('#event-msg').textContent = errText(error); return; }
  $('#event-dialog').close();
  state.calendar.refetchEvents();
});

$('#fab').addEventListener('click', () => openEventDialog(null, null));

// ================================================================== REALTIME
function subscribeRealtime() {
  if (state.channel) supabase.removeChannel(state.channel);
  let t;
  const refetch = () => { clearTimeout(t); t = setTimeout(() => state.calendar?.refetchEvents(), 300); };
  let tm;
  const reloadTeams = () => { clearTimeout(tm); tm = setTimeout(loadTeams, 300); };

  state.channel = supabase.channel('rc-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refetch)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, reloadTeams)
    .subscribe();
}

// quando l'app torna in primo piano (telefono) ricarico
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.user) state.calendar?.refetchEvents();
});

// ================================================================== PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
