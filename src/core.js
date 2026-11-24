'use strict';
/* ============================================================
   Bound Werkstatt – Kern: Hilfsfunktionen, Datenmodell, Spiel-Engine
   (reine Logik, in Node testbar)
   ============================================================ */
const uid = () => 'e' + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

/* ---------- Mini-Markdown (sicher: erst escapen, dann ersetzen) ---------- */
function md(src) {
  if (!src) return '';
  const inline = s => s
    .replace(/!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  const lines = esc(src).split('\n');
  let out = '', para = [], list = [];
  const flushP = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list.length) { out += '<ul>' + list.map(l => '<li>' + inline(l) + '</li>').join('') + '</ul>'; list = []; } };
  for (const ln of lines) {
    let m;
    if (/^\s*$/.test(ln)) { flushP(); flushL(); }
    else if ((m = ln.match(/^#{1,3}\s+(.*)$/))) { flushP(); flushL(); out += '<h4>' + inline(m[1]) + '</h4>'; }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)$/))) { flushP(); list.push(m[1]); }
    else { flushL(); para.push(ln); }
  }
  flushP(); flushL();
  return out;
}

/* ---------- Geo ---------- */
const rad = d => d * Math.PI / 180;
function haversine(a, b, c, d) {
  const dLat = rad(c - a), dLon = rad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}
function bearing(a, b, c, d) {
  const y = Math.sin(rad(d - b)) * Math.cos(rad(c));
  const x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const fmtDist = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
/** Punkt in Entfernung dist (m) und Richtung brg (Grad) von lat/lon */
function offsetPoint(lat, lon, dist, brg) {
  const d = dist / 6371000, b = rad(brg), la = rad(lat), lo = rad(lon);
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
}

/* ---------- Bedingungen & Aktionen ---------- */
const OPS = ['==', '!=', '>', '>=', '<', '<='];
const BUILTIN_VARS = ['score', 'correct', 'wrong'];
function coerce(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  return s !== '' && !isNaN(Number(s)) ? Number(s) : String(v == null ? '' : v);
}
function cmp(a, op, b) {
  a = coerce(a); b = coerce(b);
  switch (op) {
    case '==': return a == b; case '!=': return a != b;
    case '>': return a > b; case '>=': return a >= b;
    case '<': return a < b; case '<=': return a <= b;
  }
  return false;
}
const evalConds = (conds, vars) => (conds || []).every(c => !c.var || cmp(vars[c.var] == null ? 0 : vars[c.var], c.op, c.value));
function applyActions(actions, vars) {
  for (const a of actions || []) {
    if (!a.var) continue;
    const cur = vars[a.var], val = coerce(a.value);
    if (a.op === 'add') vars[a.var] = (Number(cur) || 0) + (Number(val) || 0);
    else if (a.op === 'sub') vars[a.var] = (Number(cur) || 0) - (Number(val) || 0);
    else vars[a.var] = val;
  }
}

/* ---------- Quiz-Auswertung ---------- */
function normText(s, cs) {
  s = String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, ' ').trim().replace(/[.,;:!?'"„“”‚‘’()\-–]/g, '');
  return cs ? s : s.toLowerCase();
}
function checkQuiz(el, a) {
  switch (el.sub) {
    case 'single': return !!(el.options[a] && el.options[a].correct);
    case 'multi': return el.options.every((o, i) => !!o.correct === a.includes(i));
    case 'text': return (el.answers || []).some(x => normText(x, el.caseSensitive) === normText(a, el.caseSensitive));
    case 'number': {
      const n = Number(String(a).trim().replace(',', '.'));
      return String(a).trim() !== '' && !isNaN(n) && Math.abs(n - Number(el.value)) <= Math.abs(Number(el.tolerance) || 0) + 1e-9;
    }
    case 'sort': return a.every((orig, pos) => orig === pos);
    case 'match': return a.every((r, i) => r === i);
  }
  return false;
}
function solutionText(el) {
  switch (el.sub) {
    case 'single': case 'multi': return el.options.filter(o => o.correct).map(o => o.text).join(', ');
    case 'text': return (el.answers || [])[0] || '';
    case 'number': return String(el.value).replace('.', ',') + (Number(el.tolerance) ? ' (± ' + el.tolerance + ')' : '');
    case 'sort': return (el.items || []).join(' → ');
    case 'match': return (el.pairs || []).map(p => p.l + ' = ' + p.r).join('; ');
  }
  return '';
}

/* ---------- Elementtypen ---------- */
const TYPE_DEFS = {
  info: { label: 'Info', cat: 'Inhalt', icon: 'i', desc: 'Text, Bild, Audio oder Video', make: () => ({ title: 'Neue Info', text: '', image: '', audio: '', video: '', buttonLabel: 'Weiter' }) },
  quiz: { label: 'Quiz', cat: 'Aufgaben', icon: '?', desc: 'Auswahl, Text, Zahl, Sortieren, Zuordnen', make: () => ({ title: 'Neue Frage', sub: 'single', text: '', image: '', options: [{ text: 'Antwort A', correct: true }, { text: 'Antwort B', correct: false }], answers: [], caseSensitive: false, value: 0, tolerance: 0, items: ['Erstes', 'Zweites', 'Drittes'], pairs: [{ l: 'Links 1', r: 'Rechts 1' }, { l: 'Links 2', r: 'Rechts 2' }], points: 10, attempts: 2, penalty: 50, shuffle: true, timeLimit: 0, hint: '', hintCost: 2, feedbackRight: 'Richtig!', feedbackWrong: 'Leider falsch.', explain: '', nextRight: '', nextWrong: '' }) },
  mission: { label: 'Aufgabe', cat: 'Aufgaben', icon: '▣', desc: 'Foto, Video, Audio, Text oder Datei abgeben', make: () => ({ title: 'Neue Aufgabe', kind: 'photo', text: '', points: 10, optional: false }) },
  code: { label: 'Code finden', cat: 'Aufgaben', icon: '▦', desc: 'QR-Code scannen oder Code eintippen', make: () => ({ title: 'Code finden', text: '', codes: ['STATION1'], scan: true, points: 10, hint: '', allowSkip: false }) },
  location: { label: 'Ort finden', cat: 'Aufgaben', icon: '◎', desc: 'GPS-Ziel mit Kompass und Karte', make: () => ({ title: 'Ort finden', text: '', lat: 48.2082, lon: 16.3738, radius: 25, points: 10, showDistance: true, showMap: true, allowSkip: false }) },
  survey: { label: 'Umfrage', cat: 'Aufgaben', icon: '☰', desc: 'Antworten ohne Punkte einsammeln', make: () => ({ title: 'Neue Umfrage', sub: 'choice', text: '', options: ['Ja', 'Nein'], required: true }) },
  timer: { label: 'Timer', cat: 'Ablauf', icon: '◷', desc: 'Warten oder Countdown', make: () => ({ title: 'Kurze Pause', text: '', seconds: 30, skippable: false }) },
  choice: { label: 'Verzweigung', cat: 'Ablauf', icon: '⑂', desc: 'Spieler wählen den nächsten Weg', make: () => ({ title: 'Welchen Weg nimmst du?', text: '', image: '', options: [{ label: 'Links', next: '', actions: [] }, { label: 'Rechts', next: '', actions: [] }] }) },
  jump: { label: 'Sprung', cat: 'Ablauf', icon: '↪', desc: 'Weiche anhand von Variablen', make: () => ({ title: 'Weiche', rules: [{ var: 'score', op: '>=', value: 20, target: '' }] }) },
  action: { label: 'Variable', cat: 'Ablauf', icon: '≡', desc: 'Punkte und Variablen unsichtbar ändern', make: () => ({ title: 'Variablen setzen' }) },
  end: { label: 'Ende', cat: 'Ablauf', icon: '■', desc: 'Bound hier beenden', make: () => ({ title: 'Ende', text: '' }) }
};
const POINT_TYPES = new Set(['quiz', 'mission', 'code', 'location']);
const AUTO_TYPES = new Set(['action', 'jump']);

function makeElement(type) {
  const d = TYPE_DEFS[type];
  return Object.assign({ id: uid(), type, cond: [], actions: [], next: '' }, clone(d.make()));
}
function blankBound() {
  return {
    format: 'bound-werkstatt', version: 1,
    meta: { title: 'Neuer Bound', description: '', author: '', cover: '', lang: 'de', askName: true, askTeam: false, timeLimit: 0, showScore: true, showTimer: true, leaderboard: true, finalText: 'Danke fürs Mitspielen, {name}! Du hast **{score}** Punkte gesammelt.', variables: [] },
    elements: []
  };
}
function normalizeBound(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Das ist keine gültige Bound-Datei.');
  if (!Array.isArray(raw.elements)) throw new Error('Das Feld "elements" fehlt.');
  const warnings = [], b = blankBound(), seen = new Set();
  if (raw.meta && typeof raw.meta === 'object') Object.assign(b.meta, raw.meta);
  if (!Array.isArray(b.meta.variables)) b.meta.variables = [];
  raw.elements.forEach((e, i) => {
    if (!e || !TYPE_DEFS[e.type]) { warnings.push(`Element ${i + 1}: unbekannter Typ "${e && e.type}" übersprungen.`); return; }
    const el = Object.assign(makeElement(e.type), e);
    if (!el.id || seen.has(el.id)) el.id = uid();
    seen.add(el.id);
    ['cond', 'actions'].forEach(k => { if (!Array.isArray(el[k])) el[k] = []; });
    b.elements.push(el);
  });
  return { bound: b, warnings };
}
function varNames(bound) {
  return BUILTIN_VARS.concat((bound.meta.variables || []).map(v => v.name).filter(Boolean));
}
function findProblems(bound) {
  const out = [], ids = new Set(bound.elements.map(e => e.id));
  const add = (el, msg) => out.push({ id: el.id, msg });
  const badTarget = t => t && t !== '__end' && !ids.has(t);
  if (!bound.elements.length) out.push({ id: null, msg: 'Der Bound hat noch keine Elemente.' });
  bound.elements.forEach(el => {
    if (badTarget(el.next)) add(el, 'Das Ziel „Danach weiter mit“ existiert nicht mehr.');
    if (el.type === 'quiz') {
      if ((el.sub === 'single' || el.sub === 'multi')) {
        if (!el.options.some(o => o.correct)) add(el, 'Keine Antwort ist als richtig markiert.');
        if (el.options.length < 2) add(el, 'Mindestens zwei Antworten nötig.');
      }
      if (el.sub === 'text' && !(el.answers || []).some(a => a.trim())) add(el, 'Keine richtige Textantwort eingetragen.');
      if (el.sub === 'sort' && (el.items || []).length < 2) add(el, 'Zum Sortieren braucht es mindestens zwei Einträge.');
      if (el.sub === 'match' && (el.pairs || []).length < 2) add(el, 'Zum Zuordnen braucht es mindestens zwei Paare.');
      if (badTarget(el.nextRight) || badTarget(el.nextWrong)) add(el, 'Ein Ziel für richtig/falsch existiert nicht mehr.');
    }
    if (el.type === 'code' && !(el.codes || []).some(c => c.trim())) add(el, 'Kein Code eingetragen.');
    if (el.type === 'location' && (isNaN(Number(el.lat)) || isNaN(Number(el.lon)))) add(el, 'Koordinaten fehlen.');
    if (el.type === 'choice') {
      if (!(el.options || []).length) add(el, 'Keine Auswahlmöglichkeiten.');
      (el.options || []).forEach(o => { if (badTarget(o.next)) add(el, `Ziel von „${o.label}“ existiert nicht mehr.`); });
    }
    if (el.type === 'jump') (el.rules || []).forEach(r => { if (badTarget(r.target)) add(el, 'Ein Sprungziel existiert nicht mehr.'); });
    if (el.type === 'survey' && el.sub !== 'text' && el.sub !== 'rating' && !(el.options || []).length) add(el, 'Keine Antwortmöglichkeiten.');
    if (el.type === 'timer' && !(Number(el.seconds) >= 0)) add(el, 'Ungültige Sekundenzahl.');
  });
  return out;
}

/* ---------- Spiel-Engine ---------- */
class Game {
  constructor(bound) { this.bound = bound; this.reset(); }
  get els() { return this.bound.elements; }
  reset() {
    this.vars = { score: 0, correct: 0, wrong: 0 };
    (this.bound.meta.variables || []).forEach(v => { if (v.name) this.vars[v.name] = coerce(v.initial == null ? 0 : v.initial); });
    this.log = []; this.cur = null; this.curIdx = -1; this.finished = false; this.finishReason = '';
    this.startedAt = null; this.finishedAt = null; this.name = ''; this.team = ''; this.maxPts = 0; this.steps = 0; this.endText = '';
  }
  index(id) { return this.els.findIndex(e => e.id === id); }
  start(name, team, fromId) {
    this.reset(); this.startedAt = Date.now(); this.name = name || ''; this.team = team || '';
    const i = fromId ? this.index(fromId) : 0;
    this.goIdx(i < 0 ? 0 : i);
  }
  resolveTarget(t, i) {
    if (t === '__end') { this.finish(); return -1; }
    if (t) { const k = this.index(t); if (k >= 0) return k; }
    return i + 1;
  }
  goIdx(i) {
    for (;;) {
      if (++this.steps > 5000) { this.finish('loop'); return; }
      const el = this.els[i];
      if (!el) { this.finish(); return; }
      if (!evalConds(el.cond, this.vars)) { i++; continue; }
      if (el.type === 'action') {
        applyActions(el.actions, this.vars);
        i = this.resolveTarget(el.next, i); if (i < 0) return; continue;
      }
      if (el.type === 'jump') {
        let t = null;
        for (const r of el.rules || []) if (r.var && cmp(this.vars[r.var] == null ? 0 : this.vars[r.var], r.op, r.value)) { t = r.target; break; }
        if (t == null) t = el.next;
        i = this.resolveTarget(t, i); if (i < 0) return; continue;
      }
      if (el.type === 'end') { this.endText = el.text || ''; this.cur = null; this.finish(); return; }
      this.cur = el; this.curIdx = i; this.enteredAt = Date.now(); return;
    }
  }
  /** res: {points, max, correct(bool|null), answer, next} */
  complete(res) {
    const el = this.cur; if (!el) return;
    res = res || {};
    const pts = Number(res.points) || 0, max = Number(res.max) || 0;
    this.vars.score += pts; this.maxPts += max;
    if (res.correct === true) this.vars.correct++; else if (res.correct === false) this.vars.wrong++;
    this.log.push({ id: el.id, title: el.title, type: el.type, sub: el.sub || el.kind || '', points: pts, max, correct: res.correct == null ? null : res.correct, answer: res.answer == null ? null : res.answer, t: Date.now() - this.startedAt, skipped: !!res.skipped });
    applyActions(el.actions, this.vars);
    const t = res.next != null && res.next !== '' ? res.next : el.next;
    const i = this.resolveTarget(t, this.curIdx);
    if (i >= 0) this.goIdx(i);
  }
  finish(reason) {
    if (this.finished) return;
    this.finished = true; this.finishReason = reason || ''; this.finishedAt = Date.now(); this.cur = null;
  }
  get duration() { return (this.finishedAt || Date.now()) - (this.startedAt || Date.now()); }
  results() {
    return {
      format: 'bound-werkstatt-result', bound: this.bound.meta.title, name: this.name, team: this.team,
      score: this.vars.score, maxScore: this.maxPts, durationSec: Math.round(this.duration / 1000),
      finishedAt: new Date(this.finishedAt || Date.now()).toISOString(), variables: Object.assign({}, this.vars), steps: this.log
    };
  }
  serialize() {
    return {
      vars: this.vars, maxPts: this.maxPts, name: this.name, team: this.team, startedAt: this.startedAt, finished: this.finished,
      curId: this.cur ? this.cur.id : null, steps: this.steps,
      log: this.log.map(l => Object.assign({}, l, { answer: typeof l.answer === 'string' && l.answer.length > 300 ? '[Datei]' : l.answer }))
    };
  }
  restore(s) {
    this.reset(); Object.assign(this, { vars: s.vars, maxPts: s.maxPts, name: s.name, team: s.team, startedAt: s.startedAt, log: s.log, steps: s.steps || 0 });
    if (s.finished) { this.finished = true; this.finishedAt = Date.now(); return; }
    const i = this.index(s.curId);
    if (i < 0) this.goIdx(0); else { this.cur = this.els[i]; this.curIdx = i; this.enteredAt = Date.now(); }
  }
}

/* ---------- Spiel-Link: Bound komprimiert in die Adresse packen ---------- */
function toB64url(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64url(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function packBound(bound) {
  const bytes = new TextEncoder().encode(JSON.stringify(bound));
  if (typeof CompressionStream === 'undefined') return 'p.' + toB64url(bytes);
  const z = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  return 'z.' + toB64url(z);
}
async function unpackBound(tok) {
  const kind = tok.slice(0, 2), data = fromB64url(tok.slice(2));
  let bytes = data;
  if (kind === 'z.') bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  else if (kind !== 'p.') throw new Error('Der Link ist unvollständig oder beschädigt.');
  return JSON.parse(new TextDecoder().decode(bytes));
}

if (typeof module !== 'undefined') module.exports = { packBound, unpackBound, uid, clone, esc, md, shuffle, haversine, bearing, offsetPoint, fmtDist, fmtTime, hashStr, coerce, cmp, evalConds, applyActions, normText, checkQuiz, solutionText, TYPE_DEFS, makeElement, blankBound, normalizeBound, findProblems, varNames, Game, OPS, BUILTIN_VARS, POINT_TYPES, AUTO_TYPES };
