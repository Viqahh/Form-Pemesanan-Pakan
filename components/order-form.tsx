"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/form-field";
import { SignatureField } from "@/components/signature-field";
import { SubmissionSpinner } from "@/components/submission-spinner";
import { feedData, getPricePerSack } from "@/data/feedData";
import { regions } from "@/data/formOptions";
import { orderSchema, type OrderFormValues } from "@/lib/order-schema";
import { resolveOrderPricing } from "@/lib/pricing";
import { formatRupiah } from "@/utils/currency";
import { downloadBlob } from "@/utils/download";

const emptyItem = { jenisPakan: "", jumlahSak: 1 };

const defaultValues: OrderFormValues = {
  nomorPo: "",
  wilayah: undefined as unknown as OrderFormValues["wilayah"],
  namaPeternak: "",
  tanggalOrder: "",
  pabrikan: undefined as unknown as OrderFormValues["pabrikan"],
  items: [emptyItem],
  tanggalTerima: "",
  namaPemohon: "",
  tandaTanganPemohon: "",
};

function generatePoNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `PO-${date}-${time}-${suffix}`;
}

export function OrderForm() {
  const [signatureResetKey, setSignatureResetKey] = useState(0);
  const [formResetKey, setFormResetKey] = useState(0);
  const [currentPo, setCurrentPo] = useState("");
  const hasSelectedManufacturerOnce = useRef(false);
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues,
    mode: "onChange",
  });

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = form;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "items",
  });

  const selectedManufacturerCode = watch("pabrikan");
  const watchedItems = watch("items") ?? [];

  const selectedManufacturer = useMemo(
    () => feedData.find((manufacturer) => manufacturer.code === selectedManufacturerCode),
    [selectedManufacturerCode],
  );

  const itemSummaries = watchedItems.map((item) => {
    const pricing = resolveOrderPricing(
      selectedManufacturerCode,
      item?.jenisPakan,
      Number(item?.jumlahSak) || 0,
    );

    return {
      feedName: pricing.feed?.name ?? "-",
      pricePerKg: pricing.pricePerKg,
      pricePerSack: pricing.pricePerSack,
      quantity: Number(item?.jumlahSak) || 0,
      total: pricing.total,
      hasFeed: Boolean(pricing.feed),
    };
  });

  const totalSacks = itemSummaries.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = itemSummaries.reduce((sum, item) => sum + item.total, 0);
  const isCpUnavailable = selectedManufacturerCode === "cp";
  const canSubmit = !isSubmitting && !isCpUnavailable && Boolean(currentPo);

  useEffect(() => {
    const poNumber = generatePoNumber();
    setCurrentPo(poNumber);
    setValue("nomorPo", poNumber, { shouldValidate: true });
  }, [setValue]);

  useEffect(() => {
    if (!hasSelectedManufacturerOnce.current) {
      hasSelectedManufacturerOnce.current = true;
      return;
    }

    replace([emptyItem]);
  }, [replace, selectedManufacturerCode]);

  function resetFormWithNewPo() {
    const poNumber = generatePoNumber();
    setCurrentPo(poNumber);
    hasSelectedManufacturerOnce.current = false;
    reset({ ...defaultValues, nomorPo: poNumber, items: [emptyItem] });
    setValue("wilayah", undefined as unknown as OrderFormValues["wilayah"], {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue("pabrikan", undefined as unknown as OrderFormValues["pabrikan"], {
      shouldDirty: false,
      shouldValidate: false,
    });
    replace([emptyItem]);
    setFormResetKey((value) => value + 1);
    setSignatureResetKey((value) => value + 1);
  }

  async function onSubmit(values: OrderFormValues) {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Gagal mengirim pemesanan.");
      }

      const blob = await response.blob();
      const fileSafeName = values.nomorPo.toLowerCase();
      downloadBlob(blob, `pemesanan-pakan-${fileSafeName}.pdf`);

      toast.success(`Pemesanan ${values.nomorPo} berhasil disimpan dan PDF telah diunduh.`);
      resetFormWithNewPo();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengirim pemesanan.";
      toast.error(message);
    }
  }

  function onInvalid() {
    toast.error("Periksa kembali field yang wajib diisi.");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Data Pemesanan</CardTitle>
          <CardDescription>
            Isi semua detail order pakan. Nomor PO dibuat otomatis untuk setiap submit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit, onInvalid)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Nomor PO" htmlFor="nomorPo" error={errors.nomorPo?.message}>
                <Input
                  id="nomorPo"
                  readOnly
                  className="font-semibold text-primary"
                  {...register("nomorPo")}
                />
              </FormField>

              <Controller
                control={control}
                name="wilayah"
                render={({ field }) => (
                  <FormField label="Wilayah Pemesanan" error={errors.wilayah?.message}>
                    <Select
                      key={`wilayah-${formResetKey}`}
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih wilayah" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />

              <FormField
                label="Nama Peternak"
                htmlFor="namaPeternak"
                error={errors.namaPeternak?.message}
              >
                <Input
                  id="namaPeternak"
                  placeholder="Masukkan nama peternak"
                  {...register("namaPeternak")}
                />
              </FormField>

              <FormField
                label="Tanggal Order"
                htmlFor="tanggalOrder"
                error={errors.tanggalOrder?.message}
              >
                <Input id="tanggalOrder" type="date" {...register("tanggalOrder")} />
              </FormField>

              <Controller
                control={control}
                name="pabrikan"
                render={({ field }) => (
                  <FormField label="Nama Pabrikan" error={errors.pabrikan?.message}>
                    <Select
                      key={`pabrikan-${formResetKey}`}
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih pabrikan" />
                      </SelectTrigger>
                      <SelectContent>
                        {feedData.map((manufacturer) => (
                          <SelectItem key={manufacturer.code} value={manufacturer.code}>
                            {manufacturer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />

              <FormField
                label="Tanggal Terima"
                htmlFor="tanggalTerima"
                error={errors.tanggalTerima?.message}
              >
                <Input id="tanggalTerima" type="date" {...register("tanggalTerima")} />
              </FormField>
            </div>

            <div className="space-y-4 rounded-md border bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Rincian Pakan</h3>
                  <p className="text-sm text-muted-foreground">
                    Tambahkan lebih dari satu jenis pakan dalam PO yang sama.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append(emptyItem)}
                  disabled={!selectedManufacturer || isCpUnavailable}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add More
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-4 rounded-md bg-white p-4 sm:grid-cols-[1fr_160px_auto]">
                  <Controller
                    control={control}
                    name={`items.${index}.jenisPakan`}
                    render={({ field: itemField }) => (
                      <FormField
                        label={`Jenis Pakan ${index + 1}`}
                        error={errors.items?.[index]?.jenisPakan?.message}
                      >
                        <Select
                          key={`item-${formResetKey}-${field.id}`}
                          disabled={!selectedManufacturer || isCpUnavailable}
                          onValueChange={itemField.onChange}
                          value={itemField.value ?? ""}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                isCpUnavailable
                                  ? "Harga belum tersedia"
                                  : selectedManufacturer
                                    ? "Pilih jenis pakan"
                                    : "Pilih pabrikan dahulu"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedManufacturer?.feeds.map((feed) => (
                              <SelectItem key={feed.code} value={feed.code}>
                                {feed.name} - {formatRupiah(getPricePerSack(feed))}/sak
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    )}
                  />

                  <FormField
                    label="Jumlah (sak)"
                    htmlFor={`jumlahSak-${index}`}
                    error={errors.items?.[index]?.jumlahSak?.message}
                  >
                    <Input
                      id={`jumlahSak-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      {...register(`items.${index}.jumlahSak`)}
                    />
                  </FormField>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label={`Hapus item pakan ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {errors.items?.root?.message ? (
                <p className="text-sm font-medium text-destructive">{errors.items.root.message}</p>
              ) : null}
            </div>

            <FormField label="Total Harga" htmlFor="totalHarga">
              <Input
                id="totalHarga"
                readOnly
                value={isCpUnavailable ? "Harga belum tersedia" : formatRupiah(grandTotal)}
                className="font-semibold text-primary"
              />
            </FormField>

            <FormField
              label="Nama Pemohon"
              htmlFor="namaPemohon"
              error={errors.namaPemohon?.message}
            >
              <Input
                id="namaPemohon"
                placeholder="Masukkan nama pemohon"
                {...register("namaPemohon")}
              />
            </FormField>

            {selectedManufacturer?.warning ? (
              <div className="flex gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                <p>{selectedManufacturer.warning}</p>
              </div>
            ) : null}

            {isCpUnavailable ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                Harga belum tersedia.
              </div>
            ) : null}

            <Controller
              control={control}
              name="tandaTanganPemohon"
              render={({ field }) => (
                <FormField label="Tanda Tangan Pemohon">
                  <SignatureField
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.tandaTanganPemohon?.message}
                    resetKey={signatureResetKey}
                  />
                </FormField>
              )}
            />

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {isSubmitting ? <SubmissionSpinner /> : <FileDown className="mr-2 h-5 w-5" />}
              {isSubmitting ? "Mengirim Pemesanan..." : "Submit dan Download PDF"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-5">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Ringkasan Harga
            </CardTitle>
            <CardDescription>Preview harga berdasarkan pilihan saat ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <SummaryRow label="Nomor PO" value={currentPo || "-"} />
            <SummaryRow label="Pabrikan" value={selectedManufacturer?.name ?? "-"} />
            {itemSummaries.map((item, index) => (
              <SummaryRow
                key={`${index}-${item.feedName}`}
                label={`Item ${index + 1}`}
                value={`${item.feedName} • ${item.quantity} sak • ${
                  item.hasFeed ? formatRupiah(item.total) : "-"
                }`}
              />
            ))}
            <SummaryRow label="Total Sak" value={`${totalSacks} sak`} />
            <div className="rounded-md bg-secondary p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Total</p>
              <p className="mt-1 text-2xl font-bold text-primary">{formatRupiah(grandTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
