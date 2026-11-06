/**
 * Operational Complaint Prioritization Engine
 *
 * Sorting Rules:
 * 1. HIGH / EMERGENCY Priority & Urgent tickets are ALWAYS at the absolute top ("topnest"),
 *    regardless of assignment status (as they represent critical safety hazards).
 * 2. For Department Admin (Level 2):
 *    - Unassigned tasks come next at the top so the supervisor can immediately assign them.
 *    - Followed by assigned active tasks.
 * 3. For Department Staff / Technicians (Level 3):
 *    - Tasks assigned to the logged-in staff member come next at the top.
 *    - Followed by unassigned pool tasks and colleagues' tasks.
 * 4. Active complaints always precede closed / resolved complaints.
 * 5. Within the same priority tier, newest complaints (by createdAt) appear first.
 */

export interface QueueUserContext {
  id?: string;
  email?: string;
  roleCode?: string;
  roleLevel?: number;
}

export function sortComplaintsByOperationalPriority<T extends Record<string, any>>(
  requests: T[],
  currentUser?: QueueUserContext | null
): T[] {
  if (!Array.isArray(requests) || requests.length === 0) return [];

  const isDeptAdmin = currentUser?.roleLevel === 2 || currentUser?.roleCode === "DEPT_ADMIN";
  const isDeptStaff = currentUser?.roleLevel === 3 || currentUser?.roleCode === "DEPT_STAFF";
  const currentUserId = currentUser?.id;
  const currentUserEmail = currentUser?.email?.toLowerCase().trim();

  return [...requests].sort((a, b) => {
    const isClosedOrResolvedA = a.status === "CLOSED" || a.status === "RESOLVED";
    const isClosedOrResolvedB = b.status === "CLOSED" || b.status === "RESOLVED";

    // Tier 0: Active operational tickets always precede Resolved / Closed tickets
    if (!isClosedOrResolvedA && isClosedOrResolvedB) return -1;
    if (isClosedOrResolvedA && !isClosedOrResolvedB) return 1;

    // Tier 1: Critical Emergency / Urgent / High Priority (ALWAYS at the very top)
    const getCriticalScore = (r: Record<string, any>): number => {
      if (r.priority === "EMERGENCY") return 1;
      if (r.isUrgent) return 2;
      if (r.priority === "HIGH") return 3;
      if ((r.escalationLevel || 0) > 0) return 4;
      return 10; // Standard non-critical priority
    };

    const scoreA = getCriticalScore(a);
    const scoreB = getCriticalScore(b);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    // Tier 2: Role-Specific Operational Prioritization
    const isAssignedToMeA = Boolean(
      (currentUserId && a.assignedStaffId === currentUserId) ||
      (currentUserEmail && a.assignedStaff?.email?.toLowerCase() === currentUserEmail)
    );
    const isAssignedToMeB = Boolean(
      (currentUserId && b.assignedStaffId === currentUserId) ||
      (currentUserEmail && b.assignedStaff?.email?.toLowerCase() === currentUserEmail)
    );

    const isUnassignedA = !a.assignedStaffId && !a.assignedStaff;
    const isUnassignedB = !b.assignedStaffId && !b.assignedStaff;

    // Role A: Department Admin -> Unassigned tasks must come on top to be assigned
    if (isDeptAdmin) {
      if (isUnassignedA && !isUnassignedB) return -1;
      if (!isUnassignedA && isUnassignedB) return 1;

      // Reopened tickets also need administrative review
      const isReopenedA = a.status === "REOPENED";
      const isReopenedB = b.status === "REOPENED";
      if (isReopenedA && !isReopenedB) return -1;
      if (!isReopenedA && isReopenedB) return 1;
    }

    // Role B: Department Staff -> My assigned tasks must come on top
    if (isDeptStaff) {
      if (isAssignedToMeA && !isAssignedToMeB) return -1;
      if (!isAssignedToMeA && isAssignedToMeB) return 1;

      // Unassigned department tickets follow (available to claim)
      if (isUnassignedA && !isUnassignedB) return -1;
      if (!isUnassignedA && isUnassignedB) return 1;
    }

    // Role C: Overall Admin -> Unassigned tasks before assigned
    if (!isDeptAdmin && !isDeptStaff) {
      if (isUnassignedA && !isUnassignedB) return -1;
      if (!isUnassignedA && isUnassignedB) return 1;
    }

    // Tier 3: Recency (Newest first)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

