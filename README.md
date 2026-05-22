# Small Business Command Center (SBCC)

A **static, browser-only** grant and operations dashboard for small businesses — tasks, grants, application profile, grant copy, calendar, checklists, sensitive-field blinds, and an **optional AI assistant**.

**You do not need anything installed** to use the dashboard. Open an HTML file in any browser, or upload to **any static web host** (GitHub Pages, Netlify, Cloudflare Pages, S3, cPanel, etc.). Data stays in **localStorage**.

The **AI chat bubble** is optional — run the Node backend in `server/` and configure providers in **AI Settings**.

A local dev server (e.g. `python3 -m http.server`) is **optional** — useful for previewing over HTTP during development, not required for normal use.

**Live demo (GitHub Pages):** [https://platysonique.github.io/small-business-command-center/](https://platysonique.github.io/small-business-command-center/)

**Repository:** [https://github.com/platysonique/small-business-command-center](https://github.com/platysonique/small-business-command-center)

## Disclaimer — use at your own risk

**This software is provided as-is. Use is entirely at your discretion.**

- SBCC stores business data (EIN, phone, address, grant details, etc.) in **your browser’s localStorage**. Nothing is encrypted by default.
- **Hosting this dashboard online is not recommended** unless you understand the risks and have taken steps to protect access (private hosting, authentication in front of the site, device encryption, etc.).
- **You are responsible for your own data protection** — what you enter, where you host it, who can access your devices, and whether you enable the optional AI assistant.
- The authors and contributors **do not** guarantee security, compliance (HIPAA, PCI, etc.), or suitability for any regulated use case.
- The optional AI backend sends configured API requests to third-party providers; sensitive fields are redacted unless you explicitly enable **FULL ACCESS** in AI Settings.

If in doubt, run the dashboard **locally on your own machine** (open the HTML file or a private local server) and do not publish a copy containing real business data.

## Deploy to your personal web hosting (integrated)

**One upload folder** — dashboard + PHP API + research layer on **your domain**. No separate backend URL to configure.

```bash
python3 scripts/build-hosting-bundle.py
```

Upload everything in `hosting-bundle/` to a secret folder on your host (PHP + curl required). Open your personal link — AI Settings backend stays **`auto`**.

Full guide: **[DEPLOY.md](DEPLOY.md)**

Local same-as-hosting test:

```bash
python3 scripts/build-hosting-bundle.py
cd server && npm start
# http://127.0.0.1:3921/command-center.html
```

## Quick start (zero install)

**Option A — open the file**

1. Download or clone this repo (or just the `SBCC/` folder).
2. Double-click **`index.html`** (picker page) or **`SBCC/command-center.html`** (desktop) / **`SBCC/mobile/command-center.html`** (mobile).

**Option B — host it online**

1. Upload the repo (or zip the contents) to any static host.
2. Point your site root at **`index.html`**, or link directly to the HTML files under `SBCC/`.

Works fully offline after the first load (fonts load from Google Fonts when online; the app still functions with system fonts if offline).

## What’s in the repo

| Path | Purpose |
|------|---------|
| `index.html` | Landing page — links to desktop and mobile dashboards |
| `SBCC/command-center.html` | **Blank template** — desktop layout, empty data, `sbcc_*` localStorage |
| `SBCC/mobile/command-center.html` | **Blank mobile** — bottom nav, same features |
| `SBCC/js/sbcc-ai.js` + `sbcc-ai.css` | Draggable AI chat bubble + settings UI |
| `SBCC/js/sbcc-void-search.js` + `sbcc-void-search.css` | Void audit trail + global search |
| `server/` | **Optional AI backend** — Perplexity search, OpenAI/Anthropic agents, form-fill tools |
| `scripts/` | Generators to rebuild blank/mobile from a filled dashboard |

## Features

- Dashboard, calendar, grants, checklists, education roadmap, milestones
- Application profile with copy-to-clipboard for grant forms
- Grant narrative cards with copy buttons
- **+ Add** modals to extend tasks, grants, profile fields, and copy
- **Sensitive blinds** — EIN, phone, address, DOB, etc. hidden by default with middle dots (`······`); toggle with the eye button in the top bar

Sensitive preference key: `sbcc_sensitive_blinded` (default: hidden).

## AI Assistant (optional)

Floating **draggable chat bubble** on every dashboard page:

| Question type | Behavior |
|---------------|----------|
| **Your data** (“summarize my tasks”, “what’s in my profile?”) | Agent provider synthesizes from command center context |
| **Search / research** (grants, deadlines, external facts) | **Research assistant** — Perplexity when keyed; otherwise a **background layer** (hidden iframe under the page — AI reads/clicks there; you keep working on top) |
| **Form fill** (“fill my industry field”, “add this grant”) | Agent provider tools update profile, tasks, grants, narratives |

**Architecture:** One **agent provider** (OpenAI or Anthropic) handles chat and tools. **Perplexity is not an agent** — it is the research assistant for web search only.

### Privacy

- Sensitive fields (EIN, phone, address, DOB, etc.) are **redacted** before any API call unless you enable **FULL ACCESS** in AI Settings.
- API keys are stored in **your browser** (`sbcc_ai_settings`) and sent only to **your** backend URL.
- The static GitHub Pages site does **not** include your keys or profile data.

### Run the AI backend

```bash
cd server
cp .env.example .env   # optional server-side keys
npm start              # http://localhost:3921
```

Then open the dashboard, go to **AI Settings**, set backend URL (bottom of page), pick **one agent provider**, add:

- **OpenAI or Anthropic key** (required — runs the agent)
- **Perplexity API key** (recommended for research — optional if background layer is on)
- **Backend running** (`npm start` in `server/`) — required for the research layer proxy

Deploy `server/` to any Node host (Railway, Render, Fly.io, VPS) and point AI Settings at your deployed URL.

### Provider plug-in architecture

The backend supports pluggable providers (`server/lib/providers.js`):

- **Perplexity** — `sonar-pro` web-grounded search (mandatory for research)
- **OpenAI** — tool-calling agent
- **Anthropic** — tool-calling agent
- **Google** — reserved in settings UI for future plug-in

## Host anywhere (examples)

### GitHub Pages

1. Push this repo to GitHub (public).
2. **Settings → Pages → Build and deployment → Source:** Deploy from branch.
3. Branch: `main`, folder: `/ (root)`.
4. Your site: `https://<user>.github.io/<repo>/` → open `index.html` or `SBCC/command-center.html`.

### Netlify / Cloudflare Pages / Vercel

- **Build command:** none  
- **Publish directory:** `.` (repo root) or upload the folder as-is  
- No environment variables or serverless functions needed.

### Any web host

Upload via FTP/SFTP or file manager. As long as the host serves static `.html` files, SBCC works.

## Optional: local HTTP server (development only)

Not required for end users. Handy if you want `http://localhost` URLs while editing:

```bash
cd SBCC
python3 -m http.server 9876
# http://127.0.0.1:9876/command-center.html
# http://127.0.0.1:9876/mobile/command-center.html
```

Or from repo root:

```bash
python3 -m http.server 9876
# http://127.0.0.1:9876/index.html
```

## Regenerate templates (developers)

If you maintain a filled dashboard locally and want to refresh the blank templates:

```bash
python3 scripts/blank-sbcc-template.py
python3 scripts/build-mobile-sbcc.py
```

Requires Python 3 only — still no app server.

## Privacy

- Data is stored in **your browser’s localStorage** (`sbcc_profile`, `sbcc_done`, `sbcc_custom_*`, etc.).
- Nothing is sent to a server unless you enable the **AI assistant** and configure a backend + API keys.
- **Copy All to Clipboard** uses real values even when sensitive fields are visually blinded.
- See **Disclaimer** above — online hosting of copies with real data is not recommended unless you protect access yourself.

## License

MIT — use, fork, and host freely.
