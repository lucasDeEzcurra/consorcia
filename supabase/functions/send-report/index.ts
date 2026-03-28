import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, message, pdf_url, from_name } = (await req.json()) as {
      to: string[];
      subject: string;
      message: string;
      pdf_url: string;
      from_name: string;
    };

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the PDF from storage
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Could not fetch PDF from storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${from_name} <onboarding@resend.dev>`,
        to,
        subject,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <p>${message.replace(/\n/g, "<br>")}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">Este email fue enviado por Consorcia.</p>
        </div>`,
        attachments: [
          {
            filename: "informe.pdf",
            content: pdfBase64,
            type: "application/pdf",
          },
        ],
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      return new Response(
        JSON.stringify({ error: `Resend error: ${emailResponse.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResult = await emailResponse.json();
    return new Response(JSON.stringify({ success: true, email_id: emailResult.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
