import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Building } from "@/types/database";
import {
  Building2,
  ClipboardList,
  CheckCircle2,
  FileText,
  ChevronRight,
  Loader2,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

interface BuildingWithPendingCount extends Building {
  pending_count: number;
}

interface Metrics {
  totalBuildings: number;
  pendingJobs: number;
  completedThisMonth: number;
  reportsThisMonth: number;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<BuildingWithPendingCount[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalBuildings: 0,
    pendingJobs: 0,
    completedThisMonth: 0,
    reportsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!supervisor) {
        setLoading(false);
        return;
      }

      const { data: buildingsData } = await supabase
        .from("buildings")
        .select("*")
        .eq("supervisor_id", supervisor.id)
        .order("name");

      const buildingsList = (buildingsData ?? []) as Building[];

      if (buildingsList.length === 0) {
        setLoading(false);
        return;
      }

      const buildingIds = buildingsList.map((b) => b.id);
      const month = currentMonth();
      const monthStart = `${month}-01T00:00:00.000Z`;
      const nextMonth = new Date(
        Number(month.split("-")[0]),
        Number(month.split("-")[1]),
        1
      ).toISOString();

      const [pendingRes, completedRes, reportsRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, building_id")
          .in("building_id", buildingIds)
          .eq("status", "pending"),
        supabase
          .from("jobs")
          .select("id")
          .in("building_id", buildingIds)
          .eq("status", "completed")
          .gte("completed_at", monthStart)
          .lt("completed_at", nextMonth),
        supabase
          .from("reports")
          .select("id")
          .in("building_id", buildingIds)
          .eq("month", month),
      ]);

      const pendingJobs = pendingRes.data ?? [];
      const completedJobs = completedRes.data ?? [];
      const reports = reportsRes.data ?? [];

      const pendingByBuilding = new Map<string, number>();
      for (const job of pendingJobs) {
        const prev = pendingByBuilding.get(job.building_id) ?? 0;
        pendingByBuilding.set(job.building_id, prev + 1);
      }

      const buildingsWithCount: BuildingWithPendingCount[] = buildingsList.map(
        (b) => ({
          ...b,
          pending_count: pendingByBuilding.get(b.id) ?? 0,
        })
      );

      setBuildings(buildingsWithCount);
      setMetrics({
        totalBuildings: buildingsList.length,
        pendingJobs: pendingJobs.length,
        completedThisMonth: completedJobs.length,
        reportsThisMonth: reports.length,
      });
      setLoading(false);
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-5 animate-spin text-amber-500" />
        <span className="text-sm text-slate-500">Cargando dashboard...</span>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Edificios asignados",
      value: metrics.totalBuildings,
      icon: Building2,
      color: "bg-amber-500",
      iconColor: "text-[#0b1120]",
    },
    {
      label: "Trabajos pendientes",
      value: metrics.pendingJobs,
      icon: ClipboardList,
      color: "bg-blue-500",
      iconColor: "text-white",
    },
    {
      label: "Completados este mes",
      value: metrics.completedThisMonth,
      icon: CheckCircle2,
      color: "bg-emerald-500",
      iconColor: "text-white",
    },
    {
      label: "Reportes este mes",
      value: metrics.reportsThisMonth,
      icon: FileText,
      color: "bg-violet-500",
      iconColor: "text-white",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl text-slate-900 sm:text-4xl" style={serif}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen general de tus edificios y trabajos.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
          >
            <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${card.color}`}>
              <card.icon className={`size-5 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Buildings list */}
      <div>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Tus edificios
        </h2>
        {buildings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <Building2 className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              No tenés edificios asignados
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Contactá a tu administrador para que te asigne edificios.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {buildings.map((building) => (
              <Link
                key={building.id}
                to={`/buildings/${building.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                    <Building2 className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{building.name}</p>
                    <p className="text-xs text-slate-400">{building.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {building.pending_count > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {building.pending_count} pendiente{building.pending_count !== 1 ? "s" : ""}
                    </span>
                  )}
                  <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
