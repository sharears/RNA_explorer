from pathlib import Path

MARKER = "/* Homepage/navigation polish v2 */"

styles_path = Path("styles.css")
styles = styles_path.read_text(encoding="utf-8")
if MARKER in styles:
    raise SystemExit("Homepage/navigation polish v2 already present")

styles += r'''

/* Homepage/navigation polish v2 */
:root{
  --surface-0:#061426;
  --surface-1:#0a1b31;
  --surface-2:#102743;
  --ink:#071426;
  --ink-soft:#10233a;
  --panel:#10243c;
  --line:#294361;
  --text:#edf7ff;
  --muted:#9fb6cc;
  --mint:#58d9f7;
  --cream:#e8f4ff;
  --violet:#9383ff;
}

body{
  background:
    radial-gradient(circle at 82% 5%,rgba(88,217,247,.11),transparent 30rem),
    radial-gradient(circle at 10% 88%,rgba(147,131,255,.08),transparent 34rem),
    var(--surface-0);
}

/* Keep Search, Learn, Explore, and More on one clean visual baseline. */
.topbar{background:rgba(6,20,38,.88)}
.inner-nav,.topbar-actions{align-self:center;align-items:center}
.topbar-actions{height:38px}
.compact-icon-button,.utility-menu>summary{
  width:38px!important;height:38px!important;padding:0!important;margin:0!important;
  align-items:center;justify-items:center;line-height:1!important;
}
.site-search-button::before{content:none!important;display:none!important;margin:0!important}
.compact-icon-button svg{display:block;width:19px;height:19px}
.utility-menu>summary span{display:block;transform:none!important;line-height:1}

/* Match Learn/Explore: hover reveals More, while click still works for touch/keyboard. */
.utility-menu>.utility-menu-panel{display:none}
.utility-menu[open]>.utility-menu-panel,
.utility-menu:hover>.utility-menu-panel,
.utility-menu:focus-within>.utility-menu-panel{display:block}
.utility-menu-panel{top:40px;background:rgba(10,27,49,.985);border-color:rgba(88,217,247,.18)}
.utility-menu::after{
  content:"";position:absolute;right:0;top:35px;width:220px;height:10px;pointer-events:auto;
}

/* Give the small homepage labels enough presence without competing with the headline. */
.home-cover-kicker{
  font-size:clamp(13px,1.05vw,15px)!important;
  line-height:1.35!important;
  letter-spacing:.145em!important;
  color:var(--mint)!important;
}
.home-cover-note{
  font-size:clamp(12.5px,.92vw,14px)!important;
  line-height:1.6!important;
  color:#b7c9da!important;
  max-width:650px;
}

/* Futuristic navy/cyan shell with a restrained violet secondary glow. */
.home-cover{
  border-color:rgba(88,217,247,.13);
  background:
    radial-gradient(circle at 18% 18%,rgba(88,217,247,.10),transparent 34%),
    radial-gradient(circle at 88% 78%,rgba(147,131,255,.09),transparent 30%),
    linear-gradient(145deg,rgba(12,31,53,.96),rgba(6,20,38,.97));
  box-shadow:0 22px 68px rgba(0,0,0,.22),0 0 0 1px rgba(147,131,255,.025);
}
.home-cover h1 span{color:var(--mint)}
.home-solid-action{border-color:var(--mint);background:var(--mint);box-shadow:0 8px 24px rgba(88,217,247,.10)}
.home-path-toggle[aria-expanded="true"]{box-shadow:0 0 0 3px rgba(147,131,255,.16)}
.home-path-reveal{
  border-color:rgba(88,217,247,.22);
  background:linear-gradient(145deg,rgba(7,23,42,.72),rgba(18,27,55,.52));
}
.nav-menu-panel{background:#091a30;border-color:rgba(88,217,247,.17)}
.nav-menu-panel a:hover{background:rgba(88,217,247,.065);color:var(--mint)}

/* Feather the cover art on all four sides so it visually dissolves into the hero. */
.home-cover-art{
  background:linear-gradient(145deg,rgba(10,29,50,.98),rgba(9,22,42,.96));
  box-shadow:none;
  border-radius:18px;
}
.home-cover-art img{
  -webkit-mask-image:radial-gradient(ellipse 87% 88% at 50% 50%,#000 60%,rgba(0,0,0,.98) 72%,rgba(0,0,0,.68) 84%,transparent 100%);
  mask-image:radial-gradient(ellipse 87% 88% at 50% 50%,#000 60%,rgba(0,0,0,.98) 72%,rgba(0,0,0,.68) 84%,transparent 100%);
}
.home-cover-art::after{
  background:
    linear-gradient(to right,rgba(8,24,43,.48),transparent 13%,transparent 87%,rgba(8,24,43,.48)),
    linear-gradient(to bottom,rgba(8,24,43,.32),transparent 12%,transparent 88%,rgba(8,24,43,.40));
}

/* Cyan for application chrome; nucleotide colors remain their independent A/G/C/U palette. */
.workspace-advanced-panel[open]>summary{background:rgba(88,217,247,.065);color:var(--mint)}
.workspace-empty-note{border-color:rgba(88,217,247,.36);background:rgba(7,23,42,.72)}

@media(max-width:920px){
  .topbar-actions{height:38px}
}
@media(max-width:620px){
  .home-cover-kicker{font-size:12.5px!important}
  .home-cover-note{font-size:12.5px!important}
  .home-cover-art img{
    -webkit-mask-image:radial-gradient(ellipse 94% 91% at 50% 50%,#000 63%,rgba(0,0,0,.96) 77%,transparent 100%);
    mask-image:radial-gradient(ellipse 94% 91% at 50% 50%,#000 63%,rgba(0,0,0,.96) 77%,transparent 100%);
  }
}
'''
styles_path.write_text(styles, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
old = 'styles.css?v=modern-ui-1'
new = 'styles.css?v=modern-ui-2'
if old not in index:
    raise SystemExit(f"Expected cache token {old!r} not found")
index = index.replace(old, new, 1)
index_path.write_text(index, encoding="utf-8")

print("Applied homepage/navigation polish v2")
