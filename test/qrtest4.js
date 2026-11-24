const QR=require('../src/qr.js'); const fs=require('fs');
const mk=n=>Array.from({length:n},(_,i)=>String.fromCharCode(33+(i*7+i*i)%90)).join('');
const out=[]; const seen=new Set();
for(let n=1000;n<=2300;n+=20){const m=QR.encode(mk(n));const v=(m.length-17)/4; if(seen.has(v))continue; seen.add(v); out.push({t:mk(n),v,m:m.map(r=>r.map(c=>c?1:0).join('')).join('\n')});}
fs.writeFileSync('qr.json',JSON.stringify(out));
