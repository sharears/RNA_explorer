import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const errors = [];
const diagnostics = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error' && !/favicon/i.test(text)) errors.push('console: ' + text);
  if (msg.type() === 'warning' || /OpenBabel|force-field|WebAssembly|wasm/i.test(text)) diagnostics.push(`${msg.type()}: ${text}`);
});

function ringGraph(name, orders) {
  const radius = 82;
  const atoms = Array.from({ length: 6 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 3;
    return { id: `c${i + 1}`, element: 'C', x: 320 + Math.cos(angle) * radius, y: 230 + Math.sin(angle) * radius, charge: 0, label: 'C' };
  });
  const bonds = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, a: `c${i + 1}`, b: `c${(i + 1) % 6 + 1}`, order: orders[i] }));
  return { name, atoms, bonds, hbonds: [] };
}

const graphs = {
  benzene: ringGraph('benzene', [2, 1, 2, 1, 2, 1]),
  cyclohexene: ringGraph('cyclohexene', [2, 1, 1, 1, 1, 1])
};

function dihedral(a, b, c, d) {
  const sub = (u, v) => [u.x - v.x, u.y - v.y, u.z - v.z];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const norm = u => Math.hypot(...u) || 1;
  const scale = (u, s) => u.map(x => x * s);
  const b0 = scale(sub(a, b), -1), b1 = sub(c, b), b2 = sub(d, c);
  const b1n = scale(b1, 1 / norm(b1));
  const v = subVec(b0, scale(b1n, dot(b0, b1n)));
  const w = subVec(b2, scale(b1n, dot(b2, b1n)));
  const x = dot(v, w), y = dot(cross(b1n, v), w);
  return Math.atan2(y, x) * 180 / Math.PI;
}
function subVec(a, b) { return a.map((x, i) => x - b[i]); }
function planarityDeviation(angle) {
  const a = Math.abs(angle);
  return Math.min(a, Math.abs(180 - a));
}
function heavyRingStats(model) {
  const byId = new Map(model.atoms.map(a => [a.id, a]));
  const ring = Array.from({ length: 6 }, (_, i) => byId.get(`c${i + 1}`));
  assert(ring.every(Boolean), 'Optimized model did not preserve the six heavy-atom IDs.');
  const torsions = Array.from({ length: 6 }, (_, i) => dihedral(ring[i], ring[(i + 1) % 6], ring[(i + 2) % 6], ring[(i + 3) % 6]));
  const deviations = torsions.map(planarityDeviation);
  const distances = Array.from({ length: 6 }, (_, i) => {
    const a = ring[i], b = ring[(i + 1) % 6];
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  });
  return { torsions, deviations, distances, maxDeviation: Math.max(...deviations), maxAbsZ: Math.max(...ring.map(a => Math.abs(a.z))) };
}

async function generateWithTiming(name, graph) {
  const started = Date.now();
  const result = await page.evaluate(async input => {
    try {
      const model = await Chemistry3DForceField.generate(input);
      return { ok: true, model };
    } catch (error) {
      return { ok: false, message: String(error?.message || error), stack: String(error?.stack || ''), moduleType: typeof window.OpenBabelModule, engine: Chemistry3DForceField.getEngineInfo() };
    }
  }, graph);
  const elapsedMs = Date.now() - started;
  console.log(`${name} force-field generation: ${elapsedMs} ms`);
  assert.equal(result.ok, true, `${name} OpenBabel optimization failed after ${elapsedMs} ms: ${JSON.stringify(result)}\n${diagnostics.join('\n')}`);
  return { ...result.model, elapsedMs };
}

try {
  await page.goto(`${BASE}/?page=drawing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof MoleculeEditor !== 'undefined' && typeof Chemistry3DForceField !== 'undefined', null, { timeout: 10000 });

  // Verify the control is genuinely discoverable in the user's default UI.
  await page.evaluate(() => MoleculeEditor.openBase('A'));
  await page.waitForSelector('#chemEditorDialog[open]', { state: 'visible' });
  const show3d = page.locator('#chem3DToggle');
  assert.equal(await show3d.isVisible(), true, 'Show in 3D is not visible by default.');
  assert.equal(await show3d.evaluate(el => Boolean(el.closest('details'))), false, 'Show in 3D is still buried in a collapsible details section.');
  await show3d.click();
  await page.waitForSelector('#chem3DPanel:not([hidden])', { state: 'visible' });
  assert.match(await page.locator('#chem3DPanel').innerText(), /Geometry-optimized 3D/i, '3D panel is not labeled as geometry optimized.');
  assert.equal((await page.locator('#chem3DCanvas').boundingBox())?.width > 250, true, '3D canvas is not visibly rendered.');
  // Do not wait for the adenine optimization here: the chemistry engine is tested
  // directly below using the two structures that motivated this change.
  await show3d.click();

  const benzene = await generateWithTiming('benzene', graphs.benzene);
  const cyclohexene = await generateWithTiming('cyclohexene', graphs.cyclohexene);
  const results = { benzene, cyclohexene };

  for (const [name, model] of Object.entries(results)) {
    assert.match(model.forceField, /^(MMFF94|UFF)$/, `${name}: unexpected force field ${model.forceField}`);
    assert.equal(model.source, 'OpenBabel WebAssembly', `${name}: wrong 3D engine source`);
    assert(model.atoms.length >= 6, `${name}: optimized structure has too few atoms`);
    assert(model.bonds.length >= 6, `${name}: optimized structure has too few bonds`);
    const stats = heavyRingStats(model);
    assert(stats.distances.every(d => d > 1.15 && d < 1.75), `${name}: implausible heavy-atom bond length(s): ${JSON.stringify(stats.distances)}`);
    model._stats = stats;
  }

  // Directly cover the user's reported problem: benzene should stay planar,
  // while cyclohexene should pucker rather than remaining the same flat hexagon.
  assert(benzene._stats.maxDeviation < 12, `benzene is not planar enough: ${JSON.stringify(benzene._stats)}`);
  assert(cyclohexene._stats.maxDeviation > 12, `cyclohexene remained too planar: ${JSON.stringify(cyclohexene._stats)}`);

  const engine = await page.evaluate(() => Chemistry3DForceField.getEngineInfo());
  assert.equal(engine.primary, 'MMFF94');
  assert.equal(engine.fallback, 'UFF');

  const serious = errors.filter(x => !/ResizeObserver loop/i.test(x));
  assert.equal(serious.length, 0, `Browser errors detected:\n${serious.join('\n')}`);
  console.log('Geometry-aware 3D browser regression: PASS');
  console.log(JSON.stringify({
    engine,
    benzene: { forceField: benzene.forceField, elapsedMs: benzene.elapsedMs, stats: benzene._stats },
    cyclohexene: { forceField: cyclohexene.forceField, elapsedMs: cyclohexene.elapsedMs, stats: cyclohexene._stats }
  }, null, 2));
} finally {
  await page.screenshot({ path: '/tmp/geometry-aware-3d.png', fullPage: true }).catch(() => {});
  await browser.close();
}
