/**
 * Intent parser for supervisor WhatsApp messages.
 * Uses Groq LLM (llama-3.3-70b-versatile) to extract structured intent from free-text messages.
 *
 * This module is the canonical source of truth for the parsing logic.
 * The same logic is replicated in the whatsapp-webhook edge function (Deno runtime).
 */

export interface Building {
  id: string;
  name: string;
}

export interface ParsedIntent {
  intent: "new_job" | "complete_job" | "list_pending" | "select_building" | "help" | "unknown";
  building_id: string | null;
  building_name: string | null;
  description: string | null;
  job_reference: string | null;
  confidence: number;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

function buildSystemPrompt(buildings: Building[]): string {
  const buildingList = buildings
    .map((b) => `- ID: "${b.id}" → Nombre: "${b.name}"`)
    .join("\n");

  return `Sos un asistente de gestión de edificios para una administradora de consorcios en Argentina.

Tu tarea es analizar el mensaje del supervisor y extraer la intención estructurada.

## Edificios del supervisor:
${buildingList || "(sin edificios asignados)"}

## Intenciones posibles:
- "new_job": El supervisor quiere reportar o crear un nuevo trabajo de mantenimiento. Ejemplos: "hay una pérdida en el 3er piso", "se rompió el ascensor", "pintar la entrada".
- "complete_job": El supervisor quiere marcar un trabajo como completado. Ejemplos: "terminé el arreglo del caño", "ya completé lo del ascensor".
- "list_pending": El supervisor quiere ver los trabajos pendientes. Ejemplos: "qué tengo pendiente", "mostrame los trabajos", "qué falta hacer".
- "select_building": El supervisor quiere seleccionar o cambiar de edificio. Ejemplos: "vamos al edificio Rivadavia", "cambiá a torre Belgrano".
- "help": El supervisor pide ayuda o no sabe qué hacer. Ejemplos: "ayuda", "cómo funciona", "qué puedo hacer".
- "unknown": No se puede determinar la intención.

## Reglas:
- Si el mensaje menciona un edificio (por nombre completo o parcial), matchealo contra la lista y devolvé su building_id y building_name exacto.
- Si menciona un trabajo específico para completar, poné la referencia en job_reference.
- Si describe un problema o trabajo nuevo, extraé la descripción limpia en description.
- confidence es un número entre 0 y 1 que indica qué tan seguro estás de la intención.
- Si no estás seguro (confidence < 0.6), usá intent "unknown".

## Formato de respuesta:
Respondé SOLO con un JSON válido, sin markdown, sin explicaciones:
{
  "intent": "new_job" | "complete_job" | "list_pending" | "select_building" | "help" | "unknown",
  "building_id": "uuid-o-null",
  "building_name": "nombre-o-null",
  "description": "descripcion-o-null",
  "job_reference": "referencia-o-null",
  "confidence": 0.0
}`;
}

export async function parseIntent(
  message: string,
  supervisorBuildings: Building[],
  groqApiKey: string
): Promise<ParsedIntent> {
  const fallback: ParsedIntent = {
    intent: "unknown",
    building_id: null,
    building_name: null,
    description: null,
    job_reference: null,
    confidence: 0,
  };

  if (!groqApiKey) return fallback;
  if (!message.trim()) return fallback;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(supervisorBuildings) },
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      console.error("Groq intent parse failed:", response.status, await response.text());
      return fallback;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) return fallback;

    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    const result: ParsedIntent = {
      intent: parsed.intent ?? "unknown",
      building_id: parsed.building_id ?? null,
      building_name: parsed.building_name ?? null,
      description: parsed.description ?? null,
      job_reference: parsed.job_reference ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };

    // Low confidence → unknown
    if (result.confidence < 0.6) {
      result.intent = "unknown";
    }

    // Validate building_id exists in the list
    if (result.building_id) {
      const match = supervisorBuildings.find((b) => b.id === result.building_id);
      if (!match) {
        result.building_id = null;
        result.building_name = null;
      }
    }

    return result;
  } catch (error) {
    console.error("parseIntent error:", error);
    return fallback;
  }
}
