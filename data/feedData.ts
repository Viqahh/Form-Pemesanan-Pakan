import type { Manufacturer } from "@/types/feed";

export const SACK_WEIGHT_KG = 50;

export const feedData: Manufacturer[] = [
  {
    code: "malindo",
    name: "Malindo",
    feeds: [
      { code: "8201-st", name: "8201 ST", pricePerKg: 9800, pricePerSack: 490000 },
      { code: "8201-sp", name: "8201 SP", pricePerKg: 9150, pricePerSack: 457500 },
      { code: "8202-sp", name: "8202 SP", pricePerKg: 9675, pricePerSack: 483750 },
      { code: "8202-gnt", name: "8202 GNT", pricePerKg: 9050, pricePerSack: 452500 },
      { code: "9203-sp", name: "9203 SP", pricePerKg: 9525, pricePerSack: 476250 },
      { code: "9203-gnt", name: "9203 GNT", pricePerKg: 8950, pricePerSack: 447500 },
      { code: "8201aa", name: "8201AA", pricePerKg: 9550, pricePerSack: 477500 },
      { code: "8202aa", name: "8202AA", pricePerKg: 8600, pricePerSack: 430000 },
      { code: "9203aa", name: "9203AA", pricePerKg: 8400, pricePerSack: 420000 },
      { code: "k7203", name: "K7203", pricePerKg: 11200, pricePerSack: 560000 },
    ],
  },
  {
    code: "new-hope",
    name: "New Hope",
    feeds: [
      { code: "bps", name: "BPS", pricePerKg: 9600 },
      { code: "b11a", name: "B11A", pricePerKg: 9400 },
      { code: "b12a", name: "B12A", pricePerKg: 9300 },
      { code: "b11a-b", name: "B11A B", pricePerKg: 9300 },
      { code: "b12a-b", name: "B12A B", pricePerKg: 9200 },
      { code: "br1", name: "BR1", pricePerKg: 8550 },
      { code: "br2", name: "BR2", pricePerKg: 8450 },
    ],
    warning:
      "Stok B11A B, B12A B, BR1 dan BR2 tidak selalu tersedia. Kadang tersedia dan kadang kosong.",
  },
  {
    code: "cp",
    name: "CP (Charoen Pokphand)",
    feeds: [],
    unavailableMessage: "Harga belum tersedia.",
  },
];

export function getManufacturer(code?: string) {
  return feedData.find((manufacturer) => manufacturer.code === code);
}

export function getFeed(manufacturerCode?: string, feedCode?: string) {
  return getManufacturer(manufacturerCode)?.feeds.find((feed) => feed.code === feedCode);
}

export function getPricePerSack(feed?: { pricePerKg: number; pricePerSack?: number }) {
  if (!feed) return 0;
  return feed.pricePerSack ?? feed.pricePerKg * SACK_WEIGHT_KG;
}
