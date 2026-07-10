import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { feedData } from "@/data/feedData";
import type { CompletedOrder } from "@/types/order";

const ORDER_HEADERS = [
  "Nomor PO",
  "Timestamp",
  "Wilayah",
  "Nama Peternak",
  "Tanggal Order",
  "Pabrikan",
  "Item Ke",
  "Jenis Pakan",
  "Harga per Kg",
  "Harga per Sak",
  "Jumlah Sak",
  "Total Harga",
  "Total PO",
  "Tanggal Terima",
  "Nama Pemohon",
];

const AREA_INDEX_HEADERS = ["Wilayah", "Spreadsheet ID", "Spreadsheet URL", "Created At"];

const MANUFACTURER_TAB_NAMES: Record<string, string> = {
  malindo: "PO Pakan Malindo",
  "new-hope": "PO Pakan Newhope",
  cp: "PO Pakan CP",
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }
  return value;
}

async function withGoogleStep<T>(step: string, action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Google API error";
    throw new Error(`${step}: ${detail}`);
  }
}

function getGoogleClients() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
  };
}

function normalizeArea(area: string) {
  return area.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

function range(sheetTitle: string, a1: string) {
  const escapedTitle = sheetTitle.replaceAll("'", "''");
  return `'${escapedTitle}'!${a1}`;
}

function getPoColor(startRow: number) {
  const palette = [
    { red: 0.86, green: 0.94, blue: 1 },
    { red: 0.88, green: 0.97, blue: 0.86 },
    { red: 1, green: 0.93, blue: 0.78 },
    { red: 0.93, green: 0.88, blue: 1 },
    { red: 1, green: 0.86, blue: 0.88 },
    { red: 0.84, green: 0.96, blue: 0.94 },
    { red: 1, green: 0.9, blue: 0.98 },
  ];

  return palette[Math.max(0, startRow - 2) % palette.length];
}

function parseUpdatedRows(updatedRange?: string | null) {
  const match = updatedRange?.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/);
  if (!match) return null;

  return {
    startRow: Number(match[1]),
    endRow: Number(match[2]),
  };
}

function getManufacturerTabName(manufacturerCode: string) {
  return MANUFACTURER_TAB_NAMES[manufacturerCode] ?? `PO Pakan ${manufacturerCode}`;
}

async function ensureSheetExists(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
) {
  const spreadsheet = await withGoogleStep(
    `Tidak bisa membaca spreadsheet ${spreadsheetId}`,
    () =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title",
      }),
  );

  const exists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetTitle,
  );

  if (!exists) {
    await withGoogleStep(
      `Tidak bisa membuat tab "${sheetTitle}" di spreadsheet ${spreadsheetId}`,
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                  },
                },
              },
            ],
          },
        }),
    );
  }
}

async function ensureHeaderRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  headers: string[],
): Promise<number> {
  await ensureSheetExists(sheets, spreadsheetId, sheetTitle);

  const spreadsheet = await withGoogleStep(
    `Tidak bisa membaca sheet id tab "${sheetTitle}"`,
    () =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties(sheetId,title)",
      }),
  );
  const sheetId = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties?.title === sheetTitle,
  )?.properties?.sheetId;

  if (typeof sheetId !== "number") {
    throw new Error(`Sheet ID untuk tab "${sheetTitle}" tidak ditemukan.`);
  }

  const result = await withGoogleStep(
    `Tidak bisa membaca header tab "${sheetTitle}"`,
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: range(sheetTitle, "1:1"),
      }),
  );

  const existingHeader = result.data.values?.[0] ?? [];
  if (existingHeader.join("|") !== headers.join("|")) {
    await withGoogleStep(
      `Tidak bisa menulis header tab "${sheetTitle}"`,
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: range(sheetTitle, "A1"),
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [headers],
          },
        }),
    );
  }

  return sheetId;
}

function extractSpreadsheetId(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return fromUrl?.[1] ?? trimmed;
}

async function findAreaSpreadsheet(
  sheets: sheets_v4.Sheets,
  masterSpreadsheetId: string,
  area: string,
  indexTabName: string,
) {
  await ensureHeaderRow(sheets, masterSpreadsheetId, indexTabName, AREA_INDEX_HEADERS);

  const result = await withGoogleStep(
    `Tidak bisa membaca daftar link wilayah di master spreadsheet`,
    () =>
      sheets.spreadsheets.values.get({
        spreadsheetId: masterSpreadsheetId,
        range: range(indexTabName, "A2:D"),
      }),
  );

  const rows = result.data.values ?? [];
  const areaKey = normalizeArea(area);
  const match = rows.find((row) => normalizeArea(String(row[0] ?? "")) === areaKey);
  const idFromColumn = match?.[1] ? extractSpreadsheetId(String(match[1])) : "";
  const idFromUrl = match?.[2] ? extractSpreadsheetId(String(match[2])) : "";
  const spreadsheetId = idFromColumn || idFromUrl;

  return {
    spreadsheetId: spreadsheetId || null,
    availableAreas: rows
      .map((row) => String(row[0] ?? "").trim())
      .filter(Boolean),
  };
}

async function getAreaSpreadsheet(
  sheets: sheets_v4.Sheets,
  masterSpreadsheetId: string,
  area: string,
  indexTabName: string,
) {
  const result = await findAreaSpreadsheet(
    sheets,
    masterSpreadsheetId,
    area,
    indexTabName,
  );

  if (result.spreadsheetId) return result.spreadsheetId;

  throw new Error(
    `Wilayah ${area} belum terdaftar di tab "${indexTabName}". Wilayah yang terbaca: ${
      result.availableAreas.length ? result.availableAreas.join(", ") : "kosong"
    }. Cek GOOGLE_SHEETS_MASTER_SPREADSHEET_ID dan nama tab.`,
  );
}

export async function appendOrderToSheet(order: CompletedOrder) {
  const masterSpreadsheetId = getRequiredEnv("GOOGLE_SHEETS_MASTER_SPREADSHEET_ID");
  const indexTabName = process.env.GOOGLE_SHEETS_INDEX_TAB_NAME || "Area Links";
  const { sheets } = getGoogleClients();

  const areaSpreadsheetId = await getAreaSpreadsheet(
    sheets,
    masterSpreadsheetId,
    order.wilayah,
    indexTabName,
  );

  const sheetIdsByTab = new Map<string, number>();
  for (const manufacturer of feedData) {
    const tabName = getManufacturerTabName(manufacturer.code);
    const sheetId = await ensureHeaderRow(sheets, areaSpreadsheetId, tabName, ORDER_HEADERS);
    sheetIdsByTab.set(tabName, sheetId);
  }

  const itemsByManufacturer = new Map<string, typeof order.items>();
  for (const item of order.items) {
    const existingItems = itemsByManufacturer.get(item.pabrikanCode) ?? [];
    existingItems.push(item);
    itemsByManufacturer.set(item.pabrikanCode, existingItems);
  }

  for (const [manufacturerCode, items] of itemsByManufacturer.entries()) {
    const tabName = getManufacturerTabName(manufacturerCode);
    const sheetId = sheetIdsByTab.get(tabName);
    if (typeof sheetId !== "number") continue;

    const manufacturerTotal = items.reduce((sum, item) => sum + item.totalHarga, 0);
    const rows = items.map((item) => [
      order.nomorPo,
      order.timestamp,
      order.wilayah,
      order.namaPeternak,
      order.tanggalOrder,
      item.pabrikanName,
      item.itemNumber,
      item.jenisPakanName,
      item.hargaPerKg,
      item.hargaPerSak,
      item.jumlahSak,
      item.totalHarga,
      manufacturerTotal,
      order.tanggalTerima ?? "",
      order.namaPemohon,
    ]);

    const appendResult = await withGoogleStep(
      `Tidak bisa menulis order ke tab ${tabName} wilayah ${order.wilayah}`,
      () =>
        sheets.spreadsheets.values.append({
          spreadsheetId: areaSpreadsheetId,
          range: range(tabName, "A:O"),
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: rows,
          },
        }),
    );

    const updatedRows = parseUpdatedRows(appendResult.data.updates?.updatedRange);
    if (!updatedRows) continue;

    await withGoogleStep(
      `Tidak bisa memberi warna row untuk ${order.nomorPo} di tab ${tabName}`,
      () =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: areaSpreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: updatedRows.startRow - 1,
                    endRowIndex: updatedRows.endRow,
                    startColumnIndex: 0,
                    endColumnIndex: ORDER_HEADERS.length,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: getPoColor(updatedRows.startRow),
                    },
                  },
                  fields: "userEnteredFormat.backgroundColor",
                },
              },
            ],
          },
        }),
    );
  }
}
