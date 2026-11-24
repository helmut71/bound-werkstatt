const QR=require('../src/qr.js'); const fs=require('fs');
const cases=['A','STATION1','https://example.org/x?y=1','Größe ß € ümlaut','x'.repeat(100),'Lorem ipsum '.repeat(15).trim(),'y'.repeat(200)];
const out=cases.map(t=>({t,m:QR.encode(t).map(r=>r.map(c=>c?1:0).join('')).join('\n')}));
fs.writeFileSync('qr.json',JSON.stringify(out));
