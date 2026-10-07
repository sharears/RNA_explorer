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

