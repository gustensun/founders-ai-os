# Third-party notices

Founders AI OS includes work by other people. Each part below keeps its own license, and the Founders AI OS license in [LICENSE](LICENSE) doesn't change that.

## Included in this repository

| Part | Where | Source | License |
|---|---|---|---|
| Marketing skills, cleaned for AI Chat | `api/_skill-library.json` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT, Copyright (c) 2025 Corey Haines |
| No AI slop writing skill, cleaned for AI Chat | `api/_skill-library.json` | [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | MIT, Copyright (c) 2026 Peter Yang |
| Last 30 days research method, adapted | `api/_skill-library.json`, `scripts/skills/last30days.md` | [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | MIT, Copyright (c) 2026 Matt Van Horn |
| Chart helpers | `charts.js` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT, Copyright (c) 2026 Leonxlnx |
| tus resumable uploads | `vendor/tus.min.js` | [tus/tus-js-client](https://github.com/tus/tus-js-client) | MIT, Copyright (c) 2015 tus - Resumable File Uploads. Full text in `vendor/tus-LICENSE.txt` |
| Mediabunny media toolkit | `vendor/mediabunny.mjs` | [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny) | MPL-2.0, Copyright (c) 2026-present, Vanilagy and contributors. Full text in `vendor/mediabunny-LICENSE.txt` |
| Brand marks in Connections | `js/brand-logos.js` | [Simple Icons](https://github.com/simple-icons/simple-icons) | CC0 1.0. The brands themselves belong to their owners. |

## Loaded when the app runs

These aren't stored in this repository. The app loads them from their own sources.

| Part | How it loads | License |
|---|---|---|
| Supabase JavaScript client | jsDelivr CDN, in `index.html` | MIT |
| Geist and Instrument Serif fonts | Google Fonts, in `index.html` | SIL Open Font License 1.1 |
| Taste skill | Fetched from [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) when you add it as design guidance for AI Chat and the Funnel Agent | MIT |
| Impeccable | Fetched from [pbakaus/impeccable](https://github.com/pbakaus/impeccable) when you add it as design guidance for AI Chat and the Funnel Agent | Apache-2.0 |
| npm packages in `package.json` | Installed by Vercel at deploy time | Each package's own license |

## MIT License text

The MIT parts listed above use this license, each with its own copyright line from the table.

```
MIT License

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
