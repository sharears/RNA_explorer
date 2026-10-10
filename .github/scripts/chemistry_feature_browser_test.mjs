// Dedicated end-to-end regression for the October 2026 molecular drawing upgrade.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
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

await page.locator('#chem3DToggle').click();
await assertVisible(page.locator('#chem3DPanel'),'3D split panel should open');
assert.equal(await page.locator('#chem3DToggle').getAttribute('aria-pressed'),'true');

const svg=page.locator('#chemEditorSvg');
const box=await svg.boundingBox();
assert(box,'2D SVG should have a box');
await page.locator('[data-chem-tool="atom"]').click();
await page.mouse.click(box.x+220,box.y+210);
await page.mouse.click(box.x+430,box.y+210);
assert.equal((await currentGraph()).atoms.length,2,'two atoms should be drawn');

await page.locator('[data-chem-tool="bond"]').click();
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,1,'first add creates a single bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,2,'repeating add promotes to double bond');
await bondAtoms(0,1);
assert.equal((await currentGraph()).bonds[0].order,3,'repeating add promotes to triple bond');

await page.locator('[data-chem-tool="atom"]').click();
await page.mouse.click(box.x+320,box.y+360);
assert.equal((await currentGraph()).atoms.length,3,'third atom should be drawn');
await page.locator('#chemBondOrder').selectOption('2');
await page.locator('[data-chem-tool="bond"]').click();
await bondAtoms(0,2);
assert.equal((await currentGraph()).bonds.length,2,'second bond should be created');
assert(await page.locator('.chem-editor-atom.valence-warning').count()>=1,'over-valent atom should be marked with atom-specific warning');

await page.locator('[data-chem-tool="select"]').click();
await page.locator('.chem-editor-atom').nth(0).click({force:true});
assert.equal(await page.locator('#chemIgnoreValence').isDisabled(),false,'ignore control should enable for selected warning atom');
await page.locator('#chemIgnoreValence').click();
assert.equal(await page.locator('.chem-editor-atom.valence-warning').count(),0,'ignored valence warning should stop flashing');

await page.locator('#chemTidy2D').click();
assert.match(await page.locator('#chemEditorStatus').innerText(),/tidied|Ready/i,'Tidy 2D should complete');
await page.locator('#chem3DCanvas').hover();
await page.mouse.wheel(0,-120);
const cbox=await page.locator('#chem3DCanvas').boundingBox();
assert(cbox,'3D canvas should have a box');
await page.mouse.move(cbox.x+200,cbox.y+180);
await page.mouse.down();await page.mouse.move(cbox.x+260,cbox.y+220);await page.mouse.up();

assert.equal(errors.length,0,'Browser emitted errors: '+errors.join(' | '));
console.log('PASS: molecular drawing topbar, bond promotion, valence override, smart tidy, and interactive 3D split preview.');
await browser.close();

async function currentGraph(){ return page.evaluate(()=>MoleculeEditor.getCurrentGraph()); }
async function bondAtoms(a,b){
  await page.locator('.chem-editor-atom').nth(a).click({force:true});
  await page.locator('.chem-editor-atom').nth(b).click({force:true});
}
async function assertVisible(locator,message){ assert.equal(await locator.isVisible(),true,message); }
