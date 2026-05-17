/**
 * generateReceipt — Builds a clean, branded PDF proof of payment.
 *
 * Used by both learner and tutor download flows. Returns a Blob the caller
 * can save via file-saver or a hidden anchor.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface ReceiptData {
  paymentId: string;
  createdAt: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  providerRef: string | null;
  payerName: string;
  payerEmail: string;
  tutorName: string;
  subject: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

const LOGO_URL = "/lovable-uploads/studysync-logo.png";

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;

  // Header — logo
  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 40, 110, 32, undefined, "FAST");
    } catch {
      /* ignore */
    }
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Payment Receipt", pageW - margin, 60, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Receipt #${data.paymentId.slice(0, 8).toUpperCase()}`, pageW - margin, 76, {
    align: "right",
  });
  doc.text(format(new Date(data.createdAt), "dd MMM yyyy, HH:mm"), pageW - margin, 90, {
    align: "right",
  });
  doc.setTextColor(0);

  // Status pill
  const statusColor =
    data.status === "succeeded" ? [16, 185, 129] : data.status === "refunded" ? [59, 130, 246] : [234, 179, 8];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageW - margin - 70, 100, 70, 18, 9, 9, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    data.status === "succeeded" ? "PAID" : data.status.toUpperCase(),
    pageW - margin - 35,
    113,
    { align: "center" }
  );
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(230);
  doc.line(margin, 140, pageW - margin, 140);

  // Parties
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Billed to", margin, 165);
  doc.text("Tutor", pageW / 2, 165);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(data.payerName || "—", margin, 182);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(data.payerEmail || "", margin, 196);
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.text(data.tutorName || "—", pageW / 2, 182);

  // Line items table
  autoTable(doc, {
    startY: 230,
    head: [["Description", "Details", "Amount"]],
    body: [
      [
        "Tutoring session",
        `${data.subject}${
          data.scheduledAt
            ? `\n${format(new Date(data.scheduledAt), "EEE dd MMM yyyy, HH:mm")}`
            : ""
        }${data.durationMinutes ? ` · ${data.durationMinutes} min` : ""}`,
        `${data.currency} ${data.amount.toFixed(2)}`,
      ],
    ],
    theme: "plain",
    headStyles: {
      fillColor: [245, 245, 247],
      textColor: 60,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 10, cellPadding: { top: 12, right: 8, bottom: 12, left: 8 } },
    columnStyles: {
      2: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: margin, right: margin },
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  doc.setDrawColor(230);
  doc.line(margin, finalY, pageW - margin, finalY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total paid", margin, finalY + 22);
  doc.text(`${data.currency} ${data.amount.toFixed(2)}`, pageW - margin, finalY + 22, {
    align: "right",
  });

  // Payment meta
  let metaY = finalY + 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Payment method: ${data.provider || "—"}`, margin, metaY);
  if (data.providerRef) {
    metaY += 14;
    doc.text(`Provider ref: ${data.providerRef}`, margin, metaY);
  }

  // Footer
  doc.setTextColor(150);
  doc.setFontSize(8);
  doc.text(
    "StudySync — studysync.co.za. This is a computer-generated proof of payment and does not require a signature.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 36,
    { align: "center", maxWidth: pageW - margin * 2 }
  );

  return doc.output("blob");
}
