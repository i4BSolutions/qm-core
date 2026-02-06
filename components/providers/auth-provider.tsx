"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Session timeout: 6 hours
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const ACTIVITY_KEY = "qm_last_activity";
const SESSION_KEY = "qm_session_active";

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function shouldClearSession(): { clear: boolean; reason: string | null } {
  try {
    const hasActivity = !!localStorage.getItem(ACTIVITY_KEY);
    const hasMarker = sessionStorage.getItem(SESSION_KEY) === "1";

    if (hasActivity && !hasMarker) {
      return { clear: true, reason: "tab_closed" };
    }

    const activity = localStorage.getItem(ACTIVITY_KEY);
    if (activity) {
      const elapsed = Date.now() - parseInt(activity, 10);
      if (elapsed > SESSION_TIMEOUT_MS) {
        return { clear: true, reason: "timeout" };
      }
    }

    return { clear: false, reason: null };
  } catch {
    return { clear: false, reason: null };
  }
}

function setSessionMarkers() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  } catch {}
}

function clearSessionMarkers() {
  try {
    localStorage.removeItem(ACTIVITY_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = useState(false);
  const router = useRouter();

  const signOut = useCallback(async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {}
    clearSessionMarkers();
    setUser(null);
    setSupabaseUser(null);

    // Broadcast to other tabs
    try {
      const channel = new BroadcastChannel('qm-auth');
      channel.postMessage({ type: 'SIGNED_OUT' });
      channel.close();
    } catch {
      // BroadcastChannel not supported - graceful degradation
    }

    router.push("/login");
  }, [router]);

  // Main initialization
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Fetch profile with the same supabase instance
    const fetchProfile = async (userId: string): Promise<User | null> => {
      console.log("Auth: Fetching profile for:", userId);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        console.log("Auth: Profile query done, data:", !!data, "error:", error?.message);

        if (error) {
          console.error("Auth: Profile error:", error.message, error.code);
          return null;
        }
        return data as User || null;
      } catch (err) {
        console.error("Auth: Profile exception:", err);
        return null;
      }
    };

    const init = async () => {
      console.log("Auth: Init starting...");

      // Check clear conditions
      const { clear, reason } = shouldClearSession();
      if (clear) {
        console.log("Auth: Clearing session:", reason);
        await supabase.auth.signOut();
        clearSessionMarkers();
        if (!cancelled) {
          setIsLoading(false);
          window.location.href = "/login";
        }
        return;
      }

      // Get session
      console.log("Auth: Getting session...");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("Auth: getSession done:", !!session, sessionError?.message);

      if (cancelled) {
        console.log("Auth: Cancelled after getSession");
        return;
      }

      if (!session || sessionError) {
        console.log("Auth: No valid session");
        setUser(null);
        setSupabaseUser(null);
        setIsLoading(false);
        return;
      }

      // Have session - set state immediately
      console.log("Auth: Session found for:", session.user.email);
      setSessionMarkers();
      setSupabaseUser(session.user);

      // Fetch profile
      const profile = await fetchProfile(session.user.id);

      if (cancelled) {
        console.log("Auth: Cancelled after profile");
        return;
      }

      console.log("Auth: Setting user:", profile?.email);
      setUser(profile);
      setIsLoading(false);
      console.log("Auth: Init complete");
    };

    init();

    // Listen for runtime auth changes (login/logout after page load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth: Event:", event, "cancelled:", cancelled);

        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          console.log("Auth: Handling SIGNED_OUT");
          clearSessionMarkers();
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          console.log("Auth: Token refreshed");
          setSupabaseUser(session.user);
          try {
            localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
          } catch {}
        }
        // Don't handle SIGNED_IN or INITIAL_SESSION here - init() handles it
      }
    );

    return () => {
      console.log("Auth: Cleanup, setting cancelled=true");
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Check for unsaved work in sessionStorage
  const checkForUnsavedWork = (): boolean => {
    try {
      return !!(
        sessionStorage.getItem('qmhq_draft') ||
        sessionStorage.getItem('qmhq_route_data') ||
        sessionStorage.getItem('po_draft')
      );
    } catch {
      return false;
    }
  };

  // Activity tracking
  useEffect(() => {
    if (!supabaseUser) return;

    const updateActivity = () => {
      try {
        localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      } catch {}
    };

    const checkTimeout = () => {
      try {
        const activity = localStorage.getItem(ACTIVITY_KEY);
        if (activity) {
          const elapsed = Date.now() - parseInt(activity, 10);
          if (elapsed > SESSION_TIMEOUT_MS) {
            signOut();
          }
        }
      } catch {}
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));
    const interval = setInterval(checkTimeout, 60000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [supabaseUser, signOut]);

  // Tab visibility handling - refresh session when tab becomes active
  useEffect(() => {
    if (!supabaseUser) return;

    let isRefreshing = false; // Prevent re-entrancy

    const handleVisibilityChange = async () => {
      // Only act when tab becomes visible
      if (document.visibilityState !== 'visible') return;
      if (isRefreshing) return;

      isRefreshing = true;

      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // Session invalid - check for unsaved work
          const hasUnsavedWork = checkForUnsavedWork();

          if (hasUnsavedWork) {
            setShowSessionExpiredModal(true);
          } else {
            await signOut();
          }
        } else {
          // Session valid - update activity marker
          try {
            localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
          } catch {}
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        isRefreshing = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseUser, signOut]);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setSupabaseUser(session.user);
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setUser(profile as User || null);
      try {
        localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      } catch {}
    } else {
      setUser(null);
      setSupabaseUser(null);
    }
    setIsLoading(false);
  }, []);

  // Cross-tab logout sync via BroadcastChannel
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel('qm-auth');

      channel.onmessage = (event) => {
        if (event.data.type === 'SIGNED_OUT') {
          // Another tab signed out - sync this tab
          clearSessionMarkers();
          setUser(null);
          setSupabaseUser(null);
          router.push('/login');
        } else if (event.data.type === 'SIGNED_IN') {
          // Another tab signed in - refresh user data
          refreshUser();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported (Safari) - graceful degradation
      console.log('BroadcastChannel not available for cross-tab sync');
    }

    return () => {
      try {
        channel?.close();
      } catch {}
    };
  }, [router, refreshUser]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    supabaseUser,
    isLoading,
    error,
    signOut,
    refreshUser,
  }), [user, supabaseUser, isLoading, error, signOut, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Session expired modal */}
      <Dialog open={showSessionExpiredModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Session Expired</DialogTitle>
            <DialogDescription>
              Your session has expired. You have unsaved changes that will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                // Clear draft data and sign out
                try {
                  sessionStorage.removeItem('qmhq_draft');
                  sessionStorage.removeItem('qmhq_route_data');
                  sessionStorage.removeItem('po_draft');
                } catch {}
                setShowSessionExpiredModal(false);
                signOut();
              }}
            >
              Discard & Login
            </Button>
            <Button
              onClick={() => setShowSessionExpiredModal(false)}
            >
              Stay on Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

export function useUserRole() {
  const { user } = useAuth();
  return user?.role ?? null;
}
