import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const building_name = body.building_name || "";
    const building_address = body.building_address || "";
    const month = body.month || "";
    const supervisor_name = body.supervisor_name || "";
    const jobs = body.jobs || [];

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build job details string
    const lines: string[] = [];
    let totalExpense = 0;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      let line = (i + 1) + '. [ID: ' + j.id + '] "' + j.description_original + '"';
      line += "\n   Completado: " + j.completed_at;
      if (j.expense_amount) {
        totalExpense += j.expense_amount;
        line += "\n   Gasto: $" + j.expense_amount;
        if (j.expense_provider) line += " | Proveedor: " + j.expense_provider;
        if (j.expense_category) line += " | Categoria: " + j.expense_category;
      }
      lines.push(line);
    }
    const jobDetails = lines.join("\n\n");

    const prompt = 'Sos un redactor profesional para informes de gestion de consorcios/edificios en Argentina.\n\nEDIFICIO: ' + building_name + (building_address ? ' (' + building_address + ')' : '') + '\nPERIODO: ' + month + (supervisor_name ? '\nSUPERVISOR: ' + supervisor_name : '') + '\nTOTAL TRABAJOS: ' + jobs.length + '\nGASTO TOTAL: $' + totalExpense + '\n\nTRABAJOS:\n' + jobDetails + '\n\nGENERA un JSON con:\n1. "summary": Resumen ejecutivo de 3-5 oraciones sobre los trabajos del mes. Menciona cantidad de trabajos y categorias si hay.\n2. "improved_descriptions": Un OBJETO donde cada key es el ID del trabajo y el value es la descripcion mejorada (2-3 oraciones, profesional). NO inventes hechos.\n3. "expense_summary": Si hay gastos, un parrafo resumiendo el gasto total y desglose. Si no hay gastos, null.\n4. "closing": Parrafo de cierre profesional de 2-3 oraciones.\n\nREGLAS:\n- NO inventes datos\n- Mejora claridad y tono profesional\n- Responde SOLO JSON valido, sin markdown, sin ```';

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({
          error: "Claude API error: " + response.status,
          details: errText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    let text = result.content[0].text;

    // Strip markdown code fences if present
    text = text.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();

    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
