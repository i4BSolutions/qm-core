"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";

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
  const router = useRouter();

  const signOut = useCallback(async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {}
    clearSessionMarkers();
    setUser(null);
    setSupabaseUser(null);
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
