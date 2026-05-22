#!/usr/bin/env python3
"""Patch SBCC HTML dashboards: clipboard fallback + safe localStorage init."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CLIPBOARD_FN = """
// ============================================================
// CLIPBOARD (works on HTTPS, localhost, and file://)
// ============================================================
function copyToClipboard(text, feedback, successLabel){
  const msgEl=typeof feedback==='string'?document.getElementById(feedback):feedback;
  const okLabel=successLabel||'Copied ✓';
  const show=(ok,errMsg)=>{
    if(!msgEl)return;
    msgEl.textContent=ok?okLabel:(errMsg||'Copy failed');
    msgEl.style.color=ok?'var(--green)':'var(--red)';
    setTimeout(()=>{msgEl.textContent='';msgEl.style.color='var(--green)'},2500);
  };
  const str=String(text??'');
  const fallback=()=>{
    try{
      const ta=document.createElement('textarea');
      ta.value=str;
      ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0,str.length);
      const ok=document.execCommand('copy');
      document.body.removeChild(ta);
      show(!!ok,ok?null:'Copy blocked — try HTTPS or select text manually');
      return Promise.resolve(!!ok);
    }catch(e){
      show(false,'Copy not available in this browser');
      return Promise.resolve(false);
    }
  };
  if(navigator.clipboard&&window.isSecureContext){
    return navigator.clipboard.writeText(str).then(()=>show(true)).catch(()=>fallback());
  }
  return fallback();
}
""".strip()

COPY_REPLACEMENTS = [
    ("copyWhatWeDo", "POMBOMB_WHAT_WE_DO", "what-we-do-copy-msg"),
    ("copyWhyWeStarted", "POMBOMB_WHY_WE_STARTED", "why-we-started-copy-msg"),
    ("copyCommunityIssues", "POMBOMB_COMMUNITY_ISSUES", "community-issues-copy-msg"),
    ("copyCommunityHelpShort", "POMBOMB_COMMUNITY_HELP_SHORT", "community-help-short-copy-msg"),
    ("copyCommunityHelpLong", "POMBOMB_COMMUNITY_HELP_LONG", "community-help-long-copy-msg"),
    ("copyCommunityInvolvement", "formatCommunityInvolvementCopy()", "community-involvement-copy-msg"),
    ("copyCustomerHelp", "POMBOMB_CUSTOMER_HELP", "customer-help-copy-msg"),
    ("copyMission", "POMBOMB_MISSION", "mission-copy-msg"),
    ("copyGrantImpact", "POMBOMB_GRANT_IMPACT", "grant-impact-copy-msg"),
    ("copyGrant10k", "POMBOMB_GRANT_10K", "grant-10k-copy-msg"),
    ("copyCustomers", "POMBOMB_CUSTOMERS", "customers-copy-msg"),
    ("copyProudMoment", "POMBOMB_PROUD_MOMENT", "proud-moment-copy-msg"),
    ("copyBiggestObstacle", "POMBOMB_BIGGEST_OBSTACLE", "biggest-obstacle-copy-msg"),
    ("copy2026Goals", "POMBOMB_2026_GOALS", "goals-2026-copy-msg"),
    ("copyThoughtsComments", "POMBOMB_THOUGHTS_COMMENTS", "thoughts-comments-copy-msg"),
]

COPY_PROFILE_FN = (
    "function copyProfile(){\n"
    "  const p=loadProfile();\n"
    "  const lines=PROFILE_FIELDS.map(f=>`${f.label}: ${p[f.key]||''}`).join(String.fromCharCode(10));\n"
    "  copyToClipboard(lines,'profile-save-msg','Copied to clipboard ✓');\n"
    "}"
)

COPY_CUSTOM_FN = """function copyCustomNarrative(id,part){
  const items=loadPbStore('{narr_key}',[]);
  const item=items.find(x=>x.id===id);
  if(!item)return;
  let text=item.body;
  if(part==='shortBody')text=item.shortBody;
  if(part==='longBody')text=item.longBody;
  copyToClipboard(text||'','copy-'+id);
}"""


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    ns = "sbcc" if "sbcc_done" in text else "pb"

    if "function copyToClipboard" not in text:
        marker = "// ============================================================\n// COMPANY OVERVIEW"
        if marker in text:
            text = text.replace(marker, CLIPBOARD_FN + "\n\n" + marker, 1)
        else:
            raise SystemExit(f"No insert marker in {path}")

    text = re.sub(
        r"let done = JSON\.parse\(localStorage\.getItem\('(?:sbcc|pb)_done'\) \|\| '\[\]'\);\s*\n// fallback to in-memory if storage blocked\s*\nlet doneMem = \[\.\.\.done\];",
        f"let doneMem=[];\ntry{{doneMem=JSON.parse(localStorage.getItem('{ns}_done')||'[]')}}catch(e){{}}",
        text,
    )

    for fn, var, msg_id in COPY_REPLACEMENTS:
        pattern = rf"function {fn}\(\){{\s*navigator\.clipboard\.writeText\([\s\S]*?\)\.catch\(\(\)=>\{{\}}\);\s*}}"
        replacement = f"function {fn}(){{copyToClipboard({var},'{msg_id}');}}"
        text, n = re.subn(pattern, replacement, text, count=1)
        if n == 0 and f"function {fn}()" in text and f"copyToClipboard({var}" not in text:
            print(f"  WARN: could not patch {fn} in {path.name}")

    if "copyToClipboard(lines,'profile-save-msg'" not in text:
        text = re.sub(
            r"function copyProfile\(\){[\s\S]*?}\s*\n\s*function renderProfileForm",
            COPY_PROFILE_FN + "\n\nfunction renderProfileForm",
            text,
            count=1,
        )

    narr_key = f"{ns}_custom_narratives"
    custom_fn = COPY_CUSTOM_FN.replace("{narr_key}", narr_key)
    text = re.sub(
        r"function copyCustomNarrative\(id,part\){[\s\S]*?navigator\.clipboard\.writeText\(text\|\|''\)\.catch\(\(\)=>\{\}\);\s*}",
        custom_fn,
        text,
        count=1,
    )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    targets = [
        ROOT / "SBCC" / "command-center.html",
        ROOT / "Pombomb Media" / "pombomb-dashboard.html",
    ]
    for t in targets:
        if not t.exists():
            print("skip (missing):", t)
            continue
        changed = patch_file(t)
        print(("patched" if changed else "unchanged"), t.relative_to(ROOT))


if __name__ == "__main__":
    main()
