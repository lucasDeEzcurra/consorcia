import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ── Types ──

interface Session {
  id: string;
  entity_id: string;
  state: string;
  context: Record<string, unknown>;
  updated_at: string;
}

// ── Telegram Bot API helpers ──

async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  const resp = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Failed to send Telegram message:", resp.status, errText);
  }
}

async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  const resp = await fetch(`${TELEGRAM_API_BASE}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const filePath = data.result?.file_path;
  if (!filePath) return null;
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}

async function downloadTelegramFile(url: string): Promise<{ blob: Blob; contentType: string } | null> {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const contentType = resp.headers.get("content-type") || "application/octet-stream";
  const blob = await resp.blob();
  return { blob, contentType };
}

// ── Audio transcription via Groq Whisper ──

async function transcribeAudio(fileId: string): Promise<string> {
  try {
    if (!GROQ_API_KEY) {
      return "[No se pudo transcribir el audio: API no configurada]";
    }

    const fileUrl = await getTelegramFileUrl(fileId);
    if (!fileUrl) return "[No se pudo obtener el audio]";

    const media = await downloadTelegramFile(fileUrl);
    if (!media) return "[No se pudo descargar el audio]";

    let ext = "ogg";
    if (media.contentType.includes("mpeg") || media.contentType.includes("mp3")) ext = "mp3";
    else if (media.contentType.includes("mp4") || media.contentType.includes("m4a")) ext = "m4a";
    else if (media.contentType.includes("wav")) ext = "wav";
    else if (media.contentType.includes("webm")) ext = "webm";

    const formData = new FormData();
    formData.append("file", new File([media.blob], `audio.${ext}`, { type: media.contentType }));
    formData.append("model", "whisper-large-v3");
    formData.append("language", "es");

    const groqResp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: formData,
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      console.error("Groq transcription failed:", groqResp.status, errText);
      return "[No se pudo transcribir el audio. Intentá enviar un mensaje de texto.]";
    }

    const result = await groqResp.json();
    const text = (result.text || "").trim();
    return text || "[Audio vacío o no se detectó habla]";
  } catch (error) {
    console.error("transcribeAudio error:", error);
    return "[Error al transcribir el audio. Intentá enviar un mensaje de texto.]";
  }
}

// ── Media upload ──

async function uploadMediaFromTelegram(
  fileId: string,
  folder: string,
  subfolder: string
): Promise<string | null> {
  try {
    const fileUrl = await getTelegramFileUrl(fileId);
    if (!fileUrl) return null;

    const media = await downloadTelegramFile(fileUrl);
    if (!media) return null;

    const ext = media.contentType.includes("png") ? "png" : "jpg";
    const path = `${folder}/${subfolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("media")
      .upload(path, media.blob, { contentType: media.contentType });

    if (error) return null;

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

// ── Session management ──

async function getOrCreateSession(entityId: string): Promise<Session> {
  const { data } = await supabase
    .from("telegram_sessions")
    .select("*")
    .eq("entity_id", entityId)
    .single();

  if (data) return data as Session;

  const { data: created } = await supabase
    .from("telegram_sessions")
    .insert({ entity_id: entityId, state: "idle", context: {} })
    .select()
    .single();

  return created as Session;
}

async function updateSession(
  entityId: string,
  state: string,
  context: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("telegram_sessions")
    .update({ state, context, updated_at: new Date().toISOString() })
    .eq("entity_id", entityId);
}

// ══════════════════════════════════════════
// SUPERVISOR FLOW
// ══════════════════════════════════════════

function buildingMenu(name: string): string {
  return `📋 *${name}*\n\n1. Nuevo trabajo\n2. Completar trabajo pendiente\n3. Ver pendientes\n4. Cambiar edificio\n5. Salir\n\n_Respondé con el número_`;
}

async function handleSupervisorIdle(
  supervisorId: string,
  _body: string
): Promise<string> {
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name, address")
    .eq("supervisor_id", supervisorId)
    .order("name");

  const list = (buildings || []) as { id: string; name: string; address: string }[];

  if (list.length === 0) {
    return "No tenés edificios asignados. Contactá al administrador.";
  }

  await updateSession(supervisorId, "sup_select_building", {
    buildings: list.map((b) => ({ id: b.id, name: b.name })),
  });

  let msg = "🏢 *Seleccioná un edificio:*\n\n";
  list.forEach((b, i) => {
    msg += `${i + 1}. ${b.name}\n   📍 ${b.address}\n`;
  });
  msg += "\n_Respondé con el número_";
  return msg;
}

async function handleSupSelectBuilding(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const buildings = ctx.buildings as { id: string; name: string }[];
  const choice = parseInt(body.trim(), 10);

  if (isNaN(choice) || choice < 1 || choice > buildings.length) {
    return `Enviá un número entre 1 y ${buildings.length}.`;
  }

  const selected = buildings[choice - 1]!;
  await updateSession(supervisorId, "sup_building_menu", {
    building_id: selected.id,
    building_name: selected.name,
  });

  return buildingMenu(selected.name);
}

async function handleSupBuildingMenu(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const choice = body.trim();
  const buildingId = ctx.building_id as string;
  const buildingName = ctx.building_name as string;

  switch (choice) {
    case "1": {
      await updateSession(supervisorId, "sup_new_job_photos", {
        ...ctx,
        photo_urls: [],
      });
      return "📸 *Nuevo trabajo*\n\nEnviá las fotos del *ANTES* del trabajo.\n\nCuando termines, escribí *LISTO*.\n\n🎤 _También podés enviar un audio con la descripción._";
    }
    case "2": {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, description_original, created_at")
        .eq("building_id", buildingId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const list = (jobs || []) as {
        id: string;
        description_original: string;
        created_at: string;
      }[];

      if (list.length === 0) {
        return `No hay trabajos pendientes en ${buildingName}.\n\n${buildingMenu(buildingName)}`;
      }

      await updateSession(supervisorId, "sup_complete_select_job", {
        ...ctx,
        pending_jobs: list.map((j) => ({ id: j.id, desc: j.description_original })),
      });

      let msg = "✅ *Seleccioná el trabajo a completar:*\n\n";
      list.forEach((j, i) => {
        msg += `${i + 1}. ${j.description_original}\n   📅 ${formatDate(j.created_at)}\n`;
      });
      msg += "\n_Respondé con el número_";
      return msg;
    }
    case "3": {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("description_original, created_at")
        .eq("building_id", buildingId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const list = (jobs || []) as {
        description_original: string;
        created_at: string;
      }[];

      if (list.length === 0) {
        return `No hay trabajos pendientes en ${buildingName}.\n\n${buildingMenu(buildingName)}`;
      }

      let msg = `📋 *Pendientes en ${buildingName}:*\n\n`;
      list.forEach((j, i) => {
        msg += `${i + 1}. ${j.description_original}\n   📅 ${formatDate(j.created_at)}\n`;
      });
      msg += `\n${buildingMenu(buildingName)}`;
      return msg;
    }
    case "4": {
      return handleSupervisorIdle(supervisorId, "");
    }
    case "5": {
      await updateSession(supervisorId, "idle", {});
      return "👋 ¡Hasta luego! Enviá cualquier mensaje para volver a empezar.";
    }
    default:
      return "Enviá un número entre 1 y 5.";
  }
}

async function handleSupNewJobPhotos(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>,
  photoFileIds: string[]
): Promise<string> {
  const photos = (ctx.photo_urls as string[]) || [];

  if (photoFileIds.length > 0) {
    for (const fileId of photoFileIds) {
      const publicUrl = await uploadMediaFromTelegram(fileId, "incoming", "photos");
      if (publicUrl) photos.push(publicUrl);
    }
    await updateSession(supervisorId, "sup_new_job_photos", {
      ...ctx,
      photo_urls: photos,
    });
    return `📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""} recibida${photos.length !== 1 ? "s" : ""}. Seguí enviando o escribí *LISTO*.`;
  }

  if (body.trim().toUpperCase() === "LISTO") {
    await updateSession(supervisorId, "sup_new_job_description", {
      ...ctx,
      photo_urls: photos,
    });
    return "📝 Escribí una descripción corta del trabajo:\n\n🎤 _También podés enviar un audio._";
  }

  return "Enviá fotos o escribí *LISTO* cuando termines.";
}

async function handleSupNewJobDescription(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const buildingId = ctx.building_id as string;
  const buildingName = ctx.building_name as string;
  const photoUrls = (ctx.photo_urls as string[]) || [];
  const description = body.trim();

  if (!description) {
    return "Escribí una descripción del trabajo:";
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      building_id: buildingId,
      description_original: description,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !job) {
    await updateSession(supervisorId, "sup_building_menu", {
      building_id: buildingId,
      building_name: buildingName,
    });
    return `❌ Error al crear el trabajo.\n\n${buildingMenu(buildingName)}`;
  }

  // Photos are already uploaded to Supabase storage, just create media records
  for (const url of photoUrls) {
    await supabase.from("media").insert({
      job_id: job.id,
      type: "before",
      url,
    });
  }

  await updateSession(supervisorId, "sup_building_menu", {
    building_id: buildingId,
    building_name: buildingName,
  });

  return `✅ *Trabajo creado*\n📝 ${description}\n📸 ${photoUrls.length} foto${photoUrls.length !== 1 ? "s" : ""}\n\n${buildingMenu(buildingName)}`;
}

async function handleSupCompleteSelectJob(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const pendingJobs = ctx.pending_jobs as { id: string; desc: string }[];
  const choice = parseInt(body.trim(), 10);

  if (isNaN(choice) || choice < 1 || choice > pendingJobs.length) {
    return `Enviá un número entre 1 y ${pendingJobs.length}.`;
  }

  const selected = pendingJobs[choice - 1]!;
  await updateSession(supervisorId, "sup_complete_job_photos", {
    ...ctx,
    job_id: selected.id,
    job_desc: selected.desc,
    photo_urls: [],
  });

  return `📸 *Completar: ${selected.desc}*\n\nEnviá las fotos del *DESPUÉS* del trabajo.\n\nCuando termines, escribí *LISTO*.`;
}

async function handleSupCompleteJobPhotos(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>,
  photoFileIds: string[]
): Promise<string> {
  const photos = (ctx.photo_urls as string[]) || [];

  if (photoFileIds.length > 0) {
    for (const fileId of photoFileIds) {
      const publicUrl = await uploadMediaFromTelegram(fileId, "incoming", "photos");
      if (publicUrl) photos.push(publicUrl);
    }
    await updateSession(supervisorId, "sup_complete_job_photos", {
      ...ctx,
      photo_urls: photos,
    });
    return `📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""} recibida${photos.length !== 1 ? "s" : ""}. Seguí enviando o escribí *LISTO*.`;
  }

  if (body.trim().toUpperCase() === "LISTO") {
    const jobId = ctx.job_id as string;
    // Photos already uploaded, just create media records
    for (const url of photos) {
      await supabase.from("media").insert({
        job_id: jobId,
        type: "after",
        url,
      });
    }

    await updateSession(supervisorId, "sup_complete_job_expense", {
      ...ctx,
      photo_urls: photos,
    });

    return "💰 ¿Querés cargar un gasto?\n\n1. Sí\n2. No, completar sin gasto";
  }

  return "Enviá fotos o escribí *LISTO* cuando termines.";
}

async function handleSupCompleteJobExpense(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const choice = body.trim();

  if (choice === "2" || choice.toUpperCase() === "NO") {
    return completeJob(supervisorId, ctx, null, null, null);
  }

  if (choice === "1" || choice.toUpperCase() === "SI" || choice.toUpperCase() === "SÍ") {
    await updateSession(supervisorId, "sup_expense_amount", ctx);
    return "💲 Ingresá el monto del gasto (solo el número):";
  }

  return "Respondé *1* (Sí) o *2* (No).";
}

async function handleSupExpenseAmount(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const amount = parseFloat(body.trim().replace(",", ".").replace("$", ""));

  if (isNaN(amount)) {
    return "Ingresá un número válido (ej: 15000):";
  }

  await updateSession(supervisorId, "sup_expense_provider", {
    ...ctx,
    expense_amount: amount,
  });

  return "🏪 Ingresá el nombre del proveedor (o escribí *-* para omitir):";
}

async function handleSupExpenseProvider(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const provider = body.trim() === "-" ? null : body.trim();

  await updateSession(supervisorId, "sup_expense_category", {
    ...ctx,
    expense_provider: provider,
  });

  return "🏷️ Ingresá la categoría del gasto (ej: plomería, electricidad, limpieza) o *-* para omitir:";
}

async function handleSupExpenseCategory(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const category = body.trim() === "-" ? null : body.trim();
  const amount = ctx.expense_amount as number;
  const provider = (ctx.expense_provider as string) || null;

  return completeJob(supervisorId, ctx, amount, provider, category);
}

async function completeJob(
  supervisorId: string,
  ctx: Record<string, unknown>,
  amount: number | null,
  provider: string | null,
  category: string | null
): Promise<string> {
  const jobId = ctx.job_id as string;
  const jobDesc = ctx.job_desc as string;
  const buildingId = ctx.building_id as string;
  const buildingName = ctx.building_name as string;

  const updateData: Record<string, unknown> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (amount !== null) updateData.expense_amount = amount;
  if (provider !== null) updateData.expense_provider = provider;
  if (category !== null) updateData.expense_category = category;

  await supabase.from("jobs").update(updateData).eq("id", jobId);

  await updateSession(supervisorId, "sup_building_menu", {
    building_id: buildingId,
    building_name: buildingName,
  });

  let msg = `✅ *Trabajo completado*\n📝 ${jobDesc}`;
  if (amount !== null) {
    msg += `\n💰 $${amount}`;
    if (provider) msg += ` — ${provider}`;
    if (category) msg += ` (${category})`;
  }
  msg += `\n\n${buildingMenu(buildingName)}`;
  return msg;
}

// ══════════════════════════════════════════
// TENANT FLOW
// ══════════════════════════════════════════

const CATEGORIES = [
  "Plomería",
  "Electricidad",
  "Ascensores",
  "Limpieza",
  "Seguridad",
  "Espacios comunes",
  "Otro",
];

function tenantMenu(buildingName: string): string {
  return `🏠 *${buildingName}*\n\n1. Nuevo reclamo\n2. Mis reclamos\n3. Salir\n\n_Respondé con el número_`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending": return "🟡 Pendiente";
    case "in_progress": return "🔵 En progreso";
    case "resolved": return "🟢 Resuelto";
    case "rejected": return "🔴 Rechazado";
    default: return status;
  }
}

async function handleTenantIdle(
  tenantId: string,
  tenant: { building_id: string; name: string }
): Promise<string> {
  const { data: building } = await supabase
    .from("buildings")
    .select("name")
    .eq("id", tenant.building_id)
    .single();

  const buildingName = building?.name || "Tu edificio";

  await updateSession(tenantId, "tenant_menu", {
    building_id: tenant.building_id,
    building_name: buildingName,
    tenant_name: tenant.name,
  });

  return `👋 Hola ${tenant.name}!\n\n${tenantMenu(buildingName)}`;
}

async function handleTenantMenu(
  tenantId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const choice = body.trim();
  const buildingName = ctx.building_name as string;

  switch (choice) {
    case "1": {
      await updateSession(tenantId, "tenant_new_description", ctx);
      return "📝 *Nuevo reclamo*\n\nDescribí el problema o lo que necesitás que se arregle.\n\n🎤 _También podés enviar un audio._\n\n_Enviá *0* para volver al menú._";
    }
    case "2": {
      const { data: requests } = await supabase
        .from("tenant_requests")
        .select("description, status, category, created_at, admin_response")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);

      const list = (requests || []) as {
        description: string;
        status: string;
        category: string | null;
        created_at: string;
        admin_response: string | null;
      }[];

      if (list.length === 0) {
        return `No tenés reclamos registrados.\n\n${tenantMenu(buildingName)}`;
      }

      let msg = `📋 *Tus reclamos:*\n\n`;
      list.forEach((r, i) => {
        msg += `${i + 1}. ${r.description.substring(0, 50)}${r.description.length > 50 ? "..." : ""}\n`;
        msg += `   ${statusLabel(r.status)}`;
        if (r.category) msg += ` | ${r.category}`;
        msg += `\n   📅 ${formatDate(r.created_at)}`;
        if (r.admin_response) msg += `\n   💬 ${r.admin_response.substring(0, 60)}${r.admin_response.length > 60 ? "..." : ""}`;
        msg += "\n\n";
      });
      msg += tenantMenu(buildingName);
      return msg;
    }
    case "3": {
      await updateSession(tenantId, "idle", {});
      return "👋 ¡Hasta luego! Enviá cualquier mensaje para volver a empezar.";
    }
    default:
      return "Enviá un número entre 1 y 3.";
  }
}

function categoryMenu(): string {
  let msg = "🏷️ *Categoría del reclamo:*\n\n";
  CATEGORIES.forEach((c, i) => {
    msg += `${i + 1}. ${c}\n`;
  });
  msg += "\n_Respondé con el número o *0* para volver._";
  return msg;
}

async function handleTenantNewDescription(
  tenantId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const buildingName = ctx.building_name as string;

  if (body.trim() === "0") {
    await updateSession(tenantId, "tenant_menu", ctx);
    return tenantMenu(buildingName);
  }

  const description = body.trim();
  if (!description) {
    return "Escribí una descripción del problema:";
  }

  await updateSession(tenantId, "tenant_new_category", {
    ...ctx,
    description,
  });

  return categoryMenu();
}

async function handleTenantNewCategory(
  tenantId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  if (body.trim() === "0") {
    await updateSession(tenantId, "tenant_new_description", ctx);
    return "📝 Describí el problema o lo que necesitás que se arregle.\n\n🎤 _También podés enviar un audio._\n\n_Enviá *0* para volver al menú._";
  }

  const choice = parseInt(body.trim(), 10);

  if (isNaN(choice) || choice < 1 || choice > CATEGORIES.length) {
    return `Enviá un número entre 1 y ${CATEGORIES.length}, o *0* para volver.`;
  }

  const category = CATEGORIES[choice - 1]!;
  await updateSession(tenantId, "tenant_new_urgency", {
    ...ctx,
    category,
  });

  return "⚠️ *Urgencia:*\n\n1. Baja - puede esperar\n2. Normal\n3. Urgente - necesita atención inmediata\n\n_Respondé con el número o *0* para volver._";
}

async function handleTenantNewUrgency(
  tenantId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  if (body.trim() === "0") {
    await updateSession(tenantId, "tenant_new_category", ctx);
    return categoryMenu();
  }

  const choice = parseInt(body.trim(), 10);
  const urgencyMap: Record<number, string> = { 1: "baja", 2: "normal", 3: "urgente" };

  if (!urgencyMap[choice]) {
    return "Enviá 1, 2 o 3, o *0* para volver.";
  }

  const urgency = urgencyMap[choice]!;
  await updateSession(tenantId, "tenant_new_photos", {
    ...ctx,
    urgency,
    photo_urls: [],
  });

  return "📸 Enviá fotos del problema (opcional).\n\nCuando termines, escribí *LISTO*.\nSi no tenés fotos, escribí *LISTO* directamente.\n\n_Enviá *0* para volver._";
}

async function handleTenantNewPhotos(
  tenantId: string,
  body: string,
  ctx: Record<string, unknown>,
  photoFileIds: string[]
): Promise<string> {
  const photos = (ctx.photo_urls as string[]) || [];

  if (body.trim() === "0" && photoFileIds.length === 0) {
    await updateSession(tenantId, "tenant_new_urgency", ctx);
    return "⚠️ *Urgencia:*\n\n1. Baja - puede esperar\n2. Normal\n3. Urgente - necesita atención inmediata\n\n_Respondé con el número o *0* para volver._";
  }

  if (photoFileIds.length > 0) {
    for (const fileId of photoFileIds) {
      const publicUrl = await uploadMediaFromTelegram(fileId, "incoming", "request-photos");
      if (publicUrl) photos.push(publicUrl);
    }
    await updateSession(tenantId, "tenant_new_photos", {
      ...ctx,
      photo_urls: photos,
    });
    return `📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""} recibida${photos.length !== 1 ? "s" : ""}. Seguí enviando o escribí *LISTO*.`;
  }

  if (body.trim().toUpperCase() === "LISTO") {
    const buildingId = ctx.building_id as string;
    const buildingName = ctx.building_name as string;
    const description = ctx.description as string;
    const category = ctx.category as string;
    const urgency = ctx.urgency as string;

    const { data: request, error } = await supabase
      .from("tenant_requests")
      .insert({
        building_id: buildingId,
        tenant_id: tenantId,
        description,
        category,
        urgency,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !request) {
      await updateSession(tenantId, "tenant_menu", {
        building_id: buildingId,
        building_name: buildingName,
      });
      return `❌ Error al crear el reclamo. Intentá de nuevo.\n\n${tenantMenu(buildingName)}`;
    }

    for (const url of photos) {
      await supabase.from("request_media").insert({
        request_id: request.id,
        url,
      });
    }

    await updateSession(tenantId, "tenant_menu", {
      building_id: buildingId,
      building_name: buildingName,
    });

    const urgencyLabel = urgency === "urgente" ? "🔴 Urgente" : urgency === "baja" ? "🟢 Baja" : "🟡 Normal";

    return `✅ *Reclamo registrado*\n\n📝 ${description}\n🏷️ ${category}\n${urgencyLabel}\n📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""}\n\nTe vamos a avisar cuando haya novedades.\n\n${tenantMenu(buildingName)}`;
  }

  return "Enviá fotos, escribí *LISTO* cuando termines, o *0* para volver.";
}

// ══════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update = await req.json();

    // Telegram sends updates with a message object
    const message = update.message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const phone = message.contact?.phone_number || null;

    // We identify users by their Telegram chat ID stored in phone_number field
    // Telegram chat IDs are numeric, stored as string in phone_number
    const telegramId = String(chatId);

    // Extract text body and media
    let body = "";
    const photoFileIds: string[] = [];
    let audioFileId: string | null = null;

    if (message.text) {
      body = message.text;
    }

    if (message.photo) {
      // Telegram sends multiple sizes, pick the largest (last one)
      const largestPhoto = message.photo[message.photo.length - 1];
      photoFileIds.push(largestPhoto.file_id);
      body = message.caption || "";
    }

    if (message.voice) {
      audioFileId = message.voice.file_id;
    }

    if (message.audio) {
      audioFileId = message.audio.file_id;
    }

    // ── Audio transcription ──
    if (audioFileId) {
      const transcribed = await transcribeAudio(audioFileId);
      if (transcribed && !transcribed.startsWith("[")) {
        body = transcribed;
        console.log(`Audio transcribed: "${transcribed.substring(0, 100)}"`);
      } else {
        if (!body) body = transcribed;
      }
    }

    // Identify: supervisor or tenant?
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("id")
      .eq("phone_number", telegramId)
      .single();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, building_id, name")
      .eq("phone_number", telegramId)
      .single();

    if (!supervisor && !tenant) {
      await sendTelegramMessage(
        chatId,
        "❌ Tu cuenta de Telegram no está registrada en Consorcia.\n\nSi sos inquilino o supervisor, pedile al administrador que te registre con tu ID: `" + telegramId + "`"
      );
      return new Response("OK", { status: 200 });
    }

    // If both supervisor and tenant, check for role selection session or ask
    let isSupervisor = !!supervisor && !tenant;
    let entityId: string;

    if (supervisor && tenant) {
      const { data: supSession } = await supabase
        .from("telegram_sessions")
        .select("entity_id, state")
        .eq("entity_id", supervisor.id)
        .single();
      const { data: tenantSession } = await supabase
        .from("telegram_sessions")
        .select("entity_id, state")
        .eq("entity_id", tenant.id)
        .single();

      if (supSession && supSession.state !== "idle" && (!tenantSession || tenantSession.state === "idle")) {
        isSupervisor = true;
        entityId = supervisor.id;
      } else if (tenantSession && tenantSession.state !== "idle" && (!supSession || supSession.state === "idle")) {
        isSupervisor = false;
        entityId = tenant.id;
      } else if (body.trim() === "S" || body.trim() === "s") {
        isSupervisor = true;
        entityId = supervisor.id;
        await updateSession(entityId, "idle", {});
      } else if (body.trim() === "I" || body.trim() === "i") {
        isSupervisor = false;
        entityId = tenant.id;
        await updateSession(entityId, "idle", {});
      } else {
        await sendTelegramMessage(
          chatId,
          "👋 Hola! Tu cuenta está registrada como *supervisor* e *inquilino*.\n\n*S* — Entrar como supervisor\n*I* — Entrar como inquilino\n\n_Respondé con la letra_"
        );
        return new Response("OK", { status: 200 });
      }
    } else {
      entityId = supervisor ? supervisor.id : tenant!.id;
    }

    const session = await getOrCreateSession(entityId);
    const ctx = session.context;

    // Session timeout — reset if inactive for 30+ minutes
    const lastUpdate = new Date(session.updated_at).getTime();
    const now = Date.now();
    if (now - lastUpdate > 30 * 60 * 1000 && session.state !== "idle") {
      await updateSession(entityId, "idle", {});
      if (isSupervisor) {
        const reply = await handleSupervisorIdle(entityId, body);
        await sendTelegramMessage(chatId, reply);
        return new Response("OK", { status: 200 });
      } else {
        const reply = await handleTenantIdle(entityId, tenant!);
        await sendTelegramMessage(chatId, reply);
        return new Response("OK", { status: 200 });
      }
    }

    let reply: string;

    if (isSupervisor) {
      switch (session.state) {
        case "idle":
          reply = await handleSupervisorIdle(entityId, body);
          break;
        case "sup_select_building":
          reply = await handleSupSelectBuilding(entityId, body, ctx);
          break;
        case "sup_building_menu":
          reply = await handleSupBuildingMenu(entityId, body, ctx);
          break;
        case "sup_new_job_photos":
          reply = await handleSupNewJobPhotos(entityId, body, ctx, photoFileIds);
          break;
        case "sup_new_job_description":
          reply = await handleSupNewJobDescription(entityId, body, ctx);
          break;
        case "sup_complete_select_job":
          reply = await handleSupCompleteSelectJob(entityId, body, ctx);
          break;
        case "sup_complete_job_photos":
          reply = await handleSupCompleteJobPhotos(entityId, body, ctx, photoFileIds);
          break;
        case "sup_complete_job_expense":
          reply = await handleSupCompleteJobExpense(entityId, body, ctx);
          break;
        case "sup_expense_amount":
          reply = await handleSupExpenseAmount(entityId, body, ctx);
          break;
        case "sup_expense_provider":
          reply = await handleSupExpenseProvider(entityId, body, ctx);
          break;
        case "sup_expense_category":
          reply = await handleSupExpenseCategory(entityId, body, ctx);
          break;
        default:
          await updateSession(entityId, "idle", {});
          reply = await handleSupervisorIdle(entityId, body);
      }
    } else {
      switch (session.state) {
        case "idle":
          reply = await handleTenantIdle(entityId, tenant!);
          break;
        case "tenant_menu":
          reply = await handleTenantMenu(entityId, body, ctx);
          break;
        case "tenant_new_description":
          reply = await handleTenantNewDescription(entityId, body, ctx);
          break;
        case "tenant_new_category":
          reply = await handleTenantNewCategory(entityId, body, ctx);
          break;
        case "tenant_new_urgency":
          reply = await handleTenantNewUrgency(entityId, body, ctx);
          break;
        case "tenant_new_photos":
          reply = await handleTenantNewPhotos(entityId, body, ctx, photoFileIds);
          break;
        default:
          await updateSession(entityId, "idle", {});
          reply = await handleTenantIdle(entityId, tenant!);
      }
    }

    await sendTelegramMessage(chatId, reply);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});
