import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Supervisor } from "@/types/database";
import {
  Building2,
  ClipboardList,
  CheckCircle2,
  Users,
  ChevronRight,
  Loader2,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

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
      try {
        const [supRes, bldRes, pendingRes, completedRes] = await Promise.all([
          supabase.from("supervisors").select("*").order("name"),
          supabase.from("buildings").select("id, supervisor_id"),
          supabase.from("jobs").select("id").eq("status", "pending"),
          (() => {
            const month = currentMonth();
            const start = `${month}-01T00:00:00.000Z`;
            const [y, m] = month.split("-");
            const end = new Date(Number(y), Number(m), 1).toISOString();
            return supabase.from("jobs").select("id").eq("status", "completed").gte("completed_at", start).lt("completed_at", end);
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

        setSupervisors(sups.map((s) => ({ ...s, building_count: countBySuper.get(s.id) ?? 0 })));
        setMetrics({
          totalSupervisors: sups.length,
          totalBuildings: buildings.length,
          pendingJobs: pendingRes.data?.length ?? 0,
          completedThisMonth: completedRes.data?.length ?? 0,
        });
      } catch (err) {
        console.error("Admin dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-5 animate-spin text-amber-500" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    );
  }

  const cards = [
    { label: "Supervisores", value: metrics.totalSupervisors, icon: Users, color: "bg-amber-500", iconColor: "text-[#0b1120]" },
    { label: "Edificios", value: metrics.totalBuildings, icon: Building2, color: "bg-blue-500", iconColor: "text-white" },
    { label: "Trabajos pendientes", value: metrics.pendingJobs, icon: ClipboardList, color: "bg-rose-500", iconColor: "text-white" },
    { label: "Completados este mes", value: metrics.completedThisMonth, icon: CheckCircle2, color: "bg-emerald-500", iconColor: "text-white" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-slate-900 sm:text-4xl" style={serif}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vista general de la administración.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
            <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${c.color}`}>
              <c.icon className={`size-5 ${c.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{c.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Supervisores
        </h2>
        <div className="space-y-2">
          {supervisors.map((s) => (
            <Link
              key={s.id}
              to={`/admin/supervisors/${s.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                  <Users className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {s.building_count} edificio{s.building_count !== 1 ? "s" : ""}
                </span>
                <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
              </div>
            </Link>
          ))}
          {supervisors.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
              <Users className="mx-auto size-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                No hay supervisores creados
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Creá un supervisor desde la sección Supervisores.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
