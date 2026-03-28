import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Supervisor, Job, Report } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Trash2 } from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!building) return <p className="text-sm text-muted-foreground">Edificio no encontrado.</p>;

  const pendingCount = jobs.filter((j) => j.status === "pending").length;
  const completedCount = jobs.filter((j) => j.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/buildings" className="flex size-8 items-center justify-center rounded-lg hover:bg-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-xl font-bold tracking-tight">{building.name}</h2>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="max-w-md space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Datos del edificio</p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dirección</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Supervisor asignado</label>
          <select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Sin asignar</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="rounded-lg border p-3">
          <p className="text-lg font-bold">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-lg font-bold">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completados</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-lg font-bold">{reports.length}</p>
          <p className="text-xs text-muted-foreground">Reportes</p>
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Últimos trabajos
        </h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin trabajos.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm">{j.description_original}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(j.created_at)}</p>
                </div>
                <Badge variant={j.status === "pending" ? "outline" : "default"}>
                  {j.status === "pending" ? "Pendiente" : "Completado"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reports */}
      {reports.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Reportes
          </h3>
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm">{r.month}</p>
                <Badge variant={r.status === "sent" ? "default" : "outline"}>
                  {r.status === "sent" ? "Enviado" : "Borrador"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete */}
      <div className="border-t pt-6">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">
              ¿Eliminar {building.name}? Se borrarán todos los trabajos y reportes.
            </p>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Confirmar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Eliminar edificio
          </Button>
        )}
      </div>
    </div>
  );
}
