from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return out


# Molecular Drawing: smart attachments, resize/rotate, ring fusion.
p = Path("chemistry-editor.js")
text = p.read_text()
text = replace_once(
    text,
    'selectedAtoms=new Set(),pendingAtom=null,drag=null,selectionBox=null,lasso=null,onSave=null;',
    'selectedAtoms=new Set(),pendingAtom=null,drag=null,selectionBox=null,lasso=null,transformDrag=null,pendingFuseBond=null,onSave=null;',
    'chem globals',
)
text = replace_once(
    text,
    '<button type="button" data-chem-tool="bond">Add bond</button>',
    '<button type="button" data-chem-tool="bond">Add bond</button><button type="button" data-chem-tool="fuse">Fuse rings</button>',
    'fuse toolbar button',
)
text = replace_once(
    text,
    'tool=b.dataset.chemTool;pendingAtom=null;selectionBox=null;lasso=null;',
    'tool=b.dataset.chemTool;pendingAtom=null;pendingFuseBond=null;transformDrag=null;selectionBox=null;lasso=null;',
    'tool reset',
)
text = replace_once(
    text,
    'const n=kind==="five"?5:6,r=58,points=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/n;return [Math.cos(a)*r,Math.sin(a)*r];});',
    'const n=kind==="five"?5:6,bondLength=68,r=bondLength/(2*Math.sin(Math.PI/n)),points=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/n;return [Math.cos(a)*r,Math.sin(a)*r];});',
    'ring bond length',
)

helpers = r'''  function selectedBounds(){
    const atoms=[...selectedAtoms].map(atomById).filter(Boolean);if(!atoms.length)return null;
    return {minX:Math.min(...atoms.map(a=>a.x)),maxX:Math.max(...atoms.map(a=>a.x)),minY:Math.min(...atoms.map(a=>a.y)),maxY:Math.max(...atoms.map(a=>a.y))};
  }
  function appendTransformOverlay(){
    if(tool!=="select"||selectedAtoms.size<2||selectionBox||lasso||!svg)return;
    const b=selectedBounds();if(!b)return;const pad=22,x=b.minX-pad,y=b.minY-pad,w=Math.max(24,b.maxX-b.minX+pad*2),h=Math.max(24,b.maxY-b.minY+pad*2),cx=x+w/2;
    const layer=document.createElementNS(NS,"g");layer.setAttribute("class","chem-transform-overlay");layer.setAttribute("data-export-remove","");
    const rect=document.createElementNS(NS,"rect");rect.setAttribute("x",x);rect.setAttribute("y",y);rect.setAttribute("width",w);rect.setAttribute("height",h);rect.setAttribute("rx","4");rect.style.fill="none";rect.style.stroke="#f2c66d";rect.style.strokeWidth="1.5";rect.style.strokeDasharray="6 4";rect.style.pointerEvents="none";layer.append(rect);
    const stem=document.createElementNS(NS,"line");stem.setAttribute("x1",cx);stem.setAttribute("y1",y);stem.setAttribute("x2",cx);stem.setAttribute("y2",y-30);stem.style.stroke="#f2c66d";stem.style.strokeWidth="1.5";stem.style.pointerEvents="none";layer.append(stem);
    [["nw",x,y],["ne",x+w,y],["se",x+w,y+h],["sw",x,y+h]].forEach(([name,hx,hy])=>{const c=document.createElementNS(NS,"circle");c.dataset.transformHandle=name;c.setAttribute("cx",hx);c.setAttribute("cy",hy);c.setAttribute("r","7");c.style.fill="#07111c";c.style.stroke="#f2c66d";c.style.strokeWidth="2";c.style.cursor=name+"-resize";layer.append(c);});
    const rotate=document.createElementNS(NS,"circle");rotate.dataset.transformHandle="rotate";rotate.setAttribute("cx",cx);rotate.setAttribute("cy",y-30);rotate.setAttribute("r","8");rotate.style.fill="#f2c66d";rotate.style.stroke="#07111c";rotate.style.strokeWidth="2";rotate.style.cursor="grab";layer.append(rotate);svg.append(layer);
  }
  function beginSelectionTransform(handle,pointerId,start){
    const bounds=selectedBounds();if(!bounds)return false;
    const center={x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2},original=[...selectedAtoms].map(id=>{const a=atomById(id);return a?{id,x:a.x,y:a.y}:null;}).filter(Boolean);
    const dx=start.x-center.x,dy=start.y-center.y;
    transformDrag={pointer:pointerId,kind:handle==="rotate"?"rotate":"scale",center,original,startAngle:Math.atan2(dy,dx),startRadius:Math.max(8,Math.hypot(dx,dy))};return true;
  }
  function moveSelectionTransform(current){
    if(!transformDrag)return;
    const t=transformDrag,dx=current.x-t.center.x,dy=current.y-t.center.y;
    if(t.kind==="rotate"){
      const delta=Math.atan2(dy,dx)-t.startAngle,c=Math.cos(delta),s=Math.sin(delta);
      t.original.forEach(o=>{const a=atomById(o.id);if(!a)return;const ox=o.x-t.center.x,oy=o.y-t.center.y;a.x=t.center.x+ox*c-oy*s;a.y=t.center.y+ox*s+oy*c;});
    }else{
      const scale=clamp(Math.hypot(dx,dy)/t.startRadius,.18,5);
      t.original.forEach(o=>{const a=atomById(o.id);if(a){a.x=t.center.x+(o.x-t.center.x)*scale;a.y=t.center.y+(o.y-t.center.y)*scale;}});
    }
  }
  function attachmentNeighbors(id){
    return graph.bonds.filter(b=>b.a===id||b.b===id).map(b=>({bond:b,atom:atomById(b.a===id?b.b:b.a)})).filter(x=>x.atom);
  }
  function angularDistance(a,b){let d=Math.abs(a-b)%(Math.PI*2);return Math.min(d,Math.PI*2-d);}
  function smartAttachmentPosition(originId,pointer){
    const origin=atomById(originId);if(!origin)return pointer||{x:410,y:235};
    const neighbors=attachmentNeighbors(originId),lengths=neighbors.map(({atom})=>Math.hypot(atom.x-origin.x,atom.y-origin.y)).filter(v=>v>20&&v<160).sort((a,b)=>a-b);
    const length=lengths.length?lengths[Math.floor(lengths.length/2)]:68,targetAngle=pointer?Math.atan2(pointer.y-origin.y,pointer.x-origin.x):0;let angle=targetAngle;
    if(neighbors.length===1){
      const n=neighbors[0],baseAngle=Math.atan2(n.atom.y-origin.y,n.atom.x-origin.x);
      if(Number(n.bond.order||1)>1)angle=baseAngle+Math.PI;
      else{const options=[baseAngle+Math.PI*2/3,baseAngle-Math.PI*2/3];angle=pointer?options.sort((a,b)=>angularDistance(a,targetAngle)-angularDistance(b,targetAngle))[0]:options[0];}
    }else if(neighbors.length>=2){
      const angles=neighbors.map(({atom})=>{let a=Math.atan2(atom.y-origin.y,atom.x-origin.x);if(a<0)a+=Math.PI*2;return a;}).sort((a,b)=>a-b);let bestStart=angles[0],bestGap=-1;
      for(let i=0;i<angles.length;i++){const start=angles[i],end=i===angles.length-1?angles[0]+Math.PI*2:angles[i+1],gap=end-start;if(gap>bestGap){bestGap=gap;bestStart=start;}}
      angle=bestStart+bestGap/2;
    }
    return {x:clamp(origin.x+Math.cos(angle)*length,22,798),y:clamp(origin.y+Math.sin(angle)*length,22,448)};
  }
  function componentCentroid(ids){
    const atoms=[...ids].map(atomById).filter(Boolean);if(!atoms.length)return {x:0,y:0};return {x:atoms.reduce((s,a)=>s+a.x,0)/atoms.length,y:atoms.reduce((s,a)=>s+a.y,0)/atoms.length};
  }
  function sideOfBond(p,a,b){return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
  function fuseBonds(firstId,secondId){
    const first=graph.bonds.find(b=>b.id===firstId),second=graph.bonds.find(b=>b.id===secondId);if(!first||!second||first.id===second?.id){status.textContent="Choose two different ring bonds to fuse.";return false;}
    const fixedIds=new Set(covalentComponent(first.a)),movingIds=new Set(covalentComponent(second.a));
    if([...movingIds].some(id=>fixedIds.has(id))){status.textContent="Those bonds are already in the same covalent structure. Choose one bond from each separate ring.";return false;}
    const fA=atomById(first.a),fB=atomById(first.b),sA=atomById(second.a),sB=atomById(second.b);if(!fA||!fB||!sA||!sB)return false;
    const targetLen=Math.hypot(fB.x-fA.x,fB.y-fA.y),sourceLen=Math.hypot(sB.x-sA.x,sB.y-sA.y);if(targetLen<1||sourceLen<1)return false;
    const fixedCenter=componentCentroid(fixedIds),movingCenter=componentCentroid(movingIds),fixedSide=sideOfBond(fixedCenter,fA,fB);
    const candidate=reverse=>{
      const src1=reverse?sB:sA,src2=reverse?sA:sB,sourceAngle=Math.atan2(src2.y-src1.y,src2.x-src1.x),targetAngle=Math.atan2(fB.y-fA.y,fB.x-fA.x),theta=targetAngle-sourceAngle,scale=targetLen/sourceLen,c=Math.cos(theta),s=Math.sin(theta);
      const transform=p=>{const x=(p.x-src1.x)*scale,y=(p.y-src1.y)*scale;return {x:fA.x+x*c-y*s,y:fA.y+x*s+y*c};};
      const movedCenter=transform(movingCenter),movingSide=sideOfBond(movedCenter,fA,fB),opposite=Math.abs(fixedSide)<1||fixedSide*movingSide<0;
      return {reverse,transform,score:(opposite?100000:0)+Math.abs(movingSide)};
    };
    const best=[candidate(false),candidate(true)].sort((a,b)=>b.score-a.score)[0];
    movingIds.forEach(id=>{const a=atomById(id);if(a){const p=best.transform(a);a.x=p.x;a.y=p.y;}});
    const endpointMap=new Map(best.reverse?[[second.b,first.a],[second.a,first.b]]:[[second.a,first.a],[second.b,first.b]]),removed=new Set([second.a,second.b]);
    graph.atoms=graph.atoms.filter(a=>!removed.has(a.id));
    const seen=new Set(),newBonds=[];
    graph.bonds.forEach(b=>{if(b.id===second.id)return;const a=endpointMap.get(b.a)||b.a,c=endpointMap.get(b.b)||b.b;if(a===c)return;const key=[a,c].sort().join("|");if(seen.has(key))return;seen.add(key);newBonds.push({...b,a,b:c});});graph.bonds=newBonds;
    graph.hbonds=graph.hbonds.map(h=>({...h,a:endpointMap.get(h.a)||h.a,b:endpointMap.get(h.b)||h.b})).filter(h=>h.a!==h.b&&atomById(h.a)&&atomById(h.b));
    const ids=[...fixedIds,...movingIds].map(id=>endpointMap.get(id)||id).filter(id=>atomById(id));selectAtoms([...new Set(ids)],first.a);pendingFuseBond=null;invalidateIupac();render();validate();status.textContent="Rings fused: the selected edges now share one pair of atoms and one bond.";return true;
  }

'''
text = replace_once(text, '  function loadCurrent(){', helpers + '  function loadCurrent(){', 'chem helper insertion')
text = replace_once(
    text,
    'selectedAtom=null;selectedAtoms.clear();pendingAtom=null;drag=null;selectionBox=null;lasso=null;',
    'selectedAtom=null;selectedAtoms.clear();pendingAtom=null;pendingFuseBond=null;drag=null;transformDrag=null;selectionBox=null;lasso=null;',
    'renumber reset',
)
text = replace_once(
    text,
    '    const atomEl=e.target.closest?.("[data-atom-id]"),bondEl=e.target.closest?.("[data-bond-id]"),hEl=e.target.closest?.("[data-hbond-id]");',
    '    const transformEl=e.target.closest?.("[data-transform-handle]");\n    if(tool==="select"&&transformEl&&selectedAtoms.size>=2){const p=point(e);if(beginSelectionTransform(transformEl.dataset.transformHandle,e.pointerId,p)){svg.setPointerCapture?.(e.pointerId);render();}return;}\n    const atomEl=e.target.closest?.("[data-atom-id]"),bondEl=e.target.closest?.("[data-bond-id]"),hEl=e.target.closest?.("[data-hbond-id]");',
    'transform pointerdown',
)
text = replace_once(
    text,
    '    if(tool==="atom"&&!atomEl){\n      const p=point(e),id="X"+atomSerial++;\n      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element,textStyle:{...textDefaults}});\n      invalidateIupac();selectAtoms([id],id);render();validate();return;\n    }',
    '    if(tool==="atom"&&!atomEl){\n      const p=point(e),id="X"+atomSerial++;\n      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element,textStyle:{...textDefaults}});\n      invalidateIupac();selectAtoms([id],id);render();validate();return;\n    }\n    if(tool==="bond"&&pendingAtom&&!atomEl&&!bondEl&&!hEl){\n      const p=smartAttachmentPosition(pendingAtom,point(e)),id="X"+atomSerial++;\n      graph.atoms.push({id,element,x:p.x,y:p.y,charge:0,label:element,textStyle:{...textDefaults}});\n      graph.bonds.push({id:"b"+bondSerial++,a:pendingAtom,b:id,order:bondOrder});pendingAtom=null;invalidateIupac();selectAtoms([id],id);render();validate();status.textContent="New atom placed at a geometry-aware bond angle. Drag it if you want a different arrangement.";return;\n    }\n    if(tool==="fuse"&&bondEl){\n      const id=bondEl.dataset.bondId;if(!pendingFuseBond){pendingFuseBond=id;status.textContent="First fusion edge selected. Now click one bond on the other ring.";render();}else if(id===pendingFuseBond){pendingFuseBond=null;status.textContent="Fusion selection cleared.";render();}else fuseBonds(pendingFuseBond,id);return;\n    }',
    'smart bond and fuse pointerdown',
)
text = replace_once(
    text,
    '  function canvasPointerMove(e){\n    if(lasso&&e.pointerId===lasso.pointer){',
    '  function canvasPointerMove(e){\n    if(transformDrag&&e.pointerId===transformDrag.pointer){moveSelectionTransform(point(e));render();return;}\n    if(lasso&&e.pointerId===lasso.pointer){',
    'transform pointermove',
)
text = replace_once(
    text,
    '  function canvasPointerUp(e){\n    if(lasso&&e.pointerId===lasso.pointer){',
    '  function canvasPointerUp(e){\n    if(transformDrag&&e.pointerId===transformDrag.pointer){transformDrag=null;if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);invalidateIupac();render();validate();return;}\n    if(lasso&&e.pointerId===lasso.pointer){',
    'transform pointerup',
)
text = replace_once(
    text,
    '      const g=document.createElementNS(NS,"g");g.dataset.bondId=b.id;g.setAttribute("class","chem-editor-bond");',
    '      const g=document.createElementNS(NS,"g");g.dataset.bondId=b.id;g.setAttribute("class","chem-editor-bond"+(pendingFuseBond===b.id?" pending-fuse":""));',
    'pending fuse class',
)
text = replace_once(
    text,
    '        g.append(line);',
    '        if(pendingFuseBond===b.id){line.style.stroke="#f2c66d";line.style.strokeWidth="4";}g.append(line);',
    'pending fuse styling',
)
text = replace_once(
    text,
    '    svg.append(bondLayer,hLayer,rLayer,atomLayer);\n    if(selectionBox){',
    '    svg.append(bondLayer,hLayer,rLayer,atomLayer);\n    appendTransformOverlay();\n    if(selectionBox){',
    'transform overlay render',
)
text = replace_once(
    text,
    '"Ready. Select / move supports box selection; Lasso select lets you draw around atoms. Shift adds to a selection. Double-click an atom to select its whole covalent structure."',
    '"Ready. Select / move supports box selection; lasso selects freeform groups. Multi-atom selections get resize and rotate handles. Add bond can place a new atom at a geometry-aware angle; Fuse rings merges two selected ring edges."',
    'editor status copy',
)
p.write_text(text)


# Secondary: independent residue-circle toggle across radial/circular/arc.
p = Path("secondary.js")
text = p.read_text()
text = replace_once(
    text,
    'circleColor:"#c5d6e2",circleWidth:1,letterColor:"#fff",letterSize:16,',
    'circleColor:"#c5d6e2",circleWidth:1,circleVisible:true,letterColor:"#fff",letterSize:16,',
    'secondary circle setting',
)
text = replace_once(
    text,
    'g.append(svg("circle",{r:16,fill:s.fillColor,stroke:s.circleColor,"stroke-width":s.circleWidth}));',
    'if(s.circleVisible!==false)g.append(svg("circle",{r:16,fill:s.fillColor,stroke:s.circleColor,"stroke-width":s.circleWidth}));',
    'secondary circle render',
)
text = replace_once(
    text,
    '<details><summary>Nucleotide circles & letters</summary>',
    '<details><summary>Nucleotide circles & letters</summary><label class="se-check"><input id="seCircleVisible" type="checkbox" checked> Show residue circles</label>',
    'secondary circle control',
)
text = replace_once(
    text,
    '    reorganizeControls(controls);\n',
    '    reorganizeControls(controls);\n    if($("seCircleVisible")){$("seCircleVisible").checked=settings.circleVisible!==false;$("seCircleVisible").addEventListener("change",e=>{settings.circleVisible=e.target.checked;render();});}\n',
    'secondary circle listener',
)
marker = '    setChecked("seShowSelectedLabel",settings.showSelectedLabel);'
if marker in text:
    text = text.replace(marker, marker + 'setChecked("seCircleVisible",settings.circleVisible!==false);', 1)
p.write_text(text)


# Tertiary learning mini-view: pinch zoom, zoom buttons, torsion labels.
p = Path("guided-transitions.js")
text = p.read_text()
text = replace_once(
    text,
    'title:"Backbone torsions α–ζ",\n      definition:"Six torsion angles describe rotations along the phosphodiester backbone: α, β, γ, δ, ε and ζ.",\n      notice:"The complete nucleotide stays visible while four atoms defining one backbone torsion are emphasized. In the full RNA viewer you can choose α, β, γ, δ, ε or ζ individually.",',
    'title:"RNA torsion angles α–ζ and χ",\n      definition:"Six backbone torsions—α, β, γ, δ, ε and ζ—plus the glycosidic torsion χ describe local RNA geometry.",\n      notice:"The local nucleotide and backbone stay visible while labels mark the central bond associated with α, β, γ, δ, ε, ζ and χ. χ is the glycosidic torsion, not a phosphodiester-backbone torsion.",',
    'torsion lesson copy',
)
old = '''      backbone:normalizeRealNucleotides(allAtoms,[["C",2,"C2"]],[["C2","P"],["C2","O5'"],["C2","C5'"],["C2","C4'"]],[["C2","O5'","C2","C5'"]]),'''
new = '''      backbone:(()=>{\n        const m=normalizeRealNucleotides(allAtoms,[["G",1,"G1"],["C",2,"C2"],["G",3,"G3"]],[["G1","O3'"],["C2","P"],["C2","O5'"],["C2","C5'"],["C2","C4'"],["C2","C3'"],["C2","O3'"],["G3","P"],["C2","C1'"],["C2","N1"]]);\n        m.torsionLabels=[\n          {symbol:"α",a:"C2:P",b:"C2:O5'"},{symbol:"β",a:"C2:O5'",b:"C2:C5'"},{symbol:"γ",a:"C2:C5'",b:"C2:C4'"},\n          {symbol:"δ",a:"C2:C4'",b:"C2:C3'"},{symbol:"ε",a:"C2:C3'",b:"C2:O3'"},{symbol:"ζ",a:"C2:O3'",b:"G3:P"},{symbol:"χ",a:"C2:C1'",b:"C2:N1"}\n        ];return m;\n      })(),'''
text = replace_once(text, old, new, 'real torsion model')
text = replace_once(
    text,
    '<div class="gps-mini-toolbar inline"><span>Left drag: rotate · Right/Ctrl drag: pan · Wheel: zoom · Double-click: reset</span><div><button type="button" id="gpsLabelsToggle">Labels: on</button><button type="button" id="gpsMiniReset">Reset / center</button></div></div>',
    '<div class="gps-mini-toolbar inline"><span>Mouse/one finger: rotate · Right/Ctrl drag: pan · Wheel or pinch: zoom · Double-click: reset</span><div><button type="button" id="gpsMiniZoomOut" aria-label="Zoom out">−</button><button type="button" id="gpsMiniZoomIn" aria-label="Zoom in">+</button><button type="button" id="gpsLabelsToggle">Labels: on</button><button type="button" id="gpsMiniReset">Reset / center</button></div></div>',
    'mini toolbar zoom controls',
)
text = replace_once(
    text,
    '    $("gpsMiniReset")?.addEventListener("click",()=>{resetMiniView();renderMiniModel();});\n    $("gpsLabelsToggle")?.addEventListener("click",()=>{state.labelsOn=!state.labelsOn;$("gpsLabelsToggle").textContent="Labels: "+(state.labelsOn?"on":"off");renderMiniModel();});',
    '    $("gpsMiniReset")?.addEventListener("click",()=>{resetMiniView();renderMiniModel();});\n    $("gpsMiniZoomOut")?.addEventListener("click",()=>{state.zoom=Math.max(.42,state.zoom*.82);renderMiniModel();});\n    $("gpsMiniZoomIn")?.addEventListener("click",()=>{state.zoom=Math.min(3.2,state.zoom*1.22);renderMiniModel();});\n    $("gpsLabelsToggle")?.addEventListener("click",()=>{state.labelsOn=!state.labelsOn;$("gpsLabelsToggle").textContent="Labels: "+(state.labelsOn?"on":"off");renderMiniModel();});',
    'mini zoom listeners',
)
interaction_pattern = r'''    const svg=\$\("gpsMini3D"\);\n    if\(svg&&!svg\.dataset\.interactionsReady\)\{.*?\n    \}\n    renderMiniLesson\(\);'''
interaction_repl = r'''    const svg=$("gpsMini3D");
    if(svg&&!svg.dataset.interactionsReady){
      svg.dataset.interactionsReady="true";svg.style.touchAction="none";
      const pointers=new Map();let pinch=null;
      const clampZoom=z=>Math.max(.42,Math.min(3.2,z));
      const pointerCenter=()=>{const a=[...pointers.values()];return a.length<2?null:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)};};
      svg.addEventListener("contextmenu",e=>e.preventDefault());
      svg.addEventListener("wheel",e=>{e.preventDefault();state.zoom=clampZoom(state.zoom*(e.deltaY<0?1.1:.91));renderMiniModel();},{passive:false});
      svg.addEventListener("dblclick",e=>{e.preventDefault();resetMiniView();pointers.clear();pinch=null;renderMiniModel();});
      svg.addEventListener("pointerdown",e=>{
        if(e.pointerType==="mouse"&&![0,1,2].includes(e.button))return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture?.(e.pointerId);
        if(pointers.size>=2){const c=pointerCenter();pinch={distance:Math.max(1,c.d),zoom:state.zoom,x:c.x,y:c.y,panX:state.panX,panY:state.panY};state.dragMode="pinch";}
        else{state.dragging=true;state.dragMode=(e.pointerType==="mouse"&&(e.button===2||e.ctrlKey||e.metaKey||e.button===1))?"pan":"rotate";state.lastX=e.clientX;state.lastY=e.clientY;}
      });
      svg.addEventListener("pointermove",e=>{
        if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size>=2){if(!pinch){const c=pointerCenter();pinch={distance:Math.max(1,c.d),zoom:state.zoom,x:c.x,y:c.y,panX:state.panX,panY:state.panY};}const c=pointerCenter();state.zoom=clampZoom(pinch.zoom*(c.d/pinch.distance));state.panX=pinch.panX+(c.x-pinch.x);state.panY=pinch.panY+(c.y-pinch.y);renderMiniModel();return;}
        const dx=e.clientX-state.lastX,dy=e.clientY-state.lastY;if(state.dragMode==="pan"){state.panX+=dx;state.panY+=dy;}else{state.yaw+=dx*.0085;state.pitch=Math.max(-1.48,Math.min(1.48,state.pitch+dy*.0085));}state.lastX=e.clientX;state.lastY=e.clientY;renderMiniModel();
      });
      const end=e=>{pointers.delete(e.pointerId);if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);pinch=null;if(pointers.size===1){const p=[...pointers.values()][0];state.lastX=p.x;state.lastY=p.y;state.dragMode="rotate";state.dragging=true;}else if(!pointers.size)state.dragging=false;};svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end);
    }
    renderMiniLesson();'''
text = sub_once(text, interaction_pattern, interaction_repl, 'mini pointer interactions', flags=re.S)
text = replace_once(
    text,
    "    svg.innerHTML='<g>'+bonds+guides+nodes+'</g>';",
    '''    const torsionLabels=(model.torsionLabels||[]).map(t=>{const p=map.get(t.a),q=map.get(t.b);if(!p||!q)return"";const A=screen(p),B=screen(q),dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,x=(A.x+B.x)/2-dy/len*16,y=(A.y+B.y)/2+dx/len*16;return '<g class="gps-torsion-label" transform="translate('+x+' '+y+')"><circle r="11" fill="#07111c" stroke="#f2c66d" stroke-width="1.8"/><text y="4" text-anchor="middle" fill="#f7fbff" font-size="13" font-weight="800">'+t.symbol+'</text></g>';}).join("");\n    svg.innerHTML='<g>'+bonds+guides+nodes+torsionLabels+'</g>';''',
    'torsion labels render',
)
text = replace_once(
    text,
    'realContext?"Complete nucleotide context · PDB 1EHZ · highlighted atoms mark the feature":"Interactive stick model · element-colored atoms";',
    'realContext?(state.miniFeature==="backbone"?"Complete local backbone · PDB 1EHZ · α β γ δ ε ζ label backbone torsions; χ labels the glycosidic torsion":"Complete nucleotide context · PDB 1EHZ · highlighted atoms mark the feature"):"Interactive stick model · element-colored atoms";',
    'torsion caption',
)
p.write_text(text)


# Cache bust changed modules.
p = Path("index.html")
text = p.read_text()
text = text.replace('chemistry-editor.js?v=chem-editor-8', 'chemistry-editor.js?v=chem-editor-9')
text = text.replace('guided-transitions.js?v=guided-5', 'guided-transitions.js?v=guided-7')
text = text.replace('secondary.js?v=secondary-20', 'secondary.js?v=secondary-21')
p.write_text(text)
