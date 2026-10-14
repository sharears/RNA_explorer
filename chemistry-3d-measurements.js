(() => {
  "use strict";

  const ACCENT = "#f2c66d";
  const PICK = "#74d7b6";
  let panel = null, host = null, viewer = null, model = null, lastModel = null;
  let tool = "off", picks = [], measurementShapes = [], measurementLabels = [];
  let pollTimer = null;

  const $ = id => document.getElementById(id);
  const clonePoint = atom => ({
    x:Number(atom?.x||0), y:Number(atom?.y||0), z:Number(atom?.z||0),
    elem:String(atom?.elem||"?") , index:Number.isInteger(atom?.index)?atom.index:null,
    serial:atom?.serial ?? null, atom:atom?.atom || "", resn:atom?.resn || ""
  });

  function getViewer(){
    host=$("chem3DMolViewer");
    if(!host)return null;
    for(const canvas of host.querySelectorAll("canvas")){
      if(canvas._3dmol_viewer)return canvas._3dmol_viewer;
    }
    return null;
  }

  function getModel(){
    if(!viewer)return null;
    try{const models=viewer.getModels?.();if(Array.isArray(models)&&models.length)return models[0];}catch(_e){}
    try{return viewer.getModel?.()||null;}catch(_e){return null;}
  }

  function setResult(text,state="idle"){
    const el=$("chem3DMeasureResult");if(!el)return;
    el.textContent=text;el.dataset.state=state;
  }

  function clearGraphics(){
    if(viewer){
      measurementShapes.forEach(shape=>{try{viewer.removeShape?.(shape);}catch(_e){}});
      measurementLabels.forEach(label=>{try{viewer.removeLabel?.(label);}catch(_e){}});
      try{viewer.render();}catch(_e){}
    }
    measurementShapes=[];measurementLabels=[];picks=[];
  }

  function atomLabel(atom){
    const elem=String(atom?.elem||"?");
    const idx=Number.isInteger(atom?.index)?atom.index+1:(atom?.serial??"");
    return idx!==""?`${elem}${idx}`:elem;
  }

  function addPickMarker(atom){
    if(!viewer||!atom)return;
    try{
      const shape=viewer.addSphere({center:{x:atom.x,y:atom.y,z:atom.z},radius:.24,color:PICK,opacity:.65});
      measurementShapes.push(shape);
    }catch(_e){}
  }

  function addSegment(a,b,color=ACCENT,radius=.035){
    if(!viewer||!a||!b)return;
    try{
      const shape=viewer.addCylinder({start:{x:a.x,y:a.y,z:a.z},end:{x:b.x,y:b.y,z:b.z},radius,color,opacity:.9,fromCap:1,toCap:1});
      measurementShapes.push(shape);
    }catch(_e){}
  }

  function addText(text,position){
    if(!viewer)return;
    try{
      const label=viewer.addLabel(text,{position,fontSize:13,fontColor:"#07111c",backgroundColor:ACCENT,backgroundOpacity:.94,borderColor:"#ffffff",borderThickness:1,inFront:true});
      measurementLabels.push(label);
    }catch(_e){}
  }

  const vec=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>Math.hypot(a.x,a.y,a.z);
  const scale=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});

  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
  function angleDeg(a,b,c){
    const u=vec(a,b),v=vec(c,b),den=norm(u)*norm(v);if(!den)return NaN;
    const x=Math.max(-1,Math.min(1,dot(u,v)/den));return Math.acos(x)*180/Math.PI;
  }
  function dihedralDeg(a,b,c,d){
    const b0=sub(b,a),b1=sub(c,b),b2=sub(d,c),b1n=norm(b1);if(!b1n)return NaN;
    const bhat=scale(b1,1/b1n),v=sub(b0,scale(bhat,dot(b0,bhat))),w=sub(b2,scale(bhat,dot(b2,bhat)));
    const nv=norm(v),nw=norm(w);if(!nv||!nw)return NaN;
    const x=dot(v,w)/(nv*nw),y=dot(cross(bhat,v),w)/(nv*nw);
    return Math.atan2(y,x)*180/Math.PI;
  }

  function inferHybridization(atom){
    const elem=String(atom?.elem||"").toUpperCase();
    if(elem==="H")return "not applicable";
    const orders=Array.isArray(atom?.bondOrder)?atom.bondOrder.map(Number):[];
    const high=orders.filter(o=>o>=1.5);
    if(orders.some(o=>o>=2.5)||high.length>=2)return "sp";
    if(high.length===1)return "sp²";
    if(["C","N","O","P","S","B","SI"].includes(elem))return "sp³";
    return "not assigned";
  }

  function atomInfo(atom){
    const elem=String(atom?.elem||"?");
    const bonds=Array.isArray(atom?.bonds)?atom.bonds.length:0;
    const orders=Array.isArray(atom?.bondOrder)?atom.bondOrder.map(Number).filter(Number.isFinite):[];
    const orderText=orders.length?orders.map(o=>Number.isInteger(o)?String(o):o.toFixed(1)).join(", "):"none";
    return `${atomLabel(atom)} · inferred hybridization ${inferHybridization(atom)} · ${bonds} bonded neighbor${bonds===1?"":"s"} · bond order${orders.length===1?"":"s"}: ${orderText}`;
  }

  function completeMeasurement(){
    if(tool==="distance"&&picks.length===2){
      const [a,b]=picks,d=distance(a,b);addSegment(a,b);addText(`${d.toFixed(3)} Å`,midpoint(a,b));
      setResult(`${atomLabel(a)}–${atomLabel(b)} distance: ${d.toFixed(3)} Å`,"ready");
    }else if(tool==="angle"&&picks.length===3){
      const [a,b,c]=picks,v=angleDeg(a,b,c);addSegment(a,b);addSegment(b,c);addText(`${v.toFixed(2)}°`,b);
      setResult(`${atomLabel(a)}–${atomLabel(b)}–${atomLabel(c)} bond angle: ${v.toFixed(2)}°`,"ready");
    }else if(tool==="dihedral"&&picks.length===4){
      const [a,b,c,d]=picks,v=dihedralDeg(a,b,c,d);addSegment(a,b);addSegment(b,c);addSegment(c,d);addText(`${v.toFixed(2)}°`,midpoint(b,c));
      setResult(`${atomLabel(a)}–${atomLabel(b)}–${atomLabel(c)}–${atomLabel(d)} dihedral: ${v.toFixed(2)}°`,"ready");
    }
    try{viewer?.render();}catch(_e){}
  }

  function pickAtom(atom){
    if(tool==="off"||!atom)return;
    if(tool==="atominfo"){
      clearGraphics();addPickMarker(atom);setResult(atomInfo(atom)+". Hybridization is inferred from the displayed bond-order pattern.","ready");
      try{viewer?.render();}catch(_e){};return;
    }
    const needed=tool==="distance"?2:tool==="angle"?3:4;
    if(picks.length>=needed)clearGraphics();
    const p=clonePoint(atom);p.elem=atom.elem;p.index=atom.index;p.serial=atom.serial;p.bonds=atom.bonds;p.bondOrder=atom.bondOrder;
    picks.push(p);addPickMarker(atom);
    if(picks.length<needed)setResult(`Selected ${picks.length} of ${needed} atoms. Click ${needed-picks.length} more.`,"busy");
    else completeMeasurement();
    try{viewer?.render();}catch(_e){}
  }

  function bindModel(){
    if(!model)return;
    try{
      model.setClickable({},false);
      if(tool!=="off")model.setClickable({},true,atom=>pickAtom(atom));
    }catch(_e){}
  }

  function toolInstruction(){
    if(tool==="distance")return "Click 2 atoms to measure distance.";
    if(tool==="angle")return "Click 3 atoms in order to measure a bond angle.";
    if(tool==="dihedral")return "Click 4 atoms in order to measure a dihedral angle.";
    if(tool==="atominfo")return "Click an atom to inspect its inferred hybridization and bonding.";
    return "Choose a measurement or atom-inspection tool.";
  }

  function setTool(value){
    tool=value||"off";clearGraphics();bindModel();setResult(toolInstruction(),"idle");
  }

  function ensureUi(){
    panel=$("chem3DPanel");host=$("chem3DMolViewer");if(!panel||!host)return false;
    if($("chem3DMeasureTools"))return true;
    const wrap=document.createElement("div");wrap.id="chem3DMeasureTools";wrap.className="chem-3d-measure-tools";
    wrap.innerHTML=`
      <div class="chem-3d-measure-heading"><strong>Measure / inspect</strong><span>Calculated from the currently displayed 3D coordinates</span></div>
      <div class="chem-3d-measure-row">
        <label>Tool
          <select id="chem3DMeasureMode">
            <option value="off">Off</option>
            <option value="distance">Distance · 2 atoms</option>
            <option value="angle">Bond angle · 3 atoms</option>
            <option value="dihedral">Dihedral angle · 4 atoms</option>
            <option value="atominfo">Atom info / hybridization</option>
          </select>
        </label>
        <button type="button" id="chem3DMeasureClear">Clear</button>
      </div>
      <p id="chem3DMeasureResult" class="chem-3d-measure-result" role="status">Choose a measurement or atom-inspection tool.</p>
      <p class="chem-3d-measure-note">Hybridization is inferred from the molecular graph and displayed bond orders; it is not an experimental measurement.</p>`;
    host.insertAdjacentElement("afterend",wrap);
    const style=document.createElement("style");style.id="chem3DMeasureStyles";style.textContent=`
      .chem-3d-measure-tools{margin:.75rem 0;padding:.7rem;border:1px solid rgba(135,169,204,.28);border-radius:10px;background:rgba(8,24,43,.38)}
      .chem-3d-measure-heading{display:flex;justify-content:space-between;gap:.7rem;align-items:baseline;flex-wrap:wrap}.chem-3d-measure-heading span{font-size:.76rem;opacity:.72}
      .chem-3d-measure-row{display:flex;gap:.55rem;align-items:end;flex-wrap:wrap;margin-top:.55rem}.chem-3d-measure-row label{display:grid;gap:.25rem;min-width:220px}.chem-3d-measure-row select{max-width:100%}
      .chem-3d-measure-result{margin:.55rem 0 .1rem;font-size:.82rem;line-height:1.45}.chem-3d-measure-result[data-state=ready]{color:#74d7b6}.chem-3d-measure-result[data-state=busy]{color:#f2c66d}
      .chem-3d-measure-note{margin:.25rem 0 0;font-size:.74rem;opacity:.7;line-height:1.4}`;
    document.head.appendChild(style);
    $("chem3DMeasureMode")?.addEventListener("change",e=>setTool(e.target.value));
    $("chem3DMeasureClear")?.addEventListener("click",()=>{clearGraphics();setResult(toolInstruction(),"idle");});
    return true;
  }

  function refresh(){
    if(!ensureUi())return;
    const v=getViewer();if(v)viewer=v;
    const m=getModel();if(m)model=m;
    if(model&&model!==lastModel){lastModel=model;clearGraphics();bindModel();setResult(toolInstruction(),"idle");}
  }

  function initialize(){
    refresh();
    pollTimer=setInterval(()=>{
      refresh();
      if(!document.body.contains($("chem3DPanel"))&&pollTimer){clearInterval(pollTimer);pollTimer=null;}
    },350);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();
