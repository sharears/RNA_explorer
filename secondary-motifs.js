/* RNA Explorer: optional motif highlighting and loop-identification practice.
   Identify motifs from dot-bracket topology, not from the drawing's positions.
   For hairpins, bulges, and internal loops, targets are unpaired loop residues. */
const SecondaryMotifExplorer=(()=>{
"use strict";
const PINK="#ff1493",NS="http://www.w3.org/2000/svg",TYPES=[
{id:"stem",label:"Stem",one:"stem",description:"A stem is an uninterrupted run of at least three consecutive base pairs, whether or not it ends in a hairpin."},
{id:"hairpin",label:"Hairpin",one:"hairpin",description:"A hairpin is the terminal unpaired loop together with its single closing base pair. The rest of the stem is excluded."},
{id:"hairpinLoop",label:"Hairpin Loop",one:"hairpin loop",description:"A hairpin loop contains only the unpaired nucleotides at the end of a stem, without the closing base pair."},
{id:"internal",label:"Internal Loop",one:"internal loop",description:"An internal loop has unpaired nucleotides on both strands between two paired regions."},
{id:"bulge",label:"Bulge Loop",one:"bulge loop",description:"A bulge loop has unpaired nucleotides on only one strand between paired regions."},
{id:"junction",label:"Multi-loop Junction",one:"multi-loop junction",description:"A multi-loop junction connects three or more RNA helices through a central loop, with or without unpaired nucleotides."}
],$=id=>document.getElementById(id),range=(a,b)=>Array.from({length:Math.max(0,b-a)},(_,i)=>a+i);
const uniq=values=>[...new Set(values)].sort((a,b)=>a-b),pairKey=pair=>pair[0]+":"+pair[1],info=id=>TYPES.find(t=>t.id===id)||TYPES[0];
let motifs=[],signature="",shown=null,focus=0,challenge=false,kind="hairpinLoop",size="any",answer=[],solved=false,hintLevel=0;
function identify(sequence,dot){
 if(typeof sequence!=="string"||typeof dot!=="string"||sequence.length!==dot.length||!/^[ACGU]+$/.test(sequence))return [];
 const stack=[],roots=[],all=[];
 for(let i=0;i<dot.length;i++){
  if(dot[i]==="("){
   const node={i,j:-1,children:[],parent:stack.at(-1)||null};
   if(node.parent)node.parent.children.push(node);else roots.push(node);
   stack.push(node);all.push(node);
  }else if(dot[i]===")"){if(!stack.length)return [];stack.pop().j=i;}
  else if(dot[i]!==".")return [];
 }
 if(stack.length)return [];
 const out=[];
 function add(type,node,indices,pairs=[],size=indices.length,unpairedCount=size){
  if(indices.length)out.push({type,start:node.i,end:node.j,indices:uniq(indices),pairs,size,unpairedCount});
 }
 function visit(node){
  const kids=node.children;
  if(!kids.length){
   const loop=range(node.i+1,node.j);
   if(loop.length){
    add("hairpin",node,[node.i,...loop,node.j],[[node.i,node.j]],loop.length);
    add("hairpinLoop",node,loop,[],loop.length);
   }
  }else{
   let cursor=node.i+1;const gaps=[];
   kids.forEach(child=>{gaps.push(range(cursor,child.i));cursor=child.j+1;});gaps.push(range(cursor,node.j));
   const unpaired=gaps.flat();
   if(kids.length===1){
    if(gaps[0].length&&gaps[1].length)add("internal",node,unpaired);
    else if(unpaired.length)add("bulge",node,unpaired);
   }else{
    const boundaries=[[node.i,node.j],...kids.map(child=>[child.i,child.j])];
    add("junction",node,[...unpaired,...boundaries.flat()],boundaries,unpaired.length,unpaired.length);
   }
  }
  kids.forEach(visit);
 }
 roots.forEach(visit);
 // Every maximal uninterrupted stack of >=3 pairs is one stem.
 // Includes stems leading to hairpins and stems ending elsewhere.
 all.forEach(node=>{
  if(node.parent&&node.parent.i+1===node.i&&node.parent.j-1===node.j)return;
  const run=[];let cur=node;
  while(cur){
   run.push([cur.i,cur.j]);
   const child=cur.children.length===1?cur.children[0]:null;
   cur=child&&child.i===cur.i+1&&child.j===cur.j-1?child:null;
  }
  if(run.length>=3)add("stem",node,run.flat(),run,run.length,0);
 });
 return out.sort((a,b)=>a.start-b.start||a.end-b.end||TYPES.findIndex(t=>t.id===a.type)-TYPES.findIndex(t=>t.id===b.type));
}
const matching=type=>motifs.filter(m=>m.type===type);
const candidates=()=>matching(kind).filter(m=>size==="any"||m.size===Number(size));
const typeName=type=>TYPES.find(t=>t.id===type)?.one||type;
function setStatus(message,level="info"){const el=$("seMotifStatus");if(el){el.textContent=message;el.dataset.level=level;}}
function selected(){return SecondaryExplorer.getContext?.().selectedResidues||[];}
function paint(){
 const svg=$("secondarySvg");if(!svg)return;
 svg.querySelectorAll(".se-motif-ring").forEach(el=>el.remove());
 svg.querySelectorAll(".se-motif-pair").forEach(el=>el.classList.remove("se-motif-pair","se-motif-pair-focus"));
 const all=challenge?(answer.length?[{indices:answer,pairs:[]}]:[]):shown?matching(shown):[];
 const active=!challenge&&all.length?all[Math.max(0,Math.min(focus,all.length-1))]:null;
 const selected=new Set(active?.indices||[]);
 new Set(all.flatMap(m=>m.indices)).forEach(i=>{
  const node=svg.querySelector('[data-residue-index="'+i+'"]');if(!node)return;
  const ring=document.createElementNS(NS,"circle");
  ring.setAttribute("class","se-motif-ring"+(selected.has(i)?" se-motif-ring-focus":""));
  ring.setAttribute("r","23");ring.setAttribute("fill","none");ring.setAttribute("stroke",PINK);
  ring.setAttribute("stroke-width","5");ring.setAttribute("pointer-events","none");
  ring.setAttribute("data-export-remove","");node.insertBefore(ring,node.firstChild);
 });
 const colored=new Set(all.flatMap(m=>m.pairs.map(pairKey)));
 const current=new Set((active?.pairs||[]).map(pairKey));
 svg.querySelectorAll(".se-pair[data-pair]").forEach(g=>{
  if(!colored.has(g.dataset.pair))return;
  g.classList.add("se-motif-pair");if(current.has(g.dataset.pair))g.classList.add("se-motif-pair-focus");
 });
}
function sizes(){
 const select=$("seMotifSize");if(!select)return;
 const found=[...new Set(matching(kind).map(m=>m.size))].sort((a,b)=>a-b);
 const all=[...new Set([...(kind==="hairpin"?[3,4]:[]),...found])].sort((a,b)=>a-b);
 select.replaceChildren(new Option("Any loop size","any"));
 all.forEach(n=>{const item=new Option(n+" unpaired nucleotide"+(n===1?"":"s"),String(n));item.disabled=!found.includes(n);select.append(item);});
 if(size!=="any"&&!found.includes(Number(size)))size="any";
 select.value=size;select.disabled=!found.length;
}
function controls(){
 TYPES.forEach(t=>{
  const button=$("seMotifShow-"+t.id);if(!button)return;
  const count=matching(t.id).length;button.textContent="Show "+t.label+" ("+count+")";
  button.disabled=!count;button.setAttribute("aria-pressed",String(!challenge&&shown===t.id));
 });
 const clear=$("seMotifClear");if(clear)clear.disabled=!shown;
 const types=$("seMotifType");
 if(types){
  [...types.options].forEach(o=>o.disabled=!matching(o.value).length);
  if(!matching(kind).length){kind=TYPES.find(t=>matching(t.id).length)?.id||"hairpin";size="any";}
  types.value=kind;types.disabled=!motifs.length;
 }
 sizes();
 if($("seMotifStart"))$("seMotifStart").disabled=!motifs.length;
 for(const id of ["seMotifCheck","seMotifReveal","seMotifStop"])if($(id))$(id).disabled=!challenge;
 if($("seMotifPractice"))$("seMotifPractice").classList.toggle("active",challenge);
 if($("scene-secondary"))$("scene-secondary").dataset.motifChallenge=String(challenge);
}
function refresh(){
 const context=SecondaryExplorer.getContext?.();if(!context)return;
 const next=context.sequence+"|"+context.structure;
 if(signature!==next){
  signature=next;motifs=identify(context.sequence,context.structure);
  shown=null;challenge=false;solved=false;answer=[];controls();
  setStatus(motifs.length?"Found: "+TYPES.map(t=>matching(t.id).length+" "+t.label.toLowerCase()).join(" · ")+".":"No loop motifs recognized in this secondary structure.");
 }
 paint();
}
function show(type){
 if(!matching(type).length)return;
 const wasChallenge=challenge;challenge=false;shown=type;solved=false;answer=[];
 if(wasChallenge)SecondaryExplorer.clearHighlights();
 controls();paint();
 const sizes=[...new Set(matching(type).map(m=>m.size))].sort((a,b)=>a-b);
 setStatus(matching(type).length+" "+typeName(type)+(matching(type).length===1?"":"s")+" highlighted in hot pink. Unpaired loop sizes: "+sizes.join(", ")+".");
}
function stop(){
 const wasChallenge=challenge;challenge=false;shown=null;answer=[];solved=false;
 if(wasChallenge)SecondaryExplorer.clearHighlights();
 controls();paint();
 setStatus("Choose a motif to highlight or start another challenge.");
}
function start(){
 if(!candidates().length)return;
 shown=null;challenge=true;answer=[];solved=false;
 SecondarySelectionTools?.remember?.();SecondaryExplorer.clearHighlights();
 controls();paint();
 const phrase=size==="any"?"":" containing "+size+" unpaired nucleotide"+(size==="1"?"":"s");
 setStatus("Find a "+typeName(kind)+phrase+". Select only its unpaired loop residues using single clicks, box, or lasso, then press Check answer.");
}
function sameSet(a,b){return a.length===b.length&&new Set(a).size===a.length&&a.every(i=>b.includes(i));}
function check(){
 if(!challenge)return;
 const chosen=selected(),match=candidates().find(m=>sameSet(chosen,m.indices));
 if(match){solved=true;answer=match.indices.slice();paint();setStatus("Correct! "+typeName(kind)+" with "+match.size+" unpaired nucleotide"+(match.size===1?"":"s")+".","success");}
 else{solved=false;answer=[];paint();setStatus(chosen.length?"Not quite: "+chosen.length+" residues selected. Select exactly the loop residues and try again.":"Select loop residues first, then check your answer.","error");}
}
function reveal(){
 if(!challenge||!candidates().length)return;
 answer=candidates()[0].indices.slice();paint();
 setStatus("One correct "+typeName(kind)+" is outlined in hot pink. Other motifs of the same size may also be valid.");
}
function toggleResidue(event){
 if(!challenge||event.defaultPrevented||SecondarySelectionTools?.isRegionMode?.())return;
 if(event.type==="keydown"&&!["Enter"," "].includes(event.key))return;
 if(event.type==="click"&&event.button!==0)return;
 if(event.target.closest?.("[data-index-label]"))return;
 const node=event.target.closest?.("[data-residue-index]");
 if(!node||!$("secondarySvg")?.contains(node))return;
 event.preventDefault();event.stopImmediatePropagation();
 const i=Number(node.dataset.residueIndex);if(!Number.isInteger(i))return;
 const next=new Set(selected());if(next.has(i))next.delete(i);else next.add(i);
 SecondarySelectionTools?.remember?.();answer=[];solved=false;
 SecondaryExplorer.highlightResidues([...next]);
 SecondarySelectionTools?.syncSelectionState?.();
 setStatus(next.size+" nucleotide"+(next.size===1?"":"s")+" selected. Check answer when ready.");
}
function setup(){
 const panel=document.querySelector('#scene-secondary .rna-tool-panel[data-rna-panel="analyze"]'),svg=$("secondarySvg");
 if(!panel||!svg||$("seMotifTools"))return;
 const style=document.createElement("style");style.id="seMotifStyles";
 style.textContent=[
  '#seMotifTools{margin:0 0 .7rem;min-width:0}',
  '#seMotifTools>summary{color:var(--mint);font-weight:750}',
  '#seMotifTools h4{margin:.8rem 0 .3rem;color:var(--cream);font-size:.88rem}',
  '#seMotifTools p{margin:.35rem 0 .65rem;line-height:1.5;font-size:.8rem}',
  '.se-motif-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35rem}',
  '#seMotifTools button{min-width:0;overflow-wrap:anywhere}',
  '#seMotifTools button:disabled{opacity:.38;cursor:not-allowed;color:#87909b}',
  '#seMotifTools button[aria-pressed="true"]{color:#ff8ec8!important;border-color:#ff1493!important;background:rgba(255,20,147,.12)}',
  '#seMotifTools label{display:grid;gap:.3rem;align-items:start;justify-content:stretch}',
  '#seMotifTools select{width:100%}',
  '.se-motif-actions{display:flex;flex-wrap:wrap;gap:.35rem;margin:.6rem 0}',
  '.se-motif-actions button{flex:1 1 90px}',
  '#seMotifPractice{margin-top:.75rem;padding:.6rem;border:1px solid var(--line);border-radius:8px}',
  '#seMotifPractice.active{border-color:#ff1493}',
  '#seMotifStatus{min-height:2.8em;overflow-wrap:anywhere}',
  '#seMotifStatus[data-level="success"]{color:#74d7b6}',
  '#seMotifStatus[data-level="error"]{color:#ffc1c1}',
  '#scene-secondary[data-motif-challenge="true"] .se-node.multi-selected>circle:first-child{stroke:#ff1493!important;stroke-width:4!important}',
  '.se-motif-ring{filter:drop-shadow(0 0 5px rgba(255,20,147,.65))}'
 ].join("\n");document.head.append(style);
 const block=document.createElement("details");block.id="seMotifTools";block.open=true;
 block.innerHTML=[
 '<summary>Learn · Identify RNA motifs</summary>',
 '<p>Motifs are identified from dot-bracket pairing topology. Pink rings mark the unpaired loop nucleotides.</p>',
 '<h4>Show structural motifs</h4>',
 '<div class="se-motif-grid" id="seMotifButtons"></div>',
 '<button id="seMotifClear" type="button">Clear motif highlights</button>',
 '<section id="seMotifPractice"><h4>Practice · Find the motif</h4>',
 '<p>Choose a motif and size. Unavailable choices are gray and disabled.</p>',
 '<label>Motif type<select id="seMotifType"></select></label>',
 '<label>Loop size<select id="seMotifSize"></select></label>',
 '<div class="se-motif-actions">',
 '<button id="seMotifStart" type="button">Start challenge</button>',
 '<button id="seMotifCheck" type="button" disabled>Check answer</button>',
 '<button id="seMotifReveal" type="button" disabled>Show answer</button>',
 '<button id="seMotifStop" type="button" disabled>Stop</button></div>',
 '<p>During practice, click nucleotides to add or remove them. Box and lasso selection also work through the Select tab.</p>',
 '</section><p id="seMotifStatus" role="status" aria-live="polite"></p>'
 ].join("");panel.prepend(block);
 TYPES.forEach(t=>{
  const button=document.createElement("button");button.id="seMotifShow-"+t.id;button.type="button";button.setAttribute("aria-pressed","false");
  button.addEventListener("click",()=>show(t.id));$("seMotifButtons").append(button);
  $("seMotifType").append(new Option(t.label,t.id));
 });
 $("seMotifClear").addEventListener("click",()=>{shown=null;controls();paint();setStatus("Motif highlights cleared.");});
 $("seMotifType").addEventListener("change",e=>{kind=e.target.value;size="any";stop();});
 $("seMotifSize").addEventListener("change",e=>{size=e.target.value;if(challenge)stop();});
 $("seMotifStart").addEventListener("click",start);
 $("seMotifCheck").addEventListener("click",check);
 $("seMotifReveal").addEventListener("click",reveal);
 $("seMotifStop").addEventListener("click",stop);
 // The native editor selects on pointer-down, before click. In a challenge,
 // block only that native selection, allowing our additive click handler to run.
 svg.addEventListener("pointerdown",event=>{
  if(!challenge||SecondarySelectionTools?.isRegionMode?.()||event.button!==0)return;
  if(event.target.closest?.("[data-index-label]"))return;
  if(event.target.closest?.(".se-node"))event.stopImmediatePropagation();
 },true);
 svg.addEventListener("click",toggleResidue,true);svg.addEventListener("keydown",toggleResidue,true);
 window.addEventListener("rna-secondary-layout",refresh);window.addEventListener("rna-secondary-context",refresh);refresh();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
return {identify,getMotifs:()=>motifs.slice(),isChallengeActive:()=>challenge};
})();
