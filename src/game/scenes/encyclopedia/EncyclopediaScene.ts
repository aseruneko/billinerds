import Phaser from "phaser";
import {
  DEBUG_MODE,
  GAME_FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_LABEL_FONT_FAMILY,
} from "../../config";
import { createButton, type PhaserButton } from "../../ui";
import {
  BallProperties,
  BallSpecialActions,
  type BallCode as BallCodeType,
  type BallProperty,
} from "../billiards/BallProperty";
import { GlobalBuffRoster } from "../billiards/GlobalBuff";
import {
  ItemRarityColor,
  Items,
  type Item,
  type ItemCode as ItemCodeType,
} from "../billiards/shop/item/Item";
import {
  getDiscoveredBalls,
  getDiscoveredItems,
} from "./EncyclopediaDiscovery";

type EncyclopediaMode = "balls" | "items";

const VIEWPORT = {
  x: 56,
  y: 150,
  width: GAME_WIDTH - 112,
  height: GAME_HEIGHT - 194,
};
const CARD_WIDTH = 276;
const BALL_CARD_HEIGHT = 204;
const ITEM_CARD_HEIGHT = 148;
const COLUMN_GAP = 24;
const ROW_GAP = 24;
const COLUMNS = 3;
const CARD_START_X = VIEWPORT.x + 10;
const CARD_START_Y = VIEWPORT.y + 10;

export class EncyclopediaScene extends Phaser.Scene {
  private mode: EncyclopediaMode = "balls";
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private contentHeight = 0;
  private scrollY = 0;
  private mask?: Phaser.Display.Masks.GeometryMask;
  private maskGraphics?: Phaser.GameObjects.Graphics;
  private scrollbar?: Phaser.GameObjects.Graphics;
  private ballButton?: PhaserButton;
  private itemButton?: PhaserButton;
  private wheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    dx: number,
    dy: number,
  ) => void;

  constructor() {
    super("EncyclopediaScene");
  }

  create() {
    this.mode = "balls";
    this.scrollY = 0;
    this.contentHeight = 0;
    this.contentObjects = [];
    this.ballButton = undefined;
    this.itemButton = undefined;
    this.drawBackground();
    this.createControls();
    this.createScrollArea();
    this.renderCards();
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x102118, 0.96);
    g.fillRoundedRect(34, 36, GAME_WIDTH - 68, GAME_HEIGHT - 72, 16);
    g.lineStyle(4, 0xffef9c, 0.78);
    g.strokeRoundedRect(34, 36, GAME_WIDTH - 68, GAME_HEIGHT - 72, 16);
    g.fillStyle(0xffc545, 0.1);
    g.fillRoundedRect(54, 54, GAME_WIDTH - 108, 72, 12);

    this.add
      .text(GAME_WIDTH / 2, 88, "図鑑", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "44px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 7,
      })
      .setOrigin(0.5);
  }

  private createControls() {
    this.ballButton = createButton(this, {
      x: 126,
      y: 88,
      width: 128,
      height: 48,
      label: "ボール",
      fontSize: 20,
      onClick: () => this.setMode("balls"),
    });
    this.itemButton = createButton(this, {
      x: 270,
      y: 88,
      width: 128,
      height: 48,
      label: "アイテム",
      fontSize: 20,
      onClick: () => this.setMode("items"),
    });
    createButton(this, {
      x: GAME_WIDTH - 128,
      y: 88,
      width: 128,
      height: 48,
      label: "戻る",
      fontSize: 20,
      onClick: () => this.scene.start("TitleScene"),
    });
    this.ballButton.setEnabled(false);
  }

  private createScrollArea() {
    this.maskGraphics = this.add.graphics();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(
      VIEWPORT.x,
      VIEWPORT.y,
      VIEWPORT.width,
      VIEWPORT.height,
    );
    this.maskGraphics.setVisible(false);
    this.mask = this.maskGraphics.createGeometryMask();

    this.scrollbar = this.add.graphics();
    this.scrollbar.setDepth(50);
    this.wheelHandler = (_pointer, _gameObjects, _dx, dy) => {
      this.setScroll(this.scrollY + dy * 0.6);
    };
    this.input.on("wheel", this.wheelHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.wheelHandler) this.input.off("wheel", this.wheelHandler);
    });
  }

  private setMode(mode: EncyclopediaMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.scrollY = 0;
    this.ballButton?.setEnabled(mode !== "balls");
    this.itemButton?.setEnabled(mode !== "items");
    this.renderCards();
  }

  private renderCards() {
    for (const object of this.contentObjects) object.destroy();
    this.contentObjects = [];

    if (this.mode === "balls") {
      const discovered = getDiscoveredBalls();
      Object.values(BallProperties).forEach((property, index) =>
        this.createBallCard(
          property,
          index,
          DEBUG_MODE || discovered.has(property.code),
        ),
      );
    } else {
      const discovered = getDiscoveredItems();
      Items.forEach((item, index) =>
        this.createItemCard(item, index, DEBUG_MODE || discovered.has(item.code)),
      );
    }

    this.updateContentHeight();
    this.drawScrollbar();
  }

  private createBallCard(
    property: BallProperty,
    index: number,
    discovered: boolean,
  ) {
    const { x, y } = this.getCardPosition(index);
    this.drawCardFrame(x, y, this.getCardHeight(), discovered ? property.color : 0x36413d);

    if (!discovered) {
      this.createUnknownCard(x, y);
      return;
    }

    const name = this.add.text(x + 18, y + 14, property.name, {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 4,
    });
    const desc = this.add.text(x + 18, y + 56, property.description, {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "700",
      wordWrap: { width: CARD_WIDTH - 36, useAdvancedWrap: true },
      maxLines: 2,
    });
    const actions = property.specialActions
      .map((code) => BallSpecialActions[code]?.name)
      .filter(Boolean)
      .join(" / ") || "なし";
    const buffs = property.globalBuffs
      .map((code) => GlobalBuffRoster[code]?.name)
      .filter(Boolean)
      .join(" / ") || "なし";
    const details = this.add.text(
      x + 18,
      y + 92,
      [
        `HP ${property.maxHp}  ATK ${property.attack.toFixed(2)}`,
        `防御率 ${property.blockRate.toFixed(2)}  重さ ${property.initialWeight}`,
        `$ ${property.moneyOnHit} / Hit`,
        `行動: ${actions}`,
        `Buff: ${buffs}`,
      ],
      {
        color: "#cfe7d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "12px",
        fontStyle: "700",
        lineSpacing: 2,
        wordWrap: { width: CARD_WIDTH - 36, useAdvancedWrap: true },
      },
    );
    const preview = this.createBallPreview(
      property,
      x + CARD_WIDTH - 42,
      y + BALL_CARD_HEIGHT - 42,
    );

    this.addContentObject(name);
    this.addContentObject(desc);
    this.addContentObject(details);
    this.addContentObject(preview);
  }

  private createBallPreview(
    property: BallProperty,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const radius = property.initialRadius * 1.55;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.32);
    shadow.fillEllipse(4, 8, radius * 1.8, radius * 0.62);

    const ball = this.add.graphics();
    this.drawPreviewBallBody(ball, property, radius);
    ball.lineStyle(2, 0xffffff, 0.18);
    ball.strokeCircle(0, 0, radius - 1);

    const labelFont =
      property.visualType === "emoji"
        ? ITEM_LABEL_FONT_FAMILY
        : GAME_FONT_FAMILY;
    const label = this.add
      .text(0, 1, property.label, {
        color: property.visualType === "eight" ? "#ffffff" : "#191919",
        fontFamily: labelFont,
        fontSize: `${Math.max(
          9,
          Math.round(radius * 0.77 * (property.labelSizeMultiplier ?? 1)),
        )}px`,
        fontStyle: "900",
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [shadow, ball, label]);
    container.setSize(48, 48);
    return container;
  }

  private drawPreviewBallBody(
    graphics: Phaser.GameObjects.Graphics,
    property: BallProperty,
    radius: number,
  ) {
    if (property.visualType === "chip") {
      this.drawPreviewChip(graphics, property.color, radius);
      return;
    }

    if (property.visualType === "stripe") {
      graphics.fillStyle(property.color, 1);
      graphics.fillCircle(0, 0, radius);
      graphics.fillStyle(0xf7f4df, 1);
      this.fillClippedHorizontalBand(graphics, radius, radius * 0.76);
      graphics.fillStyle(property.color, 1);
      graphics.fillCircle(0, 0, radius * 0.54);
    } else {
      graphics.fillStyle(property.color, 1);
      graphics.fillCircle(0, 0, radius);
    }

    graphics.fillStyle(0xffffff, 0.22);
    graphics.fillCircle(-radius * 0.34, -radius * 0.38, radius * 0.36);
    graphics.fillStyle(0x050507, 0.16);
    graphics.fillCircle(radius * 0.24, radius * 0.3, radius * 0.78);
  }

  private fillClippedHorizontalBand(
    graphics: Phaser.GameObjects.Graphics,
    radius: number,
    height: number,
  ) {
    const halfHeight = height / 2;
    const segments = 18;
    const points: Phaser.Geom.Point[] = [];

    for (let index = 0; index <= segments; index += 1) {
      const y = -halfHeight + (height * index) / segments;
      const x = Math.sqrt(Math.max(0, radius * radius - y * y));
      points.push(new Phaser.Geom.Point(-x, y));
    }

    for (let index = segments; index >= 0; index -= 1) {
      const y = -halfHeight + (height * index) / segments;
      const x = Math.sqrt(Math.max(0, radius * radius - y * y));
      points.push(new Phaser.Geom.Point(x, y));
    }

    graphics.fillPoints(points, true);
  }

  private drawPreviewChip(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    radius: number,
  ) {
    const accent = 0xf8ead2;
    const ringWidth = Math.max(1, radius * 0.12);

    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, radius);
    graphics.lineStyle(ringWidth, accent, 1);
    graphics.strokeCircle(0, 0, radius * 0.78);

    graphics.fillStyle(accent, 1);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const distance = radius * 0.78;
      const cx = Math.cos(angle) * distance;
      const cy = Math.sin(angle) * distance;
      graphics.save();
      graphics.translateCanvas(cx, cy);
      graphics.rotateCanvas(angle + Math.PI / 2);
      graphics.fillRect(-radius * 0.11, -radius * 0.17, radius * 0.22, radius * 0.34);
      graphics.restore();
    }

    graphics.fillStyle(0x000000, 0.18);
    graphics.fillCircle(0, 0, radius * 0.47);
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, radius * 0.4);
    graphics.lineStyle(ringWidth, accent, 1);
    graphics.strokeCircle(0, 0, radius * 0.34);
  }

  private createItemCard(item: Item, index: number, discovered: boolean) {
    const { x, y } = this.getCardPosition(index);
    this.drawCardFrame(x, y, this.getCardHeight(), discovered ? 0xffc545 : 0x36413d);

    if (!discovered) {
      this.createUnknownCard(x, y);
      return;
    }

    const icon = this.add
      .text(x + 24, y + 28, item.label, {
        fontFamily: ITEM_LABEL_FONT_FAMILY,
        fontSize: "26px",
      })
      .setOrigin(0, 0.5);
    const name = this.add.text(x + 76, y + 14, item.name, {
      color: ItemRarityColor[item.rarity],
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 4,
    });
    const desc = this.add.text(x + 18, y + 56, item.description, {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "13px",
      fontStyle: "700",
      wordWrap: { width: CARD_WIDTH - 36, useAdvancedWrap: true },
    });
    const price = this.add
      .text(x + CARD_WIDTH - 18, y + ITEM_CARD_HEIGHT - 29, `${item.price}$`, {
      color: "#ffe3a3",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "15px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 3,
      })
      .setOrigin(1, 0);
    const badges = this.createItemBadges(item, x + 18, y + ITEM_CARD_HEIGHT - 29);

    this.addContentObject(icon);
    this.addContentObject(name);
    this.addContentObject(desc);
    this.addContentObject(price);
    for (const badge of badges) this.addContentObject(badge);
  }

  private drawCardFrame(
    x: number,
    y: number,
    height: number,
    accentColor: number,
  ) {
    const card = this.add.graphics();
    card.fillStyle(0x162018, 0.96);
    card.fillRoundedRect(x, y, CARD_WIDTH, height, 8);
    card.lineStyle(2, accentColor, 0.68);
    card.strokeRoundedRect(x, y, CARD_WIDTH, height, 8);
    card.fillStyle(accentColor, 0.1);
    card.fillRoundedRect(x + 10, y + 10, CARD_WIDTH - 20, 36, 6);
    this.addContentObject(card);
  }

  private createItemBadges(
    item: Item,
    x: number,
    y: number,
  ): Phaser.GameObjects.GameObject[] {
    const badges: Phaser.GameObjects.GameObject[] = [];
    let nextX = x;

    if (item.isUnique) {
      const unique = this.add.text(nextX, y, "ユニーク", {
        color: "#d391ff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 3,
      });
      badges.push(unique);
      nextX += unique.displayWidth + 12;
    }

    if (item.useCount !== undefined) {
      const uses = this.add.text(nextX, y, `使用回数 ${item.useCount}`, {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#050507",
        strokeThickness: 3,
      });
      badges.push(uses);
    }

    return badges;
  }

  private createUnknownCard(x: number, y: number) {
    const cardHeight = this.getCardHeight();
    const mark = this.add
      .text(x + CARD_WIDTH / 2, y + cardHeight * 0.38, "?", {
        color: "#65756d",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "54px",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    const label = this.add
      .text(x + CARD_WIDTH / 2, y + cardHeight * 0.68, "未発見", {
        color: "#9baaa2",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "900",
      })
      .setOrigin(0.5);
    this.addContentObject(mark);
    this.addContentObject(label);
  }

  private getCardPosition(index: number): { x: number; y: number } {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const cardHeight = this.getCardHeight();
    return {
      x: CARD_START_X + column * (CARD_WIDTH + COLUMN_GAP),
      y: CARD_START_Y + row * (cardHeight + ROW_GAP) - this.scrollY,
    };
  }

  private addContentObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    if (this.mask && typeof (object as { setMask?: unknown }).setMask === "function") {
      (object as unknown as {
        setMask: (mask: Phaser.Display.Masks.GeometryMask) => void;
      }).setMask(this.mask);
    }
    this.contentObjects.push(object);
    return object;
  }

  private updateContentHeight() {
    const count = this.mode === "balls" ? Object.keys(BallProperties).length : Items.length;
    const rows = Math.ceil(count / COLUMNS);
    const cardHeight = this.getCardHeight();
    this.contentHeight = rows * cardHeight + Math.max(0, rows - 1) * ROW_GAP + 20;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.getMaxScroll());
  }

  private getCardHeight(): number {
    return this.mode === "balls" ? BALL_CARD_HEIGHT : ITEM_CARD_HEIGHT;
  }

  private setScroll(scrollY: number) {
    const nextScrollY = Phaser.Math.Clamp(scrollY, 0, this.getMaxScroll());
    if (nextScrollY === this.scrollY) return;
    this.scrollY = nextScrollY;
    this.renderCards();
  }

  private getMaxScroll(): number {
    return Math.max(0, this.contentHeight - VIEWPORT.height);
  }

  private drawScrollbar() {
    this.scrollbar?.clear();
    if (!this.scrollbar) return;

    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return;

    const trackX = VIEWPORT.x + VIEWPORT.width - 8;
    const trackY = VIEWPORT.y + 8;
    const trackHeight = VIEWPORT.height - 16;
    const thumbHeight = Math.max(
      36,
      (VIEWPORT.height / this.contentHeight) * trackHeight,
    );
    const thumbY =
      trackY + (this.scrollY / maxScroll) * (trackHeight - thumbHeight);

    this.scrollbar.fillStyle(0x030604, 0.46);
    this.scrollbar.fillRoundedRect(trackX, trackY, 5, trackHeight, 3);
    this.scrollbar.fillStyle(0xffef9c, 0.78);
    this.scrollbar.fillRoundedRect(trackX, thumbY, 5, thumbHeight, 3);
  }
}
