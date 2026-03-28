import { useState, useRef, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadJobPhotos, insertMediaRecords, deleteMediaFile } from "@/lib/storage";
import type { Job, Media } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  DollarSign,
  ImagePlus,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  Camera,
} from "lucide-react";

interface Props {
  job: Job | null;
  media: Media[];
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type EditMode = null | "description" | "expense" | "complete";

export function JobDetailDialog({ job, media, open, onClose, onUpdated }: Props) {
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [description, setDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseProvider, setExpenseProvider] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Complete flow state
  const [completeFiles, setCompleteFiles] = useState<File[]>([]);
  const [completePreviews, setCompletePreviews] = useState<string[]>([]);
  const completeInputRef = useRef<HTMLInputElement>(null);

  if (!job) return null;

  const beforePhotos = media.filter((m) => m.type === "before");
  const afterPhotos = media.filter((m) => m.type === "after");

  const handleClose = () => {
    setEditMode(null);
    setConfirmDelete(false);
    resetCompleteFlow();
    onClose();
  };

  const resetCompleteFlow = () => {
    completePreviews.forEach(URL.revokeObjectURL);
    setCompleteFiles([]);
    setCompletePreviews([]);
  };

  // -- Description edit --
  const startEditDescription = () => {
    setDescription(job.description_original);
    setEditMode("description");
  };

  const saveDescription = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("jobs")
      .update({ description_original: description })
      .eq("id", job.id);
    setSaving(false);
    setEditMode(null);
    onUpdated();
  };

  // -- Expense edit --
  const startEditExpense = () => {
    setExpenseAmount(job.expense_amount?.toString() ?? "");
    setExpenseProvider(job.expense_provider ?? "");
    setExpenseCategory(job.expense_category ?? "");
    setEditMode("expense");
  };

  const saveExpense = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("jobs")
      .update({
        expense_amount: expenseAmount ? Number(expenseAmount) : null,
        expense_provider: expenseProvider || null,
        expense_category: expenseCategory || null,
      })
      .eq("id", job.id);
    setSaving(false);
    setEditMode(null);
    onUpdated();
  };

  // -- Photo upload (inline add) --
  const handlePhotoUpload = async (
    files: FileList | null,
    type: "before" | "after"
  ) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded = await uploadJobPhotos(job.id, Array.from(files), type);
    await insertMediaRecords(job.id, uploaded, type);
    setUploading(false);
    onUpdated();
  };

  // -- Photo delete --
  const deletePhoto = async (mediaId: string, url: string) => {
    await deleteMediaFile(url);
    await supabase.from("media").delete().eq("id", mediaId);
    onUpdated();
  };

  // -- Complete flow --
  const startComplete = () => {
    resetCompleteFlow();
    setEditMode("complete");
  };

  const addCompleteFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added = Array.from(newFiles);
    setCompleteFiles((prev) => [...prev, ...added]);
    setCompletePreviews((prev) => [
      ...prev,
      ...added.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeCompleteFile = (index: number) => {
    URL.revokeObjectURL(completePreviews[index]!);
    setCompleteFiles((prev) => prev.filter((_, i) => i !== index));
    setCompletePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const confirmComplete = async () => {
    setSaving(true);

    if (completeFiles.length > 0) {
      const urls = await uploadJobPhotos(job.id, completeFiles, "after");
      await insertMediaRecords(job.id, urls, "after");
    }

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    setSaving(false);
    setEditMode(null);
    resetCompleteFlow();
    onUpdated();
  };

  // -- Delete --
  const handleDelete = async () => {
    setDeleting(true);
    for (const m of media) {
      await deleteMediaFile(m.url);
    }
    await supabase.from("media").delete().eq("job_id", job.id);
    await supabase.from("jobs").delete().eq("id", job.id);
    setDeleting(false);
    handleClose();
    onUpdated();
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl" onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Detalle del trabajo</DialogTitle>
            <Badge variant={job.status === "pending" ? "outline" : "default"}>
              {job.status === "pending" ? "Pendiente" : "Completado"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Complete flow banner */}
        {editMode === "complete" && (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Completar trabajo</p>
            </div>
            <p className="text-xs text-emerald-600">
              Subí las fotos del trabajo terminado (después) y confirmá.
            </p>

            {completePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {completePreviews.map((src, i) => (
                  <div key={src} className="group relative size-20">
                    <img
                      src={src}
                      alt={`After ${i + 1}`}
                      className="size-full rounded-lg border border-emerald-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeCompleteFile(i)}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50">
                <ImagePlus className="size-3.5" />
                Agregar fotos
                <input
                  ref={completeInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addCompleteFiles(e.target.files)}
                />
              </label>
              <Button
                size="sm"
                onClick={confirmComplete}
                disabled={saving}
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Completando...
                  </>
                ) : (
                  "Confirmar completado"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditMode(null);
                  resetCompleteFlow();
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Mark as complete button */}
        {job.status === "pending" && editMode !== "complete" && (
          <Button
            variant="outline"
            size="sm"
            onClick={startComplete}
            className="w-fit rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            <CheckCircle2 className="size-4" />
            Marcar como completado
          </Button>
        )}

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Descripción
            </p>
            {editMode !== "description" && (
              <button
                onClick={startEditDescription}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          {editMode === "description" ? (
            <form onSubmit={saveDescription} className="space-y-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={saving} className="rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setEditMode(null)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{job.description_original}</p>
          )}
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <span>Creado: {formatDate(job.created_at)}</span>
          {job.completed_at && (
            <span>Completado: {formatDate(job.completed_at)}</span>
          )}
        </div>

        {/* Photos */}
        <div className="grid grid-cols-2 gap-4">
          <PhotoSection
            title="Fotos antes"
            photos={beforePhotos}
            type="before"
            onUpload={handlePhotoUpload}
            onDelete={deletePhoto}
          />
          <PhotoSection
            title="Fotos después"
            photos={afterPhotos}
            type="after"
            onUpload={handlePhotoUpload}
            onDelete={deletePhoto}
          />
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Loader2 className="size-3.5 animate-spin" />
            Subiendo fotos...
          </div>
        )}

        {/* Expense */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Gasto
            </p>
            {editMode !== "expense" && (
              <button
                onClick={startEditExpense}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <DollarSign className="size-3.5" />
              </button>
            )}
          </div>
          {editMode === "expense" ? (
            <form onSubmit={saveExpense} className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Proveedor"
                  value={expenseProvider}
                  onChange={(e) => setExpenseProvider(e.target.value)}
                  className="h-9 rounded-xl"
                />
                <Input
                  placeholder="Categoría"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={saving} className="rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400">
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setEditMode(null)}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : job.expense_amount ? (
            <p className="text-sm text-slate-700">
              ${job.expense_amount}
              {job.expense_provider && ` — ${job.expense_provider}`}
              {job.expense_category && ` (${job.expense_category})`}
            </p>
          ) : (
            <p className="text-xs text-slate-400">Sin gasto cargado</p>
          )}
        </div>

        {/* Delete */}
        <DialogFooter>
          {confirmDelete ? (
            <div className="flex w-full flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 text-red-500 mt-0.5" />
                <p className="text-sm text-red-700">
                  ¿Seguro que querés eliminar este trabajo?
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl"
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl"
                >
                  No
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl"
            >
              <Trash2 className="size-3.5" />
              Eliminar trabajo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -- Photo section helper -- */
function PhotoSection({
  title,
  photos,
  type,
  onUpload,
  onDelete,
}: {
  title: string;
  photos: Media[];
  type: "before" | "after";
  onUpload: (files: FileList | null, type: "before" | "after") => void;
  onDelete: (mediaId: string, url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </p>
        <label className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <ImagePlus className="size-3.5" />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files, type)}
          />
        </label>
      </div>
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-slate-200 py-6">
          <Camera className="size-5 text-slate-300" />
          <p className="text-[10px] text-slate-400">Sin fotos</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {photos.map((m) => (
            <div key={m.id} className="group relative">
              <img
                src={m.url}
                alt={title}
                className="w-full rounded-xl border border-slate-200 object-cover"
              />
              <button
                onClick={() => onDelete(m.id, m.url)}
                className="absolute top-2 right-2 hidden rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm group-hover:block"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
