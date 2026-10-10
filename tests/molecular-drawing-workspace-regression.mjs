import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });

async function waitForEditor() {
  await page.waitForFunction(() => typeof window.MoleculeEditor !== 'undefined');
}

async function layoutSnapshot() {
  return page.evaluate(() => {
    const topbar = document.querySelector('.topbar');
    const dialog = document.querySelector('#chemEditorDialog');
    const workspace = dialog?.querySelector('.chem-editor-workspace');
    const panel = dialog?.querySelector('#chem3DPanel');
    const brand = document.querySelector('.brand');
    const rect = el => el ? el.getBoundingClientRect().toJSON() : null;
    return {
      vw: innerWidth,
      vh: innerHeight,
      topbar: rect(topbar),
      dialog: rect(dialog),
      workspaceClass: workspace?.className || '',
      panelHidden: panel?.hidden ?? null,
      panelDisplay: panel ? getComputedStyle(panel).display : null,
      brandText: brand?.textContent?.replace(/\s+/g, ' ').trim() || '',
      learnVisible: !![...document.querySelectorAll('.topbar button,.topbar a')].find(el => /learn/i.test(el.textContent || '') && el.getBoundingClientRect().width > 0),
      exploreVisible: !![...document.querySelectorAll('.topbar button,.topbar a')].find(el => /explore/i.test(el.textContent || '') && el.getBoundingClientRect().width > 0)
    };
  });
}

function assertFullWorkspace(s, label) {
  assert(s.topbar && s.topbar.width > 0, `${label}: top bar is not visible`);
  assert.match(s.brandText, /RNA Structure Explorer/i, `${label}: RNA Structure Explorer brand missing`);
  assert(s.learnVisible && s.exploreVisible, `${label}: Learn/Explore navigation is not visible`);
  assert(s.dialog && s.dialog.width >= s.vw * 0.94, `${label}: drawing workspace is squeezed (${s.dialog?.width}px of ${s.vw}px)`);
  assert(s.dialog.left >= -1, `${label}: editor shifted off the left side (${s.dialog.left}px)`);
  assert(s.dialog.right <= s.vw + 1, `${label}: editor extends off the right side (${s.dialog.right}px)`);
  assert(s.dialog.top >= s.topbar.bottom - 2, `${label}: editor overlaps the site header`);
  assert(!/with-3d/.test(s.workspaceClass), `${label}: 3D split is active before Show in 3D is clicked`);
  assert(s.panelHidden || s.panelDisplay === 'none', `${label}: 3D panel is visible before Show in 3D is clicked`);
}

try {
  await page.goto(`${BASE}/?page=drawing`, { waitUntil: 'networkidle' });
  await waitForEditor();

  // Path 1: load an existing molecular template.
  await page.evaluate(() => window.MoleculeEditor.openBase('A'));
  await page.waitForSelector('#chemEditorDialog[open]');
  let snap = await layoutSnapshot();
  assertFullWorkspace(snap, 'Template editor');

  // Repeated Add bond on the same atom pair must promote single -> double -> triple.
  const firstSingle = await page.evaluate(() => {
    const g = window.MoleculeEditor.getCurrentGraph();
    const b = g.bonds.find(x => Number(x.order || 1) === 1);
    return b ? { a: b.a, b: b.b, order: Number(b.order || 1) } : null;
  });
  assert(firstSingle, 'Template did not contain a single bond for the promotion test');
  await page.locator('[data-chem-tool="bond"]').click();
  await page.locator(`#chemEditorDialog [data-atom-id="${firstSingle.a}"]`).click();
  await page.locator(`#chemEditorDialog [data-atom-id="${firstSingle.b}"]`).click();
  let promoted = await page.evaluate(({a,b}) => {
    const bond = window.MoleculeEditor.getCurrentGraph().bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    return Number(bond?.order || 0);
  }, firstSingle);
  assert.equal(promoted, 2, 'First repeated Add bond did not promote the bond to double');

  await page.locator(`#chemEditorDialog [data-atom-id="${firstSingle.a}"]`).click();
  await page.locator(`#chemEditorDialog [data-atom-id="${firstSingle.b}"]`).click();
  promoted = await page.evaluate(({a,b}) => {
    const bond = window.MoleculeEditor.getCurrentGraph().bonds.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    return Number(bond?.order || 0);
  }, firstSingle);
  assert.equal(promoted, 3, 'Second repeated Add bond did not promote the bond to triple');

  // The atom-specific valence indicator should appear when the promoted structure exceeds a simple valence check.
  const warningCount = await page.locator('#chemEditorDialog .chem-editor-atom.valence-warning').count();
  assert(warningCount > 0, 'No atom-specific valence warning appeared after creating an over-valent template');
  const warningAtom = page.locator('#chemEditorDialog .chem-editor-atom.valence-warning').first();
  await warningAtom.click();
  const ignoreButton = page.locator('#chemIgnoreValence');
  assert.equal(await ignoreButton.isDisabled(), false, 'Ignore valence warning did not enable for the highlighted atom');
  await ignoreButton.click();

  // Smart geometry and Tidy 2D are present and functional.
  const smart = page.locator('#chemSmartLayoutToggle');
  assert.equal(await smart.getAttribute('aria-pressed'), 'true', 'Smart geometry is not enabled by default');
  await page.locator('#chemTidy2D').click();
  assert.match(await page.locator('#chemEditorStatus').innerText(), /tidied/i, 'Tidy 2D did not run');

  // 3D must be opt-in, then become an interactive split view.
  assert.equal(await page.locator('#chem3DPanel').isVisible(), false, '3D panel was visible before Show in 3D');
  await page.locator('#chem3DToggle').click();
  await page.waitForFunction(() => !document.querySelector('#chem3DPanel')?.hidden);
  assert.equal(await page.locator('#chem3DPanel').isVisible(), true, '3D panel did not open');
  assert.equal(await page.locator('.chem-editor-workspace').evaluate(el => el.classList.contains('with-3d')), true, '3D split class was not enabled');
  const canvas = page.locator('#chem3DCanvas');
  const box = await canvas.boundingBox();
  assert(box && box.width > 250 && box.height > 250, '3D canvas is not usable');
  await page.mouse.move(box.x + box.width * .45, box.y + box.height * .45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .60, box.y + box.height * .55, { steps: 4 });
  await page.mouse.up();
  await canvas.hover();
  await page.mouse.wheel(0, -180);
  await page.locator('#chem3DToggle').click();
  assert.equal(await page.locator('#chem3DPanel').isVisible(), false, 'Hide 3D did not restore the single-workspace view');

  await page.locator('#chemEditorClose').click();
  await page.waitForFunction(() => !document.querySelector('#chemEditorDialog')?.open);

  // Path 2: blank / Draw your own workspace must use the same correct layout.
  await page.evaluate(() => window.MoleculeEditor.openBlank());
  await page.waitForSelector('#chemEditorDialog[open]');
  snap = await layoutSnapshot();
  assertFullWorkspace(snap, 'Blank editor');
  assert.equal(await page.locator('#chemEditorSvg').isVisible(), true, 'Blank drawing canvas is not visible');

  assert.equal(errors.length, 0, `Browser errors detected:\n${errors.join('\n')}`);
  console.log('Molecular drawing workspace regression: PASS');
} finally {
  await page.screenshot({ path: '/tmp/molecular-drawing-workspace.png', fullPage: true }).catch(() => {});
  await browser.close();
}
