# PROMPTS.md — Instructions for the AI Code Editor

How to use: paste **Prompt 0** at the start of every session (or keep it as a project rule file such as `.cursorrules` / `CLAUDE.md` / `AGENTS.md`). Then run Prompts 1 → 12 **one at a time**, reviewing and testing between each. Do not combine prompts.

Before starting, read `README.md` (context and legacy analysis), `FEATURES.md` (feature IDs), `.env.example`, and the `legacy/` snapshots.

---

## Prompt 0 — Project context and standing rules (always apply)

```
You are helping modernise the IIT Gandhinagar Maintenance Request System (MRS).
Read README.md, FEATURES.md, .env.example and the files in legacy/ before writing code.

CONTEXT
- The current system is an open (no login) PHP/jQuery site where anyone on campus files a maintenance complaint, solves an image captcha and gets a complaint number by email.
- We are rebuilding it with: Next.js (App Router) + TypeScript + Node runtime + Tailwind CSS, Zod for validation, Prisma for DB access, sharp for images.
- There are NO user identities. Abuse control is IP-based (plus an anonymous signed cookie and per-email limits). Login is a FUTURE feature, but the design must make it a config switch, not a rewrite.

STANDING RULES
1. NO MAGIC NUMBERS OR HARD-CODED LISTS. Every limit, toggle, timeout, contact email, category list, hostel/apartment list and user-facing message must live in:
   - src/config/constants.ts  (reads env vars via a Zod schema, with defaults, exports ONE typed `config` object; fails fast on invalid env)
   - src/config/categories.ts, src/config/escalation.ts, src/config/messages.ts
   - .env / .env.example (document every key with a comment and default)
   Components and route handlers import from config; they never contain literals like 3, 5 * 1024 * 1024, 10, "aee1.civil@..." etc.
2. UI and server must share the same constants and the same Zod schemas. A limit displayed to the user must be the exact limit the server enforces.
3. The server is the source of truth: re-validate everything server-side. Never trust client input, headers, file extensions or MIME types.
4. Never inject server-provided HTML into the page. API responses are structured JSON; React renders them.
5. Images are OPTIONAL. If image features fail, are disabled, or hit a cap, text-only submissions must still work.
6. Rate limiting, captcha verification and size limits apply to every public write endpoint. Return HTTP 429 with a Retry-After header when limited.
7. Get the client IP only through lib/ip.ts, which honours TRUST_PROXY and CLIENT_IP_HEADER. Never read X-Forwarded-For directly elsewhere.
8. Mobile-first, accessible Tailwind UI: no table layouts, no alert() popups, inline field errors, labels tied to inputs, visible focus, large tap targets.
9. Write tests for every limit and abuse path you add (Vitest for unit/integration; Playwright for the main flow).
10. Keep modules small and behind interfaces where we may swap implementations (rate-limit driver, storage driver, captcha provider, mailer).
11. Do not modify anything under legacy/. It is read-only reference.
12. Small commits, one concern each. After each task, list what you changed, how to run the tests, and any assumptions or open questions. If something in the legacy behaviour is unclear (e.g. the DB schema or server-side business rules), STOP and ask instead of guessing.
```

---

## Prompt 1 — Scaffold, config layer and tooling

```
Scaffold the project (Next.js App Router, TypeScript strict, Tailwind CSS, ESLint, Prettier, Vitest, Playwright, Prisma).

Create the configuration layer FIRST:
- src/config/constants.ts: Zod-validated env parsing → exported `config`. Group keys: upload, rateLimit, captcha, abuse, tracking, escalation, mail, app. Coerce numbers/booleans/lists (comma-separated). Provide defaults from .env.example. Throw a clear error at startup if invalid.
- src/config/messages.ts: all user-facing strings (errors, limit messages with {placeholders}, email subjects).
- src/config/categories.ts: typed definitions (see Prompt 2).
- src/config/escalation.ts: levels, contacts, SLA hours — values from env/config, not hard-coded in components.
- .env.example kept in sync with constants.ts (add a test that fails if a key in constants.ts is missing from .env.example).

Acceptance: `npm run dev`, `npm run lint`, `npm run test` all pass; importing `config` anywhere is typed; changing a value in .env changes behaviour with no code edit.
```

---

## Prompt 2 — Config-driven categories and the single request form (F-50, F-51, F-12)

```
Replace the legacy copy-pasted pages (housing, academic, hostel, jeet_hostel, infrastructure, guesthouse, centralarcade, sportscomplex, researchpark) with ONE route: /new/[category].

1. In src/config/categories.ts define, per category: slug, label, icon, which extra fields it needs (e.g. hostel dropdown, block dropdown, apartment picker, corridor, free-text location), allowed domains, and the domain → sub-domain-1 → sub-domain-2 tree. Use the legacy files for the exact fields, labels and domain lists:
   - Housing: domains Civil, Electrical; apartment list (export the full ~400-option list from the live page source — ask me for it if missing); optional corridor.
   - Academic: Civil, Electrical, Air-Conditioning, Water-Cooler; free-text building/room.
   - Hostel: hostels Aibaan … Lekhaag + Dining; same four domains; hide the sub-domains "Central AC", "VRV type AC", "Split AC", "Water Fountain" (legacy behaviour).
   - JEET Hostel: Blocks A–D (fix the legacy "JEER" typo).
   - For the other categories, ask me for their legacy sources, or create a clearly marked TODO entry.
2. Fix legacy bugs by design: the hostel/block value and the housing corridor MUST be part of the submitted data; use ONE field name for availability.
3. Build the Zod schema per category from the same config (shared client/server). Fields: name, email, mobile (10 digits), subject, location fields, availability, domain, subDomain1, subDomain2, details (max length from config), captcha token, honeypot. Email domain restriction controlled by config (ALLOWED_EMAIL_DOMAINS, empty = any).
4. Build the form with React Hook Form + Zod resolver, cascading selects fed by GET /api/options (which reads from the config tree; later it may read the DB), searchable apartment picker, character counter, inline errors, loading/disabled states.
5. POST /api/requests validates server-side and returns JSON { id, trackingToken, message } — never HTML. For now store in the DB via Prisma (design the schema with `Request`, `Attachment`, `FollowUp`, `StatusEvent` tables; ask me about the existing DB before creating migrations).
6. Landing page: category tiles generated from config + the Complaint Redressal info (data from src/config/escalation.ts).

Acceptance: every category renders from config; adding a new category needs no new component; submitting with bad data shows field errors from the server too; all text comes from messages.ts.
```

---

## Prompt 3 — IP detection, rate limiting and abuse controls (F-10, F-13, F-14, F-15)

```
Implement protection for the whole app. Everything tunable via config (see .env.example): RATE_LIMIT_SUBMIT_MAX, RATE_LIMIT_SUBMIT_WINDOW_MINUTES, RATE_LIMIT_GLOBAL_PER_MINUTE, RATE_LIMIT_FOLLOWUP_MAX, MAX_OPEN_REQUESTS_PER_EMAIL, DUPLICATE_WINDOW_MINUTES, TRUST_PROXY, CLIENT_IP_HEADER, RATE_LIMIT_DRIVER.

1. lib/ip.ts: getClientIp(request). If TRUST_PROXY=false use the socket address. If true read ONLY CLIENT_IP_HEADER, and take the right-most untrusted hop (document the logic). Normalise IPv6. Provide a hashed form for logs.
2. lib/rate-limit/: a `RateLimiter` interface (fixed or sliding window, `consume(key, limit, windowSec)` → {allowed, remaining, retryAfterSec}) with two drivers: in-memory (Map with periodic cleanup) and Redis. Driver chosen by RATE_LIMIT_DRIVER.
3. Next.js middleware + a helper `withRateLimit(policyName)` for route handlers. Policies are defined in config: global, submit, followup, track-lookup, options, upload. Return 429 with Retry-After and a friendly JSON message from messages.ts.
4. Abuse rules in POST /api/requests: honeypot field must be empty; minimum fill time (config); max open requests per email; duplicate detection (same email/phone + location + sub-domain within DUPLICATE_WINDOW_MINUTES → reject with a pointer to the existing request).
5. Anonymous signed cookie (HMAC, secret from env) as a secondary identifier; limits can be keyed by IP, cookie and email — explain in code comments how they combine.
6. Security headers (CSP, HSTS, nosniff, referrer-policy, frame-ancestors), same-origin CORS only, body-size limits per route, CSRF protection on state-changing routes.
7. IP deny list (config/DB) and optional temporary auto-ban after repeated 429s (thresholds in config).
8. Structured logger: log route, outcome, hashed IP, limit hit. No raw personal data.

Tests: for each policy, a test proves request #(limit+1) in the window gets 429 and that the window resets; spoofed X-Forwarded-For does not bypass limits when TRUST_PROXY=false; honeypot and duplicate tests.
Remember the campus-NAT caveat: defaults must be generous, and every number must be in config.
```

---

## Prompt 4 — Captcha (F-11)

```
Replace the legacy image captcha (demo_captcha.php) with a provider-agnostic captcha.
- lib/captcha.ts exposes `verifyCaptcha(token, ip)`; implementations for Cloudflare Turnstile and hCaptcha, plus a "disabled" dev implementation. Provider and keys come from env (CAPTCHA_PROVIDER, CAPTCHA_SITE_KEY, CAPTCHA_SECRET).
- Client widget component loads the provider script lazily and passes the token with the submission.
- Verification happens ONLY on the server in POST /api/requests (and later in follow-up/upload token endpoints). Fail closed if the provider is unreachable, with a clear message; keep a config flag to fail open ONLY in development.
Acceptance: requests with missing/invalid tokens are rejected server-side; tests mock the provider.
```

---

## Prompt 5 — Image upload: config, client compression and UI (F-01, F-02)

```
Add OPTIONAL image attachments to the request form.

Config (all in constants.ts / .env — no literals in components): UPLOAD_ENABLED, UPLOAD_MAX_IMAGES_PER_REQUEST, UPLOAD_MAX_FILE_SIZE_MB, UPLOAD_ALLOWED_MIME, UPLOAD_CLIENT_MAX_DIMENSION_PX, UPLOAD_CLIENT_QUALITY.

UI:
- An "Add photos (optional)" section: file picker + mobile camera capture + drag and drop, thumbnails with remove buttons, per-file and total validation messages, upload progress.
- Show the limits to the user using the same config values ("Up to {max} photos, {size} MB each").
- Compress and resize in the browser before upload (canvas / browser-image-compression style) to WebP or JPEG; keep the form usable if compression fails (fall back with a size check).
- If UPLOAD_ENABLED=false the section is hidden or shows a short note.
- The form must submit successfully with zero images.

Acceptance: a 6 MB phone photo is reduced to a few hundred KB client-side; adding more than the allowed count or a non-image is blocked with a clear message; no hard-coded numbers anywhere.
```

---

## Prompt 6 — Image upload: server pipeline, quotas and kill switch (F-03, F-04, F-05, F-06)

```
Implement the secure server side of image upload. Images are accepted ONLY as part of a valid submission (multipart with the request, after captcha verification) — there must be no open anonymous upload endpoint. (If multipart is not feasible, implement a single-use signed upload token issued after captcha, valid for one request and N files, with short expiry from config.)

Config keys: UPLOAD_ENABLED, UPLOAD_MAX_IMAGES_PER_REQUEST, UPLOAD_MAX_FILE_SIZE_MB, UPLOAD_MAX_IMAGES_PER_IP_PER_DAY, UPLOAD_MAX_MB_PER_IP_PER_DAY, UPLOAD_MAX_PIXELS, UPLOAD_SERVER_MAX_DIMENSION_PX, UPLOAD_OUTPUT_FORMAT, UPLOAD_OUTPUT_QUALITY, UPLOAD_THUMB_DIMENSION_PX, UPLOAD_GLOBAL_DAILY_CAP_MB, UPLOAD_GLOBAL_PER_MINUTE, UPLOAD_MAX_CONCURRENT_PROCESSING, STORAGE_DRIVER, STORAGE_PATH, AUTH_REQUIRED_FOR_UPLOAD.

Implement:
1. `canUpload(client, requestedFiles)` — the ONE function all upload checks go through. It checks: kill switch, global daily cap and per-minute ceiling, per-request count/size, per-IP daily count and bytes (via the rate-limit/quota store), and `AUTH_REQUIRED_FOR_UPLOAD` (when true and the client is not logged in → deny; there is no login yet, so default false). Return a typed result with a user-facing reason from messages.ts.
2. Validation in lib/images.ts: sniff magic bytes (do not trust extension or MIME), allow only configured types, enforce max pixels (decompression-bomb guard), reject animated/odd formats unless configured.
3. Processing with sharp: auto-rotate, resize to the configured max dimension, strip ALL metadata (EXIF/GPS), re-encode to the configured format/quality, generate a thumbnail. Store only processed output under random names. Limit concurrent processing (queue) and return a friendly "try again shortly" under load.
4. Storage interface with `local` (outside web root) and `s3` drivers. Images are served through a controlled route with correct Content-Type, nosniff and cache headers — never from a user-controlled path.
5. Graceful degradation: if image processing/storage fails or caps are hit, the text part of the request must still be saved and the user told which images were not saved (or, if you prefer, reject the submission with a clear retry message — document the choice).
6. Record every accepted image in `Attachment` (request id, hashed IP, bytes, mime, created) so quotas are computed from data, plus a cleanup job for orphans.

Tests: rejects fake image (renamed .exe/.svg/polyglot), oversized, too many files, over-pixel images; stored output has no EXIF; the (N+1)th image from one IP in the window → 429 with Retry-After; kill switch on → text-only submission still succeeds; global cap hit → degrades gracefully.
```

---

## Prompt 7 — Tracking page and follow-up conversation (F-20, F-21, F-22, F-24)

```
Add two-way communication without requiring login.

1. On submit, generate a request ID (human-friendly) and a long random tracking token. Store only a HASH of the token. Show the ID and a tracking link on the confirmation screen and email them (lib/mail.ts with templates in config/messages.ts; SMTP settings from env).
2. /track: lookup by ID + token (from the link) or ID + email (sends a fresh link to that email — never reveal whether an ID exists). Rate limited via the `track-lookup` policy; constant-time token compare.
3. /track/[id]?token=…: shows status, timeline (StatusEvent), and the conversation thread (FollowUp). Statuses come from config: Submitted, Acknowledged, Assigned, In progress, Resolved, Closed, Reopened, Rejected.
4. Requester can post a follow-up (text up to a configured length, optionally ONE image that goes through the same canUpload() pipeline). Limits: FOLLOWUP_RATE_LIMIT, MAX_FOLLOWUPS_PER_REQUEST (config). Notify staff by email.
5. When status = Resolved, email the requester “Is it fixed?” with two signed links: “Yes, fixed” and “Not fixed” (reason + optional photo). “Not fixed” → Reopened (only within REOPEN_WINDOW_DAYS), alert staff. No reply within AUTO_CLOSE_DAYS → auto-close (scheduled job).
6. Never render user text as HTML; escape everything.

Acceptance: guessing IDs reveals nothing; reopen outside the window is refused with a clear message; tests cover token handling, rate limits, and the resolved→reopen/auto-close flow.
```

---

## Prompt 8 — Escalation and redressal (F-30, F-31)

```
Automate the “Complaint Redressal” ladder currently shown as a static modal (Level 1 AEE Civil/Electrical → Level 2 EE → Level 3 SE; see legacy/index.html for the contacts).

- Move contacts, levels and SLA hours to src/config/escalation.ts / env (ESCALATION_L1_HOURS, ESCALATION_L2_HOURS, ESCALATION_L3_HOURS, plus contact emails per trade). No emails in components.
- A scheduled job escalates unacknowledged/unresolved requests when SLA hours pass, emails the next level with a summary and tracking context, and records a StatusEvent.
- On the tracking page, an “Escalate” button becomes available only after the configured time; it is rate limited.
- Optional “Urgent / safety issue” flag on the form: shows configured emergency phone numbers and notifies staff immediately; limited by a rate-limit policy; staff can downgrade.
- Keep the redressal modal on the landing page, now data-driven.

Acceptance: time-travel tests prove escalation fires at the configured hours; changing hours in env changes behaviour with no code edit.
```

---

## Prompt 9 — Minimal admin/staff area (F-40, F-41, F-42) *(R2; requires an auth decision)*

```
Before coding, ask me how admins authenticate (Institute SSO, email OTP, or keep the legacy admin for now).
Then build /admin behind that auth, with roles (admin, supervisor, staff):
- Filterable, searchable request list (status, category, building, date) with thumbnails only (lazy-loaded full image on click).
- Request detail: assign, change status (writes StatusEvent + audit log), reply to requester, delete an image (audit-logged), merge duplicates, CSV export.
- Staff “my jobs” mobile view with before/after photos (same upload pipeline and limits).
- All page sizes, statuses and roles come from config.
```

---

## Prompt 10 — Login-ready design (F-09, F-70, F-71)

```
Do NOT build full login yet. Prepare the code so login is a configuration switch:
- Introduce a `getClient(request)` abstraction returning { type: 'anonymous' | 'user', userId?, ip, emailVerified? }.
- All limit/quotas code uses `getClient`; quotas key on userId when present, with IP as a backstop.
- `AUTH_REQUIRED_FOR_UPLOAD` and `GUEST_SUBMISSION_ENABLED` already exist in config; make them work end to end with a stubbed auth provider, plus tests with a fake logged-in user.
- Implement the lightweight email-verification bridge (F-71): one-time link/OTP; verified emails receive higher limits from config (VERIFIED_EMAIL_LIMIT_MULTIPLIER).
Document in README how to plug in Google Workspace SSO later.
```

---

## Prompt 11 — Reliability, privacy and operations (F-08, F-16, F-60, F-61, F-62)

```
- Scheduled jobs (cron/queue): delete expired images (UPLOAD_RETENTION_DAYS after closure), orphan cleanup, auto-close, escalation. Make the schedule configurable.
- Load protection: queue for image processing, timeouts, /api/health, MAINTENANCE_MODE flag that shows a polite page but keeps already-submitted tracking pages working.
- Logging/metrics: structured logs, an error tracker hook, and a small internal metrics view (requests/day, upload bytes, 429 counts by policy).
- Privacy: hash IPs in logs, strip EXIF (already done), privacy notice text from messages.ts, minimal data collection, documented retention.
- Backups: documented DB and image backup/restore procedure in docs/OPERATIONS.md.
```

---

## Prompt 12 — Tests, CI and hardening review

```
- Add a GitHub Actions (or equivalent) pipeline: lint, typecheck, unit/integration tests, Playwright smoke test, `npm audit`.
- Playwright: full flow “fill form → attach 2 images → captcha (test mode) → get tracking link → post follow-up → mark resolved → reopen”.
- Load test script (k6 or autocannon) proving: text-only submissions stay fast while image processing is throttled, and 429s appear at the configured limits.
- Review pass: grep the codebase for numeric literals, hard-coded emails/lists, `dangerouslySetInnerHTML`, direct reads of X-Forwarded-For, and routes missing a rate-limit policy; fix or justify each.
- Update README.md and .env.example to match the final implementation.
```

---

## Reusable follow-up prompts

**Config audit**
```
Scan the repo for magic numbers, hard-coded strings visible to users, and hard-coded emails/lists. Move each into src/config/* or .env, update .env.example, and add a test that fails if new literals reappear in the checked folders.
```

**Abuse test pass**
```
Write an abuse-test suite that tries: 50 rapid submissions from one IP, a spoofed X-Forwarded-For, a renamed executable as an image, a 40-megapixel PNG, 20 follow-ups in a minute, and token guessing on /track. Show which are blocked and by which policy.
```

**Explain before change**
```
Before changing code for this task, summarise your plan, list the files you will touch, and list any assumption about the legacy backend. Wait for my confirmation if any assumption could affect the database or emails.
```
