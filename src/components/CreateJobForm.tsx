import { useState, useRef, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { uploadJobPhotos, insertMediaRecords } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X } from "lucide-react";

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

    // Create job
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

    // Upload before photos
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
      <Button size="sm" onClick={() => setOpen(true)} className="mb-4">
        <ImagePlus className="size-4" />
        Nuevo trabajo
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-3 rounded-lg border bg-card p-4"
    >
      <p className="text-sm font-medium">Nuevo trabajo</p>

      <Textarea
        placeholder="Descripción del trabajo..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        required
        autoFocus
      />

      {/* Photo previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="group relative size-20">
              <img
                src={src}
                alt={`Foto ${i + 1}`}
                className="size-full rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white text-xs"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving || !description.trim()}>
          {saving ? "Creando..." : "Crear trabajo"}
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
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
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
