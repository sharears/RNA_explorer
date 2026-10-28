/* Learn > Secondary Structure: two activities added after existing lessons.
 * The workspace itself is untouched. Dot-bracket defines pair topology.
 */
const GuidedSecondaryLearning=(()=>{
"use strict";
const TYPES=[["stem","Stem"],["hairpin","Hairpin"],["hairpinLoop","Hairpin Loop"],["internal","Internal Loop"],["bulge","Bulge Loop"],["junction","Multi-loop Junction"]];
const INFO={
 stem:"A stem is a run of at least three consecutive base pairs, including stems ending in hairpins.",
 hairpin:"A hairpin consists of a terminal unpaired loop and its ONE closing base pair, not the rest of the stem.",
 hairpinLoop:"A hairpin loop includes only unpaired nucleotides, without its closing base pair.",
 internal:"An internal loop has unpaired residues on both strands, with two flanking closing base pairs.",
 bulge:"A bulge loop has unpaired residues on one strand, with two flanking closing base pairs.",
 junction:"A multi-loop junction connects three or more helices; its closing pairs and any unpaired loop residues are included."
};
const $=id=>document.getElementById(id),uniq=xs=>[...new Set(xs)].sort((a,b)=>a-b),name=t=>TYPES.find(x=>x[0]===t)?.[1]||t;
const pk=p=>p[0]+":"+p[1];
let motifs=[],signature="",selectedType=null,focus=0,phase="explore",quizType="hairpinLoop",quizSize="any",quizActive=false,quizSelection=[],reveal=[],hintCount=0,selectMode="single",gesture=null;
const isLearn=()=>document.body?.dataset.pageMode==="journey";
const current=t=>motifs.filter(m=>m.type===t),choices=()=>current(quizType).filter(m=>quizSize==="any"||m.size===Number(quizSize));
const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
function buildMotifs(sequence,dot,detector){
 if(typeof detector!=="function"||typeof dot!=="string")return [];
 const base=detector(sequence,dot),stack=[],partner=Array(dot.length).fill(-1);
 for(let i=0;i<dot.length;i++){
  if(dot[i]==="(")stack.push(i);
  else if(dot[i]===")"){const p=stack.pop();if(p===undefined)return [];partner[p]=i;partner[i]=p;}
 }
 return base.map(m=>{
  const copy={...m,indices:[...m.indices],pairs:(m.pairs||[]).map(p=>[...p])};
  if(!["internal","bulge"].includes(m.type))return copy;
  // The two bounding pairs are not part of the unpaired residues.
  const inner=Array.from({length:m.end-m.start-1},(_,k)=>m.start+1+k).find(i=>partner[i]>i&&partner[i]<m.end);
  if(inner!==undefined){
   const borders=[[m.start,m.end],[inner,partner[inner]]];
   copy.pairs=borders;copy.indices=uniq([...m.indices,...borders.flat()]);
  }
  return copy;
 });
}
function read(){
 const c=typeof SecondaryExplorer!=="undefined"?SecondaryExplorer.getContext?.():null;
 if(!c)return;
 const next=c.sequence+"|"+c.structure;if(next===signature)return;
 signature=next;
 motifs=buildMotifs(c.sequence,c.structure,typeof SecondaryMotifExplorer!=="undefined"?SecondaryMotifExplorer.identify:null);
 selectedType=null;focus=0;quizActive=false;quizSelection=[];reveal=[];hintCount=0;phase="explore";
 if($("gpsSecondaryExplore")){setMode("explore");renderExplore();renderTest();}
}
function setMode(next){phase=next;const scene=$("scene-secondary");if(scene)scene.dataset.guidedMotif=next;}
function paint(){
 if(!isLearn())return;
 const svg=$("secondarySvg");if(!svg)return;
 svg.querySelectorAll(".gps-motif-pair").forEach(x=>x.classList.remove("gps-motif-pair"));
 const visible=phase==="explore"&&selectedType?current(selectedType):[];
 const keys=new Set(visible.flatMap(m=>m.pairs.map(pk)));
 svg.querySelectorAll(".se-pair[data-pair]").forEach(g=>{if(keys.has(g.dataset.pair))g.classList.add("gps-motif-pair");});
}
function highlight(indices){
 SecondaryExplorer.highlightResidues(uniq(indices));
 paint();
}
function clear(){
 SecondaryExplorer.clearHighlights();paint();
}
function explain(){
 const list=selectedType?current(selectedType):[];
 if(!selectedType){setText("gpsExploreCount","");setText("gpsExploreExplanation","Choose a component to highlight all of its occurrences.");return;}
 if(!list.length){setText("gpsExploreCount","0 occurrences");setText("gpsExploreExplanation",INFO[selectedType]);return;}
 focus=(focus+list.length)%list.length;const m=list[focus];
 setText("gpsExploreCount","Occurrence "+(focus+1)+" of "+list.length);
 setText("gpsExploreExplanation",INFO[selectedType]+" Residues "+(m.start+1)+"–"+(m.end+1)+"; "+
  (selectedType==="stem"?m.size+" consecutive base pairs.":m.unpairedCount+" unpaired nucleotides."));
}
function renderExplore(){
 const root=$("gpsExploreButtons");if(!root)return;
 root.replaceChildren();
 TYPES.forEach(([type,label])=>{
  const b=document.createElement("button");b.type="button";b.dataset.gpsExplore=type;
  b.textContent=label+" ("+current(type).length+")";b.setAttribute("aria-pressed",String(selectedType===type));
  b.addEventListener("click",()=>show(type));root.append(b);
 });
 const count=selectedType?current(selectedType).length:0;
 for(const id of ["gpsExplorePrev","gpsExploreNext"])$(id).disabled=count===0;
 explain();
}
function show(type){
 read();setMode("explore");selectedType=type;focus=0;quizActive=false;
 const list=current(type);highlight(list.flatMap(m=>m.indices));renderExplore();renderTest();
 setText("gpsExploreStatus",list.length?list.length+" "+name(type)+" occurrence"+(list.length===1?"":"s")+" highlighted in hot pink.":"0 occurrences found for "+name(type)+".");
}
function move(n){
 const list=selectedType?current(selectedType):[];if(!list.length)return;
 focus=(focus+n+list.length)%list.length;renderExplore();
}
function renderSizes(){
 const el=$("gpsTestSize");if(!el)return;
 const found=[...new Set(current(quizType).map(m=>m.size))].sort((a,b)=>a-b);
 const offered=[...new Set([...(quizType==="hairpin"||quizType==="hairpinLoop"?[3,4]:[]),...found])].sort((a,b)=>a-b);
 el.replaceChildren(new Option("Any size","any"));
 offered.forEach(n=>{
  const o=new Option(n+" "+(quizType==="stem"?"consecutive base pairs":"unpaired nucleotides"),String(n));
  o.disabled=!found.includes(n);el.append(o);
 });
 if(quizSize!=="any"&&!found.includes(Number(quizSize)))quizSize="any";
 el.value=quizSize;el.disabled=found.length===0;
}
function renderTest(){
 if(!$("gpsTestType"))return;
 $("gpsTestType").value=quizType;renderSizes();
 setText("gpsTestCount",current(quizType).length+" occurrences in this RNA");
 $("gpsTestStart").disabled=!choices().length;
 for(const id of ["gpsTestCheck","gpsTestHint","gpsTestReveal","gpsTestStop"])
  $(id).disabled=!quizActive||(id==="gpsTestHint"&&hintCount>=3);
 document.querySelectorAll("[data-gps-select]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.gpsSelect===selectMode)));
}
function start(){
 read();
 if(!choices().length){setText("gpsTestFeedback","0 occurrences found for this size.");return;}
 setMode("test");selectedType=null;quizActive=true;quizSelection=[];reveal=[];hintCount=0;selectMode="single";
 if(typeof SecondarySelectionTools!=="undefined"&&SecondarySelectionTools.isRegionMode())SecondarySelectionTools.setMode("");
 clear();renderExplore();renderTest();
 setText("gpsTestFeedback","Find a "+name(quizType)+(quizSize==="any"?"":" of size "+quizSize)+". Select the entire motif, including its closing pair(s) where applicable, then check your answer.");
}
function stop(){
 quizActive=false;quizSelection=[];reveal=[];hintCount=0;selectMode="single";gesture=null;
 setMode("explore");selectedType=null;clear();renderExplore();renderTest();
 setText("gpsTestFeedback","Choose a motif and start a challenge.");
}
const equals=(a,b)=>a.length===b.length&&uniq(a).length===a.length&&a.every(x=>b.includes(x));
function check(){
 if(!quizActive)return;
 const correct=choices().find(m=>equals(quizSelection,m.indices));
 if(correct){reveal=[...correct.indices];highlight(quizSelection);setText("gpsTestFeedback","Correct! You identified a "+name(quizType)+".");}
 else setText("gpsTestFeedback",quizSelection.length?"Not quite. Check the boundaries and try again.":"Select the motif residues first.");
}
function revealAnswer(){
 if(!quizActive||!choices().length)return;
 quizSelection=[...choices()[0].indices];reveal=[...quizSelection];highlight(quizSelection);
 setText("gpsTestFeedback","One correct "+name(quizType)+" is highlighted. Other occurrences may also be correct.");
}
function hint(){
 if(!quizActive||!choices().length||hintCount>=3)return;
 const m=choices()[0],length=SecondaryExplorer.getContext().sequence.length;
 const zone=m.start<length/3?"first":m.start<2*length/3?"middle":"last";
 const clues=[INFO[quizType],
  "There are "+choices().length+" valid occurrences; try the "+zone+" third of the RNA.",
  quizType==="stem"?"Find "+m.size+" consecutive pairs near residue "+(m.start+1)+".":"Look near residue "+(Math.round((m.start+m.end)/2)+1)+" for "+m.unpairedCount+" unpaired nucleotides."
 ];
 hintCount++;setText("gpsTestFeedback","Hint "+hintCount+" of 3: "+clues[hintCount-1]);renderTest();
}
function onClick(event){
 if(!isLearn()||(event.type==="pointerdown"&&event.button!==0)||(event.type==="keydown"&&!["Enter"," "].includes(event.key)))return;
 const node=event.target.closest?.(".se-node");
 if(!node||event.target.closest?.("[data-index-label]"))return;
 const idx=Number(node.dataset.residueIndex);if(!Number.isInteger(idx))return;
 if(phase==="explore"&&selectedType){
  const list=current(selectedType),hit=list.findIndex(m=>m.indices.includes(idx));
  if(hit<0)return;
  event.preventDefault();event.stopImmediatePropagation();focus=hit;renderExplore();
 }else if(phase==="test"&&quizActive&&selectMode==="single"){
  event.preventDefault();event.stopImmediatePropagation();
  const next=new Set(quizSelection);if(next.has(idx))next.delete(idx);else next.add(idx);
  quizSelection=uniq([...next]);reveal=[];highlight(quizSelection);
  setText("gpsTestFeedback",quizSelection.length+" residues selected. Press Check answer when ready.");
 }
}
function point(event){
 const svg=$("secondarySvg"),m=svg.getScreenCTM?.();
 if(m&&typeof DOMPoint!=="undefined"){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(m.inverse());return{x:p.x,y:p.y};}
 const r=svg.getBoundingClientRect(),b=svg.viewBox.baseVal;
 return{x:b.x+(event.clientX-r.left)/r.width*b.width,y:b.y+(event.clientY-r.top)/r.height*b.height};
}
function inside(p,polygon){
 let hit=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-8)+a.x)hit=!hit;
 }
 return hit;
}
function draw(){
 const svg=$("secondarySvg");svg.querySelectorAll(".gps-test-outline").forEach(el=>el.remove());
 if(!gesture)return;
 const el=document.createElementNS("http://www.w3.org/2000/svg",selectMode==="box"?"rect":"path");
 if(selectMode==="box"){
  const a=gesture.points[0],b=gesture.points.at(-1);
  Object.entries({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)}).forEach(([k,v])=>el.setAttribute(k,v));
 }else el.setAttribute("d",gesture.points.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" "));
 el.setAttribute("class","gps-test-outline");el.setAttribute("pointer-events","none");el.setAttribute("data-export-remove","");
 svg.append(el);
}
function down(e){
 if(!isLearn()||!quizActive||phase!=="test"||selectMode==="single"||e.button!==0||e.target.closest?.("[data-index-label]"))return;
 e.preventDefault();e.stopImmediatePropagation();gesture={id:e.pointerId,points:[point(e)]};
 $("secondarySvg").setPointerCapture?.(e.pointerId);draw();
}
function drag(e){
 if(!gesture||gesture.id!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();const p=point(e);
 if(selectMode==="box")gesture.points=[gesture.points[0],p];
 else if(Math.hypot(p.x-gesture.points.at(-1).x,p.y-gesture.points.at(-1).y)>2)gesture.points.push(p);
 draw();
}
function up(e){
 if(!gesture||gesture.id!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();
 const g=gesture;g.points.push(point(e));gesture=null;
 const svg=$("secondarySvg");svg.querySelectorAll(".gps-test-outline").forEach(n=>n.remove());
 if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);
 const positions=SecondaryExplorer.getCurrentPositions?.()||[];let found=[];
 if(selectMode==="box"){
  const a=g.points[0],b=g.points.at(-1);
  found=positions.map((p,i)=>p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)?i:-1).filter(i=>i>=0);
 }else if(g.points.length>=3)found=positions.map((p,i)=>inside(p,g.points)?i:-1).filter(i=>i>=0);
 quizSelection=uniq(e.shiftKey?[...quizSelection,...found]:found);reveal=[];highlight(quizSelection);
 setText("gpsTestFeedback",quizSelection.length+" residues selected. Press Check answer when ready.");
}
function installStyles(){
 if($("gpsLearningMotifStyle"))return;
 const el=document.createElement("style");el.id="gpsLearningMotifStyle";
 el.textContent=[
  'body[data-page-mode="journey"] .gps-motif-card{padding:32px 38px 36px}',
  '.gps-motif-card p{line-height:1.55}',
  '.gps-motif-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:16px 0}',
  '.gps-motif-grid button,.gps-motif-actions button,.gps-motif-quiz-tools button{border:1px solid var(--line);background:transparent;color:var(--text);border-radius:8px;padding:10px 12px;min-width:0;overflow-wrap:anywhere;cursor:pointer}',
  '.gps-motif-grid button[aria-pressed="true"],.gps-motif-quiz-tools button[aria-pressed="true"]{color:#ff8ec8;border-color:#ff1493;background:rgba(255,20,147,.1)}',
  '.gps-motif-actions,.gps-motif-quiz-tools{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}',
  '.gps-motif-actions button{flex:1 1 115px}',
  '.gps-motif-card button:disabled{opacity:.45;cursor:default}',
  '.gps-motif-detail{border:1px solid var(--line);padding:16px;border-radius:10px;background:rgba(255,255,255,.02)}',
  '.gps-motif-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}',
  '.gps-motif-choices label{display:grid;gap:7px}',
  '.gps-motif-choices select{min-width:0;width:100%}',
  '.gps-motif-state{min-height:1.6em;color:var(--mint)}',
  'body[data-page-mode="journey"] #scene-secondary[data-guided-motif="explore"] .se-node.multi-selected>circle:first-child,body[data-page-mode="journey"] #scene-secondary[data-guided-motif="test"] .se-node.multi-selected>circle:first-child{stroke:#ff1493!important;stroke-width:5!important}',
  'body[data-page-mode="journey"] #scene-secondary .se-pair.gps-motif-pair path:not([stroke="transparent"]),body[data-page-mode="journey"] #scene-secondary .se-pair.gps-motif-pair line:not([stroke="transparent"]){stroke:#ff1493!important;stroke-width:4!important}',
  '#secondarySvg .gps-test-outline{stroke:#ff1493;stroke-width:2.5;stroke-dasharray:7 4;fill:rgba(255,20,147,.08)}',
  '@media(max-width:760px){body[data-page-mode="journey"] .gps-motif-card{padding:24px 20px}.gps-motif-choices{grid-template-columns:1fr}}'
 ].join("\n");document.head.append(el);
}
function makeExplore(){
 const s=document.createElement("section");s.id="gpsSecondaryExplore";s.className="guided-inline-lesson gps-motif-card";s.setAttribute("aria-labelledby","gpsExploreTitle");
 s.innerHTML=[
 '<div class="guided-inline-heading"><span class="fact-label">EXPLORE · SECONDARY STRUCTURE</span><h3 id="gpsExploreTitle">Explore Secondary Structure Components</h3>',
 '<p>Choose any of the six motifs. Every occurrence is highlighted in hot pink. Missing motifs remain selectable.</p></div>',
 '<div id="gpsExploreButtons" class="gps-motif-grid" role="group" aria-label="Explore RNA motifs"></div>',
 '<div class="gps-motif-detail"><strong id="gpsExploreCount" aria-live="polite"></strong><p id="gpsExploreExplanation">Select a motif.</p></div>',
 '<div class="gps-motif-actions"><button id="gpsExplorePrev">← Previous motif</button><button id="gpsExploreNext">Next motif →</button><button id="gpsExploreClear">Clear highlights</button></div>',
 '<p id="gpsExploreStatus" class="gps-motif-state" role="status" aria-live="polite"></p>'
 ].join("");return s;
}
function quizMarkup(){
 return [
 '<div class="guided-inline-heading"><span class="fact-label">TEST · SECONDARY STRUCTURE</span>',
 '<h3 id="gpsSecondaryLandmarksTitle">Can you recognize the parts of a secondary structure?</h3>',
 '<p>Identify a motif in the RNA above, select its residues, and check your answer. Ask for hints only if you need them.</p></div>',
 '<div class="gps-motif-choices"><label>Motif type<select id="gpsTestType"></select></label><label>Motif size<select id="gpsTestSize"></select></label></div>',
 '<p id="gpsTestCount" aria-live="polite"></p>',
 '<div class="gps-motif-quiz-tools" aria-label="Selection mode">',
 '<button data-gps-select="single" aria-pressed="true">Single select</button><button data-gps-select="box" aria-pressed="false">Box select</button>',
 '<button data-gps-select="lasso" aria-pressed="false">Lasso select</button></div>',
 '<div class="gps-motif-actions"><button id="gpsTestStart">Start challenge</button><button id="gpsTestCheck" disabled>Check answer</button>',
 '<button id="gpsTestHint" disabled>Get hint</button><button id="gpsTestReveal" disabled>Show answer</button><button id="gpsTestStop" disabled>Stop</button></div>',
 '<p id="gpsTestFeedback" class="gps-motif-state" role="status" aria-live="polite">Choose a motif to start.</p>'
 ].join("");
}
function ensure(){
 if(!isLearn())return;
 const scene=$("scene-secondary"),old=$("gpsSecondaryLandmarks");
 if(!scene||!old||typeof SecondaryExplorer==="undefined"||typeof SecondaryMotifExplorer==="undefined")return;
 read();if($("gpsSecondaryExplore"))return;
 installStyles();
 // Keep the old See-in-3D action and its existing handler.
 const link=$("gpsGoToLinked3D");if(link)link.remove();
 old.replaceChildren();old.classList.add("gps-motif-card");old.innerHTML=quizMarkup();if(link)old.append(link);
 // Keep the earlier RNA transition and base-pair explanation; add two cards below them.
 scene.append(makeExplore(),old);
 TYPES.forEach(([type,description])=>$("gpsTestType").append(new Option(description,type)));
 $("gpsExplorePrev").addEventListener("click",()=>move(-1));
 $("gpsExploreNext").addEventListener("click",()=>move(1));
 $("gpsExploreClear").addEventListener("click",()=>{selectedType=null;focus=0;setMode("explore");clear();renderExplore();setText("gpsExploreStatus","Highlights cleared.");});
 $("gpsTestType").addEventListener("change",e=>{quizType=e.target.value;quizSize="any";if(quizActive)stop();renderTest();});
 $("gpsTestSize").addEventListener("change",e=>{quizSize=e.target.value;if(quizActive)stop();renderTest();});
 $("gpsTestStart").addEventListener("click",start);
 $("gpsTestCheck").addEventListener("click",check);
 $("gpsTestHint").addEventListener("click",hint);
 $("gpsTestReveal").addEventListener("click",revealAnswer);
 $("gpsTestStop").addEventListener("click",stop);
 document.querySelectorAll("[data-gps-select]").forEach(button=>button.addEventListener("click",()=>{
  selectMode=button.dataset.gpsSelect;renderTest();
  if(quizActive)setText("gpsTestFeedback",selectMode==="single"?"Tap individual nucleotides to select them.":"Drag a "+(selectMode==="box"?"rectangle":"lasso")+" around motif residues.");
 }));
 const svg=$("secondarySvg");svg.addEventListener("pointerdown",onClick,true);svg.addEventListener("keydown",onClick,true);
 svg.addEventListener("pointerdown",down,true);svg.addEventListener("pointermove",drag,true);
 svg.addEventListener("pointerup",up,true);
 svg.addEventListener("pointercancel",e=>{if(gesture?.id===e.pointerId){gesture=null;draw();}},true);
 window.addEventListener("rna-secondary-context",()=>{if(isLearn())read();});
 window.addEventListener("rna-secondary-layout",()=>{if(isLearn()){read();paint();}});
 setMode("explore");renderExplore();renderTest();
 setText("gpsExploreStatus","Select a motif to explore.");
}
if(typeof document!=="undefined"){
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensure,{once:true});else ensure();
}
return {ensure,buildMotifs,getMotifs:()=>motifs.slice()};
})();
