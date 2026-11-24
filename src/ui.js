/* ============================================================
   UI-Helfer: DOM, Toast, Dateien, Karte (OSM-Kacheln, ohne Bibliothek)
   ============================================================ */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'type', 'placeholder', 'rows', 'min', 'max', 'step', 'id', 'src', 'href', 'title', 'accept', 'multiple', 'selected', 'autocomplete', 'readOnly', 'draggable', 'download', 'target', 'rel', 'controls', 'inputMode'].includes(k)) { try { e[k] = v; } catch (x) { e.setAttribute(k, v); } }
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(3)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
}
const $ = (s, r) => (r || document).querySelector(s);

let toastTimer;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); return true; } catch (e) { }
  try {
    const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } }); document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); if (ok) { toast('In die Zwischenablage kopiert'); return true; }
  } catch (e) { }
  toast('Kopieren nicht möglich – nutze die JSON-Quelle.'); return false;
}
async function saveFile(name, text, mime) {
  try {
    if (window.claude && window.claude.use) {
      const d = await window.claude.use('downloads');
      if (d) { await d.save({ filename: name, data: text }); toast('„' + name + '“ gespeichert'); return true; }
    }
  } catch (e) { if (e && e.code === 'declined') return false; }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/octet-stream' }));
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('„' + name + '“ heruntergeladen'); return true;
  } catch (e) { toast('Download hier nicht möglich – bitte kopieren.'); return false; }
}
function slug(s) { return String(s || 'bound').toLowerCase().replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'bound'; }

async function fileToDataURL(file, max) {
  max = max || 1024;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- Karte mit OSM-Kacheln ---------- */
class SlippyMap {
  constructor(el, o) {
    o = o || {};
    this.el = el; this.lat = o.lat == null ? 48.2082 : o.lat; this.lon = o.lon == null ? 16.3738 : o.lon; this.z = o.zoom || 16;
    this.onPick = o.onPick; this.interactive = o.interactive !== false;
    this.target = null; this.user = null; this.tiles = new Map();
    el.classList.add('smap');
    this.layer = h('div', { class: 'smap-tiles' });
    this.cv = h('canvas', { class: 'smap-over' });
    this.note = h('div', { class: 'smap-note' }, 'Kartenkacheln werden hier nicht geladen. Ziel und Position erscheinen trotzdem im Raster.');
    this.note.hidden = true;
    el.append(this.layer, this.cv,
      h('div', { class: 'smap-zoom' }, h('button', { type: 'button', title: 'Vergrößern', onclick: () => this.zoom(1) }, '+'), h('button', { type: 'button', title: 'Verkleinern', onclick: () => this.zoom(-1) }, '−')),
      h('div', { class: 'smap-attr' }, h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, '© OpenStreetMap')), this.note);
    this.errors = 0; this.loaded = 0;
    if (this.interactive) this.bind();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.draw()) : null;
    if (this.ro) this.ro.observe(el);
    this.draw();
  }
  destroy() { if (this.ro) this.ro.disconnect(); }
  proj(lat, lon, z) {
    const n = 256 * 2 ** z, s = Math.sin(lat * Math.PI / 180);
    return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }
  unproj(x, y, z) {
    const n = 256 * 2 ** z;
    return [Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI, x / n * 360 - 180];
  }
  setView(lat, lon, z) { this.lat = lat; this.lon = lon; if (z) this.z = z; this.draw(); }
  setTarget(lat, lon, r) { this.target = { lat, lon, r }; this.draw(); }
  setUser(lat, lon, acc) { this.user = { lat, lon, acc }; this.draw(); }
  fit() {
    if (!this.target || !this.user) return;
    const w = this.el.clientWidth, hh = this.el.clientHeight;
    for (let z = 18; z >= 3; z--) {
      const a = this.proj(this.target.lat, this.target.lon, z), b = this.proj(this.user.lat, this.user.lon, z);
      if (Math.abs(a[0] - b[0]) < w * 0.7 && Math.abs(a[1] - b[1]) < hh * 0.7) { this.z = z; break; }
    }
    this.lat = (this.target.lat + this.user.lat) / 2; this.lon = (this.target.lon + this.user.lon) / 2; this.draw();
  }
  zoom(d) { this.z = Math.max(2, Math.min(19, this.z + d)); this.draw(); }
  draw() {
    const w = this.el.clientWidth, hh = this.el.clientHeight; if (!w || !hh) return;
    const [cx, cy] = this.proj(this.lat, this.lon, this.z), z = this.z, n = 2 ** z;
    const x0 = Math.floor((cx - w / 2) / 256), x1 = Math.floor((cx + w / 2) / 256), y0 = Math.floor((cy - hh / 2) / 256), y1 = Math.floor((cy + hh / 2) / 256);
    const need = new Set();
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n, key = z + '/' + wx + '/' + ty + '@' + tx; need.add(key);
      let img = this.tiles.get(key);
      if (!img) {
        img = new Image(); img.alt = ''; img.draggable = false; img.className = 'smap-tile';
        img.onload = () => { this.loaded++; this.note.hidden = true; img.style.visibility = 'visible'; };
        img.onerror = () => { img.remove(); if (++this.errors > 2 && !this.loaded) this.note.hidden = false; };
        img.style.visibility = 'hidden';
        img.src = `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`;
        this.layer.append(img); this.tiles.set(key, img);
      }
      img.style.transform = `translate(${Math.round(tx * 256 - cx + w / 2)}px,${Math.round(ty * 256 - cy + hh / 2)}px)`;
    }
    for (const [k, img] of this.tiles) if (!need.has(k)) { img.remove(); this.tiles.delete(k); }
    // Overlay
    const dpr = window.devicePixelRatio || 1;
    if (this.cv.width !== w * dpr || this.cv.height !== hh * dpr) { this.cv.width = w * dpr; this.cv.height = hh * dpr; this.cv.style.width = w + 'px'; this.cv.style.height = hh + 'px'; }
    const g = this.cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
    const sc = (lat, lon) => { const p = this.proj(lat, lon, z); return [p[0] - cx + w / 2, p[1] - cy + hh / 2]; };
    const mpp = lat => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
    const css = getComputedStyle(this.el), accent = css.getPropertyValue('--accent').trim() || '#b02468', blue = '#1a73e8';
    if (this.target) {
      const [x, y] = sc(this.target.lat, this.target.lon), r = Math.max(6, this.target.r / mpp(this.target.lat));
      g.lineWidth = 3; g.strokeStyle = accent; g.fillStyle = accent + '33';
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fillStyle = accent; g.fill();
    }
    if (this.user) {
      const [x, y] = sc(this.user.lat, this.user.lon), r = Math.max(8, (this.user.acc || 0) / mpp(this.user.lat));
      g.fillStyle = blue + '26'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = blue; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke();
    }
  }
  bind() {
    let drag = null, moved = false;
    const el = this.el;
    el.addEventListener('pointerdown', e => { if (e.target.closest('.smap-zoom,.smap-attr')) return; drag = { x: e.clientX, y: e.clientY }; moved = false; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      const [cx, cy] = this.proj(this.lat, this.lon, this.z);
      [this.lat, this.lon] = this.unproj(cx - dx, cy - dy, this.z); drag = { x: e.clientX, y: e.clientY }; this.draw();
    });
    el.addEventListener('pointerup', e => {
      if (drag && !moved && this.onPick) {
        const r = el.getBoundingClientRect(), [cx, cy] = this.proj(this.lat, this.lon, this.z);
        const [la, lo] = this.unproj(cx + (e.clientX - r.left) - r.width / 2, cy + (e.clientY - r.top) - r.height / 2, this.z);
        this.onPick(la, lo);
      }
      drag = null;
    });
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  }
}
