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
import { Plus, Building2, ChevronRight, Loader2 } from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

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

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <Loader2 className="size-5 animate-spin text-amber-500" />
        <span className="text-sm text-slate-500">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl text-slate-900 sm:text-4xl" style={serif}>
            Edificios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de edificios del sistema.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-10 self-start rounded-xl bg-amber-500 px-5 text-[#0b1120] hover:bg-amber-400 sm:self-auto"
        >
          <Plus className="size-4" />
          Nuevo edificio
        </Button>
      </div>

      <div className="space-y-2">
        {buildings.map((b) => (
          <Link
            key={b.id}
            to={`/admin/buildings/${b.id}`}
            className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                <Building2 className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                <p className="text-xs text-slate-400">{b.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${b.supervisor_name ? "text-slate-400" : "text-amber-500"}`}>
                {b.supervisor_name ?? "Sin asignar"}
              </span>
              <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
            </div>
          </Link>
        ))}
        {buildings.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <Building2 className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No hay edificios</p>
            <p className="mt-1 text-xs text-slate-400">Creá uno para empezar.</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo edificio</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Edificio Central" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Dirección</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Av. Corrientes 1234, CABA" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Supervisor (opcional)</label>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-all focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Sin asignar</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating} className="h-10 rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear edificio"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
