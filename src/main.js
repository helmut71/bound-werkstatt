/* ============================================================
   Beispiel-Bound und Start
   ============================================================ */
function sampleBound() {
  const b = blankBound();
  b.meta.title = 'Rätselrallye Stadtpark';
  b.meta.author = 'Beispiel-Gruppe';
  b.meta.description = 'Eine kurze Rallye mit **Quiz, QR-Code, GPS, Verzweigung und Bonuspunkten**. Bearbeite sie links, spiele sie rechts.\n\n- ca. 20 Minuten\n- Bring ein Smartphone mit';
  b.meta.timeLimit = 0;
  b.meta.variables = [{ name: 'weg', initial: 0 }, { name: 'fotos', initial: 0 }];
  const E = (type, id, o) => Object.assign(makeElement(type), { id }, o);
  b.elements = [
    E('info', 'start', { title: 'Willkommen', text: 'Schön, dass du dabei bist!\n\nDu sammelst unterwegs **Punkte**. Schnelle und richtige Antworten bringen die meisten.', buttonLabel: 'Los geht’s' }),
    E('quiz', 'q-fluss', { title: 'Welcher Fluss fließt unter dem Park?', sub: 'single', text: 'Der Wiener Stadtpark liegt an einem kleinen Fluss. Wie heißt er?', options: [{ text: 'Donau', correct: false }, { text: 'Wienfluss', correct: true }, { text: 'Alte Donau', correct: false }], points: 10, attempts: 2, hint: 'Der Name steckt im Namen der Stadt.', hintCost: 3, explain: 'Der Wienfluss ist rund 34 km lang.' }),
    E('quiz', 'q-text', { title: 'Wer steht in Gold?', sub: 'text', text: 'Im Park steht ein vergoldetes Denkmal eines berühmten Walzerkönigs. Wie ist sein Nachname?', answers: ['Strauss', 'Strauß'], points: 15, attempts: 3, penalty: 30 }),
    E('code', 'c-park', { title: 'Station am Eingang', text: 'Such den QR-Code am Eingang. Scanne ihn oder tippe den Code darunter ein.', codes: ['PARK1'], scan: true, points: 10, hint: 'Er hängt am Tor, auf Augenhöhe.', allowSkip: true }),
    E('location', 'l-denkmal', { title: 'Finde das Denkmal', text: 'Geh dem Pfeil nach. Wenn du nah genug bist, geht es automatisch weiter.', lat: 48.2045, lon: 16.3805, radius: 40, points: 15, allowSkip: true }),
    E('choice', 'w-choice', { title: 'Welchen Weg nimmst du?', text: 'Zwei Aufgaben stehen zur Wahl.', options: [{ label: 'Der ruhige Weg (Natur)', next: 'w-a', actions: [{ var: 'weg', op: 'set', value: 1 }] }, { label: 'Der sportliche Weg (Bewegung)', next: 'w-b', actions: [{ var: 'weg', op: 'set', value: 2 }] }] }),
    E('mission', 'w-a', { title: 'Der schönste Baum', text: 'Fotografiere einen Baum, der dir gefällt.', kind: 'photo', points: 10, next: 'q-sort', actions: [{ var: 'fotos', op: 'add', value: 1 }] }),
    E('timer', 'w-b', { title: '20 Sekunden Bewegung', text: 'Mach 10 Kniebeugen. Der Timer läuft.', seconds: 20, skippable: false }),
    E('quiz', 'q-sort', { title: 'Wasserkreislauf', sub: 'sort', text: 'Bring die Schritte in die richtige Reihenfolge.', items: ['Verdunstung', 'Wolkenbildung', 'Regen', 'Versickerung'], points: 15, attempts: 2 }),
    E('quiz', 'q-match', { title: 'Hauptstädte', sub: 'match', text: 'Ordne jede Stadt dem Land zu.', pairs: [{ l: 'Wien', r: 'Österreich' }, { l: 'Bern', r: 'Schweiz' }, { l: 'Berlin', r: 'Deutschland' }], points: 15 }),
    E('quiz', 'q-num', { title: 'Wie viele Beine hat eine Spinne?', sub: 'number', value: 8, tolerance: 0, points: 5, attempts: 1 }),
    E('survey', 's-1', { title: 'Wie hat es dir gefallen?', sub: 'rating', text: 'Gib uns bis zu fünf Sterne.', required: false }),
    E('jump', 'j-bonus', { title: 'Bonus ab 40 Punkten?', rules: [{ var: 'score', op: '>=', value: 40, target: 'a-bonus' }], next: 'fin' }),
    E('action', 'a-bonus', { title: 'Bonus gutschreiben', actions: [{ var: 'score', op: 'add', value: 10 }] }),
    E('info', 'i-bonus', { title: 'Bonus!', text: 'Du hattest mindestens 40 Punkte und bekommst **10 Extra-Punkte**.' }),
    E('end', 'fin', { title: 'Ende', text: 'Danke für deine Teilnahme. Bis zum nächsten Mal!' })
  ];
  return b;
}

(function main() {
  const emb = document.getElementById('embedded-' + 'bound');
  let embedded = null;
  try { const t = emb && emb.textContent.trim(); if (t && t !== 'null') embedded = JSON.parse(t); } catch (e) { }
  const editMode = !embedded || location.hash === '#edit';
  if (!editMode) {
    $('#app').hidden = true; const root = $('#player-root'); root.hidden = false;
    document.body.classList.add('player-only');
    new Player(root, normalizeBound(embedded).bound, { preview: false });
    return;
  }
  let initial = null;
  if (embedded) initial = normalizeBound(embedded).bound;
  else {
    const raw = store.get('bw:draft');
    if (raw) { try { initial = normalizeBound(JSON.parse(raw)).bound; } catch (e) { } }
  }
  if (!initial || !initial.elements.length) initial = normalizeBound(sampleBound()).bound;
  initEditor(initial);
})();
