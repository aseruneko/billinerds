import Phaser from "phaser";
import {
  GAME_FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_LABEL_FONT_FAMILY,
  TABLE,
} from "../../../config";
import type { Ball } from "../Ball";
import { BallProperties, BallSpecialActions } from "../BallProperty";
import { GlobalBuffRoster } from "../GlobalBuff";
import type { HazardTooltipInfo } from "../hazards/HazardSystem";
import type { OwnedItemEntry } from "../items/ItemInventory";
import { ItemRarityColor, type Item, type ItemCode } from "../shop/item/Item";

export type HudState = {
  stageNumber: number;
  shots: number;
  per: number;
  cueHp: number;
  cueMaxHp: number;
  money: number;
};

type BilliardsHudCallbacks = {
  onUseItem: (item: Item) => void;
  canUseItem: (item: Item) => boolean;
  getItemUsesRemaining: (itemCode: ItemCode) => number;
  getItemMaxUses: (item: Item, count: number) => number;
  getBallAttack: (ball: Ball) => number;
  getBallBlockRate: (ball: Ball) => number;
};

const OWNED_ITEM_VIEWPORT = { x: 356, y: 642, width: 610, height: 104 };
const HAZARD_TOOLTIP_BOTTOM_LIMIT = 588;
const OWNED_ITEM_ICON_SIZE = 40;
const OWNED_ITEM_ICON_GAP = 10;
const OWNED_ITEM_COLUMNS = 12;
const OWNED_ITEM_START_X = 366;
const OWNED_ITEM_START_Y = 646;

export class BilliardsHud {
  readonly powerBar: Phaser.GameObjects.Graphics;

  private stageText?: Phaser.GameObjects.Text;
  private cueHpText?: Phaser.GameObjects.Text;
  private moneyText?: Phaser.GameObjects.Text;
  private ballTooltipContainer?: Phaser.GameObjects.Container;
  private ballTooltipBackground?: Phaser.GameObjects.Graphics;
  private ballTooltipNameText?: Phaser.GameObjects.Text;
  private ballTooltipStatsContainer?: Phaser.GameObjects.Container;
  private ballTooltipStatsText?: Phaser.GameObjects.Text;
  private ballTooltipDescriptionContainer?: Phaser.GameObjects.Container;
  private ballTooltipDescriptionText?: Phaser.GameObjects.Text;
  private ballTooltipActionContainer?: Phaser.GameObjects.Container;
  private ballTooltipActionDivider?: Phaser.GameObjects.Graphics;
  private ballTooltipBuffContainer?: Phaser.GameObjects.Container;
  private ballTooltipBuffDivider?: Phaser.GameObjects.Graphics;
  private hazardTooltipContainer?: Phaser.GameObjects.Container;
  private hazardTooltipBackground?: Phaser.GameObjects.Graphics;
  private hazardTooltipTitleText?: Phaser.GameObjects.Text;
  private hazardTooltipLinesText?: Phaser.GameObjects.Text;
  private hazardTooltipDescriptionText?: Phaser.GameObjects.Text;
  private itemTooltipContainer?: Phaser.GameObjects.Container;
  private itemTooltipBackground?: Phaser.GameObjects.Graphics;
  private itemTooltipText?: Phaser.GameObjects.Text;
  private itemTooltipNameRow?: Phaser.GameObjects.Container;
  private itemTooltipNameText?: Phaser.GameObjects.Text;
  private itemTooltipCountText?: Phaser.GameObjects.Text;
  private itemTooltipMetaContainer?: Phaser.GameObjects.Container;
  private itemTooltipDescriptionText?: Phaser.GameObjects.Text;
  private ownedItemEntries: OwnedItemEntry[] = [];
  private ownedItemObjects: Phaser.GameObjects.GameObject[] = [];
  private ownedItemRenderKey = "";
  private ownedItemScrollY = 0;
  private ownedItemContentHeight = 0;
  private ownedItemMask?: Phaser.Display.Masks.GeometryMask;
  private ownedItemMaskGraphics?: Phaser.GameObjects.Graphics;
  private ownedItemScrollbar?: Phaser.GameObjects.Graphics;
  private ownedItemWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    objects: unknown,
    dx: number,
    dy: number,
  ) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: BilliardsHudCallbacks,
  ) {
    this.powerBar = scene.add.graphics();
    this.powerBar.setDepth(42);
  }

  create() {
    const g = this.scene.add.graphics();
    g.fillStyle(0x050507, 0.72);
    g.fillRoundedRect(48, 596, 278, 160, 12);
    g.fillRoundedRect(346, 596, 630, 160, 12);
    g.lineStyle(2, 0xffef9c, 0.28);
    g.strokeRoundedRect(48, 596, 278, 160, 12);
    g.strokeRoundedRect(346, 596, 630, 160, 12);
    g.fillStyle(0xffc545, 0.06);
    g.fillRoundedRect(58, 606, 258, 28, 8);
    g.fillRoundedRect(356, 606, 610, 28, 8);

    this.scene.add.text(64, 610, "ステータス", {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "900",
    });
    this.scene.add.text(366, 610, "アイテム", {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "900",
    });

    this.stageText = this.scene.add.text(64, 652, "Stage 1", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "20px",
      fontStyle: "800",
    });
    this.cueHpText = this.scene.add.text(64, 682, "HP 300 / 300", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "20px",
      fontStyle: "800",
    });
    this.moneyText = this.scene.add.text(64, 712, "$ 0", {
      color: "#ffec8a",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "20px",
      fontStyle: "900",
    });

    this.createBallTooltip();
    this.createHazardTooltip();
    this.createItemTooltip();
    this.createOwnedItemScrollArea();
  }

  drawPowerRing(cueBall: Ball | null, ratio: number, visible: boolean) {
    this.powerBar.clear();
    if (!visible || !cueBall || cueBall.pocketed) return;

    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    const x = cueBall.sprite.x;
    const y = cueBall.sprite.y;
    const radius = cueBall.radius + 11;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * clampedRatio;

    this.powerBar.lineStyle(5, 0x050507, 0.68);
    this.powerBar.strokeCircle(x, y, radius);
    this.powerBar.lineStyle(3, 0xfff0a0, 0.28);
    this.powerBar.strokeCircle(x, y, radius);

    if (clampedRatio <= 0) return;

    this.powerBar.lineStyle(6, 0xffcf45, 0.96);
    this.powerBar.beginPath();
    this.powerBar.arc(x, y, radius, startAngle, endAngle, false);
    this.powerBar.strokePath();

    this.powerBar.lineStyle(2, 0xffffff, 0.6);
    this.powerBar.beginPath();
    this.powerBar.arc(x, y, radius + 4, startAngle, endAngle, false);
    this.powerBar.strokePath();
  }

  updateHud(state: HudState) {
    this.stageText?.setText(
      `STAGE ${state.stageNumber} - SHOT ${state.shots}/${state.per}`,
    );
    this.moneyText?.setText(`$ ${state.money}`);
    this.cueHpText?.setText(`HP ${state.cueHp} / ${state.cueMaxHp}`);
  }

  renderOwnedItems(entries: OwnedItemEntry[]) {
    this.ownedItemRenderKey = this.getOwnedItemRenderKey(entries);
    this.ownedItemEntries = [...entries];
    this.ownedItemScrollY = Phaser.Math.Clamp(
      this.ownedItemScrollY,
      0,
      this.getMaxOwnedItemScroll(),
    );

    this.renderOwnedItemObjects();
  }

  private renderOwnedItemObjects() {
    for (const object of this.ownedItemObjects) object.destroy();
    this.ownedItemObjects = [];
    this.hideItemTooltip();
    this.updateOwnedItemMetrics();
    this.drawOwnedItemScrollbar();

    if (this.ownedItemEntries.length === 0) {
      const empty = this.scene.add
        .text(366, 652, "No items", {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
          fontStyle: "800",
        })
        .setAlpha(0.42);
      this.addOwnedItemObject(empty);
      return;
    }

    for (const [index, entry] of this.ownedItemEntries.entries()) {
      this.createOwnedItemIcon(entry.item, entry.count, index);
    }
  }

  refreshOwnedItems(entries: OwnedItemEntry[]) {
    const nextKey = this.getOwnedItemRenderKey(entries);
    if (nextKey === this.ownedItemRenderKey) return;

    this.renderOwnedItems(entries);
  }

  showBallTooltip(ball: Ball, pointerX: number, pointerY: number) {
    if (
      !this.ballTooltipContainer ||
      !this.ballTooltipBackground ||
      !this.ballTooltipNameText ||
      !this.ballTooltipStatsContainer ||
      !this.ballTooltipStatsText ||
      !this.ballTooltipDescriptionContainer ||
      !this.ballTooltipDescriptionText ||
      !this.ballTooltipActionContainer ||
      !this.ballTooltipActionDivider ||
      !this.ballTooltipBuffContainer ||
      !this.ballTooltipBuffDivider
    ) {
      return;
    }

    const property = ball.property;
    this.ballTooltipNameText.setText(property.name);
    this.ballTooltipStatsText.setText([
      `HP ${ball.hp} / ${ball.maxHp} | ${ball.weight.toFixed(2)} lb | $ ${property.moneyOnHit}`,
      `攻撃 ${this.formatTooltipNumber(this.callbacks.getBallAttack(ball))} | 防御率 ${this.formatTooltipNumber(this.callbacks.getBallBlockRate(ball))}`,
    ]);
    this.ballTooltipDescriptionText.setText(property.description);
    this.renderBallActionTooltipLines(ball, this.ballTooltipActionContainer);
    this.renderBallBuffTooltipLines(ball, this.ballTooltipBuffContainer);

    const hasActions = property.specialActions.length > 0;
    const hasBuffs =
      ball.currentGlobalBuffs.length > 0 ||
      ball.temporaryStatusLabels.length > 0;
    const gap = 9;
    let cursorY = 10 + this.ballTooltipNameText.displayHeight + gap;
    this.ballTooltipStatsContainer.setPosition(12, cursorY);
    cursorY += this.ballTooltipStatsText.displayHeight + gap;
    this.ballTooltipDescriptionContainer.setPosition(12, cursorY);
    cursorY += this.ballTooltipDescriptionText.displayHeight + gap;
    this.ballTooltipActionDivider.setVisible(hasActions);
    this.ballTooltipActionContainer.setPosition(
      12,
      hasActions ? cursorY + 9 : cursorY,
    );
    const actionWidth = this.getContainerWidth(this.ballTooltipActionContainer);
    const actionHeight = this.getContainerHeight(this.ballTooltipActionContainer);
    if (hasActions) cursorY += actionHeight + gap + 9;
    this.ballTooltipBuffDivider.setVisible(hasBuffs);
    this.ballTooltipBuffContainer.setPosition(
      12,
      hasBuffs ? cursorY + 9 : cursorY,
    );

    const buffWidth = this.getContainerWidth(this.ballTooltipBuffContainer);
    const buffHeight = this.getContainerHeight(this.ballTooltipBuffContainer);
    const width =
      Math.max(
        this.ballTooltipNameText.displayWidth,
        this.ballTooltipStatsText.displayWidth,
        this.ballTooltipDescriptionText.displayWidth,
        actionWidth,
        buffWidth,
      ) + 24;
    const height = (hasBuffs ? cursorY + 9 : cursorY) + buffHeight + 10;
    let x = pointerX + 18;
    let y = pointerY - height - 16;
    x = Phaser.Math.Clamp(x, 12, GAME_WIDTH - width - 12);
    y = Phaser.Math.Clamp(y, 12, GAME_HEIGHT - height - 12);

    this.ballTooltipBackground.clear();
    this.ballTooltipBackground.fillStyle(0x120909, 0.9);
    this.ballTooltipBackground.fillRoundedRect(0, 0, width, height, 8);
    this.ballTooltipBackground.lineStyle(2, 0xffef9c, 0.78);
    this.ballTooltipBackground.strokeRoundedRect(0, 0, width, height, 8);
    this.ballTooltipBackground.fillStyle(0xffc545, 0.18);
    this.ballTooltipBackground.fillRoundedRect(4, 4, width - 8, 10, 5);
    if (hasActions) {
      this.ballTooltipActionDivider.clear();
      this.ballTooltipActionDivider.lineStyle(1, 0xffef9c, 0.42);
      this.ballTooltipActionDivider.lineBetween(0, 0, width - 24, 0);
      this.ballTooltipActionDivider.setPosition(12, cursorY - actionHeight - gap - 10);
    } else {
      this.ballTooltipActionDivider.clear();
    }
    if (hasBuffs) {
      this.ballTooltipBuffDivider.clear();
      this.ballTooltipBuffDivider.lineStyle(1, 0xffef9c, 0.42);
      this.ballTooltipBuffDivider.lineBetween(0, 0, width - 24, 0);
      this.ballTooltipBuffDivider.setPosition(12, cursorY - 1);
    } else {
      this.ballTooltipBuffDivider.clear();
    }

    this.ballTooltipContainer.setPosition(x, y);
    this.ballTooltipContainer.setVisible(true);
  }

  hideBallTooltip() {
    this.ballTooltipContainer?.setVisible(false);
  }

  showHazardTooltip(info: HazardTooltipInfo) {
    if (
      !this.hazardTooltipContainer ||
      !this.hazardTooltipBackground ||
      !this.hazardTooltipTitleText ||
      !this.hazardTooltipLinesText ||
      !this.hazardTooltipDescriptionText
    ) {
      return;
    }

    this.hazardTooltipTitleText.setText(info.title);
    this.hazardTooltipLinesText.setText(info.lines);
    this.hazardTooltipDescriptionText.setText(info.description);

    const gap = 9;
    let cursorY = 10 + this.hazardTooltipTitleText.displayHeight + gap;
    this.hazardTooltipLinesText.setPosition(12, cursorY);
    cursorY += this.hazardTooltipLinesText.displayHeight + gap;
    this.hazardTooltipDescriptionText.setPosition(12, cursorY);

    const width = 344;
    const height = cursorY + this.hazardTooltipDescriptionText.displayHeight + 12;
    let x = GAME_WIDTH - width - 24;
    let y = HAZARD_TOOLTIP_BOTTOM_LIMIT - height;
    x = Phaser.Math.Clamp(x, 12, GAME_WIDTH - width - 12);
    y = Phaser.Math.Clamp(y, 12, GAME_HEIGHT - height - 12);

    this.hazardTooltipBackground.clear();
    this.hazardTooltipBackground.fillStyle(0x080b0c, 0.92);
    this.hazardTooltipBackground.fillRoundedRect(0, 0, width, height, 8);
    this.hazardTooltipBackground.lineStyle(2, info.accentColor, 0.78);
    this.hazardTooltipBackground.strokeRoundedRect(0, 0, width, height, 8);
    this.hazardTooltipBackground.fillStyle(info.accentColor, 0.14);
    this.hazardTooltipBackground.fillRoundedRect(4, 4, width - 8, 10, 5);

    this.hazardTooltipContainer.setPosition(x, y);
    this.hazardTooltipContainer.setVisible(true);
  }

  hideHazardTooltip() {
    this.hazardTooltipContainer?.setVisible(false);
  }

  private createBallTooltip() {
    this.ballTooltipBackground = this.scene.add.graphics();
    this.ballTooltipNameText = this.scene.add.text(12, 10, "", {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "17px",
      fontStyle: "900",
    });
    this.ballTooltipStatsText = this.scene.add.text(0, 0, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "700",
      lineSpacing: 4,
    });
    this.ballTooltipDescriptionText = this.scene.add.text(0, 0, "", {
      color: "#b9b3a3",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "700",
      lineSpacing: 3,
      wordWrap: { width: 360 },
    });
    this.ballTooltipStatsContainer = this.scene.add.container(12, 34, [
      this.ballTooltipStatsText,
    ]);
    this.ballTooltipDescriptionContainer = this.scene.add.container(12, 58, [
      this.ballTooltipDescriptionText,
    ]);
    this.ballTooltipActionDivider = this.scene.add.graphics();
    this.ballTooltipActionContainer = this.scene.add.container(12, 82);
    this.ballTooltipBuffDivider = this.scene.add.graphics();
    this.ballTooltipBuffContainer = this.scene.add.container(12, 82);
    this.ballTooltipContainer = this.scene.add.container(0, 0, [
      this.ballTooltipBackground,
      this.ballTooltipNameText,
      this.ballTooltipStatsContainer,
      this.ballTooltipDescriptionContainer,
      this.ballTooltipActionDivider,
      this.ballTooltipActionContainer,
      this.ballTooltipBuffDivider,
      this.ballTooltipBuffContainer,
    ]);
    this.ballTooltipContainer.setDepth(100);
    this.ballTooltipContainer.setVisible(false);
  }

  private createHazardTooltip() {
    this.hazardTooltipBackground = this.scene.add.graphics();
    this.hazardTooltipTitleText = this.scene.add.text(12, 10, "", {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "17px",
      fontStyle: "900",
    });
    this.hazardTooltipLinesText = this.scene.add.text(12, 34, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "800",
      lineSpacing: 4,
    });
    this.hazardTooltipDescriptionText = this.scene.add.text(12, 58, "", {
      color: "#b9b3a3",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "700",
      lineSpacing: 3,
      wordWrap: { width: 320, useAdvancedWrap: true },
    });
    this.hazardTooltipContainer = this.scene.add.container(0, 0, [
      this.hazardTooltipBackground,
      this.hazardTooltipTitleText,
      this.hazardTooltipLinesText,
      this.hazardTooltipDescriptionText,
    ]);
    this.hazardTooltipContainer.setDepth(100);
    this.hazardTooltipContainer.setVisible(false);
  }

  private renderBallBuffTooltipLines(
    ball: Ball,
    container: Phaser.GameObjects.Container,
  ) {
    container.removeAll(true);
    let y = 0;
    for (const label of ball.temporaryStatusLabels) {
      const nameText = this.scene.add.text(0, y, label, {
        color: "#d9ecff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "800",
      });
      const descriptionText = this.scene.add.text(
        0,
        y + nameText.displayHeight + 2,
        "一時的な状態変化です。",
        {
          color: "#b9b3a3",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "700",
        },
      );
      container.add([nameText, descriptionText]);
      y += nameText.displayHeight + descriptionText.displayHeight + 8;
    }

    for (const buff of ball.currentGlobalBuffs) {
      const definition = GlobalBuffRoster[buff.code];
      const sourceName = BallProperties[buff.from].name;
      const nameText = this.scene.add.text(
        0,
        y,
        `${definition.name} ${buff.amount} ( from ${sourceName} )`,
        {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "14px",
          fontStyle: "800",
        },
      );
      const descriptionText = this.scene.add.text(
        0,
        y + nameText.displayHeight + 2,
        definition.description,
        {
          color: "#b9b3a3",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "700",
        },
      );
      container.add([nameText, descriptionText]);
      y += nameText.displayHeight + descriptionText.displayHeight + 8;
    }
  }

  private renderBallActionTooltipLines(
    ball: Ball,
    container: Phaser.GameObjects.Container,
  ) {
    container.removeAll(true);
    let y = 0;
    for (const actionCode of ball.property.specialActions) {
      const action = BallSpecialActions[actionCode];
      const nameText = this.scene.add.text(0, y, action.name, {
        color: "#ffe2a6",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "14px",
        fontStyle: "800",
      });
      const descriptionText = this.scene.add.text(
        0,
        y + nameText.displayHeight + 2,
        action.description,
        {
          color: "#b9b3a3",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "700",
          wordWrap: { width: 360 },
        },
      );
      container.add([nameText, descriptionText]);
      y += nameText.displayHeight + descriptionText.displayHeight + 8;
    }
  }

  private getContainerWidth(container: Phaser.GameObjects.Container): number {
    return container.list.reduce((width, child) => {
      const gameObject = child as Phaser.GameObjects.GameObject & {
        displayWidth?: number;
        x?: number;
      };
      return Math.max(
        width,
        (gameObject.x ?? 0) + (gameObject.displayWidth ?? 0),
      );
    }, 0);
  }

  private formatTooltipNumber(value: number): string {
    return value.toFixed(2);
  }

  private getContainerHeight(container: Phaser.GameObjects.Container): number {
    return container.list.reduce((height, child) => {
      const gameObject = child as Phaser.GameObjects.GameObject & {
        displayHeight?: number;
        y?: number;
      };
      return Math.max(
        height,
        (gameObject.y ?? 0) + (gameObject.displayHeight ?? 0),
      );
    }, 0);
  }

  private createItemTooltip() {
    this.itemTooltipBackground = this.scene.add.graphics();
    this.itemTooltipText = this.scene.add.text(12, 10, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "800",
      lineSpacing: 5,
      stroke: "#050507",
      strokeThickness: 3,
      wordWrap: { width: 284 },
    });
    this.itemTooltipNameText = this.scene.add.text(0, 0, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "16px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 3,
    });
    this.itemTooltipCountText = this.scene.add.text(0, 2, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "800",
      stroke: "#050507",
      strokeThickness: 3,
    });
    this.itemTooltipNameRow = this.scene.add.container(12, 10, [
      this.itemTooltipNameText,
      this.itemTooltipCountText,
    ]);
    this.itemTooltipMetaContainer = this.scene.add.container(12, 38);
    this.itemTooltipDescriptionText = this.scene.add.text(12, 62, "", {
      color: "#b9b3a3",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "700",
      wordWrap: { width: 284, useAdvancedWrap: true },
    });
    this.itemTooltipContainer = this.scene.add.container(0, 0, [
      this.itemTooltipBackground,
      this.itemTooltipText,
      this.itemTooltipNameRow,
      this.itemTooltipMetaContainer,
      this.itemTooltipDescriptionText,
    ]);
    this.itemTooltipContainer.setDepth(140);
    this.itemTooltipContainer.setVisible(false);
  }

  private createOwnedItemScrollArea() {
    this.ownedItemMaskGraphics = this.scene.add.graphics();
    this.ownedItemMaskGraphics.fillStyle(0xffffff, 1);
    this.ownedItemMaskGraphics.fillRect(
      OWNED_ITEM_VIEWPORT.x,
      OWNED_ITEM_VIEWPORT.y,
      OWNED_ITEM_VIEWPORT.width,
      OWNED_ITEM_VIEWPORT.height,
    );
    this.ownedItemMaskGraphics.setVisible(false);
    this.ownedItemMask = this.ownedItemMaskGraphics.createGeometryMask();

    this.ownedItemWheelHandler = (
      pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (!this.isPointerInOwnedItemArea(pointer)) return;
      this.setOwnedItemScroll(this.ownedItemScrollY + dy * 0.6);
    };
    this.scene.input.on("wheel", this.ownedItemWheelHandler);

    this.ownedItemScrollbar = this.scene.add.graphics();
    this.ownedItemScrollbar.setDepth(49);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ownedItemWheelHandler) {
        this.scene.input.off("wheel", this.ownedItemWheelHandler);
      }
    });
  }

  private createOwnedItemIcon(item: Item, count: number, index: number) {
    const size = OWNED_ITEM_ICON_SIZE;
    const x =
      OWNED_ITEM_START_X +
      (index % OWNED_ITEM_COLUMNS) * (size + OWNED_ITEM_ICON_GAP);
    const y =
      OWNED_ITEM_START_Y +
      Math.floor(index / OWNED_ITEM_COLUMNS) *
        (size + OWNED_ITEM_ICON_GAP) -
      this.ownedItemScrollY;
    const isInsideViewport =
      y + size >= OWNED_ITEM_VIEWPORT.y &&
      y <= OWNED_ITEM_VIEWPORT.y + OWNED_ITEM_VIEWPORT.height;
    const hasUses = item.useCount !== undefined;
    const isUsableActiveItem = hasUses && this.callbacks.canUseItem(item);
    const isDisabledActiveItem = hasUses && !isUsableActiveItem;
    const fillColor = isUsableActiveItem
      ? 0x223725
      : isDisabledActiveItem
      ? 0x111413
      : 0x162018;
    const fillAlpha = isDisabledActiveItem ? 0.76 : 0.96;
    const strokeColor = isUsableActiveItem
      ? 0x9cf1b6
      : isDisabledActiveItem
      ? 0x5d5a54
      : 0xffef9c;
    const strokeAlpha = isUsableActiveItem
      ? 0.86
      : isDisabledActiveItem
      ? 0.44
      : 0.52;

    const card = this.scene.add.graphics();
    card.fillStyle(fillColor, fillAlpha);
    card.fillRoundedRect(x, y, size, size, 8);
    if (isUsableActiveItem) {
      card.fillStyle(0xd9ffd1, 0.11);
      card.fillRoundedRect(x + 5, y + 5, size - 10, size - 10, 6);
    }
    card.lineStyle(2, strokeColor, strokeAlpha);
    card.strokeRoundedRect(x, y, size, size, 8);

    const label = this.scene.add
      .text(x + size / 2, y + size / 2, item.label, {
        fontFamily: ITEM_LABEL_FONT_FAMILY,
        fontSize: "24px",
      })
      .setOrigin(0.5);
    if (isUsableActiveItem) {
      label.setTint(0xf0ffe9);
    } else if (isDisabledActiveItem) {
      label.setAlpha(0.42);
      label.setTint(0xa9a9a0);
    }
    const zone = this.scene.add
      .zone(x + size / 2, y + size / 2, size, size)
      .setInteractive({
        useHandCursor: isInsideViewport && isUsableActiveItem,
      });
    zone.setVisible(isInsideViewport);
    if (!isInsideViewport) zone.disableInteractive();

    zone.on("pointerover", () =>
      this.showItemTooltip(item, count, x + size / 2, y - 8),
    );
    zone.on("pointerout", () => this.hideItemTooltip());
    zone.on("pointerdown", () => {
      if (!this.callbacks.canUseItem(item)) return;
      this.callbacks.onUseItem(item);
    });

    this.addOwnedItemObject(card);
    this.addOwnedItemObject(label);
    this.addOwnedItemObject(zone);
  }

  private addOwnedItemObject<T extends Phaser.GameObjects.GameObject>(
    object: T,
  ): T {
    const maskable = object as T & {
      setMask?: (mask: Phaser.Display.Masks.GeometryMask) => T;
    };
    if (this.ownedItemMask && maskable.setMask) {
      maskable.setMask(this.ownedItemMask);
    }
    this.ownedItemObjects.push(object);
    return object;
  }

  private updateOwnedItemMetrics() {
    const rowCount = Math.ceil(
      this.ownedItemEntries.length / OWNED_ITEM_COLUMNS,
    );
    this.ownedItemContentHeight =
      rowCount === 0
        ? 0
        : OWNED_ITEM_START_Y -
          OWNED_ITEM_VIEWPORT.y +
          (rowCount - 1) * (OWNED_ITEM_ICON_SIZE + OWNED_ITEM_ICON_GAP) +
          OWNED_ITEM_ICON_SIZE +
          4;
    this.ownedItemScrollY = Phaser.Math.Clamp(
      this.ownedItemScrollY,
      0,
      this.getMaxOwnedItemScroll(),
    );
  }

  private setOwnedItemScroll(scrollY: number) {
    const nextScrollY = Phaser.Math.Clamp(
      scrollY,
      0,
      this.getMaxOwnedItemScroll(),
    );
    if (nextScrollY === this.ownedItemScrollY) return;

    this.ownedItemScrollY = nextScrollY;
    this.renderOwnedItemObjects();
  }

  private getMaxOwnedItemScroll(): number {
    return Math.max(
      0,
      this.ownedItemContentHeight - OWNED_ITEM_VIEWPORT.height,
    );
  }

  private drawOwnedItemScrollbar() {
    this.ownedItemScrollbar?.clear();
    const maxScroll = this.getMaxOwnedItemScroll();
    if (!this.ownedItemScrollbar || maxScroll <= 0) return;

    const trackX = OWNED_ITEM_VIEWPORT.x + OWNED_ITEM_VIEWPORT.width - 8;
    const trackY = OWNED_ITEM_VIEWPORT.y + 4;
    const trackHeight = OWNED_ITEM_VIEWPORT.height - 8;
    const thumbHeight = Math.max(
      20,
      (OWNED_ITEM_VIEWPORT.height / this.ownedItemContentHeight) * trackHeight,
    );
    const thumbY =
      trackY +
      (this.ownedItemScrollY / maxScroll) * (trackHeight - thumbHeight);

    this.ownedItemScrollbar.fillStyle(0x050507, 0.5);
    this.ownedItemScrollbar.fillRoundedRect(trackX, trackY, 5, trackHeight, 3);
    this.ownedItemScrollbar.fillStyle(0xffef9c, 0.78);
    this.ownedItemScrollbar.fillRoundedRect(trackX, thumbY, 5, thumbHeight, 3);
  }

  private isPointerInOwnedItemArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= OWNED_ITEM_VIEWPORT.x &&
      pointer.x <= OWNED_ITEM_VIEWPORT.x + OWNED_ITEM_VIEWPORT.width &&
      pointer.y >= OWNED_ITEM_VIEWPORT.y &&
      pointer.y <= OWNED_ITEM_VIEWPORT.y + OWNED_ITEM_VIEWPORT.height
    );
  }

  private getOwnedItemRenderKey(entries: OwnedItemEntry[]): string {
    return entries
      .map(({ item, count }) => {
        const remaining = item.useCount === undefined
          ? "-"
          : this.callbacks.getItemUsesRemaining(item.code);
        const canUse = this.callbacks.canUseItem(item) ? "1" : "0";
        return `${item.code}:${count}:${remaining}:${canUse}`;
      })
      .join("|");
  }

  private showItemTooltip(item: Item, count: number, x: number, y: number) {
    if (
      !this.itemTooltipContainer ||
      !this.itemTooltipBackground ||
      !this.itemTooltipText ||
      !this.itemTooltipNameRow ||
      !this.itemTooltipNameText ||
      !this.itemTooltipCountText ||
      !this.itemTooltipMetaContainer ||
      !this.itemTooltipDescriptionText
    ) {
      return;
    }

    this.itemTooltipText.setVisible(false);
    this.itemTooltipNameRow.setVisible(true);
    this.itemTooltipMetaContainer.setVisible(true);
    this.itemTooltipDescriptionText.setVisible(true);

    this.itemTooltipNameText.setColor(ItemRarityColor[item.rarity]);
    this.itemTooltipNameText.setText(item.name);
    this.itemTooltipCountText.setText(count >= 2 ? ` x${count}` : "");
    this.itemTooltipCountText.setPosition(
      this.itemTooltipNameText.displayWidth + 4,
      2,
    );
    this.renderItemTooltipMeta(item, count, this.itemTooltipMetaContainer);
    this.itemTooltipDescriptionText.setText(item.description);

    let cursorY = 10;
    this.itemTooltipNameRow.setPosition(12, cursorY);
    cursorY += this.itemTooltipNameText.displayHeight + 9;

    const metaHeight = this.getContainerHeight(this.itemTooltipMetaContainer);
    this.itemTooltipMetaContainer.setPosition(12, cursorY);
    if (metaHeight > 0) cursorY += metaHeight + 9;

    this.itemTooltipDescriptionText.setPosition(12, cursorY);

    const width = 318;
    const height = cursorY + this.itemTooltipDescriptionText.displayHeight + 12;
    const tooltipX = Phaser.Math.Clamp(
      x - width / 2,
      24,
      GAME_WIDTH - width - 24,
    );
    const tooltipY = Math.max(118, y - height);

    this.itemTooltipBackground.clear();
    this.itemTooltipBackground.fillStyle(0x07100a, 0.96);
    this.itemTooltipBackground.fillRoundedRect(0, 0, width, height, 8);
    this.itemTooltipBackground.lineStyle(2, 0xffef9c, 0.82);
    this.itemTooltipBackground.strokeRoundedRect(0, 0, width, height, 8);
    this.itemTooltipContainer.setPosition(tooltipX, tooltipY);
    this.itemTooltipContainer.setVisible(true);
  }

  private hideItemTooltip() {
    this.itemTooltipContainer?.setVisible(false);
  }

  private renderItemTooltipMeta(
    item: Item,
    count: number,
    container: Phaser.GameObjects.Container,
  ) {
    container.removeAll(true);
    let x = 0;

    if (item.isUnique) {
      const uniqueText = this.scene.add.text(x, 0, "ユニーク", {
        color: "#d391ff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 3,
      });
      container.add(uniqueText);
      x += uniqueText.displayWidth + 12;
    }

    if (item.useCount !== undefined) {
      const remaining = this.callbacks.getItemUsesRemaining(item.code);
      const maxUses = this.callbacks.getItemMaxUses(item, count);
      const suffix = remaining < maxUses ? ` (残り${remaining}回)` : "";
      const useText = this.scene.add.text(
        x,
        0,
        `使用回数 ${maxUses}${suffix}`,
        {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "13px",
          fontStyle: "800",
          stroke: "#050507",
          strokeThickness: 3,
        },
      );
      container.add(useText);
    }
  }
}

function wrapText(text: string, maxCharsPerLine: number): string {
  if (maxCharsPerLine <= 0) return text;

  const lines: string[] = [];
  let currentLine = "";
  for (const char of text) {
    currentLine += char;
    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = "";
    }
  }

  if (currentLine.length > 0) lines.push(currentLine);
  return lines.join("\n");
}
