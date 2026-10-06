import { chromium } from "playwright";
const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on("pageerror",e=>errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
const screenPoint=async(x,y)=>page.locator('#chemEditorSvg').evaluate((svg,p)=>{const pt=svg.createSVGPoint();pt.x=p.x;pt.y=p.y;const q=pt.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
try{
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.waitForSelector('#tutorials');
  if(!(await page.locator('#tutorials').isVisible()))throw new Error('Tutorial gallery is not visible on home.');
  await page.locator('[data-rna-tutorial="drawing"]').first().click();
  await page.waitForSelector('#rnaTutorialDialog[open]');
  await page.click('#rnaTutorialNext');await page.click('#rnaTutorialNext');
  if(!(await page.locator('#rnaTutorialOpen').isVisible()))throw new Error('Tutorial final action did not appear.');
  await page.click('#rnaTutorialClose');
  const question=(await page.locator('#flashcardText').textContent())?.trim();await page.click('#flashcardFlip');const answer=(await page.locator('#flashcardText').textContent())?.trim();if(!question||!answer||question===answer)throw new Error('Flashcard did not flip.');
  await page.click('#flashcardKnow');if(!((await page.locator('#flashcardScore').textContent())||'').includes('Known 1'))throw new Error('Flashcard known counter did not update.');

  await page.goto(base+'?page=drawing',{waitUntil:'domcontentloaded'});await page.click('#drawingOpenBlank');await page.waitForSelector('#chemEditorDialog[open]');
  const groups=await page.locator('.chem-tool-group>summary').allTextContents();for(const label of ['History','Select · Atoms & groups','Build · Atoms & bonds','Display · Labels & chemistry','View · Canvas'])if(!groups.includes(label))throw new Error('Missing molecular group '+label);
  await page.locator('[data-chem-tool="atom"]').click();
  for(const p of [[180,150],[350,150],[180,320],[380,320]]){const q=await screenPoint(...p);await page.mouse.click(q.x,q.y);}
  await page.locator('[data-chem-tool="lasso"]').click();
  const polygon=[[150,100],[450,350],[150,350],[150,100]];let q=await screenPoint(...polygon[0]);await page.mouse.move(q.x,q.y);await page.mouse.down();for(const p of polygon.slice(1)){q=await screenPoint(...p);await page.mouse.move(q.x,q.y,{steps:8});}await page.mouse.up();
  const selected=await page.locator('.chem-editor-atom.selected').count();if(selected!==3)throw new Error('True lasso expected 3 selected atoms, got '+selected);
  const secondSelected=await page.locator('.chem-editor-atom').nth(1).evaluate(el=>el.classList.contains('selected'));if(secondSelected)throw new Error('Lasso selected an atom inside the bounding rectangle but outside the freeform polygon.');
  const before=await page.locator('#chemEditorSvg').getAttribute('viewBox');await page.locator('.chem-tool-group>summary').filter({hasText:'View · Canvas'}).click();await page.click('#chemExpandCanvas');const after=await page.locator('#chemEditorSvg').getAttribute('viewBox');if(before===after)throw new Error('More canvas did not expand the viewBox.');await page.click('#chemFitCanvas');

  await page.goto(base+'?page=secondary&start=example',{waitUntil:'domcontentloaded'});await page.waitForSelector('.se-controls');
  const secMap=await page.locator('.se-controls .workspace-control-map button').allTextContents();if(secMap.join('|')!=='Display|Analyze')throw new Error('Secondary control navigation is inconsistent: '+secMap.join('|'));
  await page.goto(base+'?page=tertiary&start=custom',{waitUntil:'domcontentloaded'});await page.waitForSelector('.te-controls');
  const terMap=await page.locator('.te-controls .workspace-control-map button').allTextContents();for(const label of ['Import','Select','Display','Analyze','View'])if(!terMap.includes(label))throw new Error('Missing tertiary control category '+label);
  const summaries=await page.locator('.te-controls summary').allTextContents();for(const label of ['Import · Structure & mapping','Display · Structure','Select · Residues & ranges','Analyze · Measurements & contacts','View · Clipping'])if(!summaries.includes(label))throw new Error('Missing normalized 3D summary '+label);

  await page.goto(base+'?page=journey&scene=nucleotide',{waitUntil:'domcontentloaded'});await page.waitForSelector('#nucleotideDiagram');await page.waitForTimeout(2350);
  const gly=await page.locator('#nucleotideDiagram .glycosidic-bond').getAttribute('class'),pho=await page.locator('#nucleotideDiagram .phosphate-bond').getAttribute('class');if(!gly?.includes('prior-formed')||gly.includes('step-new'))throw new Error('Existing glycosidic bond is re-animated in nucleotide step.');if(!pho?.includes('step-new'))throw new Error('New phosphate bond is not marked as the only animated bond.');
  await page.goto(base+'?page=journey&scene=primary',{waitUntil:'domcontentloaded'});await page.waitForSelector('#chainGrowth');await page.waitForTimeout(1550);
  const links=page.locator('.growth-link .inter-nucleotide-link');if(await links.count()<1)throw new Error('Primary growth link did not appear.');
  await page.waitForTimeout(1450);const oldLink=page.locator('.growth-link:not(.new-growth-link) .inter-nucleotide-link').first();if(await oldLink.count()){const anim=await oldLink.evaluate(el=>getComputedStyle(el).animationName);if(anim!=='none')throw new Error('Earlier phosphodiester bond is re-animated: '+anim);}
  const factSize=parseFloat(await page.locator('.fact-label').first().evaluate(el=>getComputedStyle(el).fontSize));if(factSize<12)throw new Error('Readability pass left fact labels too small: '+factSize);
  const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));if(serious.length)throw new Error('Browser errors:\n'+serious.join('\n'));
  console.log(JSON.stringify({result:'PASS',tutorials:true,flashcards:true,lassoSelected:selected,canvasBefore:before,canvasAfter:after,secondaryGroups:secMap,tertiaryGroups:terMap}));
} finally {await browser.close();}
