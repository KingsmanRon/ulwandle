# Product Telemetry: Business Case for Ulwandle Tech

**Prepared:** 30 October 2026 · **Audience:** founder / decision-maker · **Status:** greenfield — no analytics instrumentation exists in the codebase today

**Situation:** the product is built. The MTSR evidence workspace demo is deployable. Outreach has gone to AUDA-NEPAD, National Treasury CSP and GPRBA. The response so far is silence. The problem this document addresses is that *silence is currently unreadable* — there is no way to tell an unopened demo from an evaluated-and-rejected one, and those two situations call for opposite responses.

---

## The Problem: What We Can't Tell Today

Ulwandle is a pre-revenue, outbound, demo-led product sold into government and development-finance institutions. The population that matters is not thousands of users — it is roughly a dozen named evaluators at three or four organisations. Right now, none of the following is answerable:

- **Did anyone open the demo at all?** A link sent to a procurement officer that was never clicked, and a link that was clicked and dismissed, produce identical inboxes. One means the outreach failed; the other means the product failed. Different fixes entirely.

- **Did an evaluator reach the evidence pack export?** `ScenarioExport` — producing a ZIP evidence pack with the SHA256 fingerprint chain intact — is the single moment that proves the entire value proposition. If an evaluator reaches it, that is the highest-intent signal this product can generate. It is currently invisible.

- **Which organisation is looking?** A session originating from a `treasury.gov.za` or `nepad.org` network is a qualified lead in progress. Today that is indistinguishable from a recruiter or a bot.

- **Is anyone coming back?** One visit is curiosity. Three visits across a week is an internal evaluation underway — and the correct moment to follow up. Follow-up timing is currently guesswork.

- **Where does the demo lose people?** If evaluators consistently stall at CSV import and never reach second-person approval, that is a demo-design problem being misread as market rejection.

- **Which story actually lands?** There are three value narratives in play — SANS 241 compliance monitoring, the dual-control kill switch, and the evidence pack. Which screens evaluators dwell on tells us which one to lead with in the DWS personal-liability pitch. We are currently choosing by instinct.

---

## What Proper Instrumentation Unlocks

| What Becomes Possible | Why It Matters Here |
|---|---|
| **Separate "never opened" from "opened and passed"** | These are opposite problems. The first says fix the outreach; the second says fix the product or the pitch. Acting on the wrong one wastes the scarcest resource available — founder time. |
| **Surface high-intent evaluators while intent is live** | An evaluator who exports an evidence pack on a Tuesday is warm on Wednesday, not three weeks later. This converts follow-up from a calendar reminder into a triggered action. |
| **Show where the demo narrative breaks** | Drop-off concentrated at one screen is a fixable friction point, not a verdict on the market. |
| **Reveal which value story resonates** | Directs the DWS and AUDA-NEPAD positioning toward the narrative evaluators actually engage with. |

The decisive point: **a product with twelve evaluators and no telemetry is flying blinder than a product with twelve thousand users and no telemetry.** At this scale, every single session is decision-relevant, and losing one is losing a meaningful fraction of all available evidence.

---

## What's Involved

The codebase is greenfield — no existing analytics to reconcile or migrate, which is the cheapest possible starting position.

| Step | What AI does | What you do | Effort |
|---|---|---|---|
| **Audit** | Scans the codebase, inventories current tracking | Review the (near-empty) output | Minutes |
| **Design** | Generates a tracking plan for this domain — demo-funnel events, evidence-pack milestones, org-level grouping | Review event names, confirm what matters | 1–2 hours |
| **Implement** | Generates typed event definitions and SDK wrapper following existing conventions | Review, integrate, test delivery | 1–3 days |

**Total: a few days.** Ongoing cost is minutes per new feature.

**What this is not:** not a rewrite, not a data-warehouse project, not a second product. Tracking calls are lightweight additions to existing React components and FastAPI routes. The analytics platform handles storage and visualisation.

---

## Objections Worth Pre-empting

**"I have almost no users — analytics is premature."** This is the strongest objection and it is backwards for this specific product. Telemetry is premature when you have so much traffic that individual sessions don't matter. Here, individual sessions are the *entire* evidence base. Ten sessions from the right three organisations are worth more than ten thousand anonymous pageviews.

**"I should be selling, not instrumenting."** This *is* the feedback loop on the selling already done. Three days of work to make every future outreach measurable, applied against a pipeline that will run for months.

**"My buyers are government — is tracking appropriate?"** Anonymous behavioural events only. No PII, no names, no personal identifiers — organisation-level and session-level signals are sufficient for everything above, and that keeps it clean under POPIA. This is standard practice for B2B products selling into the public sector.

---

## Getting Started

1. **Audit** — scan the codebase and confirm the baseline. Minutes, and it produces an immediate honest picture.
2. **Design the plan** — define the demo funnel: session start → metro selected → CSV imported → approval step → evidence pack exported. Plus organisation-level grouping so evaluator sessions can be distinguished from noise.
3. **Implement** — generate and integrate the tracking module.

The first step costs almost nothing and is reversible. Start there.

---

### Scope caveat

Telemetry measures the demand that reaches the product. It does not create demand. The primary constraint on Ulwandle remains distribution and buyer identification — the AUDA-NEPAD procurement pipeline and the DWS personal-liability angle under the Water Services Amendment Bill. This instrumentation is the measurement layer that tells you whether those efforts are landing. It is a multiplier on the go-to-market work, not a substitute for it.
