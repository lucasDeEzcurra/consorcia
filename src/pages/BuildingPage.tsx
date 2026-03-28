import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Job, Media, Report } from "@/types/database";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobDetailDialog } from "@/components/JobDetailDialog";
import { CreateJobForm } from "@/components/CreateJobForm";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 20;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function BuildingPage() {
  const { id } = useParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);

  // Jobs
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  // Reports
  const [reports, setReports] = useState<Report[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Emails
  const [newEmail, setNewEmail] = useState("");

  // Job detail dialog
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobMedia, setSelectedJobMedia] = useState<Media[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchBuilding = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("buildings")
      .select("*")
      .eq("id", id)
      .single();
    setBuilding(data as Building | null);
  }, [id]);

  const fetchPending = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("building_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingJobs((data as Job[]) ?? []);
  }, [id]);

  const fetchCompleted = useCallback(async () => {
    if (!id) return;
    const month = currentMonth();
    const monthStart = `${month}-01T00:00:00.000Z`;
    const [y, m] = month.split("-");
    const nextMonth = new Date(Number(y), Number(m), 1).toISOString();

    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("building_id", id)
      .eq("status", "completed")
      .gte("completed_at", monthStart)
      .lt("completed_at", nextMonth)
      .order("completed_at", { ascending: false });
    setCompletedJobs((data as Job[]) ?? []);
  }, [id]);

  const fetchHistory = useCallback(
    async (page: number) => {
      if (!id) return;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE;
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("building_id", id)
        .order("created_at", { ascending: false })
        .range(from, to);
      const rows = (data as Job[]) ?? [];
      setHistoryHasMore(rows.length > PAGE_SIZE);
      setHistoryJobs(rows.slice(0, PAGE_SIZE));
      setHistoryPage(page);
    },
    [id]
  );

  const fetchReports = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("building_id", id)
      .order("month", { ascending: false });
    setReports((data as Report[]) ?? []);
  }, [id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchBuilding(),
      fetchPending(),
      fetchCompleted(),
      fetchHistory(0),
      fetchReports(),
    ]);
    setLoading(false);
  }, [fetchBuilding, fetchPending, fetchCompleted, fetchHistory, fetchReports]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openJobDetail = async (job: Job) => {
    setSelectedJob(job);
    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at");
    setSelectedJobMedia((data as Media[]) ?? []);
    setDialogOpen(true);
  };

  const handleJobUpdated = () => {
    fetchPending();
    fetchCompleted();
    fetchHistory(historyPage);
    // Re-fetch selected job if still open
    if (selectedJob) {
      supabase
        .from("jobs")
        .select("*")
        .eq("id", selectedJob.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedJob(data as Job);
            supabase
              .from("media")
              .select("*")
              .eq("job_id", data.id)
              .order("created_at")
              .then(({ data: mediaData }) => {
                setSelectedJobMedia((mediaData as Media[]) ?? []);
              });
          } else {
            // Job was deleted
            setDialogOpen(false);
            setSelectedJob(null);
          }
        });
    }
  };

  // Email management
  const addEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!building || !newEmail.trim()) return;
    const updated = [...building.emails, newEmail.trim()];
    await supabase.from("buildings").update({ emails: updated }).eq("id", building.id);
    setBuilding({ ...building, emails: updated });
    setNewEmail("");
  };

  const removeEmail = async (email: string) => {
    if (!building) return;
    const updated = building.emails.filter((e) => e !== email);
    await supabase.from("buildings").update({ emails: updated }).eq("id", building.id);
    setBuilding({ ...building, emails: updated });
  };

  // Report generation
  const generateReport = async () => {
    if (!building) return;
    const month = currentMonth();

    // Check if report already exists
    const existing = reports.find((r) => r.month === month);
    if (existing) return;

    setGeneratingReport(true);

    // Get completed jobs for this month
    const monthStart = `${month}-01T00:00:00.000Z`;
    const [y, m] = month.split("-");
    const nextMonth = new Date(Number(y), Number(m), 1).toISOString();

    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("building_id", building.id)
      .eq("status", "completed")
      .gte("completed_at", monthStart)
      .lt("completed_at", nextMonth);

    const jobsList = (jobs as Job[]) ?? [];
    const summaryText = jobsList
      .map(
        (j) =>
          `- ${j.description_original} (completado: ${formatDate(j.completed_at!)})`
      )
      .join("\n");

    await supabase.from("reports").insert({
      building_id: building.id,
      month,
      status: "draft",
      generated_text: `Informe de Gestión Mensual\n${building.name}\n${formatMonthLabel(month)}\n\nTrabajos completados:\n${summaryText || "No hay trabajos completados este mes."}`,
    });

    setGeneratingReport(false);
    fetchReports();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!building) {
    return <p className="text-sm text-muted-foreground">Edificio no encontrado.</p>;
  }

  const month = currentMonth();
  const hasReportThisMonth = reports.some((r) => r.month === month);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{building.name}</h2>
          <p className="text-sm text-muted-foreground">{building.address}</p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">
            Pendientes
            {pendingJobs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                {pendingJobs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completados</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
          <TabsTrigger value="recipients">Destinatarios</TabsTrigger>
          <TabsTrigger value="generate">Generar Reporte</TabsTrigger>
        </TabsList>

        {/* Pending Jobs */}
        <TabsContent value="pending">
          <CreateJobForm
            buildingId={building.id}
            onCreated={() => {
              fetchPending();
              fetchHistory(historyPage);
            }}
          />
          <JobList
            jobs={pendingJobs}
            emptyMessage="No hay trabajos pendientes."
            onSelect={openJobDetail}
          />
        </TabsContent>

        {/* Completed Jobs (this month) */}
        <TabsContent value="completed">
          <p className="mb-3 text-xs text-muted-foreground">
            Completados en {formatMonthLabel(currentMonth())}
          </p>
          <JobList
            jobs={completedJobs}
            emptyMessage="No hay trabajos completados este mes."
            onSelect={openJobDetail}
            showCompletedDate
          />
        </TabsContent>

        {/* History (paginated) */}
        <TabsContent value="history">
          <JobList
            jobs={historyJobs}
            emptyMessage="No hay trabajos."
            onSelect={openJobDetail}
            showCompletedDate
            showStatus
          />
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={historyPage === 0}
              onClick={() => fetchHistory(historyPage - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {historyPage + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!historyHasMore}
              onClick={() => fetchHistory(historyPage + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports">
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay reportes generados.
            </p>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  to={`/buildings/${building.id}/report?month=${report.month}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatMonthLabel(report.month)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Creado: {formatDate(report.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={report.status === "sent" ? "default" : "outline"}
                  >
                    {report.status === "sent" ? "Enviado" : "Borrador"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recipients */}
        <TabsContent value="recipients">
          <div className="space-y-4">
            <form onSubmit={addEmail} className="flex gap-2">
              <Input
                type="email"
                placeholder="nuevo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <Button type="submit" size="sm">
                <Plus className="size-4" />
                Agregar
              </Button>
            </form>

            {building.emails.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay destinatarios configurados.
              </p>
            ) : (
              <div className="space-y-1">
                {building.emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      <span className="text-sm">{email}</span>
                    </div>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Generate Report */}
        <TabsContent value="generate">
          <div className="flex flex-col items-center gap-4 py-8">
            <FileText className="size-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">
                Reporte de {formatMonthLabel(currentMonth())}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {completedJobs.length} trabajo
                {completedJobs.length !== 1 ? "s" : ""} completado
                {completedJobs.length !== 1 ? "s" : ""} este mes
              </p>
            </div>

            {hasReportThisMonth ? (
              <div className="text-center">
                <Badge variant="outline">Ya generado</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Podés verlo en la pestaña Reportes
                </p>
              </div>
            ) : (
              <Button
                onClick={generateReport}
                disabled={generatingReport || completedJobs.length === 0}
              >
                {generatingReport ? "Generando..." : "Generar Reporte"}
              </Button>
            )}

            {completedJobs.length === 0 && !hasReportThisMonth && (
              <p className="text-xs text-muted-foreground">
                No hay trabajos completados para generar un reporte.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Detail Dialog */}
      <JobDetailDialog
        job={selectedJob}
        media={selectedJobMedia}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedJob(null);
        }}
        onUpdated={handleJobUpdated}
      />
    </div>
  );
}

/* ── Job List helper ── */
function JobList({
  jobs,
  emptyMessage,
  onSelect,
  showCompletedDate,
  showStatus,
}: {
  jobs: Job[];
  emptyMessage: string;
  onSelect: (job: Job) => void;
  showCompletedDate?: boolean;
  showStatus?: boolean;
}) {
  if (jobs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => onSelect(job)}
          className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {job.description_original}
            </p>
            <p className="text-xs text-muted-foreground">
              {showCompletedDate && job.completed_at
                ? `Completado: ${formatDate(job.completed_at)}`
                : `Creado: ${formatDate(job.created_at)}`}
            </p>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {job.expense_amount && (
              <Badge variant="secondary">${job.expense_amount}</Badge>
            )}
            {showStatus && (
              <Badge
                variant={job.status === "pending" ? "outline" : "default"}
              >
                {job.status === "pending" ? "Pendiente" : "Completado"}
              </Badge>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
