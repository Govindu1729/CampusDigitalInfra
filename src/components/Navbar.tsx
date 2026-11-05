"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Wrench,
  Search,
  Radar,
  Home,
  PhoneCall,
  User,
  LogOut,
  ShieldCheck,
  Shield,
  LogIn,
  ChevronDown,
  Sparkles,
  MessageCircle,
  Sun,
  Moon,
} from "lucide-react";
import { clearStoredTickets } from "@/lib/storage/ticketStorage";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleLevel: number;
  roleName?: string;
  departmentName?: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isDark, setIsDark] = useState(false);

  // Smart sticky navbar: hide on scroll down, show on scroll up
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let accumulatedUp = 0;
    let accumulatedDown = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show navbar at or near the top of the page
      if (currentScrollY <= 30) {
        setIsVisible(true);
        accumulatedUp = 0;
        accumulatedDown = 0;
        lastScrollY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY;

      if (diff > 0) {
        // User is scrolling DOWN
        accumulatedDown += diff;
        accumulatedUp = 0;

        // Hide navbar after scrolling down by at least 15px (past initial top section)
        if (accumulatedDown > 15 && currentScrollY > 80) {
          setIsVisible(false);
        }
      } else if (diff < 0) {
        // User is scrolling UP
        accumulatedUp += Math.abs(diff);
        accumulatedDown = 0;

        // Instantly reveal navbar as soon as upward movement exceeds 5px
        if (accumulatedUp > 5) {
          setIsVisible(true);
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ensure navbar is visible whenever user navigates between pages
  useEffect(() => {
    setIsVisible(true);
  }, [pathname]);

  const toggleTheme = () => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    if (isCurrentlyDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("iitgn-theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("iitgn-theme", "dark");
      setIsDark(true);
    }
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setLoadingUser(false));
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      clearStoredTickets();
      router.push("/login");
      router.refresh();
    } catch {
      clearStoredTickets();
      window.location.href = "/login";
    }
  }

  // Full-screen dedicated login and chat layouts - hide main navbar on /login and /chat/
  if (pathname === "/login" || pathname?.startsWith("/chat/")) {
    return null;
  }

  const isAdmin =
    currentUser &&
    (currentUser.roleCode === "OVERALL_ADMIN" ||
      currentUser.roleCode === "DEPT_ADMIN" ||
      currentUser.roleLevel === 1 ||
      currentUser.roleLevel === 2);

  const isTechnician =
    currentUser &&
    (currentUser.roleCode === "DEPT_STAFF" || currentUser.roleLevel === 3);

  const isUserOrGuest =
    !currentUser ||
    currentUser.roleCode === "PUBLIC" ||
    (!isAdmin && !isTechnician);

  // Determine current access badge properties
  const getAccessBadge = () => {
    if (loadingUser) {
      return {
        label: "Checking...",
        shortLabel: "Checking",
        sublabel: "Access Level",
        badgeClass: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
        dotClass: "bg-slate-400",
      };
    }
    if (!currentUser) {
      return {
        label: "Guest User",
        shortLabel: "Guest",
        sublabel: "Single Complaint Access",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/60",
        dotClass: "bg-amber-500",
      };
    }
    if (currentUser.roleCode === "OVERALL_ADMIN") {
      return {
        label: "Overall Admin",
        shortLabel: "Admin",
        sublabel: "Universal Institute Access",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-900/60",
        dotClass: "bg-indigo-600",
      };
    }
    if (currentUser.roleCode === "DEPT_ADMIN") {
      return {
        label: "Dept Admin",
        shortLabel: "Dept Admin",
        sublabel: currentUser.departmentName || "Department Admin",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-900/60",
        dotClass: "bg-blue-600",
      };
    }
    if (currentUser.roleCode === "DEPT_STAFF") {
      return {
        label: "Staff / Technician",
        shortLabel: "Technician",
        sublabel: currentUser.departmentName || "Field Staff",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-900/60",
        dotClass: "bg-emerald-600",
      };
    }
    if (currentUser.roleCode === "PUBLIC") {
      return {
        label: "Regular User",
        shortLabel: "Resident",
        sublabel: currentUser.departmentName || "Campus Resident",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-900/60",
        dotClass: "bg-emerald-600",
      };
    }
    return {
      label: "Authenticated User",
      shortLabel: "User",
      sublabel: "Full Interactive Access",
      badgeClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-900/60",
      dotClass: "bg-teal-600",
    };
  };

  const access = getAccessBadge();

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs transition-transform duration-300 ease-in-out w-full max-w-full overflow-x-clip ${isVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
      {/* Official Emergency Banner */}
      <div className="bg-slate-950 text-slate-300 text-xs py-1 px-3 sm:px-6 lg:px-8 border-b border-slate-800 w-full overflow-x-clip">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 truncate">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
              IITGN
            </span>
            <span className="hidden sm:inline text-slate-400 text-[11px] truncate">
              Institute Works Department • 24x7 Campus Infrastructure & Redressal
            </span>
            <span className="sm:hidden text-slate-400 text-[10px] truncate">
              Works Department 24x7
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs shrink-0">
            <a
              href="tel:+917923952000"
              className="flex items-center text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              <PhoneCall className="w-3 h-3 mr-1 shrink-0" />
              <span className="hidden md:inline mr-1 text-[11px] text-slate-300">Works Control:</span>
              <span className="text-[10px] sm:text-[11px] font-semibold">+91-79-2395-2000</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Bar matching sample institutional design */}
      <div className="max-w-[1600px] mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 w-full overflow-x-clip">
        {/* Left: Brand Identity + Role Badge (Hidden on mobile, visible on tablet / laptop and above) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-3 group shrink-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shadow-xs group-hover:border-indigo-400 transition-colors">
              <img src="/iitgn-logo.svg" alt="IITGN" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-base font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 transition-colors">
                Digital Infra <span className="hidden md:inline font-normal text-slate-400 dark:text-slate-500">Portal</span>
              </span>
              <span className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                IIT Gandhinagar
              </span>
            </div>
          </Link>

          {/* Role Badge (Hidden on mobile phones, shown on tablet, laptop and above) */}
          <div
            className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${access.badgeClass}`}
            title={`Active session role: ${access.sublabel}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${access.dotClass}`} />
            <span>{access.label}</span>
          </div>
        </div>

        {/* Right: Actions (Dispatch for Admin / Manage for Technician / Track for User) + Utilities + User Session */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Dispatch Link (Overall Admin & Dept Admin only) */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${pathname.startsWith("/admin")
                ? "bg-indigo-600 text-white shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent"
                }`}
              title="Staff Dispatch Operations"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:text-white" />
              <span className="text-xs font-semibold">Dispatch</span>
            </Link>
          )}

          {/* Manage Link (Technicians & Field Workers only) */}
          {isTechnician && (
            <Link
              href="/admin"
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${pathname.startsWith("/admin")
                ? "bg-indigo-600 text-white shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent"
                }`}
              title="Work Orders & Assigned Maintenance Tasks"
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold">Manage</span>
            </Link>
          )}

          {/* Track Link (Campus Residents & Guests only) */}
          {isUserOrGuest && (
            <Link
              href="/track"
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${pathname.startsWith("/track") || pathname.startsWith("/chat")
                ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 font-bold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent"
                }`}
              title="Track Complaint & Live Status"
            >
              <Radar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold">Track</span>
            </Link>
          )}

          {/* Theme Toggle Button (Light / Dark Mode) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-600" />
            )}
          </button>

          {/* Divider between tools and user profile */}
          <div className="h-4 sm:h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

          {/* Logged in User Profile vs Guest Sign-in */}
          {!loadingUser && currentUser ? (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <Link
                href="/profile"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-900 dark:bg-slate-700 hover:ring-2 hover:ring-indigo-500 text-white flex items-center justify-center text-[11px] font-bold shadow-xs shrink-0 transition-all cursor-pointer"
                title={`${currentUser.name} (${currentUser.email}) • View Profile & Contact Privacy Settings`}
              >
                {currentUser.name.charAt(0)}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of current account"
                className="p-1 sm:p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center gap-1 border shadow-2xs shrink-0 ${pathname === "/login"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 hover:bg-slate-800"
                }`}
              title="Sign In"
            >
              <LogIn className="w-3 h-3" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
    {/* Spacer so page content starts directly below fixed navbar */}
    <div className="h-[82px] sm:h-[90px] w-full shrink-0" aria-hidden="true" />
  </>
  );
}
