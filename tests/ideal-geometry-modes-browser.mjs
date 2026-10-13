import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.RNA_EXPLORER_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push('console: '+m.text());});

const ringGraph=(orders=[1,1,1,1,1,1])=>({
  atoms:Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return{id:'C'+(i+1),element:'C',x:400+Math.cos(a)*90,y:250+Math.sin(a)*90,charge:0};}),
  bonds:Array.from({length:6},(_,i)=>({id:'b'+i,a:'C'+(i+1),b:'C'+((i+1)%6+1),order:orders[i]})),
  hbonds:[]
});

function centroid(atoms,prefix){
  const a=atoms.filter(x=>x.id.startsWith(prefix));
  return {x:a.reduce((s,q)=>s+q.x,0)/a.length,y:a.reduce((s,q)=>s+q.y,0)/a.length,z:a.reduce((s,q)=>s+(q.z||0),0)/a.length,n:a.length};
}
function bondLengths2D(graph,coords){
  const m=new Map(coords.map(q=>[q.id,q]));
  return graph.bonds.map(b=>{const a=m.get(b.a),c=m.get(b.b);return Math.hypot(c.x-a.x,c.y-a.y);});
}
function internalAngles(graph,coords){
  const m=new Map(coords.map(q=>[q.id,q]));
  return graph.atoms.map((atom,i)=>{
    const p=m.get(atom.id),prev=m.get('C'+((i+5)%6+1)),next=m.get('C'+((i+1)%6+1));
    const u={x:prev.x-p.x,y:prev.y-p.y},v={x:next.x-p.x,y:next.y-p.y};
    const c=(u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y));
    return Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI;
  });
}

try{
  await page.goto(`${BASE}/?page=drawing`,{waitUntil:'networkidle',timeout:30000});
  await page.waitForFunction(()=>typeof MoleculeEditor!=='undefined'&&typeof Chemistry3DForceField!=='undefined');

  // OpenChemLib should now provide separate ideal, optimized, and 2D coordinate modes.
  const engineInfo=await page.evaluate(()=>Chemistry3DForceField.getEngineInfo());
  assert.equal(engineInfo.primary3D,'ideal conformer');
  assert.equal(engineInfo.optionalOptimization,'MMFF94');
  assert.equal(engineInfo.twoD,'inventCoordinates');

  // Whole-molecule Ideal 2D should regularize an arbitrary distorted ring, not just a hard-coded benzene template.
  const distorted=ringGraph([1,1,1,1,1,1]);
  distorted.atoms[1].x+=38;distorted.atoms[2].y-=44;distorted.atoms[4].x-=31;
  const twoD=await page.evaluate(async graph=>Chemistry3DForceField.generate2D(graph),distorted);
  assert.equal(twoD.mode,'ideal2D');
  const lengths=bondLengths2D(distorted,twoD.coordinates);
  const mean=lengths.reduce((a,b)=>a+b,0)/lengths.length;
  const spread=Math.max(...lengths)-Math.min(...lengths);
  assert(Math.abs(mean-68)<4,`Ideal 2D bond length mean is ${mean}`);
  assert(spread<7,`Ideal 2D ring bond lengths are not uniform: ${lengths.join(', ')}`);
  const angles=internalAngles(distorted,twoD.coordinates);
  assert(Math.max(...angles.map(a=>Math.abs(a-120)))<8,`Ideal 2D ring angles are not close to 120°: ${angles.join(', ')}`);

  // Chemistry-aware ideal 3D must distinguish planar sp2 benzene from puckered sp3 cyclohexane.
  const benzene=ringGraph([2,1,2,1,2,1]);
  const cyclohexane=ringGraph([1,1,1,1,1,1]);
  const [benzene3d,cyclo3d]=await page.evaluate(async ({benzene,cyclohexane})=>[
    await Chemistry3DForceField.generateIdeal(benzene),
    await Chemistry3DForceField.generateIdeal(cyclohexane)
  ],{benzene,cyclohexane});
  const bz=benzene3d.atoms.filter(a=>a.element==='C').map(a=>a.z),cz=cyclo3d.atoms.filter(a=>a.element==='C').map(a=>a.z);
  assert(Math.max(...bz)-Math.min(...bz)<0.25,`Benzene ideal conformer is unexpectedly non-planar: ${bz.join(', ')}`);
  assert(Math.max(...cz)-Math.min(...cz)>0.45,`Cyclohexane ideal conformer did not pucker: ${cz.join(', ')}`);
  assert.equal(benzene3d.geometryMode,'ideal');
  assert.equal(cyclo3d.geometryMode,'ideal');

  // A base pair must keep the left/right arrangement from the drawing in ideal 3D instead of drifting to arbitrary positions.
  const pair=await page.evaluate(()=>MoleculeEditor.pairTemplate('GC','G','C'));
  const pairInputL=centroid(pair.atoms,'L_'),pairInputR=centroid(pair.atoms,'R_');
  assert(pairInputL.x<pairInputR.x,'Test pair is not left/right in 2D input');
  const pairIdeal=await page.evaluate(async graph=>Chemistry3DForceField.generateIdeal(graph),pair);
  const idealL=centroid(pairIdeal.atoms,'L_'),idealR=centroid(pairIdeal.atoms,'R_');
  assert.equal(pairIdeal.componentCount,2);
  assert.equal(pairIdeal.relativePlacementPreserved,true);
  assert(idealL.x<idealR.x,`Ideal 3D reversed base-pair placement: ${JSON.stringify({idealL,idealR})}`);
  assert(Math.hypot(idealR.x-idealL.x,idealR.y-idealL.y)>1.5,'Ideal 3D collapsed the two bases together');

  // MMFF94 remains available as a separate optional mode and should not destroy disconnected-fragment placement.
  const pairOptimized=await page.evaluate(async graph=>Chemistry3DForceField.generateOptimized(graph),pair);
  const optL=centroid(pairOptimized.atoms,'L_'),optR=centroid(pairOptimized.atoms,'R_');
  assert.equal(pairOptimized.forceField,'MMFF94');
  assert.equal(pairOptimized.geometryMode,'optimized');
  assert.equal(pairOptimized.componentCount,2);
  assert(optL.x<optR.x,'MMFF94 mode lost the base-pair left/right placement');

  // UI: Ideal 2D is visible, and Show in 3D starts in Ideal mode with an explicit optional minimization button.
  await page.evaluate(()=>MoleculeEditor.openPair('G','C'));
  await page.waitForSelector('#chemEditorDialog[open]');
  assert.match(await page.locator('#chemTidy2D').innerText(),/Ideal 2D/i);
  await page.locator('#chemTidy2D').click();
  await page.waitForFunction(()=>/Ideal 2D applied|basic geometry cleanup/i.test(document.querySelector('#chemEditorStatus')?.textContent||''),null,{timeout:20000});
  assert.match(await page.locator('#chemEditorStatus').innerText(),/Ideal 2D applied with OpenChemLib/i);

  await page.locator('#chem3DToggle').click();
  await page.waitForSelector('#chem3DPanel:not([hidden])');
  assert.equal(await page.locator('#chem3DIdealMode').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#chem3DOptimizeMode').getAttribute('aria-pressed'),'false');
  assert.equal((await page.evaluate(()=>MoleculeEditor.get3DDiagnostics())).mode,'ideal');
  await page.waitForFunction(()=>document.querySelector('#chem3DStatus')?.dataset.state==='ready',null,{timeout:20000});
  assert.match(await page.locator('#chem3DStatus').innerText(),/Ideal conformer/i);

  await page.locator('#chem3DOptimizeMode').click();
  assert.equal(await page.locator('#chem3DOptimizeMode').getAttribute('aria-pressed'),'true');
  assert.equal((await page.evaluate(()=>MoleculeEditor.get3DDiagnostics())).mode,'optimized');
  await page.waitForFunction(()=>/MMFF94 energy-minimized/i.test(document.querySelector('#chem3DStatus')?.textContent||''),null,{timeout:30000});
  assert.match(await page.locator('#chem3DStatus').innerText(),/MMFF94 energy-minimized/i);

  assert.equal(errors.length,0,`Browser errors:\n${errors.join('\n')}`);
  console.log('PASS: Ideal 2D, default Ideal 3D, preserved base-pair arrangement, and optional MMFF94 minimization');
} finally {
  await page.screenshot({path:'/tmp/ideal-geometry-modes.png',fullPage:true}).catch(()=>{});
  await browser.close();
}
