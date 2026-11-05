import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { isOverallAdmin } from "@/lib/auth/rbac";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            requests: true,
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, departments });
  } catch (error) {
    console.error("Departments fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch departments." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, slaHoursL1, slaHoursL2, slaHoursL3, leadEmail, leadPhone, description, active } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: "Department ID is required." }, { status: 400 });
    }

    // Overall Admin (Level 1) can modify any department.
    // Department Admin (Level 2) can modify their assigned department.
    const isOverall = currentUser.roleLevel === 1;
    const isDeptHead = currentUser.roleLevel === 2 && currentUser.departmentId === id;

    if (!isOverall && !isDeptHead) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Department Heads can only modify SLAs and contacts for their assigned department." },
        { status: 403 }
      );
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(slaHoursL1 !== undefined && { slaHoursL1: Number(slaHoursL1) }),
        ...(slaHoursL2 !== undefined && { slaHoursL2: Number(slaHoursL2) }),
        ...(slaHoursL3 !== undefined && { slaHoursL3: Number(slaHoursL3) }),
        ...(leadEmail !== undefined && { leadEmail: leadEmail.trim() }),
        ...(leadPhone !== undefined && { leadPhone: leadPhone.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Department ${updated.name} updated successfully.`,
      department: updated,
    });
  } catch (error) {
    console.error("Department update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update department." }, { status: 500 });
  }
}
