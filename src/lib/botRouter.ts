/**
 * Bot Router — the brain of the WhatsApp supervisor bot.
 *
 * Handles free-form messages using intent parsing (Groq LLM) and
 * manages conversational state via whatsapp_sessions in Supabase.
 *
 * This is the canonical source of truth for the bot logic.
 * The edge function (whatsapp-webhook) replicates this logic in Deno runtime.
 */

import { supabase } from "./supabase";
import type { Job } from "@/types/database";
import { parseIntent } from "./intentParser";

// ── Types ──

interface Session {
  id: string;
  supervisor_id: string;
  state: string;
  context: Record<string, unknown>;
  active_building_id: string | null;
  active_building_name: string | null;
  pending_media: string[];
  pending_description: string | null;
  last_intent: string | null;
  pending_job_id: string | null;
  updated_at: string;
}

interface SupervisorBuilding {
  id: string;
  name: string;
  address: string;
}

// ── Config ──

// GROQ_API_KEY lives server-side only (Supabase edge function secrets).
// botRouter.ts is a reference implementation — the real execution happens in the edge function.
const GROQ_API_KEY = "";

// ── Session helpers ──

async function getSession(supervisorId: string): Promise<Session> {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("supervisor_id", supervisorId)
    .single();

  if (data) return data as Session;

  const { data: created } = await supabase
    .from("whatsapp_sessions")
    .insert({
      supervisor_id: supervisorId,
      state: "idle",
      context: {},
      pending_media: [],
    })
    .select()
    .single();

  return created as Session;
}

async function updateSession(
  supervisorId: string,
  updates: Partial<Pick<Session, "state" | "context" | "active_building_id" | "active_building_name" | "pending_media" | "pending_description" | "last_intent" | "pending_job_id">>
): Promise<void> {
  await supabase
    .from("whatsapp_sessions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("supervisor_id", supervisorId);
}

// ── Helpers ──

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

async function getSupervisorBuildings(supervisorId: string): Promise<SupervisorBuilding[]> {
  const { data } = await supabase
    .from("buildings")
    .select("id, name, address")
    .eq("supervisor_id", supervisorId)
    .order("name");
  return (data ?? []) as SupervisorBuilding[];
}

async function getPendingJobs(buildingId: string): Promise<Job[]> {
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .eq("building_id", buildingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as Job[];
}

async function uploadMediaFromUrl(
  url: string,
  jobId: string,
  type: "before" | "after"
): Promise<string | null> {
  // This is a placeholder — in the edge function, this downloads from Twilio
  // and uploads to Supabase Storage. Here it's for reference/testing.
  // The actual implementation lives in the edge function.
  try {
    const path = `jobs/${jobId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
    if (error) return null;
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

// ── Response builders ──

function buildingListMessage(buildings: SupervisorBuilding[]): string {
  let msg = "🏢 *Seleccioná un edificio:*\n\n";
  buildings.forEach((b, i) => {
    msg += `${i + 1}. ${b.name}\n   📍 ${b.address}\n`;
  });
  msg += "\n_Respondé con el número o el nombre del edificio_";
  return msg;
}

function buildingMenu(name: string): string {
  return `📋 *${name}*\n\nPodés:\n• Decirme qué trabajo hay que hacer\n• Pedir ver los pendientes\n• Mandar fotos de un trabajo\n• Completar un trabajo\n\n_O escribí un número:_\n1. Nuevo trabajo\n2. Completar pendiente\n3. Ver pendientes\n4. Cambiar edificio\n5. Salir`;
}

function helpMessage(): string {
  return `🤖 *¿Cómo puedo ayudarte?*\n\nSoy el bot de Consorcia. Podés hablarme naturalmente:\n\n📝 *Crear trabajo:* "Hay una pérdida en el 3er piso del Edificio Rivadavia"\n📋 *Ver pendientes:* "Qué tengo pendiente en Torre Belgrano"\n✅ *Completar:* "Terminé el arreglo del ascensor"\n🏢 *Cambiar edificio:* "Vamos al edificio Libertador"\n\n📸 También podés mandar fotos y audios.\n🎤 Podés enviar un audio describiendo el problema.\n\n_Probá decirme algo!_`;
}

// ── Main handler ──

export async function handleMessage(
  supervisorId: string,
  message: string,
  imageUrls: string[],
  _mediaTypes: string[]
): Promise<string> {
  const session = await getSession(supervisorId);
  const buildings = await getSupervisorBuildings(supervisorId);

  if (buildings.length === 0) {
    return "No tenés edificios asignados. Contactá al administrador.";
  }

  // Session timeout — reset after 30 min inactive
  const lastUpdate = new Date(session.updated_at).getTime();
  if (Date.now() - lastUpdate > 30 * 60 * 1000 && session.state !== "idle") {
    await updateSession(supervisorId, { state: "idle", pending_media: [], pending_description: null, pending_job_id: null, last_intent: null });
  }

  const trimmed = message.trim();
  const activeBuildingId = session.active_building_id;
  const activeBuildingName = session.active_building_name;

  // ── State: waiting_photos_before (supervisor sent description, we need photos) ──
  if (session.state === "waiting_photos_before") {
    if (imageUrls.length > 0) {
      const pending = [...(session.pending_media || []), ...imageUrls];
      await updateSession(supervisorId, { pending_media: pending });
      if (trimmed.toUpperCase() === "LISTO" || trimmed === "") {
        return await createJobWithMedia(supervisorId, session, pending);
      }
      return `📸 ${pending.length} foto${pending.length !== 1 ? "s" : ""} recibida${pending.length !== 1 ? "s" : ""}. Seguí mandando o escribí *LISTO*.`;
    }
    if (trimmed.toUpperCase() === "LISTO") {
      return await createJobWithMedia(supervisorId, session, session.pending_media || []);
    }
    return "Mandá las fotos del *ANTES* del trabajo, o escribí *LISTO* para crear sin fotos.";
  }

  // ── State: waiting_description (supervisor sent photos, we need description) ──
  if (session.state === "waiting_description") {
    if (imageUrls.length > 0) {
      // More photos — accumulate
      const pending = [...(session.pending_media || []), ...imageUrls];
      await updateSession(supervisorId, { pending_media: pending });
      return `📸 ${pending.length} foto${pending.length !== 1 ? "s" : ""} recibida${pending.length !== 1 ? "s" : ""}. Ahora escribí una descripción del trabajo.`;
    }
    if (trimmed) {
      await updateSession(supervisorId, { pending_description: trimmed });
      return await createJobWithMedia(supervisorId, session, session.pending_media || [], trimmed);
    }
    return "📝 Escribí una descripción corta del trabajo:\n\n🎤 _También podés enviar un audio._";
  }

  // ── State: waiting_photos_after (completing a job, need after photos) ──
  if (session.state === "waiting_photos_after") {
    if (imageUrls.length > 0) {
      const pending = [...(session.pending_media || []), ...imageUrls];
      await updateSession(supervisorId, { pending_media: pending });
      if (trimmed.toUpperCase() === "LISTO") {
        return await completeJobWithMedia(supervisorId, session, pending);
      }
      return `📸 ${pending.length} foto${pending.length !== 1 ? "s" : ""} recibida${pending.length !== 1 ? "s" : ""}. Seguí mandando o escribí *LISTO*.`;
    }
    if (trimmed.toUpperCase() === "LISTO") {
      return await completeJobWithMedia(supervisorId, session, session.pending_media || []);
    }
    return "Mandá las fotos del *DESPUÉS* del trabajo, o escribí *LISTO* sin fotos.";
  }

  // ── State: waiting_expense (ask if there was expense) ──
  if (session.state === "waiting_expense") {
    const c = trimmed.toLowerCase();
    if (c === "2" || c === "no") {
      await updateSession(supervisorId, { state: "idle", pending_job_id: null, last_intent: null });
      return `✅ *Trabajo completado*\n\n${buildingMenu(activeBuildingName || "Edificio")}`;
    }
    if (c === "1" || c === "si" || c === "sí") {
      await updateSession(supervisorId, { state: "waiting_expense_amount" });
      return "💲 Ingresá el monto del gasto (solo el número):";
    }
    return "Respondé *1* (Sí) o *2* (No).";
  }

  // ── State: waiting_expense_amount ──
  if (session.state === "waiting_expense_amount") {
    const amount = parseFloat(trimmed.replace(",", ".").replace("$", ""));
    if (isNaN(amount)) return "Ingresá un número válido (ej: 15000):";
    if (session.pending_job_id) {
      await supabase.from("jobs").update({ expense_amount: amount }).eq("id", session.pending_job_id);
    }
    await updateSession(supervisorId, { state: "waiting_expense_provider" });
    return "🏪 Ingresá el nombre del proveedor (o *-* para omitir):";
  }

  // ── State: waiting_expense_provider ──
  if (session.state === "waiting_expense_provider") {
    const provider = trimmed === "-" ? null : trimmed;
    if (provider && session.pending_job_id) {
      await supabase.from("jobs").update({ expense_provider: provider }).eq("id", session.pending_job_id);
    }
    await updateSession(supervisorId, { state: "waiting_expense_category" });
    return "🏷️ Categoría del gasto (ej: plomería, electricidad) o *-* para omitir:";
  }

  // ── State: waiting_expense_category ──
  if (session.state === "waiting_expense_category") {
    const category = trimmed === "-" ? null : trimmed;
    if (category && session.pending_job_id) {
      await supabase.from("jobs").update({ expense_category: category }).eq("id", session.pending_job_id);
    }
    await updateSession(supervisorId, { state: "idle", pending_job_id: null, last_intent: null });
    return `✅ *Gasto registrado.*\n\n${buildingMenu(activeBuildingName || "Edificio")}`;
  }

  // ── State: select_job_to_complete (picking from a numbered list) ──
  if (session.state === "select_job_to_complete") {
    const pendingJobs = (session.context?.pending_jobs_list ?? []) as { id: string; desc: string }[];
    const choice = parseInt(trimmed, 10);
    if (!isNaN(choice) && choice >= 1 && choice <= pendingJobs.length) {
      const selected = pendingJobs[choice - 1]!;
      await updateSession(supervisorId, {
        state: "waiting_photos_after",
        pending_job_id: selected.id,
        pending_media: [],
        context: { ...session.context, completing_job_desc: selected.desc },
      });
      return `📸 *Completar: ${selected.desc}*\n\nMandá las fotos del *DESPUÉS*.\nCuando termines, escribí *LISTO*.`;
    }
    return `Enviá un número entre 1 y ${pendingJobs.length}.`;
  }

  // ── State: select_building (picking from numbered list) ──
  if (session.state === "select_building") {
    const choice = parseInt(trimmed, 10);
    if (!isNaN(choice) && choice >= 1 && choice <= buildings.length) {
      const bld = buildings[choice - 1]!;
      await updateSession(supervisorId, {
        state: "idle",
        active_building_id: bld.id,
        active_building_name: bld.name,
      });
      return `🏢 *${bld.name}* seleccionado.\n\n${buildingMenu(bld.name)}`;
    }
    // Try NLP match for building name
    if (trimmed.length > 2) {
      const intent = await parseIntent(trimmed, buildings.map(b => ({ id: b.id, name: b.name })), GROQ_API_KEY);
      if (intent.building_id) {
        const bld = buildings.find(b => b.id === intent.building_id)!;
        await updateSession(supervisorId, {
          state: "idle",
          active_building_id: bld.id,
          active_building_name: bld.name,
        });
        return `🏢 *${bld.name}* seleccionado.\n\n${buildingMenu(bld.name)}`;
      }
    }
    return `Enviá un número entre 1 y ${buildings.length}.`;
  }

  // ══════════════════════════════════════
  // FREE-FORM MESSAGE — parse intent
  // ══════════════════════════════════════

  // If supervisor just sent photos without text in idle state
  if (imageUrls.length > 0 && !trimmed) {
    if (!activeBuildingId) {
      // No building selected — ask
      await updateSession(supervisorId, { state: "select_building", pending_media: imageUrls });
      return `Recibí ${imageUrls.length} foto${imageUrls.length !== 1 ? "s" : ""}. ¿Para qué edificio?\n\n${buildingListMessage(buildings)}`;
    }
    // Building selected, save photos and ask for description
    await updateSession(supervisorId, {
      state: "waiting_description",
      pending_media: imageUrls,
      last_intent: "new_job",
    });
    return `📸 ${imageUrls.length} foto${imageUrls.length !== 1 ? "s" : ""} recibida${imageUrls.length !== 1 ? "s" : ""} para *${activeBuildingName}*.\n\n📝 Escribí una descripción del trabajo:\n\n🎤 _También podés enviar un audio._`;
  }

  // Parse intent with NLP
  const intent = await parseIntent(
    trimmed,
    buildings.map(b => ({ id: b.id, name: b.name })),
    GROQ_API_KEY
  );

  await updateSession(supervisorId, { last_intent: intent.intent });
  console.log("botRouter intent:", JSON.stringify(intent));

  // Resolve building: from intent, from session, or auto (if only one)
  let buildingId = intent.building_id || activeBuildingId;
  let buildingName = intent.building_name || activeBuildingName;

  if (!buildingId && buildings.length === 1) {
    buildingId = buildings[0]!.id;
    buildingName = buildings[0]!.name;
  }

  // If intent identified a building, save it as active
  if (intent.building_id && intent.building_id !== activeBuildingId) {
    await updateSession(supervisorId, {
      active_building_id: intent.building_id,
      active_building_name: intent.building_name,
    });
  }

  // ── Route by intent ──

  switch (intent.intent) {

    case "new_job": {
      if (!buildingId) {
        await updateSession(supervisorId, { state: "select_building", last_intent: "new_job", pending_description: intent.description });
        return `¿En qué edificio?\n\n${buildingListMessage(buildings)}`;
      }

      // Has building + description + photos → create directly
      if (intent.description && imageUrls.length > 0) {
        const { data: job } = await supabase.from("jobs").insert({
          building_id: buildingId, description_original: intent.description, status: "pending",
        }).select("id").single();

        if (job) {
          for (const url of imageUrls) {
            const publicUrl = await uploadMediaFromUrl(url, job.id, "before");
            if (publicUrl) await supabase.from("media").insert({ job_id: job.id, type: "before", url: publicUrl });
          }
          await updateSession(supervisorId, { state: "idle", active_building_id: buildingId, active_building_name: buildingName, pending_media: [], pending_description: null });
          return `✅ *Trabajo creado en ${buildingName}*\n📝 ${intent.description}\n📸 ${imageUrls.length} foto${imageUrls.length !== 1 ? "s" : ""}\n\n${buildingMenu(buildingName!)}`;
        }
      }

      // Has building + description, no photos → ask for photos
      if (intent.description) {
        await updateSession(supervisorId, {
          state: "waiting_photos_before",
          active_building_id: buildingId,
          active_building_name: buildingName,
          pending_description: intent.description,
          pending_media: imageUrls,
        });
        return `📸 *Nuevo trabajo en ${buildingName}:* ${intent.description}\n\nMandá las fotos del *ANTES*.\nCuando termines, escribí *LISTO* (o *LISTO* ahora para crear sin fotos).`;
      }

      // Has building + photos, no description → ask for description
      if (imageUrls.length > 0) {
        await updateSession(supervisorId, {
          state: "waiting_description",
          active_building_id: buildingId,
          active_building_name: buildingName,
          pending_media: imageUrls,
        });
        return `📸 ${imageUrls.length} foto${imageUrls.length !== 1 ? "s" : ""} recibida${imageUrls.length !== 1 ? "s" : ""}.\n\n📝 Escribí una descripción del trabajo:`;
      }

      // Has building, no description, no photos → ask for photos first
      await updateSession(supervisorId, {
        state: "waiting_photos_before",
        active_building_id: buildingId,
        active_building_name: buildingName,
        pending_media: [],
        pending_description: null,
      });
      return `📸 *Nuevo trabajo en ${buildingName}*\n\nMandá las fotos del *ANTES*.\nCuando termines, escribí *LISTO*.\n\n🎤 _También podés enviar un audio._`;
    }

    case "complete_job": {
      if (!buildingId) {
        await updateSession(supervisorId, { state: "select_building", last_intent: "complete_job" });
        return `¿En qué edificio?\n\n${buildingListMessage(buildings)}`;
      }

      const pending = await getPendingJobs(buildingId);
      if (pending.length === 0) {
        return `No hay trabajos pendientes en ${buildingName}.\n\n${buildingMenu(buildingName!)}`;
      }

      // If job_reference, try to fuzzy-match
      if (intent.job_reference) {
        const ref = intent.job_reference.toLowerCase();
        const match = pending.find(j => j.description_original.toLowerCase().includes(ref));
        if (match) {
          await updateSession(supervisorId, {
            state: "waiting_photos_after",
            active_building_id: buildingId,
            active_building_name: buildingName,
            pending_job_id: match.id,
            pending_media: imageUrls,
            context: { ...({} as Record<string, unknown>), completing_job_desc: match.description_original },
          });
          if (imageUrls.length > 0) {
            return `📸 Fotos recibidas para *${match.description_original}*.\nSeguí mandando o escribí *LISTO*.`;
          }
          return `📸 *Completar: ${match.description_original}*\n\nMandá las fotos del *DESPUÉS*.\nCuando termines, escribí *LISTO*.`;
        }
      }

      // Show numbered list
      await updateSession(supervisorId, {
        state: "select_job_to_complete",
        active_building_id: buildingId,
        active_building_name: buildingName,
        context: { pending_jobs_list: pending.map(j => ({ id: j.id, desc: j.description_original })) },
      });
      let msg = "✅ *¿Cuál trabajo completaste?*\n\n";
      pending.forEach((j, i) => { msg += `${i + 1}. ${j.description_original}\n   📅 ${formatDate(j.created_at)}\n`; });
      msg += "\n_Respondé con el número_";
      return msg;
    }

    case "list_pending": {
      if (!buildingId) {
        if (buildings.length === 1) {
          buildingId = buildings[0]!.id;
          buildingName = buildings[0]!.name;
        } else {
          await updateSession(supervisorId, { state: "select_building", last_intent: "list_pending" });
          return `¿De qué edificio?\n\n${buildingListMessage(buildings)}`;
        }
      }

      const pending = await getPendingJobs(buildingId);
      if (pending.length === 0) {
        return `No hay trabajos pendientes en ${buildingName}.\n\n${buildingMenu(buildingName!)}`;
      }

      await updateSession(supervisorId, { active_building_id: buildingId, active_building_name: buildingName });
      let msg = `📋 *Pendientes en ${buildingName}:*\n\n`;
      pending.forEach((j, i) => { msg += `${i + 1}. ${j.description_original}\n   📅 ${formatDate(j.created_at)}\n`; });
      msg += `\n${buildingMenu(buildingName!)}`;
      return msg;
    }

    case "select_building": {
      if (intent.building_id) {
        const bld = buildings.find(b => b.id === intent.building_id);
        if (bld) {
          await updateSession(supervisorId, { state: "idle", active_building_id: bld.id, active_building_name: bld.name });
          return `🏢 *${bld.name}* seleccionado.\n\n${buildingMenu(bld.name)}`;
        }
      }
      await updateSession(supervisorId, { state: "select_building" });
      return buildingListMessage(buildings);
    }

    case "help": {
      return helpMessage();
    }

    case "unknown":
    default: {
      // If we have an active building, show its menu
      if (activeBuildingId && activeBuildingName) {
        return `No entendí. 🤔\n\n${buildingMenu(activeBuildingName)}`;
      }
      // No building selected
      if (buildings.length === 1) {
        const bld = buildings[0]!;
        await updateSession(supervisorId, { active_building_id: bld.id, active_building_name: bld.name });
        return `No entendí. 🤔\n\n${buildingMenu(bld.name)}`;
      }
      return `No entendí. Podés decirme cosas como:\n\n• "Creá un trabajo nuevo en ${buildings[0]!.name}"\n• "Mostrame los pendientes"\n• "Ayuda"\n\n${buildingListMessage(buildings)}`;
    }
  }
}

// ── Job creation helper ──

async function createJobWithMedia(
  supervisorId: string,
  session: Session,
  mediaUrls: string[],
  descriptionOverride?: string
): Promise<string> {
  const buildingId = session.active_building_id;
  const buildingName = session.active_building_name || "Edificio";
  const description = descriptionOverride || session.pending_description;

  if (!buildingId || !description) {
    await updateSession(supervisorId, { state: "waiting_description", pending_media: mediaUrls });
    return "📝 Escribí una descripción del trabajo:";
  }

  const { data: job, error } = await supabase.from("jobs").insert({
    building_id: buildingId,
    description_original: description,
    status: "pending",
  }).select("id").single();

  if (error || !job) {
    await updateSession(supervisorId, { state: "idle", pending_media: [], pending_description: null });
    return `❌ Error al crear el trabajo.\n\n${buildingMenu(buildingName)}`;
  }

  // Upload photos
  let photoCount = 0;
  for (const url of mediaUrls) {
    const publicUrl = await uploadMediaFromUrl(url, job.id, "before");
    if (publicUrl) {
      await supabase.from("media").insert({ job_id: job.id, type: "before", url: publicUrl });
      photoCount++;
    }
  }

  await updateSession(supervisorId, { state: "idle", pending_media: [], pending_description: null, last_intent: null });

  return `✅ *Trabajo creado en ${buildingName}*\n📝 ${description}\n📸 ${photoCount} foto${photoCount !== 1 ? "s" : ""}\n\n${buildingMenu(buildingName)}`;
}

// ── Job completion helper ──

async function completeJobWithMedia(
  supervisorId: string,
  session: Session,
  mediaUrls: string[]
): Promise<string> {
  const jobId = session.pending_job_id;
  const buildingName = session.active_building_name || "Edificio";
  const jobDesc = (session.context?.completing_job_desc as string) || "Trabajo";

  if (!jobId) {
    await updateSession(supervisorId, { state: "idle", pending_media: [] });
    return `❌ Error: no se encontró el trabajo.\n\n${buildingMenu(buildingName)}`;
  }

  // Upload after photos
  for (const url of mediaUrls) {
    const publicUrl = await uploadMediaFromUrl(url, jobId, "after");
    if (publicUrl) {
      await supabase.from("media").insert({ job_id: jobId, type: "after", url: publicUrl });
    }
  }

  // Mark as completed
  await supabase.from("jobs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", jobId);

  await updateSession(supervisorId, { state: "waiting_expense", pending_media: [] });

  return `✅ *Trabajo completado*\n📝 ${jobDesc}\n📸 ${mediaUrls.length} foto${mediaUrls.length !== 1 ? "s" : ""}\n\n💰 ¿Querés cargar un gasto?\n\n1. Sí\n2. No`;
}
