const QR=require('../src/qr.js'); const fs=require('fs');
const mk=n=>Array.from({length:n},(_,i)=>String.fromCharCode(33+(i*7+i*i)%90)).join('');
const out=[130,150,170,190,210].map(n=>{const t=mk(n);return {t,m:QR.encode(t).map(r=>r.map(c=>c?1:0).join('')).join('\n')}});
fs.writeFileSync('qr.json',JSON.stringify(out));
