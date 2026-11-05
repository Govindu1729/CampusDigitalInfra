import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access profile." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        role: true,
        department: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        defaultSharePhone: user.defaultSharePhone ?? true,
        roleCode: user.role?.code || "USER",
        roleName: user.role?.name || "Campus Resident",
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: "Authentication required to update profile." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, phone, defaultSharePhone } = body;

    const updateData: {
      name?: string;
      phone?: string | null;
      defaultSharePhone?: boolean;
    } = {};

    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone === "string" && phone.trim()) {
        const cleanPhone = phone.replace(/\D/g, "").slice(-10);
        updateData.phone = cleanPhone || null;
      } else {
        updateData.phone = null;
      }
    }

    if (typeof defaultSharePhone === "boolean") {
      updateData.defaultSharePhone = defaultSharePhone;
    }

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      include: {
        role: true,
        department: true,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        defaultSharePhone: updatedUser.defaultSharePhone ?? true,
        roleCode: updatedUser.role?.code || "USER",
        roleName: updatedUser.role?.name || "Campus Resident",
        departmentName: updatedUser.department?.name || null,
      },
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile." },
      { status: 500 }
    );
  }
}
