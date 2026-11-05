import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { isOverallAdmin } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");

    let whereClause: any = {};
    if (departmentId && departmentId !== "ALL") {
      whereClause.departmentId = departmentId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        role: true,
        department: true,
        _count: {
          select: { assignedRequests: true },
        },
      },
      orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const isOverall = currentUser.roleLevel === 1;
    const isDeptHead = currentUser.roleLevel === 2;

    if (!isOverall && !isDeptHead) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You do not have permission to add personnel." },
        { status: 403 }
      );
    }

    const { name, email, phone, roleId, departmentId } = await req.json();

    if (!name || !email || !roleId) {
      return NextResponse.json(
        { success: false, error: "Name, email, and role are required." },
        { status: 400 }
      );
    }

    const targetRole = await prisma.role.findUnique({ where: { id: roleId } });
    if (!targetRole) {
      return NextResponse.json({ success: false, error: "Selected role not found." }, { status: 404 });
    }

    // Department Heads can only add staff/technicians (Level 3) to their own department
    if (isDeptHead && targetRole.level < 3) {
      return NextResponse.json(
        { success: false, error: "Department Heads can only add field technicians and staff to their department." },
        { status: 403 }
      );
    }

    const finalDepartmentId = isDeptHead ? currentUser.departmentId : (departmentId || null);

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        roleId,
        departmentId: finalDepartmentId,
        active: true,
      },
      include: {
        role: true,
        department: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${newUser.name} created successfully.`,
      user: newUser,
    });
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json({ success: false, error: "Failed to create user." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, active, phone, name } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    const isOverall = currentUser.roleLevel === 1;
    const isDeptHead = currentUser.roleLevel === 2 && currentUser.departmentId === targetUser.departmentId;

    if (!isOverall && !isDeptHead) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You can only manage personnel in your department." },
        { status: 403 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(active !== undefined && { active: Boolean(active) }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(name !== undefined && { name: name.trim() }),
      },
      include: { role: true, department: true },
    });

    return NextResponse.json({
      success: true,
      message: `User ${updated.name} updated successfully.`,
      user: updated,
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update user." }, { status: 500 });
  }
}
