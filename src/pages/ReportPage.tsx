import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { generatePdfFromElement } from "@/lib/pdf";
import type { Building, Job, Media, Report } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  Send,
  CheckCircle2,
} from "lucide-react";

type Step = "loading" | "preview" | "confirm" | "sending" | "sent";

interface JobWithMedia extends Job {
  media: Media[];
  improved_description: string;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") ?? currentMonth();

  const [step, setStep] = useState<Step>("loading");
  const [building, setBuilding] = useState<Building | null>(null);
  const [jobs, setJobs] = useState<JobWithMedia[]>([]);
  const [existingReport, setExistingReport] = useState<Report | null>(null);

  // Report text (editable)
  const [summary, setSummary] = useState("");
  const [closing, setClosing] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);

  // Email config
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");

  // PDF
  const reportRef = useRef<HTMLDivElement>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    // Fetch building
    const { data: bData } = await supabase
      .from("buildings")
      .select("*")
      .eq("id", id)
      .single();
    const bld = bData as Building | null;
    setBuilding(bld);

    if (!bld) return;

    // Check existing report
    const { data: rData } = await supabase
      .from("reports")
      .select("*")
      .eq("building_id", id)
      .eq("month", month)
      .single();

    if (rData) {
      setExistingReport(rData as Report);
    }

    // Fetch completed jobs for this month
    const monthStart = `${month}-01T00:00:00.000Z`;
    const [y, m] = month.split("-");
    const nextMonth = new Date(Number(y), Number(m), 1).toISOString();

    const { data: jData } = await supabase
      .from("jobs")
      .select("*")
      .eq("building_id", id)
      .eq("status", "completed")
      .gte("completed_at", monthStart)
      .lt("completed_at", nextMonth)
      .order("completed_at");

    const jobsList = (jData as Job[]) ?? [];

    // Fetch media for all jobs
    const jobIds = jobsList.map((j) => j.id);
    const { data: mData } = await supabase
      .from("media")
      .select("*")
      .in("job_id", jobIds.length > 0 ? jobIds : ["__none__"])
      .order("created_at");

    const mediaList = (mData as Media[]) ?? [];
    const mediaByJob = new Map<string, Media[]>();
    for (const m of mediaList) {
      const arr = mediaByJob.get(m.job_id) ?? [];
      arr.push(m);
      mediaByJob.set(m.job_id, arr);
    }

    const jobsWithMedia: JobWithMedia[] = jobsList.map((j) => ({
      ...j,
      media: mediaByJob.get(j.id) ?? [],
      improved_description: j.description_generated ?? j.description_original,
    }));

    setJobs(jobsWithMedia);

    // Set defaults for email
    setRecipients(bld.emails);
    setEmailSubject(
      `Informe de Gestión Mensual — ${bld.name} — ${formatMonthLabel(month)}`
    );
    setEmailMessage(
      `Estimados propietarios,\n\nAdjuntamos el informe de gestión mensual correspondiente a ${formatMonthLabel(month)} del edificio ${bld.name}.\n\nQuedamos a disposición ante cualquier consulta.\n\nSaludos cordiales.`
    );

    // If report already exists and was sent, show it directly
    if (rData && (rData as Report).status === "sent") {
      // Load saved text
      const report = rData as Report;
      if (report.generated_text) {
        try {
          const parsed = JSON.parse(report.generated_text);
          setSummary(parsed.summary ?? "");
          setClosing(parsed.closing ?? "");
          if (parsed.improved_descriptions) {
            for (let i = 0; i < jobsWithMedia.length; i++) {
              if (parsed.improved_descriptions[i]) {
                jobsWithMedia[i]!.improved_description =
                  parsed.improved_descriptions[i];
              }
            }
            setJobs([...jobsWithMedia]);
          }
        } catch {
          setSummary(report.generated_text);
        }
      }
      setStep("preview");
      return;
    }

    // Generate AI text
    await generateAiText(bld, jobsWithMedia);
  }, [id, month]);

  const generateAiText = async (
    bld: Building,
    jobsWithMedia: JobWithMedia[]
  ) => {
    setStep("loading");
    setAiError(null);

    if (jobsWithMedia.length === 0) {
      setSummary("No se realizaron trabajos durante este período.");
      setClosing(
        "Quedamos a disposición para cualquier consulta o requerimiento."
      );
      setStep("preview");
      return;
    }

    try {
      const response = await supabase.functions.invoke("generate-report", {
        body: {
          building_name: bld.name,
          month: formatMonthLabel(month),
          jobs: jobsWithMedia.map((j) => ({
            id: j.id,
            description_original: j.description_original,
            completed_at: formatDate(j.completed_at!),
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as {
        summary: string;
        improved_descriptions: string[];
        closing: string;
        error?: string;
      };

      if (data.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
      setClosing(data.closing);

      // Update job descriptions
      const updated = jobsWithMedia.map((j, i) => ({
        ...j,
        improved_description:
          data.improved_descriptions[i] ?? j.description_original,
      }));
      setJobs(updated);

      // Save improved descriptions to DB
      for (let i = 0; i < updated.length; i++) {
        const job = updated[i]!;
        if (data.improved_descriptions[i]) {
          await supabase
            .from("jobs")
            .update({ description_generated: data.improved_descriptions[i] })
            .eq("id", job.id);
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      setAiError(msg);
      // Fallback: use original descriptions
      setSummary(
        `Durante ${formatMonthLabel(month)} se completaron ${jobsWithMedia.length} trabajo${jobsWithMedia.length !== 1 ? "s" : ""} de mantenimiento en ${bld.name}.`
      );
      setClosing(
        "Quedamos a disposición para cualquier consulta o requerimiento."
      );
    }

    setStep("preview");
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateJobDescription = (index: number, desc: string) => {
    setJobs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index]!, improved_description: desc };
      return copy;
    });
  };

  const handleContinue = () => {
    setStep("confirm");
  };

  const handleSend = async () => {
    if (!building || !reportRef.current) return;
    setStep("sending");
    setSendError(null);

    try {
      // 1. Generate PDF
      const pdfBlob = await generatePdfFromElement(reportRef.current);

      // 2. Upload PDF to storage
      const pdfPath = `reports/${building.id}/${month}.pdf`;
      await supabase.storage.from("media").remove([pdfPath]);
      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(pdfPath, pdfBlob, { contentType: "application/pdf" });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(pdfPath);
      const pdfUrl = urlData.publicUrl;

      // 3. Save report to DB
      const reportText = JSON.stringify({
        summary,
        closing,
        improved_descriptions: jobs.map((j) => j.improved_description),
      });

      if (existingReport) {
        await supabase
          .from("reports")
          .update({
            generated_text: reportText,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", existingReport.id);
      } else {
        await supabase.from("reports").insert({
          building_id: building.id,
          month,
          status: "sent",
          generated_text: reportText,
          sent_at: new Date().toISOString(),
        });
      }

      // 4. Send email via edge function
      const { error: sendErr } = await supabase.functions.invoke(
        "send-report",
        {
          body: {
            to: recipients,
            subject: emailSubject,
            message: emailMessage,
            pdf_url: pdfUrl,
            from_name: "Consorcia",
          },
        }
      );

      if (sendErr) {
        // Email failed but report is saved — mark as draft
        console.error("Email send failed:", sendErr);
      }

      setStep("sent");
    } catch (err) {
      setSendError((err as Error).message);
      setStep("confirm");
    }
  };

  const addRecipient = () => {
    if (newRecipient.trim() && !recipients.includes(newRecipient.trim())) {
      setRecipients((prev) => [...prev, newRecipient.trim()]);
      setNewRecipient("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  if (!building && step !== "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Edificio no encontrado.
      </p>
    );
  }

  // ── Loading ──
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Generando reporte con IA...
        </p>
      </div>
    );
  }

  // ── Sent confirmation ──
  if (step === "sent") {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <CheckCircle2 className="size-12 text-green-600" />
        <h2 className="text-xl font-bold">Reporte enviado</h2>
        <p className="text-sm text-muted-foreground">
          El informe fue enviado a {recipients.length} destinatario
          {recipients.length !== 1 ? "s" : ""}.
        </p>
        <Link to={`/buildings/${id}`}>
          <Button variant="outline">Volver al edificio</Button>
        </Link>
      </div>
    );
  }

  // ── Email confirmation ──
  if (step === "confirm" || step === "sending") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("preview")}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h2 className="text-xl font-bold tracking-tight">Enviar reporte</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Asunto</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mensaje</label>
            <Textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destinatarios</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="agregar@email.com"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addRecipient}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {recipients.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between rounded-lg border px-3 py-1.5"
                >
                  <span className="text-sm">{email}</span>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {sendError && (
            <p className="text-sm text-destructive">{sendError}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSend}
              disabled={
                step === "sending" || recipients.length === 0
              }
            >
              {step === "sending" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Enviar reporte
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setStep("preview")}>
              Volver al preview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/buildings/${id}`}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h2 className="text-xl font-bold tracking-tight">
            Preview del reporte
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {existingReport?.status === "sent" && (
            <Badge>Enviado</Badge>
          )}
          <Button onClick={handleContinue}>
            Continuar
            <Send className="ml-1 size-4" />
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-sm text-yellow-800">
            No se pudo generar el texto con IA: {aiError}
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Se usaron las descripciones originales. Podés editarlas manualmente.
          </p>
        </div>
      )}

      {/* ── Report preview (this div gets captured as PDF) ── */}
      <div
        ref={reportRef}
        className="mx-auto max-w-2xl rounded-xl border bg-white p-8 shadow-sm"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
            Informe de Gestión Mensual
          </h1>
          <p className="mt-2 text-lg text-gray-600">{building?.name}</p>
          <p className="text-sm text-gray-500">{building?.address}</p>
          <p className="mt-1 text-sm text-gray-500 capitalize">
            {formatMonthLabel(month)}
          </p>
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Summary */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">
            Resumen
          </h2>
          <div
            className="text-sm leading-relaxed text-gray-800"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setSummary(e.currentTarget.textContent ?? "")}
            style={{ outline: "none", minHeight: "2em" }}
          >
            {summary}
          </div>
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Jobs */}
        <div className="mb-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">
            Trabajos realizados
          </h2>

          {jobs.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No se completaron trabajos durante este período.
            </p>
          ) : (
            <div className="space-y-6">
              {jobs.map((job, i) => (
                <div key={job.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div
                        className="text-sm leading-relaxed text-gray-800"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          updateJobDescription(
                            i,
                            e.currentTarget.textContent ?? ""
                          )
                        }
                        style={{ outline: "none" }}
                      >
                        {job.improved_description}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        Completado: {formatDate(job.completed_at!)}
                      </p>
                    </div>
                  </div>

                  {/* Photos */}
                  {job.media.length > 0 && (
                    <div className="ml-9 grid grid-cols-2 gap-2">
                      {job.media
                        .filter((m) => m.type === "before")
                        .map((m) => (
                          <div key={m.id}>
                            <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">
                              Antes
                            </p>
                            <img
                              src={m.url}
                              alt="Antes"
                              className="w-full rounded border object-cover"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ))}
                      {job.media
                        .filter((m) => m.type === "after")
                        .map((m) => (
                          <div key={m.id}>
                            <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">
                              Después
                            </p>
                            <img
                              src={m.url}
                              alt="Después"
                              className="w-full rounded border object-cover"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ))}
                    </div>
                  )}

                  {i < jobs.length - 1 && (
                    <hr className="border-gray-100" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Closing */}
        <div>
          <div
            className="text-sm leading-relaxed text-gray-800"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setClosing(e.currentTarget.textContent ?? "")}
            style={{ outline: "none", minHeight: "2em" }}
          >
            {closing}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-gray-200 pt-4">
          <p className="text-center text-[10px] text-gray-400">
            Generado por Consorcia — {new Date().toLocaleDateString("es-AR")}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Hacé click en cualquier texto para editarlo antes de enviar.
      </p>
    </div>
  );
}
