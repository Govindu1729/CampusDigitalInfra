# Resident Contact Information & Privacy Architecture Specification

## 1. Overview & Policy Rationale
In institutional maintenance management, resident privacy is paramount. Previously, the technician console displayed an unconditioned `Call (XXXX)` button exposing the resident's phone number without explicit context, consent, or alternative communication channels.

This specification establishes a **Privacy-First Institutional Contact Architecture**:
1. **Email Primacy**: Institutional email (`@iitgn.ac.in`) is the primary, mandatory communication channel.
2. **Optional Phone**: Resident phone number is strictly optional / non-mandatory during ticket submission and in user profiles.
3. **Resident Sharing Consent Toggle**: On every ticket, residents have an active toggle (`sharePhoneWithStaff`) allowing them to decide whether their phone number is visible to field technicians.
4. **Technician Contact Hierarchy**:
   - **Primary Action 1 (Default)**: Institutional Email (`mailto:requesterEmail`)
   - **Primary Action 2**: In-App Live Chat (`/chat/[ticketNumber]`)
   - **Conditional Action 3**: Telephone Call (`tel:requesterPhone`) — **Only shown if phone exists AND resident toggle is ON**.
   - If toggle is OFF or phone missing: A clear `🔒 Phone kept private by resident` indicator is displayed.
5. **Resident Profile Management**: Logged-in residents can manage their phone number and default contact sharing preference from `/profile`.

---

## 2. Fast Administrative Revert ("Nav Back to Native Way")
If the Institute Administration, Dean of Student Affairs, or Works Committee determines that resident phone numbers must **never** be disclosed to field staff for data protection / privacy reasons, the entire platform can be instantly reverted to the native mode without altering database schemas or rewriting UI components:

### Method A: Environment Variable (Recommended for zero-downtime)
Set the environment variable in `.env`:
```env
ALLOW_RESIDENT_PHONE_SHARING=false
```
Then restart the Next.js process.

### Method B: Configuration Toggle in Code
In [`src/config/privacy.ts`](file:///Users/aai/Desktop/iitgn-maintenance-docs/src/config/privacy.ts):
```typescript
export const PRIVACY_CONFIG = {
  ALLOW_RESIDENT_PHONE_SHARING: false, // Set to false to disable all phone sharing
  ...
};
```

### Result of Reverting:
- Field technicians will **only** see `Email Resident` and `Open Chat`.
- No phone numbers will be returned in staff API payloads or rendered in technician dashboards.
- Existing phone numbers in the database will remain intact for administrative auditing but remain completely hidden from field technicians.

---

## 3. Database Schema Changes
- **`User` table**:
  - `phone`: `String?` (Optional)
  - `defaultSharePhone`: `Boolean @default(true)` (User-level preference)
- **`MaintenanceRequest` table**:
  - `requesterPhone`: `String?` (Optional)
  - `sharePhoneWithStaff`: `Boolean @default(true)` (Ticket-level toggle)
- **`ArchivedRequest` table**:
  - `requesterPhone`: `String?` (Optional)
  - `sharePhoneWithStaff`: `Boolean @default(true)`

---

## 4. Key Endpoints & Components
- **API `GET /api/requests/[id]`**: Applies `canStaffViewResidentPhone()`. Masks phone if unauthorized.
- **API `PATCH /api/requests/[id]`**: Allows resident to update `sharePhoneWithStaff` in real time.
- **API `/api/user/profile`**: Allows residents and staff to view/update phone and sharing preferences.
- **Profile UI [`/profile`](file:///Users/aai/Desktop/iitgn-maintenance-docs/src/app/profile/page.tsx)**: Dedicated profile dashboard.
- **Ticket Tracking [`/track/[ticketNumber]`](file:///Users/aai/Desktop/iitgn-maintenance-docs/src/app/track/%5BticketNumber%5D/page.tsx)**: Multi-channel contact bar with privacy badges.
