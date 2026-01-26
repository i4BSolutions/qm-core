"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data, error: fetchError } = await supabase
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
  }, [supabase]);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

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
  }, [supabase, fetchUserProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out");
    }
  }, [supabase]);

  useEffect(() => {
    // Initial load
    refreshUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
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
  }, [supabase, refreshUser, fetchUserProfile]);

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

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

export function useUserRole() {
  const { user } = useAuth();
  return user?.role ?? null;
}
