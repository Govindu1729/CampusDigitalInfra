"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  Loader2,
  Clock,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Archive,
  History,
  LogIn,
  PlusCircle,
  MessageCircle,
} from "lucide-react";
import {
  getStoredTickets,
  getTicketTokenFromStorage,
  saveTicketToStorage,
  removeTicketFromStorage,
  StoredTicket,
} from "@/lib/storage/ticketStorage";

function getStatusBadge(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60";
    case "ACKNOWLEDGED":
      return "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60";
    case "ASSIGNED":
      return "bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/60";
    case "IN_PROGRESS":
      return "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60";
    case "RESOLVED":
      return "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60";
    case "CLOSED":
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    case "REOPENED":
      return "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }
}

function TrackLookupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  // Guest / Unauthenticated Lookup State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [emailQuery, setEmailQuery] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedTickets, setSavedTickets] = useState<StoredTicket[]>([]);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Logged-in Requests
  const [myActiveRequests, setMyActiveRequests] = useState<any[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);

  // On-demand Previous / History state (NOT pre-fetched on initial load to protect secondary DB)
  const [myHistoryRequests, setMyHistoryRequests] = useState<any[]>([]);
  const [hasFetchedHistory, setHasFetchedHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [searchFilter, setSearchFilter] = useState("");

  // Check session and load active complaints on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
          // Fetch ONLY active complaints on initial load (does NOT touch secondary DB)
          setLoadingActive(true);
          fetch("/api/requests/my?type=active")
            .then((res) => res.json())
            .then((reqData) => {
              if (reqData.success) {
                setMyActiveRequests(reqData.activeRequests || []);
              }
            })
            .catch(() => { })
            .finally(() => setLoadingActive(false));
        } else {
          setCurrentUser(null);
          setSavedTickets(getStoredTickets());
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setSavedTickets(getStoredTickets());
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, []);

  // On-demand fetch for Previous / History when user clicks the button
  const handleSelectHistoryTab = () => {
    setActiveTab("HISTORY");
    if (!hasFetchedHistory) {
      setLoadingHistory(true);
      fetch("/api/requests/my?type=history")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMyHistoryRequests(data.historyRequests || []);
            setHasFetchedHistory(true);
          }
        })
        .catch(() => { })
        .finally(() => setLoadingHistory(false));
    }
  };

  // Auto trigger lookup if initialQuery is a ticketNumber (e.g. IITGN-)
  useEffect(() => {
    if (initialQuery.trim().toUpperCase().startsWith("IITGN-")) {
      const cleanId = initialQuery.trim().toUpperCase();
      const storedToken = getTicketTokenFromStorage(cleanId);
      if (storedToken) {
        router.push(`/track/${cleanId}?token=${storedToken}`);
      } else {
        router.push(`/track/${cleanId}`);
      }
    } else if (initialQuery.includes("@")) {
      setEmailQuery(initialQuery);
    }
  }, [initialQuery, router]);

  const handleTicketLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const cleanId = searchQuery.trim().toUpperCase();
    const storedToken = getTicketTokenFromStorage(cleanId);
    if (storedToken) {
      router.push(`/track/${cleanId}?token=${storedToken}`);
    } else {
      router.push(`/track/${cleanId}`);
    }
  };

  const handleRemoveSaved = (ticketNumber: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeTicketFromStorage(ticketNumber);
    setSavedTickets(getStoredTickets());
  };

  const handleEmailSearch = async () => {
    const targetEmail = emailQuery.trim();
    const targetPhone = phoneQuery.trim();
    if (!targetEmail || !targetPhone) {
      setErrorMsg("To protect privacy, please provide both your registered email and 10-digit mobile number.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/requests?email=${encodeURIComponent(targetEmail)}&phone=${encodeURIComponent(targetPhone)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to find requests for this email & phone combination.");
      }
      setSearchResults(data.requests);

      if (!currentUser && Array.isArray(data.requests) && data.requests.length > 0) {
        data.requests.forEach((req: any) => {
          if (req.ticketNumber && req.trackingToken) {
            saveTicketToStorage({
              ticketNumber: req.ticketNumber,
              token: req.trackingToken,
              subject: req.subject,
              category: req.category,
              domain: req.domain,
              departmentName: req.department?.name,
              locationDetail: req.locationDetail,
              status: req.status,
              createdAt: req.createdAt,
            });
          }
        });
        setSavedTickets(getStoredTickets());
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error searching requests.");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter requests based on search term
  const displayedRequests = (
    activeTab === "ACTIVE" ? myActiveRequests : myHistoryRequests
  ).filter((req) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      req.ticketNumber.toLowerCase().includes(q) ||
      (req.subject && req.subject.toLowerCase().includes(q)) ||
      (req.domain && req.domain.toLowerCase().includes(q)) ||
      (req.departmentName && req.departmentName.toLowerCase().includes(q)) ||
      (req.locationDetail && req.locationDetail.toLowerCase().includes(q))
    );
  });

  const isCurrentTabLoading =
    activeTab === "ACTIVE" ? loadingActive : loadingHistory;

  if (loadingSession) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading tracking dashboard...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: LOGGED-IN USERS (Direct Active & Previous / History with IDENTICAL Layout)
  // =========================================================================
  if (currentUser) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Top Header */}
        <div className="text-center space-y-3">
          {/* <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span>{currentUser.roleName || currentUser.roleCode}</span>
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {currentUser.email}
            </span>
          </div> */}

          <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            My Maintenance Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            View the progress of your ongoing complaints and on-demand records from the campus works department.
          </p>
        </div>

        {/* Primary Controls: Active Requests & Previous / History */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            {/* 2 Main Action Buttons - SAME UNIFIED DESIGN FOR BOTH */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab("ACTIVE")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "ACTIVE"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <Clock className="w-4 h-4" />
                <span>Active Requests</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeTab === "ACTIVE"
                      ? "bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                >
                  {myActiveRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSelectHistoryTab}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeTab === "HISTORY"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                <History className="w-4 h-4" />
                <span>Previous / History</span>
                {hasFetchedHistory && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${activeTab === "HISTORY"
                        ? "bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    {myHistoryRequests.length}
                  </span>
                )}
                {loadingHistory && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                )}
              </button>
            </div>

            {/* Quick Action to Report New Request */}
            <Link
              href="/requests/new"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report New Issue</span>
            </Link>
          </div>

          {/* Search Filter Bar within user's complaints */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search complaints by ticket, domain, or location..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Requests List - EXACT SAME LAYOUT FOR BOTH ACTIVE AND HISTORY */}
        {isCurrentTabLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <Loader2 className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {activeTab === "ACTIVE"
                ? "Loading active complaints..."
                : "Retrieving previous history from secondary archival database..."}
            </p>
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 sm:p-14 text-center border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/60 shadow-xs">
              {activeTab === "ACTIVE" ? (
                <CheckCircle2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              ) : (
                <Archive className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {activeTab === "ACTIVE"
                  ? "No Active Maintenance Requests"
                  : "No Previous History Records Found"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                {activeTab === "ACTIVE"
                  ? "You have no active or in-progress maintenance requests at this time."
                  : "There are no transferred records in the secondary archival database for this account."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {activeTab === "ACTIVE" && (
                <button
                  type="button"
                  onClick={handleSelectHistoryTab}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  View Previous / History
                </button>
              )}
              <Link
                href="/requests/new"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                File a Complaint
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRequests.map((req) => (
              <div
                key={req.id || req.ticketNumber}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  {/* Top Badge Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                      {req.ticketNumber}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                        req.status
                      )}`}
                    >
                      {req.status}
                    </span>

                    {/* Disclaimer badge when closed complaint is within the 3-day active reopen cooldown window in primary DB */}
                    {req.status === "CLOSED" && !req.isArchived && activeTab === "ACTIVE" && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 shadow-2xs">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Reopen Window Active</span>
                      </span>
                    )}

                    {/* Secondary Archival Storage badge when transferred out of primary DB */}
                    {req.isArchived && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center gap-1 shadow-2xs">
                        <Archive className="w-3 h-3 text-slate-500" />
                        <span>Secondary Storage (Archived)</span>
                      </span>
                    )}

                    {req.isUrgent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                        URGENT
                      </span>
                    )}
                  </div>

                  {/* Subject Line */}
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">
                    {req.subject}
                  </h3>

                  {/* Meta Information: Department • Location • Submission Date */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {req.departmentName || req.domain}
                    </span>
                    <span>•</span>
                    <span>{req.locationDetail}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Submitted {new Date(req.createdAt).toLocaleDateString()}</span>
                    </span>
                    {req.status === "CLOSED" && !req.isArchived && activeTab === "ACTIVE" && (
                      <>
                        <span>•</span>
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          3-Day Grace Window to Reopen
                        </span>
                      </>
                    )}
                    {req.isArchived && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          Archived in Secondary DB
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="shrink-0 flex items-center justify-end gap-2">
                  <Link
                    href={`/chat/${req.ticketNumber}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white font-bold text-xs transition-all border border-indigo-200 dark:border-indigo-900/60 shadow-2xs group cursor-pointer"
                    title={req.isArchived ? "View Historical Chat Log" : "Open Full Chat with Maintenance Staff"}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                    <span>{req.isArchived ? "Chat Log" : "Chat"}</span>
                  </Link>
                  <Link
                    href={`/track/${req.ticketNumber}${req.trackingToken ? `?token=${req.trackingToken}` : ""
                      }`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/70 hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-white dark:hover:text-white font-bold text-xs transition-all border border-blue-200 dark:border-blue-900/60 cursor-pointer group shadow-2xs"
                  >
                    <span>
                      {req.isArchived
                        ? "View Archived Details"
                        : req.status === "CLOSED"
                          ? "Track / Reopen"
                          : "Track Details"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: GUEST / UNREGISTERED USERS (Option 1 & Option 2 Manual Lookups)
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
      <div className="text-center space-y-2.5 sm:space-y-3">
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 px-2.5 py-0.5 sm:py-1 rounded-full border border-indigo-200 dark:border-indigo-900/60">
            Track & Live Chat
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 text-[10px] sm:text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span>Complaint Status & Technician Chat</span>
          </span>
        </div>
        <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Track Complaint & Chat with Staff
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          Monitor real-time repair progress, check technician assignment, or chat directly with assigned technicians.
        </p>

        {/* Suggestion to Sign In for 1-Click Access */}
        <div className="pt-1">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold bg-blue-50 dark:bg-blue-950/50 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-blue-200 dark:border-blue-900/50 text-center"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Have an IITGN Account? Sign In to view your complete active & past history without typing numbers</span>
            <span className="sm:hidden">Have an IITGN Account? Sign In for 1-Click History</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1-Click Access: Saved Complaints on This Device (Guest fallback) */}
      {savedTickets.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-100 dark:border-indigo-900/60">
                {savedTickets.length}
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Your Filed Complaints (Saved on this Device)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  1-click direct tracking with verified privacy tokens.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/60 flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
              Verified on Device
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {savedTickets.map((ticket) => (
              <Link
                key={ticket.ticketNumber}
                href={`/track/${ticket.ticketNumber}?token=${ticket.token}`}
                className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 transition-all flex flex-col justify-between space-y-3 bg-slate-50/50 dark:bg-slate-800/60"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                      {ticket.ticketNumber}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {ticket.status && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          {ticket.status}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveSaved(ticket.ticketNumber, e)}
                        title="Remove from this device's history"
                        className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 dark:text-white mt-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {ticket.subject}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {ticket.departmentName || ticket.category} • {ticket.locationDetail}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/chat/${ticket.ticketNumber}`);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center group-hover:translate-x-0.5 transition-transform">
                      <span>Track</span>
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dual Search Options for Guest Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: By Ticket Number */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Option 1: By Ticket Number</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Enter your ticket number received during submission (e.g. IITGN-2026-0001).
            </p>

            <form onSubmit={handleTicketLookup} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  placeholder="e.g. IITGN-2026-0001"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm font-mono px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Track Status</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery.trim()) {
                      router.push(`/chat/${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Open Chat</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Method 2: By Requester Email + Phone (Dual-Factor Verification) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Option 2: Verified Resident Lookup</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
                🔒 Privacy Protected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              To prevent unauthorized snooping, finding your requests requires both your registered email and 10-digit mobile number.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEmailSearch();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. resident@iitgn.ac.in"
                  value={emailQuery}
                  onChange={(e) => setEmailQuery(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Registered 10-Digit Mobile</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value.replace(/\D/g, ""))}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center disabled:opacity-60 cursor-pointer"
              >
                <span>{isLoading ? "Verifying..." : "Verify & Find My Complaints"}</span>
                <Search className="w-3.5 h-3.5 ml-2" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Results for Email Lookup */}
      {searchResults !== null && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 text-slate-900 dark:text-white">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Requests registered to {emailQuery} ({searchResults.length})
          </h3>

          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              No maintenance requests found matching this email.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((req) => (
                <div
                  key={req.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 p-2 rounded-xl transition-colors"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {req.ticketNumber}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {req.status}
                      </span>
                      {req.isUrgent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                          URGENT
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mt-1">{req.subject}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {req.department?.name} • {req.locationDetail}
                    </p>
                  </div>

                  <Link
                    href={`/track/${req.ticketNumber}?token=${req.trackingToken}`}
                    className="shrink-0 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    <span>View Status</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading tracker...</p>
        </div>
      }
    >
      <TrackLookupContent />
    </Suspense>
  );
}
