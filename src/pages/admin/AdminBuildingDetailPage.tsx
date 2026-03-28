import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Supervisor, Job, Report, Media } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JobDetailDialog } from "@/components/JobDetailDialog";
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
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

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

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Job detail dialog
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedJobMedia, setSelectedJobMedia] = useState<Media[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [bldRes, supRes, jobRes, repRes] = await Promise.all([
      supabase.from("buildings").select("*").eq("id", id).single(),
      supabase.from("supervisors").select("*").order("name"),
      supabase.from("jobs").select("*").eq("building_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("reports").select("*").eq("building_id", id).order("month", { ascending: false }),
    ]);

    const bld = bldRes.data as Building | null;
    setBuilding(bld);
    if (bld) {
      setName(bld.name);
      setAddress(bld.address);
      setSupervisorId(bld.supervisor_id ?? "");
    }
    setSupervisors((supRes.data ?? []) as Supervisor[]);
    setJobs((jobRes.data ?? []) as Job[]);
    setReports((repRes.data ?? []) as Report[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    </div>
  );
}
