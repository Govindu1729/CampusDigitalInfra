import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canAssignTicket } from "@/lib/auth/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { staffId, note } = await req.json();

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: params.id }, { ticketNumber: params.id }],
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
    }

    // RBAC check: overall admin or department admin
    if (!canAssignTicket(currentUser, request.departmentId)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You do not have permission to assign technicians for this department." },
        { status: 403 }
      );
    }

    let staffName = "Unassigned";
    if (staffId) {
      const staffUser = await prisma.user.findUnique({
        where: { id: staffId },
      });
      if (staffUser) {
        staffName = staffUser.name;
      }
    }

    const targetStatus = staffId ? (request.status === "SUBMITTED" ? "ASSIGNED" : request.status) : request.status;

    // Record audit event first so it is included in statusEvents
    await prisma.statusEvent.create({
      data: {
        requestId: request.id,
        performedById: currentUser.id,
        performedByName: currentUser.name,
        eventType: "ASSIGNMENT",
        toStatus: targetStatus,
        note: note || (staffId ? `Assigned to technician ${staffName}.` : "Technician unassigned."),
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        assignedStaffId: staffId || null,
        status: targetStatus,
        assignedAt: staffId ? new Date() : request.assignedAt,
        updatedAt: new Date(),
      },
      include: {
        department: true,
        assignedStaff: {
          select: { id: true, name: true, email: true, phone: true },
        },
        attachments: true,
        statusEvents: {
          orderBy: { createdAt: "desc" },
        },
        followUps: {
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: { followUps: true, attachments: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Technician updated to ${staffName}`,
      request: updated,
    });
  } catch (error) {
    console.error("Assignment error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to assign technician." },
      { status: 500 }
    );
  }
}
