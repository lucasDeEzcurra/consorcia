import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Building2, LayoutDashboard, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const { signOut } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-sidebar-accent/50"
    }`;

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-bold tracking-tight">Consorcia</h1>
          <p className="text-xs text-muted-foreground">Administración</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavLink to="/admin/dashboard" end className={linkClass}>
            <LayoutDashboard className="size-4" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/supervisors" className={linkClass}>
            <Users className="size-4" />
            Supervisores
          </NavLink>
          <NavLink to="/admin/buildings" className={linkClass}>
            <Building2 className="size-4" />
            Edificios
          </NavLink>
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
