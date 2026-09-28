const JourneyStructureLearning = (() => {
  const PDB_URL="https://files.rcsb.org/download/1EHZ.pdb";
  const THREE_DMOL="https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js";
  const MOD_BASES={A:"A",ADE:"A",RA:"A","1MA":"A","M1A":"A","6MA":"A",C:"C",CYT:"C",RC:"C","5MC":"C",G:"G",GUA:"G",RG:"G","1MG":"G","2MG":"G","7MG":"G",U:"U",URA:"U",RU:"U","PSU":"U","H2U":"U","5MU":"U","T":"U"};
  const BASE_RING={A:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],G:["N9","C8","N7","C5","C6","N1","C2","N3","C4"],C:["N1","C2","N3","C4","C5","C6"],U:["N1","C2","N3","C4","C5","C6"]};
  const PAIR_ATOMS={GC:[["O6","N4"],["N1","N3"],["N2","O2"]],CG:[["N4","O6"],["N3","N1"],["O2","N2"]],AU:[["N6","O4"],["N1","N3"]],UA:[["O4","N6"],["N3","N1"]],GU:[["O6","N3"],["N1","O2"]],UG:[["N3","O6"],["O2","N1"]]};
  const TORSIONS={
    alpha:{symbol:"α",atoms:[[-1,"O3'"],[0,"P"],[0,"O5'"],[0,"C5'"]]},
    beta:{symbol:"β",atoms:[[0,"P"],[0,"O5'"],[0,"C5'"],[0,"C4'"]]},
    gamma:{symbol:"γ",atoms:[[0,"O5'"],[0,"C5'"],[0,"C4'"],[0,"C3'"]]},
    delta:{symbol:"δ",atoms:[[0,"C5'"],[0,"C4'"],[0,"C3'"],[0,"O3'"]]},
    epsilon:{symbol:"ε",atoms:[[0,"C4'"],[0,"C3'"],[0,"O3'"],[1,"P"]]},
    zeta:{symbol:"ζ",atoms:[[0,"C3'"],[0,"O3'"],[1,"P"],[1,"O5'"]]}
  };
  const FEATURES={
    glycosidic:{name:"Glycosidic torsion χ",definition:"χ describes how the nucleobase is oriented relative to ribose around the glycosidic bond.",notice:"Follow the four highlighted atoms. The central C1′–N bond is the bond you first met when the nucleoside formed."},
    pucker:{name:"Sugar pucker",definition:"The five-membered ribose ring is not flat. Sugar pucker describes which ring atoms sit above or below its mean plane.",notice:"Rotate the ribose edge-on. C2′ and C3′ do not occupy the same plane as every other ring atom."},
    backbone:{name:"Backbone torsions α–ζ",definition:"Six torsion angles describe rotations along the phosphodiester backbone: α, β, γ, δ, ε and ζ.",notice:"Each torsion uses four atoms. Together, these local rotations determine the path taken by the RNA backbone."},
    stacking:{name:"Base stacking",definition:"Neighboring nucleobases often pack with their approximately planar aromatic surfaces above and below one another.",notice:"Rotate the two bases. Stacking is face-to-face packing, not the edge-to-edge contact used for base pairing."},
    basepair:{name:"Base pairing",definition:"Base pairing brings compatible nucleobase edges together. Hydrogen bonds can stabilize and specify the interaction.",notice:"Compare the two facing base edges with the face-to-face orientation you saw for stacking."},
    helix:{name:"RNA helix",definition:"Repeated base pairing and stacking organize two RNA segments into a helical structure.",notice:"Follow the two strands and notice how pairing repeats while adjacent bases stack along the helix."},
    loopjunction:{name:"Loops & junctions",definition:"Loops expose or redirect the RNA chain, while junction-like regions bring several structural elements together.",notice:"These regions organize the fold; they are more than empty spaces between stems."},
    tertiarycontact:{name:"Tertiary contacts",definition:"Residues far apart in sequence can approach one another in three-dimensional space.",notice:"Sequence distance and spatial distance are different. A close approach can help organize a compact fold."}
  };

  let panel=null,sourcePanel=null,continuation=null,activeBridge=null;
  let miniViewer=null,miniModel=null,miniResidues=[],miniReady=null,currentFeature="glycosidic",currentTorsion="alpha";

  const atomName=a=>String(a?.atom||"").replace(/\*/g,"'").trim().toUpperCase();
  const normBase=resn=>MOD_BASES[String(resn||"").trim().toUpperCase()]||"?";
  const residueKey=a=>String(a.chain||"")+"|"+String(a.resi)+"|"+String(a.icode||"");
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const vsub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>Math.hypot(a.x,a.y,a.z);
  function dihedral(a,b,c,d){
    const b0=vsub(b,a),b1=vsub(c,b),b2=vsub(d,c),n1=cross(b0,b1),n2=cross(b1,b2),n=norm(b1);
    if(!norm(n1)||!norm(n2)||!n)return NaN;
    const u={x:b1.x/n,y:b1.y/n,z:b1.z/n},m1=cross(n1,u);
    return Math.atan2(dot(m1,n2),dot(n1,n2))*180/Math.PI;
  }
  function atom(residue,name){return residue?.atoms.find(a=>atomName(a)===name)||null;}
  function selector(residue){const s={resi:residue.resi};if(residue.chain)s.chain=residue.chain;if(residue.icode)s.icode=residue.icode;return s;}
  function centroid(atoms){return atoms.reduce((o,a)=>({x:o.x+a.x/atoms.length,y:o.y+a.y/atoms.length,z:o.z+a.z/atoms.length}),{x:0,y:0,z:0});}
  function parsePairs(){
    const structure=typeof TRNA_DOT_BRACKET==="string"?TRNA_DOT_BRACKET:"",stack=[],pairs=[],partner=Array(structure.length).fill(-1);
    [...structure].forEach((c,i)=>{if(c==="(")stack.push(i);else if(c===")"){const a=stack.pop();if(a!==undefined){pairs.push([a,i]);partner[a]=i;partner[i]=a;}}});
    return {pairs,partner};
  }
  function makeResidues(atoms){
    const map=new Map();
    atoms.forEach((a,i)=>{
      const key=residueKey(a);let r=map.get(key);
      if(!r){r={chain:a.chain||"",resi:a.resi,icode:a.icode||"",resn:a.resn||"",base:normBase(a.resn),atoms:[],first:i};map.set(key,r);}
      r.atoms.push(a);
    });
    const all=[...map.values()].sort((a,b)=>a.first-b.first);
    const chains=new Map();all.forEach(r=>{if(r.base==="?")return;if(!chains.has(r.chain))chains.set(r.chain,[]);chains.get(r.chain).push(r);});
    return chains.get("A")||[...chains.values()].sort((a,b)=>b.length-a.length)[0]||[];
  }

  function pairSvg(kind){
    const meta={
      AU:{left:"A",right:"U",bonds:["N6–H ··· O4","N1 ··· H–N3"],count:2},
      GC:{left:"G",right:"C",bonds:["O6 ··· H–N4","N1–H ··· N3","N2–H ··· O2"],count:3},
      GU:{left:"G",right:"U",bonds:["O6 ··· H–N3","N1–H ··· O2"],count:2}
    }[kind]||null;
    if(!meta)return `<div class="nonstandard-grid">
      <div><b>G–U wobble</b><span>Common cis Watson–Crick/Watson–Crick geometry in RNA.</span></div>
      <div><b>A·A examples</b><span>Adenines can pair through alternative base edges and orientations.</span></div>
      <div><b>G·A examples</b><span>G·A pairs also occur in multiple non-Watson–Crick geometries.</span></div>
      <p>Exact hydrogen-bond patterns depend on which base edges meet and whether the pair is cis or trans.</p>
    </div>`;
    const lines=meta.bonds.map((b,i)=>`<g class="bp-hbond"><line x1="285" y1="${118+i*54}" x2="475" y2="${118+i*54}"/><text x="380" y="${105+i*54}">${b}</text></g>`).join("");
    const leftPurine=meta.left==="A"||meta.left==="G",rightPurine=meta.right==="A"||meta.right==="G";
    const base=(x,y,label,purine,side)=>`<g class="bp-base bp-${side}"><polygon points="${x-70},${y} ${x-35},${y-61} ${x+35},${y-61} ${x+70},${y} ${x+35},${y+61} ${x-35},${y+61}"/>${purine?`<polygon points="${x+35},${y-61} ${x+94},${y-35} ${x+94},${y+35} ${x+35},${y+61}"/>`:""}<text x="${x}" y="${y+8}" class="bp-letter">${label}</text></g>`;
    return `<svg class="bp-chem-svg" viewBox="0 0 760 330" role="img" aria-label="${meta.left}–${meta.right} base-pair schematic with ${meta.count} hydrogen bonds">
      ${base(190,170,meta.left,leftPurine,"left")}${base(570,170,meta.right,rightPurine,"right")}
      ${lines}<text x="380" y="306" class="bp-caption">${kind==="GU"?"G–U wobble":"Watson–Crick "+meta.left+"–"+meta.right} · ${meta.count} hydrogen bonds shown schematically</text>
    </svg>`;
  }

  function primaryBridge(){
    return `<div class="bridge-copy">
      <p class="scene-number">PRIMARY → SECONDARY</p>
      <h2>How does a sequence become a secondary structure?</h2>
      <p>The primary structure tells us the nucleotide order. A strand can bend so residues separated in sequence approach one another and form base pairs.</p>
      <div class="bridge-callout"><strong>First, understand one base pair.</strong><span>Then we will zoom back out and show several pairs organizing the strand.</span></div>
      <p class="bridge-caveat">This animation is a teaching schematic, not a molecular folding simulation or a claim about a unique folding pathway.</p>
    </div>
    <div class="bridge-work">
      <section class="fold-demo">
        <div class="bridge-section-heading"><span>1</span><div><b>Watch the chain bring pairing partners together</b><small>The same sequence is shown before and after a schematic bend.</small></div></div>
        <div class="fold-stage" id="foldStage">
          <svg viewBox="0 0 760 240" role="img" aria-label="Schematic RNA strand bending so distant residues can form base pairs">
            <g class="fold-linear">${Array.from({length:12},(_,i)=>`<circle cx="${65+i*56}" cy="112" r="17"/><text x="${65+i*56}" y="118">${"GCAUGCUAGCUA"[i]}</text>`).join("")}<path d="M45 112 H715"/></g>
            <g class="fold-paired">
              <path d="M90 190 C130 90 220 55 330 86 C420 112 436 178 520 183 C590 187 637 135 670 72"/>
              ${[[155,145,"G"],[208,113,"C"],[267,97,"A"],[327,103,"U"],[453,162,"A"],[508,173,"U"],[566,166,"G"],[615,135,"C"]].map(v=>`<circle cx="${v[0]}" cy="${v[1]}" r="17"/><text x="${v[0]}" y="${v[1]+6}">${v[2]}</text>`).join("")}
              <g class="forming-pairs"><line x1="208" y1="113" x2="615" y2="135"/><line x1="267" y1="97" x2="566" y2="166"/><line x1="327" y1="103" x2="508" y2="173"/></g>
            </g>
          </svg>
        </div>
        <button class="secondary-action bridge-demo-button" id="foldReplay" type="button">Watch pairing again</button>
      </section>
      <section class="pair-tutorial">
        <div class="bridge-section-heading"><span>2</span><div><b>Zoom in: what does a base pair mean chemically?</b><small>Choose a pair to inspect a ChemDraw-like atom-level schematic.</small></div></div>
        <div class="pair-tabs" role="tablist" aria-label="RNA base-pair examples">
          <button type="button" class="active" data-pair-kind="AU" role="tab" aria-selected="true">A–U</button>
          <button type="button" data-pair-kind="GC" role="tab" aria-selected="false">G–C</button>
          <button type="button" data-pair-kind="GU" role="tab" aria-selected="false">G–U wobble</button>
          <button type="button" data-pair-kind="other" role="tab" aria-selected="false">Other non-WC</button>
        </div>
        <div id="pairChemistry" class="pair-chemistry">${pairSvg("AU")}</div>
        <p id="pairLessonCopy" class="bridge-notice"><strong>A–U and G–C are the standard Watson–Crick RNA pairs.</strong> The dashed lines represent hydrogen bonds between compatible donor and acceptor atoms.</p>
      </section>
      <section class="secondary-reveal">
        <div class="bridge-section-heading"><span>3</span><div><b>Zoom back out</b><small>Several base pairs give us a useful 2D representation of pairing and connectivity.</small></div></div>
        <div class="mini-secondary-preview"><span>sequence</span><b>→ base pairs →</b><span>stems · loops · junctions</span></div>
      </section>
    </div>`;
  }

  function tertiaryBridge(){
    return `<div class="bridge-copy">
      <p class="scene-number">SECONDARY → TERTIARY</p>
      <h2>Pairing is only part of the story.</h2>
      <p>A secondary-structure drawing tells us which residues pair and how the chain is connected. Real RNA also has bond rotations, puckered sugars, stacked bases and long-range spatial contacts.</p>
      <div class="bridge-callout"><strong>Learn a 3D feature before seeing the whole molecule.</strong><span>Rotate the isolated example yourself, then continue to the complete tRNA.</span></div>
    </div>
    <div class="bridge-work">
      <div class="feature-tabs" role="tablist" aria-label="RNA 3D structural features">
        ${Object.entries(FEATURES).map(([key,v],i)=>`<button type="button" data-bridge-feature="${key}" role="tab" aria-selected="${i===0}" class="${i===0?"active":""}">${key==="glycosidic"?"χ angle":key==="pucker"?"Sugar pucker":key==="backbone"?"Backbone α–ζ":key==="stacking"?"Base stacking":key==="basepair"?"Base pairs":key==="helix"?"RNA helix":key==="loopjunction"?"Loops & junctions":"Tertiary contacts"}</button>`).join("")}
      </div>
      <div class="feature-learning-grid">
        <section class="feature-explanation">
          <span class="fact-label">WHAT IS IT?</span>
          <h3 id="bridgeFeatureName">${FEATURES.glycosidic.name}</h3>
          <p id="bridgeFeatureDefinition">${FEATURES.glycosidic.definition}</p>
          <label id="bridgeTorsionWrap" class="bridge-torsion" hidden>Backbone torsion
            <select id="bridgeTorsion">${Object.entries(TORSIONS).map(([k,v])=>`<option value="${k}">${v.symbol} · ${v.atoms.map(x=>x[1]).join("–")}</option>`).join("")}</select>
          </label>
          <div class="bridge-notice"><strong>What should I notice?</strong><span id="bridgeFeatureNotice">${FEATURES.glycosidic.notice}</span></div>
          <p class="bridge-mini-status" id="bridgeFeatureStatus" role="status">Loading the interactive 3D example…</p>
        </section>
        <section class="feature-mini-view">
          <div id="bridge3DViewer" class="bridge-3d-viewer" role="img" aria-label="Interactive isolated 3D RNA structural feature"></div>
          <div class="bridge-view-controls"><button type="button" id="bridgeReset3D">Reset view</button><span>Drag to rotate · wheel to zoom</span></div>
        </section>
      </div>
      <p class="bridge-caveat">The isolated examples use atoms from the experimental PDB 1EHZ tRNA structure. They are teaching views of geometry, not a simulation of how the molecule folded.</p>
    </div>`;
  }

  function buildPanel(){
    if(panel)return;
    panel=document.createElement("section");panel.id="journeyStructureBridge";panel.className="journey-structure-bridge";panel.hidden=true;
    panel.innerHTML='<div id="journeyBridgeContent"></div><div class="bridge-nav"><button type="button" id="journeyBridgeBack">← Back</button><button type="button" id="journeyBridgeContinue" class="primary-action">Continue →</button></div>';
    document.getElementById("explorer")?.append(panel);
    panel.querySelector("#journeyBridgeBack").addEventListener("click",closeBridge);
    panel.querySelector("#journeyBridgeContinue").addEventListener("click",continueBridge);
  }
  function footerHidden(value){const f=document.querySelector(".scene-footer");if(f)f.hidden=value;}
  function openBridge(kind,commit){
    buildPanel();activeBridge=kind;continuation=commit;
    sourcePanel=document.querySelector('[data-scene-panel="'+(kind==="pairing"?"primary":"secondary")+'"]');
    if(sourcePanel)sourcePanel.hidden=true;
    panel.hidden=false;footerHidden(true);
    const content=panel.querySelector("#journeyBridgeContent");
    if(kind==="tertiary"){miniViewer=null;miniModel=null;miniResidues=[];miniReady=null;}
    content.innerHTML=kind==="pairing"?primaryBridge():tertiaryBridge();
    panel.querySelector("#journeyBridgeContinue").textContent=kind==="pairing"?"Continue to Secondary structure →":"Continue to Tertiary structure →";
    if(kind==="pairing")setupPairBridge();else setupTertiaryBridge();
    panel.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function closeBridge(){
    if(!panel||panel.hidden)return;
    panel.hidden=true;footerHidden(false);if(sourcePanel)sourcePanel.hidden=false;
    activeBridge=null;continuation=null;sourcePanel=null;
  }
  function continueBridge(){
    const fn=continuation;panel.hidden=true;footerHidden(false);activeBridge=null;continuation=null;sourcePanel=null;
    if(typeof fn==="function")fn();
  }
  function interceptNavigation({fromIndex,toIndex,fromScene,toScene,commit}){
    if(document.body.dataset.pageMode!=="journey"||toIndex!==fromIndex+1)return false;
    if(fromScene==="primary"&&toScene==="secondary"){openBridge("pairing",commit);return true;}
    if(fromScene==="secondary"&&toScene==="tertiary"){openBridge("tertiary",commit);return true;}
    return false;
  }

  function setupPairBridge(){
    const stage=panel.querySelector("#foldStage"),replay=panel.querySelector("#foldReplay");
    const play=()=>{stage.classList.remove("folded");void stage.offsetWidth;stage.classList.add("folded");};
    replay.addEventListener("click",play);setTimeout(play,120);
    panel.querySelectorAll("[data-pair-kind]").forEach(button=>button.addEventListener("click",()=>{
      const kind=button.dataset.pairKind;
      panel.querySelectorAll("[data-pair-kind]").forEach(b=>{const active=b===button;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));});
      panel.querySelector("#pairChemistry").innerHTML=pairSvg(kind);
      const copy=panel.querySelector("#pairLessonCopy");
      if(kind==="AU"||kind==="GC")copy.innerHTML="<strong>A–U and G–C are the standard Watson–Crick RNA pairs.</strong> The dashed lines represent the characteristic hydrogen-bonding pattern.";
      else if(kind==="GU")copy.innerHTML="<strong>G–U wobble is a common RNA non-Watson–Crick pair.</strong> It uses a different relative placement while still forming favorable hydrogen bonds.";
      else copy.innerHTML="<strong>RNA is not limited to Watson–Crick edges.</strong> Other base identities can interact through Watson–Crick, Hoogsteen and sugar edges in cis or trans orientations; the exact hydrogen bonds depend on the geometry.";
    }));
  }

  function load3Dmol(){
    if(window.$3Dmol)return Promise.resolve(window.$3Dmol);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[src="'+THREE_DMOL+'"]');
      if(existing){existing.addEventListener("load",()=>resolve(window.$3Dmol),{once:true});existing.addEventListener("error",reject,{once:true});return;}
      const script=document.createElement("script");script.src=THREE_DMOL;script.async=true;script.crossOrigin="anonymous";script.referrerPolicy="no-referrer";
      script.onload=()=>resolve(window.$3Dmol);script.onerror=()=>reject(new Error("Could not load the 3D renderer."));document.head.append(script);
    });
  }
  async function ensureMiniViewer(){
    if(miniViewer&&miniModel)return;
    if(miniReady)return miniReady;
    miniReady=(async()=>{
      const lib=await load3Dmol(),box=panel.querySelector("#bridge3DViewer");
      miniViewer=lib.createViewer(box,{backgroundColor:"#07111c",antialias:true});
      const response=await fetch(PDB_URL,{mode:"cors",cache:"force-cache"});if(!response.ok)throw new Error("Could not load the 1EHZ teaching structure.");
      const pdb=await response.text();miniModel=miniViewer.addModel(pdb,"pdb",{keepH:true});miniResidues=makeResidues(miniModel.selectedAtoms({}));
      if(!miniResidues.length)throw new Error("No RNA residues were found in the teaching structure.");
      miniViewer.render();return miniViewer;
    })().catch(error=>{miniReady=null;miniViewer=null;miniModel=null;throw error;});
    return miniReady;
  }
  function bridgeAtomSet(i,names){const r=miniResidues[i];if(!r)return null;const atoms=names.map(n=>atom(r,n));return atoms.every(Boolean)?{r,atoms}:null;}
  function candidateOrder(){const preferred=[9,10,11,20,30,40,50,60];return [...preferred,...miniResidues.map((_,i)=>i)].filter((v,i,a)=>v>=0&&v<miniResidues.length&&a.indexOf(v)===i);}
  function geometryForFeature(key){
    const parsed=parsePairs();
    if(key==="glycosidic"){
      for(const i of candidateOrder()){const r=miniResidues[i],purine=r?.base==="A"||r?.base==="G",names=purine?["O4'","C1'","N9","C4"]:["O4'","C1'","N1","C2"],set=bridgeAtomSet(i,names);if(set)return {indices:[i],exact:set.atoms,links:[[set.atoms[1],set.atoms[2]]],labels:names,status:(r.base||"residue")+" "+(i+1)+" · χ-defining atoms "+names.join("–")+" · χ = "+dihedral(...set.atoms).toFixed(1)+"°"};}
    }
    if(key==="pucker"){
      const names=["O4'","C1'","C2'","C3'","C4'"];for(const i of candidateOrder()){const set=bridgeAtomSet(i,names);if(set)return {indices:[i],exact:set.atoms,links:[],labels:names,status:"Residue "+(i+1)+" · five ribose-ring atoms highlighted. Rotate the ring edge-on to inspect its non-planarity."};}
    }
    if(key==="backbone"){
      const def=TORSIONS[currentTorsion]||TORSIONS.alpha;for(const i of candidateOrder()){const atoms=def.atoms.map(([off,n])=>atom(miniResidues[i+off],n));if(atoms.every(Boolean)){const indices=[...new Set(def.atoms.map(([off])=>i+off))];return {indices,exact:atoms,links:[[atoms[0],atoms[1]],[atoms[1],atoms[2]],[atoms[2],atoms[3]]],labels:def.atoms.map(x=>x[1]),status:def.symbol+" at residue "+(i+1)+" = "+dihedral(...atoms).toFixed(1)+"°."};}}
    }
    if(key==="stacking"){
      for(let i=0;i<miniResidues.length-1;i++){const a=miniResidues[i],b=miniResidues[i+1],aa=(BASE_RING[a.base]||[]).map(n=>atom(a,n)).filter(Boolean),bb=(BASE_RING[b.base]||[]).map(n=>atom(b,n)).filter(Boolean);if(aa.length>=5&&bb.length>=5)return {indices:[i,i+1],exact:[...aa,...bb],links:[[centroid(aa),centroid(bb)]],labels:[],status:(a.base||"?")+(i+1)+" / "+(b.base||"?")+(i+2)+" · neighboring bases isolated so you can inspect their relative faces."};}
    }
    if(key==="basepair"){
      for(const [i,j] of parsed.pairs){const a=miniResidues[i],b=miniResidues[j];if(!a||!b)continue;const defs=PAIR_ATOMS[(a.base||"")+(b.base||"")]||[],links=defs.map(([x,y])=>[atom(a,x),atom(b,y)]).filter(p=>p.every(Boolean));if(links.length)return {indices:[i,j],exact:links.flat(),links,labels:[],status:(a.base||"?")+(i+1)+" ↔ "+(b.base||"?")+(j+1)+" · paired base edges and expected donor/acceptor contacts highlighted."};}
    }
    if(key==="helix"){
      const chosen=parsed.pairs.slice(0,4),indices=[...new Set(chosen.flat())].filter(i=>miniResidues[i]);if(indices.length)return {indices,exact:[],links:chosen.map(([i,j])=>{const a=atom(miniResidues[i],"C1'"),b=atom(miniResidues[j],"C1'");return a&&b?[a,b]:null;}).filter(Boolean),labels:[],status:"A short paired segment is isolated. Rotate it and follow the two strands through repeated pairing and stacking."};
    }
    if(key==="loopjunction"){
      const {partner}=parsed;let best=[],run=[];for(let i=0;i<miniResidues.length;i++){if(partner[i]<0)run.push(i);else{if(run.length>best.length)best=run;run=[];}}if(run.length>best.length)best=run;best=best.slice(0,9);const core=[7,8,25,43,44,45,46,47,64].filter(i=>miniResidues[i]);return {indices:[...new Set([...best,...core])],exact:[],links:[],labels:[],status:"An unpaired loop-like segment and compact central-core residues are isolated to show how non-helical regions organize the fold."};
    }
    if(key==="tertiarycontact"){
      const paired=new Set(parsed.pairs.map(([i,j])=>Math.min(i,j)+":"+Math.max(i,j)));let best=null;
      for(let i=0;i<miniResidues.length;i++)for(let j=i+5;j<miniResidues.length;j++){if(paired.has(i+":"+j))continue;for(const a of miniResidues[i].atoms)for(const b of miniResidues[j].atoms){if(atomName(a).startsWith("H")||atomName(b).startsWith("H"))continue;const d=distance(a,b);if(d>1.8&&d<5&&(best===null||d<best.d))best={i,j,a,b,d};}}
      if(best)return {indices:[best.i,best.j],exact:[best.a,best.b],links:[[best.a,best.b]],labels:[atomName(best.a),atomName(best.b)],status:"Residues "+(best.i+1)+" and "+(best.j+1)+" are distant in sequence but contain atoms "+best.d.toFixed(2)+" Å apart. Proximity alone does not define a specific interaction type."};
    }
    throw new Error("A suitable example was not found in the teaching structure.");
  }
  function showMiniGeometry(g){
    miniViewer.removeAllShapes();miniViewer.removeAllLabels();miniModel.setStyle({},{});
    const residueSerials=[];g.indices.forEach(i=>miniResidues[i]?.atoms.forEach(a=>residueSerials.push(a.serial)));
    if(residueSerials.length)miniModel.setStyle({serial:residueSerials},{stick:{radius:.13,color:"#647586",opacity:.52}});
    const exactSerials=g.exact.filter(a=>a&&a.serial!=null).map(a=>a.serial);
    if(exactSerials.length)miniModel.addStyle({serial:exactSerials},{stick:{radius:.25,color:"#ffffff"},sphere:{radius:.3,color:"#ffffff",opacity:.96}});
    g.links.forEach(([a,b])=>{if(!a||!b)return;miniViewer.addCylinder({start:a,end:b,radius:.055,color:"#f2c66d",opacity:.96,fromCap:1,toCap:1,dashed:true});});
    g.exact.slice(0,8).forEach((a,i)=>{const label=g.labels[i];if(label)miniViewer.addLabel(label,{position:a,fontSize:11,fontColor:"#07111c",backgroundColor:"#f2c66d",backgroundOpacity:.94,inFront:true});});
    const selected=g.indices.map(i=>miniResidues[i]).filter(Boolean),resi=selected.map(r=>r.resi),chain=selected[0]?.chain;
    miniViewer.zoomTo(chain?{chain,resi}:{resi},250);miniViewer.render();
  }
  async function selectBridgeFeature(key){
    currentFeature=FEATURES[key]?key:"glycosidic";
    const meta=FEATURES[currentFeature];
    panel.querySelector("#bridgeFeatureName").textContent=meta.name;panel.querySelector("#bridgeFeatureDefinition").textContent=meta.definition;panel.querySelector("#bridgeFeatureNotice").textContent=meta.notice;
    panel.querySelector("#bridgeTorsionWrap").hidden=currentFeature!=="backbone";
    panel.querySelectorAll("[data-bridge-feature]").forEach(b=>{const on=b.dataset.bridgeFeature===currentFeature;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));});
    const status=panel.querySelector("#bridgeFeatureStatus");status.textContent="Preparing the interactive 3D example…";
    try{await ensureMiniViewer();const g=geometryForFeature(currentFeature);showMiniGeometry(g);status.textContent=g.status;}catch(error){status.textContent="3D example unavailable: "+error.message;}
  }
  function setupTertiaryBridge(){
    panel.querySelectorAll("[data-bridge-feature]").forEach(b=>b.addEventListener("click",()=>selectBridgeFeature(b.dataset.bridgeFeature)));
    panel.querySelector("#bridgeTorsion").addEventListener("change",e=>{currentTorsion=e.target.value;if(currentFeature==="backbone")selectBridgeFeature("backbone");});
    panel.querySelector("#bridgeReset3D").addEventListener("click",()=>{if(miniViewer){miniViewer.zoomTo({},250);miniViewer.render();}});
    requestAnimationFrame(()=>selectBridgeFeature("glycosidic"));
  }

  function setup(){buildPanel();}
  function getState(){return {activeBridge,currentFeature,currentTorsion,miniReady:!!(miniViewer&&miniModel)};}
  return {setup,interceptNavigation,closeBridge,getState};
})();