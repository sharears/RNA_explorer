from pathlib import Path

p=Path('chemistry-editor.js')
s=p.read_text()

replacements=[]
replacements.append((
'''  let ignoredValenceWarnings=new Set(),smartLayoutEnabled=true,threeDVisible=false;''',
'''  let ignoredValenceWarnings=new Set(),smartLayoutEnabled=true,threeDVisible=false,threeDMode="ideal";'''))

replacements.append((
'''    const show3d=toolbar.querySelector("#chem3DToggle");if(show3d){show3d.classList.add("chem-3d-toggle-prominent");show3d.title="Generate a geometry-optimized 3D conformer with MMFF94";}''',
'''    const show3d=toolbar.querySelector("#chem3DToggle");if(show3d){show3d.classList.add("chem-3d-toggle-prominent");show3d.title="Open the 3D view. Ideal geometry is shown by default; MMFF94 minimization is optional.";}'''))

replacements.append((
'''          <button type="button" id="chemTidy2D">Tidy 2D</button>''',
'''          <button type="button" id="chemTidy2D" title="Regenerate clean whole-molecule 2D coordinates with OpenChemLib">Ideal 2D</button>'''))

replacements.append((
'''          <aside class="chem-3d-panel" id="chem3DPanel" hidden aria-label="Interactive geometry-optimized 3D molecular preview">
            <div class="chem-3d-heading">
              <div class="chem-3d-title"><strong>Geometry-optimized 3D</strong><span id="chem3DStatus" data-state="idle">MMFF94 force-field optimization</span></div>
              <div class="chem-3d-view-controls" role="toolbar" aria-label="3D molecular view controls">''',
'''          <aside class="chem-3d-panel" id="chem3DPanel" hidden aria-label="Interactive 3D molecular preview">
            <div class="chem-3d-heading">
              <div class="chem-3d-title"><strong id="chem3DModeTitle">Ideal 3D geometry</strong><span id="chem3DStatus" data-state="idle">Ideal conformer · drawing arrangement preserved</span></div>
              <div class="chem-3d-mode-controls" role="group" aria-label="3D geometry mode">
                <button type="button" id="chem3DIdealMode" aria-pressed="true">Ideal 3D</button>
                <button type="button" id="chem3DOptimizeMode" aria-pressed="false">Energy minimize</button>
              </div>
              <div class="chem-3d-view-controls" role="toolbar" aria-label="3D molecular view controls">'''))

replacements.append((
'''    dialog.querySelector("#chemTidy2D").addEventListener("click",()=>{
      pushUndo();tidy2DGeometry();invalidateIupac();render();validate();
      status.textContent="2D geometry tidied: bond lengths and close contacts were regularized.";
    });''',
'''    dialog.querySelector("#chemTidy2D").addEventListener("click",async()=>{
      pushUndo();await idealize2DGeometry();
    });'''))

anchor='''  function tidy2DGeometry(){
    if(graph.atoms.length<2)return;
    const atoms=graph.atoms;
    for(let iter=0;iter<70;iter++){
      graph.bonds.forEach(b=>{
        const a=atomById(b.a),c=atomById(b.b);if(!a||!c)return;
        const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy)||1,target=Number(b.order||1)===1?68:Number(b.order||1)===2?64:60;
        const pull=(d-target)*0.12,ux=dx/d,uy=dy/d;
        a.x+=ux*pull*.5;a.y+=uy*pull*.5;c.x-=ux*pull*.5;c.y-=uy*pull*.5;
      });
      for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
        if(bondBetween(atoms[i].id,atoms[j].id))continue;
        const a=atoms[i],b=atoms[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
        if(d<48){const push=(48-d)*0.025,ux=dx/d,uy=dy/d;a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;}
      }
    }
    ensureCanvasContainsDrawing();
  }
'''
insert=anchor+'''  async function idealize2DGeometry(){
    if(graph.atoms.length<2){status.textContent="Add at least two connected atoms before generating ideal 2D coordinates.";return;}
    const engine=window.Chemistry3DForceField,snapshot=clone(graph),signature=graphSignature3D();
    status.textContent="Generating ideal 2D coordinates with OpenChemLib…";
    if(!engine?.generate2D){tidy2DGeometry();invalidateIupac();render();validate();status.textContent="OpenChemLib 2D layout is unavailable. A basic geometry cleanup was applied instead.";return;}
    try{
      const result=await engine.generate2D(snapshot);
      if(graphSignature3D()!==signature){status.textContent="The drawing changed while Ideal 2D was running, so the generated layout was not applied.";return;}
      const coords=new Map((result.coordinates||[]).map(q=>[q.id,q]));
      graph.atoms.forEach(atom=>{const q=coords.get(atom.id);if(q&&Number.isFinite(q.x)&&Number.isFinite(q.y)){atom.x=q.x;atom.y=q.y;}});
      ensureCanvasContainsDrawing();fitCanvasToDrawing(false);invalidateIupac();render();validate();
      status.textContent="Ideal 2D applied with OpenChemLib: standard bond geometry and clean whole-molecule layout; separate fragments keep their relative placement.";
    }catch(error){
      tidy2DGeometry();invalidateIupac();render();validate();
      status.textContent="OpenChemLib could not generate this 2D layout. A basic geometry cleanup was applied instead.";
      console.warn("RNA Explorer ideal 2D generation failed:",error);
    }
  }
'''
if anchor not in s: raise SystemExit('tidy2DGeometry anchor not found')
s=s.replace(anchor,insert,1)

old='''  function requestGeometryOptimized3D(signature){
    if(!threeDVisible||!signature||signature===threeDPendingSignature)return;
    const request=++threeDRequestSerial,snapshot=clone(graph),fallback=fallback3DModel();
    threeDCoords=fallback.atoms;threeDBonds=fallback.bonds;threeDPendingSignature=signature;
    set3DStatus("Generating conformer · MMFF94…","busy");
    const engine=window.Chemistry3DForceField;
    if(!engine?.generate){threeDSignature=signature;threeDPendingSignature="";set3DStatus("Force-field engine unavailable · rough preview","warning");return;}
    engine.generate(snapshot).then(model=>{
      if(request!==threeDRequestSerial||graphSignature3D()!==signature)return;
      threeDCoords=Array.isArray(model.atoms)?model.atoms:fallback.atoms;
      threeDBonds=Array.isArray(model.bonds)&&model.bonds.length?model.bonds:fallback.bonds;
      threeDSignature=signature;threeDPendingSignature="";
      set3DStatus((model.forceField||"Force field")+" optimized"+(model.hydrogensAdded?" · hydrogens added":""),"ready");
      schedule3DRender();
    }).catch(error=>{
      if(request!==threeDRequestSerial||graphSignature3D()!==signature)return;
      threeDCoords=fallback.atoms;threeDBonds=fallback.bonds;threeDSignature=signature;threeDPendingSignature="";
      set3DStatus("Optimization unavailable · rough preview","warning");
      console.warn("RNA Explorer 3D force-field optimization failed:",error);
      schedule3DRender();
    });
  }'''
new='''  function sync3DModeControls(){
    const ideal=dialog?.querySelector("#chem3DIdealMode"),optimized=dialog?.querySelector("#chem3DOptimizeMode"),titleNode=dialog?.querySelector("#chem3DModeTitle");
    if(ideal)ideal.setAttribute("aria-pressed",String(threeDMode==="ideal"));
    if(optimized)optimized.setAttribute("aria-pressed",String(threeDMode==="optimized"));
    if(titleNode)titleNode.textContent=threeDMode==="optimized"?"Energy-minimized 3D":"Ideal 3D geometry";
  }
  function set3DMode(mode){
    const next=mode==="optimized"?"optimized":"ideal";if(threeDMode===next&&threeDSignature)return;
    threeDMode=next;threeDSignature="";threeDPendingSignature="";threeDRequestSerial++;sync3DModeControls();
    if(threeDVisible)schedule3DRender(true);
  }
  function request3DModel(signature){
    if(!threeDVisible||!signature||signature===threeDPendingSignature)return;
    const request=++threeDRequestSerial,snapshot=clone(graph),fallback=fallback3DModel(),modeAtRequest=threeDMode;
    threeDCoords=fallback.atoms;threeDBonds=fallback.bonds;threeDPendingSignature=signature;
    set3DStatus(modeAtRequest==="optimized"?"Energy minimizing with MMFF94…":"Generating ideal chemistry-aware conformer…","busy");
    const engine=window.Chemistry3DForceField;
    const generate=modeAtRequest==="optimized"?(engine?.generateOptimized||engine?.generate):engine?.generateIdeal;
    if(!generate){threeDSignature=signature;threeDPendingSignature="";set3DStatus("Geometry engine unavailable · rough preview","warning");return;}
    generate.call(engine,snapshot).then(model=>{
      if(request!==threeDRequestSerial||graphSignature3D()!==signature||threeDMode!==modeAtRequest)return;
      threeDCoords=Array.isArray(model.atoms)?model.atoms:fallback.atoms;
      threeDBonds=Array.isArray(model.bonds)&&model.bonds.length?model.bonds:fallback.bonds;
      threeDSignature=signature;threeDPendingSignature="";
      if(modeAtRequest==="optimized")set3DStatus("MMFF94 energy-minimized"+(model.componentCount>1?" per molecule · pair placement preserved":"")+(model.hydrogensAdded?" · H added":""),"ready");
      else set3DStatus("Ideal conformer · standard chemistry geometry · drawing arrangement preserved"+(model.hydrogensAdded?" · H added":""),"ready");
      schedule3DRender();
    }).catch(error=>{
      if(request!==threeDRequestSerial||graphSignature3D()!==signature||threeDMode!==modeAtRequest)return;
      threeDCoords=fallback.atoms;threeDBonds=fallback.bonds;threeDSignature=signature;threeDPendingSignature="";
      set3DStatus((modeAtRequest==="optimized"?"MMFF94 minimization":"Ideal conformer generation")+" unavailable · rough preview","warning");
      console.warn("RNA Explorer 3D geometry generation failed:",error);
      schedule3DRender();
    });
  }'''
if old not in s: raise SystemExit('requestGeometryOptimized3D anchor not found')
s=s.replace(old,new,1)

s=s.replace('''    else if((force||sig!==threeDSignature)&&sig!==threeDPendingSignature)requestGeometryOptimized3D(sig);''','''    else if((force||sig!==threeDSignature)&&sig!==threeDPendingSignature)request3DModel(sig);''',1)

old='''  function toggle3DPreview(){
    threeDVisible=!threeDVisible;if(threeDPanel)threeDPanel.hidden=!threeDVisible;
    const button=dialog?.querySelector("#chem3DToggle");if(button){button.setAttribute("aria-pressed",String(threeDVisible));button.textContent=threeDVisible?"Hide 3D":"Show in 3D";}
    dialog?.querySelector(".chem-editor-workspace")?.classList.toggle("with-3d",threeDVisible);
    if(threeDVisible){threeDSignature="";threeDPendingSignature="";schedule3DRender(true);}else{threeDRequestSerial++;threeDPendingSignature="";}
  }'''
new='''  function toggle3DPreview(){
    threeDVisible=!threeDVisible;if(threeDPanel)threeDPanel.hidden=!threeDVisible;
    const button=dialog?.querySelector("#chem3DToggle");if(button){button.setAttribute("aria-pressed",String(threeDVisible));button.textContent=threeDVisible?"Hide 3D":"Show in 3D";}
    dialog?.querySelector(".chem-editor-workspace")?.classList.toggle("with-3d",threeDVisible);
    if(threeDVisible){threeDMode="ideal";threeDSignature="";threeDPendingSignature="";sync3DModeControls();schedule3DRender(true);}else{threeDRequestSerial++;threeDPendingSignature="";}
  }'''
if old not in s: raise SystemExit('toggle3DPreview anchor not found')
s=s.replace(old,new,1)

old='''    dialog?.querySelector("#chem3DZoomIn")?.addEventListener("click",()=>zoom3DView(1.25));
    dialog?.querySelector("#chem3DZoomOut")?.addEventListener("click",()=>zoom3DView(.8));'''
new='''    dialog?.querySelector("#chem3DIdealMode")?.addEventListener("click",()=>set3DMode("ideal"));
    dialog?.querySelector("#chem3DOptimizeMode")?.addEventListener("click",()=>set3DMode("optimized"));
    dialog?.querySelector("#chem3DZoomIn")?.addEventListener("click",()=>zoom3DView(1.25));
    dialog?.querySelector("#chem3DZoomOut")?.addEventListener("click",()=>zoom3DView(.8));'''
if old not in s: raise SystemExit('3D control binding anchor not found')
s=s.replace(old,new,1)

s=s.replace('''    status.textContent=warnings.length?warnings.join(" · ")+". Correct the highlighted atom or select it and choose Ignore valence warning.":ignored?"Ready. "+ignored+" intentional valence warning"+(ignored===1?" is":"s are")+" being ignored.":"Ready. Add bond repeatedly to promote single → double → triple. Smart geometry is on by default; Show in 3D opens a live interactive preview.";''',
'''    status.textContent=warnings.length?warnings.join(" · ")+". Correct the highlighted atom or select it and choose Ignore valence warning.":ignored?"Ready. "+ignored+" intentional valence warning"+(ignored===1?" is":"s are")+" being ignored.":"Ready. Ideal 2D generates clean textbook-style coordinates. Show in 3D opens Ideal 3D by default; MMFF94 energy minimization is optional.";''',1)

old='''    get3DDiagnostics:()=>({visible:threeDVisible,view:{...threeDView},fullscreen:document.fullscreenElement===threeDPanel||Boolean(threeDPanel?.classList.contains("chem-3d-expanded")),atomCount:threeDCoords.length}),
    validateGraph:g=>{const old=graph;graph=clone(g);const w=validate();graph=old;return w;}};'''
new='''    get3DDiagnostics:()=>({visible:threeDVisible,mode:threeDMode,view:{...threeDView},fullscreen:document.fullscreenElement===threeDPanel||Boolean(threeDPanel?.classList.contains("chem-3d-expanded")),atomCount:threeDCoords.length}),
    idealize2D:idealize2DGeometry,
    validateGraph:g=>{const old=graph;graph=clone(g);const w=validate();graph=old;return w;}};'''
if old not in s: raise SystemExit('public API anchor not found')
s=s.replace(old,new,1)

for old,new in replacements:
    if old not in s: raise SystemExit('replacement anchor not found: '+old[:80])
    s=s.replace(old,new,1)

p.write_text(s)

p=Path('chemistry-editor.css')
s=p.read_text()
s += '''\n\n/* Ideal-vs-minimized molecular geometry controls */\n.chem-3d-mode-controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}\n.chem-3d-mode-controls button{border:1px solid var(--line);background:#091321;color:var(--muted);border-radius:999px;padding:6px 10px;cursor:pointer;font:inherit;font-size:.72rem}\n.chem-3d-mode-controls button[aria-pressed="true"]{border-color:var(--mint);background:rgba(116,215,182,.12);color:var(--mint);font-weight:700}\n#chem3DStatus[data-state="ready"]{color:var(--mint)}\n#chem3DStatus[data-state="warning"]{color:#efc178}\n@media(max-width:720px){.chem-3d-mode-controls{grid-column:1/-1;justify-content:flex-start}.chem-3d-mode-controls button{flex:1 1 auto}}\n'''
p.write_text(s)

p=Path('index.html')
s=p.read_text()
s=s.replace('chemistry-3d-openbabel.js?v=1','chemistry-3d-openbabel.js?v=2')
s=s.replace('chemistry-editor.js?v=chem-editor-16','chemistry-editor.js?v=chem-editor-17')
p.write_text(s)
