import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

try {
  await page.goto('http://127.0.0.1:4173/?page=secondary&start=example', { waitUntil: 'networkidle' });
  await page.waitForSelector('#seTransformToolbar', { state: 'visible' });

  const result = await page.evaluate(() => {
    const ids = [0, 1, 2, 3, 4];
    SecondaryExplorer.highlightResidues(ids);
    SecondaryExplorer.setSelectionTransform({ rotation: 37, scale: 1.42 });
    const transformed = SecondaryExplorer.getCurrentPositions().map(point => ({ ...point }));

    SecondaryExplorer.clearHighlights();
    const afterClear = SecondaryExplorer.getCurrentPositions().map(point => ({ ...point }));
    const stateAfterClear = SecondaryExplorer.getTransformState();

    SecondaryExplorer.highlightResidues(ids);
    const afterReselect = SecondaryExplorer.getCurrentPositions().map(point => ({ ...point }));

    const maxClear = Math.max(...ids.map(index => Math.hypot(
      transformed[index].x - afterClear[index].x,
      transformed[index].y - afterClear[index].y
    )));
    const maxReselect = Math.max(...ids.map(index => Math.hypot(
      transformed[index].x - afterReselect[index].x,
      transformed[index].y - afterReselect[index].y
    )));
    return { maxClear, maxReselect, stateAfterClear };
  });

  if (result.maxClear > 0.02) throw new Error(`Selection snapped after clear: ${result.maxClear}`);
  if (result.maxReselect > 0.02) throw new Error(`Selection moved after reselect: ${result.maxReselect}`);
  if (Math.abs(result.stateAfterClear.selectionRotation) > 1e-8 || Math.abs(result.stateAfterClear.selectionScale - 1) > 1e-8) {
    throw new Error('Temporary selection transform was not reset after commit');
  }

  const serious = errors.filter(value => !/favicon|ResizeObserver loop/i.test(value));
  if (serious.length) throw new Error(`Browser errors:\n${serious.join('\n')}`);
  console.log(JSON.stringify({ result: 'PASS', ...result }));
} finally {
  await browser.close();
}
