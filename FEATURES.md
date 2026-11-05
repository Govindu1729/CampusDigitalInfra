# FEATURES.md — IITGN Maintenance Request System

Feature backlog for the next version. Nothing here is implemented yet. Each feature has an ID so prompts and issues can reference it.

**Priority legend:** **P0** = needed for the first release · **P1** = soon after · **P2** = nice to have · **Future** = depends on login/SSO

**Global rule:** every number, list, contact and message below is a **config value** (`src/config/constants.ts`, `src/config/*.ts`, `.env`). Defaults shown are suggestions, not hard-coded values.

---

## A. Image upload (the headline request)

### F-01 · Optional image attachments — P0
Users may attach photos of the problem. Images are **optional**; the form works fully without them.
- Max images per request (default **3**), max size per file (default **5 MB** before processing), allowed types (JPEG, PNG, WebP; HEIC converted if feasible).
- Drag-and-drop / camera capture on mobile (`<input type="file" accept="image/*" capture>`), previews with remove button.
- Limits shown in the UI are rendered from the same constants the server enforces.
- **Acceptance:** a request with 0–N allowed images succeeds; N+1, oversized, wrong-type, or corrupted files are rejected with a clear message, on both client and server.

### F-02 · Client-side compression — P0
Before upload, resize (default longest side **1600 px**) and re-encode (WebP/JPEG, quality ~**75**) in the browser. Goal: typical upload under ~300 KB, protecting both the server and users on weak Wi-Fi.
- **Acceptance:** a 6 MB phone photo uploads as a few hundred KB; user sees progress.

### F-03 · Server-side image hardening — P0
Never trust the client.
- Verify the **magic bytes**, not just extension/MIME; reject anything that is not a decodable image.
- Re-encode with `sharp` (resize cap, strip EXIF incl. GPS, normalise to WebP/JPEG). Store only the processed output.
- Random server-generated filenames; store outside the web root or in a bucket; serve through a controlled route with correct `Content-Type` and `Content-Disposition`, `X-Content-Type-Options: nosniff`.
- Decompression-bomb protection (max pixel count, memory/time limits on processing).
- **Acceptance:** a renamed `.exe`/`.svg`/polyglot file is rejected; stored files contain no EXIF.

### F-04 · IP-based upload quotas (no login yet) — P0
Because the system is open and has no user identity, restrict by **client IP**:
- Max images per IP per day (default **6**), max total bytes per IP per day (default **20 MB**), max upload requests per IP per hour.
- Secondary signals to soften shared-IP problems: signed anonymous cookie, and per-email limit.
- Real client IP read only from a configured trusted proxy header (`TRUST_PROXY`, `CLIENT_IP_HEADER`). Spoofed headers must not bypass limits.
- ⚠ **Campus NAT caveat:** a whole hostel may share one public IP. Defaults must be tuned with real traffic; make limits easy to raise; log "limit hit" events to tune them.
- **Acceptance:** the (N+1)th image from the same IP in the window is rejected with HTTP 429 and a `Retry-After` header; limits reset after the window.

### F-05 · Uploads only inside a valid submission flow — P0
No free-standing anonymous upload endpoint that anyone can hammer.
- Option A (recommended): images are sent **with** the submission (multipart) after captcha verification.
- Option B: two-step — a short-lived, single-use, signed **upload token** issued after captcha, valid for one request and N files.
- **Acceptance:** calling the upload endpoint without a valid token/captcha fails; orphaned uploads (no submitted request) are deleted by a cleanup job.

### F-06 · Global upload protections and kill switch — P0
- `UPLOAD_ENABLED=false` disables upload instantly (UI hides the section with a polite note).
- Global daily storage cap (default e.g. **2 GB**) and a global uploads-per-minute ceiling; when hit, uploads are disabled temporarily but **requests without images still work** (graceful degradation).
- **Acceptance:** with the kill switch on, the form submits normally without images; with the cap hit, users see "Photos are temporarily unavailable; you can still submit."

### F-07 · Lightweight image delivery — P1
Users and staff should not be bombarded with heavy images.
- Generate small **thumbnails** (e.g. 320 px) at upload; lists show thumbnails only; full image opens on click (lazy loaded).
- Cache headers on images; optional CDN later.
- **Acceptance:** list pages never load full-size images.

### F-08 · Image retention and cleanup — P1
- Delete images after a configurable retention period (default **180 days** after the request is closed).
- Scheduled cleanup removes orphaned and expired files.
- Admin can delete an image (e.g. inappropriate content), with audit log.

### F-09 · Login-gated uploads — Future
When login exists (see §H): `AUTH_REQUIRED_FOR_UPLOAD=true` allows image upload only for logged-in users; limits switch from per-IP to per-user (and per-IP remains as a backstop). Anonymous users can still submit text-only requests.
- Design now so this is a config switch, not a rewrite: all upload checks go through one `canUpload(client)` function.

---

## B. Abuse and attack protection (whole application)

### F-10 · Rate limiting on every public endpoint — P0
- Request submissions: default **10 per IP per window** (e.g. per hour). Configurable count and window.
- Global per-IP request ceiling (e.g. **60 / minute**) on all routes; stricter on write endpoints.
- Follow-up posts, tracking lookups, and dropdown APIs each have their own limits.
- Responses use HTTP **429** with `Retry-After`; messages are user-friendly.
- Driver interface: in-memory (single instance) and Redis (multi-instance), chosen by env.
- **Acceptance:** automated test hammers each endpoint and gets 429 after the configured threshold.

### F-11 · Server-verified captcha — P0
Replace/upgrade the image captcha: Cloudflare Turnstile or hCaptcha (privacy-friendly, mobile-friendly), verified **on the server** per submission. Keep the provider behind an interface (`CAPTCHA_PROVIDER`). Optional: show captcha only after suspicious activity (adaptive).
- **Acceptance:** requests without a valid captcha token are rejected server-side.

### F-12 · Server-side validation and sanitisation — P0
- One **Zod schema per category**, shared by client and server; server is the source of truth.
- Strict email validation (optionally restrict to `@iitgn.ac.in` via config), phone validation, length limits on every field (details field default 150 → configurable, consider 500).
- Escape output; never inject server-supplied HTML into the page (the legacy `.html(response)` pattern goes away). Use React rendering and a structured JSON response `{ id, trackingToken, message }`.
- Parameterised queries only (via ORM).

### F-13 · Spam and duplicate defence — P0
- **Honeypot** field and minimum-fill-time check.
- **Duplicate detection:** same email/phone + same location + same sub-domain within a configurable window (default **30 min**) is blocked or merged, with a message pointing to the existing request.
- **Max open requests per email** (default **5**).
- Optional keyword/URL filter on free text.

### F-14 · Security headers and platform hardening — P0
- CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/frame-ancestors, strict CORS (same-origin only).
- Request body size limits per route; reject oversized multipart early.
- CSRF protection for state-changing routes; secure, HttpOnly, SameSite cookies.
- Dependency auditing in CI; no old jQuery.

### F-15 · IP ban list and abuse log — P1
- Config/DB-driven deny list and temporary auto-bans for repeated limit violations.
- Structured logs (IP hash, route, outcome) for tuning limits and investigations; avoid storing raw personal data longer than needed.

### F-16 · Load protection and graceful degradation — P1
- Cap concurrent image-processing jobs (queue); return "try again shortly" rather than crashing.
- Health endpoint, timeouts, and a maintenance-mode flag.
- **Acceptance:** under a load test, text-only submissions stay fast while image processing is throttled.

---

## C. Two-way communication and tracking

### F-20 · Request tracking page — P0
After submission the user gets a **request ID** and a **secret tracking link** (emailed and shown on screen). The link opens a page with current status and a timeline. No login needed — the secret token acts as the credential. Also a "Track my request" box on the home page (ID + email or token).
- Statuses (configurable): `Submitted → Acknowledged → Assigned → In progress → Resolved → Closed` plus `Reopened`, `Rejected/Invalid`.
- **Acceptance:** guessing IDs does not reveal other people's requests (token required, rate limited).

### F-21 · Requester follow-ups (comments) — P0
From the tracking page the requester can add a message ("still not fixed", "I'll be away till 5 pm") and optionally one image (same limits as F-01–F-06). Staff replies appear in the same thread. Email notifications go both ways.
- Rate limited (default **20 messages per hour per IP**, **max messages per request** configurable).

### F-22 · "Is it solved?" confirmation and Reopen — P0
When staff mark a request *Resolved*, the requester gets an email/link: **"Yes, fixed"** or **"No, not fixed"** (reason + optional photo). *No* → status `Reopened` and staff are alerted; no response within N days (default **5**) → auto-close.
- **Acceptance:** reopening is possible only within a configurable window (default **14 days**) and notes the reason.

### F-23 · Satisfaction rating — P1
After closure, a 1–5 rating and optional comment. Aggregated in admin reports (per category, per contractor/staff).

### F-24 · Email (and optional SMS/WhatsApp) notifications — P0 (email) / P2 (SMS, WhatsApp)
Templates for: submitted, acknowledged, assigned, status change, staff reply, resolved-confirm, reopened, auto-closed. Templates and sender live in config. Unsubscribe not needed for transactional mail, but throttle to avoid mail storms.

### F-25 · Request status without email — P2
Allow a phone-only requester to check status with ID + phone last 4 digits (rate limited), for cases where email is not given.

---

## D. Escalation and accountability

### F-30 · Automatic escalation — P1
Today the *Complaint Redressal* box tells users to email AEE → EE → SE manually. Automate it:
- SLA timers per category/priority (config), e.g. unacknowledged after **24 h** → notify AEE; unresolved after **72 h** → EE; after **7 days** → SE.
- "Escalate" button on the tracking page (enabled only after the SLA time passes), which emails the next level with the full request context.
- Escalation contacts and timings live in `src/config/escalation.ts` — not in HTML.

### F-31 · Priority and emergency flag — P1
Requester can mark "urgent/safety issue" (e.g. sparking, flooding, no water). Urgent requests show phone numbers for immediate contact (config) and notify staff immediately. Abuse of the flag is limited (rate limit + staff can downgrade).

### F-32 · SLA dashboard — P1
Breach counts, average resolution time, reopen rate, per category and building — to give the Works Department evidence for improvement.

---

## E. Admin and staff tools

### F-40 · Admin dashboard — P1
List/filter/search requests (status, category, building, date), view thumbnails, assign to staff/contractor, change status, reply, merge duplicates, bulk actions, CSV export. Requires login (see §H). Must coexist with or replace the legacy admin; plan the migration.

### F-41 · Staff mobile view — P1
Technicians see "my assigned jobs" on their phone, mark in-progress/resolved, and upload **after** photos.

### F-42 · Audit log — P1
Every status change, assignment, deletion, and config change is logged with who/when.

### F-43 · Config-driven categories — P1
Categories, domains → sub-domains, hostels/blocks, apartment numbers and extra fields are editable (first in config files, later through an admin UI) so adding "Sports Complex court lights" needs no code change.

---

## F. User experience

### F-50 · One config-driven form for all categories — P0
Replace the ≥8 copy-pasted pages with a single `/new/[category]` page driven by `categories.ts`. Fixes the legacy inconsistencies (field names, missing hostel value, missing corridor, JEET typos).

### F-51 · Mobile-first, accessible UI (Tailwind) — P0
Responsive layout (no tables for layout, no fixed pixel widths), large tap targets, labels linked to inputs, keyboard and screen-reader friendly, good contrast, inline field errors instead of `alert()` popups.

### F-52 · Smarter location picking — P1
- Searchable dropdown/typeahead for the ~400 apartments instead of a huge `<select>`.
- Remember last-used name/email/phone/location in the browser (local only) to speed up repeat requests.
- **QR codes on rooms/buildings/equipment** that open the form with location pre-filled — a common pattern in facility-management systems.

### F-53 · Draft saving and resilience on weak networks — P1
Autosave the in-progress form locally; retry failed submissions; show upload progress; offline-tolerant PWA shell (P2).

### F-54 · "Already reported?" nudge — P2
Before submitting, show open requests for the same building/sub-domain so people can "+1 / me too" instead of creating duplicates (reduces load and helps staff spot widespread faults).

### F-55 · Multilingual UI — P2
English plus optionally Hindi/Gujarati, all strings in `messages.ts`.

---

## G. Reliability, operations, privacy

### F-60 · Observability — P1
Structured logging, error tracking, uptime check, and a small metrics page (requests/day, upload volume, 429 counts).

### F-61 · Backups and data retention — P1
Scheduled DB and image backups; documented restore; retention policy for personal data and images (confirm with Institute policy and applicable Indian data-protection requirements).

### F-62 · Privacy by default — P1
Collect only needed personal data; strip EXIF/GPS; hash IPs in logs where possible; privacy notice on the form; staff see contact data only on a need-to-know basis.

### F-63 · Testing and CI — P0
Unit tests for validation and limits; integration tests for endpoints (including 429 paths, oversized/invalid uploads); Playwright smoke test of the full submit-with-images flow; CI blocks merges on failure.

---

## H. Login (planned, not now)

### F-70 · Optional login / SSO — Future
- Institute Google Workspace (`@iitgn.ac.in`) SSO or OTP-to-email login.
- Benefits: "My requests" page, image upload only for logged-in users (F-09), per-user (not per-IP) quotas, staff and admin roles.
- **Anonymous (guest) submission stays available** for text-only requests unless the Institute decides otherwise (`GUEST_SUBMISSION_ENABLED`).
- Roles: `requester`, `staff`, `supervisor`, `admin`.

### F-71 · Lightweight email verification (bridge feature) — P1
Before login exists, verify the requester's email with a one-time link/OTP the first time they use an address; verified emails get higher limits (and could be allowed more images). A cheap way to get identity without full accounts.

---

## I. Ideas inspired by common campus/facility systems

These are patterns typical of work-order and helpdesk tools (university facilities portals, ticketing systems such as helpdesk/ITSM products). They are **suggestions to evaluate**, not a claim about any specific institution's system:

- Public **status page / "known issues"** banner ("Water supply off in Block C until 4 pm") to cut duplicate complaints.
- **Ticket categories with SLAs** and automatic assignment rules (by building and trade).
- **Technician mobile app/PWA** with before/after photos.
- **Preventive maintenance schedules** (e.g. quarterly AC servicing) generated as recurring work orders.
- **Asset tags/QR codes** tied to equipment history.
- **Weekly digest** to supervisors of open, overdue and reopened tickets.
- **Public transparency report** (monthly resolution times) — builds trust with residents.

---

## Suggested release plan

| Release | Contents |
|---|---|
| **R1 (MVP)** | F-50, F-51, F-12, F-11, F-10, F-13, F-14, F-01–F-06, F-20, F-21, F-22, F-24 (email), F-63 |
| **R2** | F-07, F-08, F-15, F-16, F-23, F-30, F-31, F-40–F-43, F-52, F-60–F-62, F-71 |
| **R3** | F-32, F-53–F-55, F-25, SMS/WhatsApp, preventive maintenance, QR codes at scale |
| **Later** | F-70 / F-09 login-gated uploads, per-user quotas, roles |
