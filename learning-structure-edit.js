/* Optional chemical editing within Learn. Existing lesson illustrations remain default. */
const LearningStructureEdit=(()=>{
  const NS="http://www.w3.org/2000/svg";
  const LESSONS=["blocks","nucleoside","nucleotide","primary"];
  const savedGraphs=new Map();
  const widgets=new Map();
  const clone=value=>JSON.parse(JSON.stringify(value));
  function currentPart(){
    return document.querySelector('#scene-blocks .component-picker button[aria-pressed="true"]')?.dataset.component||"ribose";
  }
  function modelKey(scene){
    if(scene==="blocks")return scene+":"+chemistry.base+":"+currentPart();
    if(scene==="primary")return scene+":first-three-nucleotides";
    return scene+":"+chemistry.base;
  }
  function modelName(scene){
    const names=chemicalNames[chemistry.base];
    if(scene==="blocks")return {phosphate:"phosphoric acid",ribose:"ribose sugar",base:names[0]}[currentPart()];
    if(scene==="nucleoside")return names[1];
    if(scene==="nucleotide")return names[2];
    return "the first three RNA nucleotides (5′–3′)";
  }
  function primaryFragmentGraph(){
    // A representative covalently linked trinucleotide, not a modified
    // prediction for the full 76-nt guided sequence.
    const out={atoms:[],bonds:[],hbonds:[],iupac:null};
    for(let i=0;i<3;i++){
      const part=chemicalDiagram(RNA_SEQUENCE[i],2,false,false,"full");
      const prefix="nt"+(i+1)+"_",dx=i*290,dy=i*285;
      const removed=i>0?"poh2":null; // Replace a phosphate OH with upstream O3'.
      part.atoms.filter(atom=>atom.id!==removed).forEach(atom=>
        out.atoms.push({...atom,id:prefix+atom.id,x:atom.x+dx,y:atom.y+dy}));
      part.bonds.filter(bond=>bond.a!==removed&&bond.b!==removed).forEach(bond=>
        out.bonds.push({...bond,id:"b"+(out.bonds.length+1),a:prefix+bond.a,b:prefix+bond.b}));
      if(i>0)out.bonds.push({
        id:"b"+(out.bonds.length+1),a:"nt"+i+"_oh3",b:prefix+"p",order:1
      });
    }
    return out;
  }
  function initialGraph(scene){
    if(scene==="blocks")return chemicalDiagram(chemistry.base,0,false,false,currentPart());
    if(scene==="nucleoside")return chemicalDiagram(chemistry.base,1,false,true,"full");
    if(scene==="nucleotide")return chemicalDiagram(chemistry.base,2,false,false,"full");
    return primaryFragmentGraph();
  }
  function graphFor(scene){return clone(savedGraphs.get(modelKey(scene))||initialGraph(scene));}
  function svgElement(tag,attributes={}){
    const node=document.createElementNS(NS,tag);
    Object.entries(attributes).forEach(([k,v])=>node.setAttribute(k,String(v)));
    return node;
  }
  function drawGraph(container,graph,name){
    container.replaceChildren();
    const svg=svgElement("svg",{class:"lesson-custom-svg",role:"button",tabindex:"0",
      "aria-label":"Edit saved "+name+". Click or press Enter to reopen the molecular editor."});
    const atoms=graph.atoms||[],byId=new Map(atoms.map(a=>[a.id,a]));
    if(atoms.length){
      const xs=atoms.map(a=>a.x),ys=atoms.map(a=>a.y);
      const minX=Math.min(...xs)-55,maxX=Math.max(...xs)+55,minY=Math.min(...ys)-55,maxY=Math.max(...ys)+55;
      svg.setAttribute("viewBox",[minX,minY,Math.max(180,maxX-minX),Math.max(150,maxY-minY)].join(" "));
      const bonds=svgElement("g",{"class":"lesson-custom-bonds"});
      (graph.bonds||[]).forEach(b=>{
        const a=byId.get(b.a),c=byId.get(b.b);if(!a||!c)return;
        const distance=Math.hypot(c.x-a.x,c.y-a.y)||1,perpX=(c.y-a.y)/distance,perpY=(a.x-c.x)/distance;
        const shifts=b.order===2?[-3,3]:b.order===3?[-5,0,5]:[0];
        shifts.forEach(shift=>bonds.append(svgElement("line",{
          x1:a.x+perpX*shift,y1:a.y+perpY*shift,x2:c.x+perpX*shift,y2:c.y+perpY*shift
        })));
      });
      svg.append(bonds);
      const nodes=svgElement("g",{"class":"lesson-custom-atoms"});
      atoms.forEach(atom=>{
        const group=svgElement("g",{transform:"translate("+atom.x+" "+atom.y+")"});
        group.append(svgElement("circle",{r:atom.element==="H"?12:17}));
        const symbol=svgElement("text",{"text-anchor":"middle","dominant-baseline":"central"});
        symbol.textContent=atom.element+(atom.charge>0?"⁺":atom.charge<0?"⁻":"");
        group.append(symbol);nodes.append(group);
      });
      svg.append(nodes);
    }
    container.append(svg);
    const message=document.createElement("p");message.className="lesson-edit-preview-note";
    message.textContent="Your saved editable model · Select the drawing or Edit Structure to continue. Guided lesson and sequence are unchanged.";
    container.append(message);
  }
  function originalDiagrams(scene){
    const ids=scene==="blocks"?["chemicalOverview"]:
      scene==="nucleoside"?["nucleosideDiagram"]:
      scene==="nucleotide"?["nucleotideDiagram"]:["chainGrowth"];
    return ids.map(id=>document.getElementById(id)).filter(Boolean);
  }
  function refresh(scene){
    const widget=widgets.get(scene);if(!widget)return;
    const key=modelKey(scene),saved=savedGraphs.get(key);
    widget.reset.hidden=!saved;
    originalDiagrams(scene).forEach(el=>{el.hidden=Boolean(saved);});
    widget.preview.hidden=!saved;
    if(saved)drawGraph(widget.preview,saved,modelName(scene));
    else widget.preview.replaceChildren();
    widget.status.textContent=saved?"Edited molecular model saved for this lesson. Reset Structure restores its original illustration.":"";
  }
  function edit(scene){
    const key=modelKey(scene),name=modelName(scene);
    try{
      MoleculeEditor.openGraph(graphFor(scene),{name,onSave:edited=>{
        savedGraphs.set(key,clone(edited));
        refresh(scene);
      }});
    }catch(error){
      const widget=widgets.get(scene);
      if(widget)widget.status.textContent="Could not open the molecular editor: "+error.message;
    }
  }
  function setup(){
    if(typeof MoleculeEditor==="undefined"||typeof chemicalDiagram!=="function")return;
    LESSONS.forEach(scene=>{
      const stage=document.querySelector("#scene-"+scene+" .visual-stage");if(!stage||widgets.has(scene))return;
      const toolbar=document.createElement("div");toolbar.className="lesson-edit-actions";
      const button=document.createElement("button");button.type="button";button.className="lesson-edit-button";
      button.innerHTML='<span aria-hidden="true">✎</span> Edit Structure';
      button.setAttribute("aria-label","Edit the molecular structure in "+scene+" using Molecular Drawing tools");
      const reset=document.createElement("button");reset.type="button";reset.className="lesson-edit-reset";
      reset.textContent="Reset Structure";reset.hidden=true;
      const status=document.createElement("p");status.className="lesson-edit-status";
      status.setAttribute("role","status");status.setAttribute("aria-live","polite");
      toolbar.append(button,reset);stage.prepend(toolbar);
      const preview=document.createElement("div");preview.className="lesson-custom-preview";preview.hidden=true;
      stage.append(preview,status);
      widgets.set(scene,{button,reset,preview,status});
      button.addEventListener("click",()=>edit(scene));
      reset.addEventListener("click",()=>{savedGraphs.delete(modelKey(scene));refresh(scene);});
      preview.addEventListener("click",event=>{if(event.target.closest?.("svg"))edit(scene);});
      preview.addEventListener("keydown",event=>{
        if((event.key==="Enter"||event.key===" ")&&event.target.closest?.("svg")){
          event.preventDefault();edit(scene);
        }
      });
      refresh(scene);
    });
    window.addEventListener("rna-journey-base-changed",()=>{
      ["blocks","nucleoside","nucleotide"].forEach(refresh);
    });
    window.addEventListener("rna-journey-component-changed",()=>refresh("blocks"));
  }
  return {setup,primaryFragmentGraph,initialGraph,modelKey};
})();