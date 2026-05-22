# Small Business Command Center (SBCC)

A **static, browser-only** grant and operations dashboard for small businesses — tasks, grants, application profile, grant copy, calendar, checklists, and sensitive-field blinds. No backend. No database. No npm install.

**You do not need anything installed on your computer.** Open an HTML file in any modern browser, or upload this repo to **any static web host** you like (GitHub Pages, Netlify, Cloudflare Pages, S3, cPanel, etc.). Everything runs client-side; your data stays in **localStorage** on that browser/device.

A local dev server (e.g. `python3 -m http.server`) is **optional** — useful for previewing over HTTP during development, not required for normal use.

**Live demo (GitHub Pages):** [https://platysonique.github.io/small-business-command-center/](https://platysonique.github.io/small-business-command-center/)

**Repository:** [https://github.com/platysonique/small-business-command-center](https://github.com/platysonique/small-business-command-center)

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
| `scripts/` | Optional generators to rebuild blank/mobile from a filled dashboard (developers only) |

## Features

- Dashboard, calendar, grants, checklists, education roadmap, milestones
- Application profile with copy-to-clipboard for grant forms
- Grant narrative cards with copy buttons
- **+ Add** modals to extend tasks, grants, profile fields, and copy
- **Sensitive blinds** — EIN, phone, address, DOB, etc. hidden by default with middle dots (`······`); toggle with the eye button in the top bar

Sensitive preference key: `sbcc_sensitive_blinded` (default: hidden).

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
- Nothing is sent to a server unless you choose to host the static files publicly (the HTML/JS only — not your saved profile data).
- **Copy All to Clipboard** uses real values even when sensitive fields are visually blinded.

## License

MIT — use, fork, and host freely.
