# Make it yours

Founders AI OS works out of the box with neutral names and a fictional demo business. This page shows what to change so it speaks as you, looks like your brand and fits how you work.

Start with the first three sections. They change the most and need no code.

## 1. Name the coach

The AI Coach speaks as the person whose teaching it learns from.

- Set `COACH_NAME` in Vercel to your full name, for example `Avery Cole`, and redeploy. The coach becomes "Avery AI", speaks as Avery in first person, and finds your lines in coaching call transcripts by that name.
- Without it, the coach is called "AI Coach".
- Optional: set `COACH_YOUTUBE_CHANNEL` to your channel ID (it starts with `UC`) so the Coach library offers your latest videos. Without it, the first YouTube channel you connect is used.

The privacy guard is in `js/coach-guard.js`. It removes personal and financial details before anything reaches the Coach library, refuses questions about your money or private life before any AI runs, and checks every answer on the way out. Keep it switched on.

## 2. Make the Playbook sound like you

The Playbook holds the answers the AI Coach gives first.

- **In the app:** Settings, then Playbook. Edit, approve or delete answers there. Approved answers are the ones the coach uses.
- **Before you import:** the 100 starter answers live in `assets/coach/playbook-starter.json`. Each entry has a topic, a question, keywords, the answer and its sources. Edit the file before you click "Add the starter answers" if you want a different starting set.
- **The Coach library:** in AI Chat, switch to Coach mode and click **Coach library** (admins only). Pick which documents, coaching calls and videos the coach learns from. It shows what the privacy filter removes before you publish.

## 3. Teach it your business

Every agent reads your business context before it writes anything.

- **Brand, then DNA:** who you are, what you sell, who you serve and how you talk.
- **Brand, then Brain:** documents, transcripts and notes. Upload your offers, sales pages and best content.
- **Brand, then Memory:** facts the OS learns as you work. Correct anything that's off.

The more you add here, the less you edit later.

## 4. The demo business

The demo shows a fictional business, Northpeak Studio, run by Avery Cole. Nothing in it is real.

- `js/seed.js` holds the demo data for most screens. Some screens keep their own demo data in a `demo` function inside their file in `js/`.
- `assets/demo-graphics/` holds the demo images.
- `FOS_ALLOW_DEMO=1` in Vercel lets the AI access (MCP) server accept the token `demo` and serve the demo business. Leave it unset on a live install.

To show prospects your own example business, replace the names and numbers in `js/seed.js` and keep the same structure.

## 5. The look

- `app.css` holds the design tokens (colors, type, spacing) for light and dark mode. Change the variables at the top first.
- `workspace.css` styles the workspace screens.
- `DESIGN.md` describes the design system. Update it when you change the look, so AI coding tools follow your new rules.
- `favicon.svg` is the browser tab icon. The logo mark is in `js/app.js` (search for `LOGO`).
- `assets/mascots/` and `js/mascots.js` hold the AI Team mascots. Replace the images and keep the file names, or update the list in `js/mascots.js`.

## 6. AI skills and frameworks

- `api/_chatprompt.js` holds AI Chat's operating prompt and its built-in skills: the 17P outline, CONVERSIONS, the Evidence Quadrant, the 3T Offer Triangle, the 3x3x3 DM system and the rest. Edit a skill's text to change how AI Chat works, or add your own skill to the `SKILLS` list. Your own skills win when they overlap with library skills.
- `api/_skill-library.json` holds the marketing, research and writing skills from three MIT licensed projects. Rebuild it with `node scripts/skills/build.cjs <folder with clones of marketingskills, no-ai-slop and last30days-skill>`. Keep their license notices.

After you change a prompt, ask AI Chat something it should now do differently and check the answer.

## 7. Time zone and schedules

- `FOS_TZ` sets your time zone for daily briefs, schedules and "today", for example `America/New_York`. Without it, the app uses UTC.
- `vercel.json` has two scheduled jobs. `/api/agents` checks for agent work every 5 minutes. `/api/cron` runs the daily job at 05:00 UTC: it syncs connections, writes the morning content ideas and sends the morning brief. Change its schedule to move it, for example `0 12 * * *` for 12:00 UTC, which is 7 or 8 in the morning in New York.

## 8. AI models

The app picks sensible models by default. Set these in Vercel only if you want different ones, then redeploy.

| Setting | What it changes |
|---|---|
| `CLAUDE_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_MODEL` | The main models for AI Chat, agents and summaries |
| `JARVIS_CLAUDE_MODEL`, `JARVIS_OPENAI_MODEL` | Jarvis, the voice assistant |
| `FUNNEL_MODEL`, `FUNNEL_OPENAI_MODEL`, `FUNNEL_CLAUDE_BUILDER`, `FUNNEL_CLAUDE_EFFORT`, `FUNNEL_CODEX_BUILDER`, `FUNNEL_GEMINI_BUILDER`, `FUNNEL_CRAFT_MS`, `FUNNEL_IMAGE_MODELS`, `FUNNEL_OPENROUTER_MODELS` | Funnel builds |
| `ELEVEN_MODEL`, `ELEVEN_BRIEF_MODEL`, `ELEVEN_REALTIME_MODEL`, `ELEVEN_VOICE` | ElevenLabs voices for Jarvis and the audio brief |
| `PPLX_MODEL`, `PPLX_RESEARCH_MODEL` | Perplexity research |

[.env.example](.env.example) lists every setting in one place.

## 9. Legal pages

`privacy.html` and `terms.html` are plain templates written for a private install run by the person who invites the users. Add your business name, a contact email and the law that applies, and have them checked if you serve paying customers. If you set up Google sign-in, Google asks for a privacy policy link when you publish the OAuth consent screen. Use `https://your-app.vercel.app/privacy.html` with your own address.

## Before you push changes

Run the checks so a typo doesn't break your live app:

```
for f in js/*.js api/*.js; do node --check "$f"; done
python3 tools/check_repo.py
```

Then commit and push. Vercel deploys the new version by itself.
