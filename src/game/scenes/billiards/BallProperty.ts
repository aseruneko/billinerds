import ballPropertiesCsv from "./ball_properties.csv?raw";
import ballSpecialActionsCsv from "./ball_special_actions.csv?raw";
import { GlobalBuffCode, type GlobalBuffCode as GlobalBuffCodeType } from "./GlobalBuff";

export type BallKind = "cue" | "enemy";
export type BallVisualType =
  | "cue"
  | "solid"
  | "stripe"
  | "eight"
  | "symbol"
  | "emoji"
  | "chip";

export const BallCode = {
  cue: "CUE",
  one: "ONE",
  two: "TWO",
  three: "THREE",
  four: "FOUR",
  five: "FIVE",
  six: "SIX",
  seven: "SEVEN",
  eight: "EIGHT",
  nine: "NINE",
  ten: "TEN",
  eleven: "ELEVEN",
  twelve: "TWELVE",
  thirteen: "THIRTEEN",
  fourteen: "FOURTEEN",
  fifteen: "FIFTEEN",
  pawn: "PAWN",
  rook: "ROOK",
  bishop: "BISHOP",
  knight: "KNIGHT",
  queen: "QUEEN",
  king: "KING",
  club: "CLUB",
  spade: "SPADE",
  heart: "HEART",
  diamond: "DIAMOND",
  chip: "CHIP",
  confettiBomb: "CONFETTI_BOMB",
  joker: "JOKER",
  zombie: "ZOMBIE",
  ghost: "GHOST",
  necromancer: "NECROMANCER",
  doppelganger: "DOPPELGANGER",
  wraith: "WRAITH",
  hollowKing: "HOLLOW_KING",
  soulSeal: "SOUL_SEAL",
} as const;

export type BallCode = (typeof BallCode)[keyof typeof BallCode];

export const BallSpecialActionCode = {
  rookCharge: "ROOK_CHARGE",
  bishopHeal: "BISHOP_HEAL",
  kingCommand: "KING_COMMAND",
  kingCharge: "KING_CHARGE",
  spadeCharge: "SPADE_CHARGE",
  heartHeal: "HEART_HEAL",
  diamondShot: "DIAMOND_SHOT",
  wraithShot: "WRAITH_SHOT",
  breakDown: "BREAK_DOWN",
  chipMultiply: "CHIP_MULTIPLY",
  confettiExplode: "CONFETTI_EXPLODE",
  jokerConfetti: "JOKER_CONFETTI",
  jokerChipRake: "JOKER_CHIP_RAKE",
  jokerRaise: "JOKER_RAISE",
  phaseAttack: "PHASE_ATTACK",
  zombieCommand: "ZOMBIE_COMMAND",
  mirrorStep: "MIRROR_STEP",
  soulCommand: "SOUL_COMMAND",
  hollowSummon: "HOLLOW_SUMMON",
  hollowCharge: "HOLLOW_CHARGE",
  soulSealHeal: "SOUL_SEAL_HEAL",
} as const;

export type BallSpecialActionCode =
  (typeof BallSpecialActionCode)[keyof typeof BallSpecialActionCode];

export type BallSpecialAction = {
  code: BallSpecialActionCode;
  name: string;
  description: string;
  has_premise: boolean;
};

const ActionRequiredColumns = [
  "code",
  "name",
  "description",
  "has_premise",
] as const;

type BallSpecialActionCsvRow = Record<
  (typeof ActionRequiredColumns)[number],
  string
>;

const BallSpecialActionCodeValues = new Set<string>(
  Object.values(BallSpecialActionCode),
);
const GlobalBuffCodeValues = new Set<string>(Object.values(GlobalBuffCode));
const BallCodeValues = new Set<string>(Object.values(BallCode));
const BallKindValues = new Set<string>(["cue", "enemy"]);
const BallVisualTypeValues = new Set<string>([
  "cue",
  "solid",
  "stripe",
  "eight",
  "symbol",
  "emoji",
  "chip",
]);

export const BallSpecialActions: Record<
  BallSpecialActionCode,
  BallSpecialAction
> = loadBallSpecialActionsFromCsv(ballSpecialActionsCsv);

export type BallProperty = {
  code: BallCode;
  label: string;
  name: string;
  description: string;
  ballKind: BallKind;
  visualType: BallVisualType;
  color: number;
  actionPriority: number;
  initialRadius: number;
  initialWeight: number;
  fixed: boolean;
  maxHp: number;
  moneyOnHit: number;
  attack: number;
  blockRate: number;
  labelSizeMultiplier?: number;
  specialActions: BallSpecialActionCode[];
  globalBuffs: GlobalBuffCodeType[];
};

const BallPropertyRequiredColumns = [
  "code",
  "label",
  "name",
  "description",
  "ballKind",
  "visualType",
  "color",
  "actionPriority",
  "initialRadius",
  "initialWeight",
  "maxHp",
  "moneyOnHit",
  "attack",
  "blockRate",
  "labelSizeMultiplier",
  "specialActions",
  "globalBuffs",
] as const;

type BallPropertyCsvRow = Record<
  (typeof BallPropertyRequiredColumns)[number],
  string
>;

export const BallProperties: Record<BallCode, BallProperty> =
  loadBallPropertiesFromCsv(ballPropertiesCsv);

function loadBallPropertiesFromCsv(
  csv: string,
): Record<BallCode, BallProperty> {
  const [header, ...rows] = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (!header) throw new Error("ball_properties.csv is empty");

  const columnIndex = new Map(header.map((column, index) => [column, index]));
  for (const column of BallPropertyRequiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`ball_properties.csv missing required column: ${column}`);
    }
  }

  const properties = rows.map((row, index) =>
    parseBallPropertyRow(readBallPropertyRow(row, columnIndex), index + 2)
  );
  return buildBallPropertyRecord(properties);
}

function parseBallPropertyRow(
  row: BallPropertyCsvRow,
  rowNumber: number,
): BallProperty {
  if (!isBallCode(row.code)) {
    throw new Error(
      `ball_properties.csv row ${rowNumber}: unknown ball code ${row.code}`,
    );
  }
  if (!isBallKind(row.ballKind)) {
    throw new Error(
      `ball_properties.csv row ${rowNumber}: invalid ballKind ${row.ballKind}`,
    );
  }
  if (!isBallVisualType(row.visualType)) {
    throw new Error(
      `ball_properties.csv row ${rowNumber}: invalid visualType ${row.visualType}`,
    );
  }

  const initialWeight = parseInitialWeight(row.initialWeight, rowNumber);

  return {
    code: row.code,
    label: row.label,
    name: row.name,
    description: row.description,
    ballKind: row.ballKind,
    visualType: row.visualType,
    color: parseColor(row.color, rowNumber),
    actionPriority: parseInteger(row.actionPriority, rowNumber, "actionPriority"),
    initialRadius: parseNumber(row.initialRadius, rowNumber, "initialRadius"),
    initialWeight,
    fixed: isFixedInitialWeight(row.initialWeight),
    maxHp: parseInteger(row.maxHp, rowNumber, "maxHp"),
    moneyOnHit: parseInteger(row.moneyOnHit, rowNumber, "moneyOnHit"),
    attack: parseNumber(row.attack, rowNumber, "attack"),
    blockRate: parseNumber(row.blockRate, rowNumber, "blockRate"),
    labelSizeMultiplier: parseOptionalNumber(
      row.labelSizeMultiplier,
      rowNumber,
      "labelSizeMultiplier",
    ),
    specialActions: parseSpecialActions(row.specialActions, rowNumber),
    globalBuffs: parseGlobalBuffs(row.globalBuffs, rowNumber),
  };
}

function readBallPropertyRow(
  row: string[],
  columnIndex: Map<string, number>,
): BallPropertyCsvRow {
  const values = {} as BallPropertyCsvRow;
  for (const column of BallPropertyRequiredColumns) {
    values[column] = row[columnIndex.get(column)!] ?? "";
  }
  return values;
}

function parseColor(value: string, rowNumber: number): number {
  if (!/^0x[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`ball_properties.csv row ${rowNumber}: invalid color ${value}`);
  }
  return Number(value);
}

function parseInteger(
  value: string,
  rowNumber: number,
  column: string,
): number {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error(
      `ball_properties.csv row ${rowNumber}: invalid ${column} ${value}`,
    );
  }
  return number;
}

function parseNumber(
  value: string,
  rowNumber: number,
  column: string,
): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(
      `ball_properties.csv row ${rowNumber}: invalid ${column} ${value}`,
    );
  }
  return number;
}

function parseInitialWeight(value: string, rowNumber: number): number {
  if (isFixedInitialWeight(value)) return 999;
  return parseNumber(value, rowNumber, "initialWeight");
}

function isFixedInitialWeight(value: string): boolean {
  return value.trim() === "-1";
}

function parseOptionalNumber(
  value: string,
  rowNumber: number,
  column: string,
): number | undefined {
  if (value === "") return undefined;
  return parseNumber(value, rowNumber, column);
}

function parseSpecialActions(
  value: string,
  rowNumber: number,
): BallSpecialActionCode[] {
  if (value.trim() === "") return [];

  return value.split("/").map((rawCode) => {
    const code = rawCode.trim();
    if (!isBallSpecialActionCode(code)) {
      throw new Error(
        `ball_properties.csv row ${rowNumber}: unknown special action code ${code}`,
      );
    }
    return code;
  });
}

function parseGlobalBuffs(
  value: string,
  rowNumber: number,
): GlobalBuffCodeType[] {
  if (value.trim() === "") return [];

  return value.split("/").map((rawCode) => {
    const code = rawCode.trim();
    if (!isGlobalBuffCode(code)) {
      throw new Error(
        `ball_properties.csv row ${rowNumber}: unknown global buff code ${code}`,
      );
    }
    return code;
  });
}

function isBallCode(value: string): value is BallCode {
  return BallCodeValues.has(value);
}

function isBallKind(value: string): value is BallKind {
  return BallKindValues.has(value);
}

function isBallVisualType(value: string): value is BallVisualType {
  return BallVisualTypeValues.has(value);
}

function buildBallPropertyRecord(
  properties: BallProperty[],
): Record<BallCode, BallProperty> {
  const byCode = {} as Partial<Record<BallCode, BallProperty>>;

  for (const property of properties) {
    if (byCode[property.code]) {
      throw new Error(
        `ball_properties.csv has duplicate ball code: ${property.code}`,
      );
    }
    byCode[property.code] = property;
  }

  for (const code of Object.values(BallCode)) {
    if (!byCode[code]) {
      throw new Error(`ball_properties.csv missing ball code: ${code}`);
    }
  }

  return byCode as Record<BallCode, BallProperty>;
}

function loadBallSpecialActionsFromCsv(
  csv: string,
): Record<BallSpecialActionCode, BallSpecialAction> {
  const [header, ...rows] = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (!header) throw new Error("ball_special_actions.csv is empty");

  const columnIndex = new Map(header.map((column, index) => [column, index]));
  for (const column of ActionRequiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(
        `ball_special_actions.csv missing required column: ${column}`,
      );
    }
  }

  const actions = rows.map((row, index) =>
    parseBallSpecialActionRow(readActionRow(row, columnIndex), index + 2)
  );
  return buildBallSpecialActionRecord(actions);
}

function parseBallSpecialActionRow(
  row: BallSpecialActionCsvRow,
  rowNumber: number,
): BallSpecialAction {
  if (!isBallSpecialActionCode(row.code)) {
    throw new Error(
      `ball_special_actions.csv row ${rowNumber}: unknown action code ${row.code}`,
    );
  }

  return {
    code: row.code,
    name: row.name,
    description: row.description,
    has_premise: parseBoolean(row.has_premise, rowNumber, "has_premise"),
  };
}

function readActionRow(
  row: string[],
  columnIndex: Map<string, number>,
): BallSpecialActionCsvRow {
  const values = {} as BallSpecialActionCsvRow;
  for (const column of ActionRequiredColumns) {
    values[column] = row[columnIndex.get(column)!] ?? "";
  }
  return values;
}

function parseBoolean(
  value: string,
  rowNumber: number,
  column: string,
): boolean {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "true") return true;
  if (normalizedValue === "false") return false;
  throw new Error(
    `ball_special_actions.csv row ${rowNumber}: invalid ${column} ${value}`,
  );
}

function isBallSpecialActionCode(
  value: string,
): value is BallSpecialActionCode {
  return BallSpecialActionCodeValues.has(value);
}

function isGlobalBuffCode(value: string): value is GlobalBuffCodeType {
  return GlobalBuffCodeValues.has(value);
}

function buildBallSpecialActionRecord(
  actions: BallSpecialAction[],
): Record<BallSpecialActionCode, BallSpecialAction> {
  const byCode = {} as Partial<
    Record<BallSpecialActionCode, BallSpecialAction>
  >;

  for (const action of actions) {
    if (byCode[action.code]) {
      throw new Error(
        `ball_special_actions.csv has duplicate action code: ${action.code}`,
      );
    }
    byCode[action.code] = action;
  }

  for (const code of Object.values(BallSpecialActionCode)) {
    if (!byCode[code]) {
      throw new Error(`ball_special_actions.csv missing action code: ${code}`);
    }
  }

  return byCode as Record<BallSpecialActionCode, BallSpecialAction>;
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
