import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Supervisor, Building } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, Save, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      .from("supervisors")
      .update({ name: name.trim(), phone_number: phone.trim() })
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
    // Unassign buildings first
    await supabase.from("buildings").update({ supervisor_id: null }).eq("supervisor_id", id);
    // Delete supervisor (cascade will handle whatsapp_sessions)
    await supabase.from("supervisors").delete().eq("id", id);
    // Delete user profile and auth user
    await supabase.from("user_profiles").delete().eq("user_id", supervisor.user_id);
    setDeleting(false);
    window.location.href = "/admin/supervisors";
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!supervisor) return <p className="text-sm text-muted-foreground">Supervisor no encontrado.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/supervisors" className="flex size-8 items-center justify-center rounded-lg hover:bg-muted">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-xl font-bold tracking-tight">{supervisor.name}</h2>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="max-w-md space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Datos del supervisor</p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Teléfono (WhatsApp)</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="size-4" />
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>

      {/* Assigned buildings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Edificios asignados
          </h3>
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <Plus className="size-4" />
            Asignar edificio
          </Button>
        </div>

        {buildings.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No tiene edificios asignados.
          </p>
        ) : (
          <div className="space-y-2">
            {buildings.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.address}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => unassignBuilding(b.id)}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete supervisor */}
      <div className="border-t pt-6">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">
              ¿Eliminar a {supervisor.name}? Los edificios serán desasignados.
            </p>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Confirmar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
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
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay edificios sin asignar.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unassigned.map((b) => (
                <button
                  key={b.id}
                  onClick={() => assignBuilding(b.id)}
                  className="flex w-full items-center gap-2 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.address}</p>
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
