"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Hide footer on /login or full-screen chat to prevent viewport disruption
  if (pathname === "/login" || pathname?.startsWith("/chat/")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors">
      <div className="max-w-[1600px] mx-auto px-3.5 sm:px-6 py-3 sm:py-5 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-white dark:bg-slate-800 p-0.5 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
            <img src="/iitgn-logo.svg" alt="IITGN" className="h-full w-full object-contain opacity-90" />
          </div>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            © 2026 Indian Institute of Technology Gandhinagar
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2.5 text-slate-400 dark:text-slate-500 text-center sm:text-right leading-tight">
          <span className="hidden xs:inline">Campus Infrastructure Management Platform</span>
          <span className="xs:hidden">Digital Infra Platform</span>
          <span>•</span>
          <span className="text-slate-600 dark:text-slate-400 font-semibold">Institute Works Department</span>
        </div>
      </div>
    </footer>
  );
}
