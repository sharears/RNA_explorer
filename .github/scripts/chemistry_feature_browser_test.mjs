// Dedicated end-to-end regression for the October 2026 molecular drawing upgrade.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.setDefaultTimeout(10000);
page.on('pageerror',err=>errors.push(String(err)));
page.on('console',msg=>{ if(msg.type()==='error') errors.push('console: '+msg.text()); });
await page.route('**/*', route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1'||url.hostname==='localhost') route.continue();
  else route.abort();
});

await page.goto('http://127.0.0.1:4173/?page=drawing&start=blank',{waitUntil:'domcontentloaded',timeout:20000});
await page.waitForSelector('#chemEditorDialog[open]',{timeout:10000});

// 1) Site navigation remains visible while Molecular Drawing is open.
const brand=page.locator('.topbar .brand');
await assertVisible(brand,'RNA Structure Explorer brand should remain visible above molecular drawing');
assert.match((await brand.innerText()).trim(),/RNA Structure Explorer/);
const headerBox=await page.locator('.topbar').boundingBox();
const dialogBox=await page.locator('#chemEditorDialog').boundingBox();
assert(headerBox&&dialogBox,'header/dialog bounding boxes should exist');
assert(dialogBox.y>=headerBox.y+headerBox.height-2,'drawing workspace should begin below the site header');
assert.equal(await page.locator('#chemEditorDialog').evaluate(d=>d.matches(':modal')),false,'drawing dialog should be non-modal so site navigation remains usable');

// Load a built-in molecule through the same editor API used by the site. This makes the
// regression independent of headless Chromium SVG screen-coordinate quirks.
await page.evaluate(()=>MoleculeEditor.openBase('A'));
await page.waitForFunction(()=>MoleculeEditor.getCurrentGraph().atoms.length>0);
let graph=await currentGraph();
assert(graph.atoms.length>4,'adenine template should load');

// 2) Repeating Add bond promotes an existing single bond: single -> double -> triple.
const single=graph.bonds.find(b=>Number(b.order||1)===1);
assert(single,'template should contain a single bond');
await clickTool('bond');
await bondAtomIds(single.a,single.b);
graph=await currentGraph();
assert.equal(graph.bonds.find(b=>b.id===single.id).order,2,'repeating Add bond should promote single to double');
await bondAtomIds(single.a,single.b);
graph=await currentGraph();
assert.equal(graph.bonds.find(b=>b.id===single.id).order,3,'repeating Add bond should promote double to triple');

// 3) Atom-specific valence warning + explicit user override.
// Pick an atom currently carrying more than one bond-order unit, temporarily make it H,
// and verify that only the chemically offending atom is flagged rather than blocking editing.
const valence={};graph.atoms.forEach(a=>valence[a.id]=0);
graph.bonds.forEach(b=>{valence[b.a]=(valence[b.a]||0)+Number(b.order||1);valence[b.b]=(valence[b.b]||0)+Number(b.order||1);});
const warningAtom=graph.atoms.find(a=>(valence[a.id]||0)>1);
assert(warningAtom,'need an atom with valence above one for validation test');
await clickTool('select');
await atomPointerById(warningAtom.id,31);
const elementSelect=page.locator('#chemElement');
await elementSelect.evaluate(el=>{el.value='H';el.dispatchEvent(new Event('change',{bubbles:true}));});
assert.equal(await page.locator(`[data-atom-id="${warningAtom.id}"]`).evaluate(el=>el.classList.contains('valence-warning')),true,'offending atom should flash red');
assert.equal(await page.locator('#chemIgnoreValence').isDisabled(),false,'ignore control should enable for selected warning atom');
await clickControl('#chemIgnoreValence');
assert.equal(await page.locator(`[data-atom-id="${warningAtom.id}"]`).evaluate(el=>el.classList.contains('valence-warning')),false,'ignored valence warning should stop flashing');

// 4) Smart geometry/tidy operation remains available.
await clickControl('#chemTidy2D');
assert.match(await page.locator('#chemEditorStatus').innerText(),/tidied|Ready/i,'Tidy 2D should complete');

// 5) Live interactive split-view 3D preview.
const displayGroup=page.locator('.chem-tool-group').filter({hasText:'Display · Labels & chemistry'});
await displayGroup.evaluate(el=>{el.open=true;});
await clickControl('#chem3DToggle');
await assertVisible(page.locator('#chem3DPanel'),'3D split panel should open');
assert.equal(await page.locator('#chem3DToggle').getAttribute('aria-pressed'),'true');
const canvas=page.locator('#chem3DCanvas');
const cbox=await canvas.boundingBox();
assert(cbox&&cbox.width>100&&cbox.height>100,'3D canvas should be rendered at useful size');
await canvas.dispatchEvent('wheel',{deltaY:-120});
await canvas.dispatchEvent('pointerdown',{button:0,pointerId:50,clientX:cbox.x+100,clientY:cbox.y+100});
await canvas.dispatchEvent('pointermove',{button:0,buttons:1,pointerId:50,clientX:cbox.x+150,clientY:cbox.y+130});
await canvas.dispatchEvent('pointerup',{button:0,pointerId:50,clientX:cbox.x+150,clientY:cbox.y+130});

assert.equal(errors.length,0,'Browser emitted errors: '+errors.join(' | '));
console.log('PASS: molecular drawing topbar, bond promotion, valence override, smart tidy, and interactive 3D split preview.');
await browser.close();

async function currentGraph(){ return page.evaluate(()=>MoleculeEditor.getCurrentGraph()); }
async function clickControl(selector){ await page.locator(selector).evaluate(el=>el.click()); }
async function clickTool(name){
  const button=page.locator(`[data-chem-tool="${name}"]`);
  assert.equal(await button.count(),1,`expected one ${name} tool button`);
  await button.evaluate(el=>el.click());
  assert.equal(await button.evaluate(el=>el.classList.contains('active')),true,`${name} tool should be active`);
}
async function atomPointerById(id,pointerId){
  const atom=page.locator(`[data-atom-id="${id}"]`);
  await atom.dispatchEvent('pointerdown',{button:0,pointerId,clientX:10,clientY:10});
  await atom.dispatchEvent('pointerup',{button:0,pointerId,clientX:10,clientY:10});
}
async function bondAtomIds(a,b){ await atomPointerById(a,11); await atomPointerById(b,12); }
async function assertVisible(locator,message){ assert.equal(await locator.isVisible(),true,message); }
