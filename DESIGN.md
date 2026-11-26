---
name: Founders AI OS
description: Open white workspace for founder content and asset work, with a neutral charcoal dark mode.
colors:
  canvas: "#ffffff"
  raised: "#f5f5f5"
  active: "#f0f0f0"
  border: "#ebebeb"
  rule: "#ededed"
  control: "#d6d6d6"
  ink: "#1c1c1c"
  muted: "#595959"
  faint: "#686868"
  positive: "#23784b"
  negative: "#c0362f"
  warning: "#96600c"
  signal: "#b85121"
  pill-positive-bg: "#e2f3e8"
  pill-positive-ink: "#17542f"
  pill-negative-bg: "#fbe6e3"
  pill-negative-ink: "#8a231d"
  pill-warning-bg: "#fbf0dc"
  pill-warning-ink: "#7b4c08"
  pill-neutral-bg: "#f2f2f2"
  pill-neutral-ink: "#494949"
  charcoal-ground: "#141414"
  charcoal-surface: "#191919"
  charcoal-raised: "#242424"
  charcoal-active: "#272727"
  charcoal-rule: "#2b2b2b"
  charcoal-control: "#454545"
  dark-ink: "#f4f4f4"
  dark-muted: "#b5b5b5"
  dark-faint: "#a3a3a3"
  dark-positive: "#5cc28a"
  dark-negative: "#ec6a6a"
  dark-warning: "#e5a93b"
  dark-signal: "#ef9660"
typography:
  wordmark:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  display:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 4vw, 52px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 34px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  artifact-title:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "-0.03em"
  section:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  reading:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  small:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "5px"
  sm: "7px"
  md: "8px"
  control: "9px"
  frame: "10px"
  menu: "12px"
  bubble: "16px"
  composer: "18px"
  dialog: "20px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  section: "36px"
  split: "48px"
components:
  sidebar:
    backgroundColor: "{colors.canvas}"
    width: "232px"
  topbar:
    backgroundColor: "{colors.canvas}"
    height: "60px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-ghost:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "38px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  button-small:
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-send:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    size: "34px"
  nav-item:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "34px"
  nav-item-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  nav-item-active:
    backgroundColor: "{colors.active}"
    textColor: "{colors.ink}"
  input-field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "40px"
  textarea:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
  composer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.reading}"
    rounded: "{rounded.composer}"
    padding: "18px 16px 10px"
    width: "min(100%, 780px)"
  suggestion-chip:
    textColor: "{colors.muted}"
    typography: "{typography.small}"
    rounded: "{rounded.sm}"
    padding: "10px 8px"
  suggestion-chip-hover:
    backgroundColor: "{colors.raised}"
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.small}"
    padding: "8px 2px 10px"
  tab-selected:
    textColor: "{colors.ink}"
  list-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px"
  list-row-hover:
    backgroundColor: "{colors.raised}"
  list-row-selected:
    backgroundColor: "{colors.active}"
  status-pill-positive:
    backgroundColor: "{colors.pill-positive-bg}"
    textColor: "{colors.pill-positive-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "21px"
  status-pill-negative:
    backgroundColor: "{colors.pill-negative-bg}"
    textColor: "{colors.pill-negative-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "21px"
  status-pill-warning:
    backgroundColor: "{colors.pill-warning-bg}"
    textColor: "{colors.pill-warning-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "21px"
  status-pill-neutral:
    backgroundColor: "{colors.pill-neutral-bg}"
    textColor: "{colors.pill-neutral-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "21px"
  user-bubble:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    typography: "{typography.reading}"
    rounded: "{rounded.bubble}"
    padding: "12px 16px"
  menu:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.menu}"
    padding: "6px"
    width: "300px"
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    width: "min(640px, calc(100% - 32px))"
  preview-frame:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.frame}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
---

# Design System: Founders AI OS

## Overview

**Creative North Star: "Open Workspace"**

"Open Workspace" is a plain working description of the shipped build, not a slogan. The founder works directly on a conversation or an artifact. A persistent white sidebar and a quiet top bar are the only permanent frame. Everything inside the canvas is open: hierarchy comes from type weight, spacing and single 1px rules, not from cards stacked inside cards. Light mode is pure white from sidebar to composer. Dark mode is a neutral charcoal with near-white controls, never a tinted brown or blue.

The interface follows the familiar conventions of current conversational AI products: a centered welcome and one rounded composer in Chat, a document editor beside a short brief in Emails, a flat list beside a full-size artifact in Graphics and Funnel Agent. Context, history, sources and completed build steps are available on demand through toggles and chevron disclosures, so the working surface stays clear.

Color is almost absent from the working UI. Ordinary actions are ink; destructive actions retain Negative Red. Gray fills mark hover and selection. Green, red, amber and a single signal orange report state or lead a chart. Generated artwork, Brand DNA visuals and funnel page previews keep their own branding inside clearly bounded frames.

**Key Characteristics:**
- Pure white light canvas, sidebar, top bar, inputs and composer.
- Neutral charcoal dark mode with near-white primary controls.
- Geist for all working UI and headings; Bricolage Grotesque only in the Founders OS wordmark.
- Sections separated by spacing and 1px rules instead of nested containers.
- Borders reserved for things you type into, select, or open as an isolated artifact.
- Ink primary actions; semantic color for state and destructive intent.
- Short, eased transitions that respect reduced motion.

## Colors

A near-achromatic gray system with ink actions and a small set of semantic state colors, defined per theme as CSS custom properties on `:root`.

### Primary
- **Working Ink** (`ink`): Primary buttons, the chat send button, switches when on, checkboxes, range sliders, selected tab underlines, focus outlines, text selection and caret. Also the main text color. In dark mode the same roles use **Near White** (`dark-ink`) with charcoal text on top.

### Tertiary
- **Signal Orange** (`signal`, dark `dark-signal`): State, not action. Running agents, chart lead series (`--chart-1`), missed items, evidence rules and the Jarvis map and voice core. Its accent pill tints (`--pill-accent-bg`, `--pill-accent-ink`) follow the same rule.

### Semantic
- **Positive Green** (`positive`, dark `dark-positive`): Connected and synced dots, live indicators, upward deltas.
- **Negative Red** (`negative`, dark `dark-negative`): Errors, failed steps, destructive buttons, downward deltas. Chat and email failures pair it with a drawn alert icon and a Retry action.
- **Warning Amber** (`warning`, dark `dark-warning`): Pending or at-risk state.
- **Status pill tints** (`pill-*-bg` with `pill-*-ink`): Tinted background with a darker ink of the same hue for compact status labels. Dark mode defines matching `--pill-*` values in `app.css`.

### Neutral
- **White Canvas** (`canvas`): The light ground for page, sidebar, top bar, fields, composer, dialogs and menus. Light mode has no separate surface tone.
- **Hover Gray** (`raised`): Hover fill for nav items, ghost buttons, chips and list rows; user message bubbles; tag and keyboard-hint fills.
- **Selected Gray** (`active`): The current nav item, selected list row and selected format.
- **Hairline** (`rule`, `border`): 1px section dividers, the sidebar edge, the top bar edge and the preview frame outline.
- **Control Stroke** (`control`): Input, composer and secondary button borders, switch track when off, scrollbar thumb.
- **Secondary Text** (`muted`): Subtitles, nav labels at rest, ghost buttons, suggestions.
- **Tertiary Text** (`faint`): Meta lines, placeholders, group labels, counts.

Dark mode maps one to one: `charcoal-ground` for the page, sidebar, top bar and fields; `charcoal-surface` for drawers, dialogs and menus; `charcoal-raised` and `charcoal-active` for hover and selection; `charcoal-rule` for hairlines and borders; `charcoal-control` for strokes; `dark-ink`, `dark-muted` and `dark-faint` for text.

### Named Rules
**The White Ground Rule.** In light mode every app surface sits on White Canvas. Hierarchy comes from Hover Gray, Selected Gray and Hairline, never from a tinted or ivory background.

**The Ink Action Rule.** Ordinary actions, toggles and focus indicators use Working Ink in light mode and Near White in dark mode. Destructive actions may use Negative Red. Signal Orange never marks a button, link, focus ring or selection.

**The State Color Rule.** Green, red, amber and Signal Orange report status or lead a chart. Negative Red also identifies destructive actions. Other working UI remains neutral.

## Typography

**Display Font:** Geist (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Geist (same stack)
**Wordmark Font:** Bricolage Grotesque, weight 600 (with Geist as fallback)

**Character:** One neutral grotesque carries every working role, tightened with negative tracking at heading sizes. Bricolage Grotesque appears once, in the sidebar wordmark, as the brand signature. Geist loads from Google Fonts at weights 400, 450, 500, 550, 600, 650 and 700, and the intermediate 450 and 550 weights are used for nav labels and selected states.

### Hierarchy
- **Wordmark** (600, 19px, line-height 1, -0.025em): "Founders OS" in the sidebar brand row only.
- **Display** (500, clamp(34px, 4vw, 52px), 1.02): The Jarvis and Live home headings.
- **Headline** (500, clamp(26px, 2.5vw, 34px), 1.2, balanced wrap): The Chat welcome question and other centered empty-state headlines.
- **Title** (600, 25px, 1.2): Page titles in the title row. Chat uses a compact 19px title so the conversation leads.
- **Artifact Title** (550, 21px, 1.35): The name of the open graphic set, sales page or similar artifact.
- **Section** (600, 15px, 1.3): Section headings inside a page. Rail and panel headings drop to 13px.
- **Reading** (400, 15px, 1.75): Assistant replies and user bubbles, capped at 70ch. Email bodies use 14px at 1.8.
- **Body** (400, 14px, 20px): Default UI text.
- **Label** (500, 13px): Field labels and nav items (nav at 450, current item at 550).
- **Small** (400, 12px, 1.5): Meta lines, suggestions, tabs, scope and model selectors.
- **Caption** (400, 11px, 1.5): Group labels, status pills, footnotes, timestamps.

### Named Rules
**The One Wordmark Face Rule.** Bricolage Grotesque is the wordmark and nothing else. The legacy `--serif` variable is aliased to Geist, so older serif roles render in Geist; keep it that way.

**The Sentence Case Rule.** Headings, labels, tabs and group labels are sentence case at normal tracking. Hierarchy is weight and size, not uppercase letter-spacing.

## Layout

A fixed two-column shell: the 232px sidebar and a fluid main column with a sticky 60px top bar (56px below 860px). The canvas uses 36px side padding at desktop, 28px below 1200px, 24px below 980px and 16px below 860px, with a 1600px maximum width.

Spacing rhythm is 4, 8, 12, 16, 20, 24, 32, 36 and 48px. Page title rows sit 30px above content. Stacked sections are 36px apart; two- and three-column grids use 32px column gaps and 36px row gaps. Splits between a brief or list and its work area use 48px (Emails) or 32px (asset workspaces), with a 1px hairline on the dividing edge.

Working layouts:
- **Chat:** a single column. The welcome is centered at 740px; the conversation log centers at about 772px; the composer is 780px wide and stays at the bottom. History and context open as a 256px right rail with a hairline left edge, replacing the conversation below 980px.
- **Emails:** a 360px brief (320px below 1200px) beside an open document editor; stacks below 980px with a hairline between.
- **Graphics and Funnel Agent:** a 220px list (188px below 1200px) beside the full-size artifact; below 980px the list becomes a horizontal row of 190px items above the artifact.

Secondary detail lives behind disclosure: a summary row with a 14px chevron that rotates 180deg when open. Running or failed steps stay visible outside the disclosure.

### Named Rules
**The Open Canvas Rule.** Group content with spacing and a single 1px rule. If removing a container's border and fill leaves the grouping clear, the container should not exist.

## Elevation & Depth

The system is flat. Depth comes from tone (White Canvas to Hover Gray to Selected Gray in light; charcoal ground to surface to raised in dark), 1px hairlines and overlay scrims. Panels, lists, cards, the composer, dialogs and menus carry no drop shadow. Drawers slide in from the right over a black scrim at 45% opacity; dialogs use a 50% black backdrop. The motion values are in the sidecar.

### Named Rules
**The Flat At Rest Rule.** Nothing on the working canvas casts a shadow. Separation is tone and hairline; overlays separate with a scrim.

## Shapes

Corners are soft and small on controls and grow with the size of the object: 5px status pills and tags, 7px nav items, chips and the search field, 8px small buttons, list rows and images, 9px default buttons and fields, 10px preview frames, 12px menus, 16px user bubbles, 18px chat composer (16px on mobile), 20px dialogs, full rounding for the send button, switches, avatars and toasts.

Borders are 1px. Fields, the composer and secondary buttons use Control Stroke; frames and edges use Hairline. Underline tabs use a 2px bottom bar in ink. Quote and evidence rules are 1px left borders.

### Named Rules
**The Earned Boundary Rule.** A border or fill is earned by function: an input or composer you type into, a row or format you can select, or an isolated artifact such as a page preview, generated image, dialog or menu. Content groups never get one.

## Components

### Buttons
Quiet and direct.
- **Shape:** gently rounded (9px default, 8px small).
- **Primary:** Working Ink fill with white text, 38px tall, 16px side padding, weight 500. Hover lowers opacity to 0.9; press moves down 1px over 120ms.
- **Secondary:** transparent with a 1px Control Stroke border; hover fills Hover Gray.
- **Ghost:** no border, Secondary Text; hover fills Hover Gray and switches to ink.
- **Small:** 32px tall, 12px side padding. Icon buttons are 34px square.
- **Focus:** 2px ink outline at 3px offset.
- **Disabled:** 55% opacity, not-allowed cursor, no press movement.

### Chips and Suggestions
- **Style:** borderless text actions in Secondary Text with a small leading stroke icon. Chat suggestions sit in a two-column grid; email context chips use a plus icon.
- **State:** hover fills Hover Gray at 7px radius. Toggle chips that are pressed fill with Working Ink.

### Status Pills
- **Style:** 21px tall, 5px radius, 11px text, tinted background with matching ink (positive, negative, warning, neutral, accent). Inside list rows the pill drops its fill and reads as colored caption text.

### Cards / Containers
- **Default:** none. Sections are open blocks separated by spacing and Hairline rules; KPI groups are divided by hairlines, agent and template entries are divided rows.
- **Exceptions:** preview frames (10px, Hairline border, Hover Gray chrome bar with three 7px dots), generated images (8px), dialogs (20px, Hairline border), menus (12px, Control Stroke border, 6px padding). See Elevation & Depth: no shadows.

### Inputs / Fields
- **Style:** White Canvas fill, 1px Control Stroke, 9px radius, 40px tall, 14px side padding; textareas 12px padding. Mobile fields use 16px text.
- **Focus:** border turns ink plus a 2px ink outline at 2px offset.
- **Inline editors:** email subject and preview lines are borderless with a bottom hairline; the email body is a borderless document area with a focus outline only.
- **Error:** inline Negative Red text with a drawn alert icon and a Retry action next to the control; the entered brief is kept.

### Navigation
- **Sidebar:** White Canvas with a Hairline right edge. Nav items are 34px rows, 13px Geist at 450 in Secondary Text with a 16px stroke icon (1.5 stroke width), 7px radius. Hover fills Hover Gray; the current page fills Selected Gray at weight 550. Counts are right-aligned caption numerals. Group labels are 11px Tertiary Text, sentence case.
- **Bottom:** a Light mode switch (ink when on) and the account row.
- **Top bar:** a borderless "Ask your workspace" field with a gray keyboard hint, a voice button, sync status with a green dot, and the workspace switcher.
- **Mobile:** below 860px the sidebar becomes a full-screen White Canvas overlay that slides in from the left, opened from a menu button in the top bar.

### Tabs
- **Style:** text tabs with a 2px underline. Rest is Secondary Text at 12px; selected is ink at weight 550 with an ink underline over a hairline base. Used for email tabs, mode switches (Write for me, Library) and the preview size toggle.

### Chat Composer (signature)
The single input of the Chat workspace. White Canvas, 1px Control Stroke, 18px radius, 18px 16px 10px padding. A 15px textarea sits above a tool row holding the context scope and model selectors as borderless 12px text with small chevrons, and a 34px round ink send button. Focus inside darkens the border to Secondary Text. Pending replies swap send for Stop.

### Conversation
Assistant replies are open text at Reading size beside a 20px stroke avatar, with sources in a chevron disclosure and a quiet meta footer. User messages are Hover Gray bubbles at 16px radius. CMO Room seats are divided by hairlines, with a 22px outlined seat badge and the verdict under a Control Stroke rule.

### Asset List
The left list in Graphics and Funnel Agent: borderless 8px rows with 10px padding, 12px bold titles and caption meta. Hover fills Hover Gray, selected fills Selected Gray. Graphics rows lead with a 42px thumbnail at 5px radius.

## Do's and Don'ts

### Do:
- **Do** keep light-mode page, sidebar, top bar, fields and composer on White Canvas (#ffffff).
- **Do** use Working Ink for primary actions, switches, checkboxes, sliders, selected tabs and focus outlines, and Near White for the same roles in dark mode.
- **Do** separate sections with the 36px section gap and a single 1px Hairline.
- **Do** mark hover with Hover Gray and selection with Selected Gray at 7px or 8px radius.
- **Do** give inputs and the composer a 1px Control Stroke and a 2px ink focus outline.
- **Do** put history, context, sources and completed steps behind a chevron disclosure or toggle, and keep running or failed states visible.
- **Do** use drawn stroke SVG icons at 1.5 to 1.6 stroke width.
- **Do** keep transitions at 120 to 240ms on the shared ease-out curve and remove them under reduced motion.

### Don't:
- **Don't** tint the light-mode app background warm or ivory; the white direction replaced the previous warm styling.
- **Don't** wrap a content section in a bordered or filled card, or nest one container inside another to group content.
- **Don't** use Signal Orange or semantic colors for ordinary actions, focus or selection. Negative Red is reserved for errors and destructive actions.
- **Don't** set working UI, headings or numbers in Bricolage Grotesque.
- **Don't** add uppercase, letter-spaced eyebrow labels above headings.
- **Don't** add drop shadows to panels, lists, the composer, menus or dialogs.
- **Don't** recolor generated graphics, Brand DNA artwork or funnel page previews to the workspace palette; frame them instead.
