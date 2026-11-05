import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { superAppCalendar } from "@/lib/calendar/superAppCalendarClient";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const eventId = params.id;
    const body = await req.json();
    const { startAt, endAt, title, description, location } = body;

    // 1. Call SuperApp Global Calendar API v1 PATCH
    const remoteResult = await superAppCalendar.updateEvent(eventId, {
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
      title,
      description,
      location,
    });

    // 2. Update local ticket matching this calendarEventId if applicable
    const ticket = await prisma.maintenanceRequest.findFirst({
      where: { calendarEventId: eventId },
    });

    if (ticket && (startAt || endAt)) {
      await prisma.maintenanceRequest.update({
        where: { id: ticket.id },
        data: {
          scheduledStartAt: startAt ? new Date(startAt) : ticket.scheduledStartAt,
          scheduledEndAt: endAt ? new Date(endAt) : ticket.scheduledEndAt,
        },
      });

      await prisma.statusEvent.create({
        data: {
          requestId: ticket.id,
          performedByName: currentUser.name,
          eventType: "CALENDAR_UPDATE",
          toStatus: ticket.status,
          note: `Repair schedule updated on SuperApp Global Calendar for Event ${eventId}.`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      remoteResult,
      message: "Calendar event updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update calendar event." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const eventId = params.id;

    // 1. Call SuperApp Global Calendar API v1 DELETE (soft delete / cancel)
    const remoteResult = await superAppCalendar.cancelEvent(eventId);

    // 2. Unlink from local ticket if applicable
    const ticket = await prisma.maintenanceRequest.findFirst({
      where: { calendarEventId: eventId },
    });

    if (ticket) {
      await prisma.maintenanceRequest.update({
        where: { id: ticket.id },
        data: {
          calendarEventId: null,
          scheduledStartAt: null,
          scheduledEndAt: null,
        },
      });

      await prisma.statusEvent.create({
        data: {
          requestId: ticket.id,
          performedByName: currentUser.name,
          eventType: "CALENDAR_CANCEL",
          toStatus: ticket.status,
          note: `Scheduled repair visit cancelled on SuperApp Global Calendar (Event ${eventId}).`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      remoteResult,
      message: "Calendar event cancelled successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel calendar event." },
      { status: 500 }
    );
  }
}
