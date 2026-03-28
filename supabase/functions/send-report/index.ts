import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6";

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
    const { to, subject, message, pdf_url, from_name } = (await req.json()) as {
      to: string[];
      subject: string;
      message: string;
      pdf_url: string;
      from_name: string;
    };

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: "GMAIL_USER o GMAIL_APP_PASSWORD no configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the PDF from storage
    const pdfResponse = await fetch(pdf_url);
    if (!pdfResponse.ok) {
      return new Response(
        JSON.stringify({ error: "No se pudo descargar el PDF del storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());

    // Create Gmail SMTP transport
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    // Send email
    await transporter.sendMail({
      from: `${from_name} <${gmailUser}>`,
      to: to.join(", "),
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${message.replace(/\n/g, "<br>")}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">Este email fue enviado por Consorcia.</p>
      </div>`,
      attachments: [
        {
          filename: "informe.pdf",
          content: Buffer.from(pdfBuffer),
          contentType: "application/pdf",
        },
      ],
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
