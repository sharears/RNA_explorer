from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# index.html: compact navigation, workspace collapse controls, cache bumps.
# -----------------------------------------------------------------------------
p = Path("index.html")
text = p.read_text()

text = replace_once(
    text,
    '''        <a class="nav-feedback" id="workspaceFeedbackLink" href="mailto:sharearsaon@outlook.com?subject=RNA%20Structure%20Explorer%20Feedback%20or%20Question">Feedback &amp; Questions</a>\n      </nav>\n      <div class="topbar-actions" id="topbarActions">\n        <button class="project-button" id="saveProjectButton" type="button">Save Project</button>\n        <button class="project-button" id="openProjectButton" type="button">Open Project</button>\n        <input id="projectFileInput" type="file" accept=".json,.rnaexplorer.json,application/json" hidden>\n        <button class="site-search-button" id="siteSearchButton" type="button" aria-haspopup="dialog" aria-controls="siteSearchDialog">Search</button>\n        <button class="about-button" id="aboutButton" type="button">About</button>\n      </div>''',
    '''      </nav>\n      <div class="topbar-actions" id="topbarActions">\n        <button class="site-search-button compact-icon-button" id="siteSearchButton" type="button" aria-haspopup="dialog" aria-controls="siteSearchDialog" aria-label="Search RNA Explorer">\n          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>\n          <span class="sr-only">Search</span>\n        </button>\n        <details class="utility-menu" id="utilityMenu">\n          <summary aria-label="More options" title="More options"><span aria-hidden="true">•••</span></summary>\n          <div class="utility-menu-panel">\n            <span class="utility-menu-label">Project</span>\n            <button class="project-button" id="saveProjectButton" type="button">Save Project</button>\n            <button class="project-button" id="openProjectButton" type="button">Open Project</button>\n            <input id="projectFileInput" type="file" accept=".json,.rnaexplorer.json,application/json" hidden>\n            <hr>\n            <button class="about-button" id="aboutButton" type="button">About RNA Explorer</button>\n            <a class="nav-feedback" id="workspaceFeedbackLink" href="mailto:sharearsaon@outlook.com?subject=RNA%20Structure%20Explorer%20Feedback%20or%20Question">Feedback &amp; Questions</a>\n          </div>\n        </details>\n      </div>''',
    "compact topbar",
)

text = replace_once(
    text,
    '''            <p class="scene-number">05 / 06</p>\n            <h2 id="secondaryTitle">Secondary structure maps local pairing</h2>''',
    '''            <p class="scene-number">05 / 06</p>\n            <button class="workspace-controls-toggle" type="button" data-controls-toggle="secondary" aria-expanded="true" aria-controls="secondaryControlContent"><span aria-hidden="true">‹</span><b>Controls</b></button>\n            <h2 id="secondaryTitle">Secondary structure maps local pairing</h2>''',
    "secondary control toggle",
)

text = replace_once(
    text,
    '''            <p class="scene-number">06 / 06</p>\n            <h2 id="tertiaryTitle">Tertiary structure is the 3D arrangement</h2>''',
    '''            <p class="scene-number">06 / 06</p>\n            <button class="workspace-controls-toggle" type="button" data-controls-toggle="tertiary" aria-expanded="true" aria-controls="tertiaryControls"><span aria-hidden="true">‹</span><b>Controls</b></button>\n            <h2 id="tertiaryTitle">Tertiary structure is the 3D arrangement</h2>''',
    "tertiary control toggle",
)

text = text.replace('styles.css?v=home-secondary-3', 'styles.css?v=modern-ui-1')
text = text.replace('secondary.css?v=secondary-20', 'secondary.css?v=secondary-23')
text = text.replace('tertiary.css?v=tertiary-11', 'tertiary.css?v=tertiary-17')
text = text.replace('app.js?v=learn-explore-2', 'app.js?v=modern-ui-1')
p.write_text(text)


# -----------------------------------------------------------------------------
# app.js: keep navigation stable, wrap detailed controls, add collapse behavior.
# -----------------------------------------------------------------------------
p = Path("app.js")
text = p.read_text()
old = '''function arrangeTopbar(page){\n  const inner=document.getElementById("innerNav"),actions=document.getElementById("topbarActions");\n  const save=document.getElementById("saveProjectButton"),open=document.getElementById("openProjectButton"),search=document.getElementById("siteSearchButton");\n  const explore=document.getElementById("exploreNavMenu"),feedback=document.getElementById("workspaceFeedbackLink");\n  if(!inner||!actions||!save||!open||!search)return;\n  if(page==="home"){\n    actions.hidden=false;\n    actions.append(save,open,search);\n    inner.hidden=true;\n    return;\n  }\n  inner.hidden=false;actions.hidden=true;\n  if(explore){\n    explore.after(save);\n    save.after(open);\n  }else{\n    inner.append(save,open);\n  }\n  if(feedback)feedback.after(search);else inner.append(search);\n}\n'''
new = '''function arrangeTopbar(page){\n  const inner=document.getElementById("innerNav"),actions=document.getElementById("topbarActions");\n  if(!inner||!actions)return;\n  // Keep the primary navigation stable everywhere. The logo is the Home action;\n  // Learn and Explore remain visible, while project/about/feedback live in More.\n  inner.hidden=false;actions.hidden=false;\n  const home=document.getElementById("workspaceHomeLink");\n  if(home)home.hidden=true;\n  const utility=document.getElementById("utilityMenu");\n  if(utility&&page==="home")utility.removeAttribute("open");\n}\n'''
text = replace_once(text, old, new, "arrangeTopbar")

insert_after = '''function setupExploreWorkspaceHooks(){\n  document.getElementById("renderSecondaryButton")?.addEventListener("click",()=>setTimeout(()=>{\n    const status=document.getElementById("secondaryInputStatus");\n    if(status&&!status.classList.contains("error")&&document.getElementById("secondarySvg")?.childNodes.length)clearSecondaryBlankState();\n  },0));\n  document.getElementById("restoreTrnaButton")?.addEventListener("click",()=>setTimeout(clearSecondaryBlankState,0));\n  document.getElementById("teStructureFile")?.addEventListener("change",event=>{\n    if(event.target.files?.length)setTimeout(clearTertiaryBlankState,120);\n  });\n  document.getElementById("teLoadPdbId")?.addEventListener("click",()=>setTimeout(clearTertiaryBlankState,220));\n  document.getElementById("teRestoreStructure")?.addEventListener("click",()=>setTimeout(clearTertiaryBlankState,120));\n}\n'''
modern_fn = insert_after + '''\nfunction setupModernWorkspaceUi(){\n  document.querySelectorAll("[data-controls-toggle]").forEach(button=>{\n    const scene=document.getElementById("scene-"+button.dataset.controlsToggle);\n    if(!scene)return;\n    const sync=()=>{\n      const collapsed=scene.classList.contains("controls-collapsed");\n      button.setAttribute("aria-expanded",String(!collapsed));\n      const icon=button.querySelector("span"),label=button.querySelector("b");\n      if(icon)icon.textContent=collapsed?"›":"‹";\n      if(label)label.textContent=collapsed?"Show":"Controls";\n    };\n    button.addEventListener("click",()=>{scene.classList.toggle("controls-collapsed");sync();});\n    sync();\n  });\n\n  const secondaryControls=document.querySelector("#scene-secondary .se-controls");\n  if(secondaryControls&&!secondaryControls.closest(".workspace-advanced-panel")){\n    const advanced=document.createElement("details");advanced.className="workspace-advanced-panel";\n    const summary=document.createElement("summary");summary.textContent="Style & advanced controls";\n    secondaryControls.before(advanced);advanced.append(summary,secondaryControls);\n  }\n\n  const tertiaryControls=document.querySelector("#scene-tertiary .te-controls");\n  if(tertiaryControls&&!tertiaryControls.querySelector(":scope > .workspace-advanced-panel")){\n    const details=[...tertiaryControls.children].filter(el=>el.tagName==="DETAILS");\n    details.slice(0,2).forEach(el=>el.open=false);\n    if(details.length>2){\n      const advanced=document.createElement("details");advanced.className="workspace-advanced-panel";\n      const summary=document.createElement("summary");summary.textContent="Advanced tools";advanced.append(summary);\n      details.slice(2).forEach(el=>advanced.append(el));tertiaryControls.append(advanced);\n    }\n  }\n}\n'''
text = replace_once(text, insert_after, modern_fn, "modern workspace UI function")
text = replace_once(
    text,
    '''  setupExploreWorkspaceHooks();\n  setupDialog();''',
    '''  setupExploreWorkspaceHooks();\n  setupModernWorkspaceUi();\n  setupDialog();''',
    "initialize modern UI",
)
p.write_text(text)


# -----------------------------------------------------------------------------
# styles.css: modern shell, calmer hierarchy, compact navigation.
# -----------------------------------------------------------------------------
p = Path("styles.css")
text = p.read_text()
marker = "/* Modern UI cleanup v1 */"
if marker not in text:
    text += r'''

/* Modern UI cleanup v1 */
:root{
  --surface-0:#07111c;
  --surface-1:#0d1826;
  --surface-2:#122033;
  --radius-sm:8px;
  --radius-md:12px;
  --radius-lg:20px;
  --shadow-soft:0 18px 55px rgba(0,0,0,.20);
}
body{
  background:
    radial-gradient(circle at 78% 4%,rgba(116,215,182,.07),transparent 29rem),
    var(--surface-0);
}
.app-shell{width:min(1520px,100%);padding:0 clamp(16px,3vw,42px) 34px}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}

.topbar{
  position:sticky;top:0;z-index:80;height:68px;
  gap:18px;border-bottom:1px solid rgba(154,178,194,.15);
  background:rgba(7,17,28,.86);backdrop-filter:blur(16px);
}
.brand{gap:10px;font-size:.94rem;white-space:nowrap}
.brand-mark{transform:scale(.88)}
.beta{border:0;background:rgba(116,215,182,.09);border-radius:999px;padding:3px 7px}
.inner-nav{display:flex;align-items:center;gap:4px;margin-left:auto}
.inner-nav[hidden]{display:none!important}
#workspaceHomeLink{display:none!important}
.nav-menu>button,.inner-nav>a{
  border:0!important;background:transparent!important;color:var(--muted)!important;
  border-radius:9px!important;padding:8px 11px!important;font-weight:650!important;
}
.nav-menu>button:hover,.inner-nav>a:hover{color:var(--text)!important;background:rgba(255,255,255,.045)!important}
.topbar-actions{display:flex!important;align-items:center;gap:6px;margin-left:0}
.compact-icon-button,.utility-menu>summary{
  width:38px;height:38px;display:grid;place-items:center;border:0;border-radius:10px;
  background:transparent;color:var(--muted);cursor:pointer;list-style:none;
}
.compact-icon-button:hover,.utility-menu>summary:hover{background:rgba(255,255,255,.055);color:var(--text)}
.compact-icon-button svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}
.utility-menu{position:relative}
.utility-menu>summary::-webkit-details-marker{display:none}
.utility-menu>summary span{font-size:1rem;letter-spacing:.08em;transform:translateY(-2px)}
.utility-menu-panel{
  position:absolute;right:0;top:46px;z-index:100;width:220px;padding:9px;
  border:1px solid rgba(154,178,194,.18);border-radius:12px;background:rgba(13,24,38,.98);
  box-shadow:0 20px 60px rgba(0,0,0,.38);backdrop-filter:blur(18px);
}
.utility-menu-label{display:block;padding:7px 9px 4px;color:var(--muted);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em}
.utility-menu-panel button,.utility-menu-panel a{
  width:100%;display:flex;align-items:center;text-align:left;padding:9px 10px!important;margin:0!important;
  border:0!important;border-radius:8px!important;background:transparent!important;color:var(--text)!important;
  text-decoration:none;font-size:.86rem;cursor:pointer;
}
.utility-menu-panel button:hover,.utility-menu-panel a:hover{background:rgba(255,255,255,.055)!important;color:var(--mint)!important}
.utility-menu-panel hr{border:0;border-top:1px solid rgba(154,178,194,.15);margin:6px 4px}
.project-session-status{z-index:110}
.home-feedback-button{display:none!important}

body[data-page-mode="home"] .intro{display:none!important}
body[data-page-mode="home"] .home-cover{margin-top:26px;margin-bottom:70px}
.home-cover{
  border:1px solid rgba(154,178,194,.12);border-radius:24px;
  box-shadow:var(--shadow-soft);background:
    radial-gradient(circle at 18% 18%,rgba(116,215,182,.08),transparent 34%),
    linear-gradient(145deg,rgba(14,27,42,.94),rgba(7,15,26,.96));
}
.home-path-reveal,.workspace-launcher,.workspace-launch-card,.fact-panel{
  border-color:rgba(154,178,194,.16);
}
.home-path-reveal,.workspace-launch-card{background:rgba(255,255,255,.018)}
.primary-action,.secondary-action,.nav-button,.workspace-launch-card button{
  border-radius:10px;transition:transform .16s ease,background .16s ease,border-color .16s ease,color .16s ease;
}
.primary-action:hover,.secondary-action:hover,.nav-button:hover{transform:translateY(-1px)}

.workspace-controls-toggle{
  display:none;align-items:center;gap:7px;margin:0 0 15px;padding:7px 9px;
  border:0;border-radius:9px;background:rgba(255,255,255,.045);color:var(--muted);
  cursor:pointer;font-size:.78rem;font-weight:700;
}
.workspace-controls-toggle:hover{background:rgba(255,255,255,.075);color:var(--text)}
.workspace-controls-toggle span{font-size:1.2rem;line-height:.8}
.workspace-controls-toggle b{font:inherit}
body[data-page-mode="secondary"] #scene-secondary .workspace-controls-toggle,
body[data-page-mode="tertiary"] #scene-tertiary .workspace-controls-toggle{display:inline-flex}

body[data-page-mode="secondary"] #scene-secondary,
body[data-page-mode="tertiary"] #scene-tertiary{transition:grid-template-columns .22s ease}
body[data-page-mode="secondary"] #scene-secondary.controls-collapsed,
body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed{grid-template-columns:58px minmax(0,1fr)!important}
body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .scene-copy,
body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .scene-copy{
  padding:12px 8px!important;overflow:hidden!important;border-right:1px solid rgba(154,178,194,.13);
}
body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .scene-copy>:not(.workspace-controls-toggle),
body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .scene-copy>:not(.workspace-controls-toggle){display:none!important}
body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .workspace-controls-toggle,
body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .workspace-controls-toggle{
  width:40px;height:40px;justify-content:center;margin:0 auto;padding:0;
}
body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .workspace-controls-toggle b,
body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .workspace-controls-toggle b{display:none}

.workspace-advanced-panel{
  width:100%;margin:16px 0 0;border-top:1px solid rgba(154,178,194,.14);padding-top:12px;
}
.workspace-advanced-panel>summary{
  cursor:pointer;list-style:none;padding:9px 10px;border-radius:9px;background:rgba(255,255,255,.035);
  color:var(--text);font-size:.82rem;font-weight:750;
}
.workspace-advanced-panel>summary::-webkit-details-marker{display:none}
.workspace-advanced-panel>summary::after{content:"+";float:right;color:var(--muted)}
.workspace-advanced-panel[open]>summary::after{content:"−"}
.workspace-advanced-panel[open]>summary{background:rgba(116,215,182,.065);color:var(--mint)}

body[data-page-mode="secondary"] #scene-secondary .fact-panel,
body[data-page-mode="secondary"] #scene-secondary .legend,
body[data-page-mode="tertiary"] #scene-tertiary .fact-panel{display:none}
body[data-page-mode="secondary"] #scene-secondary .scene-copy>p:not(.scene-number),
body[data-page-mode="tertiary"] #scene-tertiary .scene-copy>p:not(.scene-number){font-size:.82rem;line-height:1.55}

.explorer{border-color:rgba(154,178,194,.14);background:rgba(10,20,32,.76);box-shadow:0 16px 50px rgba(0,0,0,.12)}
.scene-copy{border-right-color:rgba(154,178,194,.13)}
.visual-stage{background-image:none;background-color:rgba(6,14,24,.35)}

@media(max-width:920px){
  .topbar{position:relative;height:auto;min-height:64px;flex-wrap:wrap;padding:10px 0}
  .brand{order:1}.topbar-actions{order:2;margin-left:auto}.inner-nav{order:3;width:100%;margin:0;justify-content:flex-start}
  .nav-menu-panel{left:0;right:auto}
  body[data-page-mode="secondary"] #scene-secondary.controls-collapsed,
  body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed{grid-template-columns:1fr!important}
  body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .scene-copy,
  body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .scene-copy{padding:8px 14px!important;border-right:0;border-bottom:1px solid rgba(154,178,194,.13)}
  body[data-page-mode="secondary"] #scene-secondary.controls-collapsed .workspace-controls-toggle,
  body[data-page-mode="tertiary"] #scene-tertiary.controls-collapsed .workspace-controls-toggle{margin:0 0 0 auto}
}

@media(max-width:620px){
  .app-shell{padding-inline:12px}
  .brand>span:nth-child(2){max-width:165px;overflow:hidden;text-overflow:ellipsis}
  .inner-nav{gap:2px}
  .nav-menu>button{padding:7px 9px!important}
  .utility-menu-panel{position:fixed;right:12px;top:62px;width:min(250px,calc(100vw - 24px))}
  .home-cover{border-radius:18px}
}
'''
p.write_text(text)


# -----------------------------------------------------------------------------
# Secondary/Tertiary workspace sizing: structure first, narrow calm controls.
# -----------------------------------------------------------------------------
p = Path("secondary.css")
text = p.read_text()
if "/* Modern secondary workspace v1 */" not in text:
    text += r'''

/* Modern secondary workspace v1 */
body[data-page-mode="secondary"] #scene-secondary{grid-template-columns:315px minmax(0,1fr)}
body[data-page-mode="secondary"] #scene-secondary .scene-copy{padding:20px;max-height:calc(100vh - 98px);scrollbar-width:thin}
body[data-page-mode="secondary"] #scene-secondary h2{font-size:1.45rem;margin-bottom:12px}
body[data-page-mode="secondary"] #scene-secondary .scene-number{margin-bottom:10px;opacity:.72}
body[data-page-mode="secondary"] #scene-secondary .secondary-stage{min-height:calc(100vh - 112px);padding:18px 20px;gap:12px}
body[data-page-mode="secondary"] .se-viewport{height:min(72vh,760px);max-height:none;border-color:rgba(154,178,194,.14);border-radius:12px;background:rgba(5,12,21,.42)}
body[data-page-mode="secondary"] .secondary-layout-picker{border-color:rgba(154,178,194,.14);border-radius:10px;background:rgba(7,17,28,.72);backdrop-filter:blur(10px)}
body[data-page-mode="secondary"] .se-controls{margin-top:8px}
body[data-page-mode="secondary"] .se-controls>details{padding:12px 0;border-top-color:rgba(154,178,194,.13)}
body[data-page-mode="secondary"] .workspace-advanced-panel .se-controls{margin-top:0}
@media(max-width:920px){
  body[data-page-mode="secondary"] #scene-secondary{grid-template-columns:1fr}
  body[data-page-mode="secondary"] #scene-secondary .scene-copy{max-height:none}
  body[data-page-mode="secondary"] #scene-secondary .secondary-stage{min-height:68vh}
  body[data-page-mode="secondary"] .se-viewport{height:62vh}
}
'''
p.write_text(text)

p = Path("tertiary.css")
text = p.read_text()
if "/* Modern tertiary workspace v1 */" not in text:
    text += r'''

/* Modern tertiary workspace v1 */
body[data-page-mode="tertiary"] #scene-tertiary{grid-template-columns:330px minmax(0,1fr)}
body[data-page-mode="tertiary"] #scene-tertiary .scene-copy{padding:20px;max-height:calc(100vh - 98px);scrollbar-width:thin}
body[data-page-mode="tertiary"] #scene-tertiary h2{font-size:1.5rem;margin-bottom:12px}
body[data-page-mode="tertiary"] #scene-tertiary .scene-number{margin-bottom:10px;opacity:.72}
body[data-page-mode="tertiary"] #scene-tertiary .tertiary-stage{min-height:calc(100vh - 112px);padding:18px 20px;gap:10px}
body[data-page-mode="tertiary"] .te-viewport{height:min(72vh,760px);border-color:rgba(154,178,194,.14);border-radius:12px}
body[data-page-mode="tertiary"] .te-mini-panel{border-color:rgba(154,178,194,.14);border-radius:12px}
body[data-page-mode="tertiary"] .te-controls{margin-top:10px}
body[data-page-mode="tertiary"] .te-controls>details{padding:12px 0;border-top-color:rgba(154,178,194,.13)}
body[data-page-mode="tertiary"] .te-controls>.workspace-advanced-panel{padding-top:12px}
body[data-page-mode="tertiary"] #followButton{font-size:.78rem;padding:8px 10px;margin-top:10px}
@media(max-width:920px){
  body[data-page-mode="tertiary"] #scene-tertiary{grid-template-columns:1fr}
  body[data-page-mode="tertiary"] #scene-tertiary .scene-copy{max-height:none}
  body[data-page-mode="tertiary"] #scene-tertiary .tertiary-stage{min-height:68vh}
  body[data-page-mode="tertiary"] .te-viewport{height:60vh;min-height:420px}
}
'''
p.write_text(text)
