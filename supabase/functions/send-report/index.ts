import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Minimal SMTP client using raw Deno TLS — no external imports
async function sendSmtp(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const conn = await Deno.connectTls({
    hostname: opts.host,
    port: opts.port,
  });

  async function read(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    if (n === null) throw new Error("SMTP connection closed");
    return decoder.decode(buf.subarray(0, n));
  }

  async function write(cmd: string) {
    await conn.write(encoder.encode(cmd + "\r\n"));
  }

  async function expect(code: number) {
    const resp = await read();
    if (!resp.startsWith(String(code))) {
      throw new Error(`SMTP expected ${code}, got: ${resp.trim()}`);
    }
    return resp;
  }

  // Greeting
  await expect(220);
  await write(`EHLO consorcia.app`);
  await expect(250);

  // Auth LOGIN
  await write("AUTH LOGIN");
  await expect(334);
  await write(btoa(opts.user));
  await expect(334);
  await write(btoa(opts.pass));
  await expect(235);

  // Envelope
  await write(`MAIL FROM:<${opts.from}>`);
  await expect(250);
  for (const r of opts.to) {
    await write(`RCPT TO:<${r}>`);
    await expect(250);
  }

  // Build MIME message
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let mime = "";
  mime += `From: ${opts.fromName} <${opts.from}>\r\n`;
  mime += `To: ${opts.to.join(", ")}\r\n`;
  mime += `Subject: ${opts.subject}\r\n`;
  mime += `MIME-Version: 1.0\r\n`;
  mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
  mime += `\r\n`;

  // HTML part
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/html; charset=utf-8\r\n`;
  mime += `Content-Transfer-Encoding: 7bit\r\n`;
  mime += `\r\n`;
  mime += opts.html + "\r\n";

  // Attachments
  if (opts.attachments) {
    for (const att of opts.attachments) {
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
      mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      mime += `Content-Transfer-Encoding: base64\r\n`;
      mime += `\r\n`;
      const b64 = att.content;
      for (let i = 0; i < b64.length; i += 76) {
        mime += b64.slice(i, i + 76) + "\r\n";
      }
    }
  }

  mime += `--${boundary}--\r\n`;

  // DATA
  await write("DATA");
  await expect(354);
  const lines = mime.split("\r\n");
  for (const line of lines) {
    if (line.startsWith(".")) {
      await conn.write(encoder.encode("." + line + "\r\n"));
    } else {
      await conn.write(encoder.encode(line + "\r\n"));
    }
  }
  await write(".");
  await expect(250);

  await write("QUIT");
  conn.close();
}

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
    const pdfBase64 = btoa(
      pdfBuffer.reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <p>${message.replace(/\n/g, "<br>")}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Este email fue enviado por ${from_name}.</p>
    </div>`;

    await sendSmtp({
      host: "smtp.gmail.com",
      port: 465,
      user: gmailUser,
      pass: gmailPassword,
      from: gmailUser,
      fromName: from_name,
      to,
      subject,
      html,
      attachments: [
        {
          filename: "informe.pdf",
          content: pdfBase64,
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
