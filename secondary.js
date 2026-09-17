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
  let seq="", db="", defaultSeq="", defaultDb="", pairs=[], partner=[], selected=0;
  let layout="radial", overrides={}, annotations={}, onDefaultSelect=()=>{};
  let residueOverrides={}, backboneOverrides={}, selectedBackbone=0, zoom=1;
  let metadata={}, heatEnabled=false, heatTheme="viridis", heatRange=[0,1], metadataTicket=0;
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
    if(!rows.length||rows[0].join(",")!=="Residue_Index,Residue_ID,Residue_Information")throw Error("CSV headers must be Residue_Index,Residue_ID,Residue_Information, in that order.");
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
  function radial(n, p) {
    const out=Array(n), step=32, width=70;
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
      } else {out[i]={x:cursor,y:step};cursor+=step;}
    }
    return out;
  }
  function coordinates() {
    const n=seq.length;
    if(layout==="radial") return radial(n,partner);
    if(layout==="arc") return Array.from({length:n},(_,i)=>({x:i*56,y:0}));
    const r=Math.max(60,n*36/(2*Math.PI));
    return Array.from({length:n},(_,i)=>{
      const angle=-Math.PI/2+i*(2*Math.PI-0.18)/Math.max(1,n-1);
      return {x:r*Math.cos(angle),y:r*Math.sin(angle)};
    });
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
    const g=svg("g",{"data-pair":key,class:"se-pair",opacity:s.pairOpacity});
    const code=annotations[key];
    const identity=seq[a]+seq[b];
    const count=s.mode==="typed"?(/GC|CG/.test(identity)?3:/AU|UA/.test(identity)?2:1):1;
    const dashed=s.mode==="typed"&&!/GC|CG|AU|UA|GU|UG/.test(identity) || s.mode==="lw"&&!code;
    const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
    const normal={x:-dy/len,y:dx/len},trim=Math.min(17,len/4);
    const start={x:p.x+dx/len*trim,y:p.y+dy/len*trim},end={x:q.x-dx/len*trim,y:q.y-dy/len*trim};
    const arch=layout==="arc"&&!preview;
    let path="";
    for(let k=0;k<count;k++){
      const offset=(k-(count-1)/2)*5;
      path=arch
        ?`M ${p.x} ${p.y-17-offset} Q ${(p.x+q.x)/2} ${p.y-Math.abs(dx)-offset*2} ${q.x} ${q.y-17-offset}`
        :`M ${start.x+normal.x*offset} ${start.y+normal.y*offset} L ${end.x+normal.x*offset} ${end.y+normal.y*offset}`;
      g.append(svg("path",{d:path,fill:"none",stroke:s.pairColor,"stroke-width":s.pairWidth,
        "stroke-dasharray":dashed?"5 5":"none","stroke-linecap":"round"}));
    }
    if(s.mode==="lw"&&code) {
      const midpoint={x:(p.x+q.x)/2,y:arch?p.y-Math.abs(dx)/2-8.5:(p.y+q.y)/2};
      if(code[1]===code[2]) symbol(g,code[1],midpoint.x,midpoint.y,code[0],s.pairColor);
      else {
        symbol(g,code[1],midpoint.x-dx/len*10,midpoint.y-dy/len*10,code[0],s.pairColor);
        symbol(g,code[2],midpoint.x+dx/len*10,midpoint.y+dy/len*10,code[0],s.pairColor);
      }
    }
    if(!preview) {
      const hit=svg("path",{d:path,fill:"none",stroke:"transparent","stroke-width":18,"pointer-events":"stroke"});
      g.append(hit);
      g.setAttribute("tabindex","0");g.setAttribute("role","button");
      g.setAttribute("aria-label",`Base pair ${a+1}–${b+1}${code?", "+code:""}`);
      const choose=()=>select(a);
      g.addEventListener("click",choose);
      g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
    }
    parent.append(g);
  }
  function select(index,notify=true) {
    selected=index;selectedBackbone=Math.min(index,Math.max(0,seq.length-2));panel();render();
    if(notify&&seq===defaultSeq&&db===defaultDb) onDefaultSelect(index);
  }
  function panel() {
    extendedPanel();
    const other=partner[selected],key=activeKey();
    $("seSelected").textContent=other<0?`${seq[selected]}${selected+1} · unpaired`:`${seq[selected]}${selected+1} — ${seq[other]}${other+1}`;
    $("sePairEditor").disabled=!key;
    $("sePairList").value=key||"";
    $("seLw").value=annotations[key]||"";
    const s=effective(key);
    ["pairColor","pairWidth","pairOpacity"].forEach(k=>$("seLocal-"+k).value=s[k]);
    $("seLocal-mode").value=overrides[key]?.mode||"inherit";
    document.querySelectorAll("[data-residue-index]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.residueIndex===selected)));
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
    root.setAttribute("viewBox",`${minX} ${minY} ${Math.max(150,maxX-minX)} ${Math.max(150,maxY-minY)}`);
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
      const g=svg("g",{transform:`translate(${p.x} ${p.y})`,class:"se-node",tabindex:0,role:"button","aria-label":`${seq[i]}${i+1}, ${partner[i]<0?"unpaired":"paired with "+(partner[i]+1)}`});
      if(i===selected || i===partner[selected]) g.append(svg("circle",{"data-export-remove":"",r:20,fill:"none",stroke:"#ffffff","stroke-width":1.5,"stroke-dasharray":i===selected?"none":"3 3"}));
      g.append(svg("circle",{r:16,fill:s.fillColor,stroke:s.circleColor,"stroke-width":s.circleWidth}));
      text(g,seq[i],{y:0,fill:s.letterColor,"font-family":s.font,"font-size":s.letterSize,"font-style":s.fontStyle==="italic"?"italic":"normal","font-weight":s.fontStyle==="bold"?"700":"400","text-anchor":"middle","dominant-baseline":"central"});
      const prev=pos[Math.max(0,i-1)],next=pos[Math.min(pos.length-1,i+1)];
      const away=partner[i]>=0?{x:p.x-pos[partner[i]].x,y:p.y-pos[partner[i]].y}
        :{x:-(next.y-prev.y),y:next.x-prev.x};
      const norm=Math.hypot(away.x,away.y)||1;
      const number=text(g,String(i+1),{x:away.x/norm*28,y:away.y/norm*28+3,fill:"#bacbd7","font-size":10,"font-family":"monospace","text-anchor":"middle"});
      number.setAttribute("class","se-index");
      const title=svg("title");title.textContent=`${seq[i]}${i+1}`+(metadata[i]?` · ${metadata[i].id} · ${metadata[i].value??"No value"}`:"");g.append(title);
      g.addEventListener("click",()=>select(i));
      g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(i);}});
      root.append(g);
    });
    text(root,"5′",{x:pos[0].x-30,y:pos[0].y,fill:"#74d7b6","font-size":16,"text-anchor":"end"});
    text(root,"3′",{x:pos.at(-1).x+30,y:pos.at(-1).y,fill:"#74d7b6","font-size":16});
    $("secondaryStageNote").textContent=`${layout[0].toUpperCase()+layout.slice(1)} · ${seq.length} residues · ${pairs.length} pairs · Select a residue index or pair`;
    renderLegend();renderHeatLegend();
  }
  function load(sequence,structure) {
    const parsed=parse(sequence,structure);
    const changed=sequence!==seq||structure!==db;
    seq=sequence;db=structure;pairs=parsed.pairs;partner=parsed.partner;selected=0;
    if(changed){overrides={};annotations={};residueOverrides={};backboneOverrides={};metadata={};heatEnabled=false;metadataTicket++;zoom=1;
      if($("seMetadataFile"))$("seMetadataFile").value="";
      if($("seMetadataStatus"))$("seMetadataStatus").textContent="Upload metadata for the current sequence.";
    }
    selectedBackbone=0;
    $("seBackList").replaceChildren();
    for(let i=0;i<seq.length-1;i++)$("seBackList").append(new Option(`${i+1}–${i+2}`,String(i)));
    $("sePairList").replaceChildren(new Option("Select a pair by residue indices",""));
    pairs.forEach(([a,b])=>$("sePairList").append(new Option(`${a+1}–${b+1}  (${seq[a]}–${seq[b]})`,keyOf(a,b))));
    $("seIndices").replaceChildren();
    [...seq].forEach((base,i)=>{
      const button=document.createElement("button");button.type="button";
      button.dataset.residueIndex=i;button.textContent=`${base}${i+1}`;
      button.addEventListener("click",()=>select(i));$("seIndices").append(button);
    });
    panel();render();
  }

  const residueFields=[
    ["fillColor","Circle fill","color"],["circleColor","Circle outline color","color"],
    ["circleWidth","Circle outline thickness","number",0,8,.5],
    ["letterColor","Letter color","color"],["letterSize","Letter size","number",8,26,1],
    ["font","Font family","select",["monospace","sans-serif","serif"]],
    ["fontStyle","Font style","select",["normal","bold","italic"]]
  ];
  const backFields=[["backColor","Backbone color","color"],["backWidth","Backbone thickness","number",0,10,.5],["backOpacity","Backbone opacity (0–1)","number",0,1,.05]];
  function localFields(fields,prefix){
    return fields.map(([k,label,type,min,max,step])=>'<label>'+label+(type==="select"
      ?'<select id="'+prefix+k+'">'+min.map(v=>'<option value="'+v+'">'+v+'</option>').join("")+'</select>'
      :'<input id="'+prefix+k+'" type="'+type+'" '+(type==="number"?'min="'+min+'" max="'+max+'" step="'+step+'"':'')+'>')+'</label>').join("");
  }
  function reorganizeControls(controls){
    const old=[...controls.children].filter(el=>el.tagName==="DETAILS");
    function group(name){
      const el=document.createElement("details");el.open=name==="Residues";
      el.innerHTML='<summary>'+name+'</summary><details open><summary>Selected</summary></details><details><summary>All</summary></details>';
      controls.insertBefore(el,old[0]);return [el.children[1],el.children[2]];
    }
    const [bs,ba]=group("Backbone"),[rs,ra]=group("Residues"),[ps,pa]=group("Base pairs");
    backFields.forEach(([k])=>ba.append($("se-"+k).closest("label")));
    ba.insertAdjacentHTML("afterbegin","<p>Phosphodiester connections between consecutive residues.</p>");
    bs.innerHTML+='<label>Connection indices<select id="seBackList"></select></label><fieldset id="seBackEditor"><legend>Selected connection</legend>'+localFields(backFields,"seBack-")+'<button id="seBackReset" type="button">Reset selected connection</button></fieldset>';
    ["pairColor","pairWidth","pairOpacity","mode"].forEach(k=>pa.append($("se-"+k).closest("label")));
    pa.append($("seLegendToggle"));
    const fill=document.createElement("div");fill.innerHTML=input("fillColor","All circle fills (replaces heatmap)","color","#2f6b57");
    ra.append(fill.firstElementChild);
    [...old[1].children].filter(el=>el.tagName!=="SUMMARY").forEach(el=>ra.append(el));
    rs.innerHTML+='<strong id="seResidueSelected"></strong><p id="seResidueMetadata"></p>'+localFields(residueFields,"seResidue-")+'<button id="seResidueReset" type="button">Reset selected residue</button>';
    rs.append($("seIndices"));
    const instructions=document.createElement("p");instructions.textContent="Select a residue in the drawing or by its index below. Selected styles override All styles.";
    rs.insertBefore(instructions,$("seIndices"));
    ps.append($("seSelected"),$("sePairList").closest("label"),$("sePairEditor"));
    ra.insertAdjacentHTML("beforeend",'<button id="seNaturalColors" type="button">Restore A/G/C/U fill colors</button><fieldset><legend>CSV heatmap</legend><p>Headers: Residue_Index, Residue_ID, Residue_Information. Indices start at 1. Numeric values are mapped linearly; blank or NA values keep the standard nucleotide color. Upload applies the heatmap and resets other colors to defaults; you can edit them afterward.</p><label>Metadata CSV<input id="seMetadataFile" type="file" accept=".csv,text/csv"></label><label>Heatmap theme<select id="seHeatTheme"><option value="viridis">Viridis</option><option value="magma">Magma</option><option value="blueRed">Blue–white–red</option><option value="cividis">Cividis</option></select></label><label><input type="checkbox" id="seHeatEnabled">Use metadata colors</label><button id="seClearMetadata" type="button">Clear metadata</button><p id="seMetadataStatus" role="status">Upload metadata for the current sequence.</p></fieldset>');
    old.forEach(el=>el.remove());
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
      delete settings.fillColor;heatEnabled=false;Object.values(residueOverrides).forEach(o=>delete o.fillColor);panel();render();
    });
    $("seHeatTheme").addEventListener("change",e=>{heatTheme=e.target.value;panel();render();});
    $("seHeatEnabled").addEventListener("change",e=>{
      heatEnabled=e.target.checked&&Object.keys(metadata).length>0;
      if(e.target.checked&&!heatEnabled)$("seMetadataStatus").textContent="Upload a CSV with numeric values first.";
      panel();render();
    });
    $("seClearMetadata").addEventListener("click",()=>{
      metadataTicket++;metadata={};heatEnabled=false;$("seMetadataFile").value="";
      $("seMetadataStatus").textContent="Metadata cleared.";panel();render();
    });
    $("seMetadataFile").addEventListener("change",async e=>{
      const file=e.target.files[0];if(!file)return;
      const ticket=++metadataTicket;
      try{
        if(file.size>2*1024*1024)throw Error("CSV must be smaller than 2 MB.");
        const csv=await file.text();if(ticket!==metadataTicket)return;
        const data=parseMetadata(csv,seq.length);
        const values=Object.values(data).map(r=>r.value).filter(v=>v!==null);
        metadata=data;heatRange=[Math.min(...values),Math.max(...values)];heatEnabled=true;
        delete settings.fillColor;
        ["backColor","pairColor","circleColor","letterColor"].forEach(k=>settings[k]=defaults[k]);
        Object.values(overrides).forEach(o=>delete o.pairColor);
        Object.values(backboneOverrides).forEach(o=>delete o.backColor);
        Object.values(residueOverrides).forEach(o=>["fillColor","circleColor","letterColor"].forEach(k=>delete o[k]));
        controls.querySelectorAll("[data-setting]").forEach(el=>{if(settings[el.dataset.setting]!==undefined)el.value=settings[el.dataset.setting];});
        $("seMetadataStatus").textContent=values.length+" numeric values loaded; "+(seq.length-values.length)+" residues without values. Manual edits now override the heatmap.";
        panel();render();
      }catch(error){if(ticket===metadataTicket)$("seMetadataStatus").textContent=error.message;}
    });
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
  }
  function renderHeatLegend(){
    const box=$("seHeatLegend");if(!box)return;
    box.hidden=!heatEnabled;box.replaceChildren();if(!heatEnabled)return;
    const title=document.createElement("strong");title.textContent="Residue information · "+heatTheme;
    const bar=document.createElement("div");bar.className="se-heat-bar";bar.style.background="linear-gradient(to right,"+palettes[heatTheme].join(",")+")";
    const label=document.createElement("p");label.textContent=heatRange[0]+" → "+heatRange[1]+" · Linear scale. Missing values use nucleotide colors. Manual overrides take priority.";
    box.append(title,bar,label);
  }
  function applyZoom(){
    const root=$("secondarySvg"),v=root.getAttribute("viewBox").split(/\s+/).map(Number);
    const viewport=root.parentElement,fitWidth=Math.max(280,viewport.clientWidth||700);
    const fit=Math.min(fitWidth/v[2],560/v[3]);
    root.style.width=(v[2]*fit*zoom)+"px";root.style.height=(v[3]*fit*zoom)+"px";
    root.style.minWidth="0";root.style.minHeight="0";root.style.maxWidth="none";root.style.flexShrink="0";
    if($("seZoomValue"))$("seZoomValue").textContent=Math.round(zoom*100)+"%";
    if($("seZoomOut"))$("seZoomOut").disabled=zoom<=.25;
    if($("seZoomIn"))$("seZoomIn").disabled=zoom>=8;
  }
  async function exportPng(){
    const button=$("seDownload"),status=$("seExportStatus");button.disabled=true;status.textContent="Preparing transparent PNG…";
    try{
      const source=$("secondarySvg"),clone=source.cloneNode(true);
      const [, ,w,h]=source.getAttribute("viewBox").split(/\s+/).map(Number);
      // Use explicit presentation attributes, not page CSS. Export the full drawing.
      clone.removeAttribute("style");clone.setAttribute("xmlns",NS);
      const scale=Math.min(2,8192/w,8192/h,Math.sqrt(16000000/(w*h)));
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
    toolbar.innerHTML='<button id="seZoomOut" type="button" aria-label="Zoom out">−</button><output id="seZoomValue" aria-live="polite">100%</output><button id="seZoomIn" type="button" aria-label="Zoom in">+</button><button id="seZoomReset" type="button">Reset view</button><button id="seDownload" type="button">Download PNG</button>';
    viewport.before(toolbar);
    const message=document.createElement("p");message.id="seExportStatus";message.setAttribute("role","status");message.className="se-export-status";viewport.after(message);
    const legend=document.createElement("div");legend.id="seHeatLegend";legend.hidden=true;stage.append(legend);
    function changeZoom(factor){zoom=Math.max(.25,Math.min(8,zoom*factor));applyZoom();}
    $("seZoomIn").addEventListener("click",()=>changeZoom(1.25));
    $("seZoomOut").addEventListener("click",()=>changeZoom(.8));
    $("seZoomReset").addEventListener("click",()=>{zoom=1;applyZoom();viewport.scrollTop=0;viewport.scrollLeft=0;});
    $("seDownload").addEventListener("click",exportPng);
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
      ${input("letterColor","Letter color","color",settings.letterColor)}
      ${input("letterSize","Letter size","number",16,8,26,1)}
      <label>Font family<select data-setting="font"><option value="monospace">Monospace</option><option value="sans-serif">Sans serif</option><option value="serif">Serif</option></select></label>
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
      <p class="se-disclaimer">Custom input changes this secondary view only. Primary and tertiary remain the original tRNA. Layouts are schematic, not a folding prediction.</p>
      <a href="https://rnajournal.cshlp.org/content/7/4/499.long" target="_blank" rel="noreferrer">Leontis & Westhof (2001)</a>`;
    copy.append(controls);
    reorganizeControls(controls);
    $("secondarySequence").value=sequence;$("secondaryDotBracket").value=structure;
    const stage=document.querySelector(".secondary-stage"),root=$("secondarySvg");
    const viewport=document.createElement("div");viewport.className="se-viewport";root.before(viewport);viewport.append(root);
    const legend=document.createElement("div");legend.id="seLegend";legend.setAttribute("aria-label","Base-pair legend");stage.append(legend);
    setupToolbar(viewport,stage);
    const status=(message,error=false)=>{$("secondaryInputStatus").textContent=message;$("secondaryInputStatus").classList.toggle("error",error);};
    $("renderSecondaryButton").addEventListener("click",()=>{
      try {
        load($("secondarySequence").value.toUpperCase().replace(/\s/g,""),$("secondaryDotBracket").value.replace(/\s/g,""));
        status(`${seq.length} residues · ${pairs.length} base pairs rendered.`);
      } catch(error){status(error.message,true);}
    });
    $("restoreTrnaButton").addEventListener("click",()=>{
      $("secondarySequence").value=defaultSeq;$("secondaryDotBracket").value=defaultDb;
      overrides={};annotations={};residueOverrides={};backboneOverrides={};metadata={};heatEnabled=false;metadataTicket++;zoom=1;$("seMetadataFile").value="";$("seMetadataStatus").textContent="Upload metadata for the current sequence.";load(defaultSeq,defaultDb);status("Default tRNA restored; pair overrides and annotations cleared.");
    });
    document.querySelectorAll("[data-secondary-layout]").forEach(button=>button.addEventListener("click",()=>{
      layout=button.dataset.secondaryLayout;
      document.querySelectorAll("[data-secondary-layout]").forEach(b=>{
        b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));
      });zoom=1;render();
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
  }
  return {setup,render,parse,parseMetadata,radial,followDefault(index){
    if(seq===defaultSeq&&db===defaultDb&&selected!==index)select(index,false);
  }};
})();
