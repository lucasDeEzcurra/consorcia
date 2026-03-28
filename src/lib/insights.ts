import { supabase } from "./supabase";

export interface Insight {
  title: string;
  description: string;
  type: "warning" | "success" | "info" | "suggestion";
  building_name: string | null;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export async function generateInsights(supervisorId: string): Promise<Insight[]> {
  // 1. Check cache
  const { data: cached } = await supabase
    .from("ai_insights")
    .select("insights, expires_at")
    .eq("supervisor_id", supervisorId)
    .gt("expires_at", new Date().toISOString())
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    return cached.insights as Insight[];
  }

  // 2. Gather data
  const { data: sup } = await supabase
    .from("supervisors")
    .select("id")
    .eq("id", supervisorId)
    .single();
  if (!sup) return [];

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("supervisor_id", supervisorId);
  const blds = (buildings ?? []) as { id: string; name: string }[];
  if (blds.length === 0) return [];

  const buildingIds = blds.map((b) => b.id);

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("id, building_id, status, created_at, completed_at, expense_category")
    .in("building_id", buildingIds)
    .gte("created_at", oneMonthAgo.toISOString());

  const jobs = (recentJobs ?? []) as {
    id: string;
    building_id: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    expense_category: string | null;
  }[];

  // 3. Compute stats per building
  const stats = blds.map((b) => {
    const bJobs = jobs.filter((j) => j.building_id === b.id);
    const pending = bJobs.filter((j) => j.status === "pending").length;
    const completed = bJobs.filter((j) => j.status === "completed").length;

    // Average resolution time (hours)
    const resolved = bJobs.filter((j) => j.status === "completed" && j.completed_at);
    let avgHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, j) => {
        return sum + (new Date(j.completed_at!).getTime() - new Date(j.created_at).getTime());
      }, 0);
      avgHours = Math.round(totalMs / resolved.length / 1000 / 3600);
    }

    // Category frequency
    const catCount = new Map<string, number>();
    for (const j of bJobs) {
      const cat = j.expense_category || "sin categoría";
      catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    }
    const topCategories = [...catCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat} (${count})`);

    return {
      building: b.name,
      total_jobs: bJobs.length,
      pending,
      completed,
      avg_resolution_hours: avgHours,
      top_categories: topCategories,
    };
  });

  const totalPending = stats.reduce((s, b) => s + b.pending, 0);
  const totalCompleted = stats.reduce((s, b) => s + b.completed, 0);

  // 4. Call Groq LLM
  const prompt = `Sos un analista de gestión de edificios para una administradora de consorcios en Argentina.

Estadísticas del último mes:

${stats.map((s) => `**${s.building}**: ${s.total_jobs} trabajos (${s.pending} pendientes, ${s.completed} completados). Tiempo promedio de resolución: ${s.avg_resolution_hours}h. Categorías: ${s.top_categories.join(", ") || "ninguna"}.`).join("\n")}

Totales: ${totalPending} pendientes, ${totalCompleted} completados en ${blds.length} edificios.

Generá exactamente 4 insights accionables. Cada uno debe tener:
- title: corto, máximo 8 palabras
- description: 1-2 oraciones con datos concretos del análisis
- type: "warning" (problemas), "success" (logros), "info" (datos relevantes), "suggestion" (mejoras)
- building_name: nombre del edificio al que se refiere, o null si es general

Respondé SOLO con un JSON array válido, sin markdown:
[{"title":"...","description":"...","type":"...","building_name":"..."}]`;

  try {
    if (!GROQ_API_KEY) {
      return buildFallbackInsights(stats, totalPending, totalCompleted);
    }

    const resp = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!resp.ok) {
      console.error("Groq insights error:", resp.status);
      return buildFallbackInsights(stats, totalPending, totalCompleted);
    }

    const data = await resp.json();
    const text = (data.choices?.[0]?.message?.content || "").trim();
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const insights = JSON.parse(jsonStr) as Insight[];

    // Validate
    const valid = insights
      .filter(
        (i) =>
          i.title &&
          i.description &&
          ["warning", "success", "info", "suggestion"].includes(i.type)
      )
      .slice(0, 4);

    if (valid.length === 0) {
      return buildFallbackInsights(stats, totalPending, totalCompleted);
    }

    // 5. Cache
    await saveInsights(supervisorId, valid);
    return valid;
  } catch (err) {
    console.error("generateInsights error:", err);
    return buildFallbackInsights(stats, totalPending, totalCompleted);
  }
}

export async function clearInsightsCache(supervisorId: string): Promise<void> {
  await supabase.from("ai_insights").delete().eq("supervisor_id", supervisorId);
}

async function saveInsights(supervisorId: string, insights: Insight[]): Promise<void> {
  // Delete old
  await supabase.from("ai_insights").delete().eq("supervisor_id", supervisorId);
  // Insert new
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  await supabase.from("ai_insights").insert({
    supervisor_id: supervisorId,
    insights,
    expires_at: expiresAt.toISOString(),
  });
}

function buildFallbackInsights(
  stats: { building: string; total_jobs: number; pending: number; completed: number; avg_resolution_hours: number }[],
  totalPending: number,
  totalCompleted: number
): Insight[] {
  const insights: Insight[] = [];

  if (totalPending > 0) {
    const worst = stats.reduce((a, b) => (b.pending > a.pending ? b : a), stats[0]!);
    insights.push({
      title: `${totalPending} trabajos pendientes`,
      description: `Tenés ${totalPending} trabajos sin completar. ${worst.building} tiene ${worst.pending} pendientes.`,
      type: "warning",
      building_name: worst.building,
    });
  }

  if (totalCompleted > 0) {
    insights.push({
      title: `${totalCompleted} trabajos completados`,
      description: `Se completaron ${totalCompleted} trabajos en el último mes.`,
      type: "success",
      building_name: null,
    });
  }

  const withResolution = stats.filter((s) => s.avg_resolution_hours > 0);
  if (withResolution.length > 0) {
    const slowest = withResolution.reduce((a, b) =>
      b.avg_resolution_hours > a.avg_resolution_hours ? b : a, withResolution[0]!
    );
    insights.push({
      title: "Tiempo de resolución",
      description: `${slowest.building} tiene un promedio de ${slowest.avg_resolution_hours}h para completar trabajos.`,
      type: "info",
      building_name: slowest.building,
    });
  }

  insights.push({
    title: "Revisá los edificios",
    description: `Tenés ${stats.length} edificio${stats.length !== 1 ? "s" : ""} asignado${stats.length !== 1 ? "s" : ""}. Revisá los pendientes para priorizar.`,
    type: "suggestion",
    building_name: null,
  });

  return insights.slice(0, 4);
}
