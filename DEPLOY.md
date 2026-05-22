# Deploy SMCC to your personal web hosting

One folder. One secret URL. Dashboard + AI + background research layer — **same origin**, no second server to configure.

## What you upload

Run locally (optional):

```bash
python3 scripts/build-hosting-bundle.py
```

Upload **everything inside** `hosting-bundle/` to a folder on your host, for example:

`https://yourdomain.com/private/smcc/`

Your personal link:

- **Desktop:** `https://yourdomain.com/private/smcc/command-center.html`
- **Mobile:** `https://yourdomain.com/private/smcc/mobile/command-center.html`

## Requirements (typical free hosting)

| Requirement | Why |
|-------------|-----|
| **PHP 7.4+** with **curl** | Integrated AI API (`api/chat.php`, research proxy) |
| **HTTPS** | Recommended; required for service worker offline shell |
| **Secret path** | Obscure folder name; optional password via `.htaccess` |

No Node.js required on the host.

## Keep it private

1. Use a non-guessable folder name (`/x7k2-smcc/`, not `/command-center/`).
2. Copy `.htaccess.example` → `.htaccess` and enable HTTP Basic Auth if your host supports it.
3. Do not link the page from your public homepage.
4. `X-Robots-Tag: noindex` is included in the example htaccess.

## AI Settings — zero config

**Backend URL** defaults to **Auto (same site)**. The app calls `/api/` next to your HTML files. You only add:

- OpenAI or Anthropic key (agent)
- Perplexity key (optional, better research)

## Background research layer

Because dashboard and `api/research/proxy.php` are on **your domain**, the hidden iframe can read and click — the AI browses underneath; you keep using the command center on top.

## Offline vs online

| Feature | Offline (cached) | Needs internet |
|---------|------------------|----------------|
| Tasks, profile, grants, void log | Yes (localStorage + cached shell) | — |
| AI chat | — | Yes |
| Web research layer | — | Yes |

Install/add to home screen after first visit (HTTPS) for app-like access on phone.

## Local test (same as hosting)

```bash
python3 scripts/build-hosting-bundle.py
cd server && npm start
```

Open `http://127.0.0.1:3921/command-center.html` — Node serves the same bundle + API paths as PHP on your host.

## Data stays yours

All business data is in **your browser** on each device. The PHP API only forwards AI requests using **your** API keys — it does not store your profile on the server.

See README **Disclaimer** — you are responsible for protecting your secret URL and device.
