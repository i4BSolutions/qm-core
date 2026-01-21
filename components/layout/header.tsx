"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Search, Bell, User, LogOut, Settings, ChevronDown, Radio, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui";

// Format role for display
function formatRole(role: string): string {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 lg:px-6">
      {/* Subtle scan line */}
      <div className="absolute inset-0 scan-overlay opacity-20 pointer-events-none" />

      {/* Search */}
      <div className="relative flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search requests, orders, items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "h-10 w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-10 pr-4",
              "text-sm text-slate-200 placeholder:text-slate-600 font-mono",
              "transition-all duration-200",
              "focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            )}
          />
        </div>

        {/* System status indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800">
          <Radio className="h-3 w-3 text-amber-500 animate-pulse" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">ACTIVE</span>
        </div>
      </div>

      {/* Right side */}
      <div className="relative flex items-center gap-2">
        {/* Notifications */}
        <button
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-lg",
            "text-slate-500 transition-all duration-200",
            "hover:bg-slate-800 hover:text-amber-400"
          )}
        >
          <Bell className="h-5 w-5" />
          {/* Notification badge */}
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        </button>

        {/* Profile dropdown */}
        <div className="relative">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full bg-slate-800" />
              <div className="hidden lg:block">
                <Skeleton className="h-4 w-24 bg-slate-800" />
                <Skeleton className="mt-1 h-3 w-16 bg-slate-800" />
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2",
                "text-sm transition-all duration-200",
                "hover:bg-slate-800",
                isProfileOpen && "bg-slate-800"
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 text-white font-semibold text-sm border border-amber-500/30">
                {user ? getInitials(user.full_name) : <User className="h-4 w-4" />}
              </div>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium text-slate-200">
                  {user?.full_name ?? "Guest"}
                </p>
                <p className="text-xs text-amber-500/70 font-mono uppercase">
                  {user?.role ? formatRole(user.role) : "Not signed in"}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform duration-200",
                  isProfileOpen && "rotate-180"
                )}
              />
            </button>
          )}

          {/* Dropdown menu */}
          {isProfileOpen && user && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              {/* Menu */}
              <div className="absolute right-0 z-50 mt-2 w-64 animate-slide-up rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-xl shadow-black/50">
                <div className="border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 text-white font-semibold border border-amber-500/30">
                      {getInitials(user.full_name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Shield className="h-3 w-3 text-amber-500" />
                    <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                      {formatRole(user.role)}
                    </span>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-sm",
                      "text-slate-300 transition-all duration-200",
                      "hover:bg-slate-800 hover:text-amber-400"
                    )}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-sm",
                      "text-slate-300 transition-all duration-200",
                      "hover:bg-slate-800 hover:text-amber-400"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
                <div className="border-t border-slate-800 py-1">
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-sm",
                      "text-red-400 transition-all duration-200",
                      "hover:bg-red-500/10"
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
