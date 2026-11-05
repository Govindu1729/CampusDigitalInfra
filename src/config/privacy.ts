// IITGN Maintenance Request System - Resident Contact Privacy & Technician Access Policy
// Defines configurable institutional rules regarding resident phone disclosure, email primacy, and administrative fallback.

export const PRIVACY_CONFIG = {
  /**
   * System-wide master switch for sharing resident phone numbers with maintenance staff/technicians.
   * If set to false (via process.env.ALLOW_RESIDENT_PHONE_SHARING="false"), phone numbers are
   * NEVER disclosed to technicians, and the system seamlessly falls back to the native way
   * (institutional email and in-app chat only).
   *
   * Default: true (subject to individual ticket toggle).
   */
  ALLOW_RESIDENT_PHONE_SHARING: process.env.ALLOW_RESIDENT_PHONE_SHARING !== "false",

  /**
   * Whether email is the mandatory primary institutional contact for all complaints.
   * Default: true (always true).
   */
  EMAIL_IS_PRIMARY_CONTACT: true,

  /**
   * Whether phone number is optional / non-mandatory during ticket submission.
   * Default: true.
   */
  PHONE_IS_OPTIONAL: true,

  /**
   * Default state of the resident's "Share phone with technician" toggle on new tickets.
   */
  DEFAULT_SHARE_PHONE_WITH_STAFF: true,
};

export interface ContactShareCheckInput {
  requesterPhone?: string | null;
  sharePhoneWithStaff?: boolean | null;
}

/**
 * Determines whether a technician or staff member is authorized to view a resident's phone number
 * and trigger direct telephone calls for this specific maintenance request.
 *
 * Rules:
 * 1. If ALLOW_RESIDENT_PHONE_SHARING is false -> FALSE (Institutional privacy mandate).
 * 2. If requester did not provide a phone number -> FALSE.
 * 3. If requester explicitly turned OFF the sharing toggle on the ticket -> FALSE (Resident privacy choice).
 * 4. Otherwise -> TRUE.
 */
export function canStaffViewResidentPhone(request: ContactShareCheckInput | null | undefined): boolean {
  if (!PRIVACY_CONFIG.ALLOW_RESIDENT_PHONE_SHARING) return false;
  if (!request?.requesterPhone || request.requesterPhone.trim() === "") return false;
  // If sharePhoneWithStaff is explicitly false, respect resident privacy
  if (request.sharePhoneWithStaff === false) return false;
  return true;
}
