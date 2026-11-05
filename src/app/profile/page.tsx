"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowLeft,
  Radar,
  Save,
  HelpCircle,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  defaultSharePhone: boolean;
  roleCode: string;
  roleName: string;
  departmentId?: string | null;
  departmentName?: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [sharePhoneToggle, setSharePhoneToggle] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.profile) {
          setProfile(data.profile);
          setNameInput(data.profile.name || "");
          setPhoneInput(data.profile.phone || "");
          setSharePhoneToggle(data.profile.defaultSharePhone ?? true);
        } else {
          setErrorMsg(data.error || "Please sign in to view your profile.");
        }
      })
      .catch(() => {
        setErrorMsg("Failed to load profile. Please check your network connection.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameInput,
          phone: phoneInput,
          defaultSharePhone: sharePhoneToggle,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update profile.");
      }

      setProfile(data.profile);
      setSuccessMsg("Contact information and privacy preferences saved successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading institutional profile...</p>
      </div>
    );
  }

  if (errorMsg && !profile) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900/40">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Authentication Required</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{errorMsg}</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all"
        >
          Sign In with IITGN Account
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/track"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Requests</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
          UID: {profile?.id.slice(-8).toUpperCase()}
        </span>
      </div>

      {/* Header Profile Identity Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/60 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white text-xl font-black shadow-md">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {profile?.name}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {profile?.roleName}
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5 flex items-center gap-1.5 font-mono">
                <Mail className="w-3.5 h-3.5" />
                <span>{profile?.email}</span>
              </p>
            </div>
          </div>

          <Link
            href="/track"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 backdrop-blur-xs transition-all shadow-xs"
          >
            <Radar className="w-3.5 h-3.5 text-indigo-300" />
            <span>Track Requests</span>
          </Link>
        </div>

        {profile?.departmentName && (
          <div className="flex items-center gap-2 pt-2 border-t border-indigo-800/40 text-xs text-slate-300">
            <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Assigned Department: <strong>{profile.departmentName}</strong></span>
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Edit Profile & Privacy Preferences Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Contact Details & Privacy Consent</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Institutional email is the primary contact. Phone number is optional and protected under campus data policies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Full Name:
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              placeholder="Your full name"
            />
          </div>

          {/* Institutional Email (Read-Only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Primary Institutional Email:</span>
              <span className="text-[10px] text-slate-400 font-normal">Primary • Verified</span>
            </label>
            <div className="relative">
              <input
                type="email"
                disabled
                value={profile?.email || ""}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium cursor-not-allowed select-all"
              />
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Optional Phone Number */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Contact Phone (Optional):</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Non-mandatory
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              +91
            </span>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="e.g. 9876543210 (Leave blank if you prefer email & chat only)"
              className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Used by technicians for urgent location coordination on arrival. If not provided, staff will coordinate via official in-app chat and email.
          </p>
        </div>

        {/* Resident Phone Sharing Consent Toggle */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                Allow Technicians to Call for Work Orders
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                When enabled, assigned technicians can see a direct call button if your phone number is present. When disabled, technicians will only have access to your institutional email and live chat.
              </p>
            </div>

            {/* Accessible Switch Toggle */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={sharePhoneToggle}
                onChange={(e) => setSharePhoneToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              You can also toggle phone sharing individually on each maintenance ticket at any time.
            </span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? "Saving..." : "Save Preferences"}</span>
          </button>
        </div>
      </form>

      {/* Institutional Privacy Guarantee Card */}
      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>IITGN Institute Works Department • Privacy Commitment</span>
        </div>
        <p className="leading-relaxed text-[11px]">
          Personal telephone numbers are never published publicly. If you choose not to share your telephone number, staff are required to communicate via the built-in Complaint Redressal Chat and institutional email.
        </p>
      </div>
    </div>
  );
}
