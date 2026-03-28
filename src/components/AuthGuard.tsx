import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export function AuthGuard() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="size-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!session || !role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
