(() => {
  "use strict";

  if (window.__rnaExplorerChemInspectV2) return;
  window.__rnaExplorerChemInspectV2 = true;

  const ACCENT = "#f2c66d";
  const PICK = "#74d7b6";
  const MUTED = "#8fa2b3";
  const PROPERTY_CONFIG = {
    hybridization: { label: "Hybridization", needed: 1, unit: "" },
    distance: { label: "Distance", needed: 2, unit: "Å" },
    angle: { label: "Angle", needed: 3, unit: "°" },
    dihedral: { label: "Dihedral angle", needed: 4, unit: "°" }
  };

  let property = "off";
  let scope = "select";
  let picks = [];
  let viewer = null;
  let model = null;
  let lastModel = null;
  let lastGraphSignature = "";
  let lastVisualKey = "";
  let pollTimer = null;
  let shapes = [];
  let labels = [];
  let boundViewer = null;

  const $ = id => document.getElementById(id);
  const editor = () => {
    try { return typeof MoleculeEditor !== "undefined" ? MoleculeEditor : null; }
    catch (_error) { return null; }
  };
  const graph = () => {
    try { return editor()?.getCurrentGraph?.() || null; }
    catch (_error) { return null; }
  };

  function graphSignature(g) {
    if (!g) return "";
    return JSON.stringify({
      atoms:(g.atoms||[]).map(a=>[a.id,a.element,Number(a.charge||0)]),
      bonds:(g.bonds||[]).map(b=>[b.a,b.b,Number(b.order||1)])
    });
  }

  function ensureStyles() {
    if ($("chemInspectV2Styles")) return;
    const style = document.createElement("style");
    style.id = "chemInspectV2Styles";
    style.textContent = `
      .chem-inspect-panel{display:grid;gap:.6rem;padding:.72rem .8rem;border:1px solid rgba(116,215,182,.28);border-radius:10px;background:rgba(8,24,43,.46)}
      .chem-inspect-heading{display:flex;justify-content:space-between;align-items:baseline;gap:.7rem;flex-wrap:wrap}.chem-inspect-heading strong{color:var(--cream);font-size:.82rem}.chem-inspect-heading span{font-size:.72rem;color:var(--muted)}
      .chem-inspect-controls{display:flex;gap:.55rem;align-items:end;flex-wrap:wrap}.chem-inspect-controls label{display:grid!important;gap:.25rem!important;min-width:185px!important;margin:0!important;color:var(--muted)!important;font-size:.72rem!important}.chem-inspect-controls select{width:100%!important;min-height:36px}.chem-inspect-controls button{min-height:36px}
      .chem-inspect-result{margin:0;font-size:.8rem;line-height:1.5;color:var(--muted)}.chem-inspect-result[data-state="ready"]{color:#74d7b6}.chem-inspect-result[data-state="busy"]{color:#f2c66d}.chem-inspect-result[data-state="error"]{color:#f4a582}
      .chem-inspect-note{margin:0;font-size:.7rem;line-height:1.45;color:var(--muted)}
      #chemEditorSvg .chem-editor-atom.chem-inspect-selected .chem-atom-circle{stroke:#f2c66d!important;fill:rgba(242,198,109,.13)!important;stroke-width:3.5!important;filter:drop-shadow(0 0 7px rgba(242,198,109,.85))!important}
      #chemEditorSvg .chem-editor-atom.chem-inspect-selected .chem-atom-label{filter:drop-shadow(0 0 6px rgba(242,198,109,.9))!important}
      #chemEditorSvg .chem-inspect-order{fill:#07111c!important;stroke:none!important;font:800 9px "DM Mono",monospace!important;paint-order:normal!important;pointer-events:none!important}
      #chemEditorSvg .chem-inspect-order-bg{fill:#f2c66d!important;stroke:#fff!important;stroke-width:1!important;pointer-events:none!important}
      #chemEditorSvg{overscroll-behavior:contain}
      #chem3DMolViewer,#tertiaryMolecularViewer,.te-molecular-viewport{touch-action:none!important;overscroll-behavior:contain!important;-webkit-user-select:none;user-select:none}
      #chem3DMolViewer canvas,#tertiaryMolecularViewer canvas{touch-action:none!important;overscroll-behavior:contain!important}
      @media(max-width:720px){.chem-inspect-controls label{min-width:min(100%,220px)!important}.chem-inspect-panel{padding:.65rem}.chem-inspect-controls{align-items:stretch}.chem-inspect-controls button{align-self:end}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    const dialog = $("chemEditorDialog");
    if (!dialog) return false;
    $("chem3DMeasureTools")?.remove();
    ensureStyles();
    if ($("chemInspectPanelV2")) return true;
    const toolbar = dialog.querySelector(".chem-editor-toolbar");
    if (!toolbar) return false;
    const panel = document.createElement("section");
    panel.id = "chemInspectPanelV2";
    panel.className = "chem-inspect-panel";
    panel.setAttribute("aria-label","Inspect molecule");
    panel.innerHTML = `
      <div class="chem-inspect-heading"><strong>Inspect molecule</strong><span>Select atoms in either 2D or 3D; geometry values come from the current 3D coordinates.</span></div>
      <div class="chem-inspect-controls">
        <label>Property
          <select id="chemInspectPropertyV2">
            <option value="off">Off</option>
            <option value="hybridization">Hybridization</option>
            <option value="distance">Distance</option>
            <option value="angle">Angle</option>
            <option value="dihedral">Dihedral angle</option>
          </select>
        </label>
        <label id="chemInspectScopeLabelV2">Display
          <select id="chemInspectScopeV2">
            <option value="showall">Show all</option>
            <option value="select" selected>Select</option>
          </select>
        </label>
        <button type="button" id="chemInspectClearV2">Clear selection</button>
      </div>
      <p id="chemInspectResultV2" class="chem-inspect-result" data-state="idle">Choose a property to inspect.</p>
      <p class="chem-inspect-note">Show all: hybridization for every drawn atom, distances for all covalent bonds, or angles for all connected covalent triples. Dihedral uses Select only. Hybridization is inferred from the molecular graph; when it cannot be assigned confidently, RNA Explorer reports “not available.”</p>`;
    toolbar.insertAdjacentElement("afterend", panel);

    $("chemInspectPropertyV2")?.addEventListener("change", e => setProperty(e.target.value));
    $("chemInspectScopeV2")?.addEventListener("change", e => setScope(e.target.value));
    $("chemInspectClearV2")?.addEventListener("click", () => {
      picks = [];
      lastVisualKey = "";
      clearVisuals();
      setResult(instruction(), "idle");
    });
    syncUi();
    return true;
  }

  function syncUi() {
    const prop = $("chemInspectPropertyV2"), scopeEl = $("chemInspectScopeV2"), scopeLabel = $("chemInspectScopeLabelV2");
    if (prop && prop.value !== property) prop.value = property;
    if (!scopeEl) return;
    if (property === "dihedral") {
      scope = "select";
      scopeEl.value = "select";
      scopeEl.disabled = true;
      if (scopeLabel) scopeLabel.title = "Dihedral angle is available in Select mode only.";
    } else if (property === "off") {
      scopeEl.disabled = true;
      if (scopeLabel) scopeLabel.title = "Choose an inspection property first.";
    } else {
      scopeEl.disabled = false;
      scopeEl.value = scope;
      if (scopeLabel) scopeLabel.title = "";
    }
  }

  function setProperty(value) {
    property = Object.prototype.hasOwnProperty.call(PROPERTY_CONFIG, value) ? value : "off";
    if (property === "dihedral") scope = "select";
    picks = [];
    lastVisualKey = "";
    clearVisuals();
    syncUi();
    if (property === "off") {
      disable3DClicking();
      setResult("Choose a property to inspect.", "idle");
      return;
    }
    ensure3DVisible();
    setResult(instruction(), "idle");
    scheduleApply();
  }

  function setScope(value) {
    if (property === "dihedral") scope = "select";
    else scope = value === "showall" ? "showall" : "select";
    picks = [];
    lastVisualKey = "";
    clearVisuals();
    syncUi();
    if (property !== "off") ensure3DVisible();
    setResult(instruction(), "idle");
    scheduleApply();
  }

  function setResult(text, state="idle") {
    const el = $("chemInspectResultV2");
    if (!el) return;
    el.textContent = text;
    el.dataset.state = state;
  }

  function instruction() {
    if (property === "off") return "Choose a property to inspect.";
    if (scope === "showall") {
      if (property === "hybridization") return "Showing inferred hybridization for every drawn atom in the 3D view.";
      if (property === "distance") return "Showing the 3D distance for every covalent bond.";
      if (property === "angle") return "Showing every connected covalent bond angle from the current 3D geometry.";
    }
    const needed = PROPERTY_CONFIG[property]?.needed || 0;
    const names = {hybridization:"an atom",distance:"2 atoms",angle:"3 atoms in angle order",dihedral:"4 atoms in dihedral order"};
    return `Select ${names[property] || needed+" atoms"} in either the 2D drawing or 3D view.`;
  }

  function ensure3DVisible() {
    const g = graph();
    if (!g?.atoms?.length) return;
    const button = $("chem3DToggle");
    if (button && button.getAttribute("aria-pressed") !== "true") {
      try { button.click(); } catch (_error) {}
    }
  }

  function get3DViewer() {
    const host = $("chem3DMolViewer");
    if (!host) return null;
    for (const canvas of host.querySelectorAll("canvas")) {
      if (canvas._3dmol_viewer) return canvas._3dmol_viewer;
    }
    return null;
  }

  function get3DModel(v) {
    if (!v) return null;
    try {
      const models = v.getModels?.();
      if (Array.isArray(models) && models.length) return models[0];
    } catch (_error) {}
    try { return v.getModel?.() || null; }
    catch (_error) { return null; }
  }

  function modelAtoms() {
    try { return model?.selectedAtoms?.({}) || []; }
    catch (_error) { return []; }
  }

  function atomForGraphId(id, g=graph()) {
    if (!g || !model) return null;
    const idx = (g.atoms||[]).findIndex(a=>a.id===id);
    if (idx < 0) return null;
    const atoms = modelAtoms();
    let atom = atoms.find(a=>Number.isInteger(a.index) && a.index===idx);
    if (!atom) atom = atoms[idx] || null;
    if (!atom && idx+1>0) atom = atoms.find(a=>Number(a.serial)===idx+1) || null;
    return atom;
  }

  function graphIdForModelAtom(atom, g=graph()) {
    if (!atom || !g) return null;
    let idx = Number.isInteger(atom.index) ? atom.index : -1;
    if (idx < 0 && Number.isFinite(Number(atom.serial))) idx = Number(atom.serial)-1;
    const a = idx>=0 ? (g.atoms||[])[idx] : null;
    return a?.id || null;
  }

  function pointOf(atom) {
    return atom ? {x:Number(atom.x),y:Number(atom.y),z:Number(atom.z)} : null;
  }
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>Math.hypot(a.x,a.y,a.z);
  const scale=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});
  const average=pts=>({x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length,z:pts.reduce((s,p)=>s+p.z,0)/pts.length});
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
  function angleDeg(a,b,c){const u=sub(a,b),v=sub(c,b),den=norm(u)*norm(v);if(!den)return NaN;return Math.acos(Math.max(-1,Math.min(1,dot(u,v)/den)))*180/Math.PI;}
  function dihedralDeg(a,b,c,d){
    const b0=sub(a,b),b1=sub(c,b),b2=sub(d,c),n1=norm(b1);if(!n1)return NaN;
    const bh=scale(b1,1/n1),v=sub(b0,scale(bh,dot(b0,bh))),w=sub(b2,scale(bh,dot(b2,bh))),nv=norm(v),nw=norm(w);if(!nv||!nw)return NaN;
    return Math.atan2(dot(cross(bh,v),w)/(nv*nw),dot(v,w)/(nv*nw))*180/Math.PI;
  }

  function adjacency(g) {
    const map = new Map((g?.atoms||[]).map(a=>[a.id,[]]));
    (g?.bonds||[]).forEach(b=>{
      if (!map.has(b.a)||!map.has(b.b)) return;
      const order=Number(b.order||1);
      map.get(b.a).push({id:b.b,order,bond:b});
      map.get(b.b).push({id:b.a,order,bond:b});
    });
    return map;
  }

  function inferHybridization(id, g=graph()) {
    const atom=(g?.atoms||[]).find(a=>a.id===id);if(!atom)return null;
    const elem=String(atom.element||"").toUpperCase();
    if (["H","F","CL","BR","I"].includes(elem)) return null;
    const adj=adjacency(g),links=adj.get(id)||[];
    if(!links.length)return null;
    const orders=links.map(x=>Number(x.order||1));
    const doubleCount=orders.filter(o=>o>=1.75&&o<2.75).length;
    if(orders.some(o=>o>=2.75)||doubleCount>=2)return "sp";
    if(doubleCount===1)return "sp²";
    if(["N","O","S","B"].includes(elem)){
      const conjugated=links.some(link=>(adj.get(link.id)||[]).some(other=>other.id!==id&&Number(other.order||1)>=1.75));
      if(conjugated)return "sp²";
    }
    if(elem==="P")return links.length>=4?"sp³":null;
    if(["C","N","O","S","B","SI"].includes(elem))return "sp³";
    return null;
  }

  function atomName(id,g=graph()) {
    const i=(g?.atoms||[]).findIndex(a=>a.id===id),a=i>=0?g.atoms[i]:null;
    if(!a)return String(id||"atom");
    const label=String(a.label||a.id||a.element||"atom");
    return `${label} (${i+1})`;
  }

  function clear3DGraphics() {
    if (viewer) {
      shapes.forEach(s=>{try{viewer.removeShape?.(s);}catch(_error){}});
      labels.forEach(l=>{try{viewer.removeLabel?.(l);}catch(_error){}});
      try{viewer.render?.();}catch(_error){}
    }
    shapes=[];labels=[];
  }

  function clear2DHighlight() {
    const svg=$("chemEditorSvg");if(!svg)return;
    svg.querySelectorAll(".chem-inspect-selected").forEach(el=>el.classList.remove("chem-inspect-selected"));
    svg.querySelectorAll(".chem-inspect-order,.chem-inspect-order-bg").forEach(el=>el.remove());
  }

  function clearVisuals() {
    clear3DGraphics();
    clear2DHighlight();
  }

  function addSphere(atom) {
    if(!viewer||!atom)return;
    try{shapes.push(viewer.addSphere({center:pointOf(atom),radius:.28,color:PICK,opacity:.35}));}catch(_error){}
  }
  function addSegment(a,b,radius=.035,color=ACCENT) {
    if(!viewer||!a||!b)return;
    try{shapes.push(viewer.addCylinder({start:a,end:b,radius,color,opacity:.92,fromCap:1,toCap:1}));}catch(_error){}
  }
  function addLabel(text,pos,options={}) {
    if(!viewer||!pos)return;
    try{
      labels.push(viewer.addLabel(String(text),{
        position:pos,fontSize:options.fontSize||12,fontColor:options.fontColor||"#07111c",
        backgroundColor:options.backgroundColor||ACCENT,backgroundOpacity:options.backgroundOpacity??.92,
        borderColor:options.borderColor||"#ffffff",borderThickness:options.borderThickness??1,inFront:true
      }));
    }catch(_error){}
  }

  function apply2DHighlight() {
    const svg=$("chemEditorSvg");if(!svg)return;
    clear2DHighlight();
    if(property==="off"||scope!=="select")return;
    picks.forEach((id,index)=>{
      const group=[...svg.querySelectorAll("[data-atom-id]")].find(el=>el.dataset.atomId===id);
      if(!group)return;
      group.classList.add("chem-inspect-selected");
      try{
        const bg=document.createElementNS("http://www.w3.org/2000/svg","circle");
        bg.setAttribute("cx","20");bg.setAttribute("cy","-20");bg.setAttribute("r","9");bg.setAttribute("class","chem-inspect-order-bg");
        const tx=document.createElementNS("http://www.w3.org/2000/svg","text");
        tx.setAttribute("x","20");tx.setAttribute("y","-20");tx.setAttribute("text-anchor","middle");tx.setAttribute("dominant-baseline","central");tx.setAttribute("class","chem-inspect-order");tx.textContent=String(index+1);
        group.append(bg,tx);
      }catch(_error){}
    });
  }

  function highlightPicks3D(g) {
    picks.forEach(id=>{const a=atomForGraphId(id,g);if(a)addSphere(a);});
  }

  function selectAtom(id, source="2d") {
    if(property==="off"||scope!=="select"||!id)return;
    const cfg=PROPERTY_CONFIG[property],needed=cfg.needed;
    if(picks.length>=needed)picks=[];
    if(picks.includes(id))return;
    picks.push(id);
    lastVisualKey="";
    apply2DHighlight();
    const remaining=needed-picks.length;
    if(remaining>0)setResult(`Selected ${picks.length} of ${needed} atom${needed===1?"":"s"}. Select ${remaining} more in 2D or 3D.`,"busy");
    scheduleApply();
  }

  function disable3DClicking() {
    const v=get3DViewer()||viewer;
    if(!v)return;
    try{v.setClickable?.({},false);}catch(_error){}
  }

  function bind3DClicking() {
    if(!viewer)return;
    if(boundViewer&&boundViewer!==viewer){try{boundViewer.setClickable?.({},false);}catch(_error){}}
    boundViewer=viewer;
    try{
      viewer.setClickable?.({},false);
      if(property!=="off"&&scope==="select"){
        viewer.setClickable?.({},true,atom=>{
          const g=graph(),id=graphIdForModelAtom(atom,g);
          if(!id){setResult("That generated atom is not part of the editable 2D drawing. Select a drawn atom instead.","error");return;}
          selectAtom(id,"3d");
        });
      }
    }catch(_error){}
  }

  function applySelectedMeasurement(g) {
    const cfg=PROPERTY_CONFIG[property];if(!cfg)return;
    clear3DGraphics();highlightPicks3D(g);apply2DHighlight();
    if(picks.length<cfg.needed){try{viewer?.render?.();}catch(_error){};return;}
    const atoms=picks.map(id=>atomForGraphId(id,g));
    if(atoms.some(a=>!a)){
      setResult("The selected atoms are waiting for the current 3D geometry to finish loading.","busy");
      try{viewer?.render?.();}catch(_error){};return;
    }
    const pts=atoms.map(pointOf);
    if(property==="hybridization"){
      const h=inferHybridization(picks[0],g),text=h||"not available";
      addLabel(text,pts[0],{backgroundColor:h?ACCENT:MUTED});
      setResult(`${atomName(picks[0],g)} hybridization: ${text}.`,"ready");
    }else if(property==="distance"){
      const value=distance(pts[0],pts[1]);addSegment(pts[0],pts[1]);addLabel(`${value.toFixed(3)} Å`,midpoint(pts[0],pts[1]));
      setResult(`${atomName(picks[0],g)} ↔ ${atomName(picks[1],g)}: ${value.toFixed(3)} Å.`,"ready");
    }else if(property==="angle"){
      const value=angleDeg(pts[0],pts[1],pts[2]);addSegment(pts[0],pts[1]);addSegment(pts[1],pts[2]);addLabel(`${value.toFixed(2)}°`,average(pts));
      setResult(`${atomName(picks[0],g)} – ${atomName(picks[1],g)} – ${atomName(picks[2],g)}: ${value.toFixed(2)}°.`,"ready");
    }else if(property==="dihedral"){
      const value=dihedralDeg(pts[0],pts[1],pts[2],pts[3]);addSegment(pts[0],pts[1]);addSegment(pts[1],pts[2]);addSegment(pts[2],pts[3]);addLabel(`${value.toFixed(2)}°`,midpoint(pts[1],pts[2]));
      setResult(`${atomName(picks[0],g)} – ${atomName(picks[1],g)} – ${atomName(picks[2],g)} – ${atomName(picks[3],g)}: ${value.toFixed(2)}°.`,"ready");
    }
    try{viewer?.render?.();}catch(_error){}
  }

  function allAngles(g) {
    const adj=adjacency(g),out=[];
    for(const [center,neighbors] of adj.entries()){
      for(let i=0;i<neighbors.length;i++)for(let j=i+1;j<neighbors.length;j++)out.push([neighbors[i].id,center,neighbors[j].id]);
    }
    return out;
  }

  function applyShowAll(g) {
    clearVisuals();
    if(!viewer||!model){setResult("Generating the 3D view…","busy");return;}
    if(property==="hybridization"){
      let shown=0,unavailable=0;
      (g.atoms||[]).forEach(a=>{
        const m=atomForGraphId(a.id,g);if(!m)return;
        const h=inferHybridization(a.id,g);if(!h)unavailable++;
        addLabel(h||"N/A",pointOf(m),{fontSize:10,backgroundColor:h?ACCENT:MUTED,backgroundOpacity:.78,borderThickness:0});shown++;
      });
      setResult(`Showing hybridization for ${shown} drawn atom${shown===1?"":"s"}${unavailable?`; ${unavailable} not available`:""}.`,"ready");
    }else if(property==="distance"){
      let shown=0;
      (g.bonds||[]).forEach(b=>{
        const a=atomForGraphId(b.a,g),c=atomForGraphId(b.b,g);if(!a||!c)return;
        const pa=pointOf(a),pc=pointOf(c),d=distance(pa,pc);addLabel(`${d.toFixed(2)} Å`,midpoint(pa,pc),{fontSize:10,backgroundOpacity:.78,borderThickness:0});shown++;
      });
      setResult(`Showing ${shown} covalent bond distance${shown===1?"":"s"} from the current 3D geometry.`,"ready");
    }else if(property==="angle"){
      const triples=allAngles(g);let shown=0;
      triples.forEach(ids=>{
        const a=atomForGraphId(ids[0],g),b=atomForGraphId(ids[1],g),c=atomForGraphId(ids[2],g);if(!a||!b||!c)return;
        const pa=pointOf(a),pb=pointOf(b),pc=pointOf(c),v=angleDeg(pa,pb,pc);if(!Number.isFinite(v))return;
        addLabel(`${v.toFixed(1)}°`,average([pa,pb,pc]),{fontSize:10,backgroundOpacity:.76,borderThickness:0});shown++;
      });
      setResult(`Showing ${shown} connected covalent angle${shown===1?"":"s"} from the current 3D geometry.`,"ready");
    }
    try{viewer?.render?.();}catch(_error){}
  }

  function visualKey(g) {
    const modelTag=model?String(model.getID?.()??model.id??"")+":"+modelAtoms().length:"none";
    return [property,scope,picks.join("|"),graphSignature(g),modelTag].join("::");
  }

  function applyInspection(force=false) {
    if(property==="off")return;
    const g=graph();if(!g?.atoms?.length){setResult("Draw a molecule first.","error");return;}
    ensure3DVisible();
    const v=get3DViewer();if(v)viewer=v;
    const m=get3DModel(viewer);if(m)model=m;
    if(!viewer||!model){setResult("Generating the 3D view…","busy");return;}
    if(model!==lastModel){lastModel=model;lastVisualKey="";bind3DClicking();}
    const key=visualKey(g);if(!force&&key===lastVisualKey){apply2DHighlight();return;}
    lastVisualKey=key;
    if(scope==="showall")applyShowAll(g);else applySelectedMeasurement(g);
  }

  function scheduleApply() {
    setTimeout(()=>applyInspection(false),40);
  }

  function bind2DSelectionAndZoom() {
    const svg=$("chemEditorSvg");if(!svg||svg.dataset.inspectV2Bound==="1")return;
    svg.dataset.inspectV2Bound="1";
    const touchPoints=new Map(),touchCandidates=new Map();let pinch=null;

    function currentView(){
      const vb=svg.viewBox?.baseVal;
      return {x:Number(vb?.x||0),y:Number(vb?.y||0),width:Number(vb?.width||820),height:Number(vb?.height||470)};
    }
    function setCenteredZoom(factor,start=null){
      const v=start||currentView(),cx=v.x+v.width/2,cy=v.y+v.height/2;
      const width=Math.max(150,Math.min(5000,v.width*factor)),height=width*(v.height/Math.max(1,v.width));
      svg.setAttribute("viewBox",`${(cx-width/2).toFixed(2)} ${(cy-height/2).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`);
    }
    function beginPinch(){
      const pts=[...touchPoints.values()];if(pts.length<2){pinch=null;return;}
      const a=pts[0],b=pts[1];pinch={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),view:currentView()};
      touchCandidates.forEach(c=>c.multi=true);
    }

    svg.addEventListener("wheel",e=>{
      e.preventDefault();
      const factor=Math.max(.72,Math.min(1.38,Math.exp(Number(e.deltaY||0)*.0012)));
      setCenteredZoom(factor);
    },{passive:false,capture:true});

    svg.addEventListener("pointerdown",e=>{
      if(e.pointerType==="touch"){
        touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const atomEl=e.target.closest?.("[data-atom-id]");
        touchCandidates.set(e.pointerId,{x:e.clientX,y:e.clientY,atomId:atomEl?.dataset?.atomId||null,moved:false,multi:false});
        if(touchPoints.size>=2){beginPinch();e.preventDefault();e.stopImmediatePropagation();return;}
        if(property!=="off"&&scope==="select"){e.preventDefault();e.stopImmediatePropagation();}
        return;
      }
      if(property==="off"||scope!=="select"||e.button!==0)return;
      const atomEl=e.target.closest?.("[data-atom-id]");if(!atomEl)return;
      e.preventDefault();e.stopImmediatePropagation();selectAtom(atomEl.dataset.atomId,"2d");
    },true);

    svg.addEventListener("pointermove",e=>{
      if(e.pointerType!=="touch")return;
      const p=touchPoints.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}
      const c=touchCandidates.get(e.pointerId);if(c&&Math.hypot(e.clientX-c.x,e.clientY-c.y)>8)c.moved=true;
      if(touchPoints.size>=2){
        if(!pinch)beginPinch();
        const pts=[...touchPoints.values()],a=pts[0],b=pts[1],d=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
        if(pinch)setCenteredZoom(pinch.distance/d,pinch.view);
        e.preventDefault();e.stopImmediatePropagation();
      }else if(property!=="off"&&scope==="select"){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);

    const endTouch=e=>{
      if(e.pointerType!=="touch")return;
      const c=touchCandidates.get(e.pointerId);
      touchPoints.delete(e.pointerId);touchCandidates.delete(e.pointerId);
      if(touchPoints.size<2)pinch=null;else beginPinch();
      if(property!=="off"&&scope==="select"){
        e.preventDefault();e.stopImmediatePropagation();
        if(c&&!c.moved&&!c.multi&&c.atomId)selectAtom(c.atomId,"2d");
      }
    };
    svg.addEventListener("pointerup",endTouch,true);svg.addEventListener("pointercancel",endTouch,true);
  }

  function harden3DTouch() {
    const hosts=[$("chem3DMolViewer"),$("tertiaryMolecularViewer"),document.querySelector(".te-molecular-viewport")].filter(Boolean);
    hosts.forEach(host=>{
      host.style.touchAction="none";host.style.overscrollBehavior="contain";
      host.querySelectorAll?.("canvas").forEach(canvas=>{canvas.style.touchAction="none";canvas.style.overscrollBehavior="contain";});
    });
    const chemHelp=$("chem3DPanel")?.querySelector(".chem-3d-help");
    if(chemHelp&&!chemHelp.dataset.inspectTouchHelp){chemHelp.dataset.inspectTouchHelp="1";chemHelp.textContent="Desktop: drag to rotate · wheel/right drag to zoom · middle or Ctrl/⌘ drag to pan · Mobile: one-finger drag to rotate · pinch to zoom · two-finger drag to pan";}
    const tertiaryHelp=document.querySelector("#scene-tertiary .te-interaction-help");
    if(tertiaryHelp&&!tertiaryHelp.dataset.inspectTouchHelp){tertiaryHelp.dataset.inspectTouchHelp="1";tertiaryHelp.textContent="Desktop: drag to rotate · wheel to zoom · right/middle drag to pan · Mobile: one-finger drag to rotate · pinch to zoom · two-finger drag to pan";}
  }

  function refresh() {
    ensureUi();bind2DSelectionAndZoom();harden3DTouch();
    const g=graph(),sig=graphSignature(g);
    if(sig!==lastGraphSignature){
      lastGraphSignature=sig;picks=[];lastVisualKey="";clearVisuals();
      if(property!=="off")setResult(instruction(),"idle");
    }
    const v=get3DViewer();if(v)viewer=v;
    const m=get3DModel(viewer);if(m)model=m;
    if(model&&model!==lastModel){lastModel=model;lastVisualKey="";bind3DClicking();}
    else if(viewer)bind3DClicking();
    apply2DHighlight();
    if(property!=="off")applyInspection(false);
  }

  function initialize() {
    refresh();
    pollTimer=setInterval(refresh,280);
    window.addEventListener("resize",harden3DTouch,{passive:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();
