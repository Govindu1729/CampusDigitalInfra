// IITGN Maintenance Request System - RBAC Access Control Service
import { PERMISSION_CODES, PermissionCode, ROLE_CODES, RoleCode } from "@/config/roles";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  roleCode: RoleCode;
  roleName?: string;
  roleLevel: number; // 1 = Overall Admin, 2 = Dept Admin (Sub-Admin), 3 = Staff
  departmentId: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  permissions: string[];
}

/**
 * Checks if a user has a specific permission.
 * Overall Admin (Level 1) automatically has all permissions.
 */
export function hasPermission(
  user: AuthenticatedUser | null | undefined,
  permission: PermissionCode | string
): boolean {
  if (!user) return false;
  if (user.roleLevel === 1 || user.roleCode === ROLE_CODES.OVERALL_ADMIN) {
    return true; // Overall Admin has universal access
  }
  return user.permissions.includes(permission);
}

/**
 * Checks if a user can access complaints/data belonging to a specific department.
 * - Overall Admin (Level 1) can access ANY department.
 * - Department Admin (Level 2) and Staff (Level 3) can access their assigned department.
 */
export function canAccessDepartment(
  user: AuthenticatedUser | null | undefined,
  departmentId: string | null | undefined
): boolean {
  if (!user) return false;
  if (user.roleLevel === 1 || user.roleCode === ROLE_CODES.OVERALL_ADMIN) {
    return true; // Universal access across all departments
  }
  if (!departmentId || !user.departmentId) {
    return false;
  }
  return user.departmentId === departmentId;
}

/**
 * Checks if a user is an Overall Admin (Level 1)
 */
export function isOverallAdmin(user: AuthenticatedUser | null | undefined): boolean {
  if (!user) return false;
  return user.roleLevel === 1 || user.roleCode === ROLE_CODES.OVERALL_ADMIN;
}

/**
 * Checks if a user is a Department Admin (Level 2 / Sub-Admin)
 */
export function isDepartmentAdmin(
  user: AuthenticatedUser | null | undefined,
  departmentId?: string
): boolean {
  if (!user) return false;
  const isDeptAdminRole = user.roleLevel === 2 || user.roleCode === ROLE_CODES.DEPT_ADMIN;
  if (!isDeptAdminRole) return false;
  if (departmentId && user.departmentId) {
    return user.departmentId === departmentId;
  }
  return true;
}

/**
 * Checks if a user has rights to manage user accounts and assign roles.
 * Restricted to Overall Admin (Level 1).
 */
export function canManageUsers(user: AuthenticatedUser | null | undefined): boolean {
  return hasPermission(user, PERMISSION_CODES.USER_MANAGE);
}

/**
 * Checks if a user can assign or reassign a technician.
 * Level 1 (Overall Admin) and Level 2 (Department Admin for their department).
 */
export function canAssignTicket(
  user: AuthenticatedUser | null | undefined,
  ticketDepartmentId: string
): boolean {
  if (!user) return false;
  if (isOverallAdmin(user)) return true;
  if (isDepartmentAdmin(user, ticketDepartmentId)) {
    return hasPermission(user, PERMISSION_CODES.COMPLAINT_ASSIGN);
  }
  return false;
}

/**
 * Filter Prisma request query by department depending on the user's role.
 * If user is Overall Admin -> return unconstrained filter (or user-chosen filter).
 * If user is Dept Admin or Staff -> constrain strictly to their assigned department.
 */
export function buildDepartmentFilter(
  user: AuthenticatedUser | null | undefined,
  requestedDepartmentId?: string
) {
  if (!user) {
    return { id: "UNAUTHORIZED_NO_ACCESS" };
  }
  if (isOverallAdmin(user)) {
    // Overall Admin can see all, or filter by requested department
    return requestedDepartmentId ? { departmentId: requestedDepartmentId } : {};
  }
  // Dept Admin or Staff can only see their department
  return { departmentId: user.departmentId || "NO_DEPT_ASSIGNED" };
}
