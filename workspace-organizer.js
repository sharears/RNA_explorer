(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => [...root.querySelectorAll(sel)];

  function addStyles(){
    if($('rnaWorkspaceOrganizerStyles')) return;
    const style=document.createElement('style');
    style.id='rnaWorkspaceOrganizerStyles';
    style.textContent=`
      .rna-workspace-global-bar{display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;margin:.65rem 0 .8rem;padding:.55rem;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.025)}
      .rna-workspace-global-bar .rna-history-label{font:700 11px/1.2 "DM Mono",monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-right:.15rem}
      .rna-tool-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.35rem;margin:.65rem 0}
      .rna-tool-tabs button{min-height:38px;font-weight:750}
      .rna-tool-tabs button.active{outline:2px solid var(--mint);background:rgba(116,215,182,.1)}
      .rna-tool-panel[hidden]{display:none!important}
      .rna-tool-panel{display:block}
      .rna-tool-panel>details{margin-bottom:.55rem}
      .rna-tool-panel>details>summary{font-weight:750}
      #teSequenceDock{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.55rem;align-items:start;margin:0 0 .55rem;padding:.5rem .6rem;border:1px solid var(--line);border-radius:10px;background:#08111e}
      #teSequenceDock .rna-chain-label{min-width:4.6rem;padding:.35rem .2rem;font:700 11px/1.2 "DM Mono",monospace;color:var(--mint)}
      #teSequencePanel.te-sequence-panel{display:flex;flex-wrap:nowrap;gap:.18rem;max-height:none;overflow-x:auto;overflow-y:hidden;padding:.1rem 0 .3rem}
      #teSequencePanel .te-seq-residue{display:grid;grid-template-rows:auto auto;gap:.08rem;min-width:2.15rem;padding:.24rem .28rem;text-align:center}
      .rna-seq-index{font:600 9px/1 "DM Mono",monospace;color:var(--muted)}
      .rna-seq-base{font:800 13px/1.15 "DM Mono",monospace;color:inherit}
      .rna-category-note{font-size:.76rem;color:var(--muted);margin:.35rem 0 .55rem}
      @media(max-width:760px){#teSequenceDock{grid-template-columns:1fr}.rna-tool-tabs{grid-template-columns:1fr 1fr 1fr}}
    `;
    document.head.append(style);
  }

  function makeTabs(host, key, groups, defaultKey='select'){
    if(!host || host.dataset.rnaCategorized==='1') return;
    host.dataset.rnaCategorized='1';
    const tabs=document.createElement('div');tabs.className='rna-tool-tabs';tabs.setAttribute('role','tablist');
    const panels={};
    groups.forEach(([name,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.rnaTab=name;b.setAttribute('role','tab');
      const panel=document.createElement('div');panel.className='rna-tool-panel';panel.dataset.rnaPanel=name;panel.setAttribute('role','tabpanel');
      panels[name]=panel;tabs.append(b);host.append(panel);
      b.addEventListener('click',()=>activate(name));
    });
    host.prepend(tabs);
    function activate(name){
      qa('[data-rna-tab]',tabs).forEach(b=>{const on=b.dataset.rnaTab===name;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
      Object.entries(panels).forEach(([k,p])=>p.hidden=k!==name);
      try{sessionStorage.setItem('rna-tool-tab-'+key,name);}catch(_){}
    }
    let start=defaultKey;try{start=sessionStorage.getItem('rna-tool-tab-'+key)||defaultKey;}catch(_){}
    activate(panels[start]?start:defaultKey);
    return panels;
  }

  function globalHistoryBar(host, prefix, undoId, redoId){
    if(!host || q('.rna-workspace-global-bar',host)) return;
    const bar=document.createElement('div');bar.className='rna-workspace-global-bar';
    const label=document.createElement('span');label.className='rna-history-label';label.textContent='History';
    const undo=document.createElement('button');undo.type='button';undo.id=undoId;undo.textContent='Undo';undo.title='Undo (Ctrl/⌘ Z)';undo.disabled=true;
    const redo=document.createElement('button');redo.type='button';redo.id=redoId;redo.textContent='Redo';redo.title='Redo (Ctrl/⌘ Shift Z)';redo.disabled=true;
    bar.append(label,undo,redo);host.prepend(bar);return {bar,undo,redo};
  }

  const tertiaryHistory={undo:[],redo:[],restoring:false,last:null,max:30};
  function tertiarySnapshot(){
    try{return JSON.stringify(TertiaryExplorer?.getWorkspaceSnapshot?.()||null);}catch(_){return null;}
  }
  function syncTertiaryHistory(){
    const u=$('teUndo'),r=$('teRedo');if(u)u.disabled=!tertiaryHistory.undo.length;if(r)r.disabled=!tertiaryHistory.redo.length;
  }
  function rememberTertiary(){
    if(tertiaryHistory.restoring) return;
    const snap=tertiarySnapshot();if(!snap) return;
    if(tertiaryHistory.undo.at(-1)!==snap){tertiaryHistory.undo.push(snap);if(tertiaryHistory.undo.length>tertiaryHistory.max)tertiaryHistory.undo.shift();}
    tertiaryHistory.redo=[];tertiaryHistory.last=snap;syncTertiaryHistory();
  }
  async function restoreTertiary(raw){
    if(!raw) return;tertiaryHistory.restoring=true;
    try{await TertiaryExplorer.restoreWorkspaceSnapshot(JSON.parse(raw));}catch(err){console.error('Tertiary history restore:',err);}finally{tertiaryHistory.restoring=false;syncTertiaryHistory();decorateSequenceButtons();}
  }
  async function undoTertiary(){
    if(!tertiaryHistory.undo.length) return;const current=tertiarySnapshot(),prev=tertiaryHistory.undo.pop();if(current)tertiaryHistory.redo.push(current);await restoreTertiary(prev);
  }
  async function redoTertiary(){
    if(!tertiaryHistory.redo.length) return;const current=tertiarySnapshot(),next=tertiaryHistory.redo.pop();if(current)tertiaryHistory.undo.push(current);await restoreTertiary(next);
  }

  function installTertiaryHistoryCapture(){
    const scene=$('scene-tertiary');if(!scene || scene.dataset.rnaHistoryCapture==='1') return;
    scene.dataset.rnaHistoryCapture='1';
    const capture=(e)=>{
      if(tertiaryHistory.restoring) return;
      const t=e.target;if(!t) return;
      if(t.closest?.('#teUndo,#teRedo')) return;
      if(t.closest?.('button,input,select,#tertiaryMolecularViewer,.te-seq-residue')) rememberTertiary();
    };
    scene.addEventListener('pointerdown',capture,true);
    scene.addEventListener('change',capture,true);
    scene.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key))capture(e);},true);
  }

  function categorizeTertiary(){
    const controls=$('tertiaryControls');const root=q('.te-controls',controls||document);if(!controls||!root||controls.dataset.rnaDone==='1')return false;
    controls.dataset.rnaDone='1';
    const global=globalHistoryBar(controls,'tertiary','teUndo','teRedo');
    global?.undo.addEventListener('click',undoTertiary);global?.redo.addEventListener('click',redoTertiary);

    const categoryHost=document.createElement('div');categoryHost.className='rna-category-host';root.prepend(categoryHost);
    const panels=makeTabs(categoryHost,'tertiary',[['select','Select'],['display','Display'],['analyze','Analyze']],'select');
    const details=qa(':scope > details',root);
    details.forEach(d=>{
      const s=(q(':scope > summary',d)?.textContent||'').toLowerCase();
      if(s.startsWith('select')||s.includes('saved objects'))panels.select.append(d);
      else if(s.startsWith('display')||s.includes('residue index')||s.includes('clipping')||s.includes('saved camera')||s.includes('focus on structural'))panels.display.append(d);
      else if(s.startsWith('analyze')||s.includes('compare / align'))panels.analyze.append(d);
    });
    const importDetails=details.find(d=>(q(':scope > summary',d)?.textContent||'').toLowerCase().includes('import structure'));
    if(importDetails){importDetails.open=false;root.insertBefore(importDetails,categoryHost);}
    const context=$('teContextPanel');if(context&&context.parentElement===root)root.insertBefore(context,categoryHost);

    const cutoff=$('teSelectNearCutoff');if(cutoff){cutoff.min='1';cutoff.max='25';cutoff.step='0.1';cutoff.placeholder='Å';}
    const nearButton=$('teSelectNearButton');if(nearButton)nearButton.textContent='Select residues within cutoff';
    const nearLabel=cutoff?.closest('label');if(nearLabel&&nearLabel.firstChild)nearLabel.firstChild.textContent='Residue cutoff (Å)';

    installTertiaryHistoryCapture();syncTertiaryHistory();return true;
  }

  function decorateSequenceButtons(){
    const panel=$('teSequencePanel');if(!panel)return;
    qa('.te-seq-residue',panel).forEach(b=>{
      if(b.dataset.rnaSeqDecorated==='1')return;
      const text=b.textContent.trim(),m=text.match(/^(.*?)(\d+)$/);if(!m)return;
      b.dataset.rnaSeqDecorated='1';b.replaceChildren();
      const idx=document.createElement('span');idx.className='rna-seq-index';idx.textContent=m[2];
      const base=document.createElement('span');base.className='rna-seq-base';base.textContent=m[1]||'?';
      b.append(idx,base);
    });
    const chain=$('teChainSelect');const label=q('#teSequenceDock .rna-chain-label');if(label&&chain){const option=chain.options?.[chain.selectedIndex];const next='Chain '+(option?.textContent||chain.value||'RNA');if(label.textContent!==next)label.textContent=next;}
  }

  function dockTertiarySequence(){
    const stage=$('tertiaryStage'),panel=$('teSequencePanel');if(!stage||!panel)return false;
    let dock=$('teSequenceDock');if(!dock){
      dock=document.createElement('div');dock.id='teSequenceDock';dock.setAttribute('aria-label','RNA chain sequence and residue index');
      const label=document.createElement('div');label.className='rna-chain-label';label.textContent='Chain RNA';dock.append(label,panel);
      const toolbar=q('.te-toolbar',stage);stage.insertBefore(dock,toolbar||stage.firstChild);
      const obs=new MutationObserver(decorateSequenceButtons);obs.observe(panel,{childList:true,subtree:true,characterData:true});
      $('teChainSelect')?.addEventListener('change',()=>setTimeout(decorateSequenceButtons,0));
    }
    decorateSequenceButtons();return true;
  }

  function categorizeSecondary(){
    const controls=q('#scene-secondary .se-controls');if(!controls||controls.dataset.rnaDone==='1')return false;
    controls.dataset.rnaDone='1';
    const host=document.createElement('div');host.className='rna-category-host';controls.prepend(host);
    const panels=makeTabs(host,'secondary',[['select','Select'],['display','Display'],['analyze','Analyze']],'display');
    qa(':scope > details',controls).forEach(d=>{
      if(d.closest('.rna-category-host'))return;
      const s=(q(':scope > summary',d)?.textContent||'').toLowerCase();
      if(s.startsWith('select'))panels.select.append(d);
      else if(s.startsWith('display'))panels.display.append(d);
      else if(s.startsWith('analyze'))panels.analyze.append(d);
    });
    const transform=$('seTransformToolbar');
    if(transform){
      const history=qa(':scope > details',transform).find(d=>(q('summary',d)?.textContent||'').toLowerCase().includes('history'));
      const select=qa(':scope > details',transform).find(d=>(q('summary',d)?.textContent||'').toLowerCase().startsWith('select'));
      if(history){
        const global=document.createElement('div');global.className='rna-workspace-global-bar';
        const label=document.createElement('span');label.className='rna-history-label';label.textContent='History';
        const body=q('.se-tool-group-body',history);global.append(label,...(body?[...body.children]:[]));controls.parentElement?.insertBefore(global,controls);
        history.remove();
      }
      if(select)panels.select.prepend(select);
      if(!transform.children.length)transform.remove();
    }
    return true;
  }

  function standardizeChemHistory(){
    const dialog=$('chemEditorDialog');if(!dialog)return false;
    const u=$('chemUndoButton'),r=$('chemRedoButton');
    if(u){if(u.textContent!=='Undo')u.textContent='Undo';if(u.title!=='Undo (Ctrl/⌘ Z)')u.title='Undo (Ctrl/⌘ Z)';}
    if(r){if(r.textContent!=='Redo')r.textContent='Redo';if(r.title!=='Redo (Ctrl/⌘ Shift Z)')r.title='Redo (Ctrl/⌘ Shift Z)';}
    return true;
  }

  function installGlobalHistoryKeys(){
    if(document.documentElement.dataset.rnaHistoryKeys==='1')return;document.documentElement.dataset.rnaHistoryKeys='1';
    document.addEventListener('keydown',e=>{
      const typing=e.target?.matches?.('input:not([type=range]),textarea,[contenteditable=true]');if(typing)return;
      const mod=e.ctrlKey||e.metaKey;if(!mod||e.key.toLowerCase()!=='z')return;
      const tertiaryVisible=$('scene-tertiary')&&!$('scene-tertiary').hidden;
      const secondaryVisible=$('scene-secondary')&&!$('scene-secondary').hidden;
      const chemOpen=$('chemEditorDialog')?.open;
      e.preventDefault();e.stopImmediatePropagation();
      if(chemOpen){(e.shiftKey?$('chemRedoButton'):$('chemUndoButton'))?.click();return;}
      if(tertiaryVisible){e.shiftKey?redoTertiary():undoTertiary();return;}
      if(secondaryVisible){(e.shiftKey?$('seRedo'):$('seUndo'))?.click();}
    },true);
  }

  function init(){
    addStyles();installGlobalHistoryKeys();
    const run=()=>{
      categorizeTertiary();dockTertiarySequence();categorizeSecondary();standardizeChemHistory();
    };
    run();
    setTimeout(run,250);setTimeout(run,1000);setTimeout(run,2500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
