// Content agents: what each one drafts when it runs, and what it says in the Jarvis feed.
(() => {
  const St = window.Store, SEED = St.SEED;
  const latest = () => [...SEED.videos].sort((a, b) => b.day - a.day)[0];
  const best = () => [...SEED.videos].filter((v) => v.day > St.T - 45).sort((a, b) => (b.revenue || b.views || 0) - (a.revenue || a.views || 0))[0] || latest();
  const nextIdea = () => St.s.ideas.filter((i) => i.col !== 'published').sort((a, b) => b.score - a.score)[0] || { title: 'How I host 40 websites on one account', streams: ['software'] };
  const t = (v) => v.title.replace(/[.]$/, '');

  const OUT = {
    planner: () => ({ kind: 'Content plan', title: 'Content plan, 9 to 22 November', stream: 'affiliate', rubric: null, scores: [], action: 'Pin to Content and add the filming days to your HighLevel calendar',
      body: 'WEEK 1\nMon  Long video: ' + t(nextIdea()) + '\nWed  Short x2 from last week\u2019s video\nThu  LinkedIn post: the clinic client who added 31 bookings\nFri  Newsletter\n\nWEEK 2\nMon  Long video: HighLevel AI Studio vs Lovable, built side by side\nTue  Short x2\nThu  Live build in the community\nFri  Newsletter with the Founder Plan trial\n\nWhy this mix: affiliate commissions are the stream furthest behind its goal, so two of the four long-form slots carry a HighLevel SubID offer.',
      evidence: 'Goals show affiliate commissions off track. Your four pillars are weighted from the last 90 days of revenue per video.' }),
    titles: () => { const i = nextIdea(); return { kind: 'Titles and thumbnails', title: 'Titles for "' + t(i) + '"', stream: (i.streams || ['products'])[0], rubric: 'rb-title', scores: [8.6, 9.1, 8.2],
      action: 'Save the winning title and thumbnail brief to the idea',
      body: 'TITLES, ranked\n1. ' + t(i) + '\n2. I tried this so you don\u2019t have to (it worked)\n3. The setup that replaced 4 of my tools\n4. Steal my exact setup, step by step\n5. What nobody shows you about this\n\nTHUMBNAIL CONCEPTS\nA. Your face, half smile, the finished result on screen. Three words from the title, no more\nB. Before and after split, the messy version on the left, the clean result on the right\nC. One big number from the video on the dark ground with the orange accent, no face\n\nTest A against C. Faces have won 6 of your last 8 thumbnail tests.',
      evidence: 'Scored against click rate on your last 60 videos. Titles with a number and a time limit average 1.4x your median.' }; },
    hooks: () => { const v = latest(); return { kind: 'Hook rewrite', title: 'New opening for "' + t(v) + '"', stream: 'products', rubric: 'rb-script', scores: [8.9, 8.1, 7.8, 8.8],
      action: 'Save to the Brain as a hook pattern for Draft Studio',
      body: 'WHERE VIEWERS LEFT\n0:00 to 0:18 held 91 percent. At 0:19 you started the backstory and 22 percent left by 0:40.\n\nREWRITE\n"Here is the finished result. In the next few minutes I will show you every step, what it costs and what I charge for it. Let\u2019s go."\n\nRULE FOR NEXT TIME\nShow the finished result in the first 5 seconds. Backstory goes after the first build step, never before.',
      evidence: 'Retention graph at 48 hours. Your openings that show the result first hold 12 points better at 30 seconds.' }; },
    shorts: () => { const v = latest(); return { kind: 'Shorts', title: '4 shorts from "' + t(v) + '"', stream: 'products', rubric: 'rb-short', scores: [8.7, 8.4, 8.8],
      action: 'Send clip timestamps to your editor and queue in HighLevel Social Planner',
      body: '1. 02:14 to 02:52  "The step most people skip"\n   Caption: It takes two minutes and it changes the result.\n\n2. 06:40 to 07:21  "What I would charge a client for this"\n   Caption: Price the outcome, not the hours.\n\n3. 11:05 to 11:44  "The mistake that cost me 3 clients"\n   Caption: Onboarding is the product.\n\n4. 15:30 to 16:02  "Do this before you build anything"\n   Caption: Sell it first. Then build it in AI Studio.',
      evidence: 'Picked from transcript moments with the highest replay rate and a complete thought under 45 seconds.' }; },
    upload: () => { const v = latest(); return { kind: 'Upload package', title: 'Upload package for "' + t(v) + '"', stream: 'affiliate', rubric: 'rb-upload', scores: [9.2, 8.6, 8.8],
      action: 'Paste into YouTube Studio. Links already carry the SubID',
      body: 'DESCRIPTION\n' + t(v) + '. Every step on screen, nothing skipped.\n\nStart your HighLevel trial: https://www.gohighlevel.com/?fp_ref=yourname&fp_sid=yt-' + v.id + '\nGet the App Builder Kit: https://example.com/kit?src=yt-' + v.id + '\n\nCHAPTERS\n00:00 The result first\n01:10 The setup\n04:30 Step by step\n11:05 The mistake most people make\n15:30 How to price it\n\nPINNED COMMENT\nWhat would you build first for your clients? I read every reply.\n\nTAGS\nhighlevel, ai studio, white label saas, client dashboard',
      evidence: 'Affiliate SubID and product link chosen from the streams this video serves. Data Fixer reports 14 older links missing SubIDs.' }; },
    social: () => ({ kind: 'Social posts', title: 'LinkedIn, X and Instagram for this week', stream: 'services', rubric: 'rb-post', scores: [8.8, 8.3, 9.0],
      action: 'Schedule in HighLevel Social Planner',
      body: 'LINKEDIN\nA physio clinic asked me for a website. I sold them software instead.\n\nThe site would have been a one-off 2,500. The booking dashboard is 197 a month, and it took me less time to build.\n\nIf you build websites for local businesses, ask one question on the next call: what do you do after someone books?\n\nX\nStopped selling websites. Started selling the thing clients open every morning. Same skills, 12x the lifetime value.\n\nINSTAGRAM CAPTION\nThe screen my clients pay 197 a month for. Built in 20 minutes. Full walkthrough on YouTube.',
      evidence: 'From your call with a physio clinic on 2 Nov and the voice samples in the Brain.' }),
    newsletter: () => { const v = latest(); return { kind: 'Newsletter', title: 'Friday email: ' + t(v), stream: 'products', rubric: 'rb-email', scores: [8.9, 8.7, 8.2, 7.9],
      action: 'Create as a draft campaign in HighLevel Email, scheduled Friday 09:00',
      body: 'SUBJECT OPTIONS\n1. ' + t(v) + '\n2. The one thing I would do first\n\nHi {{contact.first_name}},\n\nThis week\u2019s video: ' + t(v) + '.\n\nThe lesson I keep coming back to: show the result first and explain after. It works the same in funnels, videos and sales calls.\n\nWatch it here: https://youtu.be/' + v.id + '\n\nIf you want my exact prompts and templates, the App Builder Kit has all of them.\n\nAvery',
      evidence: 'Built from this week\u2019s video, one lesson from your calls and the offer with the best email conversion.' }; },
    comments: () => ({ kind: 'Comment replies', title: '6 comment replies, 1 warm lead', stream: 'software', rubric: 'rb-post', scores: [8.7, 8.9, 9.1],
      action: 'Post the replies on YouTube and add the lead to HighLevel with the tag yt-warm',
      body: '@marko_builds: "Does this work for dentists in Germany?"\nReply: It does. I run it for two clinics in Europe. The booking flow is in German and the data stays in the EU region.\nLEAD: asked about pricing in a second comment. Tagged yt-warm.\n\n@sara.funnels: "What did you use for the calendar?"\nReply: HighLevel calendars, connected to the dashboard with one workflow. Chapter 04:30 shows it.\n\n4 more replies are in the edit view.',
      evidence: 'Buying questions are detected from price, country and "for my client" wording.' }),
    casestudy: () => ({ kind: 'Case study', title: 'Case study: Lindqvist Dental, 31 new bookings', stream: 'software', rubric: 'rb-post', scores: [8.5, 8.2, 9.3],
      action: 'Save as a HighLevel page draft and send the testimonial request',
      body: 'HEADLINE\nHow a two-chair dental clinic added 31 bookings in 30 days\n\nTHE PROBLEM\nCalls went to voicemail after 16:00 and no one followed up.\n\nWHAT WE BUILT\nA booking dashboard with missed-call text back and a review request after each visit.\n\nTHE RESULT\n31 new bookings, 4.9 stars on 42 reviews, 197 a month.\n\nTESTIMONIAL REQUEST\nHi Anna, would you be open to a 2 minute video about the first month? I can send three questions so it takes no prep.\n\nVIDEO IDEA\nI rebuilt a dentist\u2019s follow-up in 20 minutes. Here are the numbers after 30 days.',
      evidence: 'Milestone detected in HighLevel: 30 days on the Growth plan with bookings up.' }),
    leadmagnet: () => { const v = best(); return { kind: 'Lead magnet', title: 'Checklist from "' + t(v) + '"', stream: 'products', rubric: 'rb-offer', scores: [8.4, 8.0, 8.9, 8.1],
      action: 'Paste into HighLevel AI Studio as an opt-in funnel',
      body: 'LEAD MAGNET\nThe 20 Minute Client Dashboard Checklist\n\n1. Pick one daily job the client repeats\n2. Build the screen they open first\n3. Connect one calendar and one form\n4. Add missed-call text back\n5. Price it monthly, never per build\n\nOPT-IN PAGE\nHeadline: Build the dashboard clients pay for every month\nSub: The exact checklist I use for clinics, in one page\nButton: Send me the checklist\n\nTHANK YOU PAGE\nOffer the Funnel Kit at 47 with the first 10 prompts unlocked.',
      evidence: 'Your best video of the last 45 days by revenue. Opt-ins feed the kit, which buyers upgrade from at 18 percent.' }; },
  };

  const LINES = {
    trends: () => 'HighLevel shipped two AI Studio updates. One is worth a video within 48 hours.',
    planner: () => 'Planned the next two weeks. Two long videos carry a SubID offer.',
    titles: () => 'Wrote 10 titles for "' + t(nextIdea()) + '". Best one scores 9.1.',
    hooks: () => 'Viewers left at 0:19 on "' + t(latest()) + '". Rewrote the opening.',
    shorts: () => 'Picked 4 shorts from "' + t(latest()) + '" with timestamps.',
    upload: () => 'Packaged the description, chapters and SubID links for "' + t(latest()) + '".',
    social: () => 'Drafted LinkedIn, X and Instagram posts from Monday\u2019s call.',
    newsletter: () => 'Friday\u2019s email is drafted, two subject lines to pick from.',
    comments: () => 'Drafted 6 replies. One commenter asked about pricing.',
    casestudy: () => 'Lindqvist Dental hit 30 days on Growth. Case study drafted.',
    leadmagnet: () => 'Turned "' + t(best()) + '" into a checklist and opt-in page.',
    analyst: () => '"' + t(latest()) + '" is at 1.3x your median click rate after 7 days.',
  };

  window.ContentAgents = {
    ids: Object.keys(LINES),
    line: (id) => LINES[id] && LINES[id](),
    run(id) { const f = OUT[id]; if (!f) return null; return St.A.addApproval({ agent: id, contactId: null, ...f() }); },
    add(out, lines) { Object.assign(OUT, out); Object.assign(LINES, lines); this.ids = Object.keys(LINES); },
  };
})();
