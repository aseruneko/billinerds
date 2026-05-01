import uiTextsCsv from "./ui_texts.csv?raw";

export const TextCode = {
  statusGiantChalk: "status.giant_chalk",
  statusHeavyCue: "status.heavy_cue",
  statusPhaseCue: "status.phase_cue",
  statusDrawGo: "status.draw_go",
  statusSlow: "status.slow",
  statusTilt: "status.tilt",
  statusGather: "status.gather",
  statusPickBlastPoint: "status.pick_blast_point",
  statusPickRepulsePoint: "status.pick_repulse_point",
  statusPickAttractPoint: "status.pick_attract_point",
  statusPickCuePosition: "status.pick_cue_position",
  statusPickGrowthBall: "status.pick_growth_ball",
  statusPickShrinkBall: "status.pick_shrink_ball",
  statusPickInsideTable: "status.pick_inside_table",
  statusBlocked: "status.blocked",
  statusNoBall: "status.no_ball",
  statusMirrorShift: "status.mirror_shift",
  statusTooManyShotsWaived: "status.too_many_shots_waived",
  statusSealBreak: "status.seal_break",
  statusCueHeal: "status.cue_heal",
  hazardPoisonTitle: "hazard.poison.title",
  hazardPoisonLineDamage: "hazard.poison.line.damage",
  hazardPoisonLineSlow: "hazard.poison.line.slow",
  hazardPoisonDescription: "hazard.poison.description",
  hazardFogTitle: "hazard.fog.title",
  hazardFogLineHeal: "hazard.fog.line.heal",
  hazardFogLineCue: "hazard.fog.line.cue",
  hazardFogDescription: "hazard.fog.description",
  hazardMirrorTitle: "hazard.mirror.title",
  hazardMirrorLineWarp: "hazard.mirror.line.warp",
  hazardMirrorLineTrigger: "hazard.mirror.line.trigger",
  hazardMirrorDescription: "hazard.mirror.description",
  hazardRouletteTitle: "hazard.roulette.title",
  hazardRouletteLineSegment: "hazard.roulette.line.segment",
  hazardMagicCircleTitle: "hazard.magic_circle.title",
  hazardMagicCircleLineSeal1: "hazard.magic_circle.line.seal1",
  hazardMagicCircleLineSeal2: "hazard.magic_circle.line.seal2",
  hazardMagicCircleLineSeal3: "hazard.magic_circle.line.seal3",
  hazardMagicCircleDescription: "hazard.magic_circle.description",
  splashReasonPoison: "splash.reason.poison",
  splashReasonFog: "splash.reason.fog",
  splashReasonBomb: "splash.reason.bomb",
  splashReasonBreak: "splash.reason.break",
  splashReasonShot: "splash.reason.shot",
  splashReasonBlast: "splash.reason.blast",
  splashReasonTooManyShots: "splash.reason.too_many_shots",
} as const;

export type TextCodeType = (typeof TextCode)[keyof typeof TextCode];

type TextParams = Record<string, string | number>;

const TextCodeValues = new Set<string>(Object.values(TextCode));
const TextDictionary = loadTextDictionary(uiTextsCsv);

export function getText(code: TextCodeType, params: TextParams = {}): string {
  const template = TextDictionary[code];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
    params[key] === undefined ? match : `${params[key]}`,
  );
}

export function isTextCode(value: string): value is TextCodeType {
  return TextCodeValues.has(value);
}

function loadTextDictionary(csv: string): Record<TextCodeType, string> {
  const [header, ...rows] = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  if (!header) throw new Error("ui_texts.csv is empty");
  if (header.length !== 2 || header[0] !== "code" || header[1] !== "text") {
    throw new Error("ui_texts.csv must have exactly columns: code,text");
  }

  const byCode = {} as Partial<Record<TextCodeType, string>>;
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const code = row[0]?.trim() ?? "";
    const text = row[1] ?? "";
    if (code.length === 0) {
      throw new Error(`ui_texts.csv row ${rowNumber}: empty code`);
    }
    if (!isTextCode(code)) {
      throw new Error(`ui_texts.csv row ${rowNumber}: unknown text code ${code}`);
    }
    if (byCode[code] !== undefined) {
      throw new Error(`ui_texts.csv row ${rowNumber}: duplicate text code ${code}`);
    }
    byCode[code] = text;
  });

  for (const code of Object.values(TextCode)) {
    if (byCode[code] === undefined) {
      throw new Error(`ui_texts.csv missing text code: ${code}`);
    }
  }

  return byCode as Record<TextCodeType, string>;
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

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
