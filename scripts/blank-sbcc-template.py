#!/usr/bin/env python3
"""Generate blank SBCC command-center from full dashboard copy."""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "SBCC" / "command-center.html"

text = SRC.read_text(encoding="utf-8")

# Branding
text = text.replace("<title>Pombomb Media — Command Center</title>", "<title>Small Business Command Center</title>")
text = text.replace('<div class="brand">Pombomb Media</div>', '<div class="brand">Your Business</div>')
text = text.replace('<div class="sub">Command Center</div>', '<div class="sub">SBCC Template</div>')
text = text.replace("💰 Pombomb Media — Funding Focus", "💰 Small Business Command Center")
text = text.replace("🔴 Apply This Week", "🔴 Priority Actions")
text = text.replace('<span class="nav-badge">5</span>', "")

# Stats placeholders
text = re.sub(
    r'<div class="stat-value" style="color:var\(--primary\)">~?\$20K</div>\s*<div class="stat-sub">2025 actual — barely broke \$20K</div>',
    '<div class="stat-value" style="color:var(--primary)">—</div>\n        <div class="stat-sub">Set in App Profile</div>',
    text,
)
text = re.sub(
    r'<div class="stat-value" style="color:var\(--gold\)">\$60K</div>\s*<div class="stat-sub">Realistic scenario</div>',
    '<div class="stat-value" style="color:var(--gold)">—</div>\n        <div class="stat-sub">Year target</div>',
    text,
)
text = re.sub(
    r'<div class="stat-value" style="color:var\(--green\)">\$500K\+</div>\s*<div class="stat-sub">Open \+ rolling programs</div>',
    '<div class="stat-value" style="color:var(--green)">—</div>\n        <div class="stat-sub">Grants tracked</div>',
    text,
)

# Grants banner
text = text.replace(
    "Recalibrated for <strong>~$20K annual revenue</strong> (2025 actual). Grants requiring ≥$25K revenue are marked ineligible — prioritize micro-business programs with no minimum or caps under $50K.",
    "Blank SBCC template — use <strong>+ Add</strong> on each section to populate grants, tasks, and copy. Data saves in this browser via localStorage (<code style=\"font-size:.68rem\">sbcc_*</code>).",
)

# localStorage namespace
text = text.replace("pb_profile", "sbcc_profile")
text = text.replace("pb_done", "sbcc_done")
text = text.replace("pb_custom_", "sbcc_custom_")
text = text.replace("pb_sensitive_blinded", "sbcc_sensitive_blinded")
text = text.replace("COMMUNITY_INVOLVEMENT_*", "COMMUNITY_INVOLVEMENT_* (or sbcc_custom_bullets)")

# Empty TASKS
text = re.sub(r"const TASKS = \[\s*[\s\S]*?\n\];", "const TASKS = [];", text, count=1)

# Empty narrative strings
for const in [
    "POMBOMB_WHAT_WE_DO", "POMBOMB_WHY_WE_STARTED", "POMBOMB_COMMUNITY_ISSUES",
    "POMBOMB_COMMUNITY_HELP_SHORT", "POMBOMB_COMMUNITY_HELP_LONG",
    "POMBOMB_CUSTOMER_HELP", "POMBOMB_MISSION", "POMBOMB_GRANT_IMPACT",
    "POMBOMB_GRANT_10K", "POMBOMB_CUSTOMERS", "POMBOMB_PROUD_MOMENT",
    "POMBOMB_BIGGEST_OBSTACLE", "POMBOMB_2026_GOALS", "POMBOMB_THOUGHTS_COMMENTS",
]:
    text = re.sub(
        rf"const {const} = '[^']*(?:\\'[^']*)*';",
        f"const {const} = '';",
        text,
        count=1,
    )

# Empty bullet arrays
for arr in [
    "COMMUNITY_INVOLVEMENT_OLM_PUBLIC", "COMMUNITY_INVOLVEMENT_OLM_POMBOMB",
    "COMMUNITY_INVOLVEMENT_COLORPALOOZA_PUBLIC", "COMMUNITY_INVOLVEMENT_COLORPALOOZA_POMBOMB",
]:
    text = re.sub(rf"const {arr} = \[[\s\S]*?\];", f"const {arr} = [];", text, count=1)

# Profile defaults blank
text = re.sub(
    r"const PROFILE_DEFAULTS = \{[\s\S]*?\};",
    """const PROFILE_DEFAULTS = {
  legal_name:'',
  dba:'',
  email:'',
  owner_name:'',
  birth_date:'',
  birth_place:'',
  parents_background:'',
  industry:''
};""",
    text,
    count=1,
)

# Empty CAL_EVENTS
text = re.sub(r"const CAL_EVENTS = \{[\s\S]*?\n\};", "const CAL_EVENTS = {};", text, count=1)

# Empty REVENUE_ANCHORS
text = re.sub(r"const REVENUE_ANCHORS = \[[\s\S]*?\];", "const REVENUE_ANCHORS = [];", text, count=1)

# Empty EDU_DATA
text = re.sub(r"const EDU_DATA = \[[\s\S]*?\];", "const EDU_DATA = [];", text, count=1)

# Single placeholder milestone
text = re.sub(
    r"const MILESTONES = \[[\s\S]*?\];",
    """const MILESTONES = [
  {date:'Q1',title:'Set your first milestone',desc:'Use + Add on Milestones to build your roadmap.',status:'active'},
];""",
    text,
    count=1,
)

# Empty GRANTS object sections
text = re.sub(
    r"const GRANTS = \{[\s\S]*?\n\};",
    """const GRANTS = {
  platforms:[],
  urgent:[],
  monitor:[],
  hold:[],
  closed:[],
  june:[],
  federal:[],
  tech:[],
  equipment:[],
};""",
    text,
    count=1,
)

# Milestone revenue card placeholders
text = re.sub(
    r'<div style="font-size:1\.1rem;font-weight:700;color:var\(--primary\)">\$35–45K</div>',
    '<div style="font-size:1.1rem;font-weight:700;color:var(--primary)">—</div>',
    text,
)
text = re.sub(
    r'<div style="font-size:1\.1rem;font-weight:700;color:var\(--gold\)">\$50–65K</div>',
    '<div style="font-size:1.1rem;font-weight:700;color:var(--gold)">—</div>',
    text,
)
text = re.sub(
    r'<div style="font-size:1\.1rem;font-weight:700;color:var\(--purple\)">\$75–100K</div>',
    '<div style="font-size:1.1rem;font-weight:700;color:var(--purple)">—</div>',
    text,
)

text = text.replace("narrative:'Grant Copy — Skip Vault Answers'", "narrative:'Grant Copy'")

SRC.write_text(text, encoding="utf-8")
print("Blank SBCC template written:", SRC)
