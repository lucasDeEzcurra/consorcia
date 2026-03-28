import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function generatePdfFromElement(
  element: HTMLElement
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  } as Parameters<typeof html2canvas>[1]);

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    0,
    position,
    imgWidth,
    imgHeight
  );
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = -(imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      0,
      position,
      imgWidth,
      imgHeight
    );
    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}
