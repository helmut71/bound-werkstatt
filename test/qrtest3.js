const QR=require('../src/qr.js'); const fs=require('fs');
const mk=n=>Array.from({length:n},(_,i)=>String.fromCharCode(33+(i*7+i*i)%90)).join('');
const out=[300,500,800,1200,1800,2300].map(n=>{const t=mk(n);const m=QR.encode(t);return {t,v:(m.length-17)/4,m:m.map(r=>r.map(c=>c?1:0).join('')).join('\n')}});
fs.writeFileSync('qr.json',JSON.stringify(out));
