# Last 30 days: what people are actually saying

Adapted from last30days by Matt Van Horn (MIT, github.com/mvanhorn/last30days-skill) for AI Chat. The original runs a local Python engine with many API keys. Here the same method runs on the community_pulse tool (Reddit, X, YouTube, TikTok, Instagram, LinkedIn and Hacker News, last 30 days) plus web_search and read_web_page.

Use when the founder asks what is happening, trending or being said about a topic, person, product, tool or niche right now, what people think of something, what the best X is according to real users, or wants content angles grounded in this month's conversation.

## 1. Parse the request
- TOPIC: what they want to learn about. Keep proper nouns exactly as written.
- QUERY TYPE: RECOMMENDATIONS ("best X", "top X", "what should I use"), NEWS ("what is happening with X"), COMPARISON ("X vs Y"), PROMPTING ("X prompts", "best practices for X") or GENERAL.
- REGISTER: default; creator when the founder wants content ideas (lead with hooks and the strongest audience language, end with three content angles grounded in the evidence); exec when they want a decision (five findings, each with its implication).

## 2. Pre-flight the query before searching
Fix keyword traps first, they waste the whole run:
- Numbers that collide with unrelated content ("42", "the 100"): drop the number from the search query unless it is part of a product name (GPT-5, Area 51).
- Tutorial phrasing ("how to use X"): people do not post like that. Search discussion phrasing instead ("X setup", "X tips", "X workflow", "my X results").
- A single common noun ("coffee", "shoes"): narrow it to the founder's niche from the Brand DNA before searching. Only ask when the Brand DNA gives no angle.
- Names that collide with other people or words: anchor every query with the company, role or product ("Kevin Rose Digg", "Tella screen recorder").
Never put "last 30 days", "recent", month names, years, "news" or "updates" in the search query itself. The tool already limits the window.

## 3. Plan one to four subqueries
- Primary: the topic, keyword heavy, the way posts are titled, on every platform.
- Secondary (weight 0.6 to 0.8): the angle the founder cares about (reactions, reviews, pricing, alternatives, results).
- Product topics lean on YouTube (reviews), Reddit (discussion) and TikTok (demos). How-to topics lean on YouTube and Reddit. Tech and tools add Hacker News.
- Comparisons: run the plan for each side separately, each with its category ("tella screen recorder review", not "tella review").

## 4. Collect
- Call community_pulse once per subquery with the platforms that fit. It returns dated posts with engagement where the platform shows it (Hacker News points and comments always; others when the page snippet carries them).
- Then run two or three web_search calls for the same window to catch articles, launches and official announcements.
- Read the two to four strongest threads or pages in full with read_web_page. Top comments often carry the sharpest take.

## 5. Judge the evidence
- Cluster items into stories or themes across platforms. A theme found on three or more platforms is the strongest signal; lead with it.
- Engagement chooses the evidence: high upvotes, points, views and comment counts outrank articles with no engagement. A heavily voted comment outweighs its parent post.
- A theme from one platform only is "single source": mention it with that caveat.
- When several people independently recommend the same thing in a "what is the best X" thread, call it out; it is the strongest form of endorsement.
- Ground every line in what the sources actually say, not prior knowledge. Do not merge similarly named products.
- Drop anything outside the window or about a different entity with the same name, silently.
- If nothing solid came back, say so plainly in one line and give what the web supplements support. Never fill the gap with general knowledge dressed up as this month's conversation.

## 6. Write it
- Start with "What I learned:" and two to four short paragraphs, each opening with a bold headline phrase, citing the strongest one or two sources by name with links.
- Then "Key patterns" as a numbered list of three to five, one source each.
- Up to six direct quotes from real posts or comments, each on its own line with who said it and where. Quote verbatim. Only quotes that carry the point.
- Engagement numbers decide what you show; print a count only when its size is the finding ("roughly four times the next post").
- For the founder: end with what this means for their business, for example three content angles or hooks tied to their offers, or one decision. Keep it specific to them.
- Offer to save useful findings: ideas to the Newsfeed with submit_draft, creators worth tracking as new rows, or a web watch with watch_web to keep following the topic.

## Quality bar
Every claim traces to a dated post or page from the last 30 days, the strongest cross-platform themes lead, the quotes are real, and the founder knows what to do with it.
