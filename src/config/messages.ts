// IITGN Maintenance Request System - User Facing Strings and Messages

export const MESSAGES = {
  appTitle: "IITGN Maintenance Request System",
  appSubtitle: "Institute Works Department — Campus Facility & Maintenance Portal",
  openComplaintFiling: "Submit Maintenance Complaint (Open Access)",
  trackingPrompt: "Track Existing Complaint",
  
  success: {
    requestSubmittedTitle: "Complaint Successfully Registered!",
    requestSubmittedBody: "Your maintenance request has been submitted to the Institute Works Department. Keep your ticket number and secret tracking link handy to monitor progress.",
    statusUpdated: "Status successfully updated.",
    staffAssigned: "Technician assigned successfully.",
    commentAdded: "Follow-up update posted successfully.",
    resolvedFeedback: "Thank you for confirming resolution!",
    reopened: "Complaint reopened and flagged for immediate re-investigation.",
  },

  validation: {
    nameRequired: "Full Name is required.",
    emailInvalid: "Please enter a valid email address.",
    phoneInvalid: "Please enter a valid 10-digit mobile number.",
    subjectRequired: "Subject line is required.",
    subjectMinLength: "Subject must be at least 5 characters.",
    locationRequired: "Location details are required.",
    domainRequired: "Please select the maintenance domain.",
    subDomainRequired: "Please select the specific fault sub-category.",
    availabilityRequired: "Preferred availability time is required.",
    detailsTooLong: "Details exceed maximum allowed characters.",
  },

  roles: {
    level1Admin: "Overall Admin (Level 1)",
    level2Admin: "Department Admin (Level 2)",
    level3Staff: "Department Staff / Technician",
  },
};
