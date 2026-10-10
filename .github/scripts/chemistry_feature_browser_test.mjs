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
const box=await svg.boundingBox();
assert(box,'2D SVG should have a box');

// Trigger toolbar controls through their actual DOM click handlers. Canvas and atom interactions
// below still use real pointer input; this avoids a Chromium fixed-dialog scroll quirk in CI.
await clickControl('[data-chem-tool="atom"]');
await page.mouse.click(box.x+220,box.y+210);
await page.mouse.click(box.x+430,box.y+210);
assert.equal((await currentGraph()).atoms.length,2,'two atoms should be drawn');

await clickControl('[data-chem-tool="bond"]');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,1,'first add creates a single bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,2,'repeating add promotes to double bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,3,'repeating add promotes to triple bond');

// Make carbon 0 intentionally over-valent: triple bond + double bond = valence 5.
await clickControl('[data-chem-tool="atom"]');
await page.mouse.click(box.x+320,box.y+360);
assert.equal((await currentGraph()).atoms.length,3,'third atom should be drawn');
await clickControl('[data-chem-tool="bond"]');
await bondAtoms(0,2);
await bondAtoms(0,2);
const overGraph=await currentGraph();
assert.equal(overGraph.bonds.length,2,'second bond should be created');
const thirdId=overGraph.atoms[2].id;
assert.equal(overGraph.bonds.find(b=>b.a===thirdId||b.b===thirdId)?.order,2,'second pair should be promoted to a double bond');
assert(await page.locator('.chem-editor-atom.valence-warning').count()>=1,'over-valent atom should be marked with atom-specific warning');

await clickControl('#chemTidy2D');
assert.match(await page.locator('#chemEditorStatus').innerText(),/tidied|Ready/i,'Tidy 2D should complete');

await clickControl('[data-chem-tool="select"]');
await page.locator('.chem-editor-atom').nth(0).click({force:true});

const displayGroup=page.locator('.chem-tool-group').filter({hasText:'Display · Labels & chemistry'});
await displayGroup.evaluate(el=>{el.open=true;});
assert.equal(await page.locator('#chemIgnoreValence').isDisabled(),false,'ignore control should enable for selected warning atom');
await clickControl('#chemIgnoreValence');
assert.equal(await page.locator('.chem-editor-atom.valence-warning').count(),0,'ignored valence warning should stop flashing');

await clickControl('#chem3DToggle');
await assertVisible(page.locator('#chem3DPanel'),'3D split panel should open');
assert.equal(await page.locator('#chem3DToggle').getAttribute('aria-pressed'),'true');
await page.locator('#chem3DCanvas').evaluate(el=>el.scrollIntoView({block:'center'}));
const cbox=await page.locator('#chem3DCanvas').boundingBox();
assert(cbox,'3D canvas should have a box');
await page.mouse.move(cbox.x+Math.min(200,cbox.width/3),cbox.y+Math.min(180,cbox.height/3));
await page.mouse.wheel(0,-120);
await page.mouse.down();
await page.mouse.move(cbox.x+Math.min(260,cbox.width/2),cbox.y+Math.min(220,cbox.height/2));
await page.mouse.up();

assert.equal(errors.length,0,'Browser emitted errors: '+errors.join(' | '));
console.log('PASS: molecular drawing topbar, bond promotion, valence override, smart tidy, and interactive 3D split preview.');
await browser.close();

async function currentGraph(){ return page.evaluate(()=>MoleculeEditor.getCurrentGraph()); }
async function clickControl(selector){ await page.locator(selector).evaluate(el=>el.click()); }
async function bondAtoms(a,b){
  await page.locator('.chem-editor-atom').nth(a).click({force:true});
  await page.locator('.chem-editor-atom').nth(b).click({force:true});
}
async function assertVisible(locator,message){ assert.equal(await locator.isVisible(),true,message); }
