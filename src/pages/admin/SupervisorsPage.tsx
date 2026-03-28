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
import { Plus, Users, ChevronRight, Loader2, KeyRound } from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

function normalizePhone(p: string): string {
  let n = p.trim().replace(/[\s\-()]/g, "");
  if (!n.startsWith("+")) n = "+" + n;
  return n;
}

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
    try {
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
    } catch (err) {
      console.error("Fetch supervisors error:", err);
    } finally {
      setLoading(false);
    }
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
        phone_number: normalizePhone(phone),
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
            Supervisores
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de supervisores del sistema.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-10 self-start rounded-xl bg-amber-500 px-5 text-[#0b1120] hover:bg-amber-400 sm:self-auto"
        >
          <Plus className="size-4" />
          Nuevo supervisor
        </Button>
      </div>

      <div className="space-y-2">
        {supervisors.map((s) => (
          <Link
            key={s.id}
            to={`/admin/supervisors/${s.id}`}
            className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-amber-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-amber-50">
                <Users className="size-5 text-slate-400 transition-colors group-hover:text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">{s.phone_number}</p>
                {s.email && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <KeyRound className="size-3 text-slate-300" />
                    <span className="text-[11px] text-slate-400">{s.email}</span>
                    {s.login_password && (
                      <span className="text-[11px] text-slate-300">/ {s.login_password}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {s.building_count} edificio{s.building_count !== 1 ? "s" : ""}
              </span>
              <ChevronRight className="size-4 text-slate-300 transition-colors group-hover:text-amber-500" />
            </div>
          </Link>
        ))}
        {supervisors.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
            <Users className="mx-auto size-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No hay supervisores</p>
            <p className="mt-1 text-xs text-slate-400">Creá uno para empezar.</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Nuevo supervisor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Juan Pérez" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Telegram ID</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+5491112345678" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="supervisor@email.com" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Contraseña</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-10 rounded-xl" />
            </div>
            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{createError}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={creating} className="h-10 rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear supervisor"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
