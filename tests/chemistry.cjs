// Run with a supplied linkedom installation: node tests/chemistry.cjs /path/to/linkedom
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {parseHTML}=require(process.argv[2] || 'linkedom');
const {document,window}=parseHTML(fs.readFileSync('dist/index.html','utf8'));
let serial=0;const timers=new Map();
window.matchMedia=()=>({matches:false});
const ctx=vm.createContext({document,window,console,CustomEvent:window.CustomEvent,
  setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);}
});
function flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}
const run=s=>vm.runInContext(s,ctx);
for(const f of ['chemistry.js','journey.js','primary-animation.js','secondary.js','tertiary.js','app.js']) run(fs.readFileSync('dist/'+f,'utf8'));
assert.equal(document.querySelectorAll('[data-scene-panel]').length,6);
assert.equal(document.querySelectorAll('.scale-step').length,6);
assert.deepEqual([...document.querySelectorAll('[data-scene-panel]')].map(p=>p.dataset.scenePanel),['blocks','nucleoside','nucleotide','primary','secondary','tertiary']);
for(const base of ['A','G','C','U']){
  document.querySelector('[data-base="'+base+'"]').click();
  document.querySelector('[data-scene="nucleoside"]').click();
  assert.match(document.getElementById('nucleosideDiagram').innerHTML,/chem-atom leaving/);
  assert.doesNotMatch(document.getElementById('nucleosideDiagram').innerHTML,/Phosphoric acid/);
  flush();
  assert.match(document.getElementById('nucleosideDiagram').innerHTML,/glycosidic-bond/);
  assert.match(document.getElementById('nucleosideBond').textContent,new RegExp(['A','G'].includes(base)?'N9':'N1'));
  document.getElementById('nextButton').click();
  assert.equal(document.querySelector('.scene:not([hidden])').id,'scene-nucleotide');
  flush();
  assert.match(document.getElementById('nucleotideName').textContent,/5′-monophosphate/);
  assert.match(document.getElementById('nucleotideDiagram').innerHTML,/phosphate-bond/);
  document.getElementById('nucleotideReplay').click();
  document.querySelector('[data-scene="blocks"]').click();
  assert.equal(timers.size,0,'Leaving a tab cancels unfinished animation');
}
for(let i=0;i<6;i++){run('showScene('+i+')');flush();assert.equal(document.querySelectorAll('.scene:not([hidden])').length,1);assert.equal(document.getElementById('progressText').textContent,(i+1)+' of 6');}
assert.equal(document.querySelectorAll('.nt').length,76);
assert.equal(document.querySelectorAll('.secondary-node').length,76);
assert.equal(document.querySelectorAll('.tertiary-node').length,76);
run('showScene(3)');
assert.equal(document.querySelectorAll('.growth-residue').length,1);
for(let i=0;i<4;i++)flush();
assert.equal(document.querySelectorAll('.growth-residue').length,5);
assert.equal(document.querySelectorAll('.growth-link').length,4);
assert.equal(document.getElementById('sequenceReveal').hidden,true);
flush();
assert.equal(document.getElementById('sequenceReveal').hidden,false);
assert.equal(document.querySelectorAll('#primarySequence .nt:not(.unbuilt)').length,6);
for(let i=0;i<70;i++)flush();
assert.equal(document.querySelectorAll('#primarySequence .nt:not(.unbuilt)').length,76);
assert.equal(timers.size,0);
document.getElementById('growthReplay').click();
assert.equal(document.querySelectorAll('.growth-residue').length,1);
assert.equal(document.getElementById('sequenceReveal').hidden,true);
run('showScene(4)');
assert.equal(timers.size,0);
window.matchMedia=()=>({matches:true});
run('showScene(3)');
assert.equal(document.querySelectorAll('#primarySequence .nt:not(.unbuilt)').length,76);
assert.equal(timers.size,0);
document.querySelectorAll('#primarySequence .nt')[17].click();
assert.equal(run('state.selectedResidue'),17);
console.log('PASS: six views, four base choices, chemistry reactions, 5′→3′ growth, four linkages, 76-letter transition, replay, cancellation, reduced motion and linked selection. DOM integration checked; visual browser QA not performed.');
