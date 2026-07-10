"use client";

import { useEffect, useState } from "react";
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
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

const emptyFeed = {
  jenisPakan: "",
  jumlahSak: 1,
};

const emptyManufacturer = {
  pabrikan: undefined as unknown as OrderFormValues["manufacturers"][number]["pabrikan"],
  feeds: [emptyFeed],
};

const defaultValues: OrderFormValues = {
  nomorPo: "",
  wilayah: undefined as unknown as OrderFormValues["wilayah"],
  namaPeternak: "",
  tanggalOrder: "",
  manufacturers: [emptyManufacturer],
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

  const {
    fields: manufacturerFields,
    append: appendManufacturer,
    remove: removeManufacturer,
    replace: replaceManufacturers,
  } = useFieldArray({
    control,
    name: "manufacturers",
  });

  const watchedManufacturers = watch("manufacturers") ?? [];
  const itemSummaries = watchedManufacturers.flatMap((manufacturerGroup, manufacturerIndex) =>
    (manufacturerGroup?.feeds ?? []).map((feedItem, feedIndex) => {
      const pricing = resolveOrderPricing(
        manufacturerGroup?.pabrikan,
        feedItem?.jenisPakan,
        Number(feedItem?.jumlahSak) || 0,
      );

      return {
        key: `${manufacturerIndex}-${feedIndex}`,
        manufacturerName: pricing.manufacturer?.name ?? "-",
        warning: pricing.manufacturer?.warning,
        isUnavailable: manufacturerGroup?.pabrikan === "cp",
        feedName: pricing.feed?.name ?? "-",
        quantity: Number(feedItem?.jumlahSak) || 0,
        total: pricing.total,
        hasFeed: Boolean(pricing.feed),
      };
    }),
  );

  const totalSacks = itemSummaries.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = itemSummaries.reduce((sum, item) => sum + item.total, 0);
  const manufacturerSummaries = feedData.map((manufacturer) => {
    const items = itemSummaries.filter((item) => item.manufacturerName === manufacturer.name);
    const isUnavailable = items.some((item) => item.isUnavailable);

    return {
      code: manufacturer.code,
      name: manufacturer.name,
      sacks: items.reduce((sum, item) => sum + item.quantity, 0),
      total: items.reduce((sum, item) => sum + item.total, 0),
      isUnavailable,
    };
  });
  const warningMessages = Array.from(
    new Set(itemSummaries.map((item) => item.warning).filter(Boolean)),
  );
  const hasUnavailableItems = itemSummaries.some((item) => item.isUnavailable);
  const canSubmit = !isSubmitting && !hasUnavailableItems && Boolean(currentPo);

  useEffect(() => {
    const poNumber = generatePoNumber();
    setCurrentPo(poNumber);
    setValue("nomorPo", poNumber, { shouldValidate: true });
  }, [setValue]);

  function resetFormWithNewPo() {
    const poNumber = generatePoNumber();
    setCurrentPo(poNumber);
    reset({ ...defaultValues, nomorPo: poNumber, manufacturers: [emptyManufacturer] });
    setValue("wilayah", undefined as unknown as OrderFormValues["wilayah"], {
      shouldDirty: false,
      shouldValidate: false,
    });
    replaceManufacturers([emptyManufacturer]);
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

              <FormField
                label="Tanggal Terima (Opsional)"
                htmlFor="tanggalTerima"
                error={errors.tanggalTerima?.message}
              >
                <Input id="tanggalTerima" type="date" {...register("tanggalTerima")} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Barang akan diterima dalam 1-10 hari. Jika belum pasti, boleh dikosongkan.
                </p>
              </FormField>
            </div>

            <div className="space-y-4 rounded-md border bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Rincian Pakan</h3>
                  <p className="text-sm text-muted-foreground">
                    Satu pabrikan bisa berisi beberapa jenis pakan. Tambah pabrikan lain bila perlu.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendManufacturer(emptyManufacturer)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add More Pabrikan
                </Button>
              </div>

              {manufacturerFields.map((field, index) => (
                <ManufacturerGroup
                  key={field.id}
                  control={control}
                  errors={errors}
                  formResetKey={formResetKey}
                  groupId={field.id}
                  groupIndex={index}
                  register={register}
                  removeGroup={() => removeManufacturer(index)}
                  setValue={setValue}
                  showRemoveGroup={manufacturerFields.length > 1}
                  watchedGroup={watchedManufacturers[index]}
                />
              ))}

              {errors.manufacturers?.root?.message ? (
                <p className="text-sm font-medium text-destructive">
                  {errors.manufacturers.root.message}
                </p>
              ) : null}
            </div>

            <FormField label="Total Harga" htmlFor="totalHarga">
              <Input
                id="totalHarga"
                readOnly
                value={hasUnavailableItems ? "Harga belum tersedia" : formatRupiah(grandTotal)}
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

            {warningMessages.map((warning) => (
              <div
                key={warning}
                className="flex gap-3 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
                <p>{warning}</p>
              </div>
            ))}

            {hasUnavailableItems ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                Harga CP belum tersedia.
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
            {manufacturerSummaries.map((manufacturer) => (
              <div key={manufacturer.code} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{manufacturer.name}</p>
                    <p className="mt-1 text-muted-foreground">{manufacturer.sacks} sak</p>
                  </div>
                  <p className="text-right font-semibold text-slate-900">
                    {manufacturer.isUnavailable ? "Harga belum tersedia" : formatRupiah(manufacturer.total)}
                  </p>
                </div>
              </div>
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

function ManufacturerGroup({
  control,
  errors,
  formResetKey,
  groupId,
  groupIndex,
  register,
  removeGroup,
  setValue,
  showRemoveGroup,
  watchedGroup,
}: {
  control: Control<OrderFormValues>;
  errors: FieldErrors<OrderFormValues>;
  formResetKey: number;
  groupId: string;
  groupIndex: number;
  register: UseFormRegister<OrderFormValues>;
  removeGroup: () => void;
  setValue: UseFormSetValue<OrderFormValues>;
  showRemoveGroup: boolean;
  watchedGroup?: OrderFormValues["manufacturers"][number];
}) {
  const {
    fields: feedFields,
    append: appendFeed,
    remove: removeFeed,
    replace: replaceFeeds,
  } = useFieldArray({
    control,
    name: `manufacturers.${groupIndex}.feeds`,
  });
  const selectedManufacturer = feedData.find(
    (manufacturer) => manufacturer.code === watchedGroup?.pabrikan,
  );
  const isCpUnavailable = watchedGroup?.pabrikan === "cp";

  return (
    <div className="space-y-4 rounded-md bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Controller
          control={control}
          name={`manufacturers.${groupIndex}.pabrikan`}
          render={({ field }) => (
            <FormField
              label={`Pabrikan ${groupIndex + 1}`}
              error={errors.manufacturers?.[groupIndex]?.pabrikan?.message}
            >
              <Select
                key={`manufacturer-${formResetKey}-${groupId}`}
                onValueChange={(value) => {
                  field.onChange(value);
                  replaceFeeds([emptyFeed]);
                }}
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

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => appendFeed(emptyFeed)}
            disabled={!selectedManufacturer || isCpUnavailable}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Jenis
          </Button>
          {showRemoveGroup ? (
            <Button
              type="button"
              variant="outline"
              onClick={removeGroup}
              aria-label={`Hapus pabrikan ${groupIndex + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {feedFields.map((field, feedIndex) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-md border bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
          >
            <Controller
              control={control}
              name={`manufacturers.${groupIndex}.feeds.${feedIndex}.jenisPakan`}
              render={({ field: feedField }) => (
                <FormField
                  label={`Jenis Pakan ${feedIndex + 1}`}
                  error={
                    errors.manufacturers?.[groupIndex]?.feeds?.[feedIndex]?.jenisPakan?.message
                  }
                >
                  <Select
                    key={`feed-${formResetKey}-${groupId}-${field.id}`}
                    disabled={!selectedManufacturer || isCpUnavailable}
                    onValueChange={feedField.onChange}
                    value={feedField.value ?? ""}
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
              htmlFor={`jumlahSak-${groupIndex}-${feedIndex}`}
              error={errors.manufacturers?.[groupIndex]?.feeds?.[feedIndex]?.jumlahSak?.message}
            >
              <Input
                id={`jumlahSak-${groupIndex}-${feedIndex}`}
                type="number"
                min={1}
                step={1}
                {...register(`manufacturers.${groupIndex}.feeds.${feedIndex}.jumlahSak`)}
              />
            </FormField>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => removeFeed(feedIndex)}
                disabled={feedFields.length === 1}
                aria-label={`Hapus jenis pakan ${feedIndex + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isCpUnavailable ? (
        <p className="text-sm font-medium text-muted-foreground">Harga belum tersedia.</p>
      ) : null}
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
