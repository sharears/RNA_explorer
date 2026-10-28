import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
function ok(condition,message){if(!condition)throw Error(message);}
try {
 await page.goto(process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/?page=secondary&start=example",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>typeof SecondaryMotifExplorer!=="undefined"&&SecondaryMotifExplorer.getMotifs().length>0);
 await page.locator('#scene-secondary [data-rna-tab="analyze"]').click();
 ok(await page.locator("#seMotifTools").isVisible(),"Motif panel not visible in Inspect tab");
 const ids=["stem","hairpin","hairpinLoop","internal","bulge","junction"];
 for(const type of ids)ok(await page.locator("#seMotifShow-"+type).isVisible(),"Missing button "+type);
 const motifs=await page.evaluate(()=>SecondaryMotifExplorer.getMotifs());
 const counts=Object.fromEntries(ids.map(id=>[id,motifs.filter(m=>m.type===id).length]));
 ok(JSON.stringify(counts)===JSON.stringify({stem:4,hairpin:3,hairpinLoop:3,internal:0,bulge:0,junction:1}),"Incorrect tRNA motif counts: "+JSON.stringify(counts));
 // Missing categories must be clickable (not disabled); show explicit zero feedback.
 ok(!(await page.locator("#seMotifShow-internal").isDisabled()),"Missing internal loop option is disabled");
 ok(!(await page.locator("#seMotifShow-bulge").isDisabled()),"Missing bulge option is disabled");
 await page.locator("#seMotifShow-internal").click();
 ok((await page.locator("#seMotifStatus").textContent()).includes("0 occurrences"),"Missing zero-occurrence feedback");
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===0,"Nonexistent loop was highlighted");
 // Hairpins = 3 complete terminal loops plus their 3 closing pairs; no whole stems.
 await page.locator("#seMotifShow-hairpin").click();
 const hairpins=motifs.filter(m=>m.type==="hairpin");
 const hairpinNucleotides=new Set(hairpins.flatMap(m=>m.indices)).size;
 ok(hairpinNucleotides===28,"Unexpected hairpin extent: "+hairpinNucleotides);
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===hairpinNucleotides,"Not all hairpins outlined");
 ok((await page.locator("#secondarySvg .se-motif-pair").count())===3,"Only the three hairpin closing pairs should be highlighted");
 ok((await page.locator("#seMotifCounter").textContent())==="1 of 3","Incorrect initial hairpin navigator");
 await page.locator("#seMotifNext").click();
 ok((await page.locator("#seMotifCounter").textContent())==="2 of 3","Next motif did not advance");
 await page.locator("#seMotifPrev").click();
 ok((await page.locator("#seMotifCounter").textContent())==="1 of 3","Previous motif did not reverse");
 ok((await page.locator("#seMotifDetails").textContent()).includes("closing base pair"),"Missing educational explanation");
 // Selecting one highlighted nucleotide should show its motif information without
 // removing highlighting on other motifs or switching away to Display.
 const second=hairpins[1].indices[Math.floor(hairpins[1].indices.length/2)];
 await page.locator('#secondarySvg [data-residue-index="'+second+'"]').click();
 ok((await page.locator("#seMotifCounter").textContent())==="2 of 3","Click to learn didn't focus clicked motif");
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===28,"Click-to-learn lost other hairpin highlights");
 // Hairpin Loop excludes closing bases and all stems.
 await page.locator("#seMotifShow-hairpinLoop").click();
 const loopCount=new Set(motifs.filter(m=>m.type==="hairpinLoop").flatMap(m=>m.indices)).size;
 ok(loopCount===22,"Unexpected loop-only extent: "+loopCount);
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===loopCount,"Loop-only mode highlighted closing bases");
 ok((await page.locator("#secondarySvg .se-motif-pair").count())===0,"Loop-only mode highlighted base pairs");
 // Every stem, including three ending in hairpins and the acceptor stem.
 await page.locator("#seMotifShow-stem").click();
 const stemCount=new Set(motifs.filter(m=>m.type==="stem").flatMap(m=>m.indices)).size;
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===stemCount,"Some stems were not highlighted");
 ok((await page.locator("#secondarySvg .se-motif-pair").count())===21,"Not all 21 stem base pairs highlighted");
 await page.locator('[data-secondary-layout="circular"]').click();
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===stemCount,"Stems highlights didn't survive changing layout");
 // Junction should remain selectable separately.
 await page.locator("#seMotifShow-junction").click();
 ok((await page.locator("#secondarySvg .se-motif-pair").count())===motifs.find(m=>m.type==="junction").pairs.length,"Junction closing pairs missing");
 // Challenge: no answer shown until user checks or explicitly asks for it.
 await page.locator("#seMotifShow-hairpinLoop").click();
 await page.selectOption("#seMotifType","hairpinLoop");
 const sizeOptions=await page.locator("#seMotifSize").evaluate(e=>[...e.options].map(o=>({value:o.value,disabled:o.disabled})));
 ok(sizeOptions.find(o=>o.value==="3")?.disabled&&sizeOptions.find(o=>o.value==="4")?.disabled,"Unavailable 3/4nt options should be disabled");
 await page.selectOption("#seMotifSize","7");
 await page.locator("#seMotifStart").click();
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===0,"Challenge gave away solution");
 for(let hint=1;hint<=3;hint++){
  await page.locator("#seMotifHint").click();
  ok((await page.locator("#seMotifStatus").textContent()).includes("Hint "+hint+" of 3"),"Hint progression failed at "+hint);
  ok((await page.locator("#secondarySvg .se-motif-ring").count())===0,"Hint revealed solution before check");
 }
 ok(await page.locator("#seMotifHint").isDisabled(),"Hints should stop after level three");
 const target=motifs.find(m=>m.type==="hairpinLoop"&&m.size===7).indices;
 for(const residue of target)await page.locator('#secondarySvg [data-residue-index="'+residue+'"]').click();
 ok((await page.evaluate(()=>SecondaryExplorer.getContext().selectedResidues.length))===target.length,"Individual challenge clicks did not add together");
 await page.locator("#seMotifCheck").click();
 ok((await page.locator("#seMotifStatus").textContent()).includes("Correct!"),"Correct challenge answer rejected");
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===target.length,"Submitted answer not highlighted");
 await page.locator("#seMotifStop").click();
 // Changing input recomputes motif options and clears stale highlights.
 await page.fill("#secondarySequence","AAAAAAAA");
 await page.fill("#secondaryDotBracket","(.(..).)");
 await page.locator("#renderSecondaryButton").click();
 await page.waitForFunction(()=>SecondaryMotifExplorer.getMotifs().some(m=>m.type==="internal"));
 await page.locator("#seMotifShow-internal").click();
 ok((await page.locator("#secondarySvg .se-motif-ring").count())===2,"Internal loop must include exactly two unpaired residues");
 const fatal=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
 ok(!fatal.length,"Page errors: "+fatal.join("; "));
 console.log("PASS: all eight updates, tRNA motifs, zero-count choices, explanations, cycling and hints");
} finally {await browser.close();}
