import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Building, Supervisor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Building2 } from "lucide-react";

interface BuildingWithSupervisor extends Building {
  supervisor_name: string | null;
}

export function AdminBuildingsPage() {
  const [buildings, setBuildings] = useState<BuildingWithSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchBuildings = async () => {
    const [bldRes, supRes] = await Promise.all([
      supabase.from("buildings").select("*").order("name"),
      supabase.from("supervisors").select("*").order("name"),
    ]);

    const sups = (supRes.data ?? []) as Supervisor[];
    setSupervisors(sups);
    const supMap = new Map(sups.map((s) => [s.id, s.name]));

    const blds = (bldRes.data ?? []) as Building[];
    setBuildings(
      blds.map((b) => ({
        ...b,
        supervisor_name: b.supervisor_id ? supMap.get(b.supervisor_id) ?? null : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);

    await supabase.from("buildings").insert({
      name: name.trim(),
      address: address.trim(),
      supervisor_id: selectedSupervisor || null,
      emails: [],
    });

    setDialogOpen(false);
    setName("");
    setAddress("");
    setSelectedSupervisor("");
    setCreating(false);
    fetchBuildings();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Edificios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de edificios del sistema.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo edificio
        </Button>
      </div>

      <div className="space-y-2">
        {buildings.map((b) => (
          <Link
            key={b.id}
            to={`/admin/buildings/${b.id}`}
            className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Building2 className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.address}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {b.supervisor_name ?? "Sin asignar"}
            </span>
          </Link>
        ))}
        {buildings.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No hay edificios. Creá uno para empezar.
          </p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo edificio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Edificio Central" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Dirección</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Av. Corrientes 1234, CABA" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Supervisor (opcional)</label>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Sin asignar</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Creando..." : "Crear edificio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
