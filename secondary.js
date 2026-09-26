/* Independent SVG secondary-structure editor. No structure prediction.
   Radial layout: stacked pairs and chord-length loop polygons, recursively
   traversed from the dot-bracket tree. Geometry is schematic, not atomic. */
const SecondaryExplorer = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const colors = {A:"#b55d6a", G:"#2f6b57", C:"#c89b4a", U:"#5d7fa3"};
  const settings = {backColor:"#74d7b6", backWidth:2, backOpacity:0.8,
    pairColor:"#e8bb69", pairWidth:2, pairOpacity:1, circleColor:"#c5d6e2",
    circleWidth:1, letterColor:"#ffffff", letterSize:16, font:"monospace",
    fontStyle:"normal", mode:"uniform", legend:true};
  let seq="", db="", defaultSeq="", defaultDb="", pairs=[], partner=[], selected=0, selectedPairKey=null;
  let selectedResidues=new Set(), selectedPairKeys=new Set(), sourceNote="";
  let layout="radial", overrides={}, annotations={}, onDefaultSelect=()=>{};
  let residueOverrides={}, backboneOverrides={}, selectedBackbone=0, zoom=1;
  let panX=0,panY=0,indexMode="default",indexSelection=new Set(),indexOverrides={};
  const indexSettings={color:"#bacbd7",size:12,font:"monospace",fontStyle:"normal"};
  let metadata={}, heatEnabled=false, heatTheme="viridis", heatRange=[0,1], metadataTicket=0;
  let pairProbabilities={}, pairProbEnabled=false, pairProbTheme="viridis", pairProbTicket=0, pairChemistry={};
  let arcPairStyle="arc", exportScale=2;
  let manualOffsets={}, pinnedResidues=new Set(), dragMode="residue", flexDrag=true, nodeDrag=null, suppressNodeClick=false;
  let layoutHistory=[],layoutFuture=[],restoringWorkspace=false;
  const WORKSPACE_KEY="rna-explorer-secondary-workspace-v1";
  const legendSettings={
    heat:{visible:true,orientation:"horizontal",thickness:16,tickThickness:1,tickCount:3,tickValues:"",font:"monospace",fontSize:12,fontColor:"#bacbd7",x:18,y:88},
    pair:{visible:true,orientation:"horizontal",thickness:16,tickThickness:1,tickCount:3,tickValues:"",font:"monospace",fontSize:12,fontColor:"#bacbd7",x:18,y:188}
  };
  const defaults={...settings};
  const palettes={
    viridis:["#440154","#3b528b","#21918c","#5ec962","#fde725"],
    magma:["#000004","#51127c","#b73779","#fc8961","#fcfdbf"],
    blueRed:["#2166ac","#92c5de","#f7f7f7","#f4a582","#b2182b"],
    cividis:["#00224e","#434e6c","#7d7c78","#bcae6c","#fee838"]
  };
  function heatColor(value) {
    const t=heatRange[1]===heatRange[0]?.5:Math.max(0,Math.min(1,(value-heatRange[0])/(heatRange[1]-heatRange[0])));
    const stops=palettes[heatTheme],x=t*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),f=x-i;
    return "#"+[1,3,5].map(k=>Math.round(parseInt(stops[i].slice(k,k+2),16)*(1-f)+parseInt(stops[i+1].slice(k,k+2),16)*f).toString(16).padStart(2,"0")).join("");
  }
  function residueStyle(i) {
    return {...settings,fillColor:heatEnabled&&metadata[i]?.value!=null?heatColor(metadata[i].value):settings.fillColor||colors[seq[i]],...residueOverrides[i]};
  }
  function probabilityColor(value) {
    const t=Math.max(0,Math.min(1,Number(value))),stops=palettes[pairProbTheme],x=t*(stops.length-1);
    const i=Math.min(stops.length-2,Math.floor(x)),f=x-i;
    return "#"+[1,3,5].map(k=>Math.round(parseInt(stops[i].slice(k,k+2),16)*(1-f)+parseInt(stops[i+1].slice(k,k+2),16)*f).toString(16).padStart(2,"0")).join("");
  }
  function parsePairProbabilities(input,n) {
    const text=String(input||"").replace(/^\uFEFF/,"").trim();
    if(!text)throw Error("Pair-probability data are empty.");
    const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
    const first=lines[0].toLowerCase().replace(/\s/g,"");
    const out={};
    if(first==="residue_i,residue_j,probability"||first==="i,j,probability"){
      lines.slice(1).forEach((line,row)=>{
        const fields=line.split(",").map(s=>s.trim());
        if(fields.length!==3)throw Error("Sparse probability row "+(row+2)+" must have Residue_i, Residue_j, Probability.");
        const i=Number(fields[0]),j=Number(fields[1]),p=Number(fields[2]);
        if(!Number.isInteger(i)||!Number.isInteger(j)||i<1||j<1||i>n||j>n||i===j)throw Error("Invalid residue indices on probability row "+(row+2)+".");
        if(!Number.isFinite(p)||p<0||p>1)throw Error("Probability must be between 0 and 1 on row "+(row+2)+".");
        out[keyOf(i-1,j-1)]=p;
      });
    } else {
      let rows=lines.map(line=>line.includes(",")?line.split(",").map(s=>s.trim()):line.split(/\s+/));
      if(rows.length===n+1&&rows[0].length>=n){rows=rows.slice(1);}
      rows=rows.map(row=>row.length===n+1?row.slice(1):row);
      if(rows.length!==n||rows.some(row=>row.length!==n))throw Error("Probability matrix must be "+n+" × "+n+", or use sparse CSV headers Residue_i,Residue_j,Probability.");
      const matrix=rows.map((row,r)=>row.map((v,col)=>{
        const p=Number(v);
        if(!Number.isFinite(p)||p<0||p>1)throw Error("Matrix probability at row "+(r+1)+", column "+(col+1)+" must be between 0 and 1.");
        return p;
      }));
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)out[keyOf(i,j)]=(matrix[i][j]+matrix[j][i])/2;
    }
    if(!Object.keys(out).length)throw Error("No pair probabilities were found.");
    return out;
  }
  function parseMetadata(csv,n) {
    const rows=[];let row=[],cell="",quoted=false,closed=false;
    csv=csv.replace(/^\uFEFF/,"");
    for(let i=0;i<=csv.length;i++){
      const c=i===csv.length?"\n":csv[i];
      if(quoted){
        if(i===csv.length)throw Error("Unclosed quoted field in CSV.");
        if(c==='"'&&csv[i+1]==='"'){cell+='"';i++;}
        else if(c==='"'){quoted=false;closed=true;}else cell+=c;
      }else if(c==='"'){
        if(cell.trim()||closed)throw Error("Invalid quote in CSV.");quoted=true;cell="";
      }else if(c===","||c==="\n"||c==="\r"){
        row.push(cell.trim());cell="";closed=false;
        if(c!==","){if(row.some(v=>v!==""))rows.push(row);row=[];if(c==="\r"&&csv[i+1]==="\n")i++;}
      }else {if(closed&&!/\s/.test(c))throw Error("Invalid text after quoted field.");cell+=c;}
    }
    if(!rows.length||rows[0].map(v=>v.toLowerCase()).join(",")!=="residue_index,residue_id,residue_information")throw Error("CSV headers must be Residue_Index,Residue_ID,Residue_Information, in that order (capitalization does not matter).");
    const data={};let count=0;
    rows.slice(1).forEach((r,i)=>{
      if(r.length!==3)throw Error("CSV row "+(i+2)+" must contain three columns.");
      const index=Number(r[0]);
      if(!/^\d+$/.test(r[0])||!Number.isInteger(index)||index<1||index>n)throw Error("Invalid Residue_Index on row "+(i+2)+". Use 1–"+n+".");
      if(data[index-1])throw Error("Duplicate Residue_Index "+index+".");
      const missing=r[2]===""||/^(NA|N\/A|NaN)$/i.test(r[2]);
      const value=missing?null:Number(r[2]);
      if(!missing&&(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(r[2])||!Number.isFinite(value)))throw Error("Residue_Information must be numeric or blank/NA (row "+(i+2)+").");
      data[index-1]={id:r[1],value};if(value!==null)count++;
    });
    if(!count)throw Error("CSV needs at least one numeric Residue_Information value.");
    return data;
  }
  const $ = id => document.getElementById(id);
  const svg = (name, attrs={}) => {
    const el=document.createElementNS(NS,name);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
    return el;
  };
  const text = (parent, value, attrs) => {
    const el=svg("text",attrs); el.textContent=value; parent.append(el); return el;
  };
  function parse(sequence, structure) {
    if (!sequence || !/^[ACGU]+$/.test(sequence)) throw Error("Enter an RNA sequence using A, C, G and U.");
    if(sequence.length>1000) throw Error("This beta supports up to 1,000 nucleotides.");
    if(sequence.length!==structure.length) throw Error(`Sequence: ${sequence.length} residues; structure: ${structure.length} characters. The lengths must match.`);
    const stack=[], result=[], p=Array(sequence.length).fill(-1);
    [...structure].forEach((c,i)=>{
      if(c==="(") stack.push(i);
      else if(c===")") {
        if(!stack.length) throw Error(`Unmatched closing parenthesis at position ${i+1}.`);
        const a=stack.pop(); result.push([a,i]);p[a]=i;p[i]=a;
      } else if(c!==".") throw Error(`Use only parentheses and dots (invalid symbol at ${i+1}).`);
    });
    if(stack.length) throw Error(`Unmatched opening parenthesis at position ${stack[0]+1}.`);
    return {pairs:result.sort((a,b)=>a[0]-b[0]),partner:p};
  }
  function parseDbnText(text){
    const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(!lines.length)throw Error("DBN file is empty.");
    const body=lines.filter(line=>!line.startsWith(">"));
    let sequence="",structure="";
    body.forEach(line=>{
      const compact=line.replace(/\s/g,"");
      if(!structure&&/^[ACGUTacgut]+$/.test(compact))sequence+=compact.toUpperCase().replace(/T/g,"U");
      else if(/^[().]+$/.test(compact))structure+=compact;
    });
    if(!sequence||!structure)throw Error("DBN must contain an RNA sequence and dot-bracket line.");
    parse(sequence,structure);return {sequence,structure};
  }
  function parseCtText(text){
    const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(lines.length<2)throw Error("CT file does not contain residue rows.");
    const first=lines[0].split(/\s+/),n=Number(first[0]);
    if(!Number.isInteger(n)||n<1)throw Error("CT header must begin with the residue count.");
    const rows=lines.slice(1,1+n).map((line,row)=>{
      const f=line.split(/\s+/);if(f.length<5)throw Error("CT row "+(row+1)+" is incomplete.");
      const i=Number(f[0]),base=String(f[1]||"").toUpperCase().replace(/T/g,"U"),pair=Number(f[4]);
      if(i!==row+1||!/^[ACGU]$/.test(base)||!Number.isInteger(pair)||pair<0||pair>n)throw Error("Invalid CT row "+(row+1)+".");
      return {i,base,pair};
    });
    const sequence=rows.map(r=>r.base).join(""),chars=Array(n).fill(".");
    rows.forEach(r=>{
      if(r.pair>r.i){chars[r.i-1]="(";chars[r.pair-1]=")";}
      if(r.pair&&rows[r.pair-1]?.pair!==r.i)throw Error("CT pairing is not reciprocal at residue "+r.i+".");
    });
    const structure=chars.join("");parse(sequence,structure);return {sequence,structure};
  }
  function serializeDbn(){return ">RNA_Structure_Explorer\n"+seq+"\n"+db+"\n";}
  function serializeCt(){
    const lines=[seq.length+" ENERGY = 0 RNA Structure Explorer"];
    for(let i=0;i<seq.length;i++)lines.push([i+1,seq[i],i===0?0:i,i===seq.length-1?0:i+2,partner[i]>=0?partner[i]+1:0,i+1].join("\t"));
    return lines.join("\n")+"\n";
  }
  function workspaceSnapshot(){
    return {sequence:seq,structure:db,layout,arcPairStyle,manualOffsets,zoom,panX,panY,metadata,heatEnabled,heatTheme,heatRange,pairProbabilities,pairProbEnabled,pairProbTheme,
      legendSettings,residueOverrides,backboneOverrides,indexMode,indexSelection:[...indexSelection],indexOverrides,pinnedResidues:[...pinnedResidues],
      selectedResidues:[...selectedResidues],selectedPairKeys:[...selectedPairKeys],sourceNote};
  }
  function setSourceNote(note=""){
    sourceNote=String(note||"");
    const el=$("secondarySourceNote");if(!el)return;
    el.textContent=sourceNote;el.hidden=!sourceNote;
  }
  function saveWorkspaceLocal(){
    if(restoringWorkspace||typeof localStorage==="undefined"||!seq)return;
    try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspaceSnapshot()));}catch(_){}
  }
  function restoreWorkspaceLocal(){
    if(typeof localStorage==="undefined")return false;
    if(typeof window==="undefined")return false;const search=String(window.location?.search||"");if(!/[?&]page=(secondary|tertiary)(?:&|$)/.test(search))return false;
    try{
      const raw=localStorage.getItem(WORKSPACE_KEY);if(!raw)return false;const w=JSON.parse(raw);
      if(!w?.sequence||!w?.structure)return false;parse(w.sequence,w.structure);
      restoringWorkspace=true;load(w.sequence,w.structure);
      layout=["radial","circular","arc"].includes(w.layout)?w.layout:"radial";arcPairStyle=w.arcPairStyle==="square"?"square":"arc";
      manualOffsets=w.manualOffsets||{};zoom=Number(w.zoom)||1;panX=Number(w.panX)||0;panY=Number(w.panY)||0;
      metadata=w.metadata||{};heatEnabled=!!w.heatEnabled;heatTheme=w.heatTheme||"viridis";heatRange=Array.isArray(w.heatRange)?w.heatRange:[0,1];
      pairProbabilities=w.pairProbabilities||{};pairProbEnabled=!!w.pairProbEnabled;pairProbTheme=w.pairProbTheme||"viridis";
      residueOverrides=w.residueOverrides||{};backboneOverrides=w.backboneOverrides||{};indexMode=w.indexMode||"default";indexSelection=new Set(w.indexSelection||[]);indexOverrides=w.indexOverrides||{};pinnedResidues=new Set(w.pinnedResidues||[]);
      selectedResidues=new Set((w.selectedResidues||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<seq.length));
      selectedPairKeys=new Set((w.selectedPairKeys||[]).filter(key=>pairs.some(([a,b])=>keyOf(a,b)===key)));
      sourceNote=String(w.sourceNote||"");
      if(w.legendSettings)Object.keys(legendSettings).forEach(k=>Object.assign(legendSettings[k],w.legendSettings[k]||{}));
      restoringWorkspace=false;
      $("secondarySequence").value=seq;$("secondaryDotBracket").value=db;
      document.querySelectorAll("[data-secondary-layout]").forEach(b=>{const active=b.dataset.secondaryLayout===layout;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
      if($("seArcPairStyle"))$("seArcPairStyle").hidden=layout!=="arc";
      setSourceNote(sourceNote);
      return true;
    }catch(_){restoringWorkspace=false;return false;}
  }
  function pushLayoutHistory(){
    layoutHistory.push(JSON.stringify(manualOffsets));if(layoutHistory.length>60)layoutHistory.shift();layoutFuture=[];
  }
  function undoLayout(){if(!layoutHistory.length)return;layoutFuture.push(JSON.stringify(manualOffsets));manualOffsets=JSON.parse(layoutHistory.pop());render();}
  function redoLayout(){if(!layoutFuture.length)return;layoutHistory.push(JSON.stringify(manualOffsets));manualOffsets=JSON.parse(layoutFuture.pop());render();}
  function fitStructure(){zoom=1;panX=panY=0;applyZoom();}
    function radial(n, p) {
    const out=Array(n), step=44, width=90;
    function branch(a,b,origin,d) {
      const right={x:d.y,y:-d.x};
      let center={...origin};
      while(true) {
        out[a]={x:center.x-right.x*width/2,y:center.y-right.y*width/2};
        out[b]={x:center.x+right.x*width/2,y:center.y+right.y*width/2};
        if(p[a+1]===b-1 && a+1<b-1) {
          a++; b--;center={x:center.x+d.x*step,y:center.y+d.y*step};
        } else break;
      }
      if(b-a<=1) return;
      // Boundary vertices omit the interiors of daughter stems.
      const vertices=[a], children=[];
      for(let i=a+1;i<b;i++) {
        vertices.push(i);
        if(p[i]>i && p[i]<b) {children.push([i,p[i]]);i=p[i];vertices.push(i);}
      }
      vertices.push(b);
      const lengths=vertices.map((v,k)=>{
        const next=vertices[(k+1)%vertices.length];
        return p[v]===next ? width : step;
      });
      let lo=Math.max(...lengths)/2+0.001, hi=lengths.reduce((s,v)=>s+v,0);
      for(let k=0;k<70;k++) {
        const mid=(lo+hi)/2;
        const total=lengths.reduce((s,l)=>s+2*Math.asin(l/(2*mid)),0);
        if(total>2*Math.PI) lo=mid;else hi=mid;
      }
      const radius=(lo+hi)/2, gap=2*Math.asin(width/(2*radius));
      const height=Math.sqrt(Math.max(0,radius*radius-width*width/4));
      const loopCenter={x:center.x+d.x*height,y:center.y+d.y*height};
      let angle=-Math.PI/2-gap/2;
      for(let k=0;k<vertices.length;k++) {
        const x=radius*Math.cos(angle),y=radius*Math.sin(angle);
        out[vertices[k]]={x:loopCenter.x+right.x*x+d.x*y,y:loopCenter.y+right.y*x+d.y*y};
        angle-=2*Math.asin(lengths[k]/(2*radius));
      }
      for(const [i,j] of children) {
        const mid={x:(out[i].x+out[j].x)/2,y:(out[i].y+out[j].y)/2};
        const dx=mid.x-loopCenter.x,dy=mid.y-loopCenter.y,len=Math.hypot(dx,dy)||1;
        branch(i,j,mid,{x:dx/len,y:dy/len});
      }
    }
    let cursor=0;
    for(let i=0;i<n;i++) {
      if(p[i]>i) {
        const end=p[i];branch(i,end,{x:0,y:0},{x:0,y:-1});
        const xs=out.slice(i,end+1).map(q=>q.x);
        const min=Math.min(...xs),max=Math.max(...xs);
        for(let j=i;j<=end;j++) out[j].x+=cursor-min;
        cursor+=max-min+step*2;i=end;
      } else {
        // Extend exterior unpaired residues from their actual predecessor,
        // rather than from the bounding box of the entire folded domain.
        out[i]=i>0?{x:out[i-1].x-step/Math.SQRT2,y:out[i-1].y+step/Math.SQRT2}:{x:cursor,y:step};
        cursor=Math.max(cursor,out[i].x+step);
      }
    }
    return out;
  }
  function orientEndsBottom(pos) {
    if(pos.length<2) return pos;
    const first=pos[0],last=pos[pos.length-1],dx=last.x-first.x,dy=last.y-first.y;
    if(Math.hypot(dx,dy)<1e-6) return pos;
    const angle=-Math.atan2(dy,dx),cx=(first.x+last.x)/2,cy=(first.y+last.y)/2;
    let oriented=pos.map(p=>{
      const x=p.x-cx,y=p.y-cy;
      return {x:cx+x*Math.cos(angle)-y*Math.sin(angle),y:cy+x*Math.sin(angle)+y*Math.cos(angle)};
    });
    const baseline=(oriented[0].y+oriented[oriented.length-1].y)/2;
    const interior=oriented.slice(1,-1);
    const meanY=interior.length?interior.reduce((sum,p)=>sum+p.y,0)/interior.length:baseline;
    if(meanY>baseline)oriented=oriented.map(p=>({x:p.x,y:2*baseline-p.y}));
    return oriented;
  }
  function coordinates() {
    const n=seq.length;
    let out;
    if(layout==="radial") out=orientEndsBottom(radial(n,partner));
    else if(layout==="arc") out=Array.from({length:n},(_,i)=>({x:i*56,y:0}));
    else {
      const r=Math.max(60,n*36/(2*Math.PI));
      out=orientEndsBottom(Array.from({length:n},(_,i)=>{
        const angle=-Math.PI/2+i*(2*Math.PI-0.18)/Math.max(1,n-1);
        return {x:r*Math.cos(angle),y:r*Math.sin(angle)};
      }));
    }
    return out.map((p,i)=>({x:p.x+(manualOffsets[i]?.x||0),y:p.y+(manualOffsets[i]?.y||0)}));
  }
  function dragGroupFor(index){
    if(dragMode==="whole")return Array.from({length:seq.length},(_,i)=>i);
    if(dragMode==="branch"){
      let a=index,b=partner[index];
      if(b<0){
        let enclosing=null;
        pairs.forEach(([x,y])=>{if(x<index&&index<y&&(!enclosing||y-x<enclosing[1]-enclosing[0]))enclosing=[x,y];});
        if(enclosing){a=enclosing[0];b=enclosing[1];}
      }
      if(b>=0){const lo=Math.min(a,b),hi=Math.max(a,b);return Array.from({length:hi-lo+1},(_,k)=>lo+k);}
    }
    return [index];
  }
  function dragWeightsFor(index){
    const group=dragGroupFor(index),weights=new Map();
    group.forEach(i=>{if(!pinnedResidues.has(i))weights.set(i,1);});
    if(!flexDrag||dragMode==="whole")return weights;
    const adjacency=i=>[i-1,i+1,partner[i]].filter(j=>j>=0&&j<seq.length);
    const seen=new Set(group),queue=group.map(i=>[i,0]);
    while(queue.length){
      const [i,d]=queue.shift();if(d>=4)continue;
      adjacency(i).forEach(j=>{
        if(seen.has(j))return;seen.add(j);queue.push([j,d+1]);
        if(!pinnedResidues.has(j)){
          const w=[0,.42,.23,.12,.06][d+1]||0;
          if(w>0)weights.set(j,Math.max(weights.get(j)||0,w));
        }
      });
    }
    return weights;
  }
  function pointerInSecondary(event){
    const root=$("secondarySvg"),rect=root.getBoundingClientRect(),v=root.getAttribute("viewBox").split(/\s+/).map(Number);
    return {x:v[0]+(event.clientX-rect.left)/rect.width*v[2],y:v[1]+(event.clientY-rect.top)/rect.height*v[3]};
  }
  function installNodeDragging(root){
    root.addEventListener("pointerdown",event=>{
      if(event.button!==0)return;
      const node=event.target.closest?.(".se-node");if(!node)return;
      const index=Number(node.dataset.residueIndex);if(!Number.isInteger(index))return;
      select(index);
      const weights=dragWeightsFor(index);
      if(!weights.size){$("seDragStatus").textContent="That selection is pinned. Unpin it before moving.";return;}
      pushLayoutHistory();
      const start=pointerInSecondary(event),base={};
      weights.forEach((w,i)=>base[i]={x:manualOffsets[i]?.x||0,y:manualOffsets[i]?.y||0,w});
      nodeDrag={pointer:event.pointerId,start,base,moved:false};
      root.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    root.addEventListener("pointermove",event=>{
      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;
      const p=pointerInSecondary(event),dx=p.x-nodeDrag.start.x,dy=p.y-nodeDrag.start.y;
      if(Math.hypot(dx,dy)>1)nodeDrag.moved=true;
      Object.entries(nodeDrag.base).forEach(([key,o])=>{
        const i=Number(key);manualOffsets[i]={x:o.x+dx*o.w,y:o.y+dy*o.w};
      });
      suppressNodeClick=nodeDrag.moved;render();
    });
    const finish=event=>{
      if(!nodeDrag||event.pointerId!==nodeDrag.pointer)return;
      const moved=nodeDrag.moved;nodeDrag=null;
      if(root.hasPointerCapture?.(event.pointerId))root.releasePointerCapture(event.pointerId);
      $("seDragStatus").textContent=moved?"Manual layout updated. Connected backbone and pair lines follow the moved residues.":"Drag a nucleotide, branch/stem, or whole structure.";
      setTimeout(()=>suppressNodeClick=false,60);
    };
    root.addEventListener("pointerup",finish);root.addEventListener("pointercancel",finish);
  }
  const keyOf = (a,b) => `${Math.min(a,b)}:${Math.max(a,b)}`;
  function activeKey(){return partner[selected]<0?null:keyOf(selected,partner[selected]);}
  function effective(key){return {...settings,...overrides[key]};}
  function symbol(parent,edge,x,y,orientation,color) {
    const attrs={fill:orientation==="c"?color:"#0d1726",stroke:color,"stroke-width":1.8};
    const el=edge==="W"?svg("circle",{cx:x,cy:y,r:6,...attrs})
      :edge==="H"?svg("rect",{x:x-6,y:y-6,width:12,height:12,...attrs})
      :svg("polygon",{points:`${x},${y-7} ${x+7},${y+6} ${x-7},${y+6}`,...attrs});
    parent.append(el);
  }
  function pairGraphic(parent,a,b,pos,key,preview=false) {
    const s=effective(key), p=pos[a],q=pos[b];
    const probability=pairProbabilities[key];
    const pairColor=pairProbEnabled&&probability!=null&&!overrides[key]?.pairColor?probabilityColor(probability):s.pairColor;
    const g=svg("g",{"data-pair":key,class:"se-pair"+(selectedPairKeys.has(key)?" selected":""),opacity:s.pairOpacity});
    const code=annotations[key];
    const identity=seq[a]+seq[b];
    const count=s.mode==="typed"?(/GC|CG/.test(identity)?3:/AU|UA/.test(identity)?2:1):1;
    const dashed=s.mode==="typed"&&!/GC|CG|AU|UA|GU|UG/.test(identity) || s.mode==="lw"&&!code;
    const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
    const normal={x:-dy/len,y:dx/len},trim=Math.min(17,len/4);
    const start={x:p.x+dx/len*trim,y:p.y+dy/len*trim},end={x:q.x-dx/len*trim,y:q.y-dy/len*trim};
    const arch=layout==="arc"&&!preview&&arcPairStyle==="arc";
    const square=layout==="arc"&&!preview&&arcPairStyle==="square";
    let path="";
    for(let k=0;k<count;k++){
      const offset=(k-(count-1)/2)*5;
      const topY=p.y-Math.max(42,Math.abs(dx)*.42)-offset*2;
      path=arch
        ?`M ${p.x} ${p.y-17-offset} Q ${(p.x+q.x)/2} ${p.y-Math.abs(dx)-offset*2} ${q.x} ${q.y-17-offset}`
        :square
          ?`M ${p.x} ${p.y-17-offset} L ${p.x} ${topY} L ${q.x} ${topY} L ${q.x} ${q.y-17-offset}`
          :`M ${start.x+normal.x*offset} ${start.y+normal.y*offset} L ${end.x+normal.x*offset} ${end.y+normal.y*offset}`;
      g.append(svg("path",{d:path,fill:"none",stroke:pairColor,"stroke-width":s.pairWidth,
        "stroke-dasharray":dashed?"5 5":"none","stroke-linecap":"round"}));
    }
    if(s.mode==="lw"&&code) {
      const midpoint={x:(p.x+q.x)/2,y:(arch||square)?(p.y-Math.max(42,Math.abs(dx)*.42)):(p.y+q.y)/2};
      if(code[1]===code[2]) symbol(g,code[1],midpoint.x,midpoint.y,code[0],pairColor);
      else {
        symbol(g,code[1],midpoint.x-dx/len*10,midpoint.y-dy/len*10,code[0],pairColor);
        symbol(g,code[2],midpoint.x+dx/len*10,midpoint.y+dy/len*10,code[0],pairColor);
      }
    }
    if(!preview) {
      const hit=svg("path",{d:path,fill:"none",stroke:"transparent","stroke-width":18,"pointer-events":"stroke"});
      g.append(hit);
      g.setAttribute("tabindex","0");g.setAttribute("role","button");g.setAttribute("aria-pressed",String(selectedPairKeys.has(key)));
      g.setAttribute("aria-label",`Base pair ${a+1}–${b+1}${probability!=null?", probability "+probability.toFixed(3):""}${code?", "+code:""}`);
      const choose=()=>selectPair(a,b);
      g.addEventListener("click",choose);
      g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
    }
    parent.append(g);
  }
  function selectPair(a,b,notify=true,forceSelected){
    const key=keyOf(a,b);
    const next=forceSelected===undefined?!selectedPairKeys.has(key):Boolean(forceSelected);
    if(next)selectedPairKeys.add(key);else selectedPairKeys.delete(key);
    selectedPairKey=next?key:(selectedPairKey===key?([...selectedPairKeys].at(-1)||null):selectedPairKey);
    selected=a;selectedBackbone=Math.min(selected,Math.max(0,seq.length-2));panel();render();
    if(notify&&typeof window!=="undefined"&&typeof CustomEvent!=="undefined"){
      window.dispatchEvent(new CustomEvent("rna-secondary-pair-select",{detail:{a,b,key,selected:next,sequence:seq,structure:db}}));
    }
  }
  function select(index,notify=true,forceSelected) {
    selected=Math.max(0,Math.min(seq.length-1,index));
    const next=forceSelected===undefined?!selectedResidues.has(selected):Boolean(forceSelected);
    if(next)selectedResidues.add(selected);else selectedResidues.delete(selected);
    selectedBackbone=Math.min(selected,Math.max(0,seq.length-2));panel();render();
    if(notify){
      window.dispatchEvent(new CustomEvent("rna-secondary-select",{detail:{index:selected,selected:next,sequence:seq,isDefault:seq===defaultSeq&&db===defaultDb}}));
      if(seq===defaultSeq&&db===defaultDb) onDefaultSelect(selected);
    }
  }
  function panel() {
    extendedPanel();
    const other=partner[selected],key=activeKey();
    $("seSelected").textContent=other<0?`${seq[selected]}${selected+1} · unpaired`:`${seq[selected]}${selected+1} — ${seq[other]}${other+1}`;
    $("sePairEditor").disabled=!key;
    if($("sePairChemButton"))$("sePairChemButton").disabled=!key;
    $("sePairList").value=key||"";
    $("seLw").value=annotations[key]||"";
    const s=effective(key);
    ["pairColor","pairWidth","pairOpacity"].forEach(k=>$("seLocal-"+k).value=s[k]);
    $("seLocal-mode").value=overrides[key]?.mode||"inherit";
    if($("sePairChemStatus"))$("sePairChemStatus").textContent=key&&pairChemistry[key]?"Custom chemical drawing saved for this pair.":key?"Open the chemistry editor to inspect or modify this base pair.":"Select a base pair to open its chemistry.";
    document.querySelectorAll("[data-residue-index]").forEach(b=>b.setAttribute("aria-pressed",String(selectedResidues.has(+b.dataset.residueIndex))));
  }
  function renderLegend() {
    const box=$("seLegend");box.hidden=!settings.legend;box.replaceChildren();
    if(!settings.legend) return;
    const heading=document.createElement("strong");heading.textContent="Base-pair legend";box.append(heading);
    const explanation=document.createElement("p");
    explanation.textContent=settings.mode==="uniform"?"One solid line: paired residues."
      :settings.mode==="typed"?"G–C: 3 solid lines · A–U: 2 · G–U: 1 · Other: dashed. Line counts are a display convention, not a general hydrogen-bond count."
      :"W: circle · H: square · S: triangle. Filled: cis; open: trans. Dashed: unannotated. For mixed edges, each symbol is nearer its corresponding residue.";
    box.append(explanation);
    if(settings.mode==="lw" || Object.values(overrides).some(s=>s.mode==="lw")){
      const illustration=svg("svg",{viewBox:"0 0 300 38",width:300,height:38,"aria-label":"Filled cis and open trans edge symbols"});
      ["c","t"].forEach((c,row)=>["W","H","S"].forEach((e,col)=>symbol(illustration,e,20+col*38+row*150,18,c,settings.pairColor)));
      box.append(illustration);
      if(settings.mode!=="lw") {
        const note=document.createElement("p");
        note.textContent="LW overrides: circle W, square H, triangle S; filled cis, open trans.";
        box.append(note);
      }
    } else {
      const samples=svg("svg",{viewBox:"0 0 300 70",width:300,height:70,"aria-label":"Base-pair line examples"});
      const types=settings.mode==="typed"?[["G–C",3],["A–U",2],["G–U",1],["Other",0]]:[["All pairs",1]];
      types.forEach(([label,count],i)=>{
        const x=10+i*75;
        for(let k=0;k<Math.max(1,count);k++) samples.append(svg("line",{x1:x,y1:20+k*5,x2:x+48,y2:20+k*5,stroke:settings.pairColor,"stroke-width":settings.pairWidth,"stroke-dasharray":count?"none":"5 5"}));
        text(samples,label,{x:x+24,y:59,fill:"#bacbd7","text-anchor":"middle","font-size":12});
      });
      box.append(samples);
    }
    if(Object.keys(overrides).length) {
      const note=document.createElement("p");note.textContent="Individual pair overrides are active; select a pair to inspect its style.";box.append(note);
    }
  }
  function render() {
    if(!seq) return;
    const root=$("secondarySvg");root.replaceChildren();
    const pos=coordinates();
    const xs=pos.map(p=>p.x),ys=pos.map(p=>p.y);
    let minX=Math.min(...xs)-52,maxX=Math.max(...xs)+52,minY=Math.min(...ys)-55,maxY=Math.max(...ys)+55;
    if(layout==="arc") for(const [a,b] of pairs) minY=Math.min(minY,-Math.abs(pos[b].x-pos[a].x)/2-55);
    root.dataset.fullViewBox=`${minX} ${minY} ${Math.max(150,maxX-minX)} ${Math.max(150,maxY-minY)}`;
    root.setAttribute("aria-label",`${layout} RNA secondary structure with ${seq.length} nucleotides`);
    applyZoom();
    for(let i=0;i<pos.length-1;i++){
      const a=pos[i],b=pos[i+1],bs={...settings,...backboneOverrides[i]};
      const g=svg("g",{class:"se-backbone",role:"button",tabindex:0,"aria-label":`Backbone ${i+1}–${i+2}`,"data-backbone":i});
      g.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:bs.backColor,"stroke-width":bs.backWidth,opacity:bs.backOpacity}));
      g.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"transparent","stroke-width":14,"pointer-events":"stroke","data-export-remove":""}));
      const choose=()=>{selectedBackbone=i;panel();};
      g.addEventListener("click",choose);
      g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
      root.append(g);
    }
    pairs.forEach(([a,b])=>pairGraphic(root,a,b,pos,keyOf(a,b)));
    pos.forEach((p,i)=>{
      const s=residueStyle(i);
      const g=svg("g",{transform:`translate(${p.x} ${p.y})`,class:"se-node"+(pinnedResidues.has(i)?" pinned":"")+(selectedResidues.has(i)?" multi-selected":""),tabindex:0,role:"button","aria-pressed":String(selectedResidues.has(i)),"data-residue-index":i,"aria-label":`${seq[i]}${i+1}, ${partner[i]<0?"unpaired":"paired with "+(partner[i]+1)}`});
      const persistent=selectedResidues.has(i),current=i===selected,pairedFocus=i===partner[selected];
      if(persistent||current||pairedFocus) g.append(svg("circle",{"data-export-remove":"",r:persistent?22:20,fill:"none",stroke:persistent?"#f5e9c8":"#ffffff","stroke-width":persistent?3:1.5,"stroke-dasharray":persistent||current?"none":"3 3"}));
      g.append(svg("circle",{r:16,fill:s.fillColor,stroke:s.circleColor,"stroke-width":s.circleWidth}));
      text(g,seq[i],{y:0,fill:s.letterColor,"font-family":s.font,"font-size":s.letterSize,"font-style":s.fontStyle==="italic"?"italic":"normal","font-weight":s.fontStyle==="bold"?"700":"400","text-anchor":"middle","dominant-baseline":"central"});
      const prev=pos[Math.max(0,i-1)],next=pos[Math.min(pos.length-1,i+1)];
      const away=partner[i]>=0?{x:p.x-pos[partner[i]].x,y:p.y-pos[partner[i]].y}
        :{x:-(next.y-prev.y),y:next.x-prev.x};
      const norm=Math.hypot(away.x,away.y)||1;
      if(indexMode==="all" || indexMode==="selected"&&indexSelection.has(i) || indexMode==="default"&&(i===0||(i+1)%5===0||i===seq.length-1)){
        const style={...indexSettings,...indexOverrides[i]};
        const number=text(g,String(i+1),{x:layout==="arc"?0:away.x/norm*30,y:layout==="arc"?36:away.y/norm*30+4,fill:style.color,"font-size":style.size,"font-family":style.font,"font-style":style.fontStyle==="italic"?"italic":"normal","font-weight":style.fontStyle==="bold"?700:400,"text-anchor":"middle"});
        number.setAttribute("class","se-index");
      }
      const title=svg("title");title.textContent=`${seq[i]}${i+1}`+(metadata[i]?` · ${metadata[i].id} · ${metadata[i].value??"No value"}`:"");g.append(title);
      g.addEventListener("click",()=>{if(!suppressNodeClick)select(i);});
      g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(i);}});
      root.append(g);
    });
    text(root,"5′",{x:pos[0].x-30,y:pos[0].y,fill:"#74d7b6","font-size":16,"text-anchor":"end"});
    text(root,"3′",{x:pos.at(-1).x+30,y:pos.at(-1).y,fill:"#74d7b6","font-size":16});
    $("secondaryStageNote").textContent=`${layout[0].toUpperCase()+layout.slice(1)} · ${seq.length} residues · ${pairs.length} pairs · Select a residue index or pair`;
    renderLegend();renderHeatLegend();renderPairProbabilityLegend();updateLayerSummary();saveWorkspaceLocal();
    if(typeof window!=="undefined"&&typeof CustomEvent!=="undefined")window.dispatchEvent(new CustomEvent("rna-secondary-layout",{detail:{sequence:seq,structure:db,layout,positions:pos.map(p=>({x:p.x,y:p.y}))}}));
  }
  function broadcastContext() {
    const isDefault=seq===defaultSeq&&db===defaultDb;
    if(typeof window==="undefined"||typeof CustomEvent==="undefined"){saveWorkspaceLocal();return;}
    window.dispatchEvent(new CustomEvent("rna-secondary-context",{detail:{isDefault,sequence:seq,structure:db}}));
    window.dispatchEvent(new CustomEvent("rna-metadata-change",{detail:{
      isDefault,sequence:seq,metadata:{...metadata},heatEnabled,heatTheme,heatRange:[...heatRange]
    }}));saveWorkspaceLocal();
  }
  function load(sequence,structure) {
    const parsed=parse(sequence,structure);
    const changed=sequence!==seq||structure!==db;
    seq=sequence;db=structure;pairs=parsed.pairs;partner=parsed.partner;selected=0;
    if(changed){selectedResidues=new Set();selectedPairKeys=new Set();selectedPairKey=null;overrides={};annotations={};residueOverrides={};backboneOverrides={};metadata={};heatEnabled=false;metadataTicket++;pairProbabilities={};pairProbEnabled=false;pairProbTicket++;pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;panX=panY=0;
      indexMode="default";indexOverrides={};indexSelection=new Set([...sequence].map((_,i)=>i).filter(i=>i===0||(i+1)%5===0||i===sequence.length-1));
      if($("seMetadataFile"))$("seMetadataFile").value="";
      if($("seMetadataStatus"))$("seMetadataStatus").textContent="Upload metadata for the current sequence.";
      if($("sePairProbFile"))$("sePairProbFile").value="";
      if($("sePairProbStatus"))$("sePairProbStatus").textContent="Upload a probability matrix or sparse CSV for the current sequence.";
    }
    selectedBackbone=0;
    $("seBackList").replaceChildren();
    for(let i=0;i<seq.length-1;i++)$("seBackList").append(new Option(`${i+1}–${i+2}`,String(i)));
    $("sePairList").replaceChildren(new Option("Select a pair by residue indices",""));
    pairs.forEach(([a,b])=>$("sePairList").append(new Option(`${a+1}–${b+1}  (${seq[a]}–${seq[b]})`,keyOf(a,b))));
    $("seResidueList").replaceChildren();$("seIndexChoices").replaceChildren();
    [...seq].forEach((base,i)=>{
      $("seResidueList").append(new Option(`${base}${i+1}`,String(i)));
      const label=document.createElement("label"),checkbox=document.createElement("input");
      checkbox.type="checkbox";checkbox.checked=indexSelection.has(i);checkbox.dataset.indexChoice=i;
      label.append(checkbox,document.createTextNode(String(i+1)));$("seIndexChoices").append(label);
      checkbox.addEventListener("change",()=>{if(checkbox.checked)indexSelection.add(i);else indexSelection.delete(i);indexMode="selected";panel();render();});
    });
    panel();render();broadcastContext();
  }

  const residueFields=[
    ["fillColor","Circle fill","color"],["circleColor","Circle outline color","color"],
    ["circleWidth","Circle outline thickness","number",0,8,.5],
    ["letterColor","Font color","color"],["letterSize","Font size","number",8,52,1],
    ["font","Font family","select",["monospace","sans-serif","serif","Arial","Calibri","Times New Roman"]],
    ["fontStyle","Font style","select",["normal","bold","italic"]]
  ];
  const backFields=[["backColor","Backbone color","color"],["backWidth","Backbone thickness","number",0,10,.5],["backOpacity","Backbone opacity (0–1)","number",0,1,.05]];
  function localFields(fields,prefix){
    return fields.map(([k,label,type,min,max,step])=>'<label>'+label+(type==="select"
      ?'<select id="'+prefix+k+'">'+min.map(v=>'<option value="'+v+'">'+v+'</option>').join("")+'</select>'
      :'<input id="'+prefix+k+'" type="'+type+'" '+(type==="number"?'min="'+min+'" max="'+max+'" step="'+step+'"':'')+'>')+'</label>').join("");
  }
  function enhanceColorInputs(container){
    container.querySelectorAll('input[type="color"]').forEach(color=>{
      if(color.dataset.hexEnhanced)return;
      color.dataset.hexEnhanced="true";
      const code=document.createElement("input");
      code.type="text";code.className="se-color-code";code.value=color.value.toUpperCase();
      code.setAttribute("aria-label","Hex color code");code.maxLength=7;code.placeholder="#RRGGBB";
      color.insertAdjacentElement("afterend",code);
      color.addEventListener("input",()=>{code.value=color.value.toUpperCase();code.classList.remove("invalid");});
      const apply=()=>{
        const value=code.value.trim();
        if(/^#[0-9a-fA-F]{6}$/.test(value)){
          code.classList.remove("invalid");color.value=value;color.dispatchEvent(new Event("input",{bubbles:true}));
        }else code.classList.add("invalid");
      };
      code.addEventListener("change",apply);code.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();apply();}});
    });
  }
  function reorganizeControls(controls){
    const old=[...controls.children].filter(el=>el.tagName==="DETAILS");
    function group(name){
      const el=document.createElement("details");el.open=name==="Display · Residues";
      el.innerHTML='<summary>'+name+'</summary><details open><summary>Selected</summary></details><details><summary>All</summary></details>';
      controls.insertBefore(el,old[0]);return [el.children[1],el.children[2]];
    }
    const [bs,ba]=group("Display · Backbone"),[rs,ra]=group("Display · Residues"),[ps,pa]=group("Analyze · Base pairs"),[ixs,ixa]=group("Display · Residue index");
    const layerBox=document.createElement("details");
    layerBox.className="se-data-layers";
    layerBox.innerHTML='<summary>Analyze · Data layers</summary><p>Load reactivity/residue information, base-pair probabilities, or both. Loaded data stay available while you turn each visual layer on or off independently.</p><label><input id="seLayerReactivity" type="checkbox" disabled> Show reactivity colors</label><label><input id="seLayerPairProb" type="checkbox" disabled> Show base-pair probability colors</label><p id="seLayerStatus" role="status">Reactivity: not loaded · Pair probability: not loaded</p>';
    controls.insertBefore(layerBox,controls.firstElementChild);
    setupIndexControls(ixs,ixa);
    backFields.forEach(([k])=>ba.append($("se-"+k).closest("label")));
    ba.insertAdjacentHTML("afterbegin","<p>Phosphodiester connections between consecutive residues.</p>");
    bs.innerHTML+='<label>Connection indices<select id="seBackList"></select></label><fieldset id="seBackEditor"><legend>Selected connection</legend>'+localFields(backFields,"seBack-")+'<button id="seBackReset" type="button">Reset selected connection</button></fieldset>';
    ["pairColor","pairWidth","pairOpacity","mode"].forEach(k=>pa.append($("se-"+k).closest("label")));
    pa.append($("seLegendToggle"));
    pa.insertAdjacentHTML("beforeend",'<button type="button" id="seStandardPairChemistry">Standard WCF / G–U chemistry</button><fieldset><legend>Base-pair probability</legend><p>Upload either an N × N probability matrix (comma- or whitespace-separated) or sparse CSV with headers Residue_i,Residue_j,Probability. Values must be 0–1. This colors pair connectors independently of residue reactivity.</p><label>Probability data<input id="sePairProbFile" type="file" accept=".csv,.txt,text/csv,text/plain"></label><label>Probability theme<select id="sePairProbTheme"><option value="viridis">Viridis</option><option value="magma">Magma</option><option value="blueRed">Blue–white–red</option><option value="cividis">Cividis</option></select></label><label><input type="checkbox" id="sePairProbEnabled">Show base-pair probability colors</label><button type="button" id="sePairProbClear">Clear pair probabilities</button><p id="sePairProbStatus" role="status">Upload a probability matrix or sparse CSV for the current sequence.</p></fieldset>');
    const fill=document.createElement("div");fill.innerHTML=input("fillColor","All circle fills (replaces heatmap)","color","#2f6b57");
    ra.append(fill.firstElementChild);
    [...old[1].children].filter(el=>el.tagName!=="SUMMARY").forEach(el=>ra.append(el));
    rs.innerHTML+='<strong id="seResidueSelected"></strong><p id="seResidueMetadata"></p>'+localFields(residueFields,"seResidue-")+'<button id="seResidueReset" type="button">Reset selected residue</button>';
    rs.insertAdjacentHTML("beforeend",'<label>Selected residue<select id="seResidueList"></select></label>');
    $("seResidueList").addEventListener("change",e=>select(Number(e.target.value)));
    ps.append($("seSelected"),$("sePairList").closest("label"),$("sePairEditor"));
    $("sePairEditor").insertAdjacentHTML("beforeend",'<button type="button" id="sePairChemButton">Open base-pair chemistry</button><p id="sePairChemStatus">Select a base pair to open its chemistry.</p>');
    ra.insertAdjacentHTML("beforeend",'<button id="seNaturalColors" type="button">Restore A/G/C/U fill colors</button><fieldset><legend>Reactivity / residue information</legend><p>Headers: Residue_Index, Residue_ID, Residue_Information. Indices start at 1. Numeric values are mapped linearly; blank or NA values keep the standard nucleotide color. Upload applies the heatmap and resets other colors to defaults; you can edit them afterward.</p><label>Reactivity / metadata CSV<input id="seMetadataFile" type="file" accept=".csv,text/csv"></label><label>Heatmap theme<select id="seHeatTheme"><option value="viridis">Viridis</option><option value="magma">Magma</option><option value="blueRed">Blue–white–red</option><option value="cividis">Cividis</option></select></label><label><input type="checkbox" id="seHeatEnabled">Show reactivity colors</label><button id="seClearMetadata" type="button">Clear metadata</button><p id="seMetadataStatus" role="status">Upload metadata for the current sequence.</p></fieldset>');
    const reactivityField=$("seMetadataFile").closest("fieldset"),probabilityField=$("sePairProbFile").closest("fieldset");
    layerBox.append(reactivityField,probabilityField);
    layerBox.insertAdjacentHTML("beforeend",
      '<details class="se-legend-settings"><summary>Reactivity color bar</summary>'+
      '<label><input id="seHeatLegendVisible" type="checkbox" checked> Show color bar</label>'+
      '<label>Orientation<select id="seHeatLegendOrientation"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>'+
      '<label>Automatic tick count<input id="seHeatLegendTicks" type="number" min="2" max="12" step="1" value="3"></label>'+
      '<label>Custom tick values<input id="seHeatLegendValues" type="text" placeholder="e.g. 0, 0.5, 1, 1.5, 2"></label>'+
      '<label>Bar thickness<input id="seHeatLegendThickness" type="number" min="4" max="60" step="1" value="16"></label>'+
      '<label>Tick thickness<input id="seHeatLegendTickThickness" type="number" min="0.5" max="6" step="0.5" value="1"></label>'+
      '<label>Font family<select id="seHeatLegendFont"><option>monospace</option><option>Arial</option><option>Calibri</option><option>Times New Roman</option></select></label>'+
      '<label>Font size<input id="seHeatLegendFontSize" type="number" min="8" max="36" step="1" value="12"></label>'+
      '<label>Font color<input id="seHeatLegendFontColor" type="color" value="#bacbd7"></label></details>'+
      '<details class="se-legend-settings"><summary>Base-pair probability color bar</summary>'+
      '<label><input id="sePairLegendVisible" type="checkbox" checked> Show color bar</label>'+
      '<label>Orientation<select id="sePairLegendOrientation"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>'+
      '<label>Automatic tick count<input id="sePairLegendTicks" type="number" min="2" max="12" step="1" value="3"></label>'+
      '<label>Custom tick values<input id="sePairLegendValues" type="text" placeholder="e.g. 0, 0.2, 0.5, 0.8, 1"></label>'+
      '<label>Bar thickness<input id="sePairLegendThickness" type="number" min="4" max="60" step="1" value="16"></label>'+
      '<label>Tick thickness<input id="sePairLegendTickThickness" type="number" min="0.5" max="6" step="0.5" value="1"></label>'+
      '<label>Font family<select id="sePairLegendFont"><option>monospace</option><option>Arial</option><option>Calibri</option><option>Times New Roman</option></select></label>'+
      '<label>Font size<input id="sePairLegendFontSize" type="number" min="8" max="36" step="1" value="12"></label>'+
      '<label>Font color<input id="sePairLegendFontColor" type="color" value="#bacbd7"></label></details>');
    old.forEach(el=>el.remove());
    $("seMetadataFile").closest("fieldset").insertAdjacentHTML("afterbegin",'<button type="button" id="seExample">Load example reactivity CSV</button><p><a href="data/rna_residue_reactivity.csv" download>Download example CSV</a> · Values supplied for the default tRNA.</p>');
    $("sePairProbFile").closest("fieldset").insertAdjacentHTML("afterbegin",'<button type="button" id="sePairProbExample">Load example base-pair probabilities</button><p><a href="data/rna_base_pair_probability_example.csv" download>Download example probability CSV</a> · Synthetic demonstration data for the default tRNA.</p>');
    $("seBackList").addEventListener("change",e=>{selectedBackbone=Number(e.target.value);panel();});
    const bindLocal=(fields,prefix,target,index)=>fields.forEach(([k])=>$(prefix+k).addEventListener("input",e=>{
      if(!e.target.checkValidity())return;
      const collection=target(),i=index();collection[i]??={};
      collection[i][k]=e.target.type==="number"?Number(e.target.value):e.target.value;render();
    }));
    bindLocal(backFields,"seBack-",()=>backboneOverrides,()=>selectedBackbone);
    bindLocal(residueFields,"seResidue-",()=>residueOverrides,()=>selected);
    $("seBackReset").addEventListener("click",()=>{delete backboneOverrides[selectedBackbone];panel();render();});
    $("seResidueReset").addEventListener("click",()=>{delete residueOverrides[selected];panel();render();});
    $("seNaturalColors").addEventListener("click",()=>{
      delete settings.fillColor;heatEnabled=false;Object.values(residueOverrides).forEach(o=>delete o.fillColor);panel();render();broadcastContext();
    });
    $("seLayerReactivity").addEventListener("change",e=>{
      heatEnabled=e.target.checked&&Object.keys(metadata).length>0;
      if(e.target.checked&&!heatEnabled)$("seMetadataStatus").textContent="Load reactivity/residue-information data first.";
      panel();render();broadcastContext();
    });
    $("seLayerPairProb").addEventListener("change",e=>{
      pairProbEnabled=e.target.checked&&Object.keys(pairProbabilities).length>0;
      if(e.target.checked&&!pairProbEnabled)$("sePairProbStatus").textContent="Load base-pair probability data first.";
      render();
    });
    $("seHeatTheme").addEventListener("change",e=>{heatTheme=e.target.value;panel();render();broadcastContext();});
    $("seHeatEnabled").addEventListener("change",e=>{
      heatEnabled=e.target.checked&&Object.keys(metadata).length>0;
      if(e.target.checked&&!heatEnabled)$("seMetadataStatus").textContent="Upload a CSV with numeric values first.";
      panel();render();broadcastContext();
    });
    $("seClearMetadata").addEventListener("click",()=>{
      metadataTicket++;metadata={};heatEnabled=false;$("seMetadataFile").value="";
      $("seMetadataStatus").textContent="Metadata cleared.";panel();render();broadcastContext();
    });
    $("seMetadataFile").addEventListener("change",async e=>{
      const file=e.target.files[0];if(!file)return;
      const ticket=++metadataTicket;
      try{
        if(file.size>2*1024*1024)throw Error("CSV must be smaller than 2 MB.");
        const csv=await file.text();if(ticket!==metadataTicket)return;
        applyMetadata(csv);
      }catch(error){if(ticket===metadataTicket)$("seMetadataStatus").textContent="Upload failed: "+error.message;}
    });
    $("seStandardPairChemistry").addEventListener("click",()=>{
      if(typeof MoleculeEditor!=="undefined")MoleculeEditor.openPair("G","C");
    });
    $("sePairChemButton").addEventListener("click",()=>{
      const key=activeKey();if(!key)return;
      const [a,b]=key.split(":").map(Number);
      if(typeof MoleculeEditor!=="undefined")MoleculeEditor.openPair(seq[a],seq[b],drawing=>{pairChemistry[key]=drawing;panel();});
    });
    $("sePairProbTheme").addEventListener("change",e=>{pairProbTheme=e.target.value;render();});
    $("sePairProbEnabled").addEventListener("change",e=>{
      pairProbEnabled=e.target.checked&&Object.keys(pairProbabilities).length>0;
      if(e.target.checked&&!pairProbEnabled)$("sePairProbStatus").textContent="Upload probability data first.";
      render();
    });
    $("sePairProbClear").addEventListener("click",()=>{
      pairProbTicket++;pairProbabilities={};pairProbEnabled=false;$("sePairProbFile").value="";$("sePairProbEnabled").checked=false;
      $("sePairProbStatus").textContent="Pair-probability data cleared.";render();
    });
    $("sePairProbFile").addEventListener("change",async e=>{
      const file=e.target.files[0];if(!file)return;const ticket=++pairProbTicket;
      try{
        if(file.size>5*1024*1024)throw Error("Probability file must be smaller than 5 MB.");
        const data=parsePairProbabilities(await file.text(),seq.length);if(ticket!==pairProbTicket)return;
        pairProbabilities=data;pairProbEnabled=true;$("sePairProbEnabled").checked=true;
        const matched=pairs.filter(([a,b])=>data[keyOf(a,b)]!=null).length;
        $("sePairProbStatus").textContent=Object.keys(data).length+" pair probabilities loaded; "+matched+" currently displayed base pairs have values.";
        render();
      }catch(error){if(ticket===pairProbTicket)$("sePairProbStatus").textContent="Upload failed: "+error.message;}
    });
    $("sePairProbExample").addEventListener("click",async()=>{
      const ticket=++pairProbTicket;$("sePairProbStatus").textContent="Loading example…";
      try{
        const response=await fetch("data/rna_base_pair_probability_example.csv");if(!response.ok)throw Error("Could not load example probability CSV.");
        if(seq!==defaultSeq||db!==defaultDb){$("secondarySequence").value=defaultSeq;$("secondaryDotBracket").value=defaultDb;load(defaultSeq,defaultDb);}
        const data=parsePairProbabilities(await response.text(),seq.length);if(ticket!==pairProbTicket)return;
        pairProbabilities=data;pairProbEnabled=true;$("sePairProbEnabled").checked=true;
        $("sePairProbStatus").textContent=Object.keys(data).length+" synthetic pair probabilities loaded for demonstration.";render();
      }catch(error){$("sePairProbStatus").textContent=error.message;}
    });
        function bindLegendControls(kind,prefix){
      const cfg=legendSettings[kind],pairs=[
        ["Visible","visible",el=>el.checked],["Orientation","orientation",el=>el.value],
        ["Ticks","tickCount",el=>Number(el.value)],["Values","tickValues",el=>el.value],
        ["Thickness","thickness",el=>Number(el.value)],["TickThickness","tickThickness",el=>Number(el.value)],
        ["Font","font",el=>el.value],["FontSize","fontSize",el=>Number(el.value)],["FontColor","fontColor",el=>el.value]
      ];
      pairs.forEach(([suffix,key,read])=>$(prefix+suffix)?.addEventListener("input",e=>{if(e.target.checkValidity?.()===false)return;cfg[key]=read(e.target);render();}));
      $(prefix+"Visible")?.addEventListener("change",e=>{cfg.visible=e.target.checked;render();});
      $(prefix+"Orientation")?.addEventListener("change",e=>{cfg.orientation=e.target.value;render();});
    }
    bindLegendControls("heat","seHeatLegend");
    bindLegendControls("pair","sePairLegend");
    $("seExample").addEventListener("click",async()=>{
      const ticket=++metadataTicket;$("seMetadataStatus").textContent="Loading example…";
      try{
        const response=await fetch("data/rna_residue_reactivity.csv");
        if(!response.ok)throw Error("Could not load example CSV.");
        const csv=await response.text();if(ticket!==metadataTicket)return;
        if(seq!==defaultSeq||db!==defaultDb){
          $("secondarySequence").value=defaultSeq;$("secondaryDotBracket").value=defaultDb;load(defaultSeq,defaultDb);
        }
        applyMetadata(csv);
      }catch(error){$("seMetadataStatus").textContent=error.message;}
    });
    enhanceColorInputs(controls);
    function applyMetadata(csv){
        const data=parseMetadata(csv,seq.length);
        const values=Object.values(data).map(r=>r.value).filter(v=>v!==null);
        metadata=data;heatRange=[Math.min(...values),Math.max(...values)];heatEnabled=true;
        delete settings.fillColor;
        Object.values(residueOverrides).forEach(o=>delete o.fillColor);
        controls.querySelectorAll("[data-setting]").forEach(el=>{if(settings[el.dataset.setting]!==undefined)el.value=settings[el.dataset.setting];});
        $("seMetadataStatus").textContent=values.length+" numeric values loaded; "+(seq.length-values.length)+" residues without values. Reactivity coloring is on; base-pair probability data and pair styling were left unchanged.";
        panel();render();broadcastContext();
    }
  }
  const indexFields=[["color","Index color","color"],["size","Index size","number",8,40,1],["font","Index font family","select",["monospace","sans-serif","serif","Arial","Calibri","Times New Roman"]],["fontStyle","Index font style","select",["normal","bold","italic"]]];
  function setupIndexControls(selectedPanel,allPanel){
    selectedPanel.innerHTML+='<p>Check the indices to show and style together.</p><details class="se-index-dropdown"><summary>Choose indices</summary><div id="seIndexChoices"></div></details><button id="seIndexNone" type="button">Clear selection</button><button id="seIndexShow" type="button">Show selected indices</button>'+localFields(indexFields,"seIndexSelected-")+'<button id="seIndexReset" type="button">Reset selected index styles</button>';
    allPanel.innerHTML+='<button id="seIndexAll" type="button">Show all indices</button><button id="seIndexDefault" type="button">Default: 1, every 5, and last</button><p id="seIndexMode" role="status"></p>'+localFields(indexFields,"seIndexAll-");
    indexFields.forEach(([key])=>{
      $("seIndexAll-"+key).value=indexSettings[key];$("seIndexSelected-"+key).value=indexSettings[key];
      $("seIndexAll-"+key).addEventListener("input",e=>{if(!e.target.checkValidity())return;indexSettings[key]=e.target.type==="number"?Number(e.target.value):e.target.value;render();});
      $("seIndexSelected-"+key).addEventListener("input",e=>{if(!e.target.checkValidity())return;indexSelection.forEach(i=>{indexOverrides[i]??={};indexOverrides[i][key]=e.target.type==="number"?Number(e.target.value):e.target.value;});render();});
    });
    $("seIndexAll").addEventListener("click",()=>{indexMode="all";panel();render();});
    $("seIndexDefault").addEventListener("click",()=>{indexMode="default";panel();render();});
    $("seIndexShow").addEventListener("click",()=>{indexMode="selected";panel();render();});
    $("seIndexNone").addEventListener("click",()=>{indexSelection.clear();indexMode="selected";document.querySelectorAll("[data-index-choice]").forEach(el=>el.checked=false);panel();render();});
    $("seIndexReset").addEventListener("click",()=>{indexSelection.forEach(i=>delete indexOverrides[i]);render();});
  }
  function updateLayerSummary(){
    const reactivityLoaded=Object.keys(metadata).length>0,pairLoaded=Object.keys(pairProbabilities).length>0;
    if($("seLayerReactivity")){$("seLayerReactivity").disabled=!reactivityLoaded;$("seLayerReactivity").checked=heatEnabled;}
    if($("seLayerPairProb")){$("seLayerPairProb").disabled=!pairLoaded;$("seLayerPairProb").checked=pairProbEnabled;}
    if($("seHeatEnabled"))$("seHeatEnabled").checked=heatEnabled;
    if($("sePairProbEnabled"))$("sePairProbEnabled").checked=pairProbEnabled;
    if($("seLayerStatus"))$("seLayerStatus").textContent=
      "Reactivity: "+(reactivityLoaded?(heatEnabled?"loaded · ON":"loaded · OFF"):"not loaded")+
      " · Pair probability: "+(pairLoaded?(pairProbEnabled?"loaded · ON":"loaded · OFF"):"not loaded");
  }
  function extendedPanel(){
    if(!$("seBackList"))return;
    $("seBackList").value=String(selectedBackbone);
    $("seBackEditor").disabled=seq.length<2;
    const b={...settings,...backboneOverrides[selectedBackbone]},r=residueStyle(selected);
    backFields.forEach(([k])=>$("seBack-"+k).value=b[k]);
    residueFields.forEach(([k])=>$("seResidue-"+k).value=r[k]);
    $("seResidueSelected").textContent=(seq[selected]||"")+" · residue "+(selected+1);
    const m=metadata[selected];
    $("seResidueMetadata").textContent=m?"Residue ID: "+m.id+" · Information: "+(m.value??"No value"):"No metadata for this residue.";
    $("seHeatEnabled").checked=heatEnabled;
    updateLayerSummary();
    $("seResidueList").value=String(selected);
    $("seIndexMode").textContent="Showing: "+(indexMode==="default"?"1, every 5, and last":indexMode==="all"?"all indices":indexSelection.size+" selected indices");
  }
  function legendTickValues(cfg,min,max){
    const custom=String(cfg.tickValues||"").split(",").map(v=>Number(v.trim())).filter(Number.isFinite);
    if(custom.length>=2)return custom;
    const n=Math.max(2,Math.min(12,Number(cfg.tickCount)||3));
    return Array.from({length:n},(_,i)=>min+(max-min)*i/(n-1));
  }
  function startLegendDrag(box,key,event){
    if(!event.target.closest(".se-legend-drag-handle"))return;
    event.preventDefault();const cfg=legendSettings[key],stage=box.parentElement,rect=stage.getBoundingClientRect();
    const start={x:event.clientX,y:event.clientY,left:cfg.x,top:cfg.y};
    box.setPointerCapture?.(event.pointerId);
    const move=e=>{
      if(e.pointerId!==event.pointerId)return;
      cfg.x=Math.max(0,Math.min(rect.width-box.offsetWidth,start.left+e.clientX-start.x));
      cfg.y=Math.max(0,Math.min(rect.height-box.offsetHeight,start.top+e.clientY-start.y));
      box.style.left=cfg.x+"px";box.style.top=cfg.y+"px";
    };
    const up=e=>{
      if(e.pointerId!==event.pointerId)return;
      box.removeEventListener("pointermove",move);box.removeEventListener("pointerup",up);box.removeEventListener("pointercancel",up);
      if(box.hasPointerCapture?.(e.pointerId))box.releasePointerCapture(e.pointerId);
    };
    box.addEventListener("pointermove",move);box.addEventListener("pointerup",up);box.addEventListener("pointercancel",up);
  }
  function renderScaleLegend(box,key,title,stops,min,max,active){
    const cfg=legendSettings[key];box.hidden=!active||!cfg.visible;box.replaceChildren();if(box.hidden)return;
    box.className="se-data-legend "+cfg.orientation;box.style.left=cfg.x+"px";box.style.top=cfg.y+"px";
    const cssVar=(name,value)=>box.style.setProperty?box.style.setProperty(name,value):box.style[name]=value;
    cssVar("--legend-thickness",cfg.thickness+"px");cssVar("--tick-thickness",cfg.tickThickness+"px");
    cssVar("--legend-font",cfg.font);cssVar("--legend-font-size",cfg.fontSize+"px");cssVar("--legend-font-color",cfg.fontColor);
    const head=document.createElement("div");head.className="se-legend-drag-handle";head.innerHTML="<strong>"+title+"</strong><span>drag</span>";
    const body=document.createElement("div");body.className="se-legend-body";
    const bar=document.createElement("div");bar.className="se-heat-bar";bar.style.background="linear-gradient("+(cfg.orientation==="vertical"?"to top":"to right")+","+stops.join(",")+")";
    const ticks=document.createElement("div");ticks.className="se-legend-ticks";
    legendTickValues(cfg,min,max).forEach(value=>{
      const item=document.createElement("span"),mark=document.createElement("i"),label=document.createElement("b");
      mark.setAttribute("aria-hidden","true");label.textContent=Number(value.toFixed(4)).toString();item.append(mark,label);ticks.append(item);
    });
    body.append(bar,ticks);box.append(head,body);box.onpointerdown=e=>startLegendDrag(box,key,e);
  }
  function renderPairProbabilityLegend(){
    const box=$("sePairProbLegend");if(!box)return;
    renderScaleLegend(box,"pair","Base-pair probability",palettes[pairProbTheme],0,1,pairProbEnabled);
  }
  function renderHeatLegend(){
    const box=$("seHeatLegend");if(!box)return;
    renderScaleLegend(box,"heat","Reactivity / residue information",palettes[heatTheme],heatRange[0],heatRange[1],heatEnabled);
  }
  function applyZoom(){
    const root=$("secondarySvg"),v=root.dataset.fullViewBox.split(/\s+/).map(Number);
    const viewport=root.parentElement,fitWidth=viewport.clientWidth||700,fitHeight=viewport.clientHeight||560;
    const fit=Math.min(fitWidth/v[2],fitHeight/v[3]);
    const width=fitWidth/fit/zoom,height=fitHeight/fit/zoom;
    root.setAttribute("viewBox",[v[0]+v[2]/2-width/2+panX,v[1]+v[3]/2-height/2+panY,width,height].join(" "));
    root.style.width="100%";root.style.height="100%";
    root.style.minWidth="0";root.style.minHeight="0";root.style.maxWidth="none";root.style.flexShrink="0";
    if($("seZoomValue"))$("seZoomValue").textContent=Math.round(zoom*100)+"%";
    if($("seZoomOut"))$("seZoomOut").disabled=zoom<=.25;
    if($("seZoomIn"))$("seZoomIn").disabled=zoom>=8;
  }
  async function exportPng(){
    const button=$("seDownload"),status=$("seExportStatus");button.disabled=true;status.textContent="Preparing transparent PNG…";
    try{
      const source=$("secondarySvg"),clone=source.cloneNode(true);
      const [, ,w,h]=source.dataset.fullViewBox.split(/\s+/).map(Number);
      clone.setAttribute("viewBox",source.dataset.fullViewBox);
      // Use explicit presentation attributes, not page CSS. Export the full drawing.
      clone.removeAttribute("style");clone.setAttribute("xmlns",NS);
      const scale=Math.min(exportScale,8192/w,8192/h,Math.sqrt(16000000/(w*h)));
      const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));
      clone.setAttribute("width",width);clone.setAttribute("height",height);
      clone.querySelectorAll("[data-export-remove],title").forEach(el=>el.remove());
      clone.querySelectorAll('[stroke="transparent"]').forEach(el=>el.remove());
      clone.querySelectorAll("[tabindex]").forEach(el=>el.removeAttribute("tabindex"));
      const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml;charset=utf-8"});
      const url=URL.createObjectURL(blob),img=new Image();
      try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error("Could not rasterize the SVG."));img.src=url;});}
      finally{URL.revokeObjectURL(url);}
      const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      const context=canvas.getContext("2d");if(!context)throw Error("Canvas export is unavailable.");
      context.clearRect(0,0,width,height);context.drawImage(img,0,0,width,height);
      const png=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!png)throw Error("PNG creation failed. Try a smaller structure.");
      const downloadUrl=URL.createObjectURL(png),link=document.createElement("a");
      link.href=downloadUrl;link.download="rna-secondary-"+layout+".png";document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(downloadUrl),10000);
      status.textContent="PNG downloaded ("+width+" × "+height+"). Transparent background; selection highlights and side-panel legends excluded.";
    }catch(error){status.textContent="Export failed: "+error.message;}finally{button.disabled=false;}
  }
  function setupToolbar(viewport,stage){
    const toolbar=document.createElement("div");toolbar.className="se-toolbar";
    toolbar.innerHTML='<button id="seZoomOut" type="button" aria-label="Zoom out">−</button><output id="seZoomValue" aria-live="polite">100%</output><button id="seZoomIn" type="button" aria-label="Zoom in">+</button><button id="seZoomReset" type="button">Fit structure</button><button id="seUndoLayout" type="button">Undo move</button><button id="seRedoLayout" type="button">Redo move</button><label>Move<select id="seDragMode"><option value="residue">Nucleotide</option><option value="branch">Stem / branch</option><option value="whole">Whole structure</option></select></label><label class="se-inline-check"><input id="seFlexDrag" type="checkbox" checked> Flexible neighbors</label><button id="sePinSelected" type="button">Pin selected</button><button id="seResetManualLayout" type="button">Reset layout edits</button><label>Go to residue<input id="seGoToResidue" type="number" min="1" value="1"></label><button id="seGoToButton" type="button">Go</button><button id="seExportDialogButton" type="button">Export…</button>';
    viewport.before(toolbar);
    const message=document.createElement("p");message.id="seExportStatus";message.setAttribute("role","status");message.className="se-export-status";viewport.after(message);
    const legend=document.createElement("div");legend.id="seHeatLegend";legend.hidden=true;stage.append(legend);
    const pairLegend=document.createElement("div");pairLegend.id="sePairProbLegend";pairLegend.hidden=true;stage.append(pairLegend);
    function changeZoom(factor,clientX,clientY){
      const root=$("secondarySvg"),rect=root.getBoundingClientRect(),before=root.getAttribute("viewBox").split(/\s+/).map(Number);
      const x=clientX===undefined?.5:(clientX-rect.left)/rect.width,y=clientY===undefined?.5:(clientY-rect.top)/rect.height;
      zoom=Math.max(.25,Math.min(8,zoom*factor));applyZoom();
      const after=root.getAttribute("viewBox").split(/\s+/).map(Number);
      panX+=before[0]+x*before[2]-after[0]-x*after[2];panY+=before[1]+y*before[3]-after[1]-y*after[3];applyZoom();
    }
    $("seZoomIn").addEventListener("click",()=>changeZoom(1.25));
    $("seZoomOut").addEventListener("click",()=>changeZoom(.8));
    $("seZoomReset").addEventListener("click",fitStructure);
    $("seUndoLayout").addEventListener("click",undoLayout);$("seRedoLayout").addEventListener("click",redoLayout);
    viewport.addEventListener("wheel",e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?560:1);changeZoom(Math.exp(-Math.max(-200,Math.min(200,delta))*.003),e.clientX,e.clientY);},{passive:false});
    let drag=null,suppressMenu=false;
    viewport.addEventListener("pointerdown",e=>{if(e.button!==2)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId);viewport.classList.add("se-panning");});
    viewport.addEventListener("pointermove",e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const root=$("secondarySvg"),rect=root.getBoundingClientRect(),v=root.getAttribute("viewBox").split(/\s+/).map(Number);
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(dx||dy)suppressMenu=true;
      panX-=dx/rect.width*v[2];panY-=dy/rect.height*v[3];drag.x=e.clientX;drag.y=e.clientY;applyZoom();
    });
    const endDrag=e=>{if(drag&&e.pointerId===drag.id){drag=null;viewport.classList.remove("se-panning");if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);setTimeout(()=>suppressMenu=false,100);}};
    viewport.addEventListener("pointerup",endDrag);viewport.addEventListener("pointercancel",endDrag);
    viewport.addEventListener("contextmenu",e=>{if(drag||suppressMenu)e.preventDefault();});
    toolbar.insertAdjacentHTML("afterend",'<p class="se-export-status" id="seDragStatus">Left-drag a nucleotide to edit the layout · Mouse wheel: zoom · Right-button drag: pan.</p>');
    $("seDragMode").addEventListener("change",e=>{dragMode=e.target.value;$("seDragStatus").textContent="Drag mode: "+e.target.options[e.target.selectedIndex].text+".";});
    $("seFlexDrag").addEventListener("change",e=>{flexDrag=e.target.checked;});
    $("sePinSelected").addEventListener("click",()=>{
      if(pinnedResidues.has(selected)){pinnedResidues.delete(selected);$("seDragStatus").textContent="Residue "+(selected+1)+" unpinned.";}
      else {pinnedResidues.add(selected);$("seDragStatus").textContent="Residue "+(selected+1)+" pinned. Neighbor relaxation will leave it fixed.";}
      render();
    });
    $("seResetManualLayout").addEventListener("click",()=>{pushLayoutHistory();manualOffsets={};pinnedResidues.clear();$("seDragStatus").textContent="Manual layout edits cleared.";render();});
    $("seGoToButton").addEventListener("click",()=>{const i=Number($("seGoToResidue").value)-1;if(i>=0&&i<seq.length){select(i);$("seDragStatus").textContent="Selected residue "+(i+1)+"."; }else $("seDragStatus").textContent="Residue number must be between 1 and "+seq.length+".";});
    $("seExportDialogButton").addEventListener("click",()=>$("seExportDialog")?.showModal());
    if(typeof ResizeObserver!=="undefined")new ResizeObserver(()=>{if(seq)applyZoom();}).observe(viewport);
  }

  const input = (key,label,type,value,min,max,step) => `<label>${label}<input id="se-${key}" data-setting="${key}" type="${type}" value="${value}" ${min!==undefined?`min="${min}" max="${max}" step="${step}"`:""}></label>`;
  function setup(sequence,structure,onSelect) {
    defaultSeq=sequence;defaultDb=structure;onDefaultSelect=onSelect;
    const copy=document.querySelector("#scene-secondary .scene-copy");
    copy.querySelector(".fact-panel").remove();
    const controls=document.createElement("div");controls.className="se-controls";
    controls.innerHTML=`
      <details open><summary>Backbone & base pairs</summary>
      <p>Backbone lines represent phosphodiester connections.</p>
      ${input("backColor","Backbone color","color",settings.backColor)}
      ${input("backWidth","Backbone thickness","number",2,0,10,.5)}
      ${input("backOpacity","Backbone opacity (0–1)","number",.8,0,1,.05)}
      ${input("pairColor","Base-pair color","color",settings.pairColor)}
      ${input("pairWidth","Base-pair thickness","number",2,0,10,.5)}
      ${input("pairOpacity","Base-pair opacity (0–1)","number",1,0,1,.05)}
      <label>Base-pair display<select id="se-mode" data-setting="mode">
        <option value="uniform">Default · one line for all pairs</option>
        <option value="typed">Default · pair-specific lines</option>
        <option value="lw">Leontis–Westhof symbols</option></select></label>
      <button type="button" id="seLegendToggle" aria-pressed="true">Hide base-pair legend</button>
      </details>
      <details><summary>Nucleotide circles & letters</summary>
      ${input("circleColor","Circle outline color","color",settings.circleColor)}
      ${input("circleWidth","Circle outline thickness","number",1,0,8,.5)}
      ${input("letterColor","Font color","color",settings.letterColor)}
      ${input("letterSize","Font size","number",16,8,52,1)}
      <label>Font family<select data-setting="font"><option value="monospace">Monospace</option><option value="sans-serif">Sans serif</option><option value="serif">Serif</option><option value="Arial">Arial</option><option value="Calibri">Calibri</option><option value="Times New Roman">Times New Roman</option></select></label>
      <label>Font style<select data-setting="fontStyle"><option value="normal">Regular</option><option value="bold">Bold</option><option value="italic">Italic</option></select></label>
      </details>
      <details open><summary>Selected residue / pair</summary>
      <strong id="seSelected"></strong>
      <label>Pair indices<select id="sePairList"></select></label>
      <fieldset id="sePairEditor"><legend>Override this pair</legend>
      <label>Display<select id="seLocal-mode"><option value="inherit">Use global display</option><option value="uniform">One solid line</option><option value="typed">Pair-specific lines</option><option value="lw">Leontis–Westhof symbols</option></select></label>
      <label>Color<input type="color" id="seLocal-pairColor"></label>
      <label>Thickness<input type="number" id="seLocal-pairWidth" min="0" max="10" step=".5"></label>
      <label>Opacity (0–1)<input type="number" id="seLocal-pairOpacity" min="0" max="1" step=".05"></label>
      <label>LW annotation<select id="seLw"><option value="">Unannotated</option>
      ${["c","t"].flatMap(c=>["W","H","S"].flatMap(a=>["W","H","S"].map(b=>`<option value="${c+a+b}">${c+a+b}</option>`))).join("")}</select></label>
      <p>Edge order follows the smaller residue index first. W: Watson–Crick; H: Hoogsteen; S: sugar. c: cis; t: trans. Geometry is not inferred from dot-bracket notation.</p>
      <button id="seResetPair" type="button">Reset pair appearance</button>
      </fieldset>
      <p>Click a residue index below or in the drawing.</p><div id="seIndices" aria-label="Residue indices"></div>
      </details>
      <p class="se-disclaimer">Custom secondary input can be linked to a 3D structure in the Tertiary tab only after sequence/length validation and user confirmation that the inputs represent the same molecule. Layouts are schematic, not a folding prediction.</p>
      <a href="https://rnajournal.cshlp.org/content/7/4/499.long" target="_blank" rel="noreferrer">Leontis & Westhof (2001)</a>`;
    copy.append(controls);
    reorganizeControls(controls);
    $("secondarySequence").value=sequence;$("secondaryDotBracket").value=structure;
    const stage=document.querySelector(".secondary-stage"),root=$("secondarySvg");
    const arcStyleControl=document.createElement("div");arcStyleControl.id="seArcPairStyle";arcStyleControl.className="se-arc-style";arcStyleControl.hidden=true;
    arcStyleControl.innerHTML='<span>Pair shape</span><button type="button" data-arc-style="arc" class="active" aria-pressed="true">Arc</button><button type="button" data-arc-style="square" aria-pressed="false">Square</button>';
    stage.querySelector(".secondary-layout-picker").insertAdjacentElement("afterend",arcStyleControl);
    arcStyleControl.querySelectorAll("[data-arc-style]").forEach(button=>button.addEventListener("click",()=>{
      arcPairStyle=button.dataset.arcStyle;
      arcStyleControl.querySelectorAll("[data-arc-style]").forEach(b=>{b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));});
      render();
    }));
    const viewport=document.createElement("div");viewport.className="se-viewport";root.before(viewport);viewport.append(root);
    const legend=document.createElement("div");legend.id="seLegend";legend.setAttribute("aria-label","Base-pair legend");stage.append(legend);
    setupToolbar(viewport,stage);
    installNodeDragging(root);
    const fileTools=document.createElement("div");fileTools.className="secondary-file-tools";
    fileTools.innerHTML='<label class="secondary-action">Import DBN / CT<input id="seStructureImport" type="file" accept=".dbn,.ct,.txt,text/plain" hidden></label><button class="secondary-action" id="seClearAutosave" type="button">Clear local autosave</button>';
    document.querySelector(".secondary-workspace-actions")?.insertAdjacentElement("afterend",fileTools);
    const exportDialog=document.createElement("dialog");exportDialog.id="seExportDialog";exportDialog.className="se-export-dialog";
    exportDialog.innerHTML='<button type="button" class="dialog-close" id="seExportClose" aria-label="Close">×</button><h3>Export Secondary Structure</h3><label>Export type<select id="seExportType"><option value="image">Image</option><option value="structure">Structure</option></select></label><div id="seImageExportOptions"><label>Format<select id="seImageFormat"><option value="png">PNG</option><option value="svg">SVG</option><option value="pdf">PDF</option></select></label><label>Resolution / scale<input id="seImageScale" type="range" min="1" max="6" step=".5" value="2"><output id="seImageScaleValue">2×</output></label><label>DPI target<select id="seImageDpi"><option value="96">96</option><option value="150">150</option><option value="300" selected>300</option><option value="600">600</option></select></label><label>Background<select id="seImageBackground"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#0b1220">Dark</option></select></label></div><div id="seStructureExportOptions" hidden><label>Format<select id="seStructureFormat"><option value="dbn">DBN</option><option value="ct">CT</option></select></label></div><button type="button" class="primary-action" id="seExportNow">Export</button><p id="seExportDialogStatus" role="status"></p>';
    document.body.append(exportDialog);
    $("seExportClose").addEventListener("click",()=>exportDialog.close());
    $("seExportType").addEventListener("change",e=>{$("seImageExportOptions").hidden=e.target.value!=="image";$("seStructureExportOptions").hidden=e.target.value!=="structure";});
    $("seImageScale").addEventListener("input",e=>$("seImageScaleValue").textContent=e.target.value+"×");
    $("seExportNow").addEventListener("click",async()=>{
      const out=$("seExportDialogStatus");out.textContent="Preparing export…";
      try{
        if($("seExportType").value==="structure"){
          const fmt=$("seStructureFormat").value;
          ExportTools.downloadText(fmt==="ct"?serializeCt():serializeDbn(),"rna-secondary."+(fmt==="ct"?"ct":"dbn"),"text/plain;charset=utf-8");
          out.textContent=(fmt==="ct"?"CT":"DBN")+" structure exported.";
        }else{
          const fmt=$("seImageFormat").value,dpi=Number($("seImageDpi").value)||96,scale=(Number($("seImageScale").value)||1)*(dpi/96),bg=$("seImageBackground").value;
          const result=await ExportTools.exportSvgElement(root,{format:fmt,filename:"rna-secondary-"+layout,scale,background:bg,viewBox:root.dataset.fullViewBox});
          out.textContent=fmt.toUpperCase()+" image exported"+(result?.width?" · "+result.width+" × "+result.height:"")+".";
        }
      }catch(error){out.textContent="Export failed: "+error.message;}
    });
    $("seStructureImport").addEventListener("change",async e=>{
      const file=e.target.files[0];if(!file)return;
      try{
        const text=await file.text(),parsed=file.name.toLowerCase().endsWith(".ct")?parseCtText(text):parseDbnText(text);
        setSourceNote("");$("secondarySequence").value=parsed.sequence;$("secondaryDotBracket").value=parsed.structure;load(parsed.sequence,parsed.structure);status("Imported "+file.name+" · "+parsed.sequence.length+" residues.");
      }catch(error){status("Import failed: "+error.message,true);}
      e.target.value="";
    });
    $("seClearAutosave").addEventListener("click",()=>{try{localStorage.removeItem(WORKSPACE_KEY);}catch(_){}status("Local workspace autosave cleared.");});
    const status=(message,error=false)=>{$("secondaryInputStatus").textContent=message;$("secondaryInputStatus").classList.toggle("error",error);};
    $("renderSecondaryButton").addEventListener("click",()=>{
      try {
        setSourceNote("");
        load($("secondarySequence").value.toUpperCase().replace(/\s/g,""),$("secondaryDotBracket").value.replace(/\s/g,""));
        status(`${seq.length} residues · ${pairs.length} base pairs rendered.`);
      } catch(error){status(error.message,true);}
    });
    $("restoreTrnaButton").addEventListener("click",()=>{
      $("secondarySequence").value=defaultSeq;$("secondaryDotBracket").value=defaultDb;
      setSourceNote("");selectedResidues=new Set();selectedPairKeys=new Set();
      overrides={};annotations={};residueOverrides={};backboneOverrides={};metadata={};heatEnabled=false;metadataTicket++;pairProbabilities={};pairProbEnabled=false;pairProbTicket++;pairChemistry={};manualOffsets={};pinnedResidues=new Set();zoom=1;$("seMetadataFile").value="";$("seMetadataStatus").textContent="Upload metadata for the current sequence.";if($("sePairProbFile"))$("sePairProbFile").value="";load(defaultSeq,defaultDb);status("Default tRNA restored; pair overrides, probability data, chemistry drawings, and annotations cleared.");
    });
    document.querySelectorAll("[data-secondary-layout]").forEach(button=>button.addEventListener("click",()=>{
      layout=button.dataset.secondaryLayout;
      document.querySelectorAll("[data-secondary-layout]").forEach(b=>{
        b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));
      });
      if($("seArcPairStyle"))$("seArcPairStyle").hidden=layout!=="arc";
      zoom=1;panX=panY=0;render();
    }));
    controls.querySelectorAll("[data-setting]").forEach(el=>el.addEventListener("input",()=>{
      if(el.type==="number"&&!el.checkValidity())return;
      settings[el.dataset.setting]=el.type==="number"?Number(el.value):el.value;
      if(el.dataset.setting==="fillColor")heatEnabled=false;
      panel();render();
    }));
    $("seLegendToggle").addEventListener("click",()=>{
      settings.legend=!settings.legend;
      $("seLegendToggle").textContent=settings.legend?"Hide base-pair legend":"Show base-pair legend";
      $("seLegendToggle").setAttribute("aria-pressed",String(settings.legend));renderLegend();
    });
    $("sePairList").addEventListener("change",e=>{if(e.target.value)select(Number(e.target.value.split(":")[0]));});
    ["pairColor","pairWidth","pairOpacity","mode"].forEach(k=>$("seLocal-"+k).addEventListener("input",e=>{
      const key=activeKey();if(!key||!e.target.checkValidity())return;
      overrides[key]??={};
      if(e.target.value==="inherit")delete overrides[key][k];
      else overrides[key][k]=e.target.type==="number"?Number(e.target.value):e.target.value;
      render();
    }));
    $("seLw").addEventListener("change",e=>{
      const key=activeKey();if(!key)return;
      if(e.target.value){annotations[key]=e.target.value;overrides[key]={...overrides[key],mode:"lw"};}
      else delete annotations[key];
      panel();render();
    });
    $("seResetPair").addEventListener("click",()=>{delete overrides[activeKey()];panel();render();});
    load(sequence,structure);
    if(restoreWorkspaceLocal()){panel();render();broadcastContext();}
  }
  return {setup,render,parse,parseMetadata,parsePairProbabilities,radial,orientEndsBottom,parseDbnText,parseCtText,serializeDbn,serializeCt,
    getCurrentPositions(){return coordinates().map(p=>({x:p.x,y:p.y}));},
    getWorkspaceSnapshot(){return workspaceSnapshot();},
    loadDerived(sequence,structure,meta={}){
      const cleanSeq=String(sequence||"").toUpperCase().replace(/\s/g,""),cleanDb=String(structure||"").replace(/\s/g,"");
      parse(cleanSeq,cleanDb);
      $("secondarySequence").value=cleanSeq;$("secondaryDotBracket").value=cleanDb;
      load(cleanSeq,cleanDb);
      const source=String(meta.source||"3D coordinates"),pairsDetected=Number(meta.pairCount);
      setSourceNote("Derived from 3D coordinates · "+source+(Number.isFinite(pairsDetected)?" · "+pairsDetected+" base pairs":"")+". Browser geometry inference; verify with a dedicated annotation tool for publication-grade assignments.");
      const status=$("secondaryInputStatus");if(status){status.textContent=cleanSeq.length+" residues · "+pairs.length+" derived base pairs rendered.";status.classList.remove("error");}
      saveWorkspaceLocal();return {sequence:seq,structure:db,isDefault:false,selected,selectedPairKey,selectedResidues:[...selectedResidues],selectedPairKeys:[...selectedPairKeys],sourceNote};
    },
    followDefault(index){if(index>=0&&index<seq.length){selected=index;panel();render();}},
    followExternal(index,selectedState){if(index>=0&&index<seq.length){selected=index;if(selectedState===true)selectedResidues.add(index);else if(selectedState===false)selectedResidues.delete(index);panel();render();}},
    followPairExternal(a,b,selectedState){const key=keyOf(a,b);if(selectedState===true){selectedPairKeys.add(key);selectedPairKey=key;}else if(selectedState===false){selectedPairKeys.delete(key);if(selectedPairKey===key)selectedPairKey=[...selectedPairKeys].at(-1)||null;}selected=a;panel();render();},
    getContext(){return {sequence:seq,structure:db,isDefault:seq===defaultSeq&&db===defaultDb,selected,selectedPairKey,selectedResidues:[...selectedResidues],selectedPairKeys:[...selectedPairKeys],sourceNote};}
  };
})();
