import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Supervisor, Job, Report, Media, TenantRequest, RequestMedia, Tenant } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JobDetailDialog } from "@/components/JobDetailDialog";
import { RequestDetailDialog } from "@/components/RequestDetailDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { uploadEntityPhoto } from "@/lib/storage";
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  FileText,
  ChevronRight,
  MessageCircle,
  Users,
  Plus,
  Phone,
  ImagePlus,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

function normalizeTelegramId(p: string): string {
  return p.trim().replace(/[^0-9]/g, "");
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", {
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

export function AdminBuildingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [building, setBuilding] = useState<Building | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [saving, setSaving] = useState(false);

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantUnit, setTenantUnit] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  // Requests / Reclamos
  const [requests, setRequests] = useState<(TenantRequest & { tenant_name?: string })[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<TenantRequest | null>(null);
  const [selectedRequestMedia, setSelectedRequestMedia] = useState<RequestMedia[]>([]);
  const [selectedRequestTenant, setSelectedRequestTenant] = useState<Tenant | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // Job detail dialog
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobMedia, setSelectedJobMedia] = useState<Media[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [bldRes, supRes, jobRes, repRes, tenantRes, reqRes] = await Promise.all([
        supabase.from("buildings").select("*").eq("id", id).single(),
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("jobs").select("*").eq("building_id", id).order("created_at", { ascending: false }).limit(20),
        supabase.from("reports").select("*").eq("building_id", id).order("month", { ascending: false }),
        supabase.from("tenants").select("*").eq("building_id", id).order("name"),
        supabase.from("tenant_requests").select("*").eq("building_id", id).order("created_at", { ascending: false }),
      ]);

      const bld = bldRes.data as Building | null;
      setBuilding(bld);
      if (bld) {
        setName(bld.name);
        setAddress(bld.address);
        setSupervisorId(bld.supervisor_id ?? "");
        setLogoUrl(bld.logo_url);
      }
      setSupervisors((supRes.data ?? []) as Supervisor[]);
      setJobs((jobRes.data ?? []) as Job[]);
      setReports((repRes.data ?? []) as Report[]);

      const tenantsList = (tenantRes.data ?? []) as Tenant[];
      setTenants(tenantsList);
      const tenantMap = new Map(tenantsList.map((t) => [t.id, t.name]));
      const reqs = (reqRes.data ?? []) as TenantRequest[];
      setRequests(reqs.map((r) => ({ ...r, tenant_name: tenantMap.get(r.tenant_id) })));
    } catch (err) {
      console.error("Fetch building detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setCreatingTenant(true);
    setTenantError(null);

    const { error } = await supabase.from("tenants").insert({
      building_id: id,
      name: tenantName.trim(),
      phone_number: normalizeTelegramId(tenantPhone),
      unit: tenantUnit.trim() || null,
    });

    if (error) {
      setTenantError(error.message.includes("duplicate") ? "Ese número de teléfono ya está registrado." : error.message);
      setCreatingTenant(false);
      return;
    }

    setTenantDialogOpen(false);
    setTenantName("");
    setTenantPhone("");
    setTenantUnit("");
    setCreatingTenant(false);
    fetchData();
  };

  const deleteTenant = async (tenantId: string) => {
    await supabase.from("tenants").delete().eq("id", tenantId);
    fetchData();
  };

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

  const handleLogoUpload = async (file: File) => {
    if (!id) return;
    setUploadingLogo(true);
    const url = await uploadEntityPhoto("buildings", id, file);
    if (url) {
      await supabase.from("buildings").update({ logo_url: url }).eq("id", id);
      setLogoUrl(url);
    }
    setUploadingLogo(false);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    await supabase
      .from("buildings")
      .update({
        name: name.trim(),
        address: address.trim(),
        supervisor_id: supervisorId || null,
      })
      .eq("id", id);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    await supabase.from("media").delete().in(
      "job_id",
      jobs.map((j) => j.id)
    );
    await supabase.from("jobs").delete().eq("building_id", id);
    await supabase.from("reports").delete().eq("building_id", id);
    await supabase.from("buildings").delete().eq("id", id);
    setDeleting(false);
    window.location.href = "/admin/buildings";
  };

  // Job detail
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
    fetchData();
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
        <Link to="/admin/buildings" className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500">
          Volver a edificios
        </Link>
      </div>
    );
  }

  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/buildings"
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

      {/* Edit form */}
      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Datos del edificio</p>

        {/* Logo upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Foto del edificio</label>
          <div className="flex items-center gap-3">
            <label className="group relative flex h-20 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:border-amber-400">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-6 text-slate-300" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingLogo ? (
                  <Loader2 className="size-5 animate-spin text-white" />
                ) : (
                  <ImagePlus className="size-5 text-white" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[11px] text-slate-400">Aparece en el encabezado de los reportes</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Dirección</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Supervisor asignado</label>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-all focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="">Sin asignar</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={saving} className="rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="size-4" />
              Guardar cambios
            </>
          )}
        </Button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pendientes", value: pendingCount, icon: ClipboardList, color: "bg-amber-500" },
          { label: "Completados", value: completedCount, icon: CheckCircle2, color: "bg-emerald-500" },
          { label: "Reportes", value: reports.length, icon: FileText, color: "bg-violet-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className={`mb-2 inline-flex size-8 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="size-4 text-white" />
            </div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent jobs - clickable */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Últimos trabajos
        </h2>
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <ClipboardList className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">Sin trabajos.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => openJobDetail(j)}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{j.description_original}</p>
                  <p className="text-xs text-slate-400">
                    {j.completed_at ? `Completado: ${formatDate(j.completed_at)}` : `Creado: ${formatDate(j.created_at)}`}
                  </p>
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {j.expense_amount && (
                    <Badge variant="secondary">${j.expense_amount}</Badge>
                  )}
                  <Badge variant={j.status === "pending" ? "outline" : "default"}>
                    {j.status === "pending" ? "Pendiente" : "Completado"}
                  </Badge>
                  <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reports - clickable */}
      {reports.length > 0 && (
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Reportes
          </h2>
          <div className="space-y-2">
            {reports.map((r) => (
              <Link
                key={r.id}
                to={`/admin/buildings/${building.id}/report?month=${r.month}`}
                className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                    <FileText className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {formatMonthLabel(r.month)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.sent_at ? `Enviado: ${formatDate(r.sent_at)}` : `Creado: ${formatDate(r.created_at)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "sent" ? "default" : "outline"}>
                    {r.status === "sent" ? "Enviado" : "Borrador"}
                  </Badge>
                  <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Inquilinos */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Inquilinos
          </h2>
          <Button size="sm" variant="outline" onClick={() => setTenantDialogOpen(true)} className="rounded-xl">
            <Plus className="size-4" />
            Agregar inquilino
          </Button>
        </div>
        {tenants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <Users className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">Sin inquilinos registrados.</p>
            <p className="mt-1 text-xs text-slate-400">Agregá inquilinos para que puedan usar el bot de Telegram.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                    <Users className="size-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {t.name}{t.unit ? ` — Unidad ${t.unit}` : ""}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone className="size-3" />{t.phone_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteTenant(t.id)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reclamos */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Reclamos de inquilinos
          {requests.filter((r) => r.status === "pending").length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {requests.filter((r) => r.status === "pending").length} nuevos
            </span>
          )}
        </h2>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <MessageCircle className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">Sin reclamos.</p>
          </div>
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
                    {req.tenant_name && (
                      <p className="text-xs font-medium text-amber-600 mb-0.5">{req.tenant_name}</p>
                    )}
                    <p className="truncate text-sm font-medium text-slate-800">{req.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {req.category && `${req.category} · `}{formatDate(req.created_at)}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[req.status] ?? ""}`}>
                      {statusLabels[req.status] ?? req.status}
                    </span>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-amber-500" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete */}
      <div className="border-t border-slate-100 pt-6">
        {confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">
                ¿Eliminar {building.name}? Se borrarán todos los trabajos y reportes.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="rounded-xl">
                {deleting ? "Eliminando..." : "Confirmar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="rounded-xl">
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} className="rounded-xl">
            <Trash2 className="size-4" />
            Eliminar edificio
          </Button>
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

      {/* Request Detail Dialog */}
      <RequestDetailDialog
        request={selectedRequest}
        media={selectedRequestMedia}
        tenant={selectedRequestTenant}
        open={requestDialogOpen}
        onClose={() => {
          setRequestDialogOpen(false);
          setSelectedRequest(null);
        }}
        onUpdated={fetchData}
        buildingId={building.id}
      />

      {/* Create Tenant Dialog */}
      <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
        <DialogContent onClose={() => setTenantDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo inquilino</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required placeholder="María García" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Telegram ID</label>
              <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} required placeholder="123456789" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Unidad (opcional)</label>
              <Input value={tenantUnit} onChange={(e) => setTenantUnit(e.target.value)} placeholder="4B, PB A, Dpto 12..." className="h-10 rounded-xl" />
            </div>
            {tenantError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{tenantError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={creatingTenant} className="h-10 rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                {creatingTenant ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Agregar inquilino"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
