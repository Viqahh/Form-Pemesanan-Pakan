import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PageSizes, rgb, StandardFonts } from "pdf-lib";
import type { CompletedOrder } from "@/types/order";
import { formatRupiah } from "@/utils/currency";
import { formatDateId } from "@/utils/date";

function decodePngDataUrl(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

function fitImage(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: width * scale,
    height: height * scale,
  };
}

export async function generateOrderPdf(order: CompletedOrder) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  let y = height - 64;

  page.drawText("PEMESANAN PAKAN", {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.05, 0.1, 0.16),
  });

  y -= 22;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.84, 0.88),
  });

  y -= 32;

  const rows = [
    ["Nomor PO", order.nomorPo],
    ["Wilayah", order.wilayah],
    ["Nama Peternak", order.namaPeternak],
    ["Tanggal Order", formatDateId(order.tanggalOrder)],
    ["Pabrikan", order.pabrikanName],
    ["Tanggal Terima", formatDateId(order.tanggalTerima)],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: margin,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0.2, 0.25, 0.32),
    });
    page.drawText(":", {
      x: margin + 130,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.25, 0.32),
    });
    page.drawText(value, {
      x: margin + 145,
      y,
      size: 11,
      font,
      color: rgb(0.05, 0.1, 0.16),
    });
    y -= 24;
  }

  y -= 8;
  page.drawText("Rincian Pakan", {
    x: margin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.05, 0.1, 0.16),
  });
  y -= 22;

  const tableX = margin;
  const columns = [
    { label: "No", x: tableX, width: 28 },
    { label: "Jenis", x: tableX + 32, width: 112 },
    { label: "Harga/Kg", x: tableX + 150, width: 78 },
    { label: "Harga/Sak", x: tableX + 232, width: 86 },
    { label: "Sak", x: tableX + 322, width: 44 },
    { label: "Total", x: tableX + 370, width: 112 },
  ];

  page.drawRectangle({
    x: tableX - 6,
    y: y - 7,
    width: width - margin * 2 + 12,
    height: 24,
    color: rgb(0.9, 0.96, 0.94),
  });

  columns.forEach((column) => {
    page.drawText(column.label, {
      x: column.x,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.08, 0.35, 0.25),
    });
  });

  y -= 24;
  for (const item of order.items) {
    page.drawText(String(item.itemNumber), { x: columns[0].x, y, size: 9, font });
    page.drawText(item.jenisPakanName, { x: columns[1].x, y, size: 9, font });
    page.drawText(formatRupiah(item.hargaPerKg), { x: columns[2].x, y, size: 9, font });
    page.drawText(formatRupiah(item.hargaPerSak), { x: columns[3].x, y, size: 9, font });
    page.drawText(`${item.jumlahSak}`, { x: columns[4].x, y, size: 9, font });
    page.drawText(formatRupiah(item.totalHarga), { x: columns[5].x, y, size: 9, font });
    y -= 20;
  }

  y -= 8;
  page.drawText(`Total Jumlah: ${order.totalJumlahSak} sak`, {
    x: margin,
    y,
    size: 11,
    font: boldFont,
  });
  page.drawText(`Total Harga: ${formatRupiah(order.totalHarga)}`, {
    x: margin + 250,
    y,
    size: 11,
    font: boldFont,
    color: rgb(0.08, 0.45, 0.32),
  });

  const signatureY = 110;
  const leftX = margin + 26;
  const rightX = width - margin - 180;

  page.drawText("Pemohon", {
    x: leftX + 42,
    y: signatureY + 112,
    size: 11,
    font: boldFont,
  });
  page.drawText("Disetujui", {
    x: rightX + 50,
    y: signatureY + 112,
    size: 11,
    font: boldFont,
  });

  const userSignature = await pdfDoc.embedPng(decodePngDataUrl(order.tandaTanganPemohon));
  const userSignatureSize = fitImage(
    userSignature.width,
    userSignature.height,
    150,
    74,
  );
  page.drawImage(userSignature, {
    x: leftX,
    y: signatureY + 26,
    width: userSignatureSize.width,
    height: userSignatureSize.height,
  });

  const approverPath = path.join(process.cwd(), "public", "signatures", "ananda-thufail.png");
  const approverBytes = await readFile(approverPath);
  const approverSignature = await pdfDoc.embedPng(approverBytes);
  const approverSignatureSize = fitImage(
    approverSignature.width,
    approverSignature.height,
    150,
    74,
  );
  page.drawImage(approverSignature, {
    x: rightX,
    y: signatureY + 26,
    width: approverSignatureSize.width,
    height: approverSignatureSize.height,
  });

  page.drawText(order.namaPemohon, {
    x: leftX,
    y: signatureY,
    size: 11,
    font: boldFont,
    color: rgb(0.05, 0.1, 0.16),
  });
  page.drawText("Ananda Thufail", {
    x: rightX,
    y: signatureY,
    size: 11,
    font: boldFont,
    color: rgb(0.05, 0.1, 0.16),
  });

  page.drawLine({
    start: { x: leftX, y: signatureY - 8 },
    end: { x: leftX + 150, y: signatureY - 8 },
    thickness: 0.8,
    color: rgb(0.55, 0.6, 0.65),
  });
  page.drawLine({
    start: { x: rightX, y: signatureY - 8 },
    end: { x: rightX + 150, y: signatureY - 8 },
    thickness: 0.8,
    color: rgb(0.55, 0.6, 0.65),
  });

  return pdfDoc.save();
}
