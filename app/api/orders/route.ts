import { NextResponse } from "next/server";
import { orderSchema } from "@/lib/order-schema";
import { resolveOrderPricing } from "@/lib/pricing";
import { appendOrderToSheet } from "@/lib/google-sheets";
import { generateOrderPdf } from "@/lib/pdf";
import type { CompletedOrder } from "@/types/order";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = orderSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "Data pemesanan tidak valid.",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const values = parsed.data;
    let itemNumber = 0;
    const orderItems = values.manufacturers.flatMap((manufacturerGroup) =>
      manufacturerGroup.feeds.map((item) => {
        itemNumber += 1;
        const pricing = resolveOrderPricing(
          manufacturerGroup.pabrikan,
          item.jenisPakan,
          item.jumlahSak,
        );

        if (!pricing.manufacturer || !pricing.feed) {
          return null;
        }

        return {
          itemNumber,
          pabrikanCode: pricing.manufacturer.code,
          pabrikanName: pricing.manufacturer.name,
          jenisPakanCode: pricing.feed.code,
          jenisPakanName: pricing.feed.name,
          hargaPerKg: pricing.pricePerKg,
          hargaPerSak: pricing.pricePerSack,
          jumlahSak: item.jumlahSak,
          totalHarga: pricing.total,
        };
      }),
    );

    if (orderItems.some((item) => item === null)) {
      return NextResponse.json(
        { message: "Pabrikan atau jenis pakan tidak ditemukan." },
        { status: 400 },
      );
    }

    const resolvedItems = orderItems.filter((item) => item !== null);
    const order: CompletedOrder = {
      ...values,
      timestamp: new Date().toISOString(),
      wilayah: values.wilayah,
      items: resolvedItems,
      totalJumlahSak: resolvedItems.reduce((sum, item) => sum + item.jumlahSak, 0),
      totalHarga: resolvedItems.reduce((sum, item) => sum + item.totalHarga, 0),
    };

    await appendOrderToSheet(order);
    const pdfBytes = await generateOrderPdf(order);
    const fileName = `pemesanan-pakan-${Date.now()}.pdf`;

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    console.error("Order submission failed:", error);
    return NextResponse.json({ message }, { status: 500 });
  }
}
