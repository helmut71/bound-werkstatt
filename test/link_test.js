const C=require('../src/core.js'); const assert=require('assert');
const src=require('fs').readFileSync('../src/main.js','utf8').split('async function playFromUrl')[0].split('/* Spiel-Link')[0];
const sample=new Function('blankBound','makeElement',require('fs').readFileSync('../src/main.js','utf8').split('/* Spiel-Link')[0]+';return sampleBound;')(C.blankBound,C.makeElement);
(async()=>{ const b=C.normalizeBound(sample()).bound; const t=await C.packBound(b); const back=await C.unpackBound(t);
 assert.deepStrictEqual(back,JSON.parse(JSON.stringify(b))); console.log('Link-Länge Beispiel:',t.length,'Zeichen; JSON:',JSON.stringify(b).length);
 let bad=false; try{await C.unpackBound('x.abc')}catch(e){bad=true} assert(bad); console.log('LINK OK'); })();
