#!/usr/bin/env python3
"""Inject AI assistant hooks into a dashboard HTML file."""
import sys
from pathlib import Path

def inject(path: Path, js_prefix: str):
    text = path.read_text(encoding="utf-8")
    if "sbcc-ai.js" in text:
        print("already injected", path)
        return

    text = text.replace(
        "</style>\n</head>",
        f'</style>\n<link rel="stylesheet" href="{js_prefix}sbcc-ai.css">\n</head>',
        1,
    )

    nav_anchor = """    <button class="nav-item" onclick="switchView('milestones')">"""
    nav_insert = nav_anchor + """
      <span class="nav-dot" style="background:var(--purple)"></span>
      <span>Milestones</span>
    </button>
    <div class="nav-section">AI</div>
    <button class="nav-item" onclick="switchView('ai-settings')">
      <span class="nav-dot" style="background:var(--primary)"></span>
      <span>AI Settings</span>
    </button>
  </nav>"""
    # Only if not already has ai-settings
    if "ai-settings" not in text:
        text = text.replace(
            nav_anchor + """
      <span class="nav-dot" style="background:var(--purple)"></span>
      <span>Milestones</span>
    </button>
  </nav>""",
            nav_insert,
            1,
        )

    ai_view = """
  <!-- AI SETTINGS VIEW -->
  <div class="view" id="view-ai-settings">
    <div class="section-heading" style="margin-top:0">🤖 AI Assistant Settings</div>
    <div class="card" style="margin-bottom:16px">
      <p style="font-size:.78rem;color:var(--muted);line-height:1.55;margin-bottom:12px">Connect providers, control sensitive data, and point at your AI backend.</p>
    </div>
    <div id="ai-settings-form"></div>
    <span id="ai-settings-saved" style="font-size:.75rem;color:var(--green)"></span>
  </div>

</main>"""
    if 'id="view-ai-settings"' not in text:
        text = text.replace(
            "    <div class=\"timeline\" id=\"milestones-timeline\"></div>\n  </div>\n\n</main>",
            "    <div class=\"timeline\" id=\"milestones-timeline\"></div>\n  </div>" + ai_view,
            1,
        )

    text = text.replace(
        "milestones:'12-Month Milestones'};",
        "milestones:'12-Month Milestones','ai-settings':'AI Settings'};",
        1,
    )

    text = text.replace(
        "</script>\n</body>",
        f'</script>\n<script src="{js_prefix}sbcc-ai.js"></script>\n</body>',
        1,
    )

    path.write_text(text, encoding="utf-8")
    print("injected", path)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    inject(root / "Pombomb Media" / "pombomb-dashboard.html", "../SBCC/js/")
    print("done")
