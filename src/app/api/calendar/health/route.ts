import { NextResponse } from "next/server";
import { superAppCalendar } from "@/lib/calendar/superAppCalendarClient";

export async function GET() {
  const health = await superAppCalendar.checkHealth();
  return NextResponse.json({
    service: "SuperApp Global Calendar API v1 Connector",
    moduleKey: process.env.SUPERAPP_MODULE_KEY || "IWD",
    targetBaseUrl: process.env.SUPERAPP_CALENDAR_BASE_URL || "http://localhost:3001",
    health,
  });
}
