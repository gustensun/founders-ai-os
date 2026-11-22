// Builds api/_skill-library.json from three MIT licensed skill repos, cleaned for AI Chat.
// Usage: node scripts/skills/build.cjs <dir with clones of marketingskills, no-ai-slop, last30days-skill>
// Cleaning: frontmatter removed, partner and sponsored tool plugs removed, links to the source repo's tool
// registry removed, and "read the product marketing file" replaced with "read the founder's context layers".
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || '/tmp/xs';
const OUT = path.join(__dirname, '..', '..', 'api', '_skill-library.json');
const sha = (repo) => { try { return fs.readFileSync(path.join(SRC, repo, '.git', 'HEAD'), 'utf8').trim(); } catch { return null; } };
const gitHead = (repo) => { const h = sha(repo); if (h && h.startsWith('ref:')) { try { return fs.readFileSync(path.join(SRC, repo, '.git', h.slice(5).trim()), 'utf8').trim(); } catch { return null; } } return h; };

// Library skill id -> display name and when it applies. The founder's own skills in _chatprompt.js win on overlap.
const MK = {
  'ab-testing': ['A/B testing', /\b(a\/b|ab test|split.?tests?|experiments?|variants?|statistical(ly)? significan\w*|which version won|test results?)\b/i],
  'ad-creative': ['Ad creative', /\b(ad creatives?|ad copy|ad hooks?|ad angles?|ad variations?|primary text|ad headlines?|which ads?|kill (the|this) ad|ugc ads?)\b/i],
  'ads': ['Paid ads', /\b(paid ads|facebook ads|meta ads|google ads|linkedin ads|youtube ads|tiktok ads|ad spend|ads? budget|roas|cpa|cpm|cpc|retarget\w*|campaigns? (structure|setup)|ad account|paid (social|traffic|search))\b/i],
  'ai-seo': ['AI search visibility', /\b(ai seo|geo|aeo|ai overviews?|cited (by|in) (ai|chatgpt|perplexity)|llm (seo|visibility)|ai citations?|answer engines?|show up in (chatgpt|perplexity|ai))\b/i],
  'analytics': ['Analytics setup', /\b(tracking plan|ga4|google analytics|gtm|tag manager|event (names?|tracking)|utm|is this metric|track(ing)? events?)\b/i],
  'aso': ['App store optimization', /\b(app store|google play|aso|app listing|app screenshots?|app downloads?)\b/i],
  'attribution': ['Attribution', /\b(attribution|which (channel|marketing) (drives|is working)|dark social|self.?reported attribution|how did you hear|credit (for|to) (sales|revenue)|first touch|last touch|multi.?touch)\b/i],
  'churn-prevention': ['Churn prevention', /\b(churn|cancel\w*|cancellation|retention|dunning|failed payments?|save offers?|win.?back|keep (members|customers|subscribers))\b/i],
  'co-marketing': ['Co-marketing', /\b(co.?marketing|joint (webinar|campaign|venture)|jv|partner (campaign|webinar)|cross.?promo\w*|integration partners?)\b/i],
  'cold-email': ['Cold email', /\b(cold (email|outbound|outreach)|outbound (email|sequence)|nobody replies|reply rate|cold (pitch|opener))\b/i],
  'community-marketing': ['Community', /\b(communit(y|ies)|discord|skool|slack group|facebook group|circle community|members (are )?(quiet|engag\w*))\b/i],
  'competitor-profiling': ['Competitor profiling', /\b(competitors?|rivals?|competitive (analysis|research|landscape)|what (are|is) .{1,40} (charging|doing)|battle ?cards?)\b/i],
  'competitors': ['Comparison pages', /\b(vs\.? pages?|comparison pages?|alternatives? pages?|\w+ vs \w+ page|best .{1,30} alternatives?)\b/i],
  'content-strategy': ['Content strategy', /\b(content (strategy|plan|pillars?|calendar|clusters?)|editorial calendar|topic clusters?|what (should|to) (i )?(write|post) about|posts? (bring|get) no (customers|clients|leads))\b/i],
  'conversion-tracking': ['Conversion tracking', /\b(conversion tracking|pixel|capi|conversions? api|enhanced conversions|conversions? (missing|doubled|not tracking)|server.?side tracking|offline conversions?)\b/i],
  'copy-editing': ['Copy editing', /\b(edit (this|my)|tighten|proofread|polish (this|my) copy|refresh (this|my) copy|line edit|copy edit\w*|make (this|it) (shorter|tighter|clearer))\b/i],
  'copywriting': ['Page copywriting', /\b(homepage copy|landing page copy|page copy|sales page copy|sales pages?|pricing page copy|feature page|headline|value prop\w*|hero (copy|section)|messaging|lead with)\b/i],
  'cro': ['Page CRO', /\b(cro|conversion rate|not converting|converting|form (fields?|abandon\w*)|landing page (review|audit|feedback)|what (should i|to) change first)\b/i],
  'customer-research': ['Customer research', /\b(customer research|interviews?|surveys?|voice of (the )?customer|reviews? (mining|analysis)|jobs to be done|jtbd|what (do )?(my )?customers (want|say|think)|feedback)\b/i],
  'directory-submissions': ['Directory listings', /\b(directories|directory (listings?|submissions?)|product hunt|g2|capterra|app ?sumo|listing sites?)\b/i],
  'emails': ['Email sequences', /\b(email (sequences?|flows?|automation)|welcome (sequence|series|emails?)|nurture|onboarding emails?|drip|lifecycle emails?|abandoned cart emails?)\b/i],
  'events': ['Events and webinars', /\b(events?|webinars?|workshops?|conferences?|meetups?|booth|show.?up rate|live (training|class)|summit)\b/i],
  'free-tools': ['Free tools as marketing', /\b(free tools?|calculators?|graders?|generators?|quiz (funnel|tool)|micro.?tools?|lead gen tools?|engineering as marketing)\b/i],
  'image': ['Marketing images', /\b(images?|graphics?|social graphics?|blog hero|og image|thumbnails?|banners?|photos?)\b/i],
  'influencer-marketing': ['Creator partnerships', /\b(influencers?|creator (partnerships?|deals?|sponsorships?)|sponsor(ship|ed)?s?|ambassadors?|ugc creators?|whitelisting|paid partnerships?)\b/i],
  'launch': ['Product launches', /\b(launch\w*|product hunt|beta|early access|waitlist|announce\w*|go.?live|release)\b/i],
  'lead-magnets': ['Lead magnets', /\b(lead magnets?|freebies?|opt.?in (offer|gift)|checklists?|cheat ?sheets?|ebooks?|gat(e|ed|ing)|templates? (to|for) (give|collect))\b/i],
  'link-building': ['Link building', /\b(backlinks?|link building|guest posts?|digital pr|mentions? (on|from) (sites|blogs)|haro)\b/i],
  'marketing-council': ['Marketing council', /\b(what would (seth godin|ogilvy|hormozi|a marketer|an expert)|expert (takes|panel|board)|several (expert )?opinions|devil.?s advocate|council|board of advisors?)\b/i],
  'marketing-ideas': ['Marketing ideas', /\b(marketing ideas|growth (ideas|tactics|hacks)|get (more|my first|the next) (customers|clients|users)|how (do|can) i get (customers|clients|users|attention)|little (time|budget))\b/i],
  'marketing-loops': ['Marketing loops', /\b(marketing loops?|recurring (check|job|report)|weekly (check|report|review)|daily (check|report)|automated (check|report|monitor\w*)|agent (that|to) (checks|runs))\b/i],
  'marketing-plan': ['Marketing plan', /\b(marketing plan|go.?to.?market|gtm plan|growth plan|90.?day plan|q[1-4] plan|marketing strategy|sequence (the|these|my) initiatives)\b/i],
  'marketing-psychology': ['Marketing psychology', /\b(psychology|biases?|persuasion|mental models?|cialdini|anchoring|loss aversion|social proof|why (do )?(buyers|people|customers) (buy|value|behave))\b/i],
  'offers': ['Offer design', /\b(offers?|value stack|bonus(es)?|guarantees?|urgency|scarcity|irresistible|grand slam|why (it|this) (is not|isn.?t) selling)\b/i],
  'onboarding': ['Onboarding', /\b(onboarding|activation|first (session|run|week)|aha moment|new (users|members) (don.?t|do not) (stick|start)|welcome (flow|checklist))\b/i],
  'paywalls': ['Paywalls and upgrades', /\b(paywalls?|upgrade (screens?|prompts?|moments?)|free to paid|freemium|upsell (in.?app|screen)|feature gat\w*)\b/i],
  'popups': ['Popups', /\b(popups?|pop.?ups?|modals?|slide.?ins?|sticky bars?|exit.?intent|announcement bars?)\b/i],
  'pricing': ['Pricing and packaging', /\b(pricing|prices?|price (increase|point)|what (should i|to) charge|how much (should i|to) charge|raise (my )?prices?|tiers?|packaging|per.?seat|usage.?based|annual (plan|discount))\b/i],
  'product-marketing': ['Positioning and ICP', /\b(positioning|icp|ideal (customer|client)|messaging doc|product marketing|who is (this|it) for|target audience|avatar)\b/i],
  'programmatic-seo': ['Programmatic SEO', /\b(programmatic seo|pseo|pages at scale|location pages|template pages|\[x\] for \[y\])\b/i],
  'prospecting': ['Prospecting', /\b(prospect\w*|lead lists?|who (should i|to) target|buying signals?|intent signals?|find (leads|clients|buyers)|outbound targets?)\b/i],
  'public-relations': ['PR and press', /\b(pr|press( release)?|media (coverage|pitch)|journalists?|reporters?|podcast (tour|guesting)|newsworthy|crisis)\b/i],
  'referrals': ['Referrals and affiliates', /\b(referrals?|refer.?a.?friend|affiliates? (program|commission\w*)|word of mouth|ambassador program|partner program)\b/i],
  'reverse-engineer-marketing': ['Reverse-engineer a competitor', /\b(how did .{1,40} grow|reverse.?engineer|what did .{1,40} do to grow|their growth (story|playbook)|copy (their|what they did))\b/i],
  'revops': ['RevOps and lead scoring', /\b(revops|lead scor\w*|mql|sql|lifecycle stages?|lead (handoff|routing|quality)|sales.?ready)\b/i],
  'sales-enablement': ['Sales enablement', /\b(sales (deck|collateral|script|enablement|call script)|one.?pagers?|objection handling|demo script|battle ?cards?|case study (for sales)?|champion)\b/i],
  'schema': ['Schema markup', /\b(schema|json.?ld|structured data|rich (results|snippets))\b/i],
  'seo-audit': ['SEO audit', /\b(seo|rank(ing|s)?|organic traffic|traffic dropped|canonicals?|hreflang|redirects?|indexing|search console|keywords?)\b/i],
  'signup': ['Signup and trial flows', /\b(sign.?up (flow|form|page)|registration (flow|form)|trial (start|signup)|require a card|credit card upfront|sso)\b/i],
  'site-architecture': ['Site architecture', /\b(site (architecture|structure|map)|navigation|nav menu|url structure|internal links?|which pages (do )?i need|information architecture)\b/i],
  'sms': ['SMS and WhatsApp marketing', /\b(sms|text messages?|texting|mms|whatsapp (marketing|broadcast|template)|a2p|10dlc)\b/i],
  'social': ['Organic social', /\b(social media|linkedin posts?|x posts?|tweets?|threads?|instagram posts?|carousels?|tiktok|facebook posts?|what (should i|to) post|posting schedule|organic social)\b/i],
  'video': ['Marketing video', /\b(video (ads?|production|marketing)|ai avatars?|explainer videos?|screen recordings?|demo videos?|product videos?|repurpos\w* videos?)\b/i],
};
const PARTNERS = ['Converly', 'Ploy', 'AIsa', 'Omnia', 'Livestorm'];
const DROP = new RegExp(`\\u25C6|Verified Partner|tools/integrations/|tools/REGISTRY|marketing-skills\\.com|\\b(${PARTNERS.join('|')})\\b`);
const CONTEXT_LINE = "Read the founder's context layers first (approved facts, Brand DNA, offers, funnels and connected data in the OS). Ask only for what they do not cover.";

function clean(md) {
  let s = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const out = [];
  for (const line of s.split('\n')) {
    if (DROP.test(line)) continue;
    if (/^If `\.agents\/product-marketing\.md` exists/.test(line)) { out.push(CONTEXT_LINE); continue; }
    out.push(line
      .replace(/^If `\.agents\/brand\.md` or `\.agents\/design\.md` exists, read whichever is there before asking about brand assets\./, 'Read the brand board in the OS (os_read brand_board) before asking about brand assets.')
      .replace(/`?\.(agents|claude)\/product-marketing(-context)?\.md`?|`?product-marketing(-context)?\.md`?/g, "the founder's Brand DNA")
      .replace(/\[([^\]]+)\]\(https:\/\/github\.com\/coreyhaines31\/marketingskills\/blob\/main\/skills\/([a-z0-9-]+)\/(references\/[^)]+\.md)\)/g, '$1 (library skill $2, file $3)')
      .replace(/\[([^\]]+)\]\((?:\.\.\/)+([a-z0-9-]+)\/SKILL\.md\)/g, '$1 (library skill $2)')
      .replace(/\[([^\]]+)\]\((?:\.\.\/)+([a-z0-9-]+)\/(references\/[^)]+\.md)\)/g, '$1 (library skill $2, file $3)'));
  }
  return out.join('\n')
    .replace("The document is stored at the founder's Brand DNA.", 'In Founders AI OS this context is the Brand DNA (read it with get_brand_profile). Propose changes for the founder to approve; never overwrite it unasked.')
    .replace(/ Also check the founder's Brand DNA and the legacy filename[^\n]*?canonical location\./, '').replace(/\*\*Check for product marketing context first:\*\*\n(?=\S)/, '**Check the founder context first:**\n').replace(/\n{3,}/g, '\n\n').trim();
}
function walk(dir, base = dir, acc = []) {
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) { if (f !== 'evals') walk(p, base, acc); } else if (/\.md$/i.test(f)) acc.push(path.relative(base, p)); }
  return acc;
}
const desc = (md) => { const m = md.match(/^description:\s*"?(.*?)"?\s*$/m); return m ? m[1].replace(/\\"/g, '"') : ''; };

const skills = [];
const mkRoot = path.join(SRC, 'marketingskills', 'skills');
const mkSha = gitHead('marketingskills');
for (const id of fs.readdirSync(mkRoot).sort()) {
  if (!MK[id]) throw new Error('No routing for library skill ' + id);
  const dir = path.join(mkRoot, id), raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  const refs = {};
  for (const rel of walk(dir).filter((r) => r !== 'SKILL.md').sort()) refs[rel] = clean(fs.readFileSync(path.join(dir, rel), 'utf8'));
  skills.push({ id, name: MK[id][0], match: MK[id][1].source, flags: MK[id][1].flags, when: desc(raw).replace(/\(?\.agents\/product-marketing\.md\)?/g, '(the Brand DNA)'), source: 'coreyhaines31/marketingskills', commit: mkSha, license: 'MIT', body: clean(raw), refs });
}
for (const id of Object.keys(MK)) if (!skills.find((s) => s.id === id)) throw new Error('Routing for a missing skill ' + id);

// no-ai-slop, with the founder's house rules stated first so they win.
const slopDir = path.join(SRC, 'no-ai-slop', 'skills', 'no-ai-slop');
const slopNote = "House rules that win over this skill: no em dashes at all, in any length of copy. No exclamation points, no emojis. Keep the founder's own spoken devices such as \"just\", \"honestly\" and \"actually\" when they carry their rhythm. Edit in the founder's voice from their writing samples.";
skills.push({ id: 'no-ai-slop', name: 'No AI slop edit', match: /\b(slop|sounds? (less |more )?(like )?(ai|chatgpt|a robot)|less like (ai|chatgpt)|less ai|more human|sound human|humani[sz]e|de.?slop|ai.?sounding|does this (read|sound) (like )?ai|ai tells?|edit (this|my) (draft|post|email|copy)|sharpen|tighten (this|my))\b/i.source, flags: 'i',
  when: 'Edit a draft into sharper, more human writing in the founder\u2019s voice, or detect AI-slop patterns without rewriting.', source: 'petergyang/no-ai-slop', commit: gitHead('no-ai-slop'), license: 'MIT',
  body: slopNote + '\n\n' + clean(fs.readFileSync(path.join(slopDir, 'SKILL.md'), 'utf8')).replace('check the edited draft against `eval.md` yourself', 'check the edited draft against the eval checklist (read_skill no-ai-slop, file eval.md) yourself'),
  refs: { 'eval.md': clean(fs.readFileSync(path.join(slopDir, 'eval.md'), 'utf8')) } });

// last30days, adapted to run on community_pulse and web search.
skills.push({ id: 'last30days', name: 'Last 30 days research', match: /\b(last (30|thirty) days|this month|right now|lately|recently|trending|trends?|what (are|is) (people|everyone|creators|users) (saying|talking|posting|doing)|buzz|reactions?|sentiment|reddit|hacker news|what.?s new (with|in)|latest on|hot topics?)\b/i.source, flags: 'i',
  when: 'Research what people are actually saying about a topic in the last 30 days across Reddit, X, YouTube, TikTok, Instagram, LinkedIn, Hacker News and the web, weighted by engagement.', source: 'mvanhorn/last30days-skill', commit: gitHead('last30days-skill'), license: 'MIT',
  body: fs.readFileSync(path.join(__dirname, 'last30days.md'), 'utf8').trim(), refs: {} });

// A small index for the Connections page, so the browser never loads the full library.
const GROUPS = [
  ['Research and writing', ['last30days', 'no-ai-slop', 'customer-research', 'competitor-profiling', 'reverse-engineer-marketing', 'copywriting', 'copy-editing', 'marketing-psychology', 'marketing-council']],
  ['Conversion', ['cro', 'ab-testing', 'signup', 'onboarding', 'popups', 'paywalls', 'free-tools', 'lead-magnets']],
  ['Offers and sales', ['offers', 'pricing', 'product-marketing', 'launch', 'sales-enablement', 'churn-prevention', 'referrals']],
  ['Ads and tracking', ['ads', 'ad-creative', 'analytics', 'attribution', 'conversion-tracking', 'revops']],
  ['Content and outreach', ['content-strategy', 'social', 'video', 'image', 'emails', 'cold-email', 'prospecting', 'sms', 'community-marketing', 'influencer-marketing', 'events', 'public-relations', 'co-marketing']],
  ['SEO and AI search', ['seo-audit', 'ai-seo', 'programmatic-seo', 'schema', 'site-architecture', 'link-building', 'competitors', 'directory-submissions', 'aso']],
  ['Planning', ['marketing-plan', 'marketing-ideas', 'marketing-loops']],
];
const grouped = GROUPS.flatMap(([, ids]) => ids);
for (const s of skills) if (!grouped.includes(s.id)) throw new Error('No group for ' + s.id);
if (grouped.length !== skills.length) throw new Error('Group list has extra or repeated ids');
const index = { count: skills.length, sources: [['Marketing Skills by Corey Haines', 'https://github.com/coreyhaines31/marketingskills'], ['No AI slop by Peter Yang', 'https://github.com/petergyang/no-ai-slop'], ['last30days by Matt Van Horn', 'https://github.com/mvanhorn/last30days-skill']],
  groups: GROUPS.map(([name, ids]) => ({ name, skills: ids.map((id) => skills.find((s) => s.id === id).name) })) };
fs.writeFileSync(path.join(__dirname, '..', '..', 'js', 'skill-library.js'), '// Generated by scripts/skills/build.cjs. The AI Chat skill library, names only.\nwindow.SKILL_LIBRARY = ' + JSON.stringify(index) + ';\n');

const data = { built: new Date().toISOString().slice(0, 10), note: 'Library skills from MIT licensed repos (coreyhaines31/marketingskills, petergyang/no-ai-slop, mvanhorn/last30days-skill), cleaned for AI Chat. The founder\u2019s own skills win on overlap.', skills };
fs.writeFileSync(OUT, JSON.stringify(data));
const chars = skills.reduce((n, s) => n + s.body.length + Object.values(s.refs).reduce((a, b) => a + b.length, 0), 0);
console.log(skills.length, 'skills,', skills.reduce((n, s) => n + Object.keys(s.refs).length, 0), 'reference files,', Math.round(chars / 1024), 'KB');
