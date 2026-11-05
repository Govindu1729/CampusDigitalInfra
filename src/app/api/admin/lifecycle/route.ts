import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  checkAndRunArchivalSweep,
  getArchivedRequests,
} from "@/lib/lifecycle/lifecycleService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.roleLevel !== 1) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Overall Admin permission required." },
        { status: 403 }
      );
    }

    const archivedRequests = await getArchivedRequests(200);

    return NextResponse.json({
      success: true,
      count: archivedRequests.length,
      archivedRequests,
    });
  } catch (error) {
    console.error("Error fetching archived requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch archived requests." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.roleLevel !== 1) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Overall Admin permission required." },
        { status: 403 }
      );
    }

    const result = await checkAndRunArchivalSweep();

    return NextResponse.json({
      success: true,
      message: `Archival sweep complete: ${result.archivedAdminClosedCount} admin-closed ticket(s) archived (>3d), ${result.archivedUserClosedCount} resident-closed ticket(s) archived (>15m), and ${result.purgedCount} expired record(s) permanently purged (>180d).`,
      result,
    });
  } catch (error) {
    console.error("Error running archival sweep:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run archival sweep." },
      { status: 500 }
    );
  }
}
