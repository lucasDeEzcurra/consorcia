import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobInput {
  id: string;
  description_original: string;
  completed_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { building_name, month, jobs } = (await req.json()) as {
      building_name: string;
      month: string;
      jobs: JobInput[];
    };

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobDescriptions = jobs
      .map((j, i) => `${i + 1}. "${j.description_original}" (completado: ${j.completed_at})`)
      .join("\n");

    const prompt = `Sos un redactor profesional para una administradora de consorcios/edificios en Argentina.

Edificio: ${building_name}
Mes: ${month}

Trabajos completados este mes:
${jobDescriptions}

Generá en formato JSON:
1. "summary": Un resumen ejecutivo de 2-3 oraciones, formal y conciso, sobre los trabajos realizados en el edificio este mes. NO inventes datos ni agregues información que no esté en la lista.
2. "improved_descriptions": Un array con una descripción mejorada para cada trabajo, en el MISMO ORDEN que la lista. Mejorá la claridad y el tono pero NO inventes hechos nuevos. Cada descripción debe ser 1-2 oraciones.
3. "closing": Un párrafo de cierre breve y profesional.

Respondé SOLO con JSON válido, sin markdown ni texto adicional.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Claude API error: ${response.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const text = result.content[0].text;

    // Parse the JSON from Claude's response
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
