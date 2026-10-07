import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  if(await page.locator('#rnaFactStrip').count()!==1)throw new Error('Did-you-know fact strip is missing');
  if(await page.locator('[data-flashcard-level]').count()!==4)throw new Error('Expected four flashcard levels');
  const counts=await page.evaluate(()=>RNAExplorerLearningTools.getDeckCounts());
  for(const [key,count] of Object.entries(counts))if(count!==20)throw new Error(`${key} has ${count} cards instead of 20`);
  for(const key of ['starter','explorer','investigator','expert']){
    await page.click(`[data-flashcard-level="${key}"]`);
    const progress=(await page.locator('#flashcardProgress').textContent())||'';
    if(!progress.includes('1 / 20'))throw new Error(`Bad ${key} progress: ${progress}`);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>2)throw new Error(`Mobile homepage overflows horizontally by ${overflow}px`);

  await page.setViewportSize({width:1280,height:900});
  await page.goto('http://127.0.0.1:4173/?page=secondary&start=example',{waitUntil:'networkidle'});
  await page.waitForSelector('#seTransformToolbar');
  await page.locator('#seWholeRotation').evaluate(el=>{el.value='45';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const rotation=await page.evaluate(()=>SecondaryExplorer.getTransformState().wholeRotation);
  if(rotation!==45)throw new Error(`Whole rotation did not update: ${rotation}`);

  await page.click('#seLassoSelectTool');
  const node=page.locator('#secondarySvg .se-node').nth(0),box=await node.boundingBox();
  if(!box)throw new Error('Could not locate a secondary-structure nucleotide');
  const cx=box.x+box.width/2,cy=box.y+box.height/2,r=Math.max(18,Math.max(box.width,box.height)*.8);
  const pts=[[cx-r,cy-r],[cx+r,cy-r],[cx+r,cy+r],[cx-r,cy+r],[cx-r,cy-r]];
  await page.mouse.move(...pts[0]);await page.mouse.down();for(const [x,y] of pts.slice(1))await page.mouse.move(x,y,{steps:4});await page.mouse.up();await page.waitForTimeout(150);
  const lassoSelected=await page.evaluate(()=>SecondaryExplorer.getContext().selectedResidues.length);
  if(lassoSelected<1)throw new Error('Lasso selected no residues');

  await page.evaluate(()=>{SecondaryExplorer.highlightResidues([0,1,2]);SecondaryExplorer.setWholeRotation(0);SecondaryExplorer.setSelectionTransform({rotation:0,scale:1});});
  const before=await page.evaluate(()=>SecondaryExplorer.getCurrentPositions());
  await page.locator('#seSelectedRotation').evaluate(el=>{el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#seSelectedScale').evaluate(el=>{el.value='1.35';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const after=await page.evaluate(()=>SecondaryExplorer.getCurrentPositions());
  const moved=Math.hypot(after[0].x-before[0].x,after[0].y-before[0].y);
  const untouched=Math.hypot(after[10].x-before[10].x,after[10].y-before[10].y);
  if(moved<1)throw new Error('Selected regional transform did not move selected residues');
  if(untouched>1e-6)throw new Error(`Unselected residue moved during regional transform: ${untouched}`);

  await page.click('#seBoxSelectTool');
  const boxNode=page.locator('#secondarySvg .se-node').nth(5),b=await boxNode.boundingBox();if(!b)throw new Error('Could not locate node for box selection');
  await page.mouse.move(b.x-4,b.y-4);await page.mouse.down();await page.mouse.move(b.x+b.width+4,b.y+b.height+4,{steps:6});await page.mouse.up();await page.waitForTimeout(120);
  const boxSelected=await page.evaluate(()=>SecondaryExplorer.getContext().selectedResidues.length);
  if(boxSelected<1)throw new Error('Box select selected no residues');

  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));if(serious.length)throw new Error('Browser errors:\n'+serious.join('\n'));
  console.log(JSON.stringify({result:'PASS',flashcardCounts:counts,lassoSelected,boxSelected,rotation}));
} finally {await browser.close();}
