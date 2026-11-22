# Set up Founders AI OS

This guide takes you from this repository to your own live app at your own web address. You own all of it: the code, the database, the hosting and every API key.

Plan on about an hour the first time. You don't need to know how to code. You copy and paste a few values between websites, and every step says exactly where.

Using Claude Code? Open this folder, run `claude` and type `/setup`. It walks you through these same steps one at a time.

## Before you start

Create these accounts first. Using the same email for all of them makes life easier.

1. [GitHub](https://github.com/signup) holds your copy of the code.
2. [Vercel](https://vercel.com/signup) runs the app. Sign up with your GitHub account.
3. [Supabase](https://supabase.com/dashboard/sign-up) is your database, file storage and sign-in.
4. [Anthropic](https://console.anthropic.com) for Claude, or [OpenAI](https://platform.openai.com). The app needs at least one API key to think.

### What it costs

| Service | Plan | Cost |
|---|---|---|
| Vercel | Pro | $20 a month ([Vercel pricing](https://vercel.com/pricing)) |
| Supabase | Free to start, Pro when you rely on it | $0, then $25 a month ([Supabase pricing](https://supabase.com/pricing)) |
| Claude or OpenAI | Pay as you go | Depends on how much you use the AI |

Why Vercel Pro:

- The agents check for work every 5 minutes. The free Hobby plan runs scheduled jobs once a day, and a deploy with a 5-minute schedule fails with "Hobby accounts are limited to daily cron jobs" ([Vercel cron docs](https://vercel.com/docs/cron-jobs/usage-and-pricing)).
- AI Chat runs long tasks for up to 800 seconds. Hobby stops functions at 300 seconds ([Vercel function duration docs](https://vercel.com/docs/functions/configuring-functions/duration)).
- Hobby is for personal, non-commercial use only ([Vercel terms](https://vercel.com/legal/terms)). A business app belongs on Pro.

Why Supabase Pro later:

- Free projects pause after 7 days with little activity ([Supabase docs](https://supabase.com/docs/guides/platform/free-project-pausing)). That's fine while you test.
- Free projects accept uploads up to 50 MB, so longer videos in the video studio need Pro ([Supabase pricing](https://supabase.com/pricing)).

## Step 1: Make your own copy

1. On this repository's GitHub page, click **Use this template**, then **Create a new repository**.
2. Pick your account as the owner and name it, for example `founders-ai-os`.
3. Choose **Private**. Your copy holds your changes, and the license asks you to keep it private.
4. Click **Create repository**.

Use the template button to make your copy. A fork of a public repository is public too.

## Step 2: Create your database in Supabase

1. In the [Supabase dashboard](https://supabase.com/dashboard), click **New project**.
2. Name it `founders-ai-os` and pick the region closest to you.
3. Set a database password and save it in your password manager.
4. If the form shows security options, keep the Data API turned on and keep the `public` schema. The rest can stay as it is. The setup file grants exactly the access the app needs.
5. Click **Create new project** and wait a couple of minutes while it starts.

### Run the database setup

1. Open the file `supabase/migrations/20261122000000_founders_os.sql` in your repository on GitHub and click the **Copy raw file** button.
2. In Supabase, open **SQL Editor** and start a new query.
3. Paste the whole file and click **Run**. It takes a few seconds.
4. You should see "Success. No rows returned".

Run it once, on a new and empty project. The file runs as one transaction, so if it stops with an error, nothing was saved. Check that you copied the whole file, from the first line to the last, and run it again. If you see "multiple primary keys" or "already exists", the setup already ran on this project and you can move on.

Comfortable with a terminal? The [Supabase CLI](https://supabase.com/docs/guides/cli) does the same thing: `supabase link --project-ref <your-project-ref>`, then `supabase db push`.

### Copy your two Supabase values

1. Click **Connect** at the top of your project, or open **Project Settings**, then **Data API**. Copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
2. Open **Project Settings**, then **API Keys**. Copy the **publishable key**. It starts with `sb_publishable_`.

Keep both in a note for step 4. Never copy the secret key or the service role key anywhere. The app doesn't need them, and it stops with a clear message if you paste one by mistake.

## Step 3: Make two secret codes

The app needs two random codes of your own. `FOS_ENC_KEY` locks the API keys you save in the app. `CRON_SECRET` protects the scheduled jobs.

**On a Mac or Linux:** open Terminal and run each line once:

```
openssl rand -base64 32
openssl rand -hex 32
```

**On Windows:** open PowerShell and run each line once:

```
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
```

Save the first result as `FOS_ENC_KEY` and the second as `CRON_SECRET` in your note.

Keep `FOS_ENC_KEY` safe and don't change it later. If it changes, every key you saved in the app stops working and you have to add them again.

## Step 4: Put the app online with Vercel

1. Open [vercel.com/new](https://vercel.com/new). Pick your Pro team at the top.
2. Find your repository and click **Import**. If it's missing, click **Adjust GitHub App Permissions** and give Vercel access to it.
3. Leave **Framework Preset** as **Other** and leave the build settings as they are.
4. Open **Environment Variables** and add these:

| Name | Value | Needed |
|---|---|---|
| `SUPABASE_URL` | Your Project URL from step 2 | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Your publishable key from step 2 | Yes |
| `FOS_ENC_KEY` | Your first code from step 3 | Yes |
| `CRON_SECRET` | Your second code from step 3 | Yes |
| `FOS_TZ` | Your time zone, for example `America/New_York` or `Europe/London` ([list of time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)) | Recommended |
| `COACH_NAME` | Your name, the way it appears in your coaching call transcripts | Recommended |

5. Click **Deploy**. The first deploy takes a minute or two.
6. Vercel shows your web address, something like `founders-ai-os-yourname.vercel.app`. Copy it.

The app works out its own address from Vercel. Add `APP_URL` only if you want links in emails and sign-ins to use a different address. [.env.example](.env.example) lists every optional setting.

If you change an environment variable later, open **Deployments**, click the three dots on the newest one and choose **Redeploy**. New values only reach the app after a redeploy.

## Step 5: Connect sign-in to your address

### Tell Supabase where sign-ins come from

1. In Supabase, open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your address, including `https://`.
3. Under **Redirect URLs**, add your address followed by `/**`, for example `https://founders-ai-os-yourname.vercel.app/**`.
4. Click **Save**.

Without this, confirmation and password reset emails open the wrong page.

### Set up email for other people

Supabase's built-in email only sends to members of your Supabase organization, and only a couple of emails an hour ([Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp)). That covers you while you set up. Before you invite anyone, connect your own email sender:

1. Create an account with an email sender such as Resend, Postmark or Brevo and verify your domain there.
2. In Supabase, open **Authentication**, then **Emails**, then **SMTP Settings**, and paste the details they give you.
3. Raise the email limit under **Authentication**, then **Rate Limits**, if you expect many sign-ups at once ([Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)).

## Step 6: Create your account

The first person to sign up becomes the admin. Do this right after your first deploy.

1. Open your app's address and sign up with your email and a strong password.
2. Click the link in the confirmation email. You land in the app as the admin.
3. Open **Settings**. The **Setup check** panel lists anything still missing, with a link to where you fix it. Only admins see it.

When you open the app as the admin, it registers your `CRON_SECRET` and time zone with the database by itself. If the Setup check still shows `CRON_SECRET` in red after a reload, run this in the Supabase SQL Editor with your own code in place of `PASTE_CRON_SECRET_HERE`:

```sql
insert into private.app_config (key, value)
values ('cron_hash', encode(extensions.digest('PASTE_CRON_SECRET_HERE', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;
```

If someone else signed up before you, make yourself the admin with this, using your own email:

```sql
update public.user_access set is_admin = (user_id = (select id from auth.users where email = 'you@yourdomain.com'));
update public.user_access set status = 'approved', decided_at = now()
where user_id = (select id from auth.users where email = 'you@yourdomain.com');
```

Reload the app, open **Settings**, then **Access**, and click **Remove access** on the other account.

## Step 7: Add your keys inside the app

Everything from here happens inside the app, on **Systems**, then **Connections**. Keys are encrypted with your `FOS_ENC_KEY` before they're stored.

1. **Claude or OpenAI.** Required. AI Chat, Jarvis and the agents all use it. Create a key in the [Anthropic console](https://console.anthropic.com/settings/keys) or the [OpenAI dashboard](https://platform.openai.com/api-keys) and paste it in.
2. **HighLevel**, if you use it. Click the HighLevel card. It lists the scopes to tick. In your HighLevel sub-account, open **Settings**, then **Private Integrations**, create an integration with those scopes, and paste the token with your Location ID.
3. **YouTube**, if you make videos. Add a YouTube API key on the server first (optional step A). Then paste your channel link on the YouTube card.

Add the rest when you need them: Stripe, Perplexity, ElevenLabs for Jarvis's voice, Telegram for approvals on your phone, Notion, Slack, Zoom, Fathom and more. Each card has short instructions.

If a card says it needs a fix, click it. It says what went wrong and links to the page where you fix it.

## Step 8: Fill your Playbook

The Playbook holds the answers the AI Coach gives first, written the way you would answer.

1. Open **Settings**, then **Playbook**.
2. Click **Add the starter answers**. It adds 100 answers built on the frameworks in this app: offers, funnels, copy, content, ads, sales calls and mindset.
3. Read through them and edit anything that doesn't sound like you. Delete the ones you'd never say.

You can also click **Write your own** to start from an empty Playbook. In AI Chat, the Coach mode has a **Coach library** link for the admin, where you choose which of your documents, coaching calls and videos the coach learns from.

## Step 9: Invite your people

1. Send people your app's address. They sign up the same way you did.
2. New accounts wait for your approval. Open **Settings**, then **Access**, and approve them.
3. Each person gets their own workspace and connects their own AI key in **Connections**. The AI Coach answers with their key, so the AI cost sits on their account.

## Optional steps

### A: YouTube research

1. In [Google Cloud](https://console.cloud.google.com/apis/library/youtube.googleapis.com), create a project and enable the **YouTube Data API v3**.
2. Open **Credentials**, create an **API key**, and restrict it to the YouTube Data API v3.
3. Add it in Vercel as `YOUTUBE_API_KEY` and redeploy.

### B: Sign in with Google

This adds YouTube Analytics, Google Calendar, Google Drive, Google Analytics, Search Console and Google Ads to Connections.

1. In [Google Cloud credentials](https://console.cloud.google.com/apis/credentials), set up the OAuth consent screen. Add yourself as a test user while the app is in testing.
2. Enable the APIs you want: YouTube Data API v3, YouTube Analytics API, Google Calendar API, Google Drive API, Google Analytics Data API, Google Search Console API and Google Ads API.
3. Create an **OAuth client ID** of type **Web application**. Add this authorized redirect URI, with your own address: `https://your-app.vercel.app/api/inbox?oauth=google`
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and redeploy.

The app asks for these scopes, all read-only except Google Ads: `youtube.readonly`, `yt-analytics.readonly`, `calendar.readonly`, `drive.readonly`, `analytics.readonly`, `webmasters.readonly` and `adwords`.

### C: One-click HighLevel sign-in

Private Integration tokens (step 7) work without this. If you want a HighLevel Marketplace app instead:

1. Create an app in the [HighLevel Marketplace](https://marketplace.gohighlevel.com/).
2. Set the redirect URL to `https://your-app.vercel.app/api/highlevel?oauth=hl` and the webhook URL to `https://your-app.vercel.app/api/highlevel?hook=app`.
3. Add `HL_APP_CLIENT_ID` and `HL_APP_CLIENT_SECRET` in Vercel and redeploy.

### D: Your own domain

1. In Vercel, open your project, then **Settings**, then **Domains**, and add something like `app.yourdomain.com`.
2. Add the DNS record Vercel shows where you bought your domain.
3. Once Vercel shows a green check, change the Site URL and Redirect URLs in Supabase (step 5) to the new address. If you set up Google or HighLevel sign-in, add the new redirect URLs there too.

## Check that it works

- [ ] You can sign out and sign back in.
- [ ] "Forgot password" sends an email, and the link opens your app.
- [ ] The Setup check in Settings shows no required items left.
- [ ] AI Chat answers a simple question, like "What can you help me with?"
- [ ] The AI Coach in AI Chat answers a question about offers or funnels.
- [ ] An agent you turned on in **Systems**, then **Agents**, shows a "Last run" time after its scheduled time. That proves the scheduled checks run.

## When something goes wrong

| What you see | What to do |
|---|---|
| Deploy fails with "Hobby accounts are limited to daily cron jobs" | Upgrade your Vercel team to Pro, then redeploy. |
| Deploy fails about `maxDuration` | Same fix. Pro allows the longer AI Chat tasks. |
| The app says `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is missing | Add them in Vercel (step 4), then redeploy. |
| The app says the key "holds a secret key" or "the service role key" | You pasted the wrong key. Use the publishable key from Supabase, then redeploy. |
| "The database is missing part of the Founders AI OS schema" | Run the database setup (step 2) on your Supabase project. |
| `FOS_ENC_KEY` is missing or "must be 32 random bytes" | Make a new code with the step 3 command, save it in Vercel, redeploy, then add your API keys again. |
| The confirmation or reset email opens the wrong site | Redo step 5, "Tell Supabase where sign-ins come from". |
| Other people never get the confirmation email | Set up your own email sender (step 5). |
| Stuck on "waiting for approval" as the owner | Run the "someone else signed up before you" SQL in step 6. |
| AI Chat or Jarvis asks you to connect Claude, OpenAI or Perplexity | Add your Claude or OpenAI key in Connections (step 7). |
| The YouTube card asks for Google sign-in | Add `YOUTUBE_API_KEY` (optional step A) to connect with a channel link, or set up Google sign-in (optional step B). |
| HighLevel says a scope is missing | Open the same Private Integration in HighLevel, tick the missing scope, then replace the token in Connections. |
| Agents never run | Check the Setup check for `CRON_SECRET`. If it's red, use the SQL in step 6. |
| The app stopped loading after a quiet week | Your free Supabase project paused. Click **Resume project** in Supabase, and move to Pro to stop it happening. |
| Video uploads fail above 50 MB | Move Supabase to Pro. Free projects cap uploads at 50 MB. |

## Getting updates

Your copy is yours, so updates never install themselves and never overwrite your changes.

1. Open your copy in an AI coding tool such as Claude Code or Codex and say: "Compare this app with https://github.com/gustensun/founders-ai-os and bring in the changes I don't have, without removing my own edits."
2. If there are new files in `supabase/migrations`, run each new one in the Supabase SQL Editor, oldest first, before you deploy.
3. Commit and push. Vercel deploys the new version by itself.
