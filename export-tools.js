const ExportTools = (() => {
  const JSPDF_SOURCES=[
    "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js",
    "https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js"
  ];
  const SVG2PDF_SOURCES=[
    "https://cdn.jsdelivr.net/npm/svg2pdf.js@2.8.1/dist/svg2pdf.umd.min.js",
    "https://unpkg.com/svg2pdf.js@2.8.1/dist/svg2pdf.umd.min.js"
  ];
  const safeName=name=>String(name||"export").replace(/[^a-z0-9._-]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"export";
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadText(text,name,type="text/plain;charset=utf-8"){downloadBlob(new Blob([text],{type}),name);}
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const scripts=document.scripts?[...document.scripts]:[];
      const existing=scripts.find(s=>s.src===src);
      if(existing){
        existing.addEventListener?.("load",resolve,{once:true});
        existing.addEventListener?.("error",reject,{once:true});
        setTimeout(resolve,0);return;
      }
      const script=document.createElement("script");script.src=src;script.async=true;script.crossOrigin="anonymous";
      script.onload=resolve;script.onerror=()=>reject(new Error("Could not load "+src));document.head.append(script);
    });
  }
  async function ensureJsPDF(vector=false){
    if(!window.jspdf?.jsPDF){
      let last=null;
      for(const src of JSPDF_SOURCES){try{await loadScript(src);if(window.jspdf?.jsPDF)break;}catch(e){last=e;}}
      if(!window.jspdf?.jsPDF)throw last||new Error("PDF library could not be loaded.");
    }
    if(vector&&!window.jspdf.jsPDF.API?.svg){
      for(const src of SVG2PDF_SOURCES){try{await loadScript(src);if(window.jspdf.jsPDF.API?.svg)break;}catch(_){}
      }
    }
    return window.jspdf.jsPDF;
  }
  function preparedSvg(svg,{background="transparent",viewBox=null}={}){
    const clone=svg.cloneNode(true);
    if(typeof window!=="undefined"&&window.getComputedStyle){
      const sourceNodes=[svg,...svg.querySelectorAll("*")],cloneNodes=[clone,...clone.querySelectorAll("*")];
      sourceNodes.forEach((node,i)=>{
        const out=cloneNodes[i];if(!out)return;const cs=window.getComputedStyle(node);
        ["fill","stroke","strokeWidth","strokeDasharray","strokeLinecap","strokeLinejoin","opacity","fontFamily","fontSize","fontStyle","fontWeight","textAnchor","dominantBaseline"].forEach(prop=>{
          const value=cs[prop];if(value&&value!=="none"&&value!=="normal"&&value!=="0px")out.style[prop]=value;
        });
      });
    }
    clone.removeAttribute("style");clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
    clone.querySelectorAll("[data-export-remove],title").forEach(el=>el.remove());
    clone.querySelectorAll('[stroke="transparent"]').forEach(el=>el.remove());
    clone.querySelectorAll("[tabindex]").forEach(el=>el.removeAttribute("tabindex"));
    const vb=viewBox||svg.dataset?.fullViewBox||svg.getAttribute("viewBox")||"0 0 820 470";
    clone.setAttribute("viewBox",vb);
    const nums=vb.split(/\s+/).map(Number),w=Math.max(1,nums[2]||820),h=Math.max(1,nums[3]||470);
    if(background!=="transparent"){
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("x",nums[0]||0);rect.setAttribute("y",nums[1]||0);
      rect.setAttribute("width",w);rect.setAttribute("height",h);rect.setAttribute("fill",background);clone.insertBefore(rect,clone.firstChild);
    }
    return {clone,viewBox:vb,width:w,height:h};
  }
  function serializeSvg(svg,options={}){const {clone}=preparedSvg(svg,options);return new XMLSerializer().serializeToString(clone);}
  async function svgToPngData(svg,{scale=2,background="transparent",viewBox=null,maxPixels=20000000}={}){
    const {clone,width:w,height:h}=preparedSvg(svg,{background,viewBox});
    const actualScale=Math.max(.25,Math.min(Number(scale)||1,8192/w,8192/h,Math.sqrt(maxPixels/(w*h))));
    const width=Math.max(1,Math.round(w*actualScale)),height=Math.max(1,Math.round(h*actualScale));
    clone.setAttribute("width",width);clone.setAttribute("height",height);
    const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob),img=new Image();
    try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("Could not rasterize SVG."));img.src=url;});}
    finally{setTimeout(()=>URL.revokeObjectURL(url),0);}
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Canvas export is unavailable.");ctx.clearRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
    return {dataUrl:canvas.toDataURL("image/png"),width,height};
  }
  async function exportSvgElement(svg,{format="png",filename="figure",scale=2,background="transparent",viewBox=null}={}){
    const base=safeName(filename);
    if(format==="svg"){
      downloadText(serializeSvg(svg,{background,viewBox}),base+".svg","image/svg+xml;charset=utf-8");return {format:"svg"};
    }
    if(format==="png"){
      const out=await svgToPngData(svg,{scale,background,viewBox});const r=await fetch(out.dataUrl);downloadBlob(await r.blob(),base+".png");return out;
    }
    if(format==="pdf"){
      const {clone,width,height}=preparedSvg(svg,{background,viewBox}),jsPDF=await ensureJsPDF(true);
      const doc=new jsPDF({orientation:width>=height?"landscape":"portrait",unit:"pt",format:[width,height],compress:true});
      if(typeof doc.svg==="function"){
        await doc.svg(clone,{x:0,y:0,width,height});doc.save(base+".pdf");return {format:"pdf",vector:true,width,height};
      }
      const out=await svgToPngData(svg,{scale,background,viewBox});doc.addImage(out.dataUrl,"PNG",0,0,width,height);doc.save(base+".pdf");return {format:"pdf",vector:false,width,height};
    }
    throw new Error("Unsupported image export format: "+format);
  }
  async function exportRasterPdf(dataUrl,width,height,filename="figure"){
    const jsPDF=await ensureJsPDF(false),doc=new jsPDF({orientation:width>=height?"landscape":"portrait",unit:"px",format:[width,height],compress:true});
    doc.addImage(dataUrl,"PNG",0,0,width,height);doc.save(safeName(filename)+".pdf");
  }
  return {safeName,downloadBlob,downloadText,preparedSvg,serializeSvg,svgToPngData,exportSvgElement,exportRasterPdf,ensureJsPDF};
})();

/* RNA Explorer workspace interaction + consistency patch (2026-10-08). */
(() => {
  'use strict';

  const READY_FLAG='rnaWorkspacePolishReady';
  if(window[READY_FLAG])return;
  window[READY_FLAG]=true;

  function addWorkspaceStyles(){
    if(document.getElementById('rnaWorkspacePolishStyles'))return;
    const style=document.createElement('style');
    style.id='rnaWorkspacePolishStyles';
    style.textContent=`
      #chemEditorDialog.chem-editor-dialog {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100dvh;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: #08111e;
        color: var(--text);
      }
      #chemEditorDialog.chem-editor-dialog::backdrop {
        background: #08111e;
        backdrop-filter: none;
      }
      #chemEditorDialog .chem-editor-shell {
        box-sizing: border-box;
        min-height: 100dvh;
        height: 100dvh;
        padding: 16px 18px 18px;
        grid-template-rows: auto auto auto auto auto minmax(360px,1fr) auto;
        overflow: auto;
      }
      #chemEditorDialog .chem-editor-canvas-wrap { min-height:0; height:100%; }
      #chemEditorDialog #chemEditorSvg { width:100%; height:100%; min-height:320px; }
      #chemEditorDialog .chem-editor-footer { flex:0 0 auto; }

      #scene-primary[data-workspace-shell],
      #scene-secondary[data-workspace-shell],
      #scene-tertiary[data-workspace-shell] { --workspace-control-radius:8px; }
      [data-workspace-shell] .workspace-heading-actions button {
        min-height:36px;
        border-radius:var(--workspace-control-radius);
      }
      .rna-workspace-mode-badge {
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin:0 0 8px;
        padding:4px 8px;
        border:1px solid var(--line);
        border-radius:999px;
        color:var(--muted);
        background:rgba(255,255,255,.025);
        font:600 11px/1.2 "DM Mono",monospace;
        letter-spacing:.04em;
        text-transform:uppercase;
      }
      .rna-workspace-mode-badge strong { color:var(--mint); font-weight:700; }
      #secondarySvg { cursor:grab; }
      #secondarySvg.rna-selection-dragging { cursor:grabbing; }
      #secondarySvg .se-node { cursor:grab; }
      #secondarySvg .se-node.multi-selected { cursor:move; }

      @media (max-width:720px) {
        #chemEditorDialog .chem-editor-shell { padding:12px; gap:9px; grid-template-rows:auto auto auto auto auto minmax(280px,1fr) auto; }
        #chemEditorDialog #chemEditorSvg { min-height:260px; }
      }
    `;
    document.head.append(style);
  }

  function decorateStructureWorkspaces(){
    const mode=document.body?.dataset?.pageMode||'home';
    [['primary','Primary structure'],['secondary','Secondary structure'],['tertiary','Tertiary structure']].forEach(([name,label])=>{
      const scene=document.getElementById(`scene-${name}`);
      if(!scene)return;
      scene.dataset.workspaceShell=name;
      const copy=scene.querySelector('.scene-copy');
      if(!copy||copy.querySelector('.rna-workspace-mode-badge'))return;
      const badge=document.createElement('p');
      badge.className='rna-workspace-mode-badge';
      const standalone=mode===name;
      badge.innerHTML=`<strong>${standalone?'Explore workspace':'Learning view'}</strong><span>· ${label}</span>`;
      const number=copy.querySelector('.scene-number');
      if(number)number.insertAdjacentElement('afterend',badge);else copy.prepend(badge);
    });
  }

  function setSecondaryStatus(message){
    const status=document.getElementById('seDragStatus');
    if(status)status.textContent=message;
  }

  function secondaryPoint(event,root){
    const rect=root.getBoundingClientRect();
    const view=String(root.getAttribute('viewBox')||'0 0 1 1').trim().split(/\s+/).map(Number);
    return {
      x:view[0]+(event.clientX-rect.left)/Math.max(1,rect.width)*view[2],
      y:view[1]+(event.clientY-rect.top)/Math.max(1,rect.height)*view[3]
    };
  }

  function installSecondaryDirectDragging(){
    if(document.documentElement.dataset.rnaSecondaryDirectDrag==='1')return;
    document.documentElement.dataset.rnaSecondaryDirectDrag='1';

    const ready=()=>typeof SecondaryExplorer!=='undefined'&&
      typeof SecondaryExplorer.getWorkspaceSnapshot==='function'&&
      typeof SecondaryExplorer.restoreWorkspaceSnapshot==='function';

    const applyWholeDefault=()=>{
      const select=document.getElementById('seDragMode');
      if(!select||select.dataset.rnaWholeDefaultApplied==='1')return false;
      select.dataset.rnaWholeDefaultApplied='1';
      setTimeout(()=>{
        if(!select.isConnected)return;
        if([...select.options].some(option=>option.value==='whole')){
          select.value='whole';
          select.dispatchEvent(new Event('change',{bubbles:true}));
        }
        setSecondaryStatus('Drag the RNA to reposition the whole structure · Drag any selected residue to reposition the selected region · Mouse wheel: zoom · Right-button drag: pan.');
      },0);
      return true;
    };

    const observer=new MutationObserver(()=>applyWholeDefault());
    observer.observe(document.body,{childList:true,subtree:true});
    applyWholeDefault();

    let selectedDrag=null;
    let suppressSelectedClick=false;

    document.addEventListener('pointerdown',event=>{
      if(event.button!==0||!ready())return;
      const root=document.getElementById('secondarySvg');
      if(!root||!root.contains(event.target)||event.target.closest?.('[data-index-label]'))return;
      const node=event.target.closest?.('.se-node');
      if(!node)return;
      const index=Number(node.dataset.residueIndex);
      if(!Number.isInteger(index))return;

      let snapshot=SecondaryExplorer.getWorkspaceSnapshot();
      const selected=Array.isArray(snapshot?.selectedResidues)?snapshot.selectedResidues:[];
      if(!selected.includes(index)||!selected.length)return;

      if(typeof SecondaryExplorer.commitSelectionTransform==='function'){
        SecondaryExplorer.commitSelectionTransform();
        snapshot=SecondaryExplorer.getWorkspaceSnapshot();
      }
      window.dispatchEvent(new Event('rna-secondary-history-checkpoint'));

      const baseline={
        ...snapshot,
        manualOffsets:{...(snapshot.manualOffsets||{})},
        selectedResidues:[...(snapshot.selectedResidues||[])]
      };
      const offsets={};
      baseline.selectedResidues.forEach(i=>{
        const base=baseline.manualOffsets[i]||{x:0,y:0};
        offsets[i]={x:Number(base.x)||0,y:Number(base.y)||0};
      });

      selectedDrag={
        pointerId:event.pointerId,
        root,
        indices:[...baseline.selectedResidues],
        baseline,
        offsets,
        start:secondaryPoint(event,root),
        moved:false
      };
      root.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);

    document.addEventListener('pointermove',event=>{
      const drag=selectedDrag;
      if(!drag||event.pointerId!==drag.pointerId||!ready())return;
      const point=secondaryPoint(event,drag.root);
      let dx=point.x-drag.start.x,dy=point.y-drag.start.y;
      if(Math.hypot(dx,dy)>1)drag.moved=true;
      const angle=-(Number(drag.baseline.wholeRotation)||0)*Math.PI/180;
      const cos=Math.cos(angle),sin=Math.sin(angle);
      const localDx=dx*cos-dy*sin,localDy=dx*sin+dy*cos;
      const working={...drag.baseline,manualOffsets:{...drag.baseline.manualOffsets}};
      drag.indices.forEach(i=>{
        const base=drag.offsets[i]||{x:0,y:0};
        working.manualOffsets[i]={x:base.x+localDx,y:base.y+localDy};
      });
      SecondaryExplorer.restoreWorkspaceSnapshot(working,{saveLocal:false});
      drag.root.classList.add('rna-selection-dragging');
      suppressSelectedClick=drag.moved;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);

    const finishSelectedDrag=event=>{
      const drag=selectedDrag;
      if(!drag||event.pointerId!==drag.pointerId)return;
      selectedDrag=null;
      drag.root.classList.remove('rna-selection-dragging');
      if(drag.root.hasPointerCapture?.(event.pointerId))drag.root.releasePointerCapture(event.pointerId);
      if(drag.moved&&ready()){
        SecondaryExplorer.restoreWorkspaceSnapshot(SecondaryExplorer.getWorkspaceSnapshot());
        setSecondaryStatus(`Moved ${drag.indices.length} selected residue${drag.indices.length===1?'':'s'}. Selected-region zoom and rotation remain available.`);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setTimeout(()=>{suppressSelectedClick=false;},100);
    };

    document.addEventListener('pointerup',finishSelectedDrag,true);
    document.addEventListener('pointercancel',finishSelectedDrag,true);
    document.addEventListener('click',event=>{
      if(!suppressSelectedClick)return;
      const root=document.getElementById('secondarySvg');
      if(root?.contains(event.target)){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }

  function keepMolecularWorkspaceDedicated(){
    let observer=null;
    const update=()=>{
      const dialog=document.getElementById('chemEditorDialog');
      if(!dialog)return false;
      dialog.setAttribute('aria-label','Molecular Drawing workspace');
      dialog.dataset.workspaceShell='drawing';
      const eyebrow=dialog.querySelector('.eyebrow');
      if(eyebrow&&eyebrow.textContent!=='Explore · Molecular Drawing')eyebrow.textContent='Explore · Molecular Drawing';
      return true;
    };
    if(update())return;
    observer=new MutationObserver(()=>{if(update())observer?.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function initWorkspacePolish(){
    addWorkspaceStyles();
    decorateStructureWorkspaces();
    installSecondaryDirectDragging();
    keepMolecularWorkspaceDedicated();
    setTimeout(()=>{
      document.querySelectorAll('.rna-workspace-mode-badge').forEach(node=>node.remove());
      decorateStructureWorkspaces();
    },0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initWorkspacePolish,{once:true});
  else initWorkspacePolish();
})();
