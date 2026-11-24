/* ============================================================
   Player: spielt einen Bound im Browser (auch als Vorschau im Editor)
   ============================================================ */
class Player {
  constructor(root, bound, o) {
    this.root = root; this.bound = bound; this.o = o || {};
    this.g = new Game(bound); this.stops = []; this.tick = null; this.saved = false;
    this.key = 'bw:run:' + hashStr(bound.meta.title + '|' + bound.elements.map(e => e.id).join(','));
    this.hsKey = 'bw:hs:' + hashStr(bound.meta.title);
    root.replaceChildren(); root.classList.add('pl');
    this.score = h('span', { class: 'pl-score' }, '0 Pkt.');
    this.clock = h('span', { class: 'pl-clock' }, '0:00');
    this.endBtn = h('button', { type: 'button', class: 'pl-endbtn', onclick: () => this.askEnd() }, 'Beenden');
    this.bar = h('div', { class: 'pl-bar', hidden: true }, h('strong', { class: 'pl-name' }, bound.meta.title || 'Bound'), h('span', { class: 'pl-pills' }, this.score, this.clock), this.endBtn);
    this.prog = h('div', { class: 'pl-prog', hidden: true }, h('i'));
    this.body = h('div', { class: 'pl-body' });
    this.dbg = this.o.preview ? h('details', { class: 'pl-dbg' }, h('summary', {}, 'Testwerkzeuge'), h('div', { class: 'pl-dbg-in' })) : null;
    root.append(this.bar, this.prog, this.body); if (this.dbg) root.append(this.dbg);
    document.title = bound.meta.title || document.title;
    if (this.o.startAt) this.begin(this.o.startAt); else this.showStart();
  }
  destroy() { this.clearStops(); clearInterval(this.tick); }
  clearStops() { this.stops.forEach(f => { try { f(); } catch (e) { } }); this.stops = []; }

  /* ---------- Start ---------- */
  showStart() {
    this.clearStops(); clearInterval(this.tick); this.bar.hidden = true; this.prog.hidden = true;
    const m = this.bound.meta, n = this.bound.elements.filter(e => !AUTO_TYPES.has(e.type) && e.type !== 'end').length;
    const name = h('input', { type: 'text', id: 'pl-name-in', placeholder: 'Dein Name', autocomplete: 'nickname', value: this.nameMem || '' });
    const team = h('input', { type: 'text', id: 'pl-team-in', placeholder: 'Teamname (optional)', value: this.teamMem || '' });
    const saved = this.o.preview ? null : this.loadSaved();
    const go = () => { this.nameMem = name.value.trim(); this.teamMem = team.value.trim(); if (m.askName && !this.o.preview && !this.nameMem) { name.focus(); name.classList.add('bad'); return; } this.begin(); };
    this.body.replaceChildren(h('article', { class: 'pl-card pl-start' },
      m.cover && h('img', { class: 'pl-cover', alt: '', src: m.cover }),
      h('h1', {}, m.title || 'Bound'), m.author && h('p', { class: 'muted' }, 'von ' + m.author),
      h('div', { class: 'pl-md', html: md(m.description) }),
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, n + ' Stationen'), Number(m.timeLimit) > 0 && h('span', { class: 'chip' }, m.timeLimit + ' Min. Zeit'), m.showScore !== false && h('span', { class: 'chip' }, 'Punkte zählen')),
      m.askName && h('label', { class: 'fl', for: 'pl-name-in' }, 'Name', name),
      m.askTeam && h('label', { class: 'fl', for: 'pl-team-in' }, 'Team', team),
      h('div', { class: 'row' },
        saved && h('button', { class: 'btn primary', type: 'button', onclick: () => this.resume(saved) }, 'Fortsetzen'),
        h('button', { class: 'btn ' + (saved ? '' : 'primary'), type: 'button', onclick: () => { if (saved) store.del(this.key); go(); } }, saved ? 'Neu beginnen' : 'Los geht’s'))));
    this.updateDebug();
  }
  loadSaved() {
    const raw = store.get(this.key); if (!raw) return null;
    try { const s = JSON.parse(raw); return s && !s.finished && s.curId ? s : null; } catch (e) { return null; }
  }
  begin(fromId) {
    this.saved = false;
    this.g.start(this.nameMem || (this.o.preview ? 'Vorschau' : ''), this.teamMem, fromId);
    this.startClock(); this.afterStep();
  }
  resume(s) { this.g.restore(s); this.startClock(); this.afterStep(); }
  startClock() {
    clearInterval(this.tick); this.bar.hidden = false; this.prog.hidden = false;
    this.tick = setInterval(() => this.onTick(), 1000); this.onTick();
  }
  onTick() {
    const g = this.g; if (!g.startedAt || g.finished) return;
    const lim = Number(this.bound.meta.timeLimit) * 60000, el = Date.now() - g.startedAt;
    if (lim > 0) {
      this.clock.textContent = '⏱ ' + fmtTime(lim - el);
      if (el >= lim) { g.finish('time'); this.afterStep(); }
    } else this.clock.textContent = '⏱ ' + fmtTime(el);
  }
  askEnd() {
    if (this.endBtn.dataset.sure) { this.g.finish('abort'); this.afterStep(); return; }
    this.endBtn.dataset.sure = '1'; this.endBtn.textContent = 'Sicher?';
    setTimeout(() => { delete this.endBtn.dataset.sure; this.endBtn.textContent = 'Beenden'; }, 3000);
  }

  /* ---------- Ablauf ---------- */
  afterStep() {
    if (!this.o.preview) store.set(this.key, JSON.stringify(this.g.serialize()));
    if (this.g.finished) this.showResult(); else this.showElement();
  }
  next(res) { this.g.complete(res); this.afterStep(); }
  updateHeader() {
    const m = this.bound.meta, g = this.g;
    this.score.hidden = m.showScore === false; this.clock.hidden = m.showTimer === false && !(Number(m.timeLimit) > 0);
    this.score.textContent = g.vars.score + ' Pkt.';
    const total = this.bound.elements.length || 1, idx = g.finished ? total : Math.max(0, g.curIdx);
    this.prog.firstChild.style.width = Math.min(100, Math.round(idx / total * 100)) + '%';
  }
  updateDebug() {
    if (!this.dbg) return;
    const box = this.dbg.lastChild, g = this.g;
    box.replaceChildren(
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => { this.destroyRestart(); } }, '⟲ Neustart'),
        g.cur && h('button', { class: 'btn sm', type: 'button', onclick: () => this.next({ skipped: true, correct: null, points: 0 }) }, '⏭ Überspringen')),
      h('pre', {}, JSON.stringify(g.vars, null, 1).replace(/[{}\n]/g, ' ').replace(/ +/g, ' ').trim() || '–'));
  }
  destroyRestart() { this.clearStops(); this.g.reset(); store.del(this.key); this.showStart(); }

  media(el) {
    const out = [];
    const safe = u => /^(https?:|data:|blob:)/i.test(u || '');
    if (safe(el.image)) out.push(h('img', { class: 'pl-img', alt: '', src: el.image }));
    if (safe(el.audio)) out.push(h('audio', { class: 'pl-audio', controls: true, src: el.audio }));
    if (safe(el.video)) {
      const yt = String(el.video).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
      out.push(yt ? h('iframe', { class: 'pl-video', src: 'https://www.youtube-nocookie.com/embed/' + yt[1], title: 'Video', allowfullscreen: '', loading: 'lazy' })
        : h('video', { class: 'pl-video', controls: true, src: el.video, playsinline: '' }));
    }
    return out;
  }
  showElement() {
    this.clearStops();
    const el = this.g.cur; this.updateHeader(); this.updateDebug();
    const card = h('article', { class: 'pl-card pl-' + el.type });
    const showTitle = el.title && !['jump', 'action'].includes(el.type);
    card.append(
      h('div', { class: 'pl-kind' }, TYPE_DEFS[el.type].label),
      showTitle && h('h2', {}, el.title), this.media(el),
      el.text && h('div', { class: 'pl-md', html: md(el.text) }));
    this['r_' + el.type](el, card);
    this.body.replaceChildren(card); this.body.scrollTop = 0;
  }
  btn(label, fn, cls) { return h('button', { type: 'button', class: 'btn ' + (cls === undefined ? 'primary' : cls), onclick: fn }, label); }
  fb(kind, text, pts) {
    return h('div', { class: 'pl-fb ' + kind, role: 'status' }, h('div', { html: md(text) }), pts > 0 && h('span', { class: 'chip pts' }, '+' + pts + ' Punkte'));
  }

  /* ---------- Elementtypen ---------- */
  r_info(el, card) { card.append(h('div', { class: 'row' }, this.btn(el.buttonLabel || 'Weiter', () => this.next({})))); }

  r_end() { }
  r_jump() { }
  r_action() { }

  quizInput(el) {
    let locked = false;
    const idx = (el.options || []).map((_, i) => i);
    const order = el.shuffle ? shuffle(idx) : idx;
    if (el.sub === 'single' || el.sub === 'multi') {
      const multi = el.sub === 'multi', on = new Set();
      const rows = order.map(i => {
        const b = h('button', { type: 'button', class: 'opt ' + (multi ? 'chk' : 'rad'), 'aria-pressed': 'false' }, h('span', { class: 'mk' }), h('span', {}, el.options[i].text));
        b.onclick = () => {
          if (locked) return;
          if (multi) { on.has(i) ? on.delete(i) : on.add(i); } else { on.clear(); on.add(i); }
          rows.forEach(r => { const s = on.has(r.i); r.b.classList.toggle('on', s); r.b.setAttribute('aria-pressed', String(s)); });
        };
        return { b, i };
      });
      return {
        node: h('div', { class: 'opts' }, rows.map(r => r.b)),
        valid: () => on.size > 0, get: () => multi ? [...on].sort((a, b) => a - b) : [...on][0],
        lock: () => { locked = true; rows.forEach(r => { const c = el.options[r.i].correct; r.b.classList.toggle('right', !!c); r.b.classList.toggle('wrong', !c && on.has(r.i)); }); }
      };
    }
    if (el.sub === 'text' || el.sub === 'number') {
      const inp = h('input', { type: 'text', id: 'q-in', class: 'big', placeholder: el.sub === 'number' ? 'Zahl eingeben' : 'Antwort eingeben', inputMode: el.sub === 'number' ? 'decimal' : 'text', autocomplete: 'off' });
      return { node: inp, valid: () => inp.value.trim() !== '', get: () => inp.value, lock: () => { inp.readOnly = true; }, onEnter: fn => inp.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); }) };
    }
    if (el.sub === 'sort') {
      let ord = idx.map((_, i) => i).slice(0, (el.items || []).length);
      for (let t = 0; t < 8 && ord.length > 1 && ord.every((v, i) => v === i); t++) ord = shuffle(ord);
      const box = h('ol', { class: 'sort' });
      const draw = () => box.replaceChildren(...ord.map((o, p) => h('li', {},
        h('span', {}, el.items[o]),
        h('span', { class: 'mv' },
          h('button', { type: 'button', 'aria-label': 'nach oben', disabled: locked || p === 0, onclick: () => { [ord[p - 1], ord[p]] = [ord[p], ord[p - 1]]; draw(); } }, '↑'),
          h('button', { type: 'button', 'aria-label': 'nach unten', disabled: locked || p === ord.length - 1, onclick: () => { [ord[p + 1], ord[p]] = [ord[p], ord[p + 1]]; draw(); } }, '↓')))));
      draw();
      return { node: box, valid: () => true, get: () => ord.slice(), lock: () => { locked = true; draw(); [...box.children].forEach((li, p) => li.classList.add(ord[p] === p ? 'right' : 'wrong')); } };
    }
    if (el.sub === 'match') {
      const rights = shuffle((el.pairs || []).map((p, i) => i)), sels = [];
      const node = h('div', { class: 'match' }, (el.pairs || []).map((p, i) => {
        const s = h('select', { id: 'm-' + i, 'aria-label': p.l }, h('option', { value: '' }, '– wählen –'), rights.map(r => h('option', { value: r }, el.pairs[r].r)));
        sels.push(s);
        return h('label', { for: 'm-' + i }, h('span', {}, p.l), s);
      }));
      return { node, valid: () => sels.every(s => s.value !== ''), get: () => sels.map(s => Number(s.value)), lock: () => sels.forEach((s, i) => { s.disabled = true; s.parentNode.classList.add(Number(s.value) === i ? 'right' : 'wrong'); }) };
    }
    return { node: h('p', {}, '?'), valid: () => false, get: () => null, lock() { } };
  }
  r_quiz(el, card) {
    const max = Number(el.points) || 0, attempts = Math.max(1, Number(el.attempts) || 1);
    let wrong = 0, hints = 0, done = false, timerId = null;
    const inp = this.quizInput(el), fb = h('div'), hintBox = h('div'), msg = h('div', { class: 'pl-hintmsg', hidden: true });
    const checkBtn = this.btn('Antwort prüfen', () => submit());
    const row = h('div', { class: 'row' });
    const hintBtn = el.hint ? this.btn('Hinweis' + (Number(el.hintCost) > 0 && max ? ' (−' + el.hintCost + ' Pkt.)' : ''), () => { hints = 1; hintBox.replaceChildren(this.fb('info', el.hint)); hintBtn.remove(); }, '') : null;
    const finish = (ok, ans) => {
      if (done) return; done = true; clearInterval(timerId); inp.lock();
      const pts = ok ? Math.max(0, Math.round(max * (1 - wrong * (Number(el.penalty) || 0) / 100)) - hints * (Number(el.hintCost) || 0)) : 0;
      let text = ok ? (el.feedbackRight || 'Richtig!') : (el.feedbackWrong || 'Leider falsch.');
      if (!ok) text += '\n\n**Richtig wäre:** ' + solutionText(el);
      if (el.explain) text += '\n\n' + el.explain;
      fb.replaceChildren(this.fb(ok ? 'ok' : 'bad', text, pts)); hintBox.replaceChildren();
      row.replaceChildren(this.btn('Weiter', () => this.next({ points: pts, max, correct: ok, answer: ans, next: ok ? el.nextRight : el.nextWrong })));
    };
    const submit = () => {
      if (done) return;
      if (!inp.valid()) { fb.replaceChildren(this.fb('info', el.sub === 'match' ? 'Bitte ordne alles zu.' : 'Bitte gib zuerst eine Antwort.')); return; }
      const ans = inp.get(), ok = checkQuiz(el, ans);
      if (ok) return finish(true, ans);
      wrong++;
      if (wrong >= attempts) return finish(false, ans);
      fb.replaceChildren(this.fb('bad', (el.feedbackWrong || 'Leider falsch.') + '\n\nNoch ' + (attempts - wrong) + (attempts - wrong === 1 ? ' Versuch.' : ' Versuche.')));
    };
    if (inp.onEnter) inp.onEnter(submit);
    row.append(...[hintBtn, checkBtn].filter(Boolean));
    card.append(inp.node);
    if (Number(el.timeLimit) > 0) {
      const bar = h('div', { class: 'qtimer' }, h('i')), t0 = Date.now(), lim = Number(el.timeLimit) * 1000;
      card.append(bar);
      timerId = setInterval(() => {
        const left = lim - (Date.now() - t0); bar.firstChild.style.width = Math.max(0, left / lim * 100) + '%';
        if (left <= 0) finish(false, inp.valid() ? inp.get() : null);
      }, 200);
      this.stops.push(() => clearInterval(timerId));
    }
    card.append(hintBox, fb, row);
  }

  r_survey(el, card) {
    let val = el.sub === 'multi' ? [] : null;
    const row = h('div', { class: 'row' }), go = this.btn('Weiter', () => this.next({ answer: val, correct: null }));
    const upd = () => { go.disabled = !!el.required && (el.sub === 'multi' ? !val.length : (val == null || val === '')); };
    let node;
    if (el.sub === 'text') {
      node = h('textarea', { rows: 4, id: 's-text', placeholder: 'Deine Antwort', oninput: e => { val = e.target.value.trim(); upd(); } });
    } else if (el.sub === 'rating') {
      const bs = [1, 2, 3, 4, 5].map(n => h('button', { type: 'button', class: 'star', 'aria-label': n + ' von 5', onclick: () => { val = n; bs.forEach((b, i) => b.classList.toggle('on', i < n)); upd(); } }, '★'));
      node = h('div', { class: 'stars' }, bs);
    } else {
      const multi = el.sub === 'multi';
      const bs = (el.options || []).map((o, i) => {
        const b = h('button', { type: 'button', class: 'opt ' + (multi ? 'chk' : 'rad'), 'aria-pressed': 'false' }, h('span', { class: 'mk' }), h('span', {}, o));
        b.onclick = () => {
          if (multi) { val = val.includes(o) ? val.filter(x => x !== o) : val.concat(o); } else val = o;
          bs.forEach((x, j) => { const on = multi ? val.includes(el.options[j]) : val === el.options[j]; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
          upd();
        };
        return b;
      });
      node = h('div', { class: 'opts' }, bs);
    }
    upd(); row.append(go); card.append(node, row);
  }

  r_mission(el, card) {
    const max = Number(el.points) || 0; let data = null;
    const prev = h('div', { class: 'mprev' }), row = h('div', { class: 'row' });
    const go = this.btn('Abgeben', () => this.next({ points: max, max, correct: null, answer: data })); go.disabled = true;
    const set = (v, node) => { data = v; prev.replaceChildren(node || ''); go.disabled = !data; };
    if (el.kind === 'text') {
      card.append(h('textarea', { rows: 5, id: 'm-text', placeholder: 'Deine Antwort', oninput: e => set(e.target.value.trim() || null) }));
    } else {
      const accept = { photo: 'image/*', video: 'video/*', audio: 'audio/*', file: '*/*' }[el.kind] || '*/*';
      const inp = h('input', { type: 'file', accept, id: 'm-file', hidden: true });
      if (el.kind === 'photo') inp.setAttribute('capture', 'environment'); if (el.kind === 'video') inp.setAttribute('capture', 'environment'); if (el.kind === 'audio') inp.setAttribute('capture', 'user');
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          if (el.kind === 'photo') { const u = await fileToDataURL(f, 1024); set(u, h('img', { src: u, alt: 'Dein Foto' })); }
          else { const u = URL.createObjectURL(f); this.stops.push(() => URL.revokeObjectURL(u)); set('[' + f.name + ', ' + Math.round(f.size / 1024) + ' KB]', el.kind === 'video' ? h('video', { src: u, controls: true, playsinline: '' }) : el.kind === 'audio' ? h('audio', { src: u, controls: true }) : h('p', {}, f.name)); }
        } catch (e) { set(null, h('p', { class: 'muted' }, 'Datei konnte nicht gelesen werden.')); }
      };
      const label = { photo: 'Foto aufnehmen oder wählen', video: 'Video aufnehmen oder wählen', audio: 'Audio aufnehmen oder wählen', file: 'Datei wählen' }[el.kind] || 'Datei wählen';
      card.append(inp, h('div', { class: 'row' }, this.btn(label, () => inp.click(), '')));
    }
    if (el.optional) row.append(this.btn('Überspringen', () => this.next({ points: 0, max, correct: null, skipped: true }), ''));
    row.append(go); card.append(prev, row);
  }

  r_code(el, card) {
    const max = Number(el.points) || 0, codes = (el.codes || []).map(c => c.trim().toLowerCase()).filter(Boolean);
    const inp = h('input', { type: 'text', id: 'c-in', class: 'big', placeholder: 'Code eingeben', autocomplete: 'off' });
    const fb = h('div'), row = h('div', { class: 'row' }), scanBox = h('div', { class: 'scan', hidden: true });
    let wrong = 0, done = false;
    const verify = v => {
      if (done) return; v = String(v).trim().toLowerCase();
      if (codes.includes(v)) {
        done = true; this.clearStops(); scanBox.hidden = true; inp.readOnly = true;
        const pts = Math.max(0, max - wrong * Math.round(max / 4));
        fb.replaceChildren(this.fb('ok', 'Code gefunden!', pts));
        row.replaceChildren(this.btn('Weiter', () => this.next({ points: pts, max, correct: true, answer: v })));
      } else { wrong++; fb.replaceChildren(this.fb('bad', 'Dieser Code passt nicht. Versuch es noch einmal.')); }
    };
    const hintBtn = el.hint ? this.btn('Hinweis', () => { fb.replaceChildren(this.fb('info', el.hint)); hintBtn.remove(); }, '') : null;
    const hasDet = 'BarcodeDetector' in window;
    const scanBtn = el.scan && hasDet ? this.btn('QR-Code scannen', () => this.scan(scanBox, verify), '') : null;
    // Ausweichlösung ohne Live-Kamera: Foto aufnehmen und auswerten (funktioniert auch in eingebetteten Ansichten)
    const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, id: 'c-photo' }); photoIn.setAttribute('capture', 'environment');
    photoIn.onchange = async () => {
      const f = photoIn.files[0]; photoIn.value = ''; if (!f) return;
      try { const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(await createImageBitmap(f)); if (r[0]) verify(r[0].rawValue); else fb.replaceChildren(this.fb('info', 'Im Foto wurde kein QR-Code erkannt. Geh näher ran oder tippe den Code ein.')); }
      catch (e) { fb.replaceChildren(this.fb('info', 'Das Foto konnte nicht ausgewertet werden. Tippe den Code ein.')); }
    };
    const photoBtn = el.scan && hasDet ? this.btn('QR-Code fotografieren', () => photoIn.click(), '') : null;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') verify(inp.value); });
    row.append(...[scanBtn, photoBtn, hintBtn, el.allowSkip && this.btn('Überspringen', () => this.next({ points: 0, max, correct: false, skipped: true }), ''), this.btn('Code prüfen', () => verify(inp.value))].filter(Boolean));
    card.append(inp, photoIn, scanBox, fb, row);
    if (el.scan && !('BarcodeDetector' in window)) card.append(h('p', { class: 'muted small' }, 'Dieser Browser kann keine QR-Codes lesen (Chrome auf Android kann es). Tippe den Code ein.'));
  }
  async scan(box, onCode) {
    box.hidden = false; box.replaceChildren(h('p', { class: 'muted' }, 'Kamera wird gestartet …'));
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = h('video', { playsinline: '', muted: true }); v.srcObject = stream; await v.play();
      box.replaceChildren(v, this.btn('Kamera schließen', () => { this.clearStops(); box.hidden = true; }, 'sm'));
      let alive = true; this.stops.push(() => { alive = false; stream.getTracks().forEach(t => t.stop()); });
      const loop = async () => {
        if (!alive) return;
        try { const r = await det.detect(v); if (r[0]) { onCode(r[0].rawValue); if (!alive) return; } } catch (e) { }
        setTimeout(loop, 250);
      };
      loop();
    } catch (e) { box.replaceChildren(h('p', { class: 'muted' }, 'Das Live-Kamerabild ist hier nicht verfügbar. Es geht nur auf Seiten mit HTTPS und nicht in eingebetteten Ansichten oder lokalen Dateien. Nutze „QR-Code fotografieren“ oder tippe den Code ein.')); }
  }

  r_location(el, card) {
    const tlat = Number(el.lat), tlon = Number(el.lon), rad = Math.max(5, Number(el.radius) || 25), max = Number(el.points) || 0;
    const status = h('div', { class: 'loc-status', role: 'status' }, 'Standort wird ermittelt …');
    const arrow = h('div', { class: 'compass', html: '<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="46" class="ring"/><text y="-33" text-anchor="middle" class="n">N</text><g class="arw"><path d="M0 -26 L14 14 L0 6 L-14 14 Z"/></g></svg>' });
    const arw = arrow.querySelector('.arw'), row = h('div', { class: 'row' }), fb = h('div');
    let map = null, heading = null, last = null, done = false, bestD = null;
    if (el.showMap !== false) { const box = h('div', { class: 'pl-map' }); card.append(box); setTimeout(() => { map = new SlippyMap(box, { lat: tlat, lon: tlon, zoom: 17 }); map.setTarget(tlat, tlon, rad); if (last) { map.setUser(last[0], last[1], last[2]); map.fit(); } this.stops.push(() => map && map.destroy()); }, 0); }
    card.append(arrow, status, fb, row);
    const reach = () => {
      if (done) return; done = true; this.clearStops();
      status.textContent = ''; arrow.hidden = true;
      fb.replaceChildren(this.fb('ok', 'Du bist am Ziel!', max));
      row.replaceChildren(this.btn('Weiter', () => this.next({ points: max, max, correct: true, answer: last ? { lat: last[0], lon: last[1] } : null })));
    };
    const update = (lat, lon, acc) => {
      if (done) return; last = [lat, lon, acc];
      const d = haversine(lat, lon, tlat, tlon), b = bearing(lat, lon, tlat, tlon);
      arw.setAttribute('transform', 'rotate(' + Math.round(b - (heading || 0)) + ')');
      if (!done) status.textContent = (el.showDistance !== false ? 'Noch ' + fmtDist(d) + '. ' : '') + (acc ? 'Genauigkeit ±' + Math.round(acc) + ' m.' : '') + (heading == null ? ' Pfeil zeigt nach Norden.' : '');
      if (map) { map.setUser(lat, lon, acc); if (bestD == null) map.fit(); } bestD = d;
      if (d <= rad) reach();
    };
    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(p => update(p.coords.latitude, p.coords.longitude, p.coords.accuracy), err => { if (!done) status.textContent = 'Kein Standortzugriff (' + (err.message || 'abgelehnt') + '). Erlaube den Zugriff im Browser.'; }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
      this.stops.push(() => navigator.geolocation.clearWatch(id));
    } else status.textContent = 'Dieser Browser bietet keinen Standortzugriff.';
    const onOri = e => { const hd = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null); if (hd != null) { heading = hd; if (last && !done) update(last[0], last[1], last[2]); } };
    const needPerm = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    const attach = () => { window.addEventListener('deviceorientationabsolute', onOri, true); window.addEventListener('deviceorientation', onOri, true); this.stops.push(() => { window.removeEventListener('deviceorientationabsolute', onOri, true); window.removeEventListener('deviceorientation', onOri, true); }); };
    if (needPerm) row.append(this.btn('Kompass aktivieren', async () => { try { if (await DeviceOrientationEvent.requestPermission() === 'granted') attach(); } catch (e) { } }, ''));
    else attach();
    if (el.allowSkip) row.append(this.btn('Ich bin da (ohne GPS)', () => { this.clearStops(); this.next({ points: 0, max, correct: false, skipped: true }); }, ''));
    if (this.o.preview) row.append(this.btn('Test: 40 m entfernt', () => { const p = offsetPoint(tlat, tlon, rad + 40, 200); update(p[0], p[1], 8); }, 'sm'), this.btn('Test: am Ziel', () => update(tlat, tlon, 5), 'sm'));
  }

  r_timer(el, card) {
    const total = Math.max(0, Number(el.seconds) || 0); let left = total;
    const big = h('div', { class: 'bigtime', role: 'timer' }, fmtTime(left * 1000)), go = this.btn('Weiter', () => this.next({})); go.disabled = !el.skippable && left > 0;
    const id = setInterval(() => { left--; big.textContent = fmtTime(Math.max(0, left) * 1000); if (left <= 0) { clearInterval(id); go.disabled = false; } }, 1000);
    this.stops.push(() => clearInterval(id));
    card.append(big, h('div', { class: 'row' }, go));
  }
  r_choice(el, card) {
    card.append(h('div', { class: 'opts' }, (el.options || []).map(o => h('button', { type: 'button', class: 'opt go', onclick: () => { applyActions(o.actions, this.g.vars); this.next({ answer: o.label, next: o.next }); } }, h('span', {}, o.label)))));
  }

  /* ---------- Ergebnis ---------- */
  showResult() {
    this.clearStops(); clearInterval(this.tick); this.updateHeader(); this.updateDebug();
    const g = this.g, m = this.bound.meta, r = g.results();
    this.bar.hidden = true; this.prog.hidden = true;
    const reason = g.finishReason;
    const fill = s => String(s || '').replace(/\{name\}/g, g.name || 'Spieler').replace(/\{score\}/g, g.vars.score).replace(/\{max\}/g, g.maxPts).replace(/\{team\}/g, g.team);
    let board = null;
    if (!this.o.preview) {
      let list = []; try { list = JSON.parse(store.get(this.hsKey) || '[]'); } catch (e) { }
      if (!this.saved) { this.saved = true; list.push({ name: g.name || 'Spieler', team: g.team, score: g.vars.score, sec: r.durationSec, at: r.finishedAt }); list.sort((a, b) => b.score - a.score || a.sec - b.sec); list = list.slice(0, 10); store.set(this.hsKey, JSON.stringify(list)); }
      if (m.leaderboard !== false && list.length) board = h('details', { class: 'pl-board' }, h('summary', {}, 'Bestenliste (nur auf diesem Gerät)'), h('ol', {}, list.map(x => h('li', {}, h('span', {}, (x.name || 'Spieler') + (x.team ? ' · ' + x.team : '')), h('b', {}, x.score + ' Pkt.'), h('i', {}, fmtTime(x.sec * 1000))))));
    }
    const cert = h('div', { class: 'cert', hidden: true },
      h('div', { class: 'cert-in' }, h('small', {}, 'URKUNDE'), h('h2', {}, g.name || 'Spieler'), h('p', {}, 'hat den Bound ' + (m.title || '') + ' abgeschlossen'), h('p', { class: 'cert-score' }, g.vars.score + ' Punkte'), h('p', { class: 'muted' }, new Date(r.finishedAt).toLocaleDateString('de-AT') + ' · ' + fmtTime(g.duration)),
        h('button', { class: 'btn no-print', type: 'button', onclick: () => { document.body.classList.add('print-cert'); try { window.print(); } catch (e) { toast('Drucken ist in dieser Ansicht nicht möglich.'); } setTimeout(() => document.body.classList.remove('print-cert'), 800); } }, 'Drucken')));
    this.body.replaceChildren(h('article', { class: 'pl-card pl-result' },
      h('div', { class: 'pl-kind' }, reason === 'time' ? 'Zeit abgelaufen' : reason === 'abort' ? 'Vorzeitig beendet' : 'Geschafft'),
      h('h2', {}, g.name ? 'Gut gemacht, ' + g.name + '!' : 'Gut gemacht!'),
      m.showScore !== false && h('div', { class: 'bigscore' }, h('b', {}, g.vars.score), h('span', {}, ' von ' + g.maxPts + ' möglichen Punkten')),
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, 'Zeit ' + fmtTime(g.duration)), h('span', { class: 'chip' }, g.vars.correct + ' richtig'), h('span', { class: 'chip' }, g.vars.wrong + ' falsch')),
      h('div', { class: 'pl-md', html: md(fill(m.finalText)) }), g.endText && h('div', { class: 'pl-md', html: md(fill(g.endText)) }),
      h('table', { class: 'res' }, h('tbody', {}, g.log.map(l => h('tr', {}, h('td', { class: 'mk-' + (l.correct === true ? 'ok' : l.correct === false ? 'bad' : 'n') }, l.correct === true ? '✓' : l.correct === false ? '✗' : '•'), h('td', {}, l.title), h('td', { class: 'num' }, l.max ? l.points + '/' + l.max : ''))))),
      board, cert,
      h('div', { class: 'row' },
        this.btn('Urkunde', () => { cert.hidden = !cert.hidden; }, ''),
        this.btn('Ergebnis speichern', () => saveFile(slug(m.title) + '-ergebnis.json', JSON.stringify(r, null, 2), 'application/json'), ''),
        this.btn('Nochmal spielen', () => { store.del(this.key); this.g.reset(); this.saved = false; this.showStart(); }))));
    this.body.scrollTop = 0;
  }
}
