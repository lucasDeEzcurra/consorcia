import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
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

async function fetchRole(userId: string): Promise<UserRole | null> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) return null;
    return (data?.role as UserRole) ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false);
  // Tracks the latest onAuthStateChange call so stale fetchRole results
  // (from an earlier event) don't overwrite state set by a newer event.
  const authVersion = useRef(0);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      const thisVersion = ++authVersion.current;

      if (!newSession) {
        // No session — update immediately (no DB query needed)
        setSession(null);
        setRole(null);
        if (!initDone.current) {
          initDone.current = true;
          setLoading(false);
        }
        return;
      }

      // IMPORTANT: Defer fetchRole with setTimeout to avoid deadlocking
      // with Supabase's internal auth lock. The onAuthStateChange callback
      // runs inside a lock that's also needed by any supabase.from() query.
      // Calling fetchRole directly here would deadlock on TOKEN_REFRESHED
      // (when returning to a backgrounded tab).
      setTimeout(async () => {
        if (!mounted || authVersion.current !== thisVersion) return;
        const r = await fetchRole(newSession.user.id);
        if (!mounted || authVersion.current !== thisVersion) return;
        setSession(newSession);
        setRole(r);
        if (!initDone.current) {
          initDone.current = true;
          setLoading(false);
        }
      }, 0);
    });

    // Safety net: if onAuthStateChange never fires (e.g. token refresh hangs),
    // stop showing the loading spinner after 4 seconds.
    const timeout = setTimeout(() => {
      if (!initDone.current && mounted) {
        initDone.current = true;
        setLoading(false);
      }
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
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
