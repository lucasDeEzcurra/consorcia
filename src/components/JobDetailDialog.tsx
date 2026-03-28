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

  // ── Description edit ──
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

  // ── Expense edit ──
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

  // ── Photo upload (inline add) ──
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

  // ── Photo delete ──
  const deletePhoto = async (mediaId: string, url: string) => {
    await deleteMediaFile(url);
    await supabase.from("media").delete().eq("id", mediaId);
    onUpdated();
  };

  // ── Complete flow ──
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

    // Upload after photos
    if (completeFiles.length > 0) {
      const urls = await uploadJobPhotos(job.id, completeFiles, "after");
      await insertMediaRecords(job.id, urls, "after");
    }

    // Mark as completed
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

  // ── Delete ──
  const handleDelete = async () => {
    setDeleting(true);
    // Delete media files from storage
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
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium">Completar trabajo</p>
            <p className="text-xs text-muted-foreground">
              Subí las fotos del trabajo terminado (después) y confirmá.
            </p>

            {/* Preview of selected after photos */}
            {completePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {completePreviews.map((src, i) => (
                  <div key={src} className="group relative size-20">
                    <img
                      src={src}
                      alt={`After ${i + 1}`}
                      className="size-full rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeCompleteFile(i)}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
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
              >
                {saving ? "Completando..." : "Confirmar completado"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditMode(null);
                  resetCompleteFlow();
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Mark as complete button (only for pending, when not already in complete mode) */}
        {job.status === "pending" && editMode !== "complete" && (
          <Button
            variant="outline"
            size="sm"
            onClick={startComplete}
            className="w-fit"
          >
            <CheckCircle2 className="size-4" />
            Marcar como completado
          </Button>
        )}

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Descripción
            </p>
            {editMode !== "description" && (
              <button
                onClick={startEditDescription}
                className="text-muted-foreground hover:text-foreground"
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
              />
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setEditMode(null)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm">{job.description_original}</p>
          )}
        </div>

        {/* Dates */}
        <div className="flex gap-6 text-xs text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">Subiendo fotos...</p>
        )}

        {/* Expense */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Gasto
            </p>
            {editMode !== "expense" && (
              <button
                onClick={startEditExpense}
                className="text-muted-foreground hover:text-foreground"
              >
                <DollarSign className="size-3.5" />
              </button>
            )}
          </div>
          {editMode === "expense" ? (
            <form onSubmit={saveExpense} className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Monto"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
                <Input
                  placeholder="Proveedor"
                  value={expenseProvider}
                  onChange={(e) => setExpenseProvider(e.target.value)}
                />
                <Input
                  placeholder="Categoría"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setEditMode(null)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : job.expense_amount ? (
            <p className="text-sm">
              ${job.expense_amount}
              {job.expense_provider && ` — ${job.expense_provider}`}
              {job.expense_category && ` (${job.expense_category})`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Sin gasto cargado</p>
          )}
        </div>

        {/* Delete */}
        <DialogFooter>
          {confirmDelete ? (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm text-destructive">
                ¿Seguro que querés eliminar este trabajo?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
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

/* ── Photo section helper ── */
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        <label className="cursor-pointer text-muted-foreground hover:text-foreground">
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
        <p className="text-xs text-muted-foreground">Sin fotos</p>
      ) : (
        <div className="space-y-1">
          {photos.map((m) => (
            <div key={m.id} className="group relative">
              <img
                src={m.url}
                alt={title}
                className="w-full rounded-md border object-cover"
              />
              <button
                onClick={() => onDelete(m.id, m.url)}
                className="absolute top-1 right-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
