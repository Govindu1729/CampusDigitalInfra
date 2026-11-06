import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AuthenticatedUser } from "./rbac";
import { RoleCode } from "@/config/roles";
import { sign, unsign } from "cookie-signature";

const SESSION_COOKIE_NAME = "iitgn_staff_session_v3";
const LEGACY_COOKIE_NAME = "iitgn_mrs_session";

/**
 * Get the cookie signing secret from environment.
 * Throws if not configured in production.
 */
function getCookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("COOKIE_SECRET environment variable is required in production");
    }
    // Development fallback - NOT for production use
    console.warn("⚠️ COOKIE_SECRET not set, using development fallback");
    return "dev-secret-change-in-production-min-32-chars";
  }
  return secret;
}

/**
 * Create a signed session cookie for the given email.
 */
export async function createSession(email: string): Promise<void> {
  const secret = getCookieSecret();
  const signedEmail = sign(email, secret);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Destroy the session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}

/**
 * Get the current authenticated user from the signed session cookie.
 * Verifies the cookie signature before looking up the user.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies();
  const signedEmail = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!signedEmail) {
    return null;
  }

  const secret = getCookieSecret();

  // Verify and unsign the cookie
  const email = unsign(signedEmail, secret);

  if (!email) {
    // Cookie was tampered with or invalid signature - clear it
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
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

// Backward compatibility exports
export function setSessionUserCookie(email: string) {
  // This is kept for backward compatibility but now creates a signed session
  // Note: This is synchronous in the old API, but we can't await here
  // Callers should migrate to async createSession()
  const secret = getCookieSecret();
  const signedEmail = sign(email, secret);

  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionUserCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_COOKIE_NAME);
}