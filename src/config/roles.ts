// IITGN Maintenance Request System - RBAC and Role Definitions
// Extensible and modular schema configuration

export const ROLE_CODES = {
  OVERALL_ADMIN: "OVERALL_ADMIN", // Level 1 Admin (Institute Works Super Admin)
  DEPT_ADMIN: "DEPT_ADMIN",       // Level 2 Admin (Department Head / AEE / Sub-Admin)
  DEPT_STAFF: "DEPT_STAFF",       // Level 3 (Field Technician / Staff)
  PUBLIC: "PUBLIC",               // Open access for students/faculty/residents
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export interface RoleDefinition {
  code: RoleCode;
  name: string;
  level: number; // 1 = Highest (Overall Admin), 2 = Sub-Admin (Dept Admin), 3 = Staff
  description: string;
  isSystem: boolean;
  defaultPermissions: string[];
}

export const PERMISSION_CODES = {
  // Complaint Actions
  COMPLAINT_CREATE: "COMPLAINT_CREATE",
  COMPLAINT_VIEW_OWN: "COMPLAINT_VIEW_OWN",
  COMPLAINT_VIEW_DEPT: "COMPLAINT_VIEW_DEPT",
  COMPLAINT_VIEW_ALL: "COMPLAINT_VIEW_ALL",
  COMPLAINT_ASSIGN: "COMPLAINT_ASSIGN",
  COMPLAINT_UPDATE_STATUS: "COMPLAINT_UPDATE_STATUS",
  COMPLAINT_RESOLVE: "COMPLAINT_RESOLVE",
  COMPLAINT_REOPEN: "COMPLAINT_REOPEN",
  COMPLAINT_ESCALATE: "COMPLAINT_ESCALATE",
  COMPLAINT_ADD_INTERNAL_NOTE: "COMPLAINT_ADD_INTERNAL_NOTE",
  COMPLAINT_DELETE: "COMPLAINT_DELETE",

  // Department Management
  DEPT_MANAGE: "DEPT_MANAGE",
  DEPT_VIEW: "DEPT_VIEW",

  // User & Role Access Management
  USER_MANAGE: "USER_MANAGE",
  ROLE_MANAGE: "ROLE_MANAGE",

  // Analytics & Logs
  ANALYTICS_ALL: "ANALYTICS_ALL",
  ANALYTICS_DEPT: "ANALYTICS_DEPT",
  AUDIT_VIEW: "AUDIT_VIEW",

  // System Configurations
  SYSTEM_CONFIG: "SYSTEM_CONFIG",
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export const SYSTEM_ROLES: Record<RoleCode, RoleDefinition> = {
  [ROLE_CODES.OVERALL_ADMIN]: {
    code: ROLE_CODES.OVERALL_ADMIN,
    name: "Overall Admin (Level 1)",
    level: 1,
    description: "Full Institute-wide administrator with access across all departments, user management, role management, and system configuration.",
    isSystem: true,
    defaultPermissions: Object.values(PERMISSION_CODES),
  },
  [ROLE_CODES.DEPT_ADMIN]: {
    code: ROLE_CODES.DEPT_ADMIN,
    name: "Department Admin (Level 2)",
    level: 2,
    description: "Sub-Admin in charge of a specific department (e.g. AEE Electrical, AEE Civil). Can assign technicians, update tickets, and view department metrics.",
    isSystem: true,
    defaultPermissions: [
      PERMISSION_CODES.COMPLAINT_VIEW_DEPT,
      PERMISSION_CODES.COMPLAINT_ASSIGN,
      PERMISSION_CODES.COMPLAINT_UPDATE_STATUS,
      PERMISSION_CODES.COMPLAINT_RESOLVE,
      PERMISSION_CODES.COMPLAINT_REOPEN,
      PERMISSION_CODES.COMPLAINT_ADD_INTERNAL_NOTE,
      PERMISSION_CODES.DEPT_VIEW,
      PERMISSION_CODES.ANALYTICS_DEPT,
      PERMISSION_CODES.AUDIT_VIEW,
    ],
  },
  [ROLE_CODES.DEPT_STAFF]: {
    code: ROLE_CODES.DEPT_STAFF,
    name: "Department Technician / Staff",
    level: 3,
    description: "Field technician or service staff handling assigned work orders for their department.",
    isSystem: true,
    defaultPermissions: [
      PERMISSION_CODES.COMPLAINT_VIEW_DEPT,
      PERMISSION_CODES.COMPLAINT_UPDATE_STATUS,
      PERMISSION_CODES.COMPLAINT_RESOLVE,
      PERMISSION_CODES.COMPLAINT_ADD_INTERNAL_NOTE,
    ],
  },
  [ROLE_CODES.PUBLIC]: {
    code: ROLE_CODES.PUBLIC,
    name: "Public Requester (Open Access)",
    level: 99,
    description: "Campus residents, students, and faculty who can submit complaints freely without login and track their status.",
    isSystem: true,
    defaultPermissions: [
      PERMISSION_CODES.COMPLAINT_CREATE,
      PERMISSION_CODES.COMPLAINT_VIEW_OWN,
      PERMISSION_CODES.COMPLAINT_REOPEN,
      PERMISSION_CODES.COMPLAINT_ESCALATE,
    ],
  },
};

export const DEFAULT_DEPARTMENTS = [
  {
    code: "ELEC",
    name: "Electrical Maintenance",
    description: "Fans, tubelights, switches, MCBs, distribution panels, and power wiring.",
    leadEmail: "aee1.electrical@iitgn.ac.in",
    leadPhone: "+91-79-2395-2010",
    slaHoursL1: 24,
    slaHoursL2: 72,
    slaHoursL3: 168,
    icon: "Zap",
  },
  {
    code: "CIVIL",
    name: "Civil & Masonry",
    description: "Wall cracks, seepage, plaster, tiles, painting, and structural repairs.",
    leadEmail: "aee1.civil@iitgn.ac.in",
    leadPhone: "+91-79-2395-2020",
    slaHoursL1: 24,
    slaHoursL2: 72,
    slaHoursL3: 168,
    icon: "Building",
  },
  {
    code: "PLUMB",
    name: "Plumbing & Sanitary",
    description: "Taps, flush valves, pipelines, drainage, washbasins, and water pressure.",
    leadEmail: "aee1.civil@iitgn.ac.in",
    leadPhone: "+91-79-2395-2021",
    slaHoursL1: 12,
    slaHoursL2: 48,
    slaHoursL3: 120,
    icon: "Droplets",
  },
  {
    code: "HVAC",
    name: "Air-Conditioning (AC)",
    description: "Split ACs, VRV units, remote controllers, and compressor maintenance.",
    leadEmail: "ac.maintenance@iitgn.ac.in",
    leadPhone: "+91-79-2395-2030",
    slaHoursL1: 24,
    slaHoursL2: 72,
    slaHoursL3: 168,
    icon: "Wind",
  },
  {
    code: "COOLER",
    name: "Water-Coolers & Purifiers",
    description: "Hostel and academic water-coolers, RO purifiers, and drinking fountains.",
    leadEmail: "water.works@iitgn.ac.in",
    leadPhone: "+91-79-2395-2035",
    slaHoursL1: 12,
    slaHoursL2: 36,
    slaHoursL3: 72,
    icon: "GlassWater",
  },
  {
    code: "CARP",
    name: "Carpentry & Furniture",
    description: "Door locks, window frames, cupboards, study tables, and bed frames.",
    leadEmail: "estate.carpentry@iitgn.ac.in",
    leadPhone: "+91-79-2395-2040",
    slaHoursL1: 48,
    slaHoursL2: 96,
    slaHoursL3: 240,
    icon: "Hammer",
  },
  {
    code: "IT",
    name: "Network & Telecom",
    description: "Ethernet ports, Wi-Fi AP cabling, and intercom lines.",
    leadEmail: "networks@iitgn.ac.in",
    leadPhone: "+91-79-2395-2050",
    slaHoursL1: 24,
    slaHoursL2: 48,
    slaHoursL3: 96,
    icon: "Wifi",
  },
];
