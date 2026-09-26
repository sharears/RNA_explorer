import { chromium } from "playwright";

const base=process.env.RNA_EXPLORER_URL||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on("pageerror",err=>errors.push(String(err)));
page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});

try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="home"] .home-cover',{state:"visible",timeout:10000});
  const image=page.locator(".home-cover-art img");
  await image.waitFor({state:"visible",timeout:10000});
  const dims=await image.evaluate(img=>({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}));
  if(dims.naturalWidth<400||dims.naturalHeight<400)throw new Error("Homepage cover image did not load at expected resolution: "+JSON.stringify(dims));

  const title=(await page.locator("#homeCoverTitle").textContent())||"";
  if(!/RNA structure/i.test(title)||!/minus the fuss/i.test(title))throw new Error("Homepage hero headline is missing.");

  for(const selector of ["#saveProjectButton","#openProjectButton","#siteSearchButton"]){
    if(await page.locator(selector).count()!==1)throw new Error("Homepage must contain exactly one "+selector+" control.");
    if(!(await page.locator(selector).isVisible()))throw new Error(selector+" should be visible on the homepage.");
  }
  if(await page.locator("#projectSaveButton,#projectOpenButton").count())throw new Error("Legacy duplicate project controls should never be injected.");
  const saveBefore=await page.locator("#saveProjectButton").evaluate(el=>getComputedStyle(el,"::before").content);
  const openBefore=await page.locator("#openProjectButton").evaluate(el=>getComputedStyle(el,"::before").content);
  const searchBefore=await page.locator("#siteSearchButton").evaluate(el=>getComputedStyle(el,"::before").content);
  if(!["none","normal",'""'].includes(saveBefore)||!["none","normal",'""'].includes(openBefore))throw new Error("Save/Open Project must not show a search icon.");
  if(["none","normal",'""'].includes(searchBefore))throw new Error("Only Search should show the magnifying/search icon.");

  const thought=((await page.locator(".home-thought-bubble").textContent())||"").replace(/\s+/g," ").trim();
  if(!thought.includes("A little editing here")||!thought.includes("a better base pair there")||!thought.includes("RNA makes sense!"))
    throw new Error("Thought bubble copy is missing or changed: "+thought);

  const cards=await page.locator(".home-path-card").count();
  if(cards!==0)throw new Error("Redundant homepage Learn/Analyze cards should be removed; found "+cards);
  const learn=page.locator('.home-cover-actions a[href="?page=journey"]');
  const learnHref=await learn.getAttribute("href");
  if(learnHref!=="?page=journey")throw new Error("Learn RNA structure should open the guided journey.");
  const analyze=page.locator("#homeAnalyzeToggle"),fork=page.locator("#homeAnalyzeFork");
  if(((await analyze.textContent())||"").trim()!=="Analyze RNA structure")throw new Error("Homepage analysis action should be labeled 'Analyze RNA structure'.");
  const buttonStyles=await page.evaluate(()=>{
    const a=getComputedStyle(document.querySelector('.home-cover-actions a[href="?page=journey"]'));
    const b=getComputedStyle(document.querySelector("#homeAnalyzeToggle"));
    return {learnBg:a.backgroundColor,analyzeBg:b.backgroundColor,learnBorder:a.borderColor,analyzeBorder:b.borderColor};
  });
  if(buttonStyles.learnBg!==buttonStyles.analyzeBg||buttonStyles.learnBorder!==buttonStyles.analyzeBorder)throw new Error("Learn and Analyze homepage actions should use the same solid-green style: "+JSON.stringify(buttonStyles));
  await analyze.click();
  if(await fork.isHidden())throw new Error("Analyze RNA structure should reveal the 2D/3D fork.");
  const choices=await fork.locator("a").evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute("href"),text:n.textContent.trim()})));
  if(JSON.stringify(choices)!==JSON.stringify([{href:"?page=secondary",text:"2D"},{href:"?page=tertiary",text:"3D"}]))throw new Error("Analyze fork should contain only the 2D and 3D choices: "+JSON.stringify(choices));
  const placement=await page.evaluate(()=>{
    const a=document.querySelector("#homeAnalyzeToggle").getBoundingClientRect(),f=document.querySelector("#homeAnalyzeFork").getBoundingClientRect();
    return {analyzeBottom:a.bottom,forkTop:f.top,centerDelta:Math.abs((a.left+a.right)/2-(f.left+f.right)/2)};
  });
  if(placement.forkTop<placement.analyzeBottom-2||placement.centerDelta>3)throw new Error("2D/3D choices should be centered directly below Analyze RNA structure: "+JSON.stringify(placement));

  await page.goto(new URL("?page=secondary",base).href,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForSelector('body[data-page-mode="secondary"] #innerNav:not([hidden])',{timeout:10000});
  const navOrder=await page.locator("#innerNav").evaluate(nav=>[...nav.children].filter(el=>getComputedStyle(el).display!=="none").map(el=>{
    if(el.classList.contains("nav-menu"))return el.querySelector(":scope > button")?.textContent.trim();
    return el.textContent.trim();
  }));
  if(JSON.stringify(navOrder)!==JSON.stringify(["Home","Save Project","Open Project","Learn","Feedback & Questions","Search"]))throw new Error("Workspace top navigation order is wrong: "+JSON.stringify(navOrder));
  if(await page.locator("#saveProjectButton").count()!==1||await page.locator("#openProjectButton").count()!==1)throw new Error("Workspace must contain exactly one Save Project and one Open Project control.");

  const searchButton=page.locator("#siteSearchButton");
  await searchButton.click();
  await page.fill("#siteSearchInput","generate 2D");
  const generateResult=page.locator(".site-search-result").filter({hasText:"Generate 2D from 3D"}).first();
  if(await generateResult.count()!==1)throw new Error("Global search did not find the 3D → 2D tool.");
  await generateResult.click();
  await page.waitForSelector('body[data-page-mode="tertiary"] #scene-tertiary:not([hidden])',{timeout:10000});
  if(!(await page.locator("#teGenerateSecondary").isVisible()))throw new Error("Global search did not navigate to the 3D → 2D control.");

    const serious=errors.filter(x=>!/favicon|ResizeObserver loop/i.test(x));
  if(serious.length)throw new Error("Homepage browser runtime errors:\n"+serious.join("\n"));
  console.log("PASS: homepage cover image and navigation smoke test");
} finally {
  await browser.close();
}
