# Small Business Command Center (SBCC)

A **static HTML** grant and operations dashboard — tasks, grants, profile, checklists, void audit, and **optional AI** (runs in the browser; paste API keys like MCP).

**Nothing to install or build.** Upload the `SBCC/` folder to your web host, or open `command-center.html` locally. Data stays in **localStorage**.

**Repository:** [https://github.com/platysonique/small-business-command-center](https://github.com/platysonique/small-business-command-center)

Upload guide: **[DEPLOY.md](DEPLOY.md)**

## Disclaimer — use at your own risk

**This software is provided as-is. Use is entirely at your discretion.**

- SBCC stores business data (EIN, phone, address, grant details, etc.) in **your browser’s localStorage**. Nothing is encrypted by default.
- **Hosting this dashboard online is not recommended** unless you understand the risks and have taken steps to protect access (private hosting, authentication in front of the site, device encryption, etc.).
- **You are responsible for your own data protection** — what you enter, where you host it, who can access your devices, and whether you enable the optional AI assistant.
- The authors and contributors **do not** guarantee security, compliance (HIPAA, PCI, etc.), or suitability for any regulated use case.
- The optional AI calls **your** provider APIs directly from the browser using keys you save in AI Settings; sensitive fields are redacted unless you enable **FULL ACCESS**.

If in doubt, use a **secret folder URL** on your host and do not share the link.

## Quick start

1. Open **`SBCC/command-center.html`** (or upload `SBCC/` to your host — see [DEPLOY.md](DEPLOY.md)).
2. **AI Settings** → paste OpenAI/Anthropic + Perplexity keys.
3. Done.

## What’s in the repo

| Path | Purpose |
|------|---------|
| `SBCC/command-center.html` | Desktop command center |
| `SBCC/mobile/command-center.html` | Mobile layout |
| `SBCC/js/sbcc-ai-agent.js` | AI logic (browser — no server) |
| `SBCC/js/sbcc-ai.js` + `sbcc-ai.css` | Chat UI + settings |
| `SBCC/js/sbcc-void-search.js` | Void audit + global search |
| `server/` | *Optional* — dev-only Node mirror; **not required to upload or run** |

## Features

- Dashboard, calendar, grants, checklists, education roadmap, milestones
- Application profile with copy-to-clipboard for grant forms
- Grant narrative cards with copy buttons
- **+ Add** modals to extend tasks, grants, profile fields, and copy
- **Sensitive blinds** — EIN, phone, address, DOB, etc. hidden by default with middle dots (`······`); toggle with the eye button in the top bar

Sensitive preference key: `sbcc_sensitive_blinded` (default: hidden).

## AI Assistant

Paste keys in **AI Settings** — no server, no backend URL.

| Role | Provider | What it does |
|------|----------|--------------|
| **Agent** | OpenAI or Anthropic (pick one) | Chat, summarize your data, fill forms, add tasks/grants |
| **Research assistant** | Perplexity | Web search, grant research, citations |

### Privacy

- Keys live in **your browser** (`sbcc_ai_settings` / `pb_ai_settings`).
- Sensitive fields redacted before API calls unless **FULL ACCESS** is on.

## Regenerate templates (developers)

If you maintain a filled dashboard locally and want to refresh the blank templates:

```bash
python3 scripts/blank-sbcc-template.py
python3 scripts/build-mobile-sbcc.py
```

Requires Python 3 only — still no app server.

## Privacy

- Data is stored in **your browser’s localStorage** (`sbcc_profile`, `sbcc_done`, `sbcc_custom_*`, etc.).
- Nothing is sent anywhere unless you use **AI** (then calls go to OpenAI/Anthropic/Perplexity with your keys).
- **Copy All to Clipboard** uses real values even when sensitive fields are visually blinded.
- See **Disclaimer** above — online hosting of copies with real data is not recommended unless you protect access yourself.

## License

MIT — use, fork, and host freely.
