import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Supervisor } from "@/types/database";
import { Building2, ClipboardList, CheckCircle2, Users } from "lucide-react";

interface SupervisorWithCount extends Supervisor {
  building_count: number;
}

interface Metrics {
  totalSupervisors: number;
  totalBuildings: number;
  pendingJobs: number;
  completedThisMonth: number;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function AdminDashboardPage() {
  const [supervisors, setSupervisors] = useState<SupervisorWithCount[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalSupervisors: 0,
    totalBuildings: 0,
    pendingJobs: 0,
    completedThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [supRes, bldRes, pendingRes, completedRes] = await Promise.all([
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("buildings").select("id, supervisor_id"),
        supabase.from("jobs").select("id").eq("status", "pending"),
        (() => {
          const month = currentMonth();
          const start = `${month}-01T00:00:00.000Z`;
          const [y, m] = month.split("-");
          const end = new Date(Number(y), Number(m), 1).toISOString();
          return supabase
            .from("jobs")
            .select("id")
            .eq("status", "completed")
            .gte("completed_at", start)
            .lt("completed_at", end);
        })(),
      ]);

      const sups = (supRes.data ?? []) as Supervisor[];
      const buildings = (bldRes.data ?? []) as { id: string; supervisor_id: string | null }[];

      const countBySuper = new Map<string, number>();
      for (const b of buildings) {
        if (b.supervisor_id) {
          countBySuper.set(b.supervisor_id, (countBySuper.get(b.supervisor_id) ?? 0) + 1);
        }
      }

      setSupervisors(
        sups.map((s) => ({ ...s, building_count: countBySuper.get(s.id) ?? 0 }))
      );
      setMetrics({
        totalSupervisors: sups.length,
        totalBuildings: buildings.length,
        pendingJobs: pendingRes.data?.length ?? 0,
        completedThisMonth: completedRes.data?.length ?? 0,
      });
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const cards = [
    { label: "Supervisores", value: metrics.totalSupervisors, icon: Users },
    { label: "Edificios", value: metrics.totalBuildings, icon: Building2 },
    { label: "Trabajos pendientes", value: metrics.pendingJobs, icon: ClipboardList },
    { label: "Completados este mes", value: metrics.completedThisMonth, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista general de la administración.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <c.icon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Supervisores
        </h3>
        <div className="space-y-2">
          {supervisors.map((s) => (
            <Link
              key={s.id}
              to={`/admin/supervisors/${s.id}`}
              className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.phone_number}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {s.building_count} edificio{s.building_count !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
          {supervisors.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay supervisores creados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
