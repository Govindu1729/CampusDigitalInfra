import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessDepartment } from "@/lib/auth/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status, note, token } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required." }, { status: 400 });
    }

    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        OR: [{ id: params.id }, { ticketNumber: params.id }],
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
    }

    const currentUser = await getCurrentUser();
    const isAuthorizedRequester = token && request.trackingToken === token;

    // Check authorization: either staff with department access OR resident closing their own ticket
    if (!currentUser && !isAuthorizedRequester) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let performerName = "";
    let performerId: string | null = null;
    let closedRole = "admin";

    if (currentUser) {
      // RBAC check: must have department access
      if (!canAccessDepartment(currentUser, request.departmentId)) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You cannot modify requests outside your department." },
          { status: 403 }
        );
      }
      performerName = currentUser.name;
      performerId = currentUser.id;
      closedRole = currentUser.roleCode === "OVERALL_ADMIN" ? "admin" : "staff";
    } else if (isAuthorizedRequester) {
      // Requesters can only confirm resolution / close their own ticket
      if (status !== "CLOSED" && status !== "RESOLVED") {
        return NextResponse.json(
          { success: false, error: "Residents may only confirm resolution or close their complaint." },
          { status: 403 }
        );
      }
      performerName = request.requesterName;
      closedRole = "requester";
    }

    const fromStatus = request.status;
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "ACKNOWLEDGED" && !request.acknowledgedAt) {
      updateData.acknowledgedAt = new Date();
    } else if (status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    } else if (status === "CLOSED") {
      updateData.closedAt = new Date();
      updateData.closedByRole = closedRole;
    } else if (status === "IN_PROGRESS") {
      updateData.closedAt = null;
      updateData.closedByRole = null;
    }

    // Record audit event first so it is included in statusEvents
    await prisma.statusEvent.create({
      data: {
        requestId: request.id,
        performedById: performerId,
        performedByName: performerName,
        eventType: "STATUS_CHANGE",
        fromStatus,
        toStatus: status,
        note: note || `Status transitioned from ${fromStatus} to ${status} by ${performerName}.`,
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: updateData,
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
      message: `Status updated to ${status}`,
      request: updated,
    });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update status." },
      { status: 500 }
    );
  }
}
