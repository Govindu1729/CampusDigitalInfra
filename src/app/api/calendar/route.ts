import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { superAppCalendar } from "@/lib/calendar/superAppCalendarClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
    const includeCancelled = searchParams.get("includeCancelled") === "true";

    // 1. Fetch remote events from SuperApp Global Calendar API
    const remoteResult = await superAppCalendar.listEvents({
      from,
      to,
      limit,
      offset,
      includeCancelled,
    });

    // 2. Fetch local maintenance tickets that have scheduled repair visits
    const scheduledTickets = await prisma.maintenanceRequest.findMany({
      where: {
        scheduledStartAt: { not: null },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        locationDetail: true,
        department: { select: { name: true } },
        assignedStaff: { select: { name: true, phone: true } },
        scheduledStartAt: true,
        scheduledEndAt: true,
        calendarEventId: true,
        status: true,
      },
      orderBy: { scheduledStartAt: "asc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      remoteConnected: remoteResult.success,
      remoteEvents: remoteResult.events,
      scheduledTickets,
      moduleKey: process.env.SUPERAPP_MODULE_KEY || "IWD",
    });
  } catch (error: any) {
    console.error("Calendar API GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve calendar schedules." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required to schedule repairs on SuperApp Global Calendar." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      ticketNumber,
      ticketId,
      title,
      startAt,
      endAt,
      description,
      location,
      timeZone,
      allDay,
    } = body;

    if (!startAt || !endAt) {
      return NextResponse.json(
        { success: false, error: "startAt and endAt timestamps are required." },
        { status: 400 }
      );
    }

    const startTime = new Date(startAt).getTime();
    const endTime = new Date(endAt).getTime();
    if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
      return NextResponse.json(
        { success: false, error: "endAt must be strictly later than startAt." },
        { status: 400 }
      );
    }

    // Find target ticket
    let ticket: any = null;
    if (ticketId) {
      ticket = await prisma.maintenanceRequest.findUnique({ where: { id: ticketId } });
    } else if (ticketNumber) {
      ticket = await prisma.maintenanceRequest.findUnique({ where: { ticketNumber } });
    }

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Maintenance ticket not found." },
        { status: 404 }
      );
    }

    const eventTitle = title || `IWD Repair: ${ticket.subject} (${ticket.ticketNumber})`;
    const eventLocation = location || ticket.locationDetail;

    // 1. Call SuperApp Global Calendar API v1
    const remoteResult = await superAppCalendar.createEvent({
      title: eventTitle,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      description: description || `Scheduled technician repair visit for ${ticket.ticketNumber}`,
      location: eventLocation,
      timeZone: timeZone || "Asia/Kolkata",
      allDay: Boolean(allDay),
      relatedEntityType: "MAINTENANCE_REQUEST",
      relatedEntityId: ticket.ticketNumber,
    });

    const calendarEventId = remoteResult.success && remoteResult.event
      ? String(remoteResult.event.id)
      : `LOCAL_CAL_${Date.now()}`;

    // 2. Update local ticket with calendar event ID and schedule window
    const updatedTicket = await prisma.maintenanceRequest.update({
      where: { id: ticket.id },
      data: {
        calendarEventId,
        scheduledStartAt: new Date(startAt),
        scheduledEndAt: new Date(endAt),
        status: ticket.status === "SUBMITTED" || ticket.status === "ACKNOWLEDGED" ? "IN_PROGRESS" : ticket.status,
      },
    });

    // 3. Log audit event
    await prisma.statusEvent.create({
      data: {
        requestId: ticket.id,
        performedByName: currentUser.name,
        eventType: "CALENDAR_SCHEDULE",
        toStatus: updatedTicket.status,
        note: `Scheduled repair visit synced to SuperApp Global Calendar. Event ID: ${calendarEventId} (${new Date(startAt).toLocaleDateString()} ${new Date(startAt).toLocaleTimeString()} - ${new Date(endAt).toLocaleTimeString()}).`,
      },
    });

    return NextResponse.json({
      success: true,
      calendarEventId,
      syncedWithSuperApp: remoteResult.success,
      remoteResult,
      ticket: updatedTicket,
      message: remoteResult.success
        ? "Repair visit successfully scheduled and synchronized with SuperApp Global Calendar."
        : "Repair visit scheduled locally in IWD (SuperApp Global Calendar will sync once development service is connected).",
    });
  } catch (error: any) {
    console.error("Calendar schedule error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to schedule calendar event." },
      { status: 500 }
    );
  }
}
