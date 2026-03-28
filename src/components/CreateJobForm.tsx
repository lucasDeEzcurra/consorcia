import { useState, useRef, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadJobPhotos, insertMediaRecords } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Plus, Loader2 } from "lucide-react";

interface Props {
  buildingId: string;
  onCreated: () => void;
}

export function CreateJobForm({ buildingId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added = Array.from(newFiles);
    setFiles((prev) => [...prev, ...added]);
    setPreviews((prev) => [
      ...prev,
      ...added.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]!);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setDescription("");
    previews.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviews([]);
    setOpen(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);

    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        building_id: buildingId,
        description_original: description.trim(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !job) {
      setSaving(false);
      return;
    }

    if (files.length > 0) {
      const urls = await uploadJobPhotos(job.id, files, "before");
      await insertMediaRecords(job.id, urls, "before");
    }

    setSaving(false);
    reset();
    onCreated();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-500 transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
      >
        <Plus className="size-4" />
        Nuevo trabajo
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
    >
      <p className="text-sm font-semibold text-slate-800">Nuevo trabajo</p>

      <Textarea
        placeholder="Descripción del trabajo..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        required
        autoFocus
        className="rounded-xl border-slate-200 bg-white"
      />

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="group relative size-20">
              <img
                src={src}
                alt={`Foto ${i + 1}`}
                className="size-full rounded-lg border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={saving || !description.trim()}
          className="rounded-xl bg-amber-500 text-[#0b1120] hover:bg-amber-400"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear trabajo"
          )}
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50">
          <ImagePlus className="size-3.5" />
          Fotos (antes)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded-xl"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
