import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { TenantRequest, RequestMedia, Tenant } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Loader2,
  MessageSquare,
  Camera,
  User,
  MapPin,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Props {
  request: TenantRequest | null;
  media: RequestMedia[];
  tenant: Tenant | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  buildingId: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-800" },
  in_progress: { label: "En progreso", color: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rechazado", color: "bg-red-100 text-red-800" },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  baja: { label: "Baja", color: "text-slate-500" },
  normal: { label: "Normal", color: "text-amber-600" },
  urgente: { label: "Urgente", color: "text-red-600" },
};

export function RequestDetailDialog({
  request,
  media,
  tenant,
  open,
  onClose,
  onUpdated,
  buildingId,
}: Props) {
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  if (!request) return null;

  const status = statusConfig[request.status] ?? statusConfig.pending!;
  const urgency = urgencyConfig[request.urgency] ?? urgencyConfig.normal!;

  const handleClose = () => {
    setResponse("");
    onClose();
  };

  const updateStatus = async (newStatus: string, adminResponse?: string) => {
    setSaving(true);
    const update: Record<string, unknown> = { status: newStatus };
    if (adminResponse) update.admin_response = adminResponse;
    if (newStatus === "resolved" || newStatus === "rejected") {
      update.resolved_at = new Date().toISOString();
    }
    await supabase.from("tenant_requests").update(update).eq("id", request.id);
    setSaving(false);
    setResponse("");
    onUpdated();
  };

  const handleRespond = async (e: FormEvent) => {
    e.preventDefault();
    if (!response.trim()) return;
    await updateStatus(request.status === "pending" ? "in_progress" : request.status, response.trim());
  };

  const convertToJob = async () => {
    setConverting(true);

    // Create job from request
    const { data: job } = await supabase
      .from("jobs")
      .insert({
        building_id: buildingId,
        description_original: `[Reclamo${tenant ? ` de ${tenant.name}${tenant.unit ? ` (${tenant.unit})` : ""}` : ""}] ${request.description}`,
        status: "pending",
      })
      .select("id")
      .single();

    if (job) {
      // Copy media to job media
      for (const m of media) {
        await supabase.from("media").insert({
          job_id: job.id,
          type: "before",
          url: m.url,
        });
      }

      // Link request to job and mark as in_progress
      await supabase
        .from("tenant_requests")
        .update({
          job_id: job.id,
          status: "in_progress",
          admin_response: "Se creó un trabajo a partir de este reclamo.",
        })
        .eq("id", request.id);
    }

    setConverting(false);
    onUpdated();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg" onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>Reclamo</DialogTitle>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
              {status.label}
            </span>
          </div>
        </DialogHeader>

        {/* Tenant info */}
        {tenant && (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white shadow-sm">
              <User className="size-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{tenant.name}</p>
              <p className="text-xs text-slate-400">
                {tenant.unit ? `Unidad ${tenant.unit} · ` : ""}{tenant.phone_number}
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Descripción
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {request.category && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {request.category}
            </span>
          )}
          <span className={`flex items-center gap-1 font-medium ${urgency.color}`}>
            <AlertTriangle className="size-3" />
            {urgency.label}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDate(request.created_at)}
          </span>
        </div>

        {/* Photos */}
        {media.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Fotos del reclamo
            </p>
            <div className="grid grid-cols-2 gap-2">
              {media.map((m) => (
                <img
                  key={m.id}
                  src={m.url}
                  alt="Foto del reclamo"
                  className="w-full rounded-xl border border-slate-200 object-cover"
                />
              ))}
            </div>
          </div>
        )}
        {media.length === 0 && (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-200 py-4">
            <Camera className="size-5 text-slate-300" />
            <p className="text-[10px] text-slate-400">Sin fotos adjuntas</p>
          </div>
        )}

        {/* Admin response */}
        {request.admin_response && (
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-1">
              Respuesta
            </p>
            <p className="text-sm text-blue-800">{request.admin_response}</p>
          </div>
        )}

        {/* Linked job */}
        {request.job_id && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">
              Vinculado a un trabajo de mantenimiento.
            </p>
          </div>
        )}

        {/* Actions */}
        {request.status !== "resolved" && request.status !== "rejected" && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {/* Respond */}
            <form onSubmit={handleRespond} className="space-y-2">
              <Textarea
                placeholder="Escribí una respuesta para el inquilino..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={2}
                className="rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !response.trim()}
                  className="rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
                  Responder
                </Button>

                {!request.job_id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={converting}
                    onClick={convertToJob}
                    className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    {converting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    Crear trabajo
                  </Button>
                )}
              </div>
            </form>

            <DialogFooter>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus("resolved", response.trim() || "Reclamo resuelto.")}
                  disabled={saving}
                  className="rounded-xl text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  Marcar resuelto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus("rejected", response.trim() || "Reclamo rechazado.")}
                  disabled={saving}
                  className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                >
                  Rechazar
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
