# Upload SMCC to your web host

**No build step. No server folder. No PHP.**

## Upload

Upload the **`SBCC/`** folder to your host (or zip and extract in cPanel):

```
your-secret-folder/
  command-center.html    ← bookmark this
  mobile/
  js/
```

Use an obscure path, e.g. `https://yourdomain.com/x7k/private/smcc/command-center.html`

Optional: rename `.htaccess.example` to `.htaccess` and add password protection.

## AI — paste keys once

Open **AI Settings** in the sidebar:

1. **Agent provider** — OpenAI or Anthropic key (chat + form fill)
2. **Perplexity** — key for web/grant research

Same idea as MCP: you type credentials, the page handles the rest. Keys stay in **your browser** only.

## Offline vs online

| Always works | Needs internet |
|--------------|----------------|
| Tasks, profile, grants, void log, search bar | AI chat & Perplexity research |

Open the same bookmark on your phone or laptop — same page, same data on that device (localStorage).

## Local use

Double-click `command-center.html` or open via any simple local server. **No Node, no npm, no build.**

See README disclaimer — protect your secret URL; you are responsible for your data.
