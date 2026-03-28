import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Supervisor, Building } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, Save, Trash2, Plus, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

function normalizePhone(p: string): string {
  let n = p.trim().replace(/[\s\-()]/g, "");
  if (!n.startsWith("+")) n = "+" + n;
  return n;
}

export function SupervisorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [unassigned, setUnassigned] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [supRes, bldRes, allBldRes] = await Promise.all([
        supabase.from("supervisors").select("*").eq("id", id).single(),
        supabase.from("buildings").select("*").eq("supervisor_id", id).order("name"),
        supabase.from("buildings").select("*").is("supervisor_id", null).order("name"),
      ]);

      const sup = supRes.data as Supervisor | null;
      setSupervisor(sup);
      if (sup) {
        setName(sup.name);
        setPhone(sup.phone_number);
      }
      setBuildings((bldRes.data ?? []) as Building[]);
      setUnassigned((allBldRes.data ?? []) as Building[]);
    } catch (err) {
      console.error("Fetch supervisor detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    await supabase
      .from("supervisors")
      .update({ name: name.trim(), phone_number: normalizePhone(phone) })
      .eq("id", id);
    setSaving(false);
    fetchData();
  };

  const assignBuilding = async (buildingId: string) => {
    await supabase.from("buildings").update({ supervisor_id: id }).eq("id", buildingId);
    setAssignOpen(false);
    fetchData();
  };

  const unassignBuilding = async (buildingId: string) => {
    await supabase.from("buildings").update({ supervisor_id: null }).eq("id", buildingId);
    fetchData();
  };

  const handleDelete = async () => {
    if (!id || !supervisor) return;
    setDeleting(true);
    await supabase.from("buildings").update({ supervisor_id: null }).eq("supervisor_id", id);
    await supabase.from("supervisors").delete().eq("id", id);
    await supabase.from("user_profiles").delete().eq("user_id", supervisor.user_id);
    setDeleting(false);
    window.location.href = "/admin/supervisors";
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-5 animate-spin text-amber-500" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    );
  }

  if (!supervisor) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">Supervisor no encontrado.</p>
        <Link to="/admin/supervisors" className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500">
          Volver a supervisores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/supervisors"
          className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl text-slate-900 sm:text-3xl" style={serif}>
          {supervisor.name}
        </h1>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="max-w-md space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Datos del supervisor</p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Teléfono (WhatsApp)</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-10 rounded-xl" />
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

      {/* Assigned buildings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Edificios asignados
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAssignOpen(true)}
            className="rounded-xl"
          >
            <Plus className="size-4" />
            Asignar edificio
          </Button>
        </div>

        {buildings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <Building2 className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No tiene edificios asignados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {buildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                    <Building2 className="size-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.address}</p>
                  </div>
                </div>
                <button
                  onClick={() => unassignBuilding(b.id)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete supervisor */}
      <div className="border-t border-slate-100 pt-6">
        {confirmDelete ? (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">
                ¿Eliminar a {supervisor.name}? Los edificios serán desasignados.
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
            Eliminar supervisor
          </Button>
        )}
      </div>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent onClose={() => setAssignOpen(false)}>
          <DialogHeader>
            <DialogTitle>Asignar edificio</DialogTitle>
          </DialogHeader>
          {unassigned.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <Building2 className="mx-auto size-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">No hay edificios sin asignar.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unassigned.map((b) => (
                <button
                  key={b.id}
                  onClick={() => assignBuilding(b.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3.5 text-left transition-all hover:border-amber-200 hover:bg-amber-50"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                    <Building2 className="size-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
