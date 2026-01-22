"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lazy-initialized Supabase client (only created when actually used in browser)
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load has completed to avoid double fetching
  const initialLoadDone = useRef(false);

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data, error: fetchError } = await getSupabase()
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (fetchError) {
        console.error("Error fetching user profile:", fetchError);
        setError("Failed to load user profile");
        return null;
      }

      return data as User;
    } catch (err) {
      console.error("Error in fetchUserProfile:", err);
      setError("Failed to load user profile");
      return null;
    }
  }, []); // No dependencies - supabase is now a module-level constant

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await getSupabase().auth.getUser();

      if (authUser) {
        setSupabaseUser(authUser);
        const profile = await fetchUserProfile(authUser);
        setUser(profile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
    } catch (err) {
      console.error("Error refreshing user:", err);
      setError("Failed to refresh user");
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out");
    }
  }, []); // No dependencies - supabase is now a module-level constant

  useEffect(() => {
    // Only run initial load once
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    // Initial load
    refreshUser();

    // Listen for auth changes
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setSupabaseUser(session.user);
          const profile = await fetchUserProfile(session.user);
          setUser(profile);
          setIsLoading(false);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setSupabaseUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser, fetchUserProfile]); // These are now stable references

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    supabaseUser,
    isLoading,
    error,
    signOut,
    refreshUser,
  }), [user, supabaseUser, isLoading, error, signOut, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Convenience hook for just the user
export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

// Hook for checking user role
export function useUserRole() {
  const { user } = useAuth();
  return user?.role ?? null;
}
