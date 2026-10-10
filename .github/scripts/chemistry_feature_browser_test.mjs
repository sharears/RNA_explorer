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

const brand=page.locator('.topbar .brand');
await assertVisible(brand,'RNA Structure Explorer brand should remain visible above molecular drawing');
assert.match((await brand.innerText()).trim(),/RNA Structure Explorer/);
const headerBox=await page.locator('.topbar').boundingBox();
const dialogBox=await page.locator('#chemEditorDialog').boundingBox();
assert(headerBox&&dialogBox,'header/dialog bounding boxes should exist');
assert(dialogBox.y>=headerBox.y+headerBox.height-2,'drawing workspace should begin below the site header');
assert.equal(await page.locator('#chemEditorDialog').evaluate(d=>d.matches(':modal')),false,'drawing dialog should be non-modal so site navigation remains usable');

const svg=page.locator('#chemEditorSvg');
await svg.evaluate(el=>el.scrollIntoView({block:'center'}));
const box=await svg.boundingBox();
assert(box,'2D SVG should have a box');

await clickTool('atom');
await clickSvgAt(.30,.42);
assert.equal((await currentGraph()).atoms.length,1,'first atom should be drawn');
await clickSvgAt(.60,.42);
assert.equal((await currentGraph()).atoms.length,2,'second atom should be drawn');

await clickTool('bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,1,'first add creates a single bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,2,'repeating add promotes to double bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,3,'repeating add promotes to triple bond');

await clickTool('atom');
await clickSvgAt(.45,.74);
assert.equal((await currentGraph()).atoms.length,3,'third atom should be drawn');
await clickTool('bond');
await bondAtoms(0,2);
await bondAtoms(0,2);
const overGraph=await currentGraph();
assert.equal(overGraph.bonds.length,2,'second bond should be created');
const thirdId=overGraph.atoms[2].id;
assert.equal(overGraph.bonds.find(b=>b.a===thirdId||b.b===thirdId)?.order,2,'second pair should be promoted to a double bond');
assert(await page.locator('.chem-editor-atom.valence-warning').count()>=1,'over-valent atom should be marked with atom-specific warning');

await clickControl('#chemTidy2D');
assert.match(await page.locator('#chemEditorStatus').innerText(),/tidied|Ready/i,'Tidy 2D should complete');

await clickTool('select');
await atomPointer(0,31);
const displayGroup=page.locator('.chem-tool-group').filter({hasText:'Display · Labels & chemistry'});
await displayGroup.evaluate(el=>{el.open=true;});
assert.equal(await page.locator('#chemIgnoreValence').isDisabled(),false,'ignore control should enable for selected warning atom');
await clickControl('#chemIgnoreValence');
assert.equal(await page.locator('.chem-editor-atom.valence-warning').count(),0,'ignored valence warning should stop flashing');

await clickControl('#chem3DToggle');
await assertVisible(page.locator('#chem3DPanel'),'3D split panel should open');
assert.equal(await page.locator('#chem3DToggle').getAttribute('aria-pressed'),'true');
const cbox=await page.locator('#chem3DCanvas').boundingBox();
assert(cbox,'3D canvas should have a box');
await page.locator('#chem3DCanvas').dispatchEvent('wheel',{deltaY:-120});
await page.locator('#chem3DCanvas').dispatchEvent('pointerdown',{button:0,pointerId:50,clientX:cbox.x+100,clientY:cbox.y+100});
await page.locator('#chem3DCanvas').dispatchEvent('pointermove',{button:0,buttons:1,pointerId:50,clientX:cbox.x+150,clientY:cbox.y+130});
await page.locator('#chem3DCanvas').dispatchEvent('pointerup',{button:0,pointerId:50,clientX:cbox.x+150,clientY:cbox.y+130});

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
async function clickSvgAt(fx,fy){
  await svg.evaluate((el,{fx,fy})=>{
    const r=el.getBoundingClientRect();
    const event=new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,clientX:r.left+r.width*fx,clientY:r.top+r.height*fy});
    el.dispatchEvent(event);
  },{fx,fy});
}
async function atomPointer(index,pointerId){
  const atom=page.locator('.chem-editor-atom').nth(index);
  await atom.dispatchEvent('pointerdown',{button:0,pointerId,clientX:10,clientY:10});
  await atom.dispatchEvent('pointerup',{button:0,pointerId,clientX:10,clientY:10});
}
async function bondAtoms(a,b){ await atomPointer(a,11); await atomPointer(b,12); }
async function assertVisible(locator,message){ assert.equal(await locator.isVisible(),true,message); }
