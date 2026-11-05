import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AuthenticatedUser } from "./rbac";
import { RoleCode } from "@/config/roles";

const SESSION_COOKIE_NAME = "iitgn_staff_session_v3";
const LEGACY_COOKIE_NAME = "iitgn_mrs_session";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  const targetEmail = sessionCookie;

  try {
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        department: true,
      },
    });

    if (!user || !user.active) {
      return null;
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role.code as RoleCode,
      roleName: user.role.name,
      roleLevel: user.role.level,
      departmentId: user.departmentId,
      departmentCode: user.department?.code,
      departmentName: user.department?.name,
      permissions,
    };
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
}

export function setSessionUserCookie(email: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionUserCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

