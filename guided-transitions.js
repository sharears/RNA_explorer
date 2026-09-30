const GuidedStructureTransitions = (() => {
  const state={
    miniFeature:"glycosidic",realPairKey:"gc",realPairModels:null,realPairPromise:null,
    yaw:-0.55,pitch:0.34,zoom:1,panX:0,panY:0,dragging:false,dragMode:"rotate",lastX:0,lastY:0,
    showLabels:true,secondaryCopyOriginal:null,tertiaryCopyOriginal:null
  };

  const PAIR_LESSONS={
    au:{
      title:"A–U Watson–Crick–Franklin pair",
      copy:"Adenine and uracil can align their canonical pairing edges and form two hydrogen bonds.",
      bonds:[["A N6–H","U O4"],["U N3–H","A N1"]],
      left:{name:"Adenine",kind:"purine",labels:[["N6–H",84,49],["N1",111,111]],sugar:[50,151]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["O4",336,49],["N3–H",307,111]],sugar:[370,151]}
    },
    gc:{
      title:"G–C Watson–Crick–Franklin pair",
      copy:"Guanine and cytosine form a canonical pair with three hydrogen bonds.",
      bonds:[["C N4–H","G O6"],["G N1–H","C N3"],["G N2–H","C O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",86,38],["N1–H",112,89],["N2–H",104,137]],sugar:[48,161]},
      right:{name:"Cytosine",kind:"pyrimidine",labels:[["N4–H",336,38],["N3",307,89],["O2",314,137]],sugar:[372,161]}
    },
    gu:{
      title:"G–U wobble pair",
      copy:"Guanine and uracil can form the common G–U wobble geometry found throughout structured RNA.",
      bonds:[["U N3–H","G O6"],["G N1–H","U O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",88,54],["N1–H",113,116]],sugar:[50,158]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["N3–H",306,54],["O2",314,116]],sugar:[370,158]}
    }
  };

  const MINI_LESSONS={
    glycosidic:{
      title:"Glycosidic torsion χ",
      definition:"χ describes how the nucleobase is oriented relative to ribose around the glycosidic bond.",
      notice:"Follow the four defining atoms and the central C1′–N bond. Rotating about this connection changes the base orientation.",
      points:[
        {id:"O4′",x:-1.8,y:.1,z:.2,element:"O"},{id:"C1′",x:-.7,y:0,z:.4,element:"C"},
        {id:"N9",x:.55,y:.15,z:-.25,element:"N"},{id:"C4",x:1.7,y:.7,z:.15,element:"C"},
        {id:"C2′",x:-1.1,y:-1,z:-.2,element:"C"},{id:"C8",x:1.2,y:-.55,z:.35,element:"C"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C1′","N9"],["N9","C4"],["N9","C8"],["C4","C8"]],
      guide:[["C1′","N9"]]
    },
    pucker:{
      title:"Sugar pucker",
      definition:"The five-membered ribose ring is not flat. Sugar pucker describes its three-dimensional ring shape.",
      notice:"Rotate the ribose edge-on. C3′-endo and C2′-endo are important pucker families in RNA.",
      points:[
        {id:"O4′",x:-1.25,y:.75,z:0,element:"O"},{id:"C1′",x:.2,y:1.15,z:.38,element:"C"},
        {id:"C2′",x:1.25,y:.15,z:-.46,element:"C"},{id:"C3′",x:.65,y:-1.1,z:.52,element:"C"},
        {id:"C4′",x:-.9,y:-.85,z:-.12,element:"C"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C2′","C3′"],["C3′","C4′"],["C4′","O4′"]],guide:[]
    },
    backbone:{
      title:"Backbone torsions α–ζ",
      definition:"Six torsion angles—α, β, γ, δ, ε and ζ—describe rotations along the phosphodiester backbone.",
      notice:"A torsion is defined by four atoms. In the full RNA you can choose α–ζ individually and highlight its defining atoms.",
      points:[
        {id:"O3′(i−1)",x:-2.1,y:-.4,z:.25,element:"O"},{id:"P",x:-.8,y:.35,z:-.3,element:"P"},
        {id:"O5′",x:.35,y:-.25,z:.4,element:"O"},{id:"C5′",x:1.5,y:.45,z:-.35,element:"C"},
        {id:"C4′",x:2.3,y:-.35,z:.2,element:"C"}
      ],
      bonds:[["O3′(i−1)","P"],["P","O5′"],["O5′","C5′"],["C5′","C4′"]],guide:[["P","O5′"]]
    },
    stacking:{
      title:"Base stacking",
      definition:"Base stacking is the close, approximately parallel packing of neighboring nucleobases.",
      notice:"Rotate the model and look at the overlap between the two base planes. This is face-to-face rather than edge-to-edge.",
      generator:"stacking"
    },
    basepair:{
      title:"Base pairing & hydrogen bonds",
      definition:"A base pair is an atom-by-atom interaction between nucleotides whose base edges face one another.",
      notice:"Use the G–C, A–U and G–U buttons. The yellow dotted connectors represent the teaching hydrogen bonds.",
      generator:"realpair"
    },
    helix:{
      title:"RNA helix",
      definition:"An RNA helix combines repeated base pairing with stacking as two strands wind around a common axis.",
      notice:"Follow the two strands as you rotate the model and look for repeated cross-strand pairing.",
      generator:"helix"
    },
    loopjunction:{
      title:"Loops & junctions",
      definition:"Loops redirect or expose the RNA chain; junctions connect multiple helical segments.",
      notice:"These regions organize how stems connect in three-dimensional space.",
      generator:"junction"
    },
    tertiarycontact:{
      title:"Tertiary contacts",
      definition:"Residues that are far apart in sequence can approach one another after RNA folds in three dimensions.",
      notice:"Sequence distance and spatial distance are different. The dotted connector marks a long-range contact.",
      generator:"contact"
    }
  };

  const ELEMENT_COLORS={C:"#33cc66",O:"#ff3b30",N:"#2f6bff",H:"#ffffff",P:"#ff9f0a",S:"#ffd60a"};
  const COVALENT_RADII={C:.76,N:.71,O:.66,H:.31,P:1.07,S:1.05};
  const REAL_PAIR_DEFS={
    gc:{label:"G–C Watson–Crick–Franklin",residues:[["G",1,"G1"],["C",72,"C72"]],hbonds:[["C72","N4","G1","O6"],["G1","N1","C72","N3"],["G1","N2","C72","O2"]]},
    au:{label:"A–U Watson–Crick–Franklin",residues:[["A",5,"A5"],["U",68,"U68"]],hbonds:[["A5","N6","U68","O4"],["U68","N3","A5","N1"]]},
    gu:{label:"G–U wobble",residues:[["G",4,"G4"],["U",69,"U69"]],hbonds:[["U69","N3","G4","O6"],["G4","N1","U69","O2"]]}
  };

  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const isJourney=()=>document.body.dataset.pageMode==="journey";
  const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

  function pairDiagram(key){
    const l=PAIR_LESSONS[key]||PAIR_LESSONS.au;
    const poly=(cx,cy,r,n,rot)=>Array.from({length:n},(_,i)=>{const a=rot+i*Math.PI*2/n;return (cx+Math.cos(a)*r).toFixed(1)+","+(cy+Math.sin(a)*r).toFixed(1);}).join(" ");
    const hbonds=l.bonds.map((_,i)=>{
      const y=key==="gc"?48+i*42:64+i*53;
      return '<line class="gps-pair-hbond" x1="154" y1="'+y+'" x2="266" y2="'+y+'"/>';
    }).join("");
    const labels=[...l.left.labels,...l.right.labels].map(([t,x,y])=>'<text class="gps-atom-label" x="'+x+'" y="'+y+'">'+t+'</text>').join("");
    const sugar=(side,xy,ringX,ringY)=>{
      const x=xy[0],y=xy[1],anchor=side==="left"?ringX-42:ringX+42,boxX=side==="left"?x-36:x-10;
      return '<line class="gps-sugar-bond" x1="'+anchor+'" y1="'+ringY+'" x2="'+x+'" y2="'+(y-11)+'"/><rect class="gps-sugar-box" x="'+boxX+'" y="'+(y-9)+'" width="46" height="23" rx="5"/><text class="gps-sugar-label" x="'+(boxX+23)+'" y="'+(y+6)+'">Sugar</text>';
    };
    return '<svg viewBox="0 0 420 195" class="gps-pair-svg" role="img" aria-label="'+l.title+' chemical teaching diagram">'+
      '<polygon class="gps-base-ring left" points="'+poly(105,92,55,6,-Math.PI/6)+'"/>'+
      (l.left.kind==="purine"?'<polygon class="gps-base-ring left small" points="'+poly(61,93,35,5,-Math.PI/2)+'"/>':'')+
      '<polygon class="gps-base-ring right" points="'+poly(315,92,55,6,-Math.PI/6)+'"/>'+
      hbonds+labels+sugar("left",l.left.sugar,105,92)+sugar("right",l.right.sugar,315,92)+
      '<text class="gps-base-name" x="105" y="188">'+l.left.name+'</text><text class="gps-base-name" x="315" y="188">'+l.right.name+'</text></svg>';
  }

  function secondaryLessonMarkup(){
    const cards=["au","gc","gu"].map(key=>{
      const l=PAIR_LESSONS[key];
      return '<article class="gps-pair-card" data-pair-card="'+key+'"><span class="fact-label">'+(key==="gu"?"WOBBLE PAIR":"CANONICAL PAIR")+'</span><h4>'+l.title+'</h4><p>'+l.copy+'</p>'+pairDiagram(key)+'</article>';
    }).join("");
    return '<section class="guided-inline-lesson guided-secondary-lesson" id="guidedSecondaryLesson">'+
      '<div class="guided-lesson-heading"><span class="fact-label">BASE PAIRS IN THE SECONDARY STRUCTURE</span><h3>What do the pairing lines represent?</h3>'+
      '<p>In the radial secondary structure above, lines connect residues that are paired. These three examples introduce the most familiar RNA pair types.</p></div>'+
      '<div class="gps-pair-card-grid">'+cards+'</div>'+
      '<div class="guided-placeholder-note"><strong>More RNA base-pair types come later.</strong> RNA also contains many non-standard base pairs with alternative edges and orientations; this space is reserved for that expansion.</div>'+
      '</section>';
  }

  function buildSecondaryLesson(){
    const scene=$("scene-secondary");if(!scene||$("guidedSecondaryLesson"))return;
    scene.insertAdjacentHTML("beforeend",secondaryLessonMarkup());
  }

  function atomElement(atomName,raw=""){
    const e=String(raw||"").trim().toUpperCase();if(ELEMENT_COLORS[e])return e;
    const m=String(atomName||"").toUpperCase().match(/[A-Z]/);return m&&ELEMENT_COLORS[m[0]]?m[0]:"C";
  }

  function parsePdbAtoms(text){
    const out=[];
    String(text||"").split(/\r?\n/).forEach(line=>{
      if(!line.startsWith("ATOM  ")&&!line.startsWith("HETATM"))return;
      const chain=line.slice(21,22).trim(),resi=Number.parseInt(line.slice(22,26).trim(),10);
      const name=line.slice(12,16).trim(),resn=line.slice(17,20).trim().toUpperCase();
      const x=Number.parseFloat(line.slice(30,38)),y=Number.parseFloat(line.slice(38,46)),z=Number.parseFloat(line.slice(46,54));
      if(chain!=="A"||!Number.isFinite(resi)||![x,y,z].every(Number.isFinite))return;
      out.push({name,resn,resi,x,y,z,element:atomElement(name,line.slice(76,78))});
    });
    return out;
  }

  function normalizeRealPair(def,allAtoms){
    const points=[],bonds=[],guide=[],byId=new Map();
    def.residues.forEach(([resn,resi,prefix])=>{
      const atoms=allAtoms.filter(a=>a.resi===resi&&a.resn===resn);
      if(!atoms.length)throw new Error("Could not find "+resn+resi+" in the 1EHZ coordinate file.");
      atoms.forEach(a=>{
        const id=prefix+":"+a.name;
        const p={id,x:a.x,y:a.y,z:a.z,element:a.element,showLabel:true};
        points.push(p);byId.set(id,p);
      });
      for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
        const a=atoms[i],b=atoms[j],cut=(COVALENT_RADII[a.element]||.75)+(COVALENT_RADII[b.element]||.75)+.42,d=distance3(a,b);
        if(d>.45&&d<=cut)bonds.push([prefix+":"+a.name,prefix+":"+b.name]);
      }
    });
    def.hbonds.forEach(([donorPrefix,donorName,acceptPrefix,acceptName],i)=>{
      const donor=byId.get(donorPrefix+":"+donorName),accept=byId.get(acceptPrefix+":"+acceptName);
      if(!donor||!accept)return;
      const dx=accept.x-donor.x,dy=accept.y-donor.y,dz=accept.z-donor.z,len=Math.hypot(dx,dy,dz)||1;
      const id="HbondH"+i,h={id,x:donor.x+dx/len*.98,y:donor.y+dy/len*.98,z:donor.z+dz/len*.98,element:"H",showLabel:true};
      points.push(h);byId.set(id,h);bonds.push([donorPrefix+":"+donorName,id]);guide.push([id,acceptPrefix+":"+acceptName]);
    });
    const center=points.reduce((o,p)=>({x:o.x+p.x/points.length,y:o.y+p.y/points.length,z:o.z+p.z/points.length}),{x:0,y:0,z:0});
    const scale=.34;
    points.forEach(p=>{p.x=(p.x-center.x)*scale;p.y=(p.y-center.y)*scale;p.z=(p.z-center.z)*scale;});
    return {points,bonds,guide,guideType:"hbond",label:def.label,source:"PDB 1EHZ"};
  }

  async function loadRealPairModels(){
    if(state.realPairModels)return state.realPairModels;
    if(state.realPairPromise)return state.realPairPromise;
    state.realPairPromise=fetch("https://files.rcsb.org/download/1EHZ.pdb")
      .then(r=>{if(!r.ok)throw new Error("Could not load the 1EHZ teaching coordinates.");return r.text();})
      .then(text=>{
        const atoms=parsePdbAtoms(text),models={};
        Object.entries(REAL_PAIR_DEFS).forEach(([key,def])=>models[key]=normalizeRealPair(def,atoms));
        state.realPairModels=models;state.realPairPromise=null;return models;
      })
      .catch(error=>{state.realPairPromise=null;throw error;});
    return state.realPairPromise;
  }

  function stackingModel(){
    const points=[],bonds=[],guide=[];
    const ring=(prefix,z,dx,element)=>{
      const ids=[];
      for(let i=0;i<6;i++){
        const a=-Math.PI/6+i*Math.PI/3,id=prefix+(i+1);
        points.push({id,x:dx+1.12*Math.cos(a),y:.93*Math.sin(a),z,element,showLabel:false});ids.push(id);
      }
      ids.forEach((id,i)=>bonds.push([id,ids[(i+1)%ids.length]]));return ids;
    };
    ring("A",.55,-.18,"C");ring("B",-0.55,.18,"N");guide.push(["A2","B2"],["A5","B5"]);
    return {points,bonds,guide,guideType:"helper"};
  }

  function helixModel(){
    const points=[],bonds=[],guide=[];
    for(let i=0;i<8;i++){
      const a=i*.68,y=(i-3.5)*.55;
      const l={id:"L"+i,x:1.25*Math.cos(a),y,z:1.25*Math.sin(a),element:i%2?"N":"C",showLabel:false};
      const r={id:"R"+i,x:1.25*Math.cos(a+Math.PI),y,z:1.25*Math.sin(a+Math.PI),element:i%2?"C":"N",showLabel:false};
      points.push(l,r);if(i)bonds.push(["L"+(i-1),l.id],["R"+(i-1),r.id]);guide.push([l.id,r.id]);
    }
    return {points,bonds,guide,guideType:"helper"};
  }

  function junctionModel(){
    const points=[{id:"J",x:0,y:0,z:0,element:"P",showLabel:false}],bonds=[],guide=[];
    [[-2,1.3,.2],[2,1.3,-.3],[0,-2,.45]].forEach((end,a)=>{
      for(let i=1;i<=4;i++){
        const t=i/4,id="B"+a+"_"+i;
        points.push({id,x:end[0]*t,y:end[1]*t,z:end[2]*t,element:i%2?"C":"O",showLabel:false});
        bonds.push([i===1?"J":"B"+a+"_"+(i-1),id]);
      }
    });
    return {points,bonds,guide,guideType:"helper"};
  }

  function contactModel(){
    const points=[],bonds=[],guide=[];
    for(let i=0;i<7;i++){
      const p={id:"A"+i,x:-1.4+i*.45,y:-1.5+i*.45,z:.45*Math.sin(i),element:i%2?"C":"N",showLabel:false};
      const q={id:"B"+i,x:1.4-i*.34,y:-1.4+i*.46,z:-.45*Math.sin(i),element:i%2?"N":"C",showLabel:false};
      points.push(p,q);if(i)bonds.push(["A"+(i-1),p.id],["B"+(i-1),q.id]);
    }
    guide.push(["A5","B5"]);return {points,bonds,guide,guideType:"helper"};
  }

  function modelForLesson(){
    const lesson=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    if(lesson.generator==="realpair")return state.realPairModels?.[state.realPairKey]||{points:[],bonds:[],guide:[]};
    if(lesson.generator==="stacking")return stackingModel();
    if(lesson.generator==="helix")return helixModel();
    if(lesson.generator==="junction")return junctionModel();
    if(lesson.generator==="contact")return contactModel();
    return lesson;
  }

  function rotatePoint(p){
    const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,z2=p.y*sp+z*cp;
    return {...p,rx:x,ry:y,rz:z2};
  }

  function projectedPoint(p,scale,cx,cy){return {x:cx+p.rx*scale,y:cy-p.ry*scale};}
  function pointElement(p){
    if(p.element&&ELEMENT_COLORS[p.element])return p.element;
    const m=String(p.id||"").split(":").pop().match(/^([CONHPS])/);return m&&ELEMENT_COLORS[m[1]]?m[1]:"C";
  }

  function renderMiniModel(){
    const svg=$("gpsMini3D");if(!svg)return;
    const model=modelForLesson();
    if(!model.points?.length){
      svg.innerHTML='<text x="320" y="260" text-anchor="middle" class="gps-mini-loading">Loading atom-level nucleotide coordinates…</text>';
      svg.dataset.feature=state.miniFeature;return;
    }
    const pts=model.points.map(rotatePoint),map=new Map(pts.map(p=>[p.id,p]));
    const scale=(state.miniFeature==="basepair"?72:76)*state.zoom,cx=320+state.panX,cy=255+state.panY;
    const bondSegments=(aId,bId)=>{
      const a=map.get(aId),b=map.get(bId);if(!a||!b)return"";
      const pa=projectedPoint(a,scale,cx,cy),pb=projectedPoint(b,scale,cx,cy),mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;
      const ca=ELEMENT_COLORS[pointElement(a)]||"#33cc66",cb=ELEMENT_COLORS[pointElement(b)]||"#33cc66";
      return '<line class="gps-stick-bond" stroke="'+ca+'" x1="'+pa.x+'" y1="'+pa.y+'" x2="'+mx+'" y2="'+my+'"/><line class="gps-stick-bond" stroke="'+cb+'" x1="'+mx+'" y1="'+my+'" x2="'+pb.x+'" y2="'+pb.y+'"/>';
    };
    const bonds=(model.bonds||[]).map(x=>bondSegments(x[0],x[1])).join("");
    const guides=(model.guide||[]).map(([aId,bId])=>{
      const a=map.get(aId),b=map.get(bId);if(!a||!b)return"";
      const pa=projectedPoint(a,scale,cx,cy),pb=projectedPoint(b,scale,cx,cy);
      return '<line class="gps-mini-guide '+(model.guideType==="hbond"?"hbond":"helper")+'" x1="'+pa.x+'" y1="'+pa.y+'" x2="'+pb.x+'" y2="'+pb.y+'"/>';
    }).join("");
    const caps=pts.slice().sort((a,b)=>a.rz-b.rz).map(p=>{
      const q=projectedPoint(p,scale,cx,cy),element=pointElement(p),color=ELEMENT_COLORS[element]||"#33cc66",r=element==="H"?2.7:element==="P"?3.5:2.4;
      const label=state.showLabels&&p.showLabel!==false?'<text class="gps-stick-label" x="'+(q.x+5)+'" y="'+(q.y-5)+'">'+String(p.id).split(":").pop()+'</text>':"";
      return '<g class="gps-stick-atom" data-element="'+element+'"><circle cx="'+q.x+'" cy="'+q.y+'" r="'+r+'" fill="'+color+'"/>'+label+'</g>';
    }).join("");
    svg.innerHTML='<g>'+bonds+guides+caps+'</g>';
    svg.dataset.feature=state.miniFeature;svg.dataset.yaw=state.yaw.toFixed(3);svg.dataset.pitch=state.pitch.toFixed(3);svg.dataset.zoom=state.zoom.toFixed(3);svg.dataset.labels=state.showLabels?"on":"off";
  }

  function resetMiniView(){
    state.yaw=-.55;state.pitch=.34;state.zoom=1;state.panX=0;state.panY=0;renderMiniModel();
  }

  function renderMiniLesson(){
    const lesson=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    document.querySelectorAll("[data-learning-feature]").forEach(button=>button.classList.toggle("active",button.dataset.learningFeature===state.miniFeature));
    document.querySelectorAll("[data-gps-real-pair]").forEach(button=>button.classList.toggle("active",button.dataset.gpsRealPair===state.realPairKey));
    const pairMode=state.miniFeature==="basepair";
    const tabs=$("gpsRealPairTabs");if(tabs)tabs.hidden=!pairMode;
    if($("gpsMiniLessonTitle"))$("gpsMiniLessonTitle").textContent=pairMode?(REAL_PAIR_DEFS[state.realPairKey]?.label||lesson.title):lesson.title;
    if($("gpsMiniLessonDefinition"))$("gpsMiniLessonDefinition").textContent=lesson.definition;
    if($("gpsMiniLessonNotice"))$("gpsMiniLessonNotice").textContent=lesson.notice;
    if($("gpsMiniCaption"))$("gpsMiniCaption").textContent=pairMode?"Stick view · coordinates from PDB 1EHZ · yellow dotted lines = teaching hydrogen bonds":"Interactive stick-style teaching model";
    renderMiniModel();
    if(pairMode&&!state.realPairModels){
      loadRealPairModels().then(()=>{if(state.miniFeature==="basepair")renderMiniLesson();}).catch(error=>{
        const svg=$("gpsMini3D");if(svg)svg.innerHTML='<text x="320" y="252" text-anchor="middle" class="gps-mini-loading">Could not load the atom-level base-pair model.</text><text x="320" y="278" text-anchor="middle" class="gps-mini-loading small">'+String(error.message||error)+'</text>';
      });
    }
  }

  function buildTertiaryLesson(){
    const scene=$("scene-tertiary"),learning=$("tertiaryLearning");if(!scene||!learning||learning.classList.contains("guided-tertiary-lesson"))return;
    learning.classList.add("guided-inline-lesson","guided-tertiary-lesson");
    learning.querySelector(".fact-label").textContent="STRUCTURAL FEATURES IN THIS 3D RNA";
    learning.querySelector("#tertiaryLearningTitle").textContent="Explore a feature, then find it in the full RNA";
    learning.querySelector(".tertiary-learning-intro").textContent="The complete 3D structure above is the context. First rotate a small teaching model below; then choose “Show me in the 3D structure” to highlight a representative example in the full RNA.";
    $("teLearningShow").textContent="Show me in the 3D structure";
    $("teLearningClear").textContent="Back to full structure";
    $("teLearningStatus").textContent="Choose a structural feature, inspect the small model, then show a real example in the full RNA.";

    const picker=learning.querySelector(".tertiary-learning-picker"),card=learning.querySelector(".tertiary-learning-card");
    const copy=document.createElement("div");copy.className="gps-feature-copy";copy.append(picker,card);
    const visual=document.createElement("div");visual.className="gps-inline-mini-viewer";
    visual.innerHTML='<div class="gps-mini-toolbar"><span>Left drag: rotate · Right drag: pan · Wheel: zoom</span><div><button type="button" id="gpsMiniLabels">Labels: on</button><button type="button" id="gpsMiniReset">Reset view</button></div></div>'+
      '<div class="gps-real-pair-tabs" id="gpsRealPairTabs" hidden><button type="button" class="active" data-gps-real-pair="gc">G–C</button><button type="button" data-gps-real-pair="au">A–U</button><button type="button" data-gps-real-pair="gu">G–U</button></div>'+
      '<div class="gps-mini-description"><h4 id="gpsMiniLessonTitle"></h4><p id="gpsMiniLessonDefinition"></p><p><strong>What should I notice?</strong> <span id="gpsMiniLessonNotice"></span></p></div>'+
      '<svg id="gpsMini3D" viewBox="0 0 640 520" role="img" aria-label="Interactive stick-style 3D teaching model"></svg>'+
      '<div class="gps-element-legend"><span><i data-element="C"></i>Carbon</span><span><i data-element="O"></i>Oxygen</span><span><i data-element="N"></i>Nitrogen</span><span><i data-element="H"></i>Hydrogen</span><span><i data-element="P"></i>Phosphorus</span></div>'+
      '<p class="gps-mini-caption" id="gpsMiniCaption"></p>';
    const layout=document.createElement("div");layout.className="gps-feature-layout";layout.append(copy,visual);
    learning.append(layout);scene.append(learning);

    document.querySelectorAll("[data-learning-feature]").forEach(button=>button.addEventListener("click",()=>{
      state.miniFeature=button.dataset.learningFeature;resetMiniView();renderMiniLesson();
    }));
    document.querySelectorAll("[data-gps-real-pair]").forEach(button=>button.addEventListener("click",()=>{state.realPairKey=button.dataset.gpsRealPair;resetMiniView();renderMiniLesson();}));
    $("gpsMiniLabels").addEventListener("click",()=>{
      state.showLabels=!state.showLabels;$("gpsMiniLabels").textContent="Labels: "+(state.showLabels?"on":"off");renderMiniModel();
    });
    $("gpsMiniReset").addEventListener("click",resetMiniView);

    const svg=$("gpsMini3D");
    svg.addEventListener("contextmenu",event=>event.preventDefault());
    svg.addEventListener("pointerdown",event=>{
      state.dragging=true;state.lastX=event.clientX;state.lastY=event.clientY;
      state.dragMode=event.button===2||event.button===1||event.ctrlKey||event.metaKey?"pan":"rotate";
      svg.setPointerCapture?.(event.pointerId);event.preventDefault();
    });
    const moveMini=event=>{
      if(!state.dragging)return;
      const dx=event.clientX-state.lastX,dy=event.clientY-state.lastY;state.lastX=event.clientX;state.lastY=event.clientY;
      if(state.dragMode==="pan"){state.panX+=dx;state.panY+=dy;}
      else{state.yaw+=dx*.011;state.pitch=clamp(state.pitch+dy*.011,-1.35,1.35);}
      renderMiniModel();event.preventDefault();
    };
    const stop=()=>{state.dragging=false;};
    window.addEventListener("pointermove",moveMini,{passive:false});
    window.addEventListener("pointerup",stop);
    window.addEventListener("pointercancel",stop);
    svg.addEventListener("wheel",event=>{state.zoom=clamp(state.zoom*Math.exp(-event.deltaY*.0012),.45,2.8);renderMiniModel();event.preventDefault();},{passive:false});

    $("teLearningShow").addEventListener("click",()=>setTimeout(()=>$("tertiaryViewport")?.scrollIntoView({behavior:"smooth",block:"center"}),80));
    renderMiniLesson();
  }

  function enter(sceneName){
    const journey=isJourney();
    if(sceneName==="secondary"){
      const p=document.querySelector("#scene-secondary .scene-copy>p:not(.scene-number)");
      if(p)p.textContent=journey
        ?"This radial map shows the same tRNA sequence organized as a secondary structure. Paired residues form stems while unpaired regions form loops and connectors."
        :state.secondaryCopyOriginal;
      if(journey){
        const radial=document.querySelector('[data-secondary-layout="radial"]');if(radial&&!radial.classList.contains("active"))radial.click();
        buildSecondaryLesson();
      }
    }
    if(sceneName==="tertiary"){
      const p=document.querySelector("#scene-tertiary .scene-copy>p:not(.scene-number)");
      if(p)p.textContent=journey
        ?"This is the three-dimensional structure of the same tRNA. Rotate and zoom the complete RNA first; the structural-feature lesson continues below the viewer."
        :state.tertiaryCopyOriginal;
      if(journey){buildTertiaryLesson();renderMiniLesson();}
    }
  }

  function setup(){
    state.secondaryCopyOriginal=document.querySelector("#scene-secondary .scene-copy>p:not(.scene-number)")?.textContent||"";
    state.tertiaryCopyOriginal=document.querySelector("#scene-tertiary .scene-copy>p:not(.scene-number)")?.textContent||"";
    buildSecondaryLesson();buildTertiaryLesson();
  }
  function showSecondaryWorkspace(){}
  function showTertiaryWorkspace(){}
  function resetForJourney(){resetMiniView();}

  return {setup,enter,showSecondaryWorkspace,showTertiaryWorkspace,resetForJourney,getState:()=>({...state})};
})();
