const GuidedStructureTransitions = (() => {
  const state={secondaryReady:false,tertiaryReady:false,miniFeature:"glycosidic",yaw:-0.55,pitch:0.34,dragging:false,lastX:0,lastY:0};

  const PAIR_LESSONS={
    au:{
      title:"A–U Watson–Crick pair",
      copy:"Adenine and uracil can align their Watson–Crick edges and form two hydrogen bonds.",
      bonds:[["A N6–H","U O4"],["U N3–H","A N1"]],
      left:{name:"Adenine",kind:"purine",labels:[["N6–H",66,38],["N1",91,100]]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["O4",330,38],["N3–H",306,100]]}
    },
    gc:{
      title:"G–C Watson–Crick pair",
      copy:"Guanine and cytosine can form three hydrogen bonds through their Watson–Crick edges.",
      bonds:[["C N4–H","G O6"],["G N1–H","C N3"],["G N2–H","C O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",70,30],["N1–H",93,84],["N2–H",88,132]]},
      right:{name:"Cytosine",kind:"pyrimidine",labels:[["N4–H",330,30],["N3",307,84],["O2",312,132]]}
    },
    gu:{
      title:"G–U wobble pair",
      copy:"G–U is a common non-Watson–Crick pair in RNA. The bases shift relative to a standard Watson–Crick geometry and still form favorable hydrogen bonds.",
      bonds:[["U N3–H","G O6"],["G N1–H","U O2"]],
      left:{name:"Guanine",kind:"purine",labels:[["O6",70,44],["N1–H",94,105]]},
      right:{name:"Uracil",kind:"pyrimidine",labels:[["N3–H",307,44],["O2",310,105]]}
    }
  };

  const MINI_LESSONS={
    glycosidic:{
      title:"Glycosidic torsion χ",
      definition:"χ describes how the nucleobase is oriented relative to ribose around the glycosidic bond.",
      notice:"Follow the four highlighted atoms. The central C1′–N bond is the axis around which the base orientation changes.",
      points:[
        {id:"O4′",x:-1.8,y:.1,z:.2,c:"#87a9cc"},{id:"C1′",x:-.7,y:0,z:.4,c:"#ffffff"},
        {id:"N9",x:.55,y:.15,z:-.25,c:"#ffffff"},{id:"C4",x:1.7,y:.7,z:.15,c:"#f2c66d"},
        {id:"C2′",x:-1.1,y:-1,z:-.2,c:"#5d7080"},{id:"C8",x:1.2,y:-.55,z:.35,c:"#5d7080"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C1′","N9"],["N9","C4"],["N9","C8"],["C4","C8"]],
      highlight:["O4′","C1′","N9","C4"],guide:[["C1′","N9"]]
    },
    pucker:{
      title:"Sugar pucker",
      definition:"The five-membered ribose ring is not flat. Different ring atoms can lie above or below the average ring plane.",
      notice:"Rotate the ring edge-on. The displacement of C2′ and C3′ becomes much easier to see.",
      points:[
        {id:"O4′",x:-1.25,y:.75,z:0,c:"#87a9cc"},{id:"C1′",x:.2,y:1.15,z:.38,c:"#ffffff"},
        {id:"C2′",x:1.25,y:.15,z:-.46,c:"#f2c66d"},{id:"C3′",x:.65,y:-1.1,z:.52,c:"#74d7b6"},
        {id:"C4′",x:-.9,y:-.85,z:-.12,c:"#ffffff"}
      ],
      bonds:[["O4′","C1′"],["C1′","C2′"],["C2′","C3′"],["C3′","C4′"],["C4′","O4′"]],
      highlight:["O4′","C1′","C2′","C3′","C4′"]
    },
    backbone:{
      title:"Backbone torsions α–ζ",
      definition:"Six torsion angles describe rotations along the phosphodiester backbone: α, β, γ, δ, ε and ζ.",
      notice:"A torsion is defined by four atoms. Changing several local torsions changes the path taken by the RNA backbone.",
      points:[
        {id:"O3′(i−1)",x:-2.1,y:-.4,z:.25,c:"#87a9cc"},{id:"P",x:-.8,y:.35,z:-.3,c:"#f2c66d"},
        {id:"O5′",x:.35,y:-.25,z:.4,c:"#ffffff"},{id:"C5′",x:1.5,y:.45,z:-.35,c:"#ffffff"},
        {id:"C4′",x:2.3,y:-.35,z:.2,c:"#5d7080"}
      ],
      bonds:[["O3′(i−1)","P"],["P","O5′"],["O5′","C5′"],["C5′","C4′"]],
      highlight:["O3′(i−1)","P","O5′","C5′"],guide:[["P","O5′"]]
    },
    stacking:{
      title:"Base stacking",
      definition:"Neighboring nucleobases often pack with their approximately planar aromatic surfaces above one another.",
      notice:"Rotate the model and look at the overlap between the two base planes. This face-to-face geometry is different from edge-to-edge base pairing.",
      points:[
        {id:"A1",x:-1.2,y:.55,z:.5,c:"#f2c66d"},{id:"A2",x:0,y:1.05,z:.5,c:"#f2c66d"},{id:"A3",x:1.2,y:.55,z:.5,c:"#f2c66d"},
        {id:"A4",x:1.2,y:-.55,z:.5,c:"#f2c66d"},{id:"A5",x:0,y:-1.05,z:.5,c:"#f2c66d"},{id:"A6",x:-1.2,y:-.55,z:.5,c:"#f2c66d"},
        {id:"B1",x:-.9,y:.7,z:-.65,c:"#74d7b6"},{id:"B2",x:.3,y:1.2,z:-.65,c:"#74d7b6"},{id:"B3",x:1.5,y:.7,z:-.65,c:"#74d7b6"},
        {id:"B4",x:1.5,y:-.4,z:-.65,c:"#74d7b6"},{id:"B5",x:.3,y-.9,z:-.65,c:"#74d7b6"},{id:"B6",x:-.9,y:-.4,z:-.65,c:"#74d7b6"}
      ],
      bonds:[["A1","A2"],["A2","A3"],["A3","A4"],["A4","A5"],["A5","A6"],["A6","A1"],["B1","B2"],["B2","B3"],["B3","B4"],["B4","B5"],["B5","B6"],["B6","B1"]],
      highlight:["A1","A2","A3","A4","A5","A6","B1","B2","B3","B4","B5","B6"],guide:[["A2","B2"],["A5","B5"]]
    },
    basepair:{
      title:"Base pairing in 3D",
      definition:"Base pairing brings nucleobase edges together. Hydrogen bonds can stabilize a particular relative orientation.",
      notice:"Compare this edge-to-edge arrangement with the face-to-face arrangement of base stacking.",
      points:[
        {id:"A1",x:-1.8,y:.8,z:.15,c:"#f2c66d"},{id:"A2",x:-.65,y:1.2,z:.05,c:"#f2c66d"},{id:"A3",x:-.2,y:.1,z:-.05,c:"#ffffff"},
        {id:"A4",x:-.8,y-.9,z:.1,c:"#f2c66d"},{id:"A5",x:-1.9,y-.55,z:.18,c:"#f2c66d"},
        {id:"U1",x:1.7,y:.75,z:-.08,c:"#74d7b6"},{id:"U2",x:.65,y:1.1,z:.02,c:"#74d7b6"},{id:"U3",x:.25,y:.05,z:.05,c:"#ffffff"},
        {id:"U4",x:.8,y-.85,z:-.1,c:"#74d7b6"},{id:"U5",x:1.85,y-.45,z:-.12,c:"#74d7b6"}
      ],
      bonds:[["A1","A2"],["A2","A3"],["A3","A4"],["A4","A5"],["A5","A1"],["U1","U2"],["U2","U3"],["U3","U4"],["U4","U5"],["U5","U1"]],
      highlight:["A1","A2","A3","A4","A5","U1","U2","U3","U4","U5"],guide:[["A3","U3"],["A2","U2"]]
    },
    helix:{
      title:"RNA helix",
      definition:"Paired nucleotides can form a repeating helical arrangement in which pairing and stacking occur together.",
      notice:"Rotate the model and follow the two strands as they wind around the same axis.",
      generator:"helix"
    },
    loopjunction:{
      title:"Loops & junctions",
      definition:"Loops redirect the backbone; junctions are regions where multiple helical segments meet.",
      notice:"These regions organize how stems are connected in space rather than simply filling gaps between helices.",
      generator:"junction"
    },
    tertiarycontact:{
      title:"Tertiary contacts",
      definition:"Residues far apart in sequence can come close together after the RNA folds in three dimensions.",
      notice:"Sequence distance and spatial distance are different. A tertiary contact can connect distant parts of the chain.",
      generator:"contact"
    }
  };

  function helixModel(){
    const points=[],bonds=[],highlight=[];
    for(let i=0;i<8;i++){
      const a=i*.68, y=(i-3.5)*.55;
      const p1={id:"L"+i,x:1.25*Math.cos(a),y,z:1.25*Math.sin(a),c:"#f2c66d"};
      const p2={id:"R"+i,x:1.25*Math.cos(a+Math.PI),y,z:1.25*Math.sin(a+Math.PI),c:"#74d7b6"};
      points.push(p1,p2);highlight.push(p1.id,p2.id);
      if(i){bonds.push(["L"+(i-1),"L"+i],["R"+(i-1),"R"+i]);}
      bonds.push(["L"+i,"R"+i]);
    }
    return {points,bonds,highlight,guide:[]};
  }
  function junctionModel(){
    const points=[{id:"J",x:0,y:0,z:0,c:"#ffffff"}],bonds=[],highlight=["J"];
    [[-2,1.3,.2],[2,1.3,-.3],[0,-2,.45]].forEach((end,a)=>{
      for(let i=1;i<=4;i++){
        const t=i/4,id="B"+a+"_"+i;
        points.push({id,x:end[0]*t,y:end[1]*t,z:end[2]*t,c:a===0?"#f2c66d":a===1?"#74d7b6":"#87a9cc"});
        bonds.push([i===1?"J":"B"+a+"_"+(i-1),id]);highlight.push(id);
      }
    });
    return {points,bonds,highlight,guide:[]};
  }
  function contactModel(){
    const points=[],bonds=[],highlight=[],guide=[];
    for(let i=0;i<7;i++){
      const p={id:"A"+i,x:-1.4+i*.45,y:-1.5+i*.45,z:.45*Math.sin(i),c:"#87a9cc"};
      const q={id:"B"+i,x:1.4-i*.34,y:-1.4+i*.46,z:-.45*Math.sin(i),c:"#74d7b6"};
      points.push(p,q);highlight.push(p.id,q.id);
      if(i){bonds.push(["A"+(i-1),"A"+i],["B"+(i-1),"B"+i]);}
    }
    guide.push(["A5","B5"]);
    return {points,bonds,highlight,guide};
  }

  function isJourney(){return document.body.dataset.pageMode==="journey";}
  const $=id=>document.getElementById(id);

  function pairDiagram(key){
    const l=PAIR_LESSONS[key]||PAIR_LESSONS.au;
    const poly=(cx,cy,r,n,rot)=>Array.from({length:n},(_,i)=>{const a=rot+i*Math.PI*2/n;return (cx+Math.cos(a)*r).toFixed(1)+","+(cy+Math.sin(a)*r).toFixed(1);}).join(" ");
    const bonds=l.bonds.map((_,i)=>{
      const y=key==="gc"?45+i*44:58+i*55;
      return '<line class="gps-hbond" x1="145" y1="'+y+'" x2="255" y2="'+y+'"/>';
    }).join("");
    const labels=[...l.left.labels,...l.right.labels].map(([t,x,y])=>'<text class="gps-atom-label" x="'+x+'" y="'+y+'">'+t+'</text>').join("");
    return '<svg viewBox="0 0 400 170" class="gps-pair-svg" role="img" aria-label="'+l.title+' atom-level teaching diagram">'+
      '<polygon class="gps-base-ring left" points="'+poly(92,85,55,l.left.kind==="purine"?6:6,-Math.PI/6)+'"/>'+
      (l.left.kind==="purine"?'<polygon class="gps-base-ring left small" points="'+poly(47,86,36,5,-Math.PI/2)+'"/>':'')+
      '<polygon class="gps-base-ring right" points="'+poly(308,85,55,6,-Math.PI/6)+'"/>'+
      bonds+labels+
      '<text class="gps-base-name" x="92" y="162">'+l.left.name+'</text><text class="gps-base-name" x="308" y="162">'+l.right.name+'</text></svg>';
  }

  function secondaryTransitionMarkup(){
    return '<section class="guided-transition gps-secondary-transition" id="guidedSecondaryTransition">'+
      '<div class="gps-transition-copy"><span class="fact-label">PRIMARY → SECONDARY</span><h2>How can one RNA chain make a secondary structure?</h2>'+
      '<p>The chain can bend back toward itself. When compatible nucleobases meet, they can form base pairs. Several pairs together create stems, loops and other secondary-structure elements.</p>'+
      '<div class="gps-step-row"><button type="button" class="active" data-gps-secondary-step="fold">1 · Fold the chain</button><button type="button" data-gps-secondary-step="pair">2 · Look at a base pair</button><button type="button" data-gps-secondary-step="more">3 · RNA can pair in other ways</button></div>'+
      '<div class="gps-secondary-copy" id="gpsSecondaryCopy"></div>'+
      '<button class="primary-action" type="button" id="gpsContinueSecondary">Continue to the full secondary structure →</button></div>'+
      '<div class="gps-transition-visual"><div id="gpsSecondaryVisual"></div></div></section>';
  }

  function tertiaryTransitionMarkup(){
    return '<section class="guided-transition gps-tertiary-transition" id="guidedTertiaryTransition">'+
      '<div class="gps-transition-copy"><span class="fact-label">SECONDARY → TERTIARY</span><h2>Secondary structure tells us who pairs. What does the RNA look like in 3D?</h2>'+
      '<p>Before opening the full molecule, explore the local geometric features used to describe RNA in three dimensions.</p>'+
      '<div class="gps-feature-grid">'+
      Object.entries(MINI_LESSONS).map(([key,v])=>'<button type="button" data-gps-mini-feature="'+key+'" class="'+(key==="glycosidic"?"active":"")+'">'+v.title+'</button>').join("")+
      '</div><article class="gps-mini-copy"><h3 id="gpsMiniTitle"></h3><p id="gpsMiniDefinition"></p><p><strong>What should I notice?</strong> <span id="gpsMiniNotice"></span></p></article>'+
      '<button class="primary-action" type="button" id="gpsContinueTertiary">Continue to the full tertiary structure →</button></div>'+
      '<div class="gps-transition-visual"><div class="gps-mini-toolbar"><span>Drag to rotate</span><button type="button" id="gpsMiniReset">Reset view</button></div><svg id="gpsMini3D" viewBox="0 0 640 520" role="img" aria-label="Interactive 3D teaching model"></svg><p class="gps-mini-caption">Interactive teaching model · not to scale</p></div></section>';
  }

  function buildSecondaryTransition(){
    const scene=$("scene-secondary");if(!scene||$("guidedSecondaryTransition"))return;
    scene.insertAdjacentHTML("afterbegin",secondaryTransitionMarkup());
    $("gpsContinueSecondary").addEventListener("click",()=>showSecondaryWorkspace());
    document.querySelectorAll("[data-gps-secondary-step]").forEach(b=>b.addEventListener("click",()=>renderSecondaryStep(b.dataset.gpsSecondaryStep)));
    renderSecondaryStep("fold");
  }

  function renderFoldVisual(){
    const points=[[50,150],[95,135],[140,112],[186,80],[232,65],[280,85],[320,125],[355,165],[410,190],[465,175],[510,140],[555,105]];
    const circles=points.map((p,i)=>'<g class="gps-fold-residue r'+i+'"><circle cx="'+p[0]+'" cy="'+p[1]+'" r="14"/><text x="'+p[0]+'" y="'+(p[1]+4)+'">'+["G","C","A","U","G","C","A","A","U","G","C","U"][i]+'</text></g>').join("");
    const backbone=points.slice(1).map((p,i)=>'<line x1="'+points[i][0]+'" y1="'+points[i][1]+'" x2="'+p[0]+'" y2="'+p[1]+'"/>').join("");
    const pairs=[[1,10],[2,9],[3,8]].map(([a,b],i)=>'<line class="gps-fold-pair p'+i+'" x1="'+points[a][0]+'" y1="'+points[a][1]+'" x2="'+points[b][0]+'" y2="'+points[b][1]+'"/>').join("");
    return '<div class="gps-fold-card"><svg viewBox="0 0 610 245" class="gps-fold-svg"><g class="gps-fold-backbone">'+backbone+'</g>'+pairs+circles+'</svg>'+
      '<div class="gps-fold-actions"><button type="button" id="gpsFoldPlay">Replay folding</button><span>Watch distant residues approach and pair.</span></div></div>';
  }

  function playFold(){
    const svg=document.querySelector(".gps-fold-svg");if(!svg)return;
    svg.classList.remove("animate");void svg.getBoundingClientRect();svg.classList.add("animate");
  }

  function renderSecondaryStep(step){
    document.querySelectorAll("[data-gps-secondary-step]").forEach(b=>b.classList.toggle("active",b.dataset.gpsSecondaryStep===step));
    const copy=$("gpsSecondaryCopy"),visual=$("gpsSecondaryVisual");if(!copy||!visual)return;
    if(step==="fold"){
      copy.innerHTML='<h3>Start with the primary chain</h3><p>The sequence does not have to stay extended. Parts of the same RNA can approach one another and form intramolecular base pairs.</p>';
      visual.innerHTML=renderFoldVisual();$("gpsFoldPlay")?.addEventListener("click",playFold);setTimeout(playFold,50);return;
    }
    if(step==="pair"){
      copy.innerHTML='<h3>Zoom in: what does a base pair mean chemically?</h3><p>A secondary-structure line is a shorthand for an atomic interaction. Choose a standard Watson–Crick pair or the common G–U wobble pair.</p>'+
        '<div class="gps-pair-tabs"><button type="button" data-gps-pair="au" class="active">A–U</button><button type="button" data-gps-pair="gc">G–C</button><button type="button" data-gps-pair="gu">G–U wobble</button></div><div id="gpsPairText"></div>';
      visual.innerHTML='<div class="gps-pair-stage" id="gpsPairStage"></div>';
      document.querySelectorAll("[data-gps-pair]").forEach(b=>b.addEventListener("click",()=>renderPair(b.dataset.gpsPair)));
      renderPair("au");return;
    }
    copy.innerHTML='<h3>RNA is not limited to Watson–Crick geometry</h3><p>A–U and G–C are the standard Watson–Crick pairs, but folded RNA contains many non-Watson–Crick interactions. The important idea here is that nucleobases have multiple interaction edges and can meet in different relative orientations.</p>'+
      '<div class="gps-nonstandard-list"><span>G–U wobble</span><span>Sheared G–A</span><span>Hoogsteen / reverse-Hoogsteen geometries</span><span>Other edge combinations</span></div>';
    visual.innerHTML='<div class="gps-more-card"><div><strong>Watson–Crick</strong><small>canonical edge-to-edge geometry</small></div><div class="gps-arrow">→</div><div><strong>Non-Watson–Crick</strong><small>alternative edges and orientations expand RNA structural diversity</small></div></div>';
  }

  function renderPair(key){
    const lesson=PAIR_LESSONS[key]||PAIR_LESSONS.au;
    document.querySelectorAll("[data-gps-pair]").forEach(b=>b.classList.toggle("active",b.dataset.gpsPair===key));
    const stage=$("gpsPairStage"),text=$("gpsPairText");if(stage)stage.innerHTML=pairDiagram(key);
    if(text)text.innerHTML='<strong>'+lesson.title+'</strong><p>'+lesson.copy+'</p><ul>'+lesson.bonds.map(x=>'<li>'+x[0]+' ··· '+x[1]+'</li>').join("")+'</ul>';
  }

  function buildTertiaryTransition(){
    const scene=$("scene-tertiary");if(!scene||$("guidedTertiaryTransition"))return;
    scene.insertAdjacentHTML("afterbegin",tertiaryTransitionMarkup());
    document.querySelectorAll("[data-gps-mini-feature]").forEach(b=>b.addEventListener("click",()=>{state.miniFeature=b.dataset.gpsMiniFeature;renderMiniLesson();}));
    $("gpsMiniReset").addEventListener("click",()=>{state.yaw=-.55;state.pitch=.34;renderMiniModel();});
    $("gpsContinueTertiary").addEventListener("click",()=>showTertiaryWorkspace());
    const svg=$("gpsMini3D");
    svg.addEventListener("pointerdown",e=>{state.dragging=true;state.lastX=e.clientX;state.lastY=e.clientY;svg.setPointerCapture(e.pointerId);});
    svg.addEventListener("pointermove",e=>{if(!state.dragging)return;state.yaw+=(e.clientX-state.lastX)*.012;state.pitch+=(e.clientY-state.lastY)*.012;state.pitch=Math.max(-1.3,Math.min(1.3,state.pitch));state.lastX=e.clientX;state.lastY=e.clientY;renderMiniModel();});
    const end=()=>{state.dragging=false;};svg.addEventListener("pointerup",end);svg.addEventListener("pointercancel",end);
    renderMiniLesson();
  }

  function modelForLesson(){
    const lesson=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    if(lesson.generator==="helix")return {...lesson,...helixModel()};
    if(lesson.generator==="junction")return {...lesson,...junctionModel()};
    if(lesson.generator==="contact")return {...lesson,...contactModel()};
    return lesson;
  }
  function rotatePoint(p){
    const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,z2=p.y*sp+z*cp;
    return {...p,rx:x,ry:y,rz:z2};
  }
  function renderMiniModel(){
    const svg=$("gpsMini3D");if(!svg)return;const model=modelForLesson();
    const pts=model.points.map(rotatePoint),map=new Map(pts.map(p=>[p.id,p])),scale=76,cx=320,cy=255;
    const line=(a,b,cls)=>{const p=map.get(a),q=map.get(b);if(!p||!q)return"";return '<line class="'+cls+'" x1="'+(cx+p.rx*scale)+'" y1="'+(cy-p.ry*scale)+'" x2="'+(cx+q.rx*scale)+'" y2="'+(cy-q.ry*scale)+'"/>';};
    const bonds=(model.bonds||[]).map(x=>line(x[0],x[1],"gps-mini-bond")).join("");
    const guides=(model.guide||[]).map(x=>line(x[0],x[1],"gps-mini-guide")).join("");
    const nodes=pts.slice().sort((a,b)=>a.rz-b.rz).map(p=>{
      const hi=(model.highlight||[]).includes(p.id),r=hi?13:9,op=Math.max(.55,Math.min(1,.8+p.rz*.08));
      return '<g class="gps-mini-node '+(hi?"highlight":"")+'" transform="translate('+(cx+p.rx*scale)+' '+(cy-p.ry*scale)+')" opacity="'+op+'"><circle r="'+r+'" fill="'+p.c+'"/><text y="'+(hi?-18:-14)+'">'+p.id+'</text></g>';
    }).join("");
    svg.innerHTML='<g>'+bonds+guides+nodes+'</g>';
    svg.dataset.feature=state.miniFeature;svg.dataset.yaw=state.yaw.toFixed(3);svg.dataset.pitch=state.pitch.toFixed(3);
  }
  function renderMiniLesson(){
    const l=MINI_LESSONS[state.miniFeature]||MINI_LESSONS.glycosidic;
    document.querySelectorAll("[data-gps-mini-feature]").forEach(b=>b.classList.toggle("active",b.dataset.gpsMiniFeature===state.miniFeature));
    $("gpsMiniTitle").textContent=l.title;$("gpsMiniDefinition").textContent=l.definition;$("gpsMiniNotice").textContent=l.notice;renderMiniModel();
  }

  function activateOverlay(sceneName){
    if(!isJourney())return;
    const scene=$(sceneName==="secondary"?"scene-secondary":"scene-tertiary");if(!scene)return;
    if(sceneName==="secondary"&&!state.secondaryReady)scene.classList.add("guided-transition-active");else if(sceneName==="tertiary"&&!state.tertiaryReady)scene.classList.add("guided-transition-active");
  }
  function showSecondaryWorkspace(){state.secondaryReady=true;$("scene-secondary")?.classList.remove("guided-transition-active");}
  function showTertiaryWorkspace(){
    state.tertiaryReady=true;$("scene-tertiary")?.classList.remove("guided-transition-active");
    if(typeof TertiaryExplorer!=="undefined")TertiaryExplorer.render();
  }
  function enter(sceneName){
    if(!isJourney())return;
    if(sceneName==="secondary"){buildSecondaryTransition();activateOverlay("secondary");}
    if(sceneName==="tertiary"){buildTertiaryTransition();activateOverlay("tertiary");}
  }
  function resetForJourney(){
    state.secondaryReady=false;state.tertiaryReady=false;
    $("scene-secondary")?.classList.remove("guided-transition-active");$("scene-tertiary")?.classList.remove("guided-transition-active");
  }
  function setup(){buildSecondaryTransition();buildTertiaryTransition();}

  return {setup,enter,showSecondaryWorkspace,showTertiaryWorkspace,resetForJourney,getState:()=>({...state})};
})();
