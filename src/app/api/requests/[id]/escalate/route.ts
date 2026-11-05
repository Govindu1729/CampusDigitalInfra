import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { ESCALATION_LEVELS } from "@/config/escalation";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { token, note } = await req.json();

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

    const currentLevel = request.escalationLevel || 0;
    if (currentLevel >= 3) {
      return NextResponse.json(
        { success: false, error: "Already escalated to highest Institute authority (Level 3 Superintending Engineer)." },
        { status: 400 }
      );
    }

    const nextLevel = currentLevel + 1;
    const targetContact = ESCALATION_LEVELS.find((l) => l.level === nextLevel);
    const escalationNote = note || `Manual escalation triggered to ${targetContact?.title || `Level ${nextLevel}`}.`;

    await prisma.statusEvent.create({
      data: {
        requestId: request.id,
        performedByName: currentUser?.name || request.requesterName,
        eventType: "ESCALATION",
        note: escalationNote,
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        escalationLevel: nextLevel,
        escalatedAt: new Date(),
        escalationNote,
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
      message: `Escalated to ${targetContact?.title}`,
      escalationLevel: nextLevel,
      request: updated,
    });
  } catch (error) {
    console.error("Escalation error:", error);
    return NextResponse.json({ success: false, error: "Failed to escalate." }, { status: 500 });
  }
}
