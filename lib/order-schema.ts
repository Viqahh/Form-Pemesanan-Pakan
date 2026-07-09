import { z } from "zod";
import { feedData } from "@/data/feedData";
import { regions } from "@/data/formOptions";

const manufacturerCodes = feedData.map((manufacturer) => manufacturer.code) as [
  string,
  ...string[],
];

export const orderSchema = z
  .object({
    nomorPo: z.string().trim().min(1, "Nomor PO wajib dibuat otomatis."),
    wilayah: z.enum(regions, {
      required_error: "Wilayah pemesanan wajib dipilih.",
    }),
    namaPeternak: z.string().trim().min(1, "Nama peternak wajib diisi."),
    tanggalOrder: z.string().trim().min(1, "Tanggal order wajib dipilih."),
    manufacturers: z
      .array(
        z.object({
          pabrikan: z.enum(manufacturerCodes, {
            required_error: "Nama pabrikan wajib dipilih.",
          }),
          feeds: z
            .array(
              z.object({
                jenisPakan: z.string().trim().min(1, "Jenis pakan wajib dipilih."),
                jumlahSak: z.coerce
                  .number({ required_error: "Jumlah pakan wajib diisi." })
                  .int("Jumlah pakan harus berupa angka bulat.")
                  .min(1, "Jumlah pakan minimal 1 sak."),
              }),
            )
            .min(1, "Minimal satu jenis pakan wajib ditambahkan."),
        }),
      )
      .min(1, "Minimal satu pabrikan wajib ditambahkan."),
    tanggalTerima: z.string().trim().min(1, "Tanggal terima wajib dipilih."),
    namaPemohon: z.string().trim().min(1, "Nama pemohon wajib diisi."),
    tandaTanganPemohon: z.string().trim().min(1, "Tanda tangan pemohon wajib diisi."),
  })
  .superRefine((value, ctx) => {
    value.manufacturers.forEach((manufacturerGroup, manufacturerIndex) => {
      const manufacturer = feedData.find(
        (manufacturerItem) => manufacturerItem.code === manufacturerGroup.pabrikan,
      );

      if (manufacturerGroup.pabrikan === "cp") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manufacturers", manufacturerIndex, "pabrikan"],
          message: "Harga CP belum tersedia, sehingga pesanan belum dapat dikirim.",
        });
        return;
      }

      manufacturerGroup.feeds.forEach((feedItem, feedIndex) => {
        const feedExists = manufacturer?.feeds.some((feed) => feed.code === feedItem.jenisPakan);
        if (!feedExists) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["manufacturers", manufacturerIndex, "feeds", feedIndex, "jenisPakan"],
            message: "Jenis pakan tidak sesuai dengan pabrikan yang dipilih.",
          });
        }
      });
    });
  });

export type OrderFormValues = z.infer<typeof orderSchema>;
