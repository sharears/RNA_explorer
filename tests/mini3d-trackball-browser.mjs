import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});

try{
  await page.goto(process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=journey",{waitUntil:"domcontentloaded",timeout:30000});
  await page.locator('.scale-step[data-scene="tertiary"]').click();
  await page.waitForSelector("#scene-tertiary:not([hidden])",{timeout:10000});
  await page.waitForSelector("#gpsMini3D",{state:"visible",timeout:10000});
  await page.locator('[data-learning-feature="helix"]').click();
  await page.waitForFunction(()=>document.querySelector("#gpsMini3D")?.dataset.feature==="helix");

  const svg=page.locator("#gpsMini3D");
  const box=await svg.boundingBox();
  assert.ok(box&&box.width>200&&box.height>200,"Mini 3D SVG is not visible.");
  const center={x:box.x+box.width/2,y:box.y+box.height/2};
  const getState=()=>page.evaluate(()=>{const s=GuidedStructureTransitions.getState();return {rotation:s.rotation,zoom:s.zoom,panX:s.panX,panY:s.panY};});
  const start=await getState();
  assert.ok(Array.isArray(start.rotation)&&start.rotation.length===4,"Quaternion view state is missing.");

  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+120,center.y,{steps:12});await page.mouse.up();
  const afterHorizontal=await getState();
  assert.notDeepEqual(afterHorizontal.rotation,start.rotation,"Horizontal drag did not rotate mini 3D view.");

  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x,center.y-115,{steps:12});await page.mouse.up();
  const afterVertical=await getState();
  assert.notDeepEqual(afterVertical.rotation,afterHorizontal.rotation,"Vertical drag did not rotate mini 3D view.");

  await page.mouse.move(center.x-100,center.y-75);await page.mouse.down();await page.mouse.move(center.x+115,center.y+90,{steps:18});await page.mouse.up();
  const afterDiagonal=await getState();
  const q=afterDiagonal.rotation,norm=Math.hypot(...q);
  assert.ok(Math.abs(norm-1)<1e-6,"Trackball quaternion is not normalized.");
  assert.ok(Math.abs(q[3])>1e-4,"Combined free rotation did not produce an out-of-plane/roll component.");

  await page.mouse.move(center.x,center.y);await page.mouse.down({button:"right"});await page.mouse.move(center.x+70,center.y+55,{steps:8});await page.mouse.up({button:"right"});
  const afterPan=await getState();
  assert.ok(Math.abs(afterPan.panX)>1||Math.abs(afterPan.panY)>1,"Right-drag did not pan mini 3D view.");

  const zoomBefore=afterPan.zoom;
  await page.mouse.move(center.x,center.y);await page.mouse.wheel(0,-300);await page.waitForTimeout(100);
  const afterZoom=await getState();
  assert.ok(afterZoom.zoom>zoomBefore,"Mouse wheel did not zoom in mini 3D view.");

  await page.mouse.dblclick(center.x,center.y);await page.waitForTimeout(80);
  const reset=await getState();
  assert.ok(Math.abs(reset.panX)<1e-6&&Math.abs(reset.panY)<1e-6,"Double-click did not recenter mini 3D view.");
  assert.ok(Math.abs(reset.zoom-1)<1e-6,"Double-click did not restore helix zoom.");
  assert.deepEqual(reset.rotation,start.rotation,"Double-click did not restore the feature's initial orientation.");

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  assert.equal(serious.length,0,"Browser errors: "+serious.join(" | "));
  console.log(JSON.stringify({result:"PASS",freeRotation:"PASS",pan:"PASS",zoom:"PASS",reset:"PASS",quaternion:afterDiagonal.rotation},null,2));
} finally {
  await browser.close();
}
