import itemsCsv from "./items.csv?raw";

export const ItemCode = {
  VictorySword: "VICTORY_SWORD",
  Rage: "RAGE",
  PorcelainShield: "PORCELAIN_SHIELD",
  MoneyBag: "MONEY_BAG",
  Magnet: "MAGNET",
  FirstAidPatch: "FIRST_AID_PATCH",
  ExtraShot: "EXTRA_SHOT",
  InterestCert: "INTEREST_CERT",
  DiscountTicket: "DISCOUNT_TICKET",
  ExpandedShelf: "EXPANDED_SHELF",
  WidePocket: "WIDE_POCKET",
  GiantChalk: "GIANT_CHALK",
  BlastMarker: "BLAST_MARKER",
  RepulseMarker: "REPULSE_MARKER",
  AttractMarker: "ATTRACT_MARKER",
  CueRelocator: "CUE_RELOCATOR",
  PocketCushion: "POCKET_CUSHION",
  LastStandCue: "LAST_STAND_CUE",
  VitalCore: "VITAL_CORE",
  DrawGo: "DRAW_GO",
  HeavyCue: "HEAVY_CUE",
  PhaseCue: "PHASE_CUE",
  PoisonCharm: "POISON_CHARM",
} as const;

export type ItemCode = (typeof ItemCode)[keyof typeof ItemCode];

export const ItemRarity = {
  Common: "Common",
  Uncommon: "Uncommon",
  Rare: "Rare",
  Epic: "Epic",
  Legendary: "Legendary",
} as const;

export type ItemRarity = (typeof ItemRarity)[keyof typeof ItemRarity];

export const ItemRarityColor: Record<ItemRarity, string> = {
  [ItemRarity.Common]: "#f7f1d7",
  [ItemRarity.Uncommon]: "#8cf0bd",
  [ItemRarity.Rare]: "#7fb7ff",
  [ItemRarity.Epic]: "#d391ff",
  [ItemRarity.Legendary]: "#ffbf5f",
};

export type Item = {
  code: ItemCode;
  label: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  price: number;
  isUnique: boolean;
  enabled: boolean;
  useCount: number | undefined;
  arriveOn: number | undefined;
  saleOn: number[];
  debugDefault: boolean;
};

const RequiredColumns = [
  "code",
  "label",
  "name",
  "description",
  "rarity",
  "price",
  "isUnique",
  "enabled",
  "useCount",
  "arriveOn",
  "saleOn",
  "debugDefault",
] as const;

type ItemCsvRow = Record<(typeof RequiredColumns)[number], string>;

const ItemCodeValues = new Set<string>(Object.values(ItemCode));
const ItemRarityValues = new Set<string>(Object.values(ItemRarity));

export const Items: Item[] = loadItemsFromCsv(itemsCsv);

function loadItemsFromCsv(csv: string): Item[] {
  const [header, ...rows] = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (!header) throw new Error("items.csv is empty");

  const columnIndex = new Map(
    header.map((column, index) => [normalizeCsvHeader(column), index]),
  );
  for (const column of RequiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`items.csv missing required column: ${column}`);
    }
  }

  const items = rows.map((row, index) =>
    parseItemRow(readRow(row, columnIndex), index + 2)
  );
  validateItemCodes(items);
  return items;
}

function normalizeCsvHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").trim();
}

function parseItemRow(row: ItemCsvRow, rowNumber: number): Item {
  if (!isItemCode(row.code)) {
    throw new Error(`items.csv row ${rowNumber}: unknown item code ${row.code}`);
  }

  const price = Number(row.price);
  if (!Number.isInteger(price) || price < 0) {
    throw new Error(`items.csv row ${rowNumber}: invalid price ${row.price}`);
  }
  if (!isItemRarity(row.rarity)) {
    throw new Error(
      `items.csv row ${rowNumber}: invalid rarity ${row.rarity}`,
    );
  }

  return {
    code: row.code,
    label: row.label,
    name: row.name,
    description: row.description,
    rarity: row.rarity,
    price,
    isUnique: parseBoolean(row.isUnique, rowNumber, "isUnique"),
    enabled: parseBoolean(row.enabled, rowNumber, "enabled"),
    useCount: parseUseCount(row.useCount, rowNumber),
    arriveOn: parseArriveOn(row.arriveOn, rowNumber),
    saleOn: parseSaleOn(row.saleOn, rowNumber),
    debugDefault: parseBoolean(row.debugDefault, rowNumber, "debugDefault"),
  };
}

function readRow(
  row: string[],
  columnIndex: Map<string, number>,
): ItemCsvRow {
  const values = {} as ItemCsvRow;
  for (const column of RequiredColumns) {
    values[column] = row[columnIndex.get(column)!] ?? "";
  }
  return values;
}

function parseBoolean(value: string, rowNumber: number, column: string): boolean {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "true") return true;
  if (normalizedValue === "false") return false;
  throw new Error(`items.csv row ${rowNumber}: invalid ${column} ${value}`);
}

function parseUseCount(value: string, rowNumber: number): number | undefined {
  if (value === "") return undefined;

  const useCount = Number(value);
  if (!Number.isInteger(useCount) || useCount < 0) {
    throw new Error(`items.csv row ${rowNumber}: invalid useCount ${value}`);
  }
  return useCount;
}

function parseArriveOn(value: string, rowNumber: number): number | undefined {
  if (value === "") return undefined;

  const arriveOn = Number(value);
  if (!Number.isInteger(arriveOn) || arriveOn < 1) {
    throw new Error(`items.csv row ${rowNumber}: invalid arriveOn ${value}`);
  }
  return arriveOn;
}

function parseSaleOn(value: string, rowNumber: number): number[] {
  if (value === "") return [];

  return value.split("/").map((part) => {
    const trimmed = part.trim();
    const saleOn = Number(trimmed);
    if (!Number.isInteger(saleOn) || saleOn < 1) {
      throw new Error(`items.csv row ${rowNumber}: invalid saleOn ${value}`);
    }
    return saleOn;
  });
}

function isItemCode(value: string): value is ItemCode {
  return ItemCodeValues.has(value);
}

function isItemRarity(value: string): value is ItemRarity {
  return ItemRarityValues.has(value);
}

function validateItemCodes(items: Item[]) {
  const seen = new Set<ItemCode>();
  for (const item of items) {
    if (seen.has(item.code)) {
      throw new Error(`items.csv has duplicate item code: ${item.code}`);
    }
    seen.add(item.code);
  }

  for (const code of Object.values(ItemCode)) {
    if (!seen.has(code)) {
      throw new Error(`items.csv missing item code: ${code}`);
    }
  }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
