import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', msg => {
  if (msg.type() === 'error' && !/Failed to load resource|favicon/i.test(msg.text())) errors.push('console: ' + msg.text());
});

const closeTo = (a, b, eps = 1e-6) => Math.abs(Number(a) - Number(b)) <= eps;

async function diag() {
  return page.evaluate(() => MoleculeEditor.get3DDiagnostics());
}

try {
  // Molecular Drawing: controls + desktop interaction parity.
  await page.goto(`${BASE}/?page=drawing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof MoleculeEditor !== 'undefined');
  await page.evaluate(() => MoleculeEditor.openBase('A'));
  await page.waitForSelector('#chemEditorDialog[open]', { state: 'visible' });
  await page.locator('#chem3DToggle').click();
  await page.waitForSelector('#chem3DPanel:not([hidden])', { state: 'visible' });
  await page.waitForFunction(() => MoleculeEditor.get3DDiagnostics().atomCount > 0, null, { timeout: 30000 });

  for (const id of ['chem3DZoomOut','chem3DZoomIn','chem3DResetView','chem3DCenter','chem3DFullscreen']) {
    assert.equal(await page.locator(`#${id}`).isVisible(), true, `${id} is not visible`);
  }

  const canvas = page.locator('#chem3DCanvas');
  const box = await canvas.boundingBox();
  assert(box && box.width > 250 && box.height > 250, '3D canvas is not usable');
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5;

  const initial = await diag();
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cx + 65, cy + 35, { steps: 5 });
  await page.mouse.up({ button: 'left' });
  const rotated = await diag();
  assert(Math.abs(rotated.view.rx - initial.view.rx) > 0.05 || Math.abs(rotated.view.ry - initial.view.ry) > 0.05, 'Left drag did not rotate the molecular 3D view');

  await page.keyboard.down('Control');
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cx + 55, cy - 30, { steps: 5 });
  await page.mouse.up({ button: 'left' });
  await page.keyboard.up('Control');
  const panned = await diag();
  assert(Math.abs(panned.view.panX) > 5 || Math.abs(panned.view.panY) > 5, 'Ctrl/Command-style drag did not pan the molecular 3D view');

  await page.locator('#chem3DCenter').click();
  const centered = await diag();
  assert(closeTo(centered.view.panX, 0) && closeTo(centered.view.panY, 0), 'Center did not clear molecular 3D pan');

  const beforeZoom = centered.view.zoom;
  await page.locator('#chem3DZoomIn').click();
  const zoomed = await diag();
  assert(zoomed.view.zoom > beforeZoom, 'Zoom-in control did not change molecular 3D zoom');

  await page.locator('#chem3DResetView').click();
  const reset = await diag();
  assert(closeTo(reset.view.rx, -0.38) && closeTo(reset.view.ry, 0.58) && closeTo(reset.view.zoom, 1) && closeTo(reset.view.panX, 0) && closeTo(reset.view.panY, 0), 'Reset view did not restore the default molecular 3D camera');

  // Force the CSS fullscreen fallback so this remains testable in headless browsers and iPhone-like environments.
  await page.evaluate(() => {
    const panel = document.querySelector('#chem3DPanel');
    Object.defineProperty(panel, 'requestFullscreen', { value: undefined, configurable: true });
  });
  await page.locator('#chem3DFullscreen').click();
  assert.equal((await diag()).fullscreen, true, 'Fullscreen-style control did not expand the molecular 3D panel');
  await page.locator('#chem3DFullscreen').click();
  assert.equal((await diag()).fullscreen, false, 'Fullscreen-style control did not exit expanded molecular 3D mode');

  // Touch semantics: one finger rotates; two touch pointers pan/pinch.
  const touchStart = await diag();
  await page.evaluate(({x,y}) => {
    const c = document.querySelector('#chem3DCanvas');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId:71, pointerType:'touch', clientX:x, clientY:y, isPrimary:true }));
    c.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, pointerId:71, pointerType:'touch', clientX:x+45, clientY:y+20, isPrimary:true }));
    c.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, pointerId:71, pointerType:'touch', clientX:x+45, clientY:y+20, isPrimary:true }));
  }, {x:cx,y:cy});
  const touchRotated = await diag();
  assert(Math.abs(touchRotated.view.rx - touchStart.view.rx) > 0.02 || Math.abs(touchRotated.view.ry - touchStart.view.ry) > 0.02, 'One-finger touch drag did not rotate molecular 3D');

  await page.locator('#chem3DResetView').click();
  await page.evaluate(({x,y}) => {
    const c = document.querySelector('#chem3DCanvas');
    const fire=(type,id,px,py,primary=false)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',clientX:px,clientY:py,isPrimary:primary}));
    fire('pointerdown',81,x-30,y, true);
    fire('pointerdown',82,x+30,y, false);
    fire('pointermove',81,x-55,y+15, true);
    fire('pointermove',82,x+65,y+15, false);
    fire('pointerup',81,x-55,y+15, true);
    fire('pointerup',82,x+65,y+15, false);
  }, {x:cx,y:cy});
  const touchTwo = await diag();
  assert(Math.abs(touchTwo.view.zoom - 1) > 0.02 || Math.abs(touchTwo.view.panX) > 2 || Math.abs(touchTwo.view.panY) > 2, 'Two-finger touch gesture did not pan or pinch-zoom molecular 3D');

  // Learning mode: default tertiary representation must be PyMOL-style sticks colored by element.
  const learning = await context.newPage();
  const learningErrors = [];
  learning.on('pageerror', error => learningErrors.push('pageerror: ' + error.message));
  await learning.goto(`${BASE}/?page=journey&scene=tertiary`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await learning.waitForFunction(() => typeof TertiaryExplorer !== 'undefined');
  const learningDiag = await learning.evaluate(() => TertiaryExplorer.getDiagnostics());
  assert.equal(learningDiag.representation, 'sticks', 'Learning mode does not default to stick representation');
  assert.equal(learningDiag.colorMode, 'element', 'Learning mode does not default to element-wise coloring');
  const repValue = await learning.locator('#teRepresentation').inputValue();
  const colorValue = await learning.locator('#teColorMode').inputValue();
  assert.equal(repValue, 'sticks', 'Learning-mode representation control is not synchronized to sticks');
  assert.equal(colorValue, 'element', 'Learning-mode color control is not synchronized to element coloring');
  assert.equal(learningErrors.length, 0, `Learning-mode browser errors:\n${learningErrors.join('\n')}`);
  await learning.close();

  assert.equal(errors.length, 0, `Molecular Drawing browser errors:\n${errors.join('\n')}`);
  console.log('PASS: Molecular Drawing 3D navigation controls, mouse/touch interaction, fullscreen fallback, and Learning-mode element-colored stick defaults');
} finally {
  await page.screenshot({ path: '/tmp/molecular-3d-controls-learning.png', fullPage: true }).catch(() => {});
  await browser.close();
}
