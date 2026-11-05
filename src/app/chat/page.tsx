import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import Link from "next/link";
import { MessageSquare, ArrowLeft, Wrench, Search, Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChatListPage({
  searchParams,
}: {
  searchParams?: { ticket?: string };
}) {
  if (searchParams?.ticket) {
    redirect(`/chat/${encodeURIComponent(searchParams.ticket.trim())}`);
  }

  const currentUser = await getCurrentUser();

  // If logged in, fetch tickets visible to this user
  let tickets: any[] = [];
  if (currentUser) {
    if (currentUser.roleLevel === 1) {
      // Overall Admin sees all active requests
      tickets = await prisma.maintenanceRequest.findMany({
        where: { status: { not: "CLOSED" } },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          department: true,
          assignedStaff: true,
          _count: { select: { followUps: true } },
        },
      });
    } else if (currentUser.departmentId) {
      // Staff / Dept Admin sees department tickets
      tickets = await prisma.maintenanceRequest.findMany({
        where: {
          departmentId: currentUser.departmentId,
          status: { not: "CLOSED" },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          department: true,
          assignedStaff: true,
          _count: { select: { followUps: true } },
        },
      });
    } else {
      // Regular user sees their own complaints
      tickets = await prisma.maintenanceRequest.findMany({
        where: { requesterEmail: currentUser.email.toLowerCase() },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          department: true,
          assignedStaff: true,
          _count: { select: { followUps: true } },
        },
      });
    }
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 flex flex-col justify-start items-center p-3 sm:p-6 transition-colors">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[600px]">
        {/* Header Bar */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors"
              title="Return Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>IITGN Maintenance Chat</span>
              </h1>
              <p className="text-[11px] text-slate-300 font-medium">
                {currentUser ? `Signed in as ${currentUser.name}` : "Open Access Ticket Chat"}
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>

        {/* Search or Quick Track */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
          <form action="/chat" method="GET" className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                name="ticket"
                placeholder="Enter Ticket ID (e.g. IITGN-2026-0008)..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                required
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              Open Chat
            </button>
          </form>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {tickets.length > 0 ? (
            tickets.map((t) => (
              <Link
                key={t.id}
                href={`/chat/${t.ticketNumber}`}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold shrink-0 shadow-2xs">
                    {t.assignedStaff?.name ? t.assignedStaff.name.charAt(0) : "W"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {t.ticketNumber}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          t.status === "RESOLVED"
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : t.status === "IN_PROGRESS"
                            ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate mt-0.5">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {t.assignedStaff?.name
                        ? `Technician: ${t.assignedStaff.name}`
                        : `Requester: ${t.requesterName}`}{" "}
                      • {t.locationDetail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {t._count?.followUps > 0 && (
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                      {t._count.followUps}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                </div>
              </Link>
            ))
          ) : (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                No active chat conversations found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Enter your Ticket ID above or open a ticket from your track page to chat directly with assigned technicians.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
