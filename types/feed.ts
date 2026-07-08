export type ManufacturerCode = "malindo" | "new-hope" | "cp";

export type FeedItem = {
  code: string;
  name: string;
  pricePerKg: number;
  pricePerSack?: number;
};

export type Manufacturer = {
  code: ManufacturerCode;
  name: string;
  feeds: FeedItem[];
  warning?: string;
  unavailableMessage?: string;
};
