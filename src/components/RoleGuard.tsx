import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/types/database";

export function RoleGuard({ allowed }: { allowed: UserRole }) {
  const { role, loading } = useAuth();

  if (loading) return null;

  if (role !== allowed) {
    const redirect = role === "admin" ? "/admin/dashboard" : "/dashboard";
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
}
