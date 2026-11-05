// IITGN Maintenance Request System - Database Seeder
import { PrismaClient } from "@prisma/client";
import { SYSTEM_ROLES, PERMISSION_CODES, DEFAULT_DEPARTMENTS, ROLE_CODES } from "../src/config/roles";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting IITGN MRS Database Seeding...");

  // 1. Seed Permissions
  console.log("Seeding permissions...");
  const permissionsMap = new Map<string, string>();
  for (const permCode of Object.values(PERMISSION_CODES)) {
    const perm = await prisma.permission.upsert({
      where: { code: permCode },
      update: {},
      create: {
        code: permCode,
        name: permCode.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        category: permCode.split("_")[0].toLowerCase(),
        description: `Permission to perform ${permCode}`,
      },
    });
    permissionsMap.set(permCode, perm.id);
  }

  // 2. Seed Roles
  console.log("Seeding roles...");
  const rolesMap = new Map<string, string>();
  for (const roleDef of Object.values(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: {
        name: roleDef.name,
        level: roleDef.level,
        description: roleDef.description,
      },
      create: {
        code: roleDef.code,
        name: roleDef.name,
        level: roleDef.level,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });
    rolesMap.set(roleDef.code, role.id);

    // Map default permissions
    for (const permCode of roleDef.defaultPermissions) {
      const permId = permissionsMap.get(permCode);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 3. Seed Departments
  console.log("Seeding departments...");
  const deptMap = new Map<string, string>();
  for (const dept of DEFAULT_DEPARTMENTS) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {
        name: dept.name,
        description: dept.description,
        leadEmail: dept.leadEmail,
        leadPhone: dept.leadPhone,
        slaHoursL1: dept.slaHoursL1,
        slaHoursL2: dept.slaHoursL2,
        slaHoursL3: dept.slaHoursL3,
        icon: dept.icon,
      },
      create: {
        code: dept.code,
        name: dept.name,
        description: dept.description,
        leadEmail: dept.leadEmail,
        leadPhone: dept.leadPhone,
        slaHoursL1: dept.slaHoursL1,
        slaHoursL2: dept.slaHoursL2,
        slaHoursL3: dept.slaHoursL3,
        icon: dept.icon,
        active: true,
      },
    });
    deptMap.set(dept.code, d.id);
  }

  // 4. Seed Admin & Staff Users
  console.log("Seeding users...");
  const overallAdminRoleId = rolesMap.get(ROLE_CODES.OVERALL_ADMIN)!;
  const deptAdminRoleId = rolesMap.get(ROLE_CODES.DEPT_ADMIN)!;
  const deptStaffRoleId = rolesMap.get(ROLE_CODES.DEPT_STAFF)!;

  // Level 1: Overall Admin (Spans all departments)
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@iitgn.ac.in" },
    update: {},
    create: {
      email: "admin@iitgn.ac.in",
      name: "Er. A. K. Jain (Superintending Engineer)",
      phone: "+91-79-2395-2005",
      roleId: overallAdminRoleId,
      departmentId: null, // Global access
      active: true,
    },
  });

  // Level 2: Department Admin - Electrical
  const electricalDeptId = deptMap.get("ELEC")!;
  const elecAdmin = await prisma.user.upsert({
    where: { email: "aee.electrical@iitgn.ac.in" },
    update: {},
    create: {
      email: "aee.electrical@iitgn.ac.in",
      name: "Er. Alok Verma (AEE Electrical)",
      phone: "+91-79-2395-2010",
      roleId: deptAdminRoleId,
      departmentId: electricalDeptId,
      active: true,
    },
  });

  // Level 2: Department Admin - Civil & Plumbing
  const civilDeptId = deptMap.get("CIVIL")!;
  const plumbingDeptId = deptMap.get("PLUMB")!;
  const civilAdmin = await prisma.user.upsert({
    where: { email: "aee.civil@iitgn.ac.in" },
    update: {},
    create: {
      email: "aee.civil@iitgn.ac.in",
      name: "Er. Priya Patel (AEE Civil)",
      phone: "+91-79-2395-2020",
      roleId: deptAdminRoleId,
      departmentId: civilDeptId,
      active: true,
    },
  });

  // Level 3: Department Staff - Electrician
  const staffElectrician = await prisma.user.upsert({
    where: { email: "tech.rajesh@iitgn.ac.in" },
    update: {},
    create: {
      email: "tech.rajesh@iitgn.ac.in",
      name: "Rajesh Kumar (Sr. Electrician)",
      phone: "+91-98765-43210",
      roleId: deptStaffRoleId,
      departmentId: electricalDeptId,
      active: true,
    },
  });

  // Level 3: Department Staff - Plumber
  const staffPlumber = await prisma.user.upsert({
    where: { email: "tech.suresh@iitgn.ac.in" },
    update: {},
    create: {
      email: "tech.suresh@iitgn.ac.in",
      name: "Suresh Patel (Lead Plumber)",
      phone: "+91-98765-43211",
      roleId: deptStaffRoleId,
      departmentId: plumbingDeptId,
      active: true,
    },
  });

  // 5. Seed Realistic Complaints / Requests
  console.log("Seeding sample complaints...");
  const hvacDeptId = deptMap.get("HVAC")!;
  const coolerDeptId = deptMap.get("COOLER")!;
  const carpDeptId = deptMap.get("CARP")!;

  const complaintsData = [
    {
      ticketNumber: "IITGN-2026-0001",
      trackingToken: "token_elec_48291a",
      category: "housing",
      departmentId: electricalDeptId,
      domain: "Electrical",
      subDomain1: "Power Socket / Switch",
      subDomain2: "Sparking / Loose",
      requesterName: "Dr. Sudhir K. Jain",
      requesterEmail: "sudhir.jain@iitgn.ac.in",
      requesterPhone: "9876500001",
      locationCategory: "Apartment",
      locationDetail: "Apartment 14/203",
      corridor: "West Wing Corridor B",
      availability: "Weekdays after 4:00 PM",
      subject: "Heavy sparking from microwave 16A power socket in kitchen",
      description: "Whenever microwave is turned on, sparks fly and there is a burning smell from the wall socket. Please inspect immediately.",
      priority: "HIGH",
      isUrgent: false,
      status: "IN_PROGRESS",
      assignedStaffId: staffElectrician.id,
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), // 2 days ago
      acknowledgedAt: new Date(Date.now() - 1.8 * 24 * 3600 * 1000),
      assignedAt: new Date(Date.now() - 1.5 * 24 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0002",
      trackingToken: "token_hostel_88192b",
      category: "hostel",
      departmentId: electricalDeptId,
      domain: "Electrical",
      subDomain1: "Ceiling Fan / Exhaust",
      subDomain2: "Noise / Grinding",
      requesterName: "Aman Sharma",
      requesterEmail: "aman.sharma@iitgn.ac.in",
      requesterPhone: "9876500002",
      locationCategory: "Hostel",
      locationDetail: "Aibaan - Room 218",
      corridor: null,
      availability: "Anytime between 1:00 PM to 6:00 PM",
      subject: "Ceiling fan making loud grinding noise and wobbling",
      description: "The fan in room 218 makes an unbearable bearing grinding noise and wobbles at speed 3 and above. Needs bearing grease or capacitor replacement.",
      priority: "NORMAL",
      isUrgent: false,
      status: "ASSIGNED",
      assignedStaffId: staffElectrician.id,
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      acknowledgedAt: new Date(Date.now() - 0.9 * 24 * 3600 * 1000),
      assignedAt: new Date(Date.now() - 0.5 * 24 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0003",
      trackingToken: "token_plumb_77263c",
      category: "academic",
      departmentId: plumbingDeptId,
      domain: "Plumbing",
      subDomain1: "Drainage & Waste Pipe",
      subDomain2: "Kitchen Sink Overflow",
      requesterName: "Prof. Ananya Sen",
      requesterEmail: "ananya.sen@iitgn.ac.in",
      requesterPhone: "9876500003",
      locationCategory: "Academic Complex",
      locationDetail: "Academic Complex 2 (AB 2) - Room 304 (Chemistry Pantry)",
      corridor: null,
      availability: "Morning 9:00 AM to 12:00 PM",
      subject: "Pantry sink drain pipe choked and overflowing onto floor",
      description: "Waste pipe is completely clogged. Water is collecting on the floor and seeping into the hallway.",
      priority: "NORMAL",
      isUrgent: false,
      status: "SUBMITTED",
      createdAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0004",
      trackingToken: "token_hvac_99371d",
      category: "jeet_hostel",
      departmentId: hvacDeptId,
      domain: "Air-Conditioning",
      subDomain1: "Split AC Unit",
      subDomain2: "No Cooling / Warm Air",
      requesterName: "Rohan Varma",
      requesterEmail: "rohan.varma@iitgn.ac.in",
      requesterPhone: "9876500004",
      locationCategory: "Hostel",
      locationDetail: "JEET Hostel - Block B, Room 405",
      corridor: null,
      availability: "Post 5:00 PM",
      subject: "Split AC blowing room-temperature air with error code E4",
      description: "Unit powers on but compressor does not start. Remote display shows error E4 after 3 minutes.",
      priority: "NORMAL",
      isUrgent: false,
      status: "ACKNOWLEDGED",
      createdAt: new Date(Date.now() - 14 * 3600 * 1000),
      acknowledgedAt: new Date(Date.now() - 10 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0005",
      trackingToken: "token_cooler_11823e",
      category: "infrastructure",
      departmentId: coolerDeptId,
      domain: "Water-Cooler",
      subDomain1: "Drinking Water Cooler",
      subDomain2: "Water Tap Broken",
      requesterName: "Kavita Rao",
      requesterEmail: "kavita.rao@iitgn.ac.in",
      requesterPhone: "9876500005",
      locationCategory: "Infrastructure",
      locationDetail: "Central Library & Information Centre - Ground Floor Corridor",
      corridor: null,
      availability: "Anytime (Public Facility)",
      subject: "Drinking water cooler push-tap stuck open causing continuous leakage",
      description: "The right push tap broke off, causing continuous stream of clean drinking water into the drain basin.",
      priority: "HIGH",
      isUrgent: true,
      status: "RESOLVED",
      assignedStaffId: staffPlumber.id,
      createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      acknowledgedAt: new Date(Date.now() - 2.8 * 24 * 3600 * 1000),
      assignedAt: new Date(Date.now() - 2.5 * 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0006",
      trackingToken: "token_carp_33918f",
      category: "housing",
      departmentId: carpDeptId,
      domain: "Carpentry",
      subDomain1: "Doors & Locks",
      subDomain2: "Main Door Jammed",
      requesterName: "Dr. Meera Nambiar",
      requesterEmail: "meera.nambiar@iitgn.ac.in",
      requesterPhone: "9876500006",
      locationCategory: "Apartment",
      locationDetail: "Apartment 02/101",
      corridor: "Ground Floor",
      availability: "Evenings after 6 PM",
      subject: "Main door lock latch slipping and difficult to turn",
      description: "The Godrej cylindrical lock cylinder was sticking. Work completed by carpenter.",
      priority: "NORMAL",
      isUrgent: false,
      status: "CLOSED",
      satisfactionRating: 5,
      feedbackComments: "Prompt service and the lock works smoothly now. Thank you!",
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      acknowledgedAt: new Date(Date.now() - 6.8 * 24 * 3600 * 1000),
      assignedAt: new Date(Date.now() - 6.5 * 24 * 3600 * 1000),
      resolvedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      closedAt: new Date(Date.now() - 4.5 * 24 * 3600 * 1000),
    },
    {
      ticketNumber: "IITGN-2026-0007",
      trackingToken: "token_elec_77192g",
      category: "academic",
      departmentId: electricalDeptId,
      domain: "Electrical",
      subDomain1: "Main MCB / DB",
      subDomain2: "Burn Smell from DB",
      requesterName: "Dr. Arvind Gupta",
      requesterEmail: "arvind.gupta@iitgn.ac.in",
      requesterPhone: "9876500007",
      locationCategory: "Academic Complex",
      locationDetail: "Academic Complex 1 (AB 1) - VLSI Design Lab 208",
      corridor: null,
      availability: "Immediate",
      subject: "Burning plastic smell from main electrical panel board in Lab 208",
      description: "Severe overheating detected in phase selector switch. Breaker tripped twice.",
      priority: "EMERGENCY",
      isUrgent: true,
      escalationLevel: 1,
      escalatedAt: new Date(Date.now() - 2 * 3600 * 1000),
      escalationNote: "Auto-escalated to Level 1 (AEE Electrical) due to EMERGENCY fire hazard priority.",
      status: "IN_PROGRESS",
      assignedStaffId: staffElectrician.id,
      createdAt: new Date(Date.now() - 5 * 3600 * 1000),
      acknowledgedAt: new Date(Date.now() - 4.8 * 3600 * 1000),
      assignedAt: new Date(Date.now() - 4.5 * 3600 * 1000),
    },
  ];

  for (const c of complaintsData) {
    const req = await prisma.maintenanceRequest.upsert({
      where: { ticketNumber: c.ticketNumber },
      update: {},
      create: c,
    });

    // Create Initial Submission Event
    await prisma.statusEvent.create({
      data: {
        requestId: req.id,
        performedByName: c.requesterName,
        eventType: "SUBMISSION",
        toStatus: "SUBMITTED",
        note: "Complaint submitted via open public portal.",
        createdAt: c.createdAt,
      },
    });

    if (c.acknowledgedAt) {
      await prisma.statusEvent.create({
        data: {
          requestId: req.id,
          performedById: elecAdmin.id,
          performedByName: elecAdmin.name,
          eventType: "STATUS_CHANGE",
          fromStatus: "SUBMITTED",
          toStatus: "ACKNOWLEDGED",
          note: "Request reviewed and acknowledged by Department Officer.",
          createdAt: c.acknowledgedAt,
        },
      });
    }

    if (c.assignedAt && c.assignedStaffId) {
      await prisma.statusEvent.create({
        data: {
          requestId: req.id,
          performedById: elecAdmin.id,
          performedByName: elecAdmin.name,
          eventType: "ASSIGNMENT",
          fromStatus: "ACKNOWLEDGED",
          toStatus: "ASSIGNED",
          note: `Assigned to field staff for on-site inspection.`,
          createdAt: c.assignedAt,
        },
      });
    }

    if (c.status === "IN_PROGRESS") {
      await prisma.statusEvent.create({
        data: {
          requestId: req.id,
          performedById: staffElectrician.id,
          performedByName: staffElectrician.name,
          eventType: "STATUS_CHANGE",
          fromStatus: "ASSIGNED",
          toStatus: "IN_PROGRESS",
          note: "Technician arrived on site and commenced diagnostic inspection.",
          createdAt: new Date(c.createdAt.getTime() + 3600 * 1000),
        },
      });

      // Sample follow-up comment
      await prisma.followUpComment.create({
        data: {
          requestId: req.id,
          authorName: staffElectrician.name,
          authorRole: "staff",
          authorUserId: staffElectrician.id,
          isInternalStaffOnly: false,
          message: "Inspection in progress. Ordered replacement MCB switchgear from central inventory. Will replace by 4:30 PM.",
          createdAt: new Date(c.createdAt.getTime() + 4000 * 1000),
        },
      });
    }

    if (c.escalatedAt) {
      await prisma.statusEvent.create({
        data: {
          requestId: req.id,
          performedByName: "System SLA Monitor",
          eventType: "ESCALATION",
          note: c.escalationNote,
          createdAt: c.escalatedAt,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
