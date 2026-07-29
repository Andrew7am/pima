# Pima subagents

28 subagent definitions, curated from [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents)
(315 agents) down to the ones that fit this project.

They live here rather than in `~/.claude/agents/` because they are chosen for
Pima specifically — keeping them in the repo means anyone working on the app
gets the same set, and nobody's global config is touched.

Claude Code reads these at startup, so restart after adding or editing one.
Invoke by the `name:` in the frontmatter, e.g. "use the Internationalization
Engineer to review the RTL in BookingJourney".

## ⚠️ Tool access

Only six declare a `tools:` allowlist:

    marketing-content-creator, marketing-growth-hacker, marketing-seo-specialist,
    marketing-social-media-strategist, product-feedback-synthesizer, product-manager
    → WebFetch, WebSearch, Read, Write, Edit

The other 22 have no `tools:` line, which means they inherit **every** tool,
including `Bash`. That is Claude Code's default, not a defect in the files — but
it is worth knowing before handing one a broad task. Add a `tools:` line to any
agent that should be narrower.

These files were scanned before being committed: no network calls, no
destructive shell, no encoded payloads, no instructions attempting to override
the session. The handful of `process.env.*` mentions are code samples inside
the engineering agents' documentation, not directions to read secrets.

## The set

### Core

| Agent | For |
|---|---|
| `engineering-i18n-engineer` | RTL/bidi, the six Arabic plural forms, ICU MessageFormat |
| `engineering-mobile-app-builder` | the app itself |
| `engineering-backend-architect` | booking API, availability, double-booking prevention |
| `engineering-payments-billing-engineer` | payments, webhooks, refunds, the deposit |
| `engineering-frontend-developer` | React/Vite work |
| `engineering-database-optimizer` | Postgres/Supabase query and index work |
| `product-manager` | roadmap, PRDs, launch |
| `design-ui-designer` | house cards, component system |
| `design-brand-guardian` | the palette and identity |

### Launch

`engineering-mobile-release-engineer` · `marketing-app-store-optimizer` ·
`marketing-seo-specialist` · `marketing-growth-hacker` ·
`marketing-social-media-strategist` · `marketing-email-strategist`

### Content

`design-visual-storyteller` · `marketing-video-optimization-specialist` ·
`design-image-prompt-engineer` · `marketing-instagram-curator` ·
`marketing-content-creator` · `design-whimsy-injector`

### Users and operations

| Agent | For |
|---|---|
| `hospitality-guest-services` | bookings, cancellations, guest complaints — Pima's exact domain |
| `design-ux-researcher` | usability testing |
| `product-feedback-synthesizer` | analysing user feedback |
| `support-analytics-reporter` | metrics and reporting |
| `support-legal-compliance-checker` | terms, privacy, compliance |
| `testing-accessibility-auditor` | accessibility |
| `specialized-cultural-intelligence-strategist` | tone and cultural fit |
