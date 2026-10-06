const RNAExplorerLearningTools=(()=>{
  const tutorials={
    drawing:{title:"Draw & edit RNA chemistry",intro:"Use the molecular drawing workspace like a compact chemistry sketchpad.",href:"?page=drawing",steps:[
      ["Start from something useful","Open a nucleobase, ribose, phosphate, a common base pair, or a blank canvas."],
      ["Select exactly what you mean","Use box selection for rectangular regions or Lasso select for a true freeform selection. The transform rectangle never adds atoms that were outside the lasso."],
      ["Edit, make room, and export","Add/delete atoms and bonds, change bond order or charge, use More canvas when the drawing gets crowded, then export your figure."]]},
    secondary:{title:"Explore a 2D RNA structure",intro:"Use the secondary-structure workspace to connect sequence, pairing, styling, and experimental data.",href:"?page=secondary&start=example",steps:[
      ["Load the example","Start with the 76-residue tRNA example, or enter your own sequence and dot-bracket structure."],
      ["Use the same control language","Display controls change backbone, residues, indices and pair appearance; Analyze controls handle base pairs and data layers."],
      ["Add data when you want it","Upload reactivity/residue information, base-pair probability data, or both, then export the structure or structure files."]]},
    tertiary:{title:"Inspect RNA in 3D",intro:"Use the 3D workspace to move from a whole structure to residues, contacts, measurements, and linked 2D context.",href:"?page=tertiary&start=example",steps:[
      ["Move around naturally","Left-drag to rotate, wheel to zoom, and Ctrl/⌘-drag or middle-drag to pan. Reset or center the view whenever you need."],
      ["Select before you analyze","Use Select controls for residues and ranges, Display controls for representation and labels, then Analyze controls for measurements, contacts, and comparison."],
      ["Connect 3D back to RNA structure","Use the 1EHZ example, inspect structural features, and link or derive a 2D view when the structure and mapping are appropriate."] ]}
  };
  const cards=[
    ["What are the four standard RNA bases?","Adenine, guanine, cytosine, and uracil."],
    ["What sugar is found in RNA?","Ribose."],
    ["What links a base to ribose?","A glycosidic bond."],
    ["What bond links RNA nucleotides together?","A phosphodiester bond."],
    ["Which bases form standard Watson–Crick pairs?","A–U and G–C."],
    ["What is a common RNA wobble pair?","G–U."],
    ["What is RNA primary structure?","The nucleotide sequence of the RNA strand."],
    ["What is RNA secondary structure?","Base-paired elements such as stems, loops, bulges, and junctions."],
    ["What is RNA tertiary structure?","The complete three-dimensional arrangement of the RNA."],
    ["What does 5′ to 3′ describe?","The direction of the RNA backbone and sequence."]
  ];
  let tutorialKey="drawing",tutorialStep=0,cardIndex=0,flipped=false,known=0,review=0;
  const $=id=>document.getElementById(id);
  function renderTutorial(){
    const t=tutorials[tutorialKey];if(!t)return;const step=t.steps[tutorialStep];
    $("rnaTutorialTitle").textContent=t.title;$("rnaTutorialIntro").textContent=t.intro;
    $("rnaTutorialStep").innerHTML="<span>Step "+(tutorialStep+1)+"</span><h3></h3><p></p>";$("rnaTutorialStep").querySelector("h3").textContent=step[0];$("rnaTutorialStep").querySelector("p").textContent=step[1];
    $("rnaTutorialProgress").textContent=(tutorialStep+1)+" / "+t.steps.length;$("rnaTutorialPrevious").disabled=tutorialStep===0;$("rnaTutorialNext").hidden=tutorialStep===t.steps.length-1;$("rnaTutorialOpen").hidden=tutorialStep!==t.steps.length-1;$("rnaTutorialOpen").href=t.href;
  }
  function openTutorial(key){if(!tutorials[key])return;tutorialKey=key;tutorialStep=0;renderTutorial();$("rnaTutorialDialog")?.showModal();}
  function renderCard(){
    const card=cards[cardIndex];if(!card||!$("rnaFlashcard"))return;
    $("rnaFlashcard").setAttribute("aria-pressed",String(flipped));$("flashcardSideLabel").textContent=flipped?"Answer":"Question";$("flashcardText").textContent=flipped?card[1]:card[0];
    $("flashcardProgress").textContent=(cardIndex+1)+" / "+cards.length;$("flashcardScore").textContent="Known "+known+" · Review "+review;
  }
  function moveCard(delta){cardIndex=(cardIndex+delta+cards.length)%cards.length;flipped=false;renderCard();}
  function setup(){
    document.addEventListener("click",event=>{const trigger=event.target.closest?.("[data-rna-tutorial]");if(trigger){event.preventDefault();openTutorial(trigger.dataset.rnaTutorial);}});
    $("rnaTutorialClose")?.addEventListener("click",()=>$("rnaTutorialDialog").close());
    $("rnaTutorialPrevious")?.addEventListener("click",()=>{tutorialStep=Math.max(0,tutorialStep-1);renderTutorial();});
    $("rnaTutorialNext")?.addEventListener("click",()=>{tutorialStep=Math.min(tutorials[tutorialKey].steps.length-1,tutorialStep+1);renderTutorial();});
    $("rnaFlashcard")?.addEventListener("click",()=>{flipped=!flipped;renderCard();});$("flashcardFlip")?.addEventListener("click",()=>{flipped=!flipped;renderCard();});
    $("flashcardPrevious")?.addEventListener("click",()=>moveCard(-1));$("flashcardNext")?.addEventListener("click",()=>moveCard(1));
    $("flashcardKnow")?.addEventListener("click",()=>{known++;moveCard(1);});$("flashcardReview")?.addEventListener("click",()=>{review++;moveCard(1);});renderCard();
  }
  return {setup,openTutorial};
})();
RNAExplorerLearningTools.setup();
