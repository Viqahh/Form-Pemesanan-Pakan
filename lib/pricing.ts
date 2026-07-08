import { getFeed, getManufacturer, getPricePerSack } from "@/data/feedData";

export function resolveOrderPricing(manufacturerCode: string, feedCode?: string, quantity = 0) {
  const manufacturer = getManufacturer(manufacturerCode);
  const feed = getFeed(manufacturerCode, feedCode);
  const pricePerSack = getPricePerSack(feed);
  const total = pricePerSack * quantity;

  return {
    manufacturer,
    feed,
    pricePerKg: feed?.pricePerKg ?? 0,
    pricePerSack,
    total,
  };
}
