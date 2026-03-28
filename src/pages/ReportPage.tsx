import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link, useLocation } from "react-router-dom";
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
  AlertTriangle,
  Mail,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

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
  const location = useLocation();
  const month = searchParams.get("month") ?? currentMonth();
  const isAdmin = location.pathname.startsWith("/admin");
  const buildingUrl = isAdmin ? `/admin/buildings/${id}` : `/buildings/${id}`;
  const dashboardUrl = isAdmin ? "/admin/buildings" : "/dashboard";

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
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const { data: bData } = await supabase
        .from("buildings")
        .select("*")
        .eq("id", id)
        .single();
      const bld = bData as Building | null;
      setBuilding(bld);

      if (!bld) {
        setStep("preview");
        return;
      }

      // Fetch report — use .maybeSingle() to avoid error on 0 rows
      const { data: rData } = await supabase
        .from("reports")
        .select("*")
        .eq("building_id", id)
        .eq("month", month)
        .maybeSingle();

      if (rData) {
        setExistingReport(rData as Report);
      }

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

      setRecipients(bld.emails);
      setEmailSubject(
        `Informe de Gestión Mensual — ${bld.name} — ${formatMonthLabel(month)}`
      );
      setEmailMessage(
        `Estimados propietarios,\n\nAdjuntamos el informe de gestión mensual correspondiente a ${formatMonthLabel(month)} del edificio ${bld.name}.\n\nQuedamos a disposición ante cualquier consulta.\n\nSaludos cordiales.`
      );

      // If report already exists (draft or sent), load saved text — don't regenerate
      if (rData) {
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
        } else {
          // Report exists but no saved text — use fallback
          setSummary(
            `Durante ${formatMonthLabel(month)} se completaron ${jobsWithMedia.length} trabajo${jobsWithMedia.length !== 1 ? "s" : ""} de mantenimiento en ${bld.name}.`
          );
          setClosing("Quedamos a disposición para cualquier consulta o requerimiento.");
        }
        setStep("preview");
        return;
      }

      // No report exists yet — generate with AI
      await generateAiText(bld, jobsWithMedia);
    } catch (err) {
      console.error("ReportPage fetch error:", err);
      setStep("preview");
    }
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

      const updated = jobsWithMedia.map((j, i) => ({
        ...j,
        improved_description:
          data.improved_descriptions[i] ?? j.description_original,
      }));
      setJobs(updated);

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

  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleContinue = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    try {
      const blob = await generatePdfFromElement(reportRef.current);
      setPdfBlob(blob);
    } catch (err) {
      console.error("PDF generation error:", err);
      // Continue anyway — PDF will be regenerated on send if needed
    }
    setGeneratingPdf(false);
    setStep("confirm");
  };

  const handleSend = async () => {
    if (!building) return;
    // If PDF wasn't generated (error during handleContinue), try again
    let pdf = pdfBlob;
    if (!pdf && reportRef.current) {
      try {
        pdf = await generatePdfFromElement(reportRef.current);
      } catch {
        // Can't generate PDF at all
      }
    }
    if (!pdf) {
      setSendError("No se pudo generar el PDF. Volvé al preview e intentá de nuevo.");
      return;
    }
    setStep("sending");
    setSendError(null);

    try {
      const pdfPath = `reports/${building.id}/${month}.pdf`;
      await supabase.storage.from("media").remove([pdfPath]);
      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(pdfPath, pdf, { contentType: "application/pdf" });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(pdfPath);
      const pdfUrl = urlData.publicUrl;

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
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">Edificio no encontrado.</p>
        <Link to={dashboardUrl} className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500">
          Volver
        </Link>
      </div>
    );
  }

  // -- Loading --
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50">
          <Loader2 className="size-8 animate-spin text-amber-500" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-800">Generando reporte</p>
          <p className="mt-1 text-sm text-slate-500">
            Estamos usando IA para mejorar las descripciones...
          </p>
        </div>
      </div>
    );
  }

  // -- Sent confirmation --
  if (step === "sent") {
    return (
      <div className="flex flex-col items-center gap-5 py-24">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50">
          <CheckCircle2 className="size-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl text-slate-900" style={serif}>
            Reporte enviado
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            El informe fue enviado a {recipients.length} destinatario
            {recipients.length !== 1 ? "s" : ""}.
          </p>
        </div>
        <Link to={buildingUrl}>
          <Button variant="outline" className="rounded-xl">Volver al edificio</Button>
        </Link>
      </div>
    );
  }

  // -- Email confirmation --
  if (step === "confirm" || step === "sending") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("preview")}
            className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="text-2xl text-slate-900" style={serif}>
            Enviar reporte
          </h2>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Asunto</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Mensaje</label>
            <Textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              rows={5}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Destinatarios</label>
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
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addRecipient}
                className="h-10 rounded-xl"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {recipients.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{email}</span>
                  </div>
                  <button
                    onClick={() => removeRecipient(email)}
                    className="flex size-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {sendError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{sendError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSend}
              disabled={step === "sending" || recipients.length === 0}
              className="h-11 rounded-xl bg-amber-500 px-6 text-[#0b1120] hover:bg-amber-400"
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
            <Button variant="ghost" onClick={() => setStep("preview")} className="rounded-xl">
              Volver al preview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -- Preview --
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={buildingUrl}
            className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h2 className="text-2xl text-slate-900" style={serif}>
            Preview del reporte
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {existingReport?.status === "sent" && (
            <Badge>Enviado</Badge>
          )}
          <Button
            onClick={handleContinue}
            disabled={generatingPdf}
            className="h-10 rounded-xl bg-amber-500 px-5 text-[#0b1120] hover:bg-amber-400"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Preparando...
              </>
            ) : (
              <>
                Continuar
                <Send className="ml-1 size-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No se pudo generar el texto con IA
            </p>
            <p className="mt-0.5 text-xs text-amber-600">
              Se usaron las descripciones originales. Podés editarlas manualmente haciendo click en el texto.
            </p>
          </div>
        </div>
      )}

      {/* Report preview (this div gets captured as PDF) */}
      <div
        ref={reportRef}
        className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Georgia, serif" }}>
            Informe de Gestión Mensual
          </h1>
          <p className="mt-2 text-lg text-slate-600">{building?.name}</p>
          <p className="text-sm text-slate-500">{building?.address}</p>
          <p className="mt-1 text-sm text-slate-500 capitalize">
            {formatMonthLabel(month)}
          </p>
        </div>

        <hr className="my-6 border-slate-200" />

        {/* Summary */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Resumen
          </h2>
          <div
            className="text-sm leading-relaxed text-slate-800 rounded-lg transition-colors hover:bg-amber-50/50 px-2 py-1 -mx-2"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setSummary(e.currentTarget.textContent ?? "")}
            style={{ outline: "none", minHeight: "2em" }}
          >
            {summary}
          </div>
        </div>

        <hr className="my-6 border-slate-200" />

        {/* Jobs */}
        <div className="mb-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
            Trabajos realizados
          </h2>

          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No se completaron trabajos durante este período.
            </p>
          ) : (
            <div className="space-y-6">
              {jobs.map((job, i) => (
                <div key={job.id} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div
                        className="text-sm leading-relaxed text-slate-800 rounded-lg transition-colors hover:bg-amber-50/50 px-2 py-1 -mx-2"
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
                      <p className="mt-1 text-xs text-slate-400 px-2 -mx-2">
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
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Antes
                            </p>
                            <img
                              src={m.url}
                              alt="Antes"
                              className="w-full rounded-lg border border-slate-200 object-cover"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ))}
                      {job.media
                        .filter((m) => m.type === "after")
                        .map((m) => (
                          <div key={m.id}>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Después
                            </p>
                            <img
                              src={m.url}
                              alt="Después"
                              className="w-full rounded-lg border border-slate-200 object-cover"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ))}
                    </div>
                  )}

                  {i < jobs.length - 1 && (
                    <hr className="border-slate-100" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="my-6 border-slate-200" />

        {/* Closing */}
        <div>
          <div
            className="text-sm leading-relaxed text-slate-800 rounded-lg transition-colors hover:bg-amber-50/50 px-2 py-1 -mx-2"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setClosing(e.currentTarget.textContent ?? "")}
            style={{ outline: "none", minHeight: "2em" }}
          >
            {closing}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-slate-200 pt-4">
          <p className="text-center text-[10px] text-slate-400">
            Generado por Consorcia — {new Date().toLocaleDateString("es-AR")}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Hacé click en cualquier texto del reporte para editarlo antes de enviar.
      </p>
    </div>
  );
}
