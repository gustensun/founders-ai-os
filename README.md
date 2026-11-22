# Founders AI OS

Founders AI OS is a web app for running a small online business with AI. It puts a voice assistant, AI Chat, a team of AI agents, content research, funnels, programs, a CRM and your numbers in one place. You host your own copy on Vercel and Supabase, so the code, the data and the keys belong to you.

The app is trained on a set of business frameworks: the 17P funnel sections, the CONVERSIONS checklist, the Funnel Formula, the 11 Step Conversion Checklist, offer design, content and closing scripts. AI Chat and the AI Coach work from them, and the Playbook comes with 100 starter answers built on them.

New here? Read [START-HERE.md](START-HERE.md) first. It takes 5 minutes.

## Look around first

Every screen has demo data for a made-up business, Northpeak Studio, run by Avery Cole. You can click through all of it on your own computer before you set anything up:

```
python3 -m http.server 3000
```

Then open `http://localhost:3000/?demo=1` in your browser. The demo uses sample data only and doesn't need an account or any keys.

## What's inside

| Area | Screens |
|---|---|
| Command | Jarvis, the voice assistant. AI Chat, with the AI Team, the AI Coach and the studios for graphics, emails, video and funnel builds. The Newsfeed, where drafts wait for your approval. |
| Build | Content (board, research, creators, content funnel, proven posts), Brand (DNA, Brain and memory), Funnels and the Vault, Programs |
| Run | Revenue and affiliate numbers, CRM, Calls, and Systems: agents, routines, connections, AI access over MCP and your data |
| Settings | Your account, Access (who can sign in) and the Playbook (the answers the AI Coach uses first) |

## Frameworks inside

AI Chat, the AI Team and the AI Coach work from these, and the Playbook's 100 starter answers explain them.

| Area | Frameworks |
|---|---|
| Funnels and pages | The Funnel Formula, the 17P outline and the 10P sales page, the CONVERSIONS check, the 11 Step Conversion Checklist, the Profit Maximizer, the VSL Framework |
| Offers | The Golden Offer Quadrant, the 3T Offer Triangle (Transformation, Timeline, Trust), the Evidence Quadrant |
| Content and brand | The CONTENT framework, Discovery Content, Personal Branding Mastery, the 9 Story Selling Frameworks |
| Ads and sales | The Winning Ad Formula, the 3x3x3 DM system, the Client Closing Scripts |
| Business | The 6 Figure Founder Blueprint, the Ultimate Business Map, the 3 Freedom Fastlanes |

AI Chat also carries a library of marketing, research and writing skills from three MIT licensed open source projects, credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## What you need

- **Vercel Pro, $20 a month.** The agents check for work every 5 minutes and AI Chat runs tasks that take up to 13 minutes. The free Hobby plan runs scheduled jobs once a day and stops functions after 5 minutes. [SETUP.md](SETUP.md#what-it-costs) has the details and sources.
- **Supabase.** The free plan is fine while you set up and test.
- **A Claude or OpenAI API key.** AI Chat, Jarvis and the agents need at least one.
- **Optional:** HighLevel, YouTube, Google, ElevenLabs, Perplexity, Stripe and the other services on the Connections screen. Add them when you need them.

## Set it up

1. [SETUP.md](SETUP.md) takes you from this repository to your own live app in about an hour. No coding needed.
2. [CUSTOMIZE.md](CUSTOMIZE.md) shows how to make it yours: the coach name, the Playbook, your brand, the demo data and the legal pages.

Using Claude Code? Open the folder, run `claude` and type `/setup`. Codex, Cursor and Gemini CLI read [AGENTS.md](AGENTS.md), so you can say "help me set up Founders AI OS" and they follow the same steps.

## Privacy and safety

- Your data lives in your own Supabase project. Keys you save on the Connections screen are encrypted with your own `FOS_ENC_KEY` before they're stored.
- The browser only ever gets the publishable Supabase key. Row level security in the database decides what each person can read and change.
- The first person to sign up becomes the admin. Everyone after that waits until the admin approves them on the Access screen.
- The AI Coach doesn't share personal details, revenue, profit, sales or accounting, even when someone asks it to ignore its rules.
- Errors tell you what to do next and link to the place where you fix it.

## Folder map

| Path | What's in it |
|---|---|
| `index.html`, `app.css`, `workspace.css`, `js/` | The app in the browser. No build step. |
| `api/` | Vercel functions: AI Chat, agents, connections, the MCP server, scheduled jobs |
| `supabase/migrations/` | The database setup, one SQL file |
| `assets/` | Mascots, demo graphics and the Playbook starter answers |
| `vendor/` | Two browser libraries with their licenses |
| `scripts/skills/` | Rebuilds the AI Chat skill library from its source repositories |
| `tools/check_repo.py` | The checks to run before you commit changes |

## Credits and license

Created by Gusten Sun. You can use your copy for your own business and for your clients, and change anything in it. You can't sell or share the code, or publish it as a template or a product of your own. The full terms are in [LICENSE](LICENSE). Outside code and skills keep their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
