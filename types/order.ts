import type { OrderFormValues } from "@/lib/order-schema";

export type CompletedOrder = Omit<OrderFormValues, "manufacturers"> & {
  nomorPo: string;
  timestamp: string;
  wilayah: string;
  items: CompletedOrderItem[];
  totalJumlahSak: number;
  totalHarga: number;
};

export type CompletedOrderItem = {
  itemNumber: number;
  pabrikanCode: string;
  pabrikanName: string;
  jenisPakanCode: string;
  jenisPakanName: string;
  hargaPerKg: number;
  hargaPerSak: number;
  jumlahSak: number;
  totalHarga: number;
};
