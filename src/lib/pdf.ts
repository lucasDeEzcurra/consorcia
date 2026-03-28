import { jsPDF } from "jspdf";

export interface PdfReportData {
  buildingName: string;
  buildingAddress: string;
  month: string;
  summary: string;
  closing: string;
  jobs: {
    description: string;
    completedAt: string;
    media: { url: string; type: string }[];
  }[];
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReportPdf(data: PdfReportData): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 15) {
      pdf.addPage();
      y = margin;
    }
  };

  const drawLine = (color = 200) => {
    pdf.setDrawColor(color);
    pdf.line(margin, y, pageW - margin, y);
    y += 1;
  };

  // ── Title ──
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Informe de Gestión Mensual", pageW / 2, y, { align: "center" });
  y += 10;

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.text(data.buildingName, pageW / 2, y, { align: "center" });
  y += 7;

  pdf.setFontSize(10);
  pdf.setTextColor(120);
  pdf.text(data.buildingAddress, pageW / 2, y, { align: "center" });
  y += 6;
  pdf.text(data.month, pageW / 2, y, { align: "center" });
  pdf.setTextColor(0);
  y += 10;

  drawLine();
  y += 7;

  // ── Summary ──
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(120);
  pdf.text("RESUMEN", margin, y);
  pdf.setTextColor(0);
  y += 6;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const summaryLines = pdf.splitTextToSize(data.summary, contentW);
  ensureSpace(summaryLines.length * 5);
  pdf.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 8;

  drawLine();
  y += 7;

  // ── Jobs ──
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(120);
  pdf.text("TRABAJOS REALIZADOS", margin, y);
  pdf.setTextColor(0);
  y += 8;

  if (data.jobs.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(150);
    pdf.text("No se completaron trabajos durante este período.", margin, y);
    pdf.setTextColor(0);
    y += 8;
  }

  for (let i = 0; i < data.jobs.length; i++) {
    const job = data.jobs[i]!;
    ensureSpace(20);

    // Number badge + description
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${i + 1}.`, margin, y);

    pdf.setFont("helvetica", "normal");
    const descLines = pdf.splitTextToSize(job.description, contentW - 10);
    pdf.text(descLines, margin + 10, y);
    y += descLines.length * 5 + 2;

    // Date
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Completado: ${job.completedAt}`, margin + 10, y);
    pdf.setTextColor(0);
    y += 7;

    // Photos — before and after side by side
    const befores = job.media.filter((m) => m.type === "before");
    const afters = job.media.filter((m) => m.type === "after");
    const pairs = Math.max(befores.length, afters.length);

    if (pairs > 0) {
      const imgW = (contentW - 14) / 2; // two columns with gap
      const imgH = imgW * 0.75;

      for (let p = 0; p < pairs; p++) {
        ensureSpace(imgH + 10);

        // Before
        if (befores[p]) {
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(150);
          pdf.text("ANTES", margin + 10, y);
          pdf.setTextColor(0);

          const imgData = await fetchImageAsBase64(befores[p]!.url);
          if (imgData) {
            pdf.addImage(imgData, "JPEG", margin + 10, y + 2, imgW, imgH);
          }
        }

        // After
        if (afters[p]) {
          const afterX = margin + 10 + imgW + 4;
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(150);
          pdf.text("DESPUÉS", afterX, y);
          pdf.setTextColor(0);

          const imgData = await fetchImageAsBase64(afters[p]!.url);
          if (imgData) {
            pdf.addImage(imgData, "JPEG", afterX, y + 2, imgW, imgH);
          }
        }

        y += imgH + 6;
      }
    }

    // Separator between jobs
    if (i < data.jobs.length - 1) {
      ensureSpace(8);
      pdf.setDrawColor(230);
      pdf.line(margin + 10, y, pageW - margin, y);
      y += 7;
    }
  }

  // ── Closing ──
  y += 4;
  ensureSpace(25);
  drawLine();
  y += 7;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const closingLines = pdf.splitTextToSize(data.closing, contentW);
  pdf.text(closingLines, margin, y);
  y += closingLines.length * 5 + 10;

  // ── Footer on each page ──
  const totalPages = pdf.getNumberOfPages();
  const footerDate = new Date().toLocaleDateString("es-AR");
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setTextColor(180);
    pdf.text(`Generado por Consorcia — ${footerDate}`, pageW / 2, pageH - 10, {
      align: "center",
    });
    pdf.setTextColor(0);
  }

  return pdf.output("blob");
}
