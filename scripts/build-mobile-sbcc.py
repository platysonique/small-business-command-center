#!/usr/bin/env python3
"""Create mobile-first SBCC command center from desktop blank template."""
from pathlib import Path

DESKTOP = Path(__file__).resolve().parents[1] / "SBCC" / "command-center.html"
MOBILE = Path(__file__).resolve().parents[1] / "SBCC" / "mobile" / "command-center.html"

text = DESKTOP.read_text(encoding="utf-8")

text = text.replace(
    "<title>Small Business Command Center</title>",
    "<title>SBCC Mobile</title>",
)
text = text.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="theme-color" content="#171614">',
)
text = text.replace("<body>", '<body class="sbcc-mobile">')

mobile_css = """
/* MOBILE-FIRST (SBCC) */
body.sbcc-mobile{display:block;min-height:100dvh;padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}
body.sbcc-mobile .sidebar{display:none}
body.sbcc-mobile .main{min-height:100dvh;width:100%}
body.sbcc-mobile .topbar{padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top,0px));flex-wrap:wrap;gap:8px}
body.sbcc-mobile .topbar .status-pills .pill{display:none}
body.sbcc-mobile .topbar .status-pills{gap:6px;margin-left:auto}
body.sbcc-mobile .view{padding:16px;padding-bottom:24px}
body.sbcc-mobile .stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
body.sbcc-mobile .stat-value{font-size:1.25rem}
body.sbcc-mobile .link-grid{grid-template-columns:1fr}
body.sbcc-mobile .profile-grid{grid-template-columns:1fr}
body.sbcc-mobile .section-heading{font-size:.85rem;margin:22px 0 10px;flex-wrap:wrap}
body.sbcc-mobile .btn-add,.body.sbcc-mobile .btn-secondary,.body.sbcc-mobile .btn-primary{min-height:40px;font-size:.8rem}
body.sbcc-mobile .task-item{padding:10px 12px}
body.sbcc-mobile .cal-day{min-height:52px}
body.sbcc-mobile .edu-table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
body.sbcc-mobile .modal-box{max-height:85dvh;border-radius:var(--r-lg) var(--r-lg) 0 0;margin-top:auto;align-self:flex-end}
body.sbcc-mobile .modal-overlay{align-items:flex-end;padding:0}
.mobile-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:150;display:flex;background:var(--surface);border-top:1px solid var(--border);padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -4px 16px rgba(0,0,0,.15)}
.mobile-nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 4px 10px;font-size:.58rem;color:var(--muted);min-height:56px;border-left:1px solid var(--divider)}
.mobile-nav-btn:first-child{border-left:none}
.mobile-nav-btn .nav-dot{width:7px;height:7px}
.mobile-nav-btn.active{color:var(--primary);background:var(--primary-hl);font-weight:600}
.mobile-nav-more{position:relative}
.mobile-more-sheet{position:fixed;inset:0;z-index:160;background:rgba(0,0,0,.5);display:none;align-items:flex-end}
.mobile-more-sheet.open{display:flex}
.mobile-more-panel{width:100%;background:var(--surface);border-top:1px solid var(--border);border-radius:var(--r-lg) var(--r-lg) 0 0;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));max-height:70dvh;overflow-y:auto}
.mobile-more-panel h3{font-size:.85rem;margin-bottom:12px}
.mobile-more-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.mobile-more-grid button{display:flex;align-items:center;gap:8px;padding:12px;background:var(--offset);border:1px solid var(--border);border-radius:var(--r);font-size:.78rem;text-align:left}
"""

text = text.replace("/* MOBILE */", mobile_css + "\n/* DESKTOP FALLBACK */")

bottom_nav = """
<nav class="mobile-bottom-nav" aria-label="Main navigation">
  <button type="button" class="mobile-nav-btn active" data-mobile-view="dashboard" onclick="mobileSwitchView('dashboard')">
    <span class="nav-dot" style="background:var(--primary)"></span>Home
  </button>
  <button type="button" class="mobile-nav-btn" data-mobile-view="narrative" onclick="mobileSwitchView('narrative')">
    <span class="nav-dot" style="background:var(--primary)"></span>Copy
  </button>
  <button type="button" class="mobile-nav-btn" data-mobile-view="grants" onclick="mobileSwitchView('grants')">
    <span class="nav-dot" style="background:var(--green)"></span>Grants
  </button>
  <button type="button" class="mobile-nav-btn" data-mobile-view="checklist" onclick="mobileSwitchView('checklist')">
    <span class="nav-dot" style="background:var(--orange)"></span>Tasks
  </button>
  <button type="button" class="mobile-nav-btn mobile-nav-more" onclick="toggleMobileMore()">
    <span class="nav-dot" style="background:var(--purple)"></span>More
  </button>
</nav>
<div class="mobile-more-sheet" id="mobile-more-sheet" onclick="if(event.target===this)toggleMobileMore(false)">
  <div class="mobile-more-panel">
    <h3>More views</h3>
    <div class="mobile-more-grid">
      <button type="button" onclick="mobileSwitchView('calendar');toggleMobileMore(false)"><span class="nav-dot" style="background:var(--gold)"></span>Calendar</button>
      <button type="button" onclick="mobileSwitchView('profile');toggleMobileMore(false)"><span class="nav-dot" style="background:var(--blue)"></span>App Profile</button>
      <button type="button" onclick="mobileSwitchView('education');toggleMobileMore(false)"><span class="nav-dot" style="background:var(--blue)"></span>Education</button>
      <button type="button" onclick="mobileSwitchView('milestones');toggleMobileMore(false)"><span class="nav-dot" style="background:var(--purple)"></span>Milestones</button>
      <button type="button" onclick="mobileSwitchView('ai-settings');toggleMobileMore(false)"><span class="nav-dot" style="background:var(--primary)"></span>AI Settings</button>
    </div>
  </div>
</div>
"""

mobile_js = """
function mobileSwitchView(name){
  switchView(name);
  document.querySelectorAll('.mobile-nav-btn[data-mobile-view]').forEach(btn=>{
    btn.classList.toggle('active',btn.getAttribute('data-mobile-view')===name);
  });
}
function toggleMobileMore(open){
  const sheet=document.getElementById('mobile-more-sheet');
  if(!sheet)return;
  if(open===undefined)sheet.classList.toggle('open');
  else sheet.classList.toggle('open',!!open);
}
const _switchViewOrig=switchView;
switchView=function(name){
  _switchViewOrig(name);
  document.querySelectorAll('.mobile-nav-btn[data-mobile-view]').forEach(btn=>{
    btn.classList.toggle('active',btn.getAttribute('data-mobile-view')===name);
  });
};
"""

text = text.replace("</main>", "</main>\n" + bottom_nav)
text = text.replace(
    "function toggleTheme(){",
    mobile_js + "\nfunction toggleTheme(){",
)

# Add theme toggle to topbar on mobile (sidebar hidden)
text = text.replace(
    '<div class="topbar">\n    <h1 id="view-title">Dashboard</h1>',
    '<div class="topbar">\n    <h1 id="view-title">Dashboard</h1>\n    <button class="theme-btn" type="button" onclick="toggleTheme()" aria-label="Toggle theme" title="Toggle theme" style="margin-left:auto"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>',
)

text = text.replace(
    '<link rel="stylesheet" href="js/sbcc-ai.css">',
    '<link rel="stylesheet" href="../js/sbcc-ai.css">',
)
text = text.replace(
    '<link rel="stylesheet" href="js/sbcc-void-search.css">',
    '<link rel="stylesheet" href="../js/sbcc-void-search.css">',
)
text = text.replace(
    '<script src="js/sbcc-ai-agent.js"></script>',
    '<script src="../js/sbcc-ai-agent.js"></script>',
)
text = text.replace(
    '<script src="js/sbcc-ai.js"></script>',
    '<script src="../js/sbcc-ai.js"></script>',
)
text = text.replace(
    '<script src="js/sbcc-void-search.js"></script>',
    '<script src="../js/sbcc-void-search.js"></script>',
)

MOBILE.write_text(text, encoding="utf-8")
print("Mobile SBCC written:", MOBILE)
