from pathlib import Path

p=Path('chemistry-editor.js')
s=p.read_text(encoding='utf-8')
old='''  function showEditorWindow(){
    if(!dialog)return;
    try{window.scrollTo({top:0,left:0,behavior:"instant"});}catch(_){window.scrollTo(0,0);}
    document.body.classList.add("chem-editor-open");
    if(!dialog.open)dialog.show();
    requestAnimationFrame(()=>{fitCanvasToDrawing(false);if(threeDVisible)schedule3DRender(true);});
  }
'''
new='''  function positionEditorWindow(){
    if(!dialog)return;
    const header=document.querySelector('.topbar');
    const rect=header?.getBoundingClientRect?.();
    const top=Math.max(74,Math.ceil((rect?.bottom||66)+8));
    dialog.style.top=top+'px';
    dialog.style.height=`calc(100dvh - ${top+12}px)`;
    dialog.style.maxHeight=`calc(100dvh - ${top+12}px)`;
  }
  function showEditorWindow(){
    if(!dialog)return;
    try{window.scrollTo({top:0,left:0,behavior:"instant"});}catch(_){window.scrollTo(0,0);}
    document.body.classList.add("chem-editor-open");
    if(!dialog.open)dialog.show();
    positionEditorWindow();
    if(dialog.dataset.headerResizeBound!=="1"){
      dialog.dataset.headerResizeBound="1";
      window.addEventListener('resize',()=>{if(dialog?.open)positionEditorWindow();});
    }
    requestAnimationFrame(()=>{positionEditorWindow();fitCanvasToDrawing(false);if(threeDVisible)schedule3DRender(true);});
  }
'''
if old not in s:
    raise SystemExit('showEditorWindow target not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Header offset fix applied')
