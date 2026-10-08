import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

try {
  await page.goto('http://127.0.0.1:4173/?page=secondary&start=example', { waitUntil: 'networkidle' });
  await page.waitForSelector('#seTransformToolbar', { state: 'visible', timeout: 15000 });

  if (await page.locator('#seUndoLayout').count()) throw new Error('Legacy Undo move still exists');
  if (await page.locator('#seRedoLayout').count()) throw new Error('Legacy Redo move still exists');
  if (await page.locator('.se-tool-group').count() < 2) throw new Error('History/select groups missing');
  if (await page.locator('.se-whole-rotation-dock').count() !== 1) throw new Error('Whole rotation dock missing');

  await page.evaluate(() => SecondaryExplorer.highlightResidues([0,1,2,3]));
  await page.waitForTimeout(120);
  if (await page.locator('[data-se-transform-handle="rotate"]').count() !== 1) throw new Error('Selected rotate handle missing');
  if (await page.locator('[data-se-transform-handle="scale"]').count() < 4) throw new Error('Selected zoom handles missing');

  const angle = await page.locator('#seWholeRotationValue').textContent();
  if (!String(angle).includes('°')) throw new Error('Whole rotation angle is not shown');

  const label = page.locator('[data-index-label]').first();
  await label.waitFor({ state: 'visible' });
  const beforeStructure = await page.evaluate(() => SecondaryExplorer.getCurrentPositions());
  const box = await label.boundingBox();
  if (!box) throw new Error('Index label has no box');
  const beforeLabel = await label.evaluate(el => ({ x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 22, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterStructure = await page.evaluate(() => SecondaryExplorer.getCurrentPositions());
  const movedStructure = Math.max(...beforeStructure.map((p,i) => Math.hypot(p.x-afterStructure[i].x,p.y-afterStructure[i].y)));
  if (movedStructure > 1e-6) throw new Error('Dragging index changed RNA coordinates: ' + movedStructure);
  const afterLabel = await page.locator('[data-index-label]').first().evaluate(el => ({ x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }));
  if (Math.hypot(afterLabel.x-beforeLabel.x, afterLabel.y-beforeLabel.y) < 5) throw new Error('Index label did not move');

  // Exercise selection rotation handle and require a visible live degree label.
  await page.evaluate(() => SecondaryExplorer.highlightResidues([0,1,2,3,4,5]));
  await page.waitForTimeout(100);
  const rotateHandle = page.locator('[data-se-transform-handle="rotate"]');
  const rb = await rotateHandle.boundingBox();
  if (!rb) throw new Error('Rotate handle has no box');
  await page.mouse.move(rb.x + rb.width/2, rb.y + rb.height/2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width/2 + 35, rb.y + rb.height/2 + 20, { steps: 5 });
  if (await page.locator('.se-rotation-angle').count() !== 1) throw new Error('Selected rotation live angle missing');
  const liveAngle = await page.locator('.se-rotation-angle').textContent();
  if (!String(liveAngle).includes('°')) throw new Error('Selected rotation angle has no degree sign');
  await page.mouse.up();

  const serious = errors.filter(x => !/favicon|ResizeObserver loop/i.test(x));
  if (serious.length) throw new Error('Browser errors:\n' + serious.join('\n'));
  console.log(JSON.stringify({ result:'PASS', indexMoved:true, structureStayedFixed:true, liveAngle }));
} finally {
  await browser.close();
}
