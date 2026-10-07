const RNAExplorerLearningTools=(()=>{
  const tutorials={
    drawing:{title:"Draw & edit RNA chemistry",intro:"Use the molecular drawing workspace like a compact chemistry sketchpad.",href:"?page=drawing",steps:[
      ["Start from something useful","Open a nucleobase, ribose, phosphate, a common base pair, or a blank canvas."],
      ["Select exactly what you mean","Use box selection for rectangular regions or Lasso select for a true freeform selection. The transform rectangle never adds atoms that were outside the lasso."],
      ["Edit, make room, and export","Add/delete atoms and bonds, change bond order or charge, use More canvas when the drawing gets crowded, then export your figure."]]},
    secondary:{title:"Explore a 2D RNA structure",intro:"Use the secondary-structure workspace to connect sequence, pairing, styling, and experimental data.",href:"?page=secondary&start=example",steps:[
      ["Load the example","Start with the 76-residue tRNA example, or enter your own sequence and dot-bracket structure."],
      ["Select and transform a region","Use Box select or Lasso to choose only the residues you want. Rotate or enlarge that region without transforming the rest of the RNA."],
      ["Add data when you want it","Upload reactivity/residue information, base-pair probability data, or both, then export the structure or structure files."]]},
    tertiary:{title:"Inspect RNA in 3D",intro:"Use the 3D workspace to move from a whole structure to residues, contacts, measurements, and linked 2D context.",href:"?page=tertiary&start=example",steps:[
      ["Move around naturally","Left-drag to rotate, wheel to zoom, and Ctrl/⌘-drag or middle-drag to pan. Reset or center the view whenever you need."],
      ["Select before you analyze","Use Select controls for residues and ranges, Display controls for representation and labels, then Analyze controls for measurements, contacts, and comparison."],
      ["Connect 3D back to RNA structure","Use the 1EHZ example, inspect structural features, and link or derive a 2D view when the structure and mapping are appropriate."] ]}
  };

  const decks={
    starter:{label:"Starter",tagline:"Core RNA building blocks and vocabulary",cards:[
      ["What are the four standard RNA bases?","Adenine, guanine, cytosine, and uracil."],
      ["What sugar is found in RNA?","Ribose."],
      ["Which base replaces thymine in RNA?","Uracil."],
      ["What are the three parts of a nucleotide?","A nitrogenous base, ribose sugar, and phosphate."],
      ["What is a nucleoside?","A nitrogenous base attached to a sugar."],
      ["What is a nucleotide?","A nucleoside with one or more phosphate groups."],
      ["What bond links a base to ribose?","A glycosidic bond."],
      ["What bond links RNA nucleotides in a chain?","A phosphodiester bond."],
      ["What are the standard Watson–Crick RNA pairs?","A–U and G–C."],
      ["What is the common RNA wobble pair?","G–U."],
      ["What does 5′ to 3′ describe?","The direction of the RNA backbone and sequence."],
      ["What is RNA primary structure?","The nucleotide sequence of an RNA strand."],
      ["What is RNA secondary structure?","Local base pairing that forms stems, loops, and related motifs."],
      ["What is RNA tertiary structure?","The overall three-dimensional fold of the RNA."],
      ["What is an RNA stem?","A region of paired nucleotides forming a helix."],
      ["What is a hairpin loop?","An unpaired loop at the end of a stem."],
      ["What is a bulge?","Unpaired nucleotides on one side of an RNA helix."],
      ["What is an internal loop?","Unpaired nucleotides on both sides between two stems."],
      ["Why can RNA form complex structures?","Its bases can pair, stack, and form many interactions."],
      ["What gives RNA its negative charge?","The phosphate groups in its backbone."]
    ]},
    explorer:{label:"Explorer",tagline:"Motifs, ensembles, and experimental probing",cards:[
      ["What stabilizes an RNA helix besides hydrogen bonds?","Base-stacking interactions are an important stabilizing contribution."],
      ["What is a base pair?","Two bases interacting through a characteristic hydrogen-bonding geometry."],
      ["What is a noncanonical base pair?","A base pair that does not use standard Watson–Crick geometry."],
      ["Can RNA contain pseudoknots?","Yes. A pseudoknot contains base-pair connections that cross in a conventional secondary-structure diagram."],
      ["What is a multibranch loop?","A junction where three or more helices meet."],
      ["What is coaxial stacking?","Alignment and stacking of two helices along a similar axis."],
      ["Why are G–C pairs often more stable than A–U pairs?","G–C pairs have three canonical hydrogen bonds rather than two, while stacking and sequence context also affect stability."],
      ["What is base-pair probability?","The predicted probability that two residues form a pair in a structural ensemble."],
      ["What does high base-pair probability suggest?","Greater confidence that the pair is populated in the predicted ensemble."],
      ["What is an RNA structural ensemble?","A population of alternative RNA conformations rather than one single structure."],
      ["What does DMS commonly probe in RNA?","The accessibility and local chemical environment of reactive nucleobase positions."],
      ["What does SHAPE reactivity report indirectly?","Local nucleotide flexibility and conformational constraint."],
      ["What can high SHAPE reactivity suggest?","A relatively flexible or weakly constrained nucleotide."],
      ["What can low SHAPE reactivity suggest?","A relatively constrained or structured nucleotide."],
      ["Why combine probing data with structure prediction?","Experimental constraints can help models agree better with solution-state behavior."],
      ["What is a conserved RNA motif?","A recurring structural pattern preserved across related RNAs or species."],
      ["What is a tetraloop?","A hairpin loop containing four nucleotides."],
      ["What is a junction in RNA?","A region connecting multiple helical segments."],
      ["What is an RNA structural motif?","A recurring arrangement of nucleotides with characteristic geometry."],
      ["Why is RNA structure often described as hierarchical?","Primary sequence forms secondary motifs that assemble into higher-order tertiary folds."]
    ]},
    investigator:{label:"Investigator",tagline:"Interaction geometry and structural analysis",cards:[
      ["What is the Leontis–Westhof system used for?","Classifying RNA base pairs by interacting nucleobase edges and glycosidic-bond orientation."],
      ["What are the three major nucleobase edges in Leontis–Westhof notation?","Watson–Crick, Hoogsteen, and sugar edges."],
      ["What do cis and trans describe in RNA base-pair classification?","The relative orientation of the two glycosidic bonds."],
      ["Why can one nucleobase participate in several pairing geometries?","Different nucleobase edges expose different hydrogen-bond donor and acceptor patterns."],
      ["What is a Hoogsteen-edge interaction?","A base interaction that uses the Hoogsteen edge of a nucleobase."],
      ["What is an A-minor interaction?","An adenine-mediated tertiary contact with the minor-groove side of an RNA helix."],
      ["What is a ribose zipper?","A tertiary motif stabilized by a repeating network of ribose-mediated hydrogen bonds."],
      ["What is a base triple?","Three nucleobases participating in a connected interaction network."],
      ["What is a stacking interaction?","Favorable contact between neighboring aromatic nucleobase surfaces."],
      ["Why are metal ions important for RNA folding?","They can screen electrostatic repulsion between phosphates and stabilize compact structures."],
      ["What role does Mg²⁺ often play in RNA?","It can stabilize RNA folding through electrostatic screening and, in some sites, specific coordination."],
      ["What is a tertiary contact?","An interaction between residues that can be distant in the secondary-structure diagram."],
      ["What is a pseudoknot structurally?","A fold containing crossing base-pair connections in the conventional 2D representation."],
      ["What does an arc diagram show?","Sequence positions connected by arcs representing base pairs."],
      ["What does an RNA contact map show?","Pairwise residue contacts represented in matrix form."],
      ["Why compare 2D and 3D RNA views together?","Secondary connectivity and spatial organization provide complementary structural information."],
      ["What is RMSD used for in structure comparison?","Quantifying geometric differences after a defined structural correspondence and superposition."],
      ["What does a lower RMSD usually indicate?","Greater geometric similarity for the atoms or residues being compared."],
      ["Why does residue correspondence matter for RMSD?","Incorrect matching can make similar structures appear dissimilar or distort the fitted superposition."],
      ["What is structural clustering?","Grouping structures according to a chosen measure of structural similarity or distance."]
    ]},
    expert:{label:"RNA Expert",tagline:"Advanced structural reasoning and ensembles",cards:[
      ["What is an isosteric base-pair substitution?","A sequence substitution that preserves a similar base-pair geometry."],
      ["Why are isosteric substitutions important in RNA?","They can preserve local structure even when sequence changes."],
      ["What is conformational heterogeneity?","The presence of multiple structural states in an RNA population."],
      ["What is an RNA free-energy landscape?","A representation of accessible conformational states and their relative free energies."],
      ["Why can the lowest-energy predicted structure be insufficient?","Functional RNA can populate multiple relevant conformations rather than one state."],
      ["What is ensemble diversity?","A measure of structural variation across an ensemble of predicted conformations."],
      ["What is covariation in RNA alignments?","Coordinated sequence changes that can preserve a structural interaction."],
      ["Why is covariation evidence useful?","It can support evolutionarily conserved base pairing or structural constraints."],
      ["What is solvent accessibility?","The degree to which an atom or residue is exposed to solvent."],
      ["Why does local nucleotide flexibility matter?","It can influence chemical probing, folding dynamics, recognition, and function."],
      ["What is a long-range RNA interaction?","A spatial contact between residues that are distant in sequence."],
      ["What is an RNA tertiary interaction network?","A connected set of 3D contacts that helps stabilize or organize an RNA fold."],
      ["What is structural superposition?","Placing two structures in a common coordinate frame to compare their geometry."],
      ["Why can alignment choice change RMSD?","Different correspondences or fitted regions change the transformation and the residues included in the calculation."],
      ["What is a medoid in structural clustering?","The observed cluster member with the smallest overall distance to other members under the chosen distance measure."],
      ["Why use a medoid instead of an average structure?","A medoid is an actual observed structure and therefore retains physically realized geometry."],
      ["What does a silhouette score evaluate?","How well each item matches its assigned cluster relative to neighboring clusters."],
      ["What does a higher silhouette score generally indicate?","More cohesive clusters with better separation from neighboring clusters."],
      ["Why combine structural geometry with chemical probing data?","Together they connect structural models with experimentally observed solution behavior."],
      ["Why study rare noncanonical RNA interactions?","They can reveal recurring motifs, alternative states, and structural principles that canonical pairs alone do not capture."]
    ]}
  };

  const facts=[
    "RNA can fold into precise three-dimensional shapes, not just carry genetic information.",
    "The ribose sugar in A-form RNA helices commonly favors a C3′-endo sugar pucker.",
    "G–U wobble pairs are non-Watson–Crick interactions that occur frequently in structured RNA.",
    "Base stacking can contribute strongly to RNA helix stability in addition to hydrogen bonding.",
    "RNA nucleotides are linked through 3′–5′ phosphodiester bonds in the backbone.",
    "A single RNA sequence can populate an ensemble of related conformations rather than one rigid structure.",
    "Magnesium ions often help RNA fold by reducing electrostatic repulsion between negatively charged phosphates.",
    "RNA base pairs can use Watson–Crick, Hoogsteen, or sugar edges, creating many noncanonical geometries.",
    "Chemical probing methods such as DMS and SHAPE can report which nucleotides are accessible or conformationally constrained.",
    "Pseudoknots contain pairing connections that cross when drawn in a conventional secondary-structure diagram.",
    "Tertiary contacts can bring residues that are far apart in sequence next to each other in three-dimensional space.",
    "Yeast tRNA-Phe, PDB 1EHZ, is the experimental example used throughout RNA Explorer."
  ];

  const levelKeys=["starter","explorer","investigator","expert"];
  let tutorialKey="drawing",tutorialStep=0,levelKey="starter",cardIndex=0,flipped=false;
  const scores=Object.fromEntries(levelKeys.map(key=>[key,{known:0,review:0}]));
  let factIndex=0,factTimer=null;
  const $=id=>document.getElementById(id);

  function renderTutorial(){
    const t=tutorials[tutorialKey];if(!t)return;const step=t.steps[tutorialStep];
    $("rnaTutorialTitle").textContent=t.title;$("rnaTutorialIntro").textContent=t.intro;
    $("rnaTutorialStep").innerHTML="<span>Step "+(tutorialStep+1)+"</span><h3></h3><p></p>";$("rnaTutorialStep").querySelector("h3").textContent=step[0];$("rnaTutorialStep").querySelector("p").textContent=step[1];
    $("rnaTutorialProgress").textContent=(tutorialStep+1)+" / "+t.steps.length;$("rnaTutorialPrevious").disabled=tutorialStep===0;$("rnaTutorialNext").hidden=tutorialStep===t.steps.length-1;$("rnaTutorialOpen").hidden=tutorialStep!==t.steps.length-1;$("rnaTutorialOpen").href=t.href;
  }
  function openTutorial(key){if(!tutorials[key])return;tutorialKey=key;tutorialStep=0;renderTutorial();$("rnaTutorialDialog")?.showModal();}

  function ensureLevelPicker(){
    const shell=document.querySelector(".flashcard-shell");if(!shell||$("flashcardLevels"))return;
    const wrap=document.createElement("div");wrap.className="flashcard-level-wrap";
    const heading=document.createElement("div");heading.className="flashcard-level-heading";heading.innerHTML='<strong>Choose your level</strong><span id="flashcardLevelTagline"></span>';
    const nav=document.createElement("div");nav.className="flashcard-levels";nav.id="flashcardLevels";nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Flashcard difficulty levels");
    levelKeys.forEach(key=>{const b=document.createElement("button");b.type="button";b.dataset.flashcardLevel=key;b.textContent=decks[key].label;b.setAttribute("role","tab");b.addEventListener("click",()=>setLevel(key));nav.append(b);});
    wrap.append(heading,nav);shell.prepend(wrap);
  }
  function setLevel(key){if(!decks[key])return;levelKey=key;cardIndex=0;flipped=false;renderCard();}
  function renderCard(){
    const deck=decks[levelKey],card=deck.cards[cardIndex];if(!card||!$("rnaFlashcard"))return;
    $("rnaFlashcard").setAttribute("aria-pressed",String(flipped));$("flashcardSideLabel").textContent=flipped?"Answer":"Question";$("flashcardText").textContent=flipped?card[1]:card[0];
    $("flashcardProgress").textContent=deck.label+" · "+(cardIndex+1)+" / "+deck.cards.length;
    const score=scores[levelKey];$("flashcardScore").textContent="Known "+score.known+" · Review "+score.review;
    if($("flashcardLevelTagline"))$("flashcardLevelTagline").textContent=deck.tagline;
    document.querySelectorAll("[data-flashcard-level]").forEach(button=>{const active=button.dataset.flashcardLevel===levelKey;button.classList.toggle("active",active);button.setAttribute("aria-selected",String(active));});
  }
  function moveCard(delta){const cards=decks[levelKey].cards;cardIndex=(cardIndex+delta+cards.length)%cards.length;flipped=false;renderCard();}

  function renderFact(){if($("rnaFactText"))$("rnaFactText").textContent=facts[factIndex];}
  function nextFact(){factIndex=(factIndex+1)%facts.length;renderFact();}
  function startFacts(){if(factTimer||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;factTimer=setInterval(nextFact,9000);}
  function stopFacts(){if(factTimer){clearInterval(factTimer);factTimer=null;}}

  function setup(){
    document.addEventListener("click",event=>{const trigger=event.target.closest?.("[data-rna-tutorial]");if(trigger){event.preventDefault();openTutorial(trigger.dataset.rnaTutorial);}});
    $("rnaTutorialClose")?.addEventListener("click",()=>$("rnaTutorialDialog").close());
    $("rnaTutorialPrevious")?.addEventListener("click",()=>{tutorialStep=Math.max(0,tutorialStep-1);renderTutorial();});
    $("rnaTutorialNext")?.addEventListener("click",()=>{tutorialStep=Math.min(tutorials[tutorialKey].steps.length-1,tutorialStep+1);renderTutorial();});
    ensureLevelPicker();
    $("rnaFlashcard")?.addEventListener("click",()=>{flipped=!flipped;renderCard();});$("flashcardFlip")?.addEventListener("click",()=>{flipped=!flipped;renderCard();});
    $("flashcardPrevious")?.addEventListener("click",()=>moveCard(-1));$("flashcardNext")?.addEventListener("click",()=>moveCard(1));
    $("flashcardKnow")?.addEventListener("click",()=>{scores[levelKey].known++;moveCard(1);});$("flashcardReview")?.addEventListener("click",()=>{scores[levelKey].review++;moveCard(1);});
    $("rnaFactNext")?.addEventListener("click",()=>{nextFact();stopFacts();startFacts();});
    const strip=$("rnaFactStrip");strip?.addEventListener("mouseenter",stopFacts);strip?.addEventListener("mouseleave",startFacts);strip?.addEventListener("focusin",stopFacts);strip?.addEventListener("focusout",startFacts);
    renderCard();renderFact();startFacts();
  }
  return {setup,openTutorial,setLevel,getDeckCounts(){return Object.fromEntries(levelKeys.map(k=>[k,decks[k].cards.length]));}};
})();
RNAExplorerLearningTools.setup();
