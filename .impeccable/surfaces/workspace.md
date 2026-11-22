# Workspace redesign

## Mode

Operate. The founder should be able to start work, review an artifact and continue a conversation without navigating nested decorative containers.

## Direction

Use the user's named conversational tools as interaction references, not as brands to imitate. White light-mode canvas, persistent white sidebar, neutral type, open content, restrained dividers and one clear working area. Keep dark mode neutral and readable.

## Direction contract

THESIS: The founder works directly with the conversation or artifact. Remove the old arrangement of cards nested inside cards.

OWN-WORLD: White canvas and sidebar in light mode; neutral near-black dark mode. Geist working type, the existing serif wordmark, quiet gray selection, black primary controls and semantic color only where it conveys state.

STORY: Choose a task in the persistent sidebar, supply the relevant context, review the result and edit or continue. Existing data and integrations stay in place.

FIRST VIEWPORT: A restrained top bar and 232px sidebar frame the workspace. Chat centers a 740px welcome and single composer; Emails pairs a 360px brief with an open editor; asset workspaces use a 220px list and a full-size artifact.

FORM: User-pinned familiar conversational-product interface, explicitly referencing Grok, Perplexity and ChatGPT. Code-led Operate surface. Seed reference: seed:5d283454d03cd24e. The reference was generated and validated after the launcher recovered during finish review; it did not choose or replace the user's pinned direction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Structure

- Chat: centered, open conversation; one composer; CMO Room stays visible. History and workspace context are available on demand.
- Emails: an unboxed brief beside a document editor. Sequence navigation and individual-email tabs reduce repeated forms.
- Graphics: flat asset navigation beside the artwork or creation form.
- Funnel Agent: the preview leads. Completed build steps are available in a disclosure, and running or failed steps remain visible.
- Other routes: apply the same typography, white surfaces, controls and reduced panel chrome.

## Vault extension

Keep the existing reference collection and its media. Examples and Inspiration share
the current route, with a quiet tab strip rather than another sidebar destination.
The saved-brief view pairs a 220px searchable list with an open reading and editing
surface. A new brief uses a bounded multi-select list, one context field and one
Summarize and save action. Reuse starts from the saved brief and accepts fresh
context before writing or opening Funnel Agent. Source references remain inspectable;
missing or changed material, unsaved work and disabled automatic use stay visible.
This extends the established direction contract, not the visual identity.

## Programs extension

Programs inherits this code-led Operate contract and the user's explicit kanban
structure. A 220px program list sits beside an open module board. Each named
column holds editable lessons or coaching sessions; cards are bounded because
they move, while the board itself stays unboxed. On narrow screens the program
picker moves above a horizontally scrollable board, never outside the viewport.
Outline and Materials share the selected program. AI Chat opens a proposed
outline or a named set of changes for review before any program is created or
changed. Existing manual work is read-only to AI unless changes were requested.
The signature interaction is moving a lesson between editable modules, with
equivalent select and reorder controls for touch and keyboard use. No course
content is seeded into a live workspace. Keep the existing visual system and
seed reference above; this is an extension, not a new identity.

## Verification

Check mobile and desktop, both themes, keyboard navigation, overflow, error/loading states and the existing creation and editing workflows. Keep genuine media and embedded page frames. Do not manufacture live provider or deployment success.

## Creator workspace extension

Connections, Agents, Approvals, curated Offers/Funnels and Video editor inherit
the existing code-led Operate contract. No new visual identity is introduced.
Connections separates remote tools from imported design guidance and puts the
exact request behind explicit approval. Agents uses divided role/task rows;
proposal review precedes activating recurring schedules.

Approvals is the single suggestion queue. Open draft excerpts and format,
platform, tag and source filters lead into editing, approval or reversible
trash. Approval moves the existing content row rather than creating a copy.
Per-format and per-platform schedules live in its Idea cadences tab.

Offers and Funnels separate Live, Planned, Paused and Archived strategy from
importable inventory. Their fields describe the founder's decisions without
turning every post into a sales pitch or modifying the saved DNA document.

Video editor follows the artifact workspace: a 220px edit list beside footage
and brief, storyboard and style, then exports and revisions. Source previews
retain their own imagery. An exact-revision approval is required before a real
render; changing any edit invalidates that approval. Upload and export failures
retain completed files for retry, and unsaved work warns before replacement.
Mobile stacks the list above the editor with accessible native controls.

## Delivery boundary

Development context only. Exclude `.impeccable`, PRODUCT.md, DESIGN.md and testing artifacts from web delivery.
