import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Job, Media, Report, TenantRequest, RequestMedia, Tenant } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobDetailDialog } from "@/components/JobDetailDialog";
import { RequestDetailDialog } from "@/components/RequestDetailDialog";
import { CreateJobForm } from "@/components/CreateJobForm";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ClipboardList,
  CheckCircle2,
  Clock,
  Send,
  Users,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
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

type TabId = "pending" | "completed" | "history" | "reclamos" | "reports" | "recipients" | "generate";

const tabs: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
  { id: "pending", label: "Pendientes", icon: ClipboardList },
  { id: "completed", label: "Completados", icon: CheckCircle2 },
  { id: "reclamos", label: "Reclamos", icon: MessageCircle },
  { id: "history", label: "Historial", icon: Clock },
  { id: "reports", label: "Reportes", icon: FileText },
  { id: "recipients", label: "Destinatarios", icon: Users },
  { id: "generate", label: "Generar", icon: Send },
];

export function BuildingPage() {
  const { id } = useParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pending");

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

  // Reclamos
  const [requests, setRequests] = useState<(TenantRequest & { tenant_name?: string; tenant_unit?: string })[]>([]);

  // Request detail dialog
  const [selectedRequest, setSelectedRequest] = useState<TenantRequest | null>(null);
  const [selectedRequestMedia, setSelectedRequestMedia] = useState<RequestMedia[]>([]);
  const [selectedRequestTenant, setSelectedRequestTenant] = useState<Tenant | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

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

  const fetchRequests = useCallback(async () => {
    if (!id) return;
    // Fetch requests with tenant info
    const { data: reqData } = await supabase
      .from("tenant_requests")
      .select("*")
      .eq("building_id", id)
      .order("created_at", { ascending: false });

    const reqs = (reqData ?? []) as TenantRequest[];
    if (reqs.length === 0) {
      setRequests([]);
      return;
    }

    // Fetch tenant names
    const tenantIds = [...new Set(reqs.map((r) => r.tenant_id))];
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("id, name, unit")
      .in("id", tenantIds);
    const tenantMap = new Map((tenantData ?? []).map((t: { id: string; name: string; unit: string | null }) => [t.id, t]));

    setRequests(
      reqs.map((r) => {
        const t = tenantMap.get(r.tenant_id);
        return { ...r, tenant_name: t?.name, tenant_unit: t?.unit ?? undefined };
      })
    );
  }, [id]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBuilding(),
        fetchPending(),
        fetchCompleted(),
        fetchHistory(0),
        fetchReports(),
        fetchRequests(),
      ]);
    } catch (err) {
      console.error("Building page fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchBuilding, fetchPending, fetchCompleted, fetchHistory, fetchReports, fetchRequests]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openRequestDetail = async (req: TenantRequest) => {
    setSelectedRequest(req);
    const { data: mediaData } = await supabase
      .from("request_media")
      .select("*")
      .eq("request_id", req.id)
      .order("created_at");
    setSelectedRequestMedia((mediaData as RequestMedia[]) ?? []);
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", req.tenant_id)
      .single();
    setSelectedRequestTenant(tenantData as Tenant | null);
    setRequestDialogOpen(true);
  };

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
    const existing = reports.find((r) => r.month === month);
    if (existing) return;

    setGeneratingReport(true);

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
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-5 animate-spin text-amber-500" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">Edificio no encontrado.</p>
        <Link to="/dashboard" className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500">
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const month = currentMonth();
  const hasReportThisMonth = reports.some((r) => r.month === month);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl text-slate-900 sm:text-3xl" style={serif}>
            {building.name}
          </h1>
          <p className="text-sm text-slate-400">{building.address}</p>
        </div>
      </div>

      {/* Tab navigation - scrollable on mobile */}
      <div className="-mx-4 sm:mx-0">
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:flex-wrap sm:px-0 sm:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tab.id === "pending" ? pendingJobs.length : tab.id === "reclamos" ? requests.filter((r) => r.status === "pending" || r.status === "in_progress").length : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-amber-500 text-[#0b1120] shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-[#0b1120]/20 text-[#0b1120]"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {/* Pending Jobs */}
        {activeTab === "pending" && (
          <div>
            <CreateJobForm
              buildingId={building.id}
              onCreated={() => {
                fetchPending();
                fetchHistory(historyPage);
              }}
            />
            <JobList
              jobs={pendingJobs}
              emptyMessage="No hay trabajos pendientes"
              emptyDescription="Creá un nuevo trabajo usando el botón de arriba."
              emptyIcon={ClipboardList}
              onSelect={openJobDetail}
            />
          </div>
        )}

        {/* Completed Jobs (this month) */}
        {activeTab === "completed" && (
          <div>
            <p className="mb-4 text-xs text-slate-400">
              Completados en {formatMonthLabel(currentMonth())}
            </p>
            <JobList
              jobs={completedJobs}
              emptyMessage="No hay trabajos completados este mes"
              emptyDescription="Los trabajos completados aparecerán acá."
              emptyIcon={CheckCircle2}
              onSelect={openJobDetail}
              showCompletedDate
            />
          </div>
        )}

        {/* History (paginated) */}
        {activeTab === "history" && (
          <div>
            <JobList
              jobs={historyJobs}
              emptyMessage="No hay trabajos"
              emptyDescription="El historial de trabajos aparecerá acá."
              emptyIcon={Clock}
              onSelect={openJobDetail}
              showCompletedDate
              showStatus
            />
            {historyJobs.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage === 0}
                  onClick={() => fetchHistory(historyPage - 1)}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <span className="text-xs text-slate-400">
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
            )}
          </div>
        )}

        {/* Reclamos */}
        {activeTab === "reclamos" && (
          <div>
            {requests.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                message="No hay reclamos"
                description="Los reclamos de inquilinos por WhatsApp aparecerán acá."
              />
            ) : (
              <div className="space-y-2">
                {requests.map((req) => {
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-100 text-amber-800",
                    in_progress: "bg-blue-100 text-blue-800",
                    resolved: "bg-emerald-100 text-emerald-800",
                    rejected: "bg-red-100 text-red-800",
                  };
                  const statusLabels: Record<string, string> = {
                    pending: "Pendiente",
                    in_progress: "En progreso",
                    resolved: "Resuelto",
                    rejected: "Rechazado",
                  };
                  return (
                    <button
                      key={req.id}
                      onClick={() => openRequestDetail(req)}
                      className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          {req.tenant_name && (
                            <span className="text-xs font-medium text-amber-600">
                              {req.tenant_name}{req.tenant_unit ? ` (${req.tenant_unit})` : ""}
                            </span>
                          )}
                          {req.urgency === "urgente" && (
                            <AlertTriangle className="size-3 text-red-500" />
                          )}
                        </div>
                        <p className="truncate text-sm font-medium text-slate-800">
                          {req.description}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {req.category && `${req.category} · `}
                          {formatDate(req.created_at)}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[req.status] ?? ""}`}>
                          {statusLabels[req.status] ?? req.status}
                        </span>
                        <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reports */}
        {activeTab === "reports" && (
          <div>
            {reports.length === 0 ? (
              <EmptyState
                icon={FileText}
                message="No hay reportes generados"
                description="Generá un reporte desde la pestaña Generar."
              />
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    to={`/buildings/${building.id}/report?month=${report.month}`}
                    className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                        <FileText className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 capitalize">
                          {formatMonthLabel(report.month)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Creado: {formatDate(report.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={report.status === "sent" ? "default" : "outline"}
                      >
                        {report.status === "sent" ? "Enviado" : "Borrador"}
                      </Badge>
                      <ChevronRight className="size-4 text-slate-300" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recipients */}
        {activeTab === "recipients" && (
          <div className="space-y-4">
            <form onSubmit={addEmail} className="flex gap-2">
              <Input
                type="email"
                placeholder="nuevo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
              <Button type="submit" className="h-11 shrink-0 rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Agregar</span>
              </Button>
            </form>

            {building.emails.length === 0 ? (
              <EmptyState
                icon={Mail}
                message="No hay destinatarios"
                description="Agregá emails para enviar los reportes."
              />
            ) : (
              <div className="space-y-2">
                {building.emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100">
                        <Mail className="size-4 text-slate-400" />
                      </div>
                      <span className="text-sm text-slate-700">{email}</span>
                    </div>
                    <button
                      onClick={() => removeEmail(email)}
                      className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate Report */}
        {activeTab === "generate" && (
          <div className="flex flex-col items-center gap-5 rounded-xl border border-slate-100 bg-white py-12 px-6 shadow-sm">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50">
              <FileText className="size-8 text-amber-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-800" style={serif}>
                Reporte de {formatMonthLabel(currentMonth())}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {completedJobs.length} trabajo
                {completedJobs.length !== 1 ? "s" : ""} completado
                {completedJobs.length !== 1 ? "s" : ""} este mes
              </p>
            </div>

            {hasReportThisMonth ? (
              <div className="text-center">
                <Badge variant="outline" className="mb-2">Ya generado</Badge>
                <p className="text-xs text-slate-400">
                  Podés verlo en la pestaña Reportes.
                </p>
              </div>
            ) : (
              <Button
                onClick={generateReport}
                disabled={generatingReport || completedJobs.length === 0}
                className="h-11 rounded-xl bg-amber-500 px-6 text-[#0b1120] hover:bg-amber-400"
              >
                {generatingReport ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  "Generar Reporte"
                )}
              </Button>
            )}

            {completedJobs.length === 0 && !hasReportThisMonth && (
              <p className="text-xs text-slate-400">
                No hay trabajos completados para generar un reporte.
              </p>
            )}
          </div>
        )}
      </div>

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

      <RequestDetailDialog
        request={selectedRequest}
        media={selectedRequestMedia}
        tenant={selectedRequestTenant}
        open={requestDialogOpen}
        onClose={() => {
          setRequestDialogOpen(false);
          setSelectedRequest(null);
        }}
        onUpdated={() => {
          fetchRequests();
          fetchPending();
        }}
        buildingId={building.id}
      />
    </div>
  );
}

/* -- Empty state helper -- */
function EmptyState({
  icon: Icon,
  message,
  description,
}: {
  icon: typeof ClipboardList;
  message: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center">
      <Icon className="mx-auto size-10 text-slate-300" />
      <p className="mt-3 text-sm font-medium text-slate-500">{message}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

/* -- Job List helper -- */
function JobList({
  jobs,
  emptyMessage,
  emptyDescription,
  emptyIcon,
  onSelect,
  showCompletedDate,
  showStatus,
}: {
  jobs: Job[];
  emptyMessage: string;
  emptyDescription: string;
  emptyIcon: typeof ClipboardList;
  onSelect: (job: Job) => void;
  showCompletedDate?: boolean;
  showStatus?: boolean;
}) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        message={emptyMessage}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => onSelect(job)}
          className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {job.description_original}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
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
            <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
          </div>
        </button>
      ))}
    </div>
  );
}
