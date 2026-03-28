import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Supervisor } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";

interface SupervisorWithCount extends Supervisor {
  building_count: number;
}

export function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SupervisorWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchSupervisors = async () => {
    const [supRes, bldRes] = await Promise.all([
      supabase.from("supervisors").select("*").order("name"),
      supabase.from("buildings").select("id, supervisor_id"),
    ]);

    const sups = (supRes.data ?? []) as Supervisor[];
    const buildings = (bldRes.data ?? []) as { id: string; supervisor_id: string | null }[];

    const countBySuper = new Map<string, number>();
    for (const b of buildings) {
      if (b.supervisor_id) {
        countBySuper.set(b.supervisor_id, (countBySuper.get(b.supervisor_id) ?? 0) + 1);
      }
    }

    setSupervisors(
      sups.map((s) => ({ ...s, building_count: countBySuper.get(s.id) ?? 0 }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const { error } = await supabase.functions.invoke("create-supervisor", {
      body: {
        name: name.trim(),
        phone_number: phone.trim(),
        email: email.trim(),
        password,
      },
    });

    if (error) {
      setCreateError(error.message);
      setCreating(false);
      return;
    }

    setDialogOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setCreating(false);
    fetchSupervisors();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Supervisores</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de supervisores del sistema.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo supervisor
        </Button>
      </div>

      <div className="space-y-2">
        {supervisors.map((s) => (
          <Link
            key={s.id}
            to={`/admin/supervisors/${s.id}`}
            className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.phone_number}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {s.building_count} edificio{s.building_count !== 1 ? "s" : ""}
            </span>
          </Link>
        ))}
        {supervisors.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No hay supervisores. Creá uno para empezar.
          </p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo supervisor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Teléfono (WhatsApp)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+5491112345678" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="supervisor@email.com" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Contraseña</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Creando..." : "Crear supervisor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
