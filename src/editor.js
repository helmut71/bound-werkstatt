/* ============================================================
   Editor: Elementliste, Formulare, Vorschau, JSON-Quelle, QR-Druck, Export
   ============================================================ */
const App = { bound: null, sel: 'meta', tab: 'edit', hist: [], hi: -1, player: null, previewFrom: 'sel', geoMap: null, geoUpdate: null, panel: 'edit' };
let fidN = 0; const nid = () => 'f' + (++fidN);
const ap = {};   // DOM-Referenzen

/* ---------- Auswahlhilfen ---------- */
const targetOptions = () => [['', '→ nächstes Element'], ...App.bound.elements.map((e, i) => [e.id, (i + 1) + '. ' + (e.title || TYPE_DEFS[e.type].label)]), ['__end', '■ Bound beenden']];
const OPT_OPS = OPS.map(o => [o, o]);
const OPT_ACT = [['set', 'setzen auf'], ['add', 'erhöhen um'], ['sub', 'verringern um']];

/* ---------- Formularschema ---------- */
const F = (k, key, label, x) => Object.assign({ k, key, label }, x);
const COND_F = [F('var', 'var', 'Variable'), F('sel', 'op', 'Vergleich', { opts: OPT_OPS }), F('text', 'value', 'Wert')];
const ACT_F = [F('var', 'var', 'Variable'), F('sel', 'op', 'Aktion', { opts: OPT_ACT }), F('text', 'value', 'Wert')];
const logicBlock = (type, extra) => ({
  k: 'details', label: 'Logik & Ablauf', fields: [
    ...(extra || []),
    F('list', 'cond', 'Nur anzeigen, wenn …', { item: COND_F, make: () => ({ var: 'score', op: '>=', value: 0 }), addLabel: '+ Bedingung', hint: 'Alle Bedingungen müssen zutreffen, sonst wird das Element übersprungen.' }),
    F('list', 'actions', 'Danach Variablen ändern', { item: ACT_F, make: () => ({ var: 'score', op: 'add', value: 5 }), addLabel: '+ Aktion', hint: 'Eingebaute Variablen: score, correct, wrong. Eigene legst du unter Bound-Einstellungen an.' }),
    ...(type === 'end' || type === 'choice' ? [] : [F('target', 'next', type === 'jump' ? 'Sonst weiter mit' : 'Danach weiter mit')])
  ]
});
const FORMS = {
  info: [F('text', 'title', 'Titel'), F('area', 'text', 'Text', { rows: 6, hint: 'Markdown: **fett**, *kursiv*, - Liste, [Link](https://…), ![Bild](https://…)' }), F('media', 'image', 'Bild'), F('text', 'audio', 'Audio-Link', { ph: 'https://…/datei.mp3' }), F('text', 'video', 'Video-Link', { ph: 'YouTube-Link oder .mp4' }), F('text', 'buttonLabel', 'Beschriftung des Weiter-Knopfs'), logicBlock('info')],
  quiz: [
    F('text', 'title', 'Titel'),
    F('sel', 'sub', 'Fragetyp', { redraw: true, opts: [['single', 'Einfachauswahl'], ['multi', 'Mehrfachauswahl'], ['text', 'Texteingabe'], ['number', 'Zahl'], ['sort', 'Sortieren'], ['match', 'Zuordnen']] }),
    F('area', 'text', 'Frage', { rows: 3 }), F('media', 'image', 'Bild'),
    F('list', 'options', 'Antworten', { if: o => o.sub === 'single' || o.sub === 'multi', item: [F('text', 'text', 'Antwort'), F('check', 'correct', 'richtig')], make: () => ({ text: '', correct: false }), addLabel: '+ Antwort' }),
    F('lines', 'answers', 'Richtige Antworten (eine pro Zeile)', { if: o => o.sub === 'text' }), F('check', 'caseSensitive', 'Groß-/Kleinschreibung beachten', { if: o => o.sub === 'text' }),
    F('num', 'value', 'Richtiger Wert', { if: o => o.sub === 'number', step: 'any' }), F('num', 'tolerance', 'Toleranz (±)', { if: o => o.sub === 'number', step: 'any' }),
    F('lines', 'items', 'Richtige Reihenfolge (eine Zeile pro Eintrag)', { if: o => o.sub === 'sort' }),
    F('list', 'pairs', 'Paare', { if: o => o.sub === 'match', item: [F('text', 'l', 'Links'), F('text', 'r', 'Rechts')], make: () => ({ l: '', r: '' }), addLabel: '+ Paar' }),
    F('row', null, null, { fields: [F('num', 'points', 'Punkte', { min: 0 }), F('num', 'attempts', 'Versuche', { min: 1 }), F('num', 'penalty', 'Abzug je Fehler (%)', { min: 0 })] }),
    F('check', 'shuffle', 'Antworten mischen', { if: o => ['single', 'multi', 'sort'].includes(o.sub) }),
    F('num', 'timeLimit', 'Zeitlimit in Sekunden (0 = keines)', { min: 0 }),
    F('row', null, null, { fields: [F('text', 'hint', 'Hinweis'), F('num', 'hintCost', 'Hinweis kostet', { min: 0 })] }),
    F('text', 'feedbackRight', 'Rückmeldung bei richtig'), F('text', 'feedbackWrong', 'Rückmeldung bei falsch'), F('area', 'explain', 'Erklärung (nach der Antwort)', { rows: 2 }),
    logicBlock('quiz', [F('target', 'nextRight', 'Bei richtiger Antwort weiter mit'), F('target', 'nextWrong', 'Bei falscher Antwort weiter mit')])],
  mission: [F('text', 'title', 'Titel'), F('area', 'text', 'Anweisung', { rows: 4 }), F('sel', 'kind', 'Abgabe', { opts: [['photo', 'Foto'], ['video', 'Video'], ['audio', 'Audio'], ['text', 'Text'], ['file', 'Datei']] }), F('num', 'points', 'Punkte', { min: 0 }), F('check', 'optional', 'Darf übersprungen werden'), logicBlock('mission')],
  code: [F('text', 'title', 'Titel'), F('area', 'text', 'Aufgabe', { rows: 3 }), F('lines', 'codes', 'Gültige Codes (einer pro Zeile)', { hint: 'Erzeuge QR-Codes zum Ausdrucken über „QR-Codes“ oben.' }), F('check', 'scan', 'Kamera-Scan anbieten'), F('num', 'points', 'Punkte', { min: 0 }), F('text', 'hint', 'Hinweis'), F('check', 'allowSkip', 'Überspringen erlauben (0 Punkte)'), logicBlock('code')],
  location: [F('text', 'title', 'Titel'), F('area', 'text', 'Aufgabe', { rows: 3 }), F('geo', null, 'Ziel'), F('num', 'radius', 'Radius in Metern', { min: 5 }), F('num', 'points', 'Punkte', { min: 0 }), F('check', 'showDistance', 'Entfernung anzeigen'), F('check', 'showMap', 'Karte anzeigen'), F('check', 'allowSkip', 'Überspringen erlauben (0 Punkte)'), logicBlock('location')],
  survey: [F('text', 'title', 'Titel'), F('area', 'text', 'Frage', { rows: 3 }), F('sel', 'sub', 'Antwortart', { redraw: true, opts: [['choice', 'Einzelauswahl'], ['multi', 'Mehrfachauswahl'], ['text', 'Freitext'], ['rating', 'Sterne (1–5)']] }), F('lines', 'options', 'Antworten (eine pro Zeile)', { if: o => o.sub === 'choice' || o.sub === 'multi' }), F('check', 'required', 'Antwort ist Pflicht'), logicBlock('survey')],
  timer: [F('text', 'title', 'Titel'), F('area', 'text', 'Text', { rows: 3 }), F('num', 'seconds', 'Sekunden', { min: 0 }), F('check', 'skippable', 'Sofort weiter erlaubt'), logicBlock('timer')],
  choice: [F('text', 'title', 'Titel'), F('area', 'text', 'Text', { rows: 3 }), F('media', 'image', 'Bild'), F('list', 'options', 'Wege', { item: [F('text', 'label', 'Beschriftung'), F('target', 'next', 'Weiter mit'), F('list', 'actions', 'Variablen ändern', { item: ACT_F, make: () => ({ var: 'score', op: 'add', value: 1 }), addLabel: '+ Aktion' })], make: () => ({ label: 'Neuer Weg', next: '', actions: [] }), addLabel: '+ Weg' }), logicBlock('choice')],
  jump: [F('text', 'title', 'Name (nur im Editor sichtbar)'), F('note', null, null, { text: 'Die erste Regel, die zutrifft, bestimmt das nächste Element. Trifft keine zu, geht es mit „Sonst weiter mit“ weiter.' }), F('list', 'rules', 'Regeln', { item: [F('var', 'var', 'Variable'), F('sel', 'op', 'Vergleich', { opts: OPT_OPS }), F('text', 'value', 'Wert'), F('target', 'target', 'Dann weiter mit')], make: () => ({ var: 'score', op: '>=', value: 10, target: '' }), addLabel: '+ Regel' }), logicBlock('jump')],
  action: [F('text', 'title', 'Name (nur im Editor sichtbar)'), F('note', null, null, { text: 'Dieses Element läuft unsichtbar ab. Es ändert Variablen oder vergibt Bonuspunkte und springt weiter.' }), F('list', 'actions', 'Aktionen', { item: ACT_F, make: () => ({ var: 'score', op: 'add', value: 10 }), addLabel: '+ Aktion' }), { k: 'details', label: 'Ablauf', fields: [F('list', 'cond', 'Nur ausführen, wenn …', { item: COND_F, make: () => ({ var: 'score', op: '>=', value: 0 }), addLabel: '+ Bedingung' }), F('target', 'next', 'Danach weiter mit')] }],
  end: [F('text', 'title', 'Titel'), F('area', 'text', 'Abschlusstext', { rows: 4 }), { k: 'details', label: 'Bedingung', fields: [F('list', 'cond', 'Nur anzeigen, wenn …', { item: COND_F, make: () => ({ var: 'score', op: '>=', value: 0 }), addLabel: '+ Bedingung' })] }]
};
const META_FORM = [
  F('text', 'title', 'Titel des Bounds'), F('area', 'description', 'Beschreibung (Startseite)', { rows: 4 }), F('text', 'author', 'Autor oder Gruppe'), F('media', 'cover', 'Titelbild'),
  F('check', 'askName', 'Spieler nach dem Namen fragen'), F('check', 'askTeam', 'Teamnamen abfragen'),
  F('row', null, null, { fields: [F('num', 'timeLimit', 'Zeitlimit (Minuten, 0 = keines)', { min: 0 }), F('text', 'lang', 'Sprachcode')] }),
  F('check', 'showScore', 'Punkte während des Spiels anzeigen'), F('check', 'showTimer', 'Uhr anzeigen'), F('check', 'leaderboard', 'Bestenliste auf dem Gerät führen'),
  F('area', 'finalText', 'Abschlusstext', { rows: 3, hint: 'Platzhalter: {name}, {team}, {score}, {max}' }),
  F('list', 'variables', 'Eigene Variablen', { item: [F('text', 'name', 'Name'), F('text', 'initial', 'Startwert')], make: () => ({ name: 'schluessel', initial: 0 }), addLabel: '+ Variable', hint: 'Nutze Variablen für Verzweigungen, Bedingungen und Boni. Namen ohne Leerzeichen.' })
];

/* ---------- Feldbau ---------- */
const wrap = (label, id, ctrl, hint) => h('div', { class: 'field' }, label && h('label', { class: 'lbl', for: id }, label), ctrl, hint && h('small', { class: 'hint' }, hint));
function renderFields(fields, obj, ctx) { return fields.filter(f => !f.if || f.if(obj)).map(f => fieldNode(f, obj, ctx)); }
function fieldNode(f, obj, ctx) {
  const id = nid(), set = (v) => { obj[f.key] = v; ctx.change(!!f.redraw); };
  switch (f.k) {
    case 'text': return wrap(f.label, id, h('input', { type: 'text', id, value: obj[f.key] == null ? '' : obj[f.key], placeholder: f.ph || '', oninput: e => set(e.target.value) }), f.hint);
    case 'var': return wrap(f.label, id, h('input', { type: 'text', id, list: 'varlist', value: obj[f.key] == null ? '' : obj[f.key], placeholder: 'score', oninput: e => set(e.target.value.trim()) }), f.hint);
    case 'area': return wrap(f.label, id, h('textarea', { id, rows: f.rows || 3, value: obj[f.key] || '', oninput: e => set(e.target.value) }), f.hint);
    case 'num': return wrap(f.label, id, h('input', { type: 'number', id, min: f.min, step: f.step || 1, value: obj[f.key] == null ? '' : obj[f.key], oninput: e => set(e.target.value === '' ? '' : Number(e.target.value)) }), f.hint);
    case 'check': return h('label', { class: 'chk-row' }, h('input', { type: 'checkbox', id, checked: !!obj[f.key], onchange: e => set(e.target.checked) }), f.label);
    case 'sel': return wrap(f.label, id, h('select', { id, onchange: e => set(e.target.value) }, f.opts.map(([v, l]) => h('option', { value: v, selected: String(obj[f.key]) === String(v) }, l))), f.hint);
    case 'target': return wrap(f.label, id, h('select', { id, onchange: e => set(e.target.value) }, targetOptions().filter(([v]) => v !== obj.id).map(([v, l]) => h('option', { value: v, selected: (obj[f.key] || '') === v }, l))), f.hint);
    case 'lines': {
      const ta = h('textarea', { id, rows: 4, value: (obj[f.key] || []).join('\n'), oninput: e => { obj[f.key] = e.target.value.split('\n'); ctx.change(false); }, onchange: e => { obj[f.key] = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); e.target.value = obj[f.key].join('\n'); ctx.change(false); } });
      return wrap(f.label, id, ta, f.hint);
    }
    case 'note': return h('p', { class: 'note' }, f.text);
    case 'row': return h('div', { class: 'frow' }, renderFields(f.fields, obj, ctx));
    case 'details': return h('details', { class: 'logic', open: false }, h('summary', {}, f.label), renderFields(f.fields, obj, ctx));
    case 'media': return mediaField(f, obj, ctx, id);
    case 'geo': return geoField(f, obj, ctx);
    case 'list': return listField(f, obj, ctx);
  }
  return h('span');
}
function listField(f, obj, ctx) {
  const arr = obj[f.key] || (obj[f.key] = []), box = h('div', { class: 'items' });
  const sub = { change: () => ctx.change(false) };
  const draw = () => {
    box.replaceChildren(...arr.map((it, i) => h('div', { class: 'item' },
      h('div', { class: 'item-fields' }, renderFields(f.item, it, sub)),
      h('div', { class: 'item-tools' },
        h('button', { type: 'button', title: 'nach oben', 'aria-label': 'nach oben', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; draw(); ctx.change(false); } }, '↑'),
        h('button', { type: 'button', title: 'nach unten', 'aria-label': 'nach unten', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; draw(); ctx.change(false); } }, '↓'),
        h('button', { type: 'button', title: 'entfernen', 'aria-label': 'entfernen', class: 'del', onclick: () => { arr.splice(i, 1); draw(); ctx.change(false); } }, '✕')))));
    if (!arr.length) box.append(h('p', { class: 'empty' }, 'Noch nichts angelegt.'));
  };
  draw();
  return h('div', { class: 'field list' }, h('div', { class: 'lbl' }, f.label), box,
    h('button', { class: 'btn sm', type: 'button', onclick: () => { arr.push(f.make()); draw(); ctx.change(false); } }, f.addLabel || '+ Hinzufügen'), f.hint && h('small', { class: 'hint' }, f.hint));
}
function mediaField(f, obj, ctx, id) {
  const v = obj[f.key] || '', emb = v.startsWith('data:');
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => { const fl = e.target.files[0]; if (!fl) return; try { obj[f.key] = await fileToDataURL(fl, 1280); ctx.change(true); } catch (x) { toast('Das Bild konnte nicht gelesen werden.'); } } });
  return wrap(f.label, id, h('div', { class: 'media' },
    v && /^(data:image|https?:)/.test(v) && h('img', { src: v, alt: '' }),
    h('input', { type: 'text', id, value: emb ? '' : v, placeholder: emb ? 'Eingebettetes Bild (' + Math.round(v.length * 0.75 / 1024) + ' KB)' : 'https://… oder Bild wählen', oninput: e => { obj[f.key] = e.target.value.trim(); ctx.change(false); } }),
    h('div', { class: 'row' }, file, h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, 'Bild wählen'), v && h('button', { class: 'btn sm', type: 'button', onclick: () => { obj[f.key] = ''; ctx.change(true); } }, 'Entfernen'))),
    'Gewählte Bilder werden verkleinert und direkt in der JSON-Datei gespeichert.');
}
function geoField(f, obj, ctx) {
  const lat = h('input', { type: 'number', id: nid(), step: 'any', value: obj.lat, 'aria-label': 'Breitengrad' }), lon = h('input', { type: 'number', id: nid(), step: 'any', value: obj.lon, 'aria-label': 'Längengrad' });
  const mapEl = h('div', { class: 'geo-map' }), q = h('input', { type: 'text', id: nid(), placeholder: 'Ort oder Adresse suchen', 'aria-label': 'Ort suchen' });
  let map = null;
  const sync = (center) => { if (!map) return; map.setTarget(Number(obj.lat), Number(obj.lon), Number(obj.radius) || 25); if (center) map.setView(Number(obj.lat), Number(obj.lon)); };
  const setPos = (la, lo, center) => { obj.lat = +Number(la).toFixed(6); obj.lon = +Number(lo).toFixed(6); lat.value = obj.lat; lon.value = obj.lon; sync(center); ctx.change(false); };
  lat.oninput = () => { obj.lat = lat.value === '' ? '' : Number(lat.value); sync(true); ctx.change(false); };
  lon.oninput = () => { obj.lon = lon.value === '' ? '' : Number(lon.value); sync(true); ctx.change(false); };
  setTimeout(() => { map = new SlippyMap(mapEl, { lat: Number(obj.lat) || 48.2, lon: Number(obj.lon) || 16.37, zoom: 16, onPick: (la, lo) => setPos(la, lo, false) }); App.geoMap = map; sync(false); }, 0);
  App.geoUpdate = () => sync(false);
  const search = async () => {
    if (!q.value.trim()) return;
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q.value.trim()), { headers: { 'Accept': 'application/json' } });
      const j = await r.json(); if (!j.length) { toast('Nichts gefunden.'); return; }
      setPos(j[0].lat, j[0].lon, true);
    } catch (e) { toast('Ortssuche hier nicht verfügbar. Klicke in die Karte oder gib Koordinaten ein.'); }
  };
  q.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  return h('div', { class: 'field geo' }, h('div', { class: 'lbl' }, f.label),
    h('div', { class: 'frow' }, h('label', { class: 'sublbl' }, 'Breite', lat), h('label', { class: 'sublbl' }, 'Länge', lon)),
    h('div', { class: 'row' }, q, h('button', { class: 'btn sm', type: 'button', onclick: search }, 'Suchen'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { if (!navigator.geolocation) return toast('Kein Standortzugriff in diesem Browser.'); navigator.geolocation.getCurrentPosition(p => setPos(p.coords.latitude, p.coords.longitude, true), () => toast('Standort nicht verfügbar. Klicke in die Karte.')); } }, 'Mein Standort')),
    mapEl, h('small', { class: 'hint' }, 'In die Karte klicken setzt das Ziel. Kacheln von OpenStreetMap laden nur, wenn die Seite Zugriff auf tile.openstreetmap.org hat.'));
}

/* ---------- Änderungen, Verlauf, Autosave ---------- */
let tHist, tPrev, tSave;
function commit(redraw, structural) {
  clearTimeout(tHist); tHist = setTimeout(pushHist, 450);
  clearTimeout(tSave); tSave = setTimeout(() => store.set('bw:draft', JSON.stringify(App.bound)), 400);
  clearTimeout(tPrev); tPrev = setTimeout(refreshPreview, 450);
  updateVarList(); renderTitle();
  if (structural) renderList(); else patchListItem();
  if (redraw) renderForm();
  renderProblems();
  if (App.geoUpdate) App.geoUpdate();
}
function pushHist() {
  const s = JSON.stringify(App.bound);
  if (App.hist[App.hi] === s) return;
  App.hist = App.hist.slice(0, App.hi + 1); App.hist.push(s); if (App.hist.length > 120) App.hist.shift(); App.hi = App.hist.length - 1; updateHistBtns();
}
function loadHist(i) {
  if (i < 0 || i >= App.hist.length) return; App.hi = i; App.bound = JSON.parse(App.hist[i]);
  if (App.sel !== 'meta' && !App.bound.elements.some(e => e.id === App.sel)) App.sel = 'meta';
  renderAll(); updateHistBtns(); store.set('bw:draft', JSON.stringify(App.bound));
}
function updateHistBtns() { ap.undo.disabled = App.hi <= 0; ap.redo.disabled = App.hi >= App.hist.length - 1; }
function setBound(b, selId, fresh) {
  if (!fresh) pushHist();            // aktuellen Stand sichern, damit Import/Beispiel/Neu rückgängig gemacht werden können
  App.bound = b; App.sel = selId || 'meta'; if (fresh) { App.hist = []; App.hi = -1; } pushHist(); renderAll();
  store.set('bw:draft', JSON.stringify(App.bound));
}
const curEl = () => App.bound.elements.find(e => e.id === App.sel);
function updateVarList() { ap.varlist.replaceChildren(...varNames(App.bound).map(v => h('option', { value: v }))); }

/* ---------- Rendering ---------- */
function renderAll() { renderTitle(); renderList(); renderForm(); renderProblems(); updateVarList(); refreshPreview(); applyPanel(); }
function renderTitle() { ap.title.value = App.bound.meta.title || ''; document.title = (App.bound.meta.title || 'Bound') + ' – Bound Werkstatt'; }
function problemMap() { const m = {}; findProblems(App.bound).forEach(p => { if (p.id) (m[p.id] = m[p.id] || []).push(p.msg); }); return m; }
function listItem(el, i, pm) {
  const li = h('li', { class: 'li' + (App.sel === el.id ? ' sel' : ''), draggable: true, 'data-id': el.id, tabindex: '0', role: 'button', 'aria-label': (i + 1) + '. ' + el.title },
    h('span', { class: 'li-ico t-' + el.type, 'aria-hidden': 'true' }, TYPE_DEFS[el.type].icon),
    h('span', { class: 'li-txt' }, h('b', {}, el.title || TYPE_DEFS[el.type].label), h('small', {}, TYPE_DEFS[el.type].label + (el.type === 'quiz' ? ' · ' + ({ single: 'Auswahl', multi: 'Mehrfach', text: 'Text', number: 'Zahl', sort: 'Sortieren', match: 'Zuordnen' }[el.sub] || '') : '') + (POINT_TYPES.has(el.type) ? ' · ' + (el.points || 0) + ' Pkt.' : ''))),
    (el.cond || []).length > 0 && h('span', { class: 'li-flag', title: 'Hat Bedingungen' }, '?'),
    pm[el.id] && h('span', { class: 'li-warn', title: pm[el.id].join('\n') }, '!'));
  li.addEventListener('click', () => selectEl(el.id));
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectEl(el.id); } });
  li.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.id); li.classList.add('drag'); });
  li.addEventListener('dragend', () => li.classList.remove('drag'));
  li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('over'); });
  li.addEventListener('dragleave', () => li.classList.remove('over'));
  li.addEventListener('drop', e => { e.preventDefault(); li.classList.remove('over'); moveTo(e.dataTransfer.getData('text/plain'), el.id); });
  return li;
}
function renderList() {
  const pm = problemMap();
  ap.meta.classList.toggle('sel', App.sel === 'meta');
  ap.list.replaceChildren(...App.bound.elements.map((el, i) => listItem(el, i, pm)));
  ap.count.textContent = App.bound.elements.length;
}
function patchListItem() {
  const el = curEl(); if (!el) return;
  const old = ap.list.querySelector('[data-id="' + el.id + '"]'); if (!old) return;
  old.replaceWith(listItem(el, App.bound.elements.indexOf(el), problemMap()));
}
function renderProblems() {
  const ps = findProblems(App.bound);
  ap.prob.hidden = !ps.length; ap.probN.textContent = ps.length;
  ap.probList.replaceChildren(...ps.map(p => { const el = App.bound.elements.find(e => e.id === p.id); return h('li', {}, h('button', { type: 'button', class: 'linklike', onclick: () => p.id && selectEl(p.id) }, (el ? (App.bound.elements.indexOf(el) + 1) + '. ' + el.title + ': ' : '') + p.msg)); }));
}
function renderForm() {
  const sc = ap.form.scrollTop;
  if (App.geoMap) { App.geoMap.destroy(); App.geoMap = null; } App.geoUpdate = null;
  const ctx = { change: redraw => commit(redraw, false) };
  const box = ap.form; box.replaceChildren();
  if (App.sel === 'meta') {
    box.append(h('div', { class: 'fhead' }, h('h2', {}, 'Bound-Einstellungen')), ...renderFields(META_FORM, App.bound.meta, ctx));
  } else {
    const el = curEl(); if (!el) { App.sel = 'meta'; return renderForm(); }
    const i = App.bound.elements.indexOf(el);
    box.append(h('div', { class: 'fhead' },
      h('div', {}, h('span', { class: 'kind t-' + el.type }, TYPE_DEFS[el.type].icon + ' ' + TYPE_DEFS[el.type].label), h('small', { class: 'muted' }, ' Element ' + (i + 1) + ' von ' + App.bound.elements.length)),
      h('div', { class: 'row tight' },
        h('button', { class: 'btn sm', type: 'button', disabled: i === 0, title: 'nach oben', onclick: () => moveBy(-1) }, '↑'),
        h('button', { class: 'btn sm', type: 'button', disabled: i === App.bound.elements.length - 1, title: 'nach unten', onclick: () => moveBy(1) }, '↓'),
        h('button', { class: 'btn sm', type: 'button', onclick: dupEl }, 'Duplizieren'),
        h('button', { class: 'btn sm danger', type: 'button', onclick: delEl }, 'Löschen'))),
      ...renderFields(FORMS[el.type], el, ctx));
  }
  box.scrollTop = sc;
}
function selectEl(id) {
  App.sel = id; renderList(); renderForm(); refreshPreview(); App.panel = 'edit'; applyPanel();
}

/* ---------- Elementoperationen ---------- */
function addEl(type) {
  const el = makeElement(type), els = App.bound.elements, i = App.sel === 'meta' ? els.length - 1 : els.indexOf(curEl());
  els.splice(i + 1, 0, el); App.sel = el.id; commit(false, true); renderForm(); refreshPreview();
  const row = ap.list.querySelector('[data-id="' + el.id + '"]'); if (row) row.scrollIntoView({ block: 'nearest' });
  App.panel = 'edit'; applyPanel(); pushHist();
}
function moveBy(d) {
  const els = App.bound.elements, i = els.indexOf(curEl()), j = i + d; if (j < 0 || j >= els.length) return;
  [els[i], els[j]] = [els[j], els[i]]; commit(false, true); renderForm(); pushHist();
}
function moveTo(fromId, toId) {
  if (fromId === toId) return; const els = App.bound.elements, a = els.findIndex(e => e.id === fromId), b = els.findIndex(e => e.id === toId); if (a < 0 || b < 0) return;
  const [m] = els.splice(a, 1); els.splice(b, 0, m); commit(false, true); renderForm(); pushHist();
}
function dupEl() {
  const el = curEl(), c = clone(el); c.id = uid(); c.title = (el.title || '') + ' (Kopie)';
  const els = App.bound.elements; els.splice(els.indexOf(el) + 1, 0, c); App.sel = c.id; commit(false, true); renderForm(); refreshPreview(); pushHist();
}
function delEl() {
  const el = curEl(), els = App.bound.elements, i = els.indexOf(el);
  els.splice(i, 1);
  // Verweise auf das gelöschte Element bereinigen
  const fix = o => { for (const k of ['next', 'nextRight', 'nextWrong', 'target']) if (o[k] === el.id) o[k] = ''; };
  els.forEach(e => { fix(e); (e.options || []).forEach(o => typeof o === 'object' && fix(o)); (e.rules || []).forEach(fix); });
  App.sel = els[Math.min(i, els.length - 1)] ? els[Math.min(i, els.length - 1)].id : 'meta';
  commit(false, true); renderForm(); refreshPreview(); pushHist(); toast('Element gelöscht. Mit Strg+Z holst du es zurück.');
}

/* ---------- Vorschau ---------- */
function refreshPreview() {
  if (App.player) { App.player.destroy(); App.player = null; }
  const startAt = App.previewFrom === 'sel' && App.sel !== 'meta' && curEl() ? App.sel : null;
  ap.phoneIn.replaceChildren();
  App.player = new Player(ap.phoneIn, App.bound, { preview: true, startAt });
  document.title = (App.bound.meta.title || 'Bound') + ' – Bound Werkstatt';
  ap.pvMode.textContent = App.previewFrom === 'sel' ? 'Ab Auswahl' : 'Von vorn';
}

const prettyJSON = () => JSON.stringify(App.bound, null, 2);

/* ---------- Dateien ---------- */
const fileName = () => slug(App.bound.meta.title);
function importText(text, name) {
  try {
    const { bound, warnings } = normalizeBound(JSON.parse(text));
    setBound(bound, 'meta'); toast('„' + (name || 'Datei') + '“ geladen' + (warnings.length ? ' (' + warnings.length + ' Hinweis(e))' : ''));
  } catch (e) { toast('Keine gültige Bound-Datei: ' + e.message); }
}
async function exportPlayer() {
  const src = window.__SRC || '', tag = '<script id="embedded-' + 'bound" type="application/json">', i = src.indexOf(tag), j = src.indexOf('</' + 'script>', i);
  if (i < 0 || j < 0) return toast('Export nicht möglich: Quelltext nicht gefunden.');
  const json = JSON.stringify(App.bound).replace(/</g, '\\u003c');
  await saveFile(fileName() + '.html', src.slice(0, i + tag.length) + json + src.slice(j), 'text/html');
}

/* ---------- Modal, QR-Druck ---------- */
function modal(title, body, buttons) {
  const root = $('#modal-root'), close = () => { root.replaceChildren(); document.body.classList.remove('print-qr'); };
  const dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'btn sm', type: 'button', onclick: close, 'aria-label': 'Schließen' }, '✕')), body,
    h('div', { class: 'row end' }, ...(buttons || []).map(b => h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: () => { if (b.fn) b.fn(close); if (!b.keep) close(); } }, b.label))));
  const back = h('div', { class: 'backdrop', onclick: e => { if (e.target === back) close(); } }, dlg);
  root.replaceChildren(back); const f = dlg.querySelector('button'); if (f) f.focus();
  return close;
}
function showQR() {
  const items = [];
  App.bound.elements.forEach(el => { if (el.type === 'code') (el.codes || []).filter(c => c.trim()).forEach(c => items.push({ title: el.title, code: c.trim() })); });
  if (!items.length) return modal('QR-Codes', h('p', {}, 'Es gibt noch kein Element vom Typ „Code finden“. Lege eines an und trage einen Code ein.'), [{ label: 'OK' }]);
  const cards = items.map(it => { let svg; try { svg = QR.svg(it.code, { margin: 2 }); } catch (e) { svg = '<p>Code zu lang</p>'; } return h('figure', { class: 'qr' }, h('div', { class: 'qr-svg', html: svg }), h('figcaption', {}, h('b', {}, it.title), h('code', {}, it.code), h('button', { class: 'btn sm no-print', type: 'button', onclick: () => saveFile('qr-' + slug(it.code) + '.svg', QR.svg(it.code, { margin: 4 }), 'image/svg+xml') }, 'SVG speichern'))); });
  modal('QR-Codes für „Code finden“', h('div', { class: 'qr-grid print-area' }, cards), [{ label: 'Drucken', cls: 'primary', keep: true, fn: () => { document.body.classList.add('print-qr'); try { window.print(); } catch (e) { toast('Drucken ist hier nicht möglich. Speichere die SVG-Dateien.'); } setTimeout(() => document.body.classList.remove('print-qr'), 800); } }, { label: 'Schließen' }]);
}
async function showLink() {
  const stored = store.get('bw:base'), here = /^https?:/.test(location.protocol) ? location.origin + location.pathname : '';
  const base = h('input', { type: 'text', id: 'lk-base', value: stored || here, placeholder: 'https://dein-name.github.io/bound-werkstatt/', autocomplete: 'off' });
  const out = h('textarea', { id: 'lk-out', rows: 6, readOnly: true, 'aria-label': 'Spiel-Link', onclick: e => e.target.select() });
  const info = h('p', { class: 'hint' });
  const qin = h('input', { type: 'text', id: 'lk-qr', autocomplete: 'off', placeholder: 'Kurze Adresse für den QR-Code' }), qbox = h('div', { class: 'qr-one' }), qinfo = h('small', { class: 'hint' });
  const drawQR = () => {
    const t = qin.value.trim(); qbox.replaceChildren(); qinfo.textContent = '';
    if (!t) { qinfo.textContent = 'Der Link ist zu lang für einen gut lesbaren QR-Code. Trage hier eine kurze Adresse ein, zum Beispiel die einer hochgeladenen Rallye-Datei.'; return; }
    try { qbox.innerHTML = QR.svg(t, { margin: 2 }); qbox.append(h('button', { class: 'btn sm', type: 'button', onclick: () => saveFile('spiel-qr.svg', QR.svg(t, { margin: 4 }), 'image/svg+xml') }, 'SVG speichern')); qinfo.textContent = t.length > 600 ? 'Sehr dichter Code. Zeige ihn groß am Bildschirm oder drucke ihn groß aus.' : 'Mit der Handy-Kamera scannen.'; }
    catch (x) { qinfo.textContent = x.message; }
  };
  qin.addEventListener('input', () => { qin.dataset.manual = '1'; drawQR(); });
  const upd = async () => {
    const b = base.value.trim().split('#')[0].split('?')[0]; store.set('bw:base', base.value.trim());
    out.value = b + '#spiel=' + await packBound(App.bound);
    const n = out.value.length, img = JSON.stringify(App.bound).includes('data:image');
    info.textContent = n.toLocaleString('de-AT') + ' Zeichen' + (n > 6000 ? '. Das ist lang und wird in manchen Chat-Apps abgeschnitten.' : '.') + (img ? ' Eingebettete Bilder machen den Link sehr lang. Nutze besser Bild-Links (https://…).' : '');
    if (!qin.dataset.manual) qin.value = n <= 1200 ? out.value : '';
    drawQR();
  };
  base.addEventListener('input', upd);
  modal('Spiel-Link', h('div', {},
    h('p', {}, 'Wer diesen Link öffnet, sieht nur das Spiel ohne Editor. Der ganze Bound steckt im Link, du musst nichts hochladen.'),
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'lk-base' }, 'Adresse deiner veröffentlichten Seite'), base, h('small', { class: 'hint' }, 'Der Link funktioniert für andere nur, wenn hier die Adresse einer öffentlichen Seite steht (zum Beispiel GitHub Pages). Kamera, GPS und Kompass brauchen außerdem HTTPS.')),
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'lk-out' }, 'Spiel-Link'), out, info),
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'lk-qr' }, 'QR-Code für diese Adresse'), qin, qbox, qinfo)),
    [{ label: 'Link kopieren', cls: 'primary', keep: true, fn: () => copyText(out.value) }, { label: 'Schließen' }]);
  upd();
}
function askConfirm(msg, yes) { modal('Bitte bestätigen', h('p', {}, msg), [{ label: 'Abbrechen' }, { label: 'Ja, fortfahren', cls: 'danger', fn: yes }]); }

/* ---------- Hinzufügen-Menü ---------- */
function buildAddMenu() {
  const cats = {}; Object.entries(TYPE_DEFS).forEach(([k, d]) => (cats[d.cat] = cats[d.cat] || []).push([k, d]));
  ap.addMenu.replaceChildren(...Object.entries(cats).map(([c, arr]) => h('div', { class: 'cat' }, h('div', { class: 'cat-t' }, c), arr.map(([k, d]) => h('button', { type: 'button', class: 'addit', onclick: () => { addEl(k); ap.addMenu.hidden = true; ap.addBtn.setAttribute('aria-expanded', 'false'); } }, h('span', { class: 'li-ico t-' + k, 'aria-hidden': 'true' }, d.icon), h('span', {}, h('b', {}, d.label), h('small', {}, d.desc)))))));
}
function applyPanel() { ap.app.dataset.panel = App.panel; ap.mtabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.p === App.panel))); }

/* ---------- Start ---------- */
function initEditor(initial) {
  Object.assign(ap, {
    app: $('#app'), title: $('#bound-title'), meta: $('#meta-item'), list: $('#el-list'), count: $('#el-count'), form: $('#form'), phoneIn: $('#phone-in'), pvMode: $('#pv-mode'), prob: $('#prob'), probN: $('#prob-n'), probList: $('#prob-list'), varlist: $('#varlist'),
    undo: $('#b-undo'), redo: $('#b-redo'), addBtn: $('#add-btn'), addMenu: $('#add-menu'), mtabs: $('#mtabs')
  });
  buildAddMenu();
  ap.title.addEventListener('input', () => { App.bound.meta.title = ap.title.value; commit(App.sel === 'meta', false); });
  ap.meta.addEventListener('click', () => { App.sel = 'meta'; renderList(); renderForm(); refreshPreview(); App.panel = 'edit'; applyPanel(); });
  ap.addBtn.addEventListener('click', () => { const open = ap.addMenu.hidden; ap.addMenu.hidden = !open; ap.addBtn.setAttribute('aria-expanded', String(open)); });
  document.addEventListener('click', e => { if (!e.target.closest('#add-wrap')) { ap.addMenu.hidden = true; ap.addBtn.setAttribute('aria-expanded', 'false'); } });
  ap.undo.onclick = () => { pushHist(); loadHist(App.hi - 1); }; ap.redo.onclick = () => loadHist(App.hi + 1);
  $('#b-new').onclick = () => askConfirm('Alles verwerfen und einen leeren Bound beginnen? Speichere vorher, falls du die Arbeit behalten willst.', () => { const b = blankBound(); b.elements.push(makeElement('info')); setBound(b, b.elements[0].id); });
  $('#b-sample').onclick = () => askConfirm('Das Beispiel ersetzt deinen aktuellen Bound. Fortfahren?', () => setBound(normalizeBound(sampleBound()).bound, 'meta'));
  const fileIn = $('#file-in'); $('#b-open').onclick = () => fileIn.click();
  fileIn.onchange = async () => { const f = fileIn.files[0]; if (f) importText(await f.text(), f.name); fileIn.value = ''; };
  $('#b-save').onclick = () => saveFile(fileName() + '.json', prettyJSON(), 'application/json');
  $('#b-copy').onclick = () => copyText(prettyJSON());
  $('#b-export').onclick = exportPlayer; $('#b-link').onclick = showLink; $('#b-qr').onclick = showQR;
  $('#pv-restart').onclick = refreshPreview; $('#pv-toggle').onclick = () => { App.previewFrom = App.previewFrom === 'sel' ? 'start' : 'sel'; refreshPreview(); };
  ap.mtabs.querySelectorAll('button').forEach(b => b.onclick = () => { App.panel = b.dataset.p; applyPanel(); });
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if ((e.ctrlKey || e.metaKey) && !typing) {
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ap.redo.click(); else ap.undo.click(); }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); ap.redo.click(); }
      else if (e.key.toLowerCase() === 's') { e.preventDefault(); $('#b-save').click(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && typing) { e.preventDefault(); $('#b-save').click(); }
  });
  window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', async e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) { e.preventDefault(); importText(await f.text(), f.name); } });
  setBound(initial, 'meta', true); updateHistBtns();
}
