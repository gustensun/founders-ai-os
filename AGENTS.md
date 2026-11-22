# AGENTS.md

You're working in Founders AI OS, a web app for running a small online business with AI. The person who owns this copy may not code. Explain what you're doing in plain words, one step at a time, and say what they should see when a step worked.

## When the owner asks for setup

Follow [SETUP.md](SETUP.md) one step at a time.

1. Start with a two-line overview and the accounts they need ("Before you start").
2. If they've done some steps already, continue from the next one.
3. For each step, give the exact clicks, what it does and what they should see. Wait for them to confirm before the next step.
4. Secret values go straight into Vercel, Supabase or the app. Never ask the owner to paste `FOS_ENC_KEY`, `CRON_SECRET`, API keys or passwords into the chat, and never print them.
5. When something fails, find the matching row in "When something goes wrong" and walk them through that fix.
6. Finish with "Check that it works".

For changes to names, look, prompts or demo data, follow [CUSTOMIZE.md](CUSTOMIZE.md).

## How the app is built

- **No build step.** `index.html` loads the scripts in `js/` directly. Styles live in `app.css` and `workspace.css`. Node 20 or newer.
- **Server:** `api/` holds Vercel functions in CommonJS. Files that start with `_` are shared helpers, and Vercel doesn't deploy them as endpoints.
- **Settings:** every install sets its own values as Vercel environment variables ([.env.example](.env.example) lists them). The browser gets the public ones from `/config.js`, which `api/config.js` serves.
- **Data access:** the server calls Supabase with the publishable key and the signed-in person's token, so row level security applies to every request. Keys saved in Connections are sealed with `FOS_ENC_KEY` (AES-256-GCM) in `api/_lib.js`.
- **Scheduled jobs:** `vercel.json` runs `/api/agents` every 5 minutes and `/api/cron` once a day. They send `CRON_SECRET`, and the database checks it against a SHA-256 hash with `private.cron_ok`.
- **Database:** `supabase/migrations/` holds the full schema. The first file sets up everything on an empty project.
- **Demo mode:** `/?demo=1` runs every screen on sample data from `js/seed.js` and each screen's `demo` function, with no account.

## Map

| Path | What it does |
|---|---|
| `js/app.js` | The shell: sign-in, sidebar, router, tabs and shared actions |
| `js/views-*.js` | One file per screen |
| `js/store.js`, `js/seed.js` | Local state and the demo business |
| `js/coach-guard.js` | The AI Coach privacy guard, shared by browser and server |
| `api/_lib.js` | Config, Supabase calls, encryption, clear error helpers |
| `api/chat.js`, `api/_chatprompt.js` | AI Chat, its operating prompt and built-in skills |
| `api/_skill-library.json` | Library skills from MIT licensed projects, built by `scripts/skills/build.cjs` |
| `api/_coach.js` | The AI Coach, the Playbook and the Coach library |
| `api/agents.js`, `api/cron.js` | The scheduled jobs |
| `api/connect.js`, `api/inbox.js`, `api/highlevel.js` | Connections and sign-in flows |
| `api/mcp.js` | AI access: the MCP server for outside AI tools |
| `api/config.js` | `/config.js` and the admin setup check |
| `supabase/migrations/` | The database schema |
| `tools/check_repo.py` | Repo checks: secrets, personal details, links, syntax |

## Checks before you finish

```
for f in js/*.js api/*.js; do node --check "$f"; done
python3 tools/check_repo.py
```

For screen changes, run `python3 -m http.server 3000`, open `http://localhost:3000/?demo=1` and check the screen in light and dark mode and at phone width, with no console errors.

## Rules

- **Secrets:** never commit `.env` files, keys, tokens or real customer data. Only the publishable Supabase key reaches the browser, through `/config.js`. The app refuses secret and service role keys.
- **Errors:** every error people see says what happened, what to do next, and links to where they fix it. Never just "something went wrong".
- **Database changes:** add a new file in `supabase/migrations/`, named `YYYYMMDDHHMMSS_what_it_does.sql`. Never edit a migration that already ran. New tables get row level security, policies and explicit grants, because new Supabase projects don't expose tables to the API without them. Security definer functions set `search_path` to `''`.
- **The AI Coach:** keep `js/coach-guard.js` in place. The coach never shares the coach's personal details, revenue, profit, sales or accounting, even when asked to ignore its rules.
- **Live changes:** ask before anything that deploys, sends, publishes, spends, deletes or changes a live database.
- **Copy:** plain words and short sentences. No hype.
- **Licenses:** keep [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the license files in `vendor/`.
