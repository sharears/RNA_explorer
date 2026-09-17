const journey = { nucleoside: false, nucleotide: false, active: null, timer: null };
const reactionCaveat = '<strong>Simplified condensation scheme, not cellular synthesis.</strong> Connectivity and bond order are shown, not stereochemistry. Carbon-bound hydrogens are omitted. RNA contains β-D-ribofuranosyl units; phosphate is usually ionized in cells.';

function cancelChemicalAnimation() {
  if (journey.timer !== null) clearTimeout(journey.timer);
  journey.timer = null;
  journey.active = null;
}

function reactionView(kind) {
  const isSugar = kind === 'nucleoside';
  const done = journey[kind];
  const base = chemistry.base;
  const names = chemicalNames[base];
  const nitrogen = base === 'A' || base === 'G' ? 'N9' : 'N1';
  const stage = isSugar ? (done ? 1 : 0) : (done ? 2 : 1);
  document.getElementById(kind+'Diagram').innerHTML = chemicalDiagram(base, stage, !done, isSugar);
  document.getElementById(kind+'Diagram').className = 'chemical-scroll';
  document.getElementById(kind+'Name').textContent = done ? names[isSugar ? 1 : 2] : isSugar ? names[0]+' + ribose' : names[1]+' + phosphoric acid';
  document.getElementById(kind+'Explanation').textContent = isSugar
    ? `${names[0]} joins ribose at C1′ and ${nitrogen}. The highlighted OH from ribose and H from the base leave as water, forming an N-glycosidic bond. The product, ${names[1].toLowerCase()}, is a nucleoside.`
    : `Start with ${names[1].toLowerCase()}, the nucleoside made from your selected base. An H from the sugar’s 5′-OH and an OH from phosphoric acid leave as water. The new 5′-O–P phosphoester bond gives ${names[2]}.`;
  const button = document.getElementById(kind+'Replay');
  button.disabled = journey.active === kind;
  button.textContent = journey.active === kind ? 'Joining the components…' : done ? 'Replay connection' : isSugar ? 'Form nucleoside' : 'Form nucleotide';
  const bondText=document.getElementById(kind+'Bond');
  bondText.textContent=done ? (isSugar?`New bond: C1′–${nitrogen} · N-glycosidic`:'New bond: 5′-O–P · phosphoester') : 'Follow the amber H and OH as they form H₂O.';
  document.getElementById(kind+'Diagram').querySelectorAll('[data-bond]').forEach(el=>{
    const explain=()=>{bondText.textContent=el.dataset.bond;};
    el.addEventListener('click',explain);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();explain();}});
  });
}

function playChemicalConnection(kind) {
  cancelChemicalAnimation();
  journey[kind] = false;
  journey.active = kind;
  reactionView(kind);
  const target = document.getElementById(kind+'Diagram');
  target.classList.add('join-animation');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  journey.timer = setTimeout(()=>{
    journey[kind] = true;
    journey.active = null;
    journey.timer = null;
    reactionView(kind);
    target.classList.add('animate-reaction');
  }, reduced ? 0 : 2200);
}

function enterChemicalScene(name) {
  if(name !== 'nucleoside' && name !== 'nucleotide')return;
  reactionView(name);
  if(!journey[name])playChemicalConnection(name);
}

function chooseJourneyBase(base) {
  if(!chemicalNames[base])throw new Error('Choose A, G, C, or U.');
  cancelChemicalAnimation();
  chemistry.base=base;
  journey.nucleoside=false;
  journey.nucleotide=false;
  document.querySelectorAll('.base-choice').forEach(button=>{
    const selected=button.dataset.base===base;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  document.getElementById('chemicalOverview').innerHTML=chemicalDiagram(base,0,true);
  document.getElementById('chosenBase').textContent=`Selected: ${chemicalNames[base][0]}. Carry this base into Nucleoside, then Nucleotide.`;
  reactionView('nucleoside');
  reactionView('nucleotide');
}

function setupChemicalJourney() {
  const original=document.getElementById('scene-nucleotide');
  const picker=original.querySelector('.base-picker');
  const blocksCopy=document.querySelector('#scene-blocks .scene-copy');
  blocksCopy.querySelector('p:not(.scene-number)').textContent='Meet phosphoric acid, ribofuranose (ribose sugar), and a nucleobase. Choose A, G, C, or U; your choice follows through the next two tabs.';
  blocksCopy.insertBefore(picker,document.getElementById('blockFact'));
  const chosen=document.createElement('p');chosen.id='chosenBase';chosen.setAttribute('aria-live','polite');
  picker.after(chosen);
  const chooser=document.createElement('div');chooser.className='component-picker';
  [['phosphate','Phosphoric acid'],['ribose','Ribose'],['base','Base']].forEach(([key,name])=>{
    const button=document.createElement('button');button.type='button';button.textContent=name;
    button.setAttribute('aria-pressed',String(key==='ribose'));
    button.addEventListener('click',()=>{
      chooser.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      const panel=document.getElementById('blockFact');
      panel.querySelector('h3').textContent=name;
      panel.querySelector('p').textContent=key==='phosphate'?'Phosphoric acid (H₃PO₄) is shown in its neutral form for these condensation schemes. Phosphate groups usually carry negative charge in cells.':blockFacts[key].copy;
    });
    chooser.appendChild(button);
  });
  document.getElementById('blockFact').before(chooser);
  document.querySelector('#scene-blocks .molecule-stage').innerHTML='<div id="chemicalOverview" class="chemical-scroll"></div><p class="chemical-note">Separate building blocks · Choose your base on the left. Numbered structural formulas show connectivity, not stereochemistry.</p>';

  for(const kind of ['nucleoside','nucleotide']){
    const sugar=kind==='nucleoside';
    const section=sugar?document.createElement('section'):original;
    section.id='scene-'+kind;section.className='scene';section.dataset.scenePanel=kind;section.hidden=true;
    section.setAttribute('aria-labelledby',kind+'Title');
    section.innerHTML=`<div class="scene-copy"><p class="scene-number">${sugar?'02':'03'} / 06</p>
      <h2 id="${kind}Title">${sugar?'Nucleoside: base + sugar':'Nucleotide: add phosphate'}</h2>
      <p id="${kind}Explanation"></p>
      <button class="primary-action replay-connection" id="${kind}Replay" type="button">Replay connection</button>
      <p class="journey-transition">${sugar?'The base and sugar together are a nucleoside. Next, attach phosphate to make a nucleotide.':'Each A-, G-, C-, or U-containing nucleotide has this base–sugar–phosphate framework. Join residues through 3′–5′ phosphodiester linkages to make an RNA chain. Its nucleotide order is the primary sequence.'}</p>
      </div><div class="visual-stage chemical-stage">
      <div class="chemical-scroll" id="${kind}Diagram"></div>
      <div class="chemical-result" aria-live="polite"><p>${sugar?'BASE + RIBOSE → NUCLEOSIDE + H₂O':'NUCLEOSIDE + H₃PO₄ → NUCLEOTIDE + H₂O'}</p><h3 id="${kind}Name"></h3><p id="${kind}Bond"></p></div>
      <p class="chemical-note">${reactionCaveat}</p></div>`;
    if(sugar)original.before(section);
    document.getElementById(kind+'Replay').addEventListener('click',()=>playChemicalConnection(kind));
  }
  picker.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>chooseJourneyBase(button.dataset.base)));
  document.querySelectorAll('.scene-number').forEach((el,i)=>{el.textContent=String(i+1).padStart(2,'0')+' / 06';});
  document.querySelector('#scene-primary .scene-copy > p:not(.scene-number)').textContent='The same base–sugar–phosphate framework is repeated along an RNA chain. Here we switch to a 76-residue tRNA containing A, G, C, and U (modified bases are shown as their parent bases). Read its sequence from 5′ to 3′.';
  chooseJourneyBase('C');
}
