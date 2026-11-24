const C=require('../src/core.js'); const assert=require('assert');
// sample from main.js
const src=require('fs').readFileSync('../src/main.js','utf8').split('(function main()')[0];
const sampleBound=new Function('blankBound','makeElement',src+';return sampleBound;')(C.blankBound,C.makeElement);
const b=C.normalizeBound(sampleBound()).bound;
assert.strictEqual(C.findProblems(b).length,0,JSON.stringify(C.findProblems(b)));
const g=new C.Game(b); g.start('T','');
const ids=[]; const step=(res)=>{ids.push(g.cur&&g.cur.id); g.complete(res);} ;
step({}); // start
step({points:10,max:10,correct:true}); // fluss
step({points:15,max:15,correct:true}); // text
step({points:10,max:10,correct:true}); // code
step({points:15,max:15,correct:true}); // loc
assert.strictEqual(g.cur.id,'w-choice');
C.applyActions(g.cur.options[0].actions,g.vars); step({next:'w-a'});
assert.strictEqual(g.cur.id,'w-a'); step({points:10,max:10}); // path A, next q-sort
assert.strictEqual(g.cur.id,'q-sort');
step({points:15,max:15,correct:true}); step({points:15,max:15,correct:true}); step({points:5,max:5,correct:true});
assert.strictEqual(g.cur.id,'s-1'); step({answer:4});
// score = 10+15+10+15+10+15+15+5 = 95 -> jump -> bonus action(+10) -> info bonus
assert.strictEqual(g.cur.id,'i-bonus',g.cur&&g.cur.id); assert.strictEqual(g.vars.score,105-10+10-0===105?105:105);
step({}); assert.ok(g.finished); assert.strictEqual(g.vars.score,105); assert.strictEqual(g.vars.weg,1);
// low score path skips bonus
const g2=new C.Game(b); g2.start('x',''); let guard=0; while(!g2.finished&&guard++<50){ g2.complete({points:0,max:5,correct:false}); }
assert.ok(g2.finished); assert.ok(!g2.log.some(l=>l.id==='i-bonus'));
// quiz checks
const q=C.makeElement('quiz'); q.sub='number'; q.value=8; q.tolerance=0.5; assert(C.checkQuiz(q,'8,3')); assert(!C.checkQuiz(q,'9'));
q.sub='text'; q.answers=['Strauß']; assert(C.checkQuiz(q,' strauß. ')); q.sub='multi'; q.options=[{text:'a',correct:true},{text:'b',correct:false}]; assert(C.checkQuiz(q,[0])); assert(!C.checkQuiz(q,[0,1]));
// serialize/restore
const g3=new C.Game(b); g3.start('a',''); g3.complete({}); const s=JSON.parse(JSON.stringify(g3.serialize())); const g4=new C.Game(b); g4.restore(s); assert.strictEqual(g4.cur.id,g3.cur.id);
// md safety
const m=C.md('<script>alert(1)</script> **x** [a](javascript:alert(1)) [ok](https://e.org)'); assert(!m.includes('<script')); assert(!m.includes('href="javascript')); assert(m.includes('<strong>x</strong>')); assert(m.includes('href="https://e.org"'));
// geo
assert(Math.abs(C.haversine(48.2,16.37,48.2,16.38)-736)<10); const o=C.offsetPoint(48.2,16.37,100,90); assert(Math.abs(C.haversine(48.2,16.37,o[0],o[1])-100)<0.5);
console.log('ENGINE OK');
