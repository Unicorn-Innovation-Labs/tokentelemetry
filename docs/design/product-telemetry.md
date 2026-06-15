# Design: Privacy-respecting product telemetry

**Status:** Draft for decision · **Author:** analysis · **Date:** 2026-06-14
**Related:** [[local-first-no-user-network]] principle · website CRO analysis (`tokentelemetry-cro-analysis.md`) · `harness_config.py` preference pattern · update-check (the only existing outbound call)

> **⚠️ Update 2026-06-15 — transport migrated to Cloudflare Analytics Engine.**
> Option A (Aptabase) below is the historical decision; we have since moved the
> sink from Aptabase to **Cloudflare Workers Analytics Engine**. Reasons:
> (1) the free tier is ~150× larger (100k points/**day** vs Aptabase's 20k/**month**);
> (2) **no key in the request path at all** — the Worker writes via an
> account-bound binding, so the open-source app ships zero credentials (the
> earlier key-leak concern disappears entirely). Trade-offs accepted: 3-month
> raw retention (mitigate with a Cron→D1/R2 rollup for long-term trends) and no
> built-in dashboard (query via SQL API / Grafana). See `proxy/README.md` for
> the live architecture, schema, and deploy steps. Everything else in this doc
> (opt-out model, allowlist redaction, first-run notice, event set) is unchanged.

---

## 1. The problem, stated honestly

We want to know **which features people actually use** — integrated trace summaries,
local-model filtering on Analytics, the Hermes surface, Projects/Plans, Artifacts,
etc. — so product effort goes where it matters instead of where we guess. Today we
have **zero signal**: the app is 100% local and emits nothing, so every roadmap call
is blind.

This collides head-on with the product's defining promise, repeated on the site and
in the privacy policy:

> "100% local and read-only … never sends your usage data anywhere … TokenTelemetry
> has no usage-telemetry endpoint."

**Any telemetry weakens that sentence.** The whole design is about how to learn what
we need while keeping that promise *substantially* intact and, above all, **honest**.
A vague claim of "anonymous" is not enough — the CRO data shows our best-converting,
most-skeptical audience is developers (GitHub 66.7%, Reddit 53.7%, Google 53.0%
engagement). That audience verifies claims and punishes betrayal.

### The cautionary tale we must not repeat
In **April 2026 the GitHub CLI switched on _opt-out_ (default-on) telemetry** and took
sustained public criticism (The Register, developer blogs, "DO_NOT_TRACK" threads).
For a tool literally named *TokenTelemetry* whose pitch is "nothing leaves your
machine," shipping default-on telemetry would be brand suicide. This is the single
most important constraint below.

---

## 2. Non-negotiable principles

These are derived from our brand, the local-first memory, and 2025–2026 CLI-telemetry
best practice (GitHub CLI backlash, Next.js anonymous telemetry, VS Code, the
`DO_NOT_TRACK` convention).

1. **On by default, but informed and one-click reversible (opt-out).** *(Decision
   2026-06-14 — overrides the earlier opt-in stance.)* Telemetry is enabled by
   default; a **loud first-run notice** tells the user it's on, exactly what it
   collects, and that it helps improve the product, with an obvious one-click "Turn
   off." This is only defensible because of principles 2–8 below — **and only if the
   brand/privacy copy is rewritten to match (see 1a).** Silent-on or buried-opt-out is
   not acceptable; the user must be *told*, not have to discover it.
   - **1a. The "we collect nothing" promise MUST be rewritten before release.** The
     site + privacy policy today say "never sends your usage data anywhere… no
     usage-telemetry endpoint." On-by-default makes that false. Releasing without
     fixing the copy is the actual failure mode (cf. the GitHub-CLI backlash: the
     objection was the *default*, not the disclosure). Non-negotiable.
   - **1b. Strictly anonymous, no personal data — this is what makes default-on
     lawful.** Under GDPR/ePrivacy, only genuinely non-personal anonymous analytics
     may run **without prior opt-in consent**. No stored IP, no stable identifier,
     content-free, allowlist-enforced (§3.3). Aptabase's no-cookie/no-PII model is
     built for exactly this. Add anything personal and default-on becomes a legal
     problem, not just a trust one.
2. **Inspectable.** The user can preview the *exact* payload any time ("Show me what
   you send") — on the first-run notice and in Settings. Anonymous only lands with
   developers if they can verify it in five seconds.
3. **Reversible instantly.** One toggle in Settings; opting out stops emission
   immediately and is honored on the very next event.
4. **No content, ever.** No prompts, code, file paths, project names, tokens, costs,
   model outputs, log text. Only *that a feature was used*, never *what it operated on*.
5. **No durable identity.** No account, no email, no stable hardware fingerprint. A
   rotating, locally-generated anonymous id at most (see §7).
6. **Best-effort, never blocks.** Telemetry failures (offline, endpoint down) are
   swallowed silently and never slow or break the app. Mirror the update-check's
   fail-open posture.
7. **Honor the ecosystem kill-switches.** Respect `DO_NOT_TRACK=1` and a dedicated
   `TT_NO_TELEMETRY=1` env var (hard off, not user-overridable — for org/policy).
   CI / non-interactive launches never prompt and never emit.
8. **Document it precisely** in the privacy policy and README, including a sample
   payload. Update the "we collect nothing" copy to "we collect nothing unless you
   opt in, and here's exactly what."

> If we cannot hold all eight, we should ship **no telemetry** and use the
> voluntary-feedback fallback in §6 Option D instead.

---

## 3. What to collect (event taxonomy)

Grounded in the real routes (`frontend/src/app/*`) and features. The model follows the
CLI best-practice shape: a small number of **event names** + a tiny **anonymous context**,
sent at most once per meaningful action.

### 3.1 Anonymous context (attached to every event)
| Field | Example | Why | Risk |
|---|---|---|---|
| `app_version` | `1.4.2` | Correlate usage with releases; spot stuck-on-old-version | none |
| `os` | `darwin` / `win32` / `linux` | Platform prioritization | none |
| `session_id` | random per app launch | Group events in one run, no cross-session linking | low |
| `agents_detected` | `["claude-code","codex"]` (names only, count) | **Highest-value signal**: which agents people actually run | low — names are public product list, not user data |
| `summarizer_backend` | `ollama` / `claude` / `none` | Local vs cloud summarizer mix → where to invest | low |

### 3.2 Events (feature usage)
| Event | Fires when | Properties | Question it answers |
|---|---|---|---|
| `app.launched` | backend starts | — | DAU/retention, version spread |
| `page.viewed` | a route is opened | `route` (enum: dashboard, analytics, traces, projects, hermes, artifacts, local-models, settings…) | **Which surfaces matter.** Is anyone using Hermes? Artifacts? |
| `trace.summarized` | a trace summary is generated | `backend` (ollama/claude/…), `outcome` (ok/error-category) | Is the headline feature used? Which backend? Failure rate |
| `analytics.filtered` | a filter is applied on Analytics | `dimension` (agent/model/local-only/day), no values | **Is local-model filtering used?** (your explicit question) |
| `feature.used` | generic, for discrete features | `name` (plan-library, project-insights, delegation-view, power-cost, billing-mode, search…) | Long-tail feature adoption |
| `retention.opted_in` | user enables durable history | `tier` | Which power features convert |

**Duration/outcome buckets, never raw values.** e.g. summary latency as
`fast/medium/slow`, not milliseconds tied to a specific trace.

### 3.3 Explicitly NEVER collected
Prompts · code · file/dir paths · project or repo names · tokens · costs in $ ·
model output · log content · IP-derived precise location · any free-text the user
typed · stable machine identifiers. These get an explicit **guardrail test**
(`test_telemetry_redaction.py`) asserting the serializer drops anything outside the
allowlist — so a future careless `feature.used("opened /Users/me/secret-repo")` can't
leak.

---

## 4. Where the data goes — the storage decision (you have no analytics engine)

This is the **real open fork.** We have no backend store, no dashboards, no pipeline.
The four realistic paths:

| Option | What it is | Pros | Cons | Fits "no engine"? |
|---|---|---|---|---|
| **A. Aptabase — managed (free tier)** ⭐ | Open-source, privacy-first analytics built *for desktop apps*. SDK posts events to their hosted endpoint; you read dashboards. No unique IDs, GDPR/CCPA/PECR-compliant by design. | Zero infra. Purpose-built for exactly this (macOS/Win/Linux). Free tier covers a small project. Privacy model already matches our principles. Fast to ship. | Third-party processor (must disclose). Outbound to aptabase.com. Free tier event cap. | ✅ they are the engine |
| **B. Aptabase — self-hosted** | Same SDK, you run the collector + ClickHouse via Docker. | Full data ownership; "your telemetry never touches a third party" story. | You operate infra (ClickHouse, updates, uptime). Heaviest ops. | ⚠️ you become the engine |
| **C. Tiny custom collector** | A Cloudflare Worker / minimal endpoint that appends events to a KV/D1 store; you write your own queries. | Cheap, full control, minimal surface. | You build *and maintain* ingestion + storage + every dashboard. Reinvents Aptabase poorly. | ⚠️ partial engine, lots of glue |
| **D. No network — voluntary "Share my stats"** | App computes an anonymized usage summary **locally**; a Settings button shows it and lets the user copy/paste it into a GitHub Discussion, or attach to a survey. Nothing auto-sends. | **Strongest brand fit** — literally still "nothing leaves your machine unless you click send." Zero infra, zero processor. | Tiny sample (only motivated users). Manual aggregation. Slow signal. | ✅ no engine needed |

### Recommendation
**Ship D first (this week), then add A behind the opt-in (next).**

- **D is the honesty-preserving MVP.** It costs almost nothing, can't betray the brand,
  and a "Help improve TokenTelemetry → review & share anonymized stats" panel doubles
  as the *transparency UI* we need for A anyway (it shows the exact payload).
- **A (Aptabase managed) is the scalable answer** once you want continuous signal. It
  solves the no-engine problem outright (they store + dashboard), its privacy posture
  already matches §2, and it's designed for desktop apps. Disclose it as a processor in
  the privacy policy. Revisit **B (self-host)** only if event volume outgrows the free
  tier or you want the "no third party at all" story as a selling point.
- **Avoid C** unless you specifically want to sell "we built our own and it's auditable" —
  it's the most code for the least differentiated result.

---

## 5. Consent & control UX

Mirror the existing cookie-consent (website) + `update_check` toggle (app) patterns,
but **default-on (opt-out)** — the user is *informed*, not asked permission.

1. **First-run notice** (one time, like the website cookie banner, dismissible) —
   informs that telemetry is **already on**:
   > "Anonymous usage stats are **on** to help improve TokenTelemetry — which pages
   > and features you use, never your code, prompts, paths, or costs.
   > **[See exactly what]** · **[Keep it on]** · [Turn off]"
   Both "Keep it on" and "Turn off" are equally weighted, visible choices (not a
   buried link). Non-interactive/CI launches don't show it — and, because there's no
   one to inform, **CI/non-interactive defaults to NOT emitting** (informed-consent
   can't be satisfied unattended; avoids silent server collection).
2. **Settings → "Usage & privacy"**: a toggle (default **on**), a live **payload
   preview**, a link to the privacy policy, and the env-override status (read-only when
   `TT_NO_TELEMETRY` / `DO_NOT_TRACK` is set — exactly like update-check's
   `env_forced_off`).
3. **Opt-out is immediate** and also wipes any local `telemetry_id`. `DO_NOT_TRACK=1`
   is honored as a pre-emptive opt-out (never emits, never shows the notice).

---

## 6. Anonymous identity

- On opt-in, generate `telemetry_id` = random UUID stored locally in
  `~/.tokentelemetry/telemetry.json`. **Rotate it every 30 days** (or offer a "reset
  id" button) so it can't become a long-term tracker.
- Opt-out deletes it. Never derived from hostname, MAC, disk serial, or any stable
  hardware value.
- Aptabase's model already avoids cross-session user IDs; if we use A, we lean on
  their session-only scheme and keep `telemetry_id` minimal or omit it.

---

## 7. Implementation surface (mirrors `update_check` almost exactly)

**Backend**
- `backend/harness_config.py`: add to `DEFAULT_PREFERENCES`:
  ```python
  "telemetry": True,           # opt-OUT: ON by default (cf. update_check). CI/
                               # non-interactive + DO_NOT_TRACK/TT_NO_TELEMETRY force off.
  ```
- `backend/telemetry.py` (new): `enabled()` (pref AND not `TT_NO_TELEMETRY` AND not
  `DO_NOT_TRACK`), `emit(event, props)`, allowlist serializer + redaction guard,
  best-effort async send (or local-buffer for Option D). Fail-open, never raises —
  same posture as `_update_check_enabled()` / the update fetch.
- `backend/main.py`: endpoints `GET/POST /config/telemetry` (copy the
  `/config/update-check` handler verbatim, including `env_forced_off` / `effective`),
  plus `GET /config/telemetry/preview` returning the exact next payload.
- `backend/test_telemetry_redaction.py` (new): asserts no non-allowlisted key, path,
  or free-text can be serialized. This is the guardrail that makes "anonymous"
  *verifiable*, per §3.3.

**Frontend** (`frontend/src/app/settings`)
- A "Usage & privacy" card with the toggle + payload preview, wired to the new
  endpoints (clone the update-check toggle component).
- First-run consent banner component (clone the website `Analytics.tsx` consent
  pattern; store choice in preferences, not just localStorage).

**Website** (`website/src/app/privacy/page.tsx`)
- Update "What we never collect" to: collects nothing **by default**; if you opt in,
  here is the exact, content-free list and the processor (if Option A). Keep it as
  plain and verifiable as the current copy.

**Env / docs**
- `TT_NO_TELEMETRY=1` and `DO_NOT_TRACK=1` documented next to `TT_NO_UPDATE_CHECK`.
- README + CHANGELOG note. Because this is user-facing (`feat:`), it needs an
  `UPDATE.json` entry per the project hook.

---

## 8. Example payloads

**Option D (local-only "share my stats" — copy/paste, nothing auto-sent):**
```json
{
  "schema": "tt-usage/1",
  "generated": "2026-06-14",
  "app_version": "1.4.2",
  "os": "darwin",
  "agents_detected": ["claude-code", "codex", "gemini-cli"],
  "summarizer_backend": "ollama",
  "usage_30d": {
    "pages": { "dashboard": 41, "analytics": 22, "traces": 18, "hermes": 0, "artifacts": 3 },
    "features": { "trace_summarized": 14, "analytics_local_filter": 9, "plan_library": 2 }
  }
}
```
*(Note the directly actionable signal: Hermes unused, local-model filter used 9×,
Artifacts barely touched.)*

**Option A (Aptabase, per-event):**
```json
{ "event": "analytics.filtered", "props": { "dimension": "local-only" },
  "ctx": { "app_version": "1.4.2", "os": "darwin", "session_id": "…" } }
```

---

## 9. Rollout phases

- **Phase 0 — instrument internally (no network):** add `telemetry.emit()` call sites
  behind the (off) flag, write the redaction test. Nothing sends. Pure plumbing.
- **Phase 1 — Option D ships:** Settings "Share my stats" panel + first-run prompt.
  Honest, infra-free, doubles as the transparency UI. Start gathering voluntary
  reports.
- **Phase 2 — Option A (Aptabase managed) behind the same opt-in:** continuous signal.
  Privacy policy discloses the processor. Watch the free-tier event cap.
- **Phase 3 (only if needed):** self-host (B) for volume or the "no third party" story.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Brand betrayal / "even *they* track now" backlash | Opt-in only; loud transparency; payload preview; never default-on (the GitHub-CLI mistake) |
| Accidental content leak in an event | Allowlist serializer + `test_telemetry_redaction.py` guardrail |
| Telemetry slows/breaks app | Best-effort, async, fail-open — same as update-check |
| Re-identification via rare field combos | Coarse buckets, no paths/names, rotating id, low cardinality enums |
| Low opt-in → unrepresentative data | Accept it as the honest price; treat as directional; pair with GitHub Discussions/surveys |
| Free-tier cap (Option A) | Sample high-frequency events (e.g. `page.viewed`) or self-host |

---

## 11. Decisions (locked 2026-06-14 — revised)

> **Revision:** the consent model was flipped from opt-in to **opt-out (on by
> default)** at the maintainer's direction. "On by default" only works with
> auto-send, so **Aptabase (Option A) becomes the primary, default-on transport**,
> and Option D's local summary is **repurposed as the in-app transparency/"see
> exactly what we send" preview** (not a separate manual phase).

| Question | Decision |
|---|---|
| **Consent model** | **Opt-out — ON by default**, with a loud first-run notice + one-click off (§2.1, §5). Strictly anonymous, no personal data (§1b). |
| **Transport** | **Aptabase managed (A)** as the default-on auto-send engine; **Option D repurposed** as the transparency preview UI. Self-host (B) revisited only if volume/positioning demands. |
| **First-run discovery** | **One-time first-run notice** stating telemetry is already on, with equal-weight *Keep on* / *Turn off* + *See exactly what*. CI/non-interactive: not shown **and** not emitting. |
| **Release gate (NEW, blocking)** | **Rewrite the homepage + `privacy/page.tsx` "we collect nothing / no telemetry endpoint" copy** to match on-by-default reality, *before* the release ships (§1a). The release is not shippable until this is done. |
| **Build status** | **BUILT 2026-06-14** (all phases). Backend `telemetry.py` + endpoints + redaction test (11/11 pass); frontend lib + first-run notice + Settings "Usage & privacy" card + page/filter emits; proxy (`proxy/` — Cloudflare Worker + PHP) so the Aptabase key never ships in the app; privacy/FAQ/TrustStrip/llms.txt copy rewritten; `UPDATE.json` entry added. **Remaining (maintainer):** deploy the proxy + paste the Aptabase App-Key into the proxy host secret (NOT the repo); point `telemetry.<domain>` DNS; confirm `DEFAULT_PROXY_URL` in `backend/telemetry.py`. |

**When build is greenlit, start at Phase 0** (§9): the `telemetry: True` flag in
`harness_config.py`, `telemetry.emit()` call sites, and `test_telemetry_redaction.py`
— wired but pointed at the transparency preview until Aptabase keys + the privacy-copy
rewrite land. Shipping is user-facing → needs an `UPDATE.json` entry, the copy
rewrite, and the Aptabase processor disclosure, all in the same release.
