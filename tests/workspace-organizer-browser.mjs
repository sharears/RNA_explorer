import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=tertiary&start=example";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource/i.test(m.text()))errors.push("console: "+m.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="tertiary"] #scene-tertiary:not([hidden])',{timeout:12000});
  await page.waitForSelector('#tertiaryControls .rna-tool-tabs',{timeout:12000});

  // Shared Select / Display / Analyze information architecture.
  const tabs=await page.locator('#tertiaryControls .rna-tool-tabs [data-rna-tab]').allTextContents();
  if(JSON.stringify(tabs)!==JSON.stringify(['Select','Display','Analyze']))throw new Error('Tertiary tool categories are not Select / Display / Analyze: '+JSON.stringify(tabs));
  if(await page.locator('#teUndo').count()!==1||await page.locator('#teRedo').count()!==1)throw new Error('Tertiary Undo / Redo controls are missing.');

  // Chain sequence dock should be above the 3D viewer controls and show index over base.
  await page.waitForSelector('#teSequenceDock #teSequencePanel .te-seq-residue',{state:'visible',timeout:20000});
  const dockOrder=await page.evaluate(()=>{
    const dock=document.querySelector('#teSequenceDock'),toolbar=document.querySelector('#tertiaryStage .te-toolbar');
    return !!dock&&!!toolbar&&Boolean(dock.compareDocumentPosition(toolbar)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  if(!dockOrder)throw new Error('Sequence dock is not positioned above the tertiary viewer toolbar.');
  const first=page.locator('#teSequencePanel .te-seq-residue').first();
  if(await first.locator('.rna-seq-index').count()!==1||await first.locator('.rna-seq-base').count()!==1)throw new Error('Sequence buttons do not show residue index above base identity.');
  const chainLabel=(await page.locator('#teSequenceDock .rna-chain-label').textContent())||'';
  if(!/Chain/i.test(chainLabel))throw new Error('Sequence dock chain label is missing: '+chainLabel);

  // Selection by sequence remains synced with the 3D selection state.
  const before=await page.evaluate(()=>TertiaryExplorer.getDiagnostics().selectionCount);
  await first.click();
  await page.waitForFunction(n=>TertiaryExplorer.getDiagnostics().selectionCount!==n,before,{timeout:8000});
  const after=await page.evaluate(()=>TertiaryExplorer.getDiagnostics().selectionCount);
  if(after===before)throw new Error('Clicking the sequence did not change the tertiary residue selection.');

  // Undo / redo must restore tertiary workspace selection state.
  await page.click('#teUndo');
  await page.waitForFunction(n=>TertiaryExplorer.getDiagnostics().selectionCount===n,before,{timeout:15000});
  await page.click('#teRedo');
  await page.waitForFunction(n=>TertiaryExplorer.getDiagnostics().selectionCount===n,after,{timeout:15000});

  // User-defined cutoff; no preset buttons. UI range requested for this iteration is 1–25 Å.
  await page.click('#tertiaryControls [data-rna-tab="select"]');
  const cutoff=page.locator('#teSelectNearCutoff');
  if(await cutoff.getAttribute('min')!=='1'||await cutoff.getAttribute('max')!=='25')throw new Error('Residue cutoff range is not 1–25 Å.');
  await cutoff.fill('7.3');
  if(await cutoff.inputValue()!=='7.3')throw new Error('Arbitrary cutoff entry is not accepted.');
  if(await page.locator('[data-cutoff-preset], .te-cutoff-preset').count())throw new Error('Unexpected cutoff preset buttons were added.');

  // Secondary uses the same three top-level categories and keeps history global.
  await page.goto(base.replace('page=tertiary','page=secondary'),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body[data-page-mode="secondary"] #scene-secondary:not([hidden])',{timeout:12000});
  await page.waitForSelector('#scene-secondary .se-controls .rna-tool-tabs',{timeout:12000});
  const secondaryTabs=await page.locator('#scene-secondary .se-controls .rna-tool-tabs [data-rna-tab]').allTextContents();
  if(JSON.stringify(secondaryTabs)!==JSON.stringify(['Select','Display','Analyze']))throw new Error('Secondary tool categories are not Select / Display / Analyze: '+JSON.stringify(secondaryTabs));
  if(await page.locator('#seUndo').count()!==1||await page.locator('#seRedo').count()!==1)throw new Error('Secondary Undo / Redo controls disappeared during regrouping.');

  // Molecular Drawing keeps the same plain Undo / Redo language.
  await page.evaluate(()=>MoleculeEditor.openBlank());
  await page.waitForSelector('#chemEditorDialog[open]',{state:'visible',timeout:8000});
  if((await page.locator('#chemUndoButton').textContent())?.trim()!=='Undo'||(await page.locator('#chemRedoButton').textContent())?.trim()!=='Redo')throw new Error('Molecular Drawing history labels are not standardized.');

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error('Browser errors:\n'+serious.join('\n'));
  console.log('PASS: workspace categories, tertiary history, sequence selection, cutoff input, and molecular history consistency');
} finally {
  await browser.close();
}
