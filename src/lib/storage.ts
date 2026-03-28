import { supabase } from "@/lib/supabase";

export async function uploadJobPhotos(
  jobId: string,
  files: File[],
  type: "before" | "after"
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `jobs/${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) continue;

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function insertMediaRecords(
  jobId: string,
  urls: string[],
  type: "before" | "after"
) {
  if (urls.length === 0) return;
  await supabase.from("media").insert(
    urls.map((url) => ({ job_id: jobId, type, url }))
  );
}

export async function uploadEntityPhoto(
  entity: "supervisors" | "buildings",
  entityId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${entity}/${entityId}/photo.${ext}`;

  await supabase.storage.from("media").remove([path]);

  const { error } = await supabase.storage.from("media").upload(path, file);
  if (error) return null;

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteMediaFile(url: string) {
  // Extract path after bucket name in the URL
  const match = url.match(/\/storage\/v1\/object\/public\/media\/(.+)/);
  if (match?.[1]) {
    await supabase.storage.from("media").remove([match[1]]);
  }
}
