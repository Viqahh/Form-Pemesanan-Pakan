import type { OrderFormValues } from "@/lib/order-schema";

export type CompletedOrder = Omit<OrderFormValues, "items"> & {
  nomorPo: string;
  timestamp: string;
  wilayah: string;
  pabrikanName: string;
  items: CompletedOrderItem[];
  totalJumlahSak: number;
  totalHarga: number;
};

export type CompletedOrderItem = {
  itemNumber: number;
  jenisPakanCode: string;
  jenisPakanName: string;
  hargaPerKg: number;
  hargaPerSak: number;
  jumlahSak: number;
  totalHarga: number;
};
