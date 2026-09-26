// Run with a supplied linkedom installation: node tests/chemistry.cjs /path/to/linkedom
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {parseHTML}=require(process.argv[2] || 'linkedom');
const {document,window}=parseHTML(fs.readFileSync('dist/index.html','utf8'));
let serial=0;const timers=new Map();
window.matchMedia=()=>({matches:false});
const OptionCtor=window.Option || function Option(text,value){const el=document.createElement('option');el.textContent=text;el.value=value;return el;};
const ctx=vm.createContext({document,window,console,CustomEvent:window.CustomEvent,Option:OptionCtor,
  setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);}
});
function flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}
const run=s=>vm.runInContext(s,ctx);
for(const f of ['chemistry.js','chemistry-editor.js','journey.js','primary-animation.js','secondary.js','tertiary.js','app.js']) run(fs.readFileSync('dist/'+f,'utf8'));
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
assert.equal(document.querySelectorAll('.se-node').length,76);
assert.ok(document.getElementById('tertiaryMolecularViewer'),'All-atom tertiary viewer container is present');
assert.ok(document.getElementById('teStructureFile'),'Custom 3D upload control is present');
assert.ok(document.getElementById('teSameMolecule'),'2D/3D same-molecule confirmation is present');
assert.ok(document.getElementById('editNucleobaseButton'),'Building Blocks has a nucleobase editor button');
assert.ok(document.getElementById('chemEditorDialog'),'Shared molecular chemistry editor is initialized');
assert.ok(document.getElementById('sePairChemButton'),'Selected Secondary pair can open chemistry editor');
assert.ok(document.getElementById('sePairProbFile'),'Secondary has pair-probability upload');
assert.ok(document.getElementById('seLayerReactivity'),'Secondary has an independent reactivity layer toggle');
assert.ok(document.getElementById('seLayerPairProb'),'Secondary has an independent base-pair probability layer toggle');
assert.ok(document.querySelector('.home-cover-actions a[href="?page=journey"]'),'Homepage has a Learn RNA guided-journey path');
assert.ok(document.getElementById('homeAnalyzeToggle'),'Homepage has an Analyze an RNA toggle');
assert.ok(document.querySelector('#homeAnalyzeFork a[href="?page=secondary"]'),'Homepage Analyze fork has a 2D path');
assert.ok(document.querySelector('#homeAnalyzeFork a[href="?page=tertiary"]'),'Homepage Analyze fork has a 3D path');
assert.equal([...document.querySelectorAll('.scene-number')].every(el=>/\/ 06$/.test(el.textContent)),true,'All visible scene counters use six total steps');
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
