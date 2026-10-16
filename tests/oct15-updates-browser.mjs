import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

async function openDrawing(page) {
  await page.goto(`${BASE}/?page=drawing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof MoleculeEditor !== 'undefined', null, { timeout: 15000 });
  await page.evaluate(() => MoleculeEditor.openBase('A'));
  await page.waitForSelector('#chemEditorDialog[open]', { timeout: 10000 });
  await page.waitForSelector('#chemInspectPanelV2', { timeout: 15000 });
  await page.waitForSelector('#chemEditorDialog .chem-tool-group[data-oct15="inspect"]', { timeout: 15000 });
  await page.waitForSelector('#chemEditorDialog .chem-tool-group[data-oct15="inspect"] #chemInspectPanelV2', { state: 'attached', timeout: 5000 });
}

async function openGroup(page, key) {
  const group = page.locator(`#chemEditorDialog .chem-tool-group[data-oct15="${key}"]`);
  await group.evaluate(el => { el.open = true; });
  return group;
}

async function clickRenderedAtom(page, useTouch = false) {
  await page.locator('#chem3DMolViewer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const point = await page.evaluate(() => {
    const host = document.querySelector('#chem3DMolViewer');
    const canvas = host?.querySelector('canvas');
    const viewer = canvas?._3dmol_viewer;
    if (!viewer) return null;
    let model = null;
    try {
      const models = viewer.getModels?.();
      model = Array.isArray(models) && models.length ? models[0] : viewer.getModel?.();
    } catch (_error) {}
    if (!model) return null;
    let atoms = [];
    try { atoms = model.selectedAtoms?.({ clickable:true }) || []; } catch (_error) {}
    if (!atoms.length) return null;
    const graph = typeof MoleculeEditor !== 'undefined' ? MoleculeEditor.getCurrentGraph?.() : null;
    const editableCount = graph?.atoms?.length || atoms.length;
    const atom = atoms.find(a => Number.isInteger(a.index) && a.index < editableCount) || atoms[0];
    const p = viewer.modelToScreen?.(atom);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { x:p.x-window.scrollX, y:p.y-window.scrollY };
  });
  assert(point && Number.isFinite(point.x) && Number.isFinite(point.y), 'Could not project a clickable molecular atom to the screen.');
  if (useTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(180);
  return page.locator('#chemEditorSvg .chem-inspect-selected').count();
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await openDrawing(desktop);
  const categories = await desktop.locator('#chemEditorDialog .chem-tool-group[data-oct15] > summary').allTextContents();
  for (const expected of ['History','Build & Edit','Select','Display','Inspect','View','Export']) {
    assert(categories.includes(expected), `Missing Molecular Drawing category: ${expected}`);
  }
  assert(!/PyMOL/i.test(await desktop.locator('body').innerText()), 'User-facing PyMOL wording remains on the Molecular Drawing page.');

  await openGroup(desktop, 'inspect');
  await desktop.selectOption('#chemInspectPropertyV2', 'hybridization');
  await desktop.selectOption('#chemInspectScopeV2', 'select');
  await openGroup(desktop, 'view');
  await desktop.click('#chem3DToggle');
  await desktop.waitForSelector('#chem3DMolViewer canvas', { state: 'visible', timeout: 30000 });
  await desktop.waitForFunction(() => document.querySelector('#chem3DMolViewer canvas')?._3dmol_viewer, null, { timeout: 15000 });
  await desktop.waitForTimeout(500);
  assert.equal(await desktop.evaluate(() => !!window.$3Dmol?.GLViewer?.prototype?.addLabel?.__oct15), true,
    'Readable inspection-label patch is not active.');
  assert((await clickRenderedAtom(desktop, false)) > 0, 'Desktop 3D atom selection did not select an atom.');
} finally {
  await desktop.close();
}

const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mobilePage = await mobileContext.newPage();
try {
  await openDrawing(mobilePage);
  const openStates = await mobilePage.locator('#chemEditorDialog .chem-tool-group[data-oct15]').evaluateAll(groups => groups.map(g => g.open));
  assert(openStates.length >= 7 && openStates.every(state => state === false), 'Molecular Drawing categories should start collapsed on mobile.');

  await openGroup(mobilePage, 'inspect');
  await mobilePage.selectOption('#chemInspectPropertyV2', 'hybridization');
  await mobilePage.selectOption('#chemInspectScopeV2', 'select');
  await openGroup(mobilePage, 'view');
  await mobilePage.click('#chem3DToggle');
  await mobilePage.waitForSelector('#chem3DMolViewer canvas', { state: 'visible', timeout: 30000 });
  await mobilePage.waitForFunction(() => document.querySelector('#chem3DMolViewer')?.dataset.oct15Tap === '1', null, { timeout: 15000 });
  await mobilePage.waitForTimeout(500);
  assert((await clickRenderedAtom(mobilePage, true)) > 0, 'Mobile touch tap in the 3D molecular viewer did not select an atom.');
} finally {
  await mobilePage.close();
  await mobileContext.close();
}

const tertiary = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
try {
  await tertiary.goto(`${BASE}/?page=tertiary`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await tertiary.waitForSelector('#scene-tertiary:not([hidden])', { timeout: 10000 });
  await tertiary.waitForSelector('#tertiaryMolecularViewer canvas', { state: 'visible', timeout: 30000 });
  await tertiary.waitForFunction(() => typeof TertiaryExplorer !== 'undefined' && TertiaryExplorer.getDiagnostics().modelReady, null, { timeout: 30000 });
  await tertiary.waitForSelector('#teChainInfoPanel', { timeout: 15000 });
  await tertiary.waitForSelector('#teChainFilterV3', { timeout: 15000 });

  const analyzeButton = tertiary.locator('.rna-tool-tabs button[data-rna-tab="analyze"]');
  if (await analyzeButton.count()) assert.equal((await analyzeButton.first().textContent()).trim(), 'Inspect', 'Analyze tab should use the shared Inspect label.');
  assert(!/PyMOL/i.test(await tertiary.locator('body').innerText()), 'User-facing PyMOL wording remains on the Tertiary page.');

  const chainBoxes = tertiary.locator('#teChainChoicesV3 input[data-chain]');
  const chainCount = await chainBoxes.count();
  assert(chainCount >= 1, 'No chain choices were detected.');
  if (chainCount > 1) {
    const firstChain = await chainBoxes.nth(0).getAttribute('data-chain');
    await tertiary.locator('#teChainChoicesV3 input[data-chain]').evaluateAll((boxes, keep) => {
      boxes.forEach(box => {
        const shouldCheck = String(box.dataset.chain ?? '') === keep;
        if (box.checked !== shouldCheck) box.click();
      });
    }, firstChain);
  }

  await tertiary.waitForFunction(() => {
    const text = document.querySelector('#teChainInfoPanel')?.textContent || '';
    return /Molecule/i.test(text) && /Organism/i.test(text) && /Sequence length/i.test(text) && /Polymer type/i.test(text) && !/Loading…|Fetching chain metadata/i.test(text);
  }, null, { timeout: 30000 });
  const info = await tertiary.locator('#teChainInfoPanel').innerText();
  assert(/Molecule/i.test(info) && /Organism/i.test(info) && /Sequence length/i.test(info), 'Chain information panel did not populate expected metadata.');
} finally {
  await tertiary.close();
  await browser.close();
}

console.log('PASS: October mobile inspection, compact controls, neutral wording, and chain metadata updates.');