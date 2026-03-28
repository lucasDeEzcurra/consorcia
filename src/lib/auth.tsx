import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/database";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOADING_TIMEOUT_MS = 8000;

async function fetchRole(userId: string): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) {
      console.error("fetchRole error:", error.message);
      return null;
    }
    return (data?.role as UserRole) ?? null;
  } catch (err) {
    console.error("fetchRole exception:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety timeout — never stay in loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth loading timeout — forcing loaded state");
        setLoading(false);
      }
    }, LOADING_TIMEOUT_MS);

    async function init() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !initialSession?.user) {
          // No valid session — clear everything and stop loading
          setSession(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setSession(initialSession);

        const r = await fetchRole(initialSession.user.id);
        if (!mounted) return;

        if (r) {
          setRole(r);
        } else {
          // Session exists but no role in DB — stale session, sign out
          console.warn("Session exists but no role found — signing out");
          await supabase.auth.signOut();
          setSession(null);
          setRole(null);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        if (mounted) {
          setSession(null);
          setRole(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !newSession?.user) {
        setSession(null);
        setRole(null);
        return;
      }

      setSession(newSession);

      // Only re-fetch role on sign-in or token refresh, not on every event
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const r = await fetchRole(newSession.user.id);
        if (mounted) {
          setRole(r);
          if (!r && event === "SIGNED_IN") {
            console.warn("Signed in but no role — signing out");
            await supabase.auth.signOut();
          }
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setRole(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
