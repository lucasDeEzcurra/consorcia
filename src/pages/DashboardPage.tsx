import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Building } from "@/types/database";
import { Building2, ClipboardList, CheckCircle2, FileText } from "lucide-react";

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
      // Get supervisor row for this user
      const { data: supervisor } = await supabase
        .from("supervisors")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!supervisor) {
        setLoading(false);
        return;
      }

      // Fetch buildings
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

      // Fetch all jobs for these buildings in parallel with reports
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

      // Count pending per building
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
      <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
    );
  }

  const metricCards = [
    {
      label: "Edificios asignados",
      value: metrics.totalBuildings,
      icon: Building2,
    },
    {
      label: "Trabajos pendientes",
      value: metrics.pendingJobs,
      icon: ClipboardList,
    },
    {
      label: "Completados este mes",
      value: metrics.completedThisMonth,
      icon: CheckCircle2,
    },
    {
      label: "Reportes este mes",
      value: metrics.reportsThisMonth,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen general de edificios y trabajos.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <card.icon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buildings list */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Edificios
        </h3>
        {buildings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenés edificios asignados.
          </p>
        ) : (
          <div className="space-y-2">
            {buildings.map((building) => (
              <Link
                key={building.id}
                to={`/buildings/${building.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{building.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {building.address}
                    </p>
                  </div>
                </div>
                {building.pending_count > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {building.pending_count} pendiente
                    {building.pending_count !== 1 ? "s" : ""}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
