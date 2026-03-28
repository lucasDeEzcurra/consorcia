import { supabase } from "./supabase";

export interface Insight {
  title: string;
  description: string;
  type: "warning" | "success" | "info" | "suggestion";
  building_name: string | null;
}

export async function generateInsights(supervisorId: string): Promise<Insight[]> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-insights", {
      body: { supervisor_id: supervisorId },
    });

    if (error) {
      console.error("generate-insights error:", error);
      return [];
    }

    return (data?.insights ?? []) as Insight[];
  } catch (err) {
    console.error("generateInsights error:", err);
    return [];
  }
}

export async function clearInsightsCache(supervisorId: string): Promise<void> {
  await supabase.from("ai_insights").delete().eq("supervisor_id", supervisorId);
}
