import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isWithinAdminReopenWindow,
  isUserClosedArchiveDue,
  LIFECYCLE_CONFIG,
} from "@/config/lifecycle";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reason, token } = await req.json();

    if (!reason || reason.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Please provide a reason for reopening the complaint." },
        { status: 400 }
      );
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

    if (!currentUser && !isAuthorizedRequester) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    // Check grace window if currently CLOSED (3-day cooldown)
    if (request.status === "CLOSED") {
      if (!isWithinAdminReopenWindow(request.closedAt)) {
        return NextResponse.json(
          {
            success: false,
            error: `The ${LIFECYCLE_CONFIG.ADMIN_CLOSED_REOPEN_GRACE_DAYS}-day grace window to reopen this closed ticket has expired. This complaint has been transferred to secondary storage.`,
          },
          { status: 403 }
        );
      }
    }

    // Record audit event
    await prisma.statusEvent.create({
      data: {
        requestId: request.id,
        performedByName: currentUser?.name || request.requesterName,
        eventType: "REOPEN",
        fromStatus: request.status,
        toStatus: "IN_PROGRESS",
        note: `Complaint reopened and moved back to IN_PROGRESS: ${reason.trim()}`,
      },
    });

    // Also record a follow-up comment for full transparency
    await prisma.followUpComment.create({
      data: {
        requestId: request.id,
        authorName: currentUser?.name || request.requesterName,
        authorRole: currentUser ? "staff" : "requester",
        authorUserId: currentUser?.id || null,
        isInternalStaffOnly: false,
        message: `🔄 Reopened complaint: ${reason.trim()}`,
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        status: "IN_PROGRESS", // Return directly to In Progress queue
        reopenCount: request.reopenCount + 1,
        reopenReason: reason.trim(),
        closedAt: null,
        closedByRole: null,
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
      message: "Complaint reopened and moved back to IN_PROGRESS.",
      request: updated,
    });
  } catch (error) {
    console.error("Reopen error:", error);
    return NextResponse.json({ success: false, error: "Failed to reopen request." }, { status: 500 });
  }
}
