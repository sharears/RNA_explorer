import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.RNA_EXPLORER_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error' && !/favicon/i.test(text)) errors.push('console: ' + text);
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
  cyclohexene: ringGraph('cyclohexene', [2, 1, 1, 1, 1, 1]),
  cyclohexane: ringGraph('cyclohexane', [1, 1, 1, 1, 1, 1])
};

function sub(a, b) { return [a.x - b.x, a.y - b.y, a.z - b.z]; }
function cross(u, v) { return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; }
function dot(u, v) { return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; }
function norm(u) { return Math.hypot(...u) || 1; }
function scale(u, s) { return u.map(x => x * s); }
function subVec(a, b) { return a.map((x, i) => x - b[i]); }
function dihedral(a, b, c, d) {
  const b0 = scale(sub(a, b), -1), b1 = sub(c, b), b2 = sub(d, c);
  const b1n = scale(b1, 1 / norm(b1));
  const v = subVec(b0, scale(b1n, dot(b0, b1n)));
  const w = subVec(b2, scale(b1n, dot(b2, b1n)));
  return Math.atan2(dot(cross(b1n, v), w), dot(v, w)) * 180 / Math.PI;
}
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
  return { torsions, deviations, distances, maxDeviation: Math.max(...deviations), zRange: Math.max(...ring.map(a => a.z)) - Math.min(...ring.map(a => a.z)) };
}

async function generate(name, graph) {
  const started = Date.now();
  const result = await page.evaluate(async input => {
    try {
      const model = await Chemistry3DForceField.generate(input);
      return { ok: true, model };
    } catch (error) {
      return { ok: false, message: String(error?.message || error), stack: String(error?.stack || ''), engine: Chemistry3DForceField.getEngineInfo() };
    }
  }, graph);
  const elapsedMs = Date.now() - started;
  assert.equal(result.ok, true, `${name} MMFF94 optimization failed after ${elapsedMs} ms: ${JSON.stringify(result)}`);
  console.log(`${name}: ${elapsedMs} ms, ${result.model.forceField}`);
  return { ...result.model, elapsedMs };
}

try {
  await page.goto(`${BASE}/?page=drawing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof MoleculeEditor !== 'undefined' && typeof Chemistry3DForceField !== 'undefined', null, { timeout: 10000 });

  const engine = await page.evaluate(() => Chemistry3DForceField.getEngineInfo());
  assert.equal(engine.name, 'OpenChemLib');
  assert.equal(engine.primary, 'MMFF94');
  assert.equal(engine.uffAvailable, false);

  const benzene = await generate('benzene', graphs.benzene);
  const cyclohexene = await generate('cyclohexene', graphs.cyclohexene);
  const cyclohexane = await generate('cyclohexane', graphs.cyclohexane);

  for (const [name, model] of Object.entries({ benzene, cyclohexene, cyclohexane })) {
    assert.equal(model.forceField, 'MMFF94', `${name}: unexpected force field ${model.forceField}`);
    assert.equal(model.source, 'OpenChemLib', `${name}: wrong 3D engine source`);
    assert(model.atoms.length >= 6, `${name}: optimized structure has too few atoms`);
    assert(model.bonds.length >= 6, `${name}: optimized structure has too few bonds`);
    const stats = heavyRingStats(model);
    assert(stats.distances.every(d => d > 1.15 && d < 1.75), `${name}: implausible heavy-atom bond length(s): ${JSON.stringify(stats.distances)}`);
    model._stats = stats;
  }

  // Directly cover the reported failure: aromatic benzene stays planar while
  // partially/saturated six-membered rings pucker in 3D.
  assert(benzene._stats.maxDeviation < 12, `benzene is not planar enough: ${JSON.stringify(benzene._stats)}`);
  assert(cyclohexene._stats.maxDeviation > 12 && cyclohexene._stats.zRange > 0.2, `cyclohexene remained too planar: ${JSON.stringify(cyclohexene._stats)}`);
  assert(cyclohexane._stats.maxDeviation > 20 && cyclohexane._stats.zRange > 0.4, `cyclohexane remained too planar: ${JSON.stringify(cyclohexane._stats)}`);

  // Verify the control is visible in the normal UI and the actual viewer reaches
  // an MMFF94 result instead of merely testing the engine in isolation.
  await page.evaluate(() => MoleculeEditor.openBase('A'));
  await page.waitForSelector('#chemEditorDialog[open]', { state: 'visible' });
  const show3d = page.locator('#chem3DToggle');
  assert.equal(await show3d.isVisible(), true, 'Show in 3D is not visible by default.');
  assert.equal(await show3d.evaluate(el => Boolean(el.closest('details'))), false, 'Show in 3D is buried in a collapsible details section.');
  await show3d.click();
  await page.waitForSelector('#chem3DPanel:not([hidden])', { state: 'visible' });
  assert.match(await page.locator('#chem3DPanel').innerText(), /Geometry-optimized 3D/i);
  await page.waitForFunction(() => /MMFF94 optimized/.test(document.querySelector('#chem3DStatus')?.textContent || ''), null, { timeout: 30000 });

  // PyMOL-like stick rendering: thick half-bonds are colored by element. For
  // adenine we expect carbon gray, nitrogen blue and generated hydrogen white.
  const colorCounts = await page.locator('#chem3DCanvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d'), data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const targets = { carbon:[139,145,152], nitrogen:[48,80,248], hydrogen:[244,244,244] };
    const counts = { carbon:0, nitrogen:0, hydrogen:0 };
    for (let i = 0; i < data.length; i += 4) {
      for (const [name, rgb] of Object.entries(targets)) {
        if (Math.abs(data[i]-rgb[0]) < 4 && Math.abs(data[i+1]-rgb[1]) < 4 && Math.abs(data[i+2]-rgb[2]) < 4 && data[i+3] > 200) counts[name]++;
      }
    }
    return counts;
  });
  assert(colorCounts.carbon > 20, `carbon stick color not detected: ${JSON.stringify(colorCounts)}`);
  assert(colorCounts.nitrogen > 20, `nitrogen stick color not detected: ${JSON.stringify(colorCounts)}`);
  assert(colorCounts.hydrogen > 10, `hydrogen stick color not detected: ${JSON.stringify(colorCounts)}`);

  const serious = errors.filter(x => !/ResizeObserver loop/i.test(x));
  assert.equal(serious.length, 0, `Browser errors detected:\n${serious.join('\n')}`);
  console.log('Geometry-aware 3D browser regression: PASS');
  console.log(JSON.stringify({ engine, colorCounts, benzene:benzene._stats, cyclohexene:cyclohexene._stats, cyclohexane:cyclohexane._stats }, null, 2));
} finally {
  await page.screenshot({ path: '/tmp/geometry-aware-3d.png', fullPage: true }).catch(() => {});
  await browser.close();
}
