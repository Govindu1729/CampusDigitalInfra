"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Info,
  Send,
  Camera,
  X,
  Check,
  CheckCheck,
  RotateCcw,
  Clock,
  Wrench,
  User,
  ShieldCheck,
  MapPin,
  Calendar,
  Eye,
  ChevronRight,
  AlertCircle,
  ArrowDown,
  Sun,
  Moon,
  Loader2,
  ArrowUpRight,
  Pen,
} from "lucide-react";
import ImageLightboxModal from "@/components/ImageLightboxModal";

export default function DedicatedChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketNumber = (params?.ticketNumber as string) || "";
  const tokenFromUrl = searchParams.get("token") || "";

  const [request, setRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [messageText, setMessageText] = useState("");
  const [attachedPhotos, setAttachedPhotos] = useState<
    Array<{ name: string; size: number; type: string; url: string }>
  >([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  // Lightbox Image Gallery state (Full view with zoom, pan, drawing & back-button support)
  const [lightboxGallery, setLightboxGallery] = useState<{
    images: { url: string; name: string }[];
    initialIndex: number;
  } | null>(null);
  const [annotatingChatPhotoIdx, setAnnotatingChatPhotoIdx] = useState<number | null>(null);

  const openLightbox = (images: { url: string; name: string }[], initialIndex: number = 0) => {
    setLightboxGallery({ images, initialIndex });
  };

  // Unread tracker for Large Chat
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatCanvasRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolled = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Active quick reply and optimistic sending message
  const [activeQuickReply, setActiveQuickReply] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<{
    id: string;
    text: string;
    images: Array<{ url: string; name: string }>;
    createdAt: string;
  } | null>(null);

  // Dark mode toggle
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

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

  // Parse custom [ATTACHMENT_IMG:url|name] tags
  const parseCommentContent = (content: string) => {
    const imgRegex = /\[ATTACHMENT_IMG:([^|]+)\|([^\]]*)\]/g;
    const images: { url: string; name: string }[] = [];
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      images.push({
        url: match[1],
        name: decodeURIComponent(match[2] || "Photo Attachment"),
      });
    }
    const cleanText = content.replace(imgRegex, "").trim();
    return { cleanText, images };
  };

  // Fetch ticket details
  const fetchTicketDetails = async (isBackground = false) => {
    if (!ticketNumber) return;
    try {
      const tokenParam = tokenFromUrl ? `token=${encodeURIComponent(tokenFromUrl)}` : "";
      const res = await fetch(`/api/requests/${encodeURIComponent(ticketNumber)}?staffView=true&${tokenParam}`);
      const data = await res.json();
      if (data.success && data.request) {
        setRequest(data.request);
      } else if (!isBackground) {
        setErrorMsg(data.error || "Unable to open chat for this ticket.");
      }
    } catch (e: any) {
      if (!isBackground) setErrorMsg("Connection error. Please try again.");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Load user session and ticket details
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    fetchTicketDetails();

    // Auto-poll for new messages every 4 seconds (Live chat sync)
    const interval = setInterval(() => {
      fetchTicketDetails(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [ticketNumber, tokenFromUrl]);

  // Track unread messages from counterparty in Large Chat & Scroll ONCE on initial load
  useEffect(() => {
    if (!request?.followUps || request.followUps.length === 0) return;

    const storageKey = `last_read_large_chat_${ticketNumber}_${currentUser?.roleCode || "resident"}`;
    const lastRead = Number(localStorage.getItem(storageKey) || 0);

    const isStaffOrAdmin =
      currentUser &&
      (currentUser.roleCode === "OVERALL_ADMIN" ||
        currentUser.roleCode === "DEPT_ADMIN" ||
        currentUser.roleCode === "DEPT_STAFF");

    const unread = request.followUps.find((msg: any) => {
      const msgTime = new Date(msg.createdAt).getTime();
      const isFromCounterparty = isStaffOrAdmin
        ? msg.authorRole === "requester"
        : msg.authorRole !== "requester";
      return msgTime > lastRead && isFromCounterparty;
    });

    if (unread) {
      setFirstUnreadId(unread.id);
    }

    // Scroll automatically ONLY on first initial load - never on background refresh or timers
    if (!hasInitialScrolled.current) {
      if (unread) {
        setTimeout(() => {
          unreadDividerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 250);
      } else {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 250);
      }
      hasInitialScrolled.current = true;
    }
  }, [request?.followUps, ticketNumber, currentUser]);

  // Mark as read after 4 seconds of viewing without triggering auto-scroll
  useEffect(() => {
    if (!ticketNumber) return;
    const storageKey = `last_read_large_chat_${ticketNumber}_${currentUser?.roleCode || "resident"}`;
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, String(Date.now()));
    }, 4000);
    return () => clearTimeout(timer);
  }, [ticketNumber, currentUser]);

  // Track scroll position to toggle the Jump to Bottom button
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
  };

  // Determine counterparty contact for Live Chat header
  const isStaffView =
    currentUser &&
    (currentUser.roleCode === "OVERALL_ADMIN" ||
      currentUser.roleCode === "DEPT_ADMIN" ||
      currentUser.roleCode === "DEPT_STAFF");

  const contactInfo = useMemo(() => {
    if (!request) {
      return {
        name: "IITGN Maintenance Desk",
        role: "Works Control Room",
        phone: "+91-79-2395-2000",
        avatarLetter: "W",
      };
    }

    if (isStaffView) {
      // Staff is looking at resident
      return {
        name: request.requesterName || "Campus Resident",
        role: request.locationCategory || "Resident",
        phone: request.requesterPhone,
        avatarLetter: (request.requesterName || "R").charAt(0).toUpperCase(),
      };
    }

    // Resident is looking at assigned technician
    if (request.assignedStaff) {
      return {
        name: request.assignedStaff.name,
        role: `${request.department?.name || "Maintenance"} Field Technician`,
        phone: request.assignedStaff.phone || "+91-79-2395-2000",
        avatarLetter: request.assignedStaff.name.charAt(0).toUpperCase(),
      };
    }

    return {
      name: `${request.department?.name || "Works"} Support Desk`,
      role: "Assigned Engineering Team",
      phone: "+91-79-2395-2000",
      avatarLetter: "I",
    };
  }, [request, isStaffView]);

  // Handle Photo Attachment
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!currentUser) {
      alert("Photos are not allowed for guest users. Please sign in with your IITGN account to attach photos.");
      return;
    }

    if (attachedPhotos.length + files.length > 3) {
      alert("Maximum 3 photos per message.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select images (JPG, PNG, WebP) only.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert("File size exceeds 8MB limit.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        setAttachedPhotos((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            url: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  // Direct reply from photo lightbox modal
  const handleDirectReplyFromChatPhoto = async (
    annotatedPhoto: { url: string; name: string },
    replyText?: string
  ) => {
    if (!request) return;
    const text = (replyText && replyText.trim()) || "Annotated photo attached pointing out issue.";
    const photoObj = {
      name: annotatedPhoto.name,
      size: 60000,
      type: "image/png",
      url: annotatedPhoto.url,
    };

    const res = await fetch(`/api/requests/${request.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        token: tokenFromUrl || request.trackingToken,
        attachments: [photoObj],
      }),
    });
    const data = await res.json();
    if (data.success) {
      fetchChat();
    } else {
      throw new Error(data.error || "Failed to send message with photo");
    }
  };

  // Send Message with instant responsive feedback & optimistic bubble
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || messageText).trim();
    if (!text && attachedPhotos.length === 0) return;
    if (!request || isSending) return;

    if (textToSend) {
      setActiveQuickReply(textToSend);
    }
    setIsSending(true);
    setErrorMsg(null);

    const savedText = messageText;
    const savedPhotos = [...attachedPhotos];

    // Clear inputs immediately to eliminate input lag
    setMessageText("");
    setAttachedPhotos([]);

    // Optimistic message bubble so UI never appears stuck
    setOptimisticMessage({
      id: `temp-${Date.now()}`,
      text,
      images: savedPhotos.map((p) => ({ url: p.url, name: p.name })),
      createdAt: new Date().toISOString(),
    });

    // Smooth scroll down to optimistic message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    try {
      const res = await fetch(`/api/requests/${request.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          token: tokenFromUrl || request.trackingToken,
          attachments: savedPhotos,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send message.");
      }

      await fetchTicketDetails(true);
      setOptimisticMessage(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send message.");
      // Rollback on failure so user doesn't lose text
      setMessageText(savedText);
      setAttachedPhotos(savedPhotos);
      setOptimisticMessage(null);
    } finally {
      setIsSending(false);
      setActiveQuickReply(null);
    }
  };

  // Quick reply chips
  const quickReplies = isStaffView
    ? [
        "I am on my way to your room 🚶‍♂️",
        "Can I visit in 10 minutes? ⏱️",
        "Parts collected, arriving shortly 🔧",
        "Work completed, please verify ✅",
      ]
    : [
        "When can you visit? 🕒",
        "I am currently in the room 👍",
        "The issue has worsened ⚠️",
        "Thank you, all fixed! ✅",
      ];

  if (loading) {
    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Loading conversation thread...</p>
      </div>
    );
  }

  if (errorMsg && !request) {
    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Conversation Unavailable</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">{errorMsg}</p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Go Back
            </button>
            <Link
              href="/track"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
            >
              Track Ticket
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 w-full h-[100dvh] flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden">
      <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full bg-white dark:bg-slate-900 shadow-xl border-x border-slate-200 dark:border-slate-800 overflow-hidden relative transition-colors">
        {/* Sticky Top Header Section (Title, Location, Actions & Status) */}
        <div className="sticky top-0 z-30 shrink-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Clean Institutional Top Header Bar */}
          <header className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (isStaffView) router.push("/admin");
                  else router.push(`/track/${request?.ticketNumber || ""}`);
                }}
                className="p-1.5 -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Avatar with Status Pulse */}
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm shadow-xs">
                  {contactInfo.avatarLetter}
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 absolute -bottom-0.5 -right-0.5 animate-pulse" />
              </div>

              {/* Contact & Ticket Details */}
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold truncate leading-tight flex items-center gap-1.5 text-slate-900 dark:text-white">
                  <span>{contactInfo.name}</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{request?.ticketNumber}</span> •{" "}
                  {request?.locationDetail}
                </p>
              </div>
            </div>

            {/* Action Buttons: Phone, Theme & Details */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              {contactInfo.phone && (
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                  title={`Call ${contactInfo.name} (${contactInfo.phone})`}
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}

              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Toggle Theme"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              <button
                type="button"
                onClick={() => setShowDetailsDrawer(!showDetailsDrawer)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  showDetailsDrawer
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
                title="Ticket Details"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Ticket Status Bar (Minimal Theme) */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-4 py-1.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2 truncate">
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
              <span className="truncate">
                Fault: <strong className="text-slate-900 dark:text-white">{request?.subject}</strong> ({request?.department?.name})
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ml-2 ${
                request?.status === "RESOLVED" || request?.status === "CLOSED"
                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : request?.status === "IN_PROGRESS"
                  ? "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {request?.status}
            </span>
          </div>
        </div>

        {/* Chat Messages Canvas (Clean Minimal Background) */}
        <div
          ref={chatCanvasRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3.5 chat-canvas-bg overscroll-contain"
        >
        {/* Ticket Registration Pill */}
        <div className="flex justify-center my-2">
          <div className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 text-center max-w-sm">
            <span className="font-bold text-slate-800 dark:text-slate-200">Complaint #{request?.ticketNumber} Registered</span>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {new Date(request?.createdAt).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              • Recorded via IITGN Works Portal
            </span>
          </div>
        </div>

        {/* Initial Problem Card */}
        <div className="flex justify-start">
          <div className="bg-white dark:bg-slate-900 rounded-2xl rounded-tl-xs p-3.5 shadow-xs border border-slate-200 dark:border-slate-800 max-w-[85%] sm:max-w-[70%] space-y-1.5">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block">
              {request?.requesterName} (Original Complaint)
            </span>
            <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {request?.description || request?.subject}
            </p>
            {request?.attachments && request?.attachments.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {request.attachments.map((att: any) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() =>
                      openLightbox(
                        request.attachments.map((a: any) => ({
                          url: a.url,
                          name: a.originalName || "Evidence Photo",
                        })),
                        request.attachments.indexOf(att)
                      )
                    }
                    className="relative aspect-4/3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group cursor-pointer"
                  >
                    <img src={att.url} alt={att.originalName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white drop-shadow" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end text-[9px] text-slate-400 dark:text-slate-500 gap-1 pt-0.5">
              <span>{new Date(request?.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>

        {/* Follow-up Message Bubbles */}
        {request?.followUps &&
          request.followUps.map((msg: any) => {
            const isMe = currentUser
              ? (currentUser.roleCode === "OVERALL_ADMIN" ||
                  currentUser.roleCode === "DEPT_ADMIN" ||
                  currentUser.roleCode === "DEPT_STAFF")
                ? msg.authorRole === "staff" || msg.authorRole === "admin"
                : msg.authorRole === "requester" || msg.authorRole === "resident"
              : msg.authorRole === "requester";

            const { cleanText, images } = parseCommentContent(msg.message);

            return (
              <div key={msg.id} className="space-y-2">
                {/* Unread Messages Separator */}
                {firstUnreadId === msg.id && (
                  <div ref={unreadDividerRef} className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-indigo-400 dark:border-indigo-600" />
                    </div>
                    <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-md uppercase tracking-wider animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>New Messages Below</span>
                    </div>
                  </div>
                )}

                <div
                  className={`flex ${isMe ? "justify-end" : "justify-start"} transition-all`}
                >
                  <div
                    className={`relative p-3 rounded-2xl shadow-xs max-w-[85%] sm:max-w-[70%] space-y-1.5 ${
                      isMe
                        ? "bg-indigo-600 text-white rounded-tr-xs border border-indigo-500"
                        : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Author Name for Counterparty */}
                    {!isMe && (
                      <span
                        className={`text-[11px] font-bold block ${
                          msg.authorRole === "staff"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : msg.authorRole === "admin"
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {msg.authorName} ({msg.authorRole === "staff" ? "Technician" : msg.authorRole})
                      </span>
                    )}

                    {/* Clean Message Text */}
                    {cleanText && (
                      <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-medium ${
                        isMe ? "text-white" : "text-slate-800 dark:text-slate-200"
                      }`}>
                        {cleanText}
                      </p>
                    )}

                    {/* Embedded Photos */}
                    {images.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {images.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openLightbox(images, i)}
                            className="relative aspect-4/3 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 group cursor-pointer bg-slate-950"
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp & Ticks */}
                    <div className={`flex items-center justify-end text-[9px] gap-1 pt-0.5 ${
                      isMe ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"
                    }`}>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-indigo-200 inline" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        {/* Optimistic Message Bubble (Active Sending Feedback) */}
        {optimisticMessage && (
          <div className="flex justify-end transition-all animate-in fade-in duration-150">
            <div className="relative p-3 rounded-2xl shadow-xs max-w-[85%] sm:max-w-[70%] space-y-1.5 bg-indigo-600/90 text-white rounded-tr-xs border border-indigo-400/80">
              {optimisticMessage.text && (
                <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap font-medium text-white">
                  {optimisticMessage.text}
                </p>
              )}
              {optimisticMessage.images.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {optimisticMessage.images.map((img: any, i: number) => (
                    <div key={i} className="relative aspect-4/3 rounded-lg overflow-hidden border border-white/20 bg-black/20">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end text-[9px] gap-1.5 pt-0.5 text-indigo-200">
                <span>Sending...</span>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Floating Jump to New Messages / Jump to Bottom Pill */}
        {firstUnreadId ? (
          <button
            type="button"
            onClick={() => {
              unreadDividerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              setFirstUnreadId(null);
            }}
            className="sticky bottom-2 mx-auto left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer animate-bounce"
          >
            <span>Jump to new messages</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        ) : !isAtBottom ? (
          <button
            type="button"
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="sticky bottom-2 mx-auto left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Jump to bottom</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Sticky Bottom Typer & Input Section */}
      <div className="sticky bottom-0 z-30 shrink-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-md">
        {/* Quick Reply Chips (Minimal Theme with Active Loading State) */}
        <div className="bg-slate-50 dark:bg-slate-900/90 px-3 py-1.5 overflow-x-auto scrollbar-none flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Quick:
          </span>
          {quickReplies.map((qr, idx) => {
            const isThisSending = isSending && activeQuickReply === qr;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qr)}
                disabled={isSending}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all shrink-0 shadow-2xs flex items-center gap-1.5 ${
                  isThisSending
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs cursor-wait"
                    : isSending
                    ? "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                    : "bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                }`}
              >
                {isThisSending && <Loader2 className="w-3 h-3 animate-spin shrink-0 text-white" />}
                <span>{qr}</span>
              </button>
            );
          })}
        </div>

        {/* Photo Preview Pills (Before Sending) */}
        {attachedPhotos.length > 0 && (
          <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto">
            {attachedPhotos.map((photo, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 w-16 h-16 shrink-0 bg-white dark:bg-slate-900 shadow-2xs"
              >
                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachedPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-rose-600 rounded-full text-white cursor-pointer z-10"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setAnnotatingChatPhotoIdx(i)}
                  className="absolute bottom-0 inset-x-0 py-0.5 bg-slate-900/90 hover:bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs z-10 transition-colors"
                  title="Edit or draw markings on this photo"
                >
                  <Pen className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Edit</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sticky Bottom Input Bar (Typer) */}
        <footer className="p-2.5 sm:p-3 pb-safe bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Photo Upload Attachment Button - Only for logged-in users, strictly disabled for guests */}
            {currentUser ? (
              <label
                className="p-2 sm:p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
                title="Attach Photos (Max 3)"
              >
                <Camera className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div
                className="p-2 sm:p-2.5 rounded-xl text-slate-300 dark:text-slate-600 flex items-center justify-center shrink-0 cursor-not-allowed"
                title="Guest Mode: Photo attachments are disabled (Sign in with IITGN account to attach photos)"
              >
                <Camera className="w-5 h-5 opacity-40" />
              </div>
            )}

            {/* Text Input */}
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message or note..."
              className="flex-1 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 sm:py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs font-medium"
            />

            {/* Send Button with Active Spinner Loader */}
            <button
              type="submit"
              disabled={isSending || (!messageText.trim() && attachedPhotos.length === 0)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer"
              title={isSending ? "Sending..." : "Send Message"}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />
              )}
            </button>
          </form>
        </footer>
      </div>

      {/* SLIDE-OVER TICKET DETAILS DRAWER */}
      {showDetailsDrawer && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-40 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="bg-slate-900 dark:bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <h3 className="font-bold text-sm">Complaint Details</h3>
            <button
              onClick={() => setShowDetailsDrawer(false)}
              className="p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket ID</span>
              <p className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">{request?.ticketNumber}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Category & Domain</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {request?.department?.name} • {request?.domain}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{request?.locationDetail}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Resident Availability</span>
              <p className="font-medium text-slate-700 dark:text-slate-300">{request?.availability || "Working Hours"}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Staff</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {request?.assignedStaff ? (
                  <span>{request.assignedStaff.name} ({request.assignedStaff.phone || "No phone"})</span>
                ) : (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                href={`/track/${request?.ticketNumber}?token=${request?.trackingToken}`}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Open Full Tracking Portal</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL WITH ZOOM, PAN, ANNOTATION, DIRECT REPLY & BACK-BUTTON SUPPORT */}
      {lightboxGallery && (
        <ImageLightboxModal
          images={lightboxGallery.images}
          initialIndex={lightboxGallery.initialIndex}
          onClose={() => setLightboxGallery(null)}
          onDirectReply={handleDirectReplyFromChatPhoto}
        />
      )}

      {/* Modal for annotating attached photos before sending in chat */}
      {annotatingChatPhotoIdx !== null && attachedPhotos[annotatingChatPhotoIdx] && (
        <ImageLightboxModal
          images={[
            {
              url: attachedPhotos[annotatingChatPhotoIdx].url,
              name: attachedPhotos[annotatingChatPhotoIdx].name || "Chat Photo",
            },
          ]}
          startInDrawMode={true}
          onClose={() => setAnnotatingChatPhotoIdx(null)}
          onSaveAnnotation={(annotatedUrl) => {
            setAttachedPhotos((prev) =>
              prev.map((item, idx) =>
                idx === annotatingChatPhotoIdx ? { ...item, url: annotatedUrl } : item
              )
            );
            setAnnotatingChatPhotoIdx(null);
          }}
        />
      )}
    </div>
  </div>
  );
}
