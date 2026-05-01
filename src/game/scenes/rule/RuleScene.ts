import Phaser from "phaser";
import portraitUrl from "../../../assets/portrait.png";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { createButton } from "../../ui";
import rulesCsv from "./rules.csv?raw";

const MENU_SCENE_KEY = "MenuScene";
const PORTRAIT_KEY = "rule-portrait";
const RULE_VIEWPORT = {
  x: 70,
  y: 166,
  width: 580,
  height: 408,
};
const RULE_GROUP_GAP = 18;
const RULE_SUBGROUP_GAP = 8;
const RULE_ENTRY_GAP = 12;
const RULE_DESCRIPTION_GAP = 7;

type RuleSceneData = {
  currentStageNumber: number;
};

type RuleEntry = {
  group: string;
  subGroup: string;
  description: string;
  revealOnStage: number;
};

type RuleCsvRow = Record<(typeof RuleRequiredColumns)[number], string>;
type GroupedRules = Map<string, Map<string, RuleEntry[]>>;

const RuleRequiredColumns = [
  "group",
  "subGroup",
  "description",
  "revealOnStage",
] as const;

const Rules: RuleEntry[] = loadRulesFromCsv(rulesCsv);

export class RuleScene extends Phaser.Scene {
  private currentStageNumber = 1;
  private ruleObjects: Phaser.GameObjects.GameObject[] = [];
  private ruleMask?: Phaser.Display.Masks.GeometryMask;
  private ruleMaskGraphics?: Phaser.GameObjects.Graphics;
  private ruleScrollbar?: Phaser.GameObjects.Graphics;
  private ruleWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    objects: unknown,
    dx: number,
    dy: number,
  ) => void;
  private ruleScrollY = 0;
  private ruleContentHeight = 0;

  constructor() {
    super("RuleScene");
  }

  preload() {
    this.load.image(PORTRAIT_KEY, portraitUrl);
  }

  init(data: RuleSceneData) {
    this.currentStageNumber = data.currentStageNumber;
  }

  create() {
    this.scene.bringToTop();
    this.scene.pause(MENU_SCENE_KEY);
    this.drawOverlay();
    this.createRuleScrollArea();
    this.drawRules();
    this.drawPortrait();

    createButton(this, {
      x: 356,
      y: GAME_HEIGHT - 134,
      width: 180,
      height: 56,
      label: "もどる",
      fontSize: 22,
      variant: "normal",
      onClick: () => this.backToMenu(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ruleWheelHandler) {
        this.input.off("wheel", this.ruleWheelHandler);
      }
    });
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 0.9);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.96);
    g.fillRoundedRect(42, 56, 646, GAME_HEIGHT - 132, 18);
    g.lineStyle(4, 0xffef9c, 0.78);
    g.strokeRoundedRect(42, 56, 646, GAME_HEIGHT - 132, 18);
    g.fillStyle(0xffc545, 0.1);
    g.fillRoundedRect(64, 78, 602, 70, 14);
  }

  private drawRules() {
    this.add
      .text(82, 112, "ルール", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "44px",
        fontStyle: "900",
      })
      .setOrigin(0, 0.5);

    const groupedRules = this.getVisibleGroupedRules();

    for (const object of this.ruleObjects) object.destroy();
    this.ruleObjects = [];

    let y = RULE_VIEWPORT.y - this.ruleScrollY;
    for (const [group, subGroups] of groupedRules) {
      const groupTitle = this.add.text(82, y, group, {
        color: "#ffef9c",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 4,
      });
      this.addRuleObject(groupTitle);
      y += groupTitle.displayHeight + RULE_SUBGROUP_GAP;

      for (const [subGroup, rules] of subGroups) {
        const subGroupTitle = this.add.text(96, y, subGroup, {
          color: "#fff1ba",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "15px",
          fontStyle: "900",
          stroke: "#050507",
          strokeThickness: 3,
        });
        this.addRuleObject(subGroupTitle);
        y += subGroupTitle.displayHeight + RULE_DESCRIPTION_GAP;

        for (const rule of rules) {
          const description = this.add.text(110, y, rule.description, {
            color: "#f7f1d7",
            fontFamily: GAME_FONT_FAMILY,
            fontSize: "15px",
            fontStyle: "800",
            lineSpacing: 3,
            wordWrap: { width: 510, useAdvancedWrap: true },
          });
          this.addRuleObject(description);
          y += description.displayHeight + RULE_ENTRY_GAP;
        }

        y += RULE_SUBGROUP_GAP;
      }

      y += RULE_GROUP_GAP;
    }

    this.ruleContentHeight = Math.max(
      0,
      y + this.ruleScrollY - RULE_VIEWPORT.y,
    );
    this.ruleScrollY = Phaser.Math.Clamp(
      this.ruleScrollY,
      0,
      this.getMaxRuleScroll(),
    );
    this.drawRuleScrollbar();
  }

  private getVisibleGroupedRules(): GroupedRules {
    const groupedRules: GroupedRules = new Map();
    const visibleRules = Rules.filter(
      (rule) => this.currentStageNumber >= rule.revealOnStage,
    );

    for (const rule of visibleRules) {
      const subGroups = groupedRules.get(rule.group) ?? new Map();
      const rules = subGroups.get(rule.subGroup) ?? [];
      rules.push(rule);
      subGroups.set(rule.subGroup, rules);
      groupedRules.set(rule.group, subGroups);
    }

    return groupedRules;
  }

  private createRuleScrollArea() {
    this.ruleMaskGraphics = this.add.graphics();
    this.ruleMaskGraphics.fillStyle(0xffffff, 1);
    this.ruleMaskGraphics.fillRect(
      RULE_VIEWPORT.x,
      RULE_VIEWPORT.y,
      RULE_VIEWPORT.width,
      RULE_VIEWPORT.height,
    );
    this.ruleMaskGraphics.setVisible(false);
    this.ruleMask = this.ruleMaskGraphics.createGeometryMask();

    this.ruleWheelHandler = (
      pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (!this.isPointerInRuleArea(pointer)) return;
      this.setRuleScroll(this.ruleScrollY + dy * 0.6);
    };
    this.input.on("wheel", this.ruleWheelHandler);

    this.ruleScrollbar = this.add.graphics();
    this.ruleScrollbar.setDepth(50);
  }

  private addRuleObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    const maskable = object as T & {
      setMask?: (mask: Phaser.Display.Masks.GeometryMask) => T;
    };
    if (this.ruleMask && maskable.setMask) {
      maskable.setMask(this.ruleMask);
    }
    this.ruleObjects.push(object);
    return object;
  }

  private setRuleScroll(scrollY: number) {
    const nextScrollY = Phaser.Math.Clamp(scrollY, 0, this.getMaxRuleScroll());
    if (nextScrollY === this.ruleScrollY) return;

    this.ruleScrollY = nextScrollY;
    this.drawRules();
  }

  private getMaxRuleScroll(): number {
    return Math.max(0, this.ruleContentHeight - RULE_VIEWPORT.height);
  }

  private isPointerInRuleArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= RULE_VIEWPORT.x &&
      pointer.x <= RULE_VIEWPORT.x + RULE_VIEWPORT.width &&
      pointer.y >= RULE_VIEWPORT.y &&
      pointer.y <= RULE_VIEWPORT.y + RULE_VIEWPORT.height
    );
  }

  private drawRuleScrollbar() {
    if (!this.ruleScrollbar) return;

    this.ruleScrollbar.clear();
    const maxScroll = this.getMaxRuleScroll();
    if (maxScroll <= 0) return;

    const trackX = RULE_VIEWPORT.x + RULE_VIEWPORT.width - 12;
    const trackY = RULE_VIEWPORT.y + 12;
    const trackHeight = RULE_VIEWPORT.height - 24;
    const thumbHeight = Math.max(
      42,
      (RULE_VIEWPORT.height / this.ruleContentHeight) * trackHeight,
    );
    const thumbY =
      trackY + (this.ruleScrollY / maxScroll) * (trackHeight - thumbHeight);

    this.ruleScrollbar.fillStyle(0x030604, 0.42);
    this.ruleScrollbar.fillRoundedRect(trackX, trackY, 7, trackHeight, 4);
    this.ruleScrollbar.fillStyle(0xffef9c, 0.78);
    this.ruleScrollbar.fillRoundedRect(trackX - 1, thumbY, 9, thumbHeight, 5);
  }

  private drawPortrait() {
    const portrait = this.add.image(
      GAME_WIDTH - 160,
      GAME_HEIGHT - 40,
      PORTRAIT_KEY,
    );
    portrait.setOrigin(0.5, 1);
    const scale = Math.min(1.05, (GAME_HEIGHT * 0.78) / portrait.height);
    portrait.setScale(scale);
  }

  private backToMenu() {
    this.scene.resume(MENU_SCENE_KEY);
    this.scene.stop();
  }
}

function loadRulesFromCsv(csv: string): RuleEntry[] {
  const [header, ...rows] = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  if (!header) throw new Error("rules.csv is empty");

  const columnIndex = new Map(header.map((column, index) => [column, index]));
  for (const column of RuleRequiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`rules.csv missing required column: ${column}`);
    }
  }

  return rows.map((row, index) =>
    parseRuleRow(readRuleRow(row, columnIndex), index + 2),
  );
}

function parseRuleRow(row: RuleCsvRow, rowNumber: number): RuleEntry {
  const revealOnStage = Number(row.revealOnStage);
  if (!Number.isInteger(revealOnStage) || revealOnStage < 1) {
    throw new Error(
      `rules.csv row ${rowNumber}: invalid revealOnStage ${row.revealOnStage}`,
    );
  }

  if (row.group.trim().length === 0) {
    throw new Error(`rules.csv row ${rowNumber}: empty group`);
  }
  if (row.subGroup.trim().length === 0) {
    throw new Error(`rules.csv row ${rowNumber}: empty subGroup`);
  }
  if (row.description.trim().length === 0) {
    throw new Error(`rules.csv row ${rowNumber}: empty description`);
  }

  return {
    group: row.group,
    subGroup: row.subGroup,
    description: row.description,
    revealOnStage,
  };
}

function readRuleRow(
  row: string[],
  columnIndex: Map<string, number>,
): RuleCsvRow {
  const values = {} as RuleCsvRow;
  for (const column of RuleRequiredColumns) {
    values[column] = row[columnIndex.get(column)!] ?? "";
  }
  return values;
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
