import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Building } from "@/types/database";
import { Building2, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => {
    if (!user) return;

    async function fetchBuildings() {
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!supervisor) return;

      const { data } = await supabase
        .from("buildings")
        .select("id, name, address, supervisor_id, emails, created_at")
        .eq("supervisor_id", supervisor.id)
        .order("name");

      setBuildings((data as Building[]) ?? []);
    }

    fetchBuildings();
  }, [user]);

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-bold tracking-tight">Consorcia</h1>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              }`
            }
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </NavLink>

          <div className="pt-4 pb-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Edificios
          </div>

          {buildings.map((b) => (
            <NavLink
              key={b.id}
              to={`/buildings/${b.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent/50"
                }`
              }
            >
              <Building2 className="size-4 shrink-0" />
              <span className="truncate">{b.name}</span>
            </NavLink>
          ))}

          {buildings.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Sin edificios asignados
            </p>
          )}
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
