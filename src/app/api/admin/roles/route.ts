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

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { level: "asc" },
    });

    const allPermissions = await prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });

    return NextResponse.json({
      success: true,
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        level: r.level,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: r.permissions.map((rp) => rp.permission.code),
      })),
      allPermissions,
    });
  } catch (error) {
    console.error("Roles fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch roles." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !isOverallAdmin(currentUser)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only Overall Admin (Level 1) can modify role schema and permissions." },
        { status: 403 }
      );
    }

    const { roleId, permissionCodes, name, description } = await req.json();

    if (!roleId) {
      return NextResponse.json({ success: false, error: "Role ID is required." }, { status: 400 });
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return NextResponse.json({ success: false, error: "Role not found." }, { status: 404 });
    }

    // Update role metadata if provided
    if (name || description) {
      await prisma.role.update({
        where: { id: roleId },
        data: {
          name: name || role.name,
          description: description || role.description,
        },
      });
    }

    // Update permissions if an array is supplied
    if (Array.isArray(permissionCodes)) {
      // Find all target permission IDs
      const perms = await prisma.permission.findMany({
        where: { code: { in: permissionCodes } },
      });

      // Clear existing mappings
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Insert new mappings
      for (const p of perms) {
        await prisma.rolePermission.create({
          data: {
            roleId,
            permissionId: p.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Permissions updated successfully for role ${role.name}.`,
    });
  } catch (error) {
    console.error("Role permissions update error:", error);
    return NextResponse.json({ success: false, error: "Failed to update role schema." }, { status: 500 });
  }
}
