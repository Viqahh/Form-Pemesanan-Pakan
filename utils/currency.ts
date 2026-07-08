export function formatRupiah(value: number) {
  return `Rp${formatNumberId(value)}`;
}

export function formatNumberId(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}
