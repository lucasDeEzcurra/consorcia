import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function AuthGuard() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!session || !role) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
