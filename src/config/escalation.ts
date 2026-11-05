// IITGN Maintenance Request System - Escalation & Complaint Redressal Hierarchy

export interface EscalationContact {
  level: number;
  title: string;
  roleDescription: string;
  name?: string;
  email: string;
  phone?: string;
  slaTriggerHours: number;
}

export const ESCALATION_LEVELS: EscalationContact[] = [
  {
    level: 1,
    title: "Level 1: Assistant Executive Engineer (AEE)",
    roleDescription: "Initial operational escalation if unacknowledged or not acted upon.",
    email: process.env.ESCALATION_L1_ELECTRICAL_EMAIL || "aee1.electrical@iitgn.ac.in",
    slaTriggerHours: parseInt(process.env.ESCALATION_L1_HOURS || "24", 10),
  },
  {
    level: 2,
    title: "Level 2: Executive Engineer (EE)",
    roleDescription: "Departmental engineering escalation for unresolved or delayed requests.",
    email: process.env.ESCALATION_L2_EMAIL || "ee.civil@iitgn.ac.in",
    slaTriggerHours: parseInt(process.env.ESCALATION_L2_HOURS || "72", 10),
  },
  {
    level: 3,
    title: "Level 3: Superintending Engineer (SE)",
    roleDescription: "Highest institute works escalation authority.",
    email: process.env.ESCALATION_L3_EMAIL || "se@iitgn.ac.in",
    slaTriggerHours: parseInt(process.env.ESCALATION_L3_HOURS || "168", 10),
  },
];

export const EMERGENCY_CONTACTS = {
  controlRoom: "+91-79-2395-2000",
  securityControl: "+91-79-2395-2001",
  medicalEmergency: "+91-79-2395-2002",
  note: "For emergency hazards (fire, sparking, active water pipe burst, gas smell), please immediately alert the 24x7 Works Control Room.",
};
