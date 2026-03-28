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
  created_at: string;
  expense_amount: number | null;
  expense_provider: string | null;
  expense_category: string | null;
  photo_count_before: number;
  photo_count_after: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { building_name, building_address, month, jobs, supervisor_name } = (await req.json()) as {
      building_name: string;
      building_address?: string;
      month: string;
      jobs: JobInput[];
      supervisor_name?: string;
    };

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobDetails = jobs
      .map((j, i) => {
        let detail = `${i + 1}. [ID: ${j.id}] "${j.description_original}"`;
        if (j.created_at) detail += `\n   Creado: ${j.created_at}`;
        detail += `\n   Completado: ${j.completed_at}`;
        if (j.expense_amount) {
          detail += `\n   Gasto: $${j.expense_amount}`;
          if (j.expense_provider) detail += ` | Proveedor: ${j.expense_provider}`;
          if (j.expense_category) detail += ` | Categoria: ${j.expense_category}`;
        }
        const before = j.photo_count_before || 0;
        const after = j.photo_count_after || 0;
        if (before > 0 || after > 0) {
          detail += `\n   Fotos: ${before} antes, ${after} despues`;
        }
        return detail;
      })
      .join("\n\n");

    const totalExpense = jobs.reduce((sum, j) => sum + (j.expense_amount || 0), 0);
    const categoryCounts = new Map<string, number>();
    for (const j of jobs) {
      if (j.expense_category) {
        categoryCounts.set(j.expense_category, (categoryCounts.get(j.expense_category) || 0) + 1);
      }
    }

    const prompt = `Sos un redactor profesional para informes de gestión de consorcios/edificios en Argentina.

DATOS DEL EDIFICIO:
- Nombre: ${building_name}
${building_address ? `- Dirección: ${building_address}` : ""}
${supervisor_name ? `- Supervisor: ${supervisor_name}` : ""}
- Período: ${month}
- Total de trabajos completados: ${jobs.length}
- Gasto total del periodo: $${totalExpense}
${categoryCounts.size > 0 ? `- Categorias: ${[...categoryCounts.entries()].map(([c, n]) => `${c} (${n})`).join(", ")}` : ""}

TRABAJOS COMPLETADOS:
${jobDetails}

INSTRUCCIONES:
Generá un informe de gestión mensual en formato JSON con esta estructura:

1. "summary": Resumen ejecutivo de 3-5 oraciones. Mencioná la cantidad de trabajos, las categorías principales, el gasto total si hay gastos, y un comentario general sobre el estado del edificio. Sé profesional pero accesible.

2. "sections": Un array de secciones. Podés agrupar los trabajos como te parezca mejor (por categoría, por urgencia, por tipo). Cada sección tiene:
   - "title": Título de la sección (ej: "Plomería", "Mantenimiento General", "Reparaciones Eléctricas")
   - "job_ids": Array con los IDs de los trabajos que van en esta sección (usá los IDs originales que te pasé)
   - "section_summary": Una oración resumiendo los trabajos de esta sección (opcional, puede ser null)

3. "improved_descriptions": Un objeto donde cada key es el ID del trabajo y el value es la descripción mejorada. Mejorá la claridad y el tono profesional. Incluí información relevante del gasto si lo tiene (monto y proveedor). NO inventes hechos nuevos. 2-3 oraciones máximo por trabajo.

4. "expense_summary": Si hay gastos, un párrafo corto resumiendo el gasto total y el desglose por categoría. Si no hay gastos, null.

5. "closing": Párrafo de cierre profesional de 2-3 oraciones.

REGLAS:
- NO inventes datos ni agregues información que no esté en la lista
- Los gastos NO son públicos para propietarios: mencioná que se realizaron trabajos pero NO incluyas montos específicos en las descripciones. El expense_summary es solo para uso interno del administrador.
- Sé formal pero claro, sin jerga técnica innecesaria
- Priorizá agrupar por categoría si hay categorías definidas, sino agrupá como tenga más sentido
- Todos los trabajos deben aparecer en alguna sección

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
        max_tokens: 4096,
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
