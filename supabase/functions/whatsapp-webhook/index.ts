import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Types ──

interface Session {
  id: string;
  supervisor_id: string;
  state: string;
  context: Record<string, unknown>;
  updated_at: string;
}

interface TwilioMessage {
  From: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaUrl1?: string;
  MediaUrl2?: string;
  MediaUrl3?: string;
  MediaUrl4?: string;
  MediaUrl5?: string;
  MediaUrl6?: string;
  MediaUrl7?: string;
  MediaUrl8?: string;
  MediaUrl9?: string;
  MediaContentType0?: string;
}

// ── Helpers ──

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFormData(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [key, val] = pair.split("=");
    if (key && val !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(val.replace(/\+/g, " "));
    }
  }
  return params;
}

function getMediaUrls(msg: TwilioMessage): string[] {
  const urls: string[] = [];
  const count = parseInt(msg.NumMedia || "0", 10);
  for (let i = 0; i < count; i++) {
    const url = (msg as Record<string, string>)[`MediaUrl${i}`];
    if (url) urls.push(url);
  }
  return urls;
}

async function uploadMediaFromUrl(
  url: string,
  jobId: string,
  type: "before" | "after"
): Promise<string | null> {
  try {
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
    const authHeader = "Basic " + btoa(`${twilioSid}:${twilioToken}`);
    const resp = await fetch(url, {
      headers: { Authorization: authHeader },
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const blob = await resp.blob();
    const path = `jobs/${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("media")
      .upload(path, blob, { contentType });

    if (error) return null;

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

async function getOrCreateSession(supervisorId: string): Promise<Session> {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("supervisor_id", supervisorId)
    .single();

  if (data) return data as Session;

  const { data: created } = await supabase
    .from("whatsapp_sessions")
    .insert({ supervisor_id: supervisorId, state: "idle", context: {} })
    .select()
    .single();

  return created as Session;
}

async function updateSession(
  supervisorId: string,
  state: string,
  context: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("whatsapp_sessions")
    .update({ state, context, updated_at: new Date().toISOString() })
    .eq("supervisor_id", supervisorId);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

// ── State handlers ──

async function handleIdle(
  supervisorId: string,
  _body: string
): Promise<string> {
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name, address")
    .eq(
      "supervisor_id",
      supervisorId
    )
    .order("name");

  const list = (buildings || []) as { id: string; name: string; address: string }[];

  if (list.length === 0) {
    return "No tenés edificios asignados. Contactá al administrador.";
  }

  await updateSession(supervisorId, "select_building", {
    buildings: list.map((b) => ({ id: b.id, name: b.name })),
  });

  let msg = "🏢 *Seleccioná un edificio:*\n\n";
  list.forEach((b, i) => {
    msg += `${i + 1}. ${b.name}\n   📍 ${b.address}\n`;
  });
  msg += "\n_Respondé con el número_";
  return msg;
}

async function handleSelectBuilding(
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
  await updateSession(supervisorId, "building_menu", {
    building_id: selected.id,
    building_name: selected.name,
  });

  return buildingMenu(selected.name);
}

function buildingMenu(name: string): string {
  return `📋 *${name}*\n\n1. Nuevo trabajo\n2. Completar trabajo pendiente\n3. Ver pendientes\n4. Cambiar edificio\n5. Salir\n\n_Respondé con el número_`;
}

async function handleBuildingMenu(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const choice = body.trim();
  const buildingId = ctx.building_id as string;
  const buildingName = ctx.building_name as string;

  switch (choice) {
    case "1": {
      // New job — ask for before photos
      await updateSession(supervisorId, "new_job_photos", {
        ...ctx,
        photo_urls: [],
      });
      return "📸 *Nuevo trabajo*\n\nEnviá las fotos del *ANTES* del trabajo.\n\nCuando termines, escribí *LISTO*.";
    }
    case "2": {
      // Complete job — show pending list
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

      await updateSession(supervisorId, "complete_select_job", {
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
      // View pending
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
      // Change building
      return handleIdle(supervisorId, "");
    }
    case "5": {
      // Exit
      await updateSession(supervisorId, "idle", {});
      return "👋 ¡Hasta luego! Enviá cualquier mensaje para volver a empezar.";
    }
    default:
      return "Enviá un número entre 1 y 5.";
  }
}

async function handleNewJobPhotos(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>,
  mediaUrls: string[]
): Promise<string> {
  const photos = (ctx.photo_urls as string[]) || [];

  // Collect photos
  if (mediaUrls.length > 0) {
    photos.push(...mediaUrls);
    await updateSession(supervisorId, "new_job_photos", {
      ...ctx,
      photo_urls: photos,
    });
    return `📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""} recibida${photos.length !== 1 ? "s" : ""}. Seguí enviando o escribí *LISTO*.`;
  }

  if (body.trim().toUpperCase() === "LISTO") {
    await updateSession(supervisorId, "new_job_description", {
      ...ctx,
      photo_urls: photos,
    });
    return "📝 Escribí una descripción corta del trabajo:";
  }

  return "Enviá fotos o escribí *LISTO* cuando termines.";
}

async function handleNewJobDescription(
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

  // Create job
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
    await updateSession(supervisorId, "building_menu", {
      building_id: buildingId,
      building_name: buildingName,
    });
    return `❌ Error al crear el trabajo.\n\n${buildingMenu(buildingName)}`;
  }

  // Upload before photos
  for (const url of photoUrls) {
    const publicUrl = await uploadMediaFromUrl(url, job.id, "before");
    if (publicUrl) {
      await supabase.from("media").insert({
        job_id: job.id,
        type: "before",
        url: publicUrl,
      });
    }
  }

  await updateSession(supervisorId, "building_menu", {
    building_id: buildingId,
    building_name: buildingName,
  });

  return `✅ *Trabajo creado*\n📝 ${description}\n📸 ${photoUrls.length} foto${photoUrls.length !== 1 ? "s" : ""}\n\n${buildingMenu(buildingName)}`;
}

async function handleCompleteSelectJob(
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
  await updateSession(supervisorId, "complete_job_photos", {
    ...ctx,
    job_id: selected.id,
    job_desc: selected.desc,
    photo_urls: [],
  });

  return `📸 *Completar: ${selected.desc}*\n\nEnviá las fotos del *DESPUÉS* del trabajo.\n\nCuando termines, escribí *LISTO*.`;
}

async function handleCompleteJobPhotos(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>,
  mediaUrls: string[]
): Promise<string> {
  const photos = (ctx.photo_urls as string[]) || [];

  if (mediaUrls.length > 0) {
    photos.push(...mediaUrls);
    await updateSession(supervisorId, "complete_job_photos", {
      ...ctx,
      photo_urls: photos,
    });
    return `📸 ${photos.length} foto${photos.length !== 1 ? "s" : ""} recibida${photos.length !== 1 ? "s" : ""}. Seguí enviando o escribí *LISTO*.`;
  }

  if (body.trim().toUpperCase() === "LISTO") {
    // Upload after photos
    const jobId = ctx.job_id as string;
    for (const url of photos) {
      const publicUrl = await uploadMediaFromUrl(url, jobId, "after");
      if (publicUrl) {
        await supabase.from("media").insert({
          job_id: jobId,
          type: "after",
          url: publicUrl,
        });
      }
    }

    await updateSession(supervisorId, "complete_job_expense", {
      ...ctx,
      photo_urls: photos,
    });

    return "💰 ¿Querés cargar un gasto?\n\n1. Sí\n2. No, completar sin gasto";
  }

  return "Enviá fotos o escribí *LISTO* cuando termines.";
}

async function handleCompleteJobExpense(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const choice = body.trim();

  if (choice === "2" || choice.toUpperCase() === "NO") {
    // Complete without expense
    return completeJob(supervisorId, ctx, null, null, null);
  }

  if (choice === "1" || choice.toUpperCase() === "SI" || choice.toUpperCase() === "SÍ") {
    await updateSession(supervisorId, "complete_job_expense_amount", ctx);
    return "💲 Ingresá el monto del gasto (solo el número):";
  }

  return "Respondé *1* (Sí) o *2* (No).";
}

async function handleExpenseAmount(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const amount = parseFloat(body.trim().replace(",", ".").replace("$", ""));

  if (isNaN(amount)) {
    return "Ingresá un número válido (ej: 15000):";
  }

  await updateSession(supervisorId, "complete_job_expense_provider", {
    ...ctx,
    expense_amount: amount,
  });

  return "🏪 Ingresá el nombre del proveedor (o escribí *-* para omitir):";
}

async function handleExpenseProvider(
  supervisorId: string,
  body: string,
  ctx: Record<string, unknown>
): Promise<string> {
  const provider = body.trim() === "-" ? null : body.trim();

  await updateSession(supervisorId, "complete_job_expense_category", {
    ...ctx,
    expense_provider: provider,
  });

  return "🏷️ Ingresá la categoría del gasto (ej: plomería, electricidad, limpieza) o *-* para omitir:";
}

async function handleExpenseCategory(
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

  await updateSession(supervisorId, "building_menu", {
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

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const bodyText = await req.text();
    const msg = parseFormData(bodyText) as unknown as TwilioMessage;
    const phone = msg.From?.replace("whatsapp:", "") || "";
    const body = msg.Body || "";
    const mediaUrls = getMediaUrls(msg);

    // Identify supervisor
    const { data: supervisor } = await supabase
      .from("supervisors")
      .select("id")
      .eq("phone_number", phone)
      .single();

    if (!supervisor) {
      return twiml(
        "❌ Tu número no está registrado. Contactá al administrador."
      );
    }

    const session = await getOrCreateSession(supervisor.id);
    const ctx = session.context;

    // Session timeout — reset if inactive for 30+ minutes
    const lastUpdate = new Date(session.updated_at).getTime();
    const now = Date.now();
    if (now - lastUpdate > 30 * 60 * 1000 && session.state !== "idle") {
      await updateSession(supervisor.id, "idle", {});
      const reply = await handleIdle(supervisor.id, body);
      return twiml(reply);
    }

    let reply: string;

    switch (session.state) {
      case "idle":
        reply = await handleIdle(supervisor.id, body);
        break;
      case "select_building":
        reply = await handleSelectBuilding(supervisor.id, body, ctx);
        break;
      case "building_menu":
        reply = await handleBuildingMenu(supervisor.id, body, ctx);
        break;
      case "new_job_photos":
        reply = await handleNewJobPhotos(supervisor.id, body, ctx, mediaUrls);
        break;
      case "new_job_description":
        reply = await handleNewJobDescription(supervisor.id, body, ctx);
        break;
      case "complete_select_job":
        reply = await handleCompleteSelectJob(supervisor.id, body, ctx);
        break;
      case "complete_job_photos":
        reply = await handleCompleteJobPhotos(
          supervisor.id,
          body,
          ctx,
          mediaUrls
        );
        break;
      case "complete_job_expense":
        reply = await handleCompleteJobExpense(supervisor.id, body, ctx);
        break;
      case "complete_job_expense_amount":
        reply = await handleExpenseAmount(supervisor.id, body, ctx);
        break;
      case "complete_job_expense_provider":
        reply = await handleExpenseProvider(supervisor.id, body, ctx);
        break;
      case "complete_job_expense_category":
        reply = await handleExpenseCategory(supervisor.id, body, ctx);
        break;
      default:
        await updateSession(supervisor.id, "idle", {});
        reply = await handleIdle(supervisor.id, body);
    }

    return twiml(reply);
  } catch (error) {
    console.error("Webhook error:", error);
    return twiml("❌ Ocurrió un error. Intentá de nuevo.");
  }
});
