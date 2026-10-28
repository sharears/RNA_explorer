import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
async function trial(settings,mobile){
 const context=await browser.newContext(settings),page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 const check=(ok,msg)=>{if(!ok)throw Error((mobile?"MOBILE ":"DESKTOP ")+msg);};
 try{
  await page.goto(base+"?page=journey&scene=secondary",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#gpsSecondaryExplore");
  const state=await page.evaluate(()=>{
   const scene=document.getElementById("scene-secondary"),m=GuidedSecondaryLearning.getMotifs();
   return {ids:[...scene.children].map(c=>c.id),counts:Object.fromEntries(["stem","hairpin","hairpinLoop","internal","bulge","junction"].map(t=>[t,m.filter(x=>x.type===t).length]))};
  });
  check(JSON.stringify(state.counts)===JSON.stringify({stem:4,hairpin:3,hairpinLoop:3,internal:0,bulge:0,junction:1}),"Incorrect tRNA motif count "+JSON.stringify(state.counts));
  check(state.ids.indexOf("guidedSecondaryLesson")<state.ids.indexOf("gpsSecondaryExplore"),"Original base-pair lesson not preserved before new blocks");
  check(state.ids.indexOf("gpsSecondaryExplore")<state.ids.indexOf("gpsSecondaryLandmarks"),"Explore/Test order is wrong");
  check(await page.locator("#guidedSecondaryLesson").isVisible(),"Original base-pair lesson missing");
  check(await page.locator("#gpsGoToLinked3D").isVisible(),"Existing 3D link missing");
  check(await page.locator("#secondarySvg").isVisible(),"Original secondary figure missing");
  check(await page.locator("#gpsSecondaryLandmarksTitle").innerText()==="Can you recognize the parts of a secondary structure?","Test title missing");
  check(await page.locator("#gpsExploreTitle").innerText()==="Explore Secondary Structure Components","Explore title missing");
  for(const type of ["stem","hairpin","hairpinLoop","internal","bulge","junction"])
   check(await page.locator('[data-gps-explore="'+type+'"]').count()===1,"Missing "+type);
  await page.locator('[data-gps-explore="hairpin"]').click();
  check((await page.locator("#secondarySvg .se-node.multi-selected").count())===28,"Not all 3 minimal hairpins selected");
  check((await page.locator("#secondarySvg .se-pair.gps-motif-pair").count())===3,"Incorrect hairpin closing pairs");
  await page.locator("#gpsExploreNext").click();
  check((await page.locator("#gpsExploreCount").innerText()).includes("2 of 3"),"Next occurrence");
  check((await page.locator("#secondarySvg .se-node.multi-selected").count())===28,"Navigation lost other matches");
  await page.locator("#gpsExplorePrev").click();
  await page.locator('[data-gps-explore="hairpinLoop"]').click();
  check((await page.locator("#secondarySvg .se-node.multi-selected").count())===22,"Hairpin loop includes paired residues");
  check((await page.locator("#secondarySvg .se-pair.gps-motif-pair").count())===0,"Hairpin loop has highlighted pair");
  await page.locator('[data-gps-explore="stem"]').click();
  check((await page.locator("#secondarySvg .se-node.multi-selected").count())===42,"All 4 stems not shown");
  check((await page.locator("#secondarySvg .se-pair.gps-motif-pair").count())===21,"Incorrect stem pairs");
  await page.locator('[data-gps-explore="junction"]').click();
  check((await page.locator("#secondarySvg .se-pair.gps-motif-pair").count())===4,"Junction missing closing pair");
  for(const type of ["internal","bulge"]){
   check(!(await page.locator('[data-gps-explore="'+type+'"]').isDisabled()),type+" should be clickable");
   await page.locator('[data-gps-explore="'+type+'"]').click();
   check((await page.locator("#gpsExploreStatus").innerText()).includes("0 occurrences"),type+" no 0 feedback");
   check((await page.locator("#secondarySvg .se-node.multi-selected").count())===0,type+" invalid highlight");
  }
  await page.selectOption("#gpsTestType","hairpinLoop");
  const options=await page.locator("#gpsTestSize").evaluate(e=>[...e.options].map(o=>({value:o.value,disabled:o.disabled})));
  check(options.find(o=>o.value==="3")?.disabled&&options.find(o=>o.value==="4")?.disabled,"Unavailable sizes should be disabled");
  await page.selectOption("#gpsTestSize","7");
  await page.locator("#gpsTestStart").click();
  check((await page.locator("#secondarySvg .se-node.multi-selected").count())===0,"Challenge prematurely shows answer");
  for(let i=1;i<=3;i++){
   await page.locator("#gpsTestHint").click();
   check((await page.locator("#gpsTestFeedback").innerText()).includes("Hint "+i+" of 3"),"Wrong hint progression");
   check((await page.locator("#secondarySvg .se-node.multi-selected").count())===0,"Hint revealed answer");
  }
  const target=await page.evaluate(()=>GuidedSecondaryLearning.getMotifs().find(m=>m.type==="hairpinLoop"&&m.size===7).indices);
  if(!mobile){
   for(const i of target)await page.locator('#secondarySvg .se-node[data-residue-index="'+i+'"]').click();
   check((await page.locator("#secondarySvg .se-node.multi-selected").count())===target.length,"Single selection did not accumulate: "+JSON.stringify(await page.evaluate(()=>({selected:SecondaryExplorer.getContext().selectedResidues,feedback:document.getElementById("gpsTestFeedback").textContent,expected:GuidedSecondaryLearning.getMotifs().find(m=>m.type==="hairpinLoop"&&m.size===7).indices}))));
   await page.locator("#gpsTestCheck").click();
   check((await page.locator("#gpsTestFeedback").innerText()).includes("Correct!"),"Correct selection rejected");
  }else{
   await page.evaluate(()=>{window.__tapEvents=[];document.addEventListener("pointerdown",e=>window.__tapEvents.push({tag:e.target.tagName,node:e.target.closest?.(".se-node")?.dataset.residueIndex,button:e.button,pointerType:e.pointerType}),true);});
   await page.locator('#secondarySvg .se-node[data-residue-index="'+target[0]+'"]').tap();
   check((await page.locator("#secondarySvg .se-node.multi-selected").count())===1,"Phone tap did not select: "+JSON.stringify(await page.evaluate(()=>({events:window.__tapEvents,selected:SecondaryExplorer.getContext().selectedResidues,feedback:document.getElementById("gpsTestFeedback").textContent,phase:document.getElementById("scene-secondary").dataset.guidedMotif}))));
   await page.locator("#gpsTestReveal").tap();
   check((await page.locator("#secondarySvg .se-node.multi-selected").count())===target.length,"Phone Show answer did not work");
  }
  await page.locator("#gpsTestStop").click();
  await page.goto(base+"?page=secondary&start=example",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#secondarySvg .se-node");
  check((await page.locator("#gpsSecondaryExplore").count())===0,"Workspace gained learning panels");
  check((await page.locator("#secondarySvg .se-node").count())===76,"Workspace lost nucleotides");
  check(!errors.length,"Page exceptions "+errors.join(" | "));
  console.log("PASS "+(mobile?"phone":"desktop")+": original lessons, six motifs, all matches, tests and navigation");
 }finally{await context.close();}
}
try{
 await trial({viewport:{width:1440,height:900}},false);
 await trial({viewport:{width:390,height:844},hasTouch:true,isMobile:true},true);
}finally{await browser.close();}
