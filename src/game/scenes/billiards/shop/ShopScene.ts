import Phaser from "phaser";
import purchaseSfxUrl from "../../../../assets/purchase.mp3";
import welcomeSfxUrl from "../../../../assets/welcome.mp3";
import {
  GAME_FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_LABEL_FONT_FAMILY,
} from "../../../config";
import { isDialogueSkipEnabled } from "../../../dialogueSettings";
import { getSfxVolume } from "../../../soundSettings";
import { createButton, type PhaserButton } from "../../../ui";
import {
  getShopDialogue,
  NAVIGATOR_NAME,
} from "../../dialogue/DialogueScripts";
import { discoverItems } from "../../encyclopedia/EncyclopediaDiscovery";
import {
  ItemCode,
  ItemRarity,
  ItemRarityColor,
  Items,
  type Item,
  type ItemCode as ItemCodeType,
  type ItemRarity as ItemRarityType,
} from "./item/Item";

const BILLIARDS_SCENE_KEY = "BilliardsScene";
const DIALOGUE_SCENE_KEY = "DialogueScene";
const PURCHASE_SFX_KEY = "shop-purchase";
const WELCOME_SFX_KEY = "shop-welcome";
const BASE_STOCK_COUNT = 6;
const DEFAULT_REROLL_COST = 20;
const DISCOUNTED_REROLL_COST = 10;
const SALE_PRICE_RATE = 0.75;
const STOCK_VIEWPORT = { x: 52, y: 118, width: GAME_WIDTH - 104, height: 476 };
const STOCK_CARD_WIDTH = 260;
const STOCK_CARD_HEIGHT = 176;
const STOCK_COLUMNS = 3;
const STOCK_ROW_GAP = 220;
const STOCK_CARD_START_X = 84;
const STOCK_CARD_START_Y = 160;
const STOCK_COLUMN_GAP = 296;
const OWNED_ITEM_VIEWPORT = { x: 64, y: 640, width: 900, height: 72 };
const OWNED_ITEM_CARD_SIZE = 48;
const OWNED_ITEM_CARD_GAP = 10;
const OWNED_ITEM_COLUMNS = 12;
const OWNED_ITEM_START_X = 76;
const OWNED_ITEM_START_Y = 646;
const ITEM_RARITY_STOCK_WEIGHT: Record<ItemRarityType, number> = {
  [ItemRarity.Common]: 1,
  [ItemRarity.Uncommon]: 0.82,
  [ItemRarity.Rare]: 0.64,
  [ItemRarity.Epic]: 0.48,
  [ItemRarity.Legendary]: 0.34,
};

type ShopData = {
  money: number;
  ownedItemCodes: ItemCodeType[];
  afterStageNumber?: number;
};

export class ShopScene extends Phaser.Scene {
  private money = 0;
  private ownedItemCodes: ItemCodeType[] = [];
  private afterStageNumber = 0;
  private moneyText?: Phaser.GameObjects.Text;
  private rerollButton?: PhaserButton;
  private currentStock: Item[] = [];
  private stockObjects: Phaser.GameObjects.GameObject[] = [];
  private ownedItemObjects: Phaser.GameObjects.GameObject[] = [];
  private tooltipContainer?: Phaser.GameObjects.Container;
  private tooltipBackground?: Phaser.GameObjects.Graphics;
  private tooltipText?: Phaser.GameObjects.Text;
  private tooltipNameRow?: Phaser.GameObjects.Container;
  private tooltipNameText?: Phaser.GameObjects.Text;
  private tooltipCountText?: Phaser.GameObjects.Text;
  private tooltipMetaContainer?: Phaser.GameObjects.Container;
  private tooltipDescriptionText?: Phaser.GameObjects.Text;
  private rerollCost = DEFAULT_REROLL_COST;
  private stockScrollY = 0;
  private stockContentHeight = 0;
  private stockMask?: Phaser.Display.Masks.GeometryMask;
  private stockMaskGraphics?: Phaser.GameObjects.Graphics;
  private stockScrollbar?: Phaser.GameObjects.Graphics;
  private ownedItemScrollY = 0;
  private ownedItemContentHeight = 0;
  private ownedItemMask?: Phaser.Display.Masks.GeometryMask;
  private ownedItemMaskGraphics?: Phaser.GameObjects.Graphics;
  private ownedItemScrollbar?: Phaser.GameObjects.Graphics;
  private stockWheelHandler?: (
    pointer: Phaser.Input.Pointer,
    objects: unknown,
    dx: number,
    dy: number,
  ) => void;
  private transitioning = false;

  constructor() {
    super("ShopScene");
  }

  preload() {
    this.load.audio(PURCHASE_SFX_KEY, purchaseSfxUrl);
    this.load.audio(WELCOME_SFX_KEY, welcomeSfxUrl);
  }

  init(data: ShopData) {
    this.money = data.money;
    this.ownedItemCodes = [...data.ownedItemCodes];
    this.afterStageNumber = data.afterStageNumber ?? 0;
    this.currentStock = [];
    this.stockObjects = [];
    this.ownedItemObjects = [];
    this.rerollButton = undefined;
    this.tooltipContainer = undefined;
    this.tooltipBackground = undefined;
    this.tooltipText = undefined;
    this.tooltipNameRow = undefined;
    this.tooltipNameText = undefined;
    this.tooltipCountText = undefined;
    this.tooltipMetaContainer = undefined;
    this.tooltipDescriptionText = undefined;
    this.stockScrollY = 0;
    this.stockContentHeight = 0;
    this.stockMask = undefined;
    this.stockMaskGraphics = undefined;
    this.stockScrollbar = undefined;
    this.ownedItemScrollY = 0;
    this.ownedItemContentHeight = 0;
    this.ownedItemMask = undefined;
    this.ownedItemMaskGraphics = undefined;
    this.ownedItemScrollbar = undefined;
    this.stockWheelHandler = undefined;
    this.transitioning = false;
    this.rerollCost = this.getBaseRerollCost();
  }

  create() {
    this.scene.setVisible(false, BILLIARDS_SCENE_KEY);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.stockWheelHandler) {
        this.input.off("wheel", this.stockWheelHandler);
      }
      this.scene.setVisible(true, BILLIARDS_SCENE_KEY);
    });

    this.drawOverlay();
    this.createStockScrollArea();
    this.createOwnedItemScrollArea();

    this.moneyText = this.add
      .text(GAME_WIDTH / 2 - 72, 72, `$ ${this.money}`, {
        color: "#ffec8a",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "34px",
        fontStyle: "900",
        stroke: "#261000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: 132,
      y: 70,
      width: 160,
      height: 54,
      label: "準備完了!",
      fontSize: 22,
      variant: "primary",
      onClick: () => this.nextStage(),
    });

    this.rerollButton = createButton(this, {
      x: GAME_WIDTH - 214,
      y: 70,
      width: 184,
      height: 54,
      label: this.getRerollLabel(),
      fontSize: 18,
      onClick: () => this.rerollStock(),
    });

    createButton(this, {
      x: GAME_WIDTH - 82,
      y: 70,
      width: 54,
      height: 54,
      label: "≡",
      fontSize: 32,
      onClick: () => this.openMenu(),
    });

    this.refreshStock({
      includeNewArrivals: true,
      includeSaleGuarantees: true,
    });
    this.renderOwnedItems();
    this.showShopDialogue();
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 0.68);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.96);
    g.fillRoundedRect(28, 24, GAME_WIDTH - 56, GAME_HEIGHT - 48, 18);
    g.lineStyle(4, 0xffef9c, 0.75);
    g.strokeRoundedRect(28, 24, GAME_WIDTH - 56, GAME_HEIGHT - 48, 18);
    g.fillStyle(0xffc545, 0.08);
    g.fillRoundedRect(
      STOCK_VIEWPORT.x,
      STOCK_VIEWPORT.y,
      STOCK_VIEWPORT.width,
      STOCK_VIEWPORT.height,
      12,
    );
    g.fillStyle(0x050507, 0.34);
    g.fillRoundedRect(52, 616, GAME_WIDTH - 104, 106, 12);
    g.lineStyle(2, 0xffef9c, 0.34);
    g.strokeRoundedRect(52, 616, GAME_WIDTH - 104, 106, 12);
  }

  private createStockScrollArea() {
    this.stockMaskGraphics = this.add.graphics();
    this.stockMaskGraphics.fillStyle(0xffffff, 1);
    this.stockMaskGraphics.fillRect(
      STOCK_VIEWPORT.x,
      STOCK_VIEWPORT.y,
      STOCK_VIEWPORT.width,
      STOCK_VIEWPORT.height,
    );
    this.stockMaskGraphics.setVisible(false);
    this.stockMask = this.stockMaskGraphics.createGeometryMask();

    this.stockWheelHandler = (
      pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (this.isPointerInOwnedItemArea(pointer)) {
        this.setOwnedItemScroll(this.ownedItemScrollY + dy * 0.6);
        return;
      }
      if (!this.isPointerInStockArea(pointer)) return;
      this.setStockScroll(this.stockScrollY + dy * 0.6);
    };
    this.input.on("wheel", this.stockWheelHandler);

    this.stockScrollbar = this.add.graphics();
    this.stockScrollbar.setDepth(50);
  }

  private createOwnedItemScrollArea() {
    this.ownedItemMaskGraphics = this.add.graphics();
    this.ownedItemMaskGraphics.fillStyle(0xffffff, 1);
    this.ownedItemMaskGraphics.fillRect(
      OWNED_ITEM_VIEWPORT.x,
      OWNED_ITEM_VIEWPORT.y,
      OWNED_ITEM_VIEWPORT.width,
      OWNED_ITEM_VIEWPORT.height,
    );
    this.ownedItemMaskGraphics.setVisible(false);
    this.ownedItemMask = this.ownedItemMaskGraphics.createGeometryMask();

    this.ownedItemScrollbar = this.add.graphics();
    this.ownedItemScrollbar.setDepth(50);
  }

  private renderStock() {
    for (const object of this.stockObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.stockObjects = [];
    this.hideItemTooltip();
    this.updateStockMetrics();
    this.drawStockScrollbar();

    if (this.currentStock.length === 0) {
      const emptyText = this.add
        .text(GAME_WIDTH / 2, 388, "Items coming soon", {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "28px",
          fontStyle: "800",
        })
        .setOrigin(0.5)
        .setAlpha(0.48);
      this.addStockObject(emptyText);
      return;
    }

    for (const [index, item] of this.currentStock.entries()) {
      this.createItemCard(item, index);
    }
  }

  private refreshStock(options: {
    includeNewArrivals: boolean;
    includeSaleGuarantees: boolean;
  }) {
    this.currentStock = this.pickStock(options);
    discoverItems(this.currentStock.map((item) => item.code));
    this.renderStock();
    this.updateRerollButton();
  }

  private getStockCount(): number {
    return BASE_STOCK_COUNT + this.getOwnedItemCount(ItemCode.ExpandedShelf) * 2;
  }

  private getAvailableItems(): Item[] {
    const seen = new Set<ItemCodeType>();
    return Items.filter((item) => {
      if (!item.enabled) return false;
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      if (!this.hasItemArrived(item)) return false;
      if (!item.isUnique) return true;
      return !this.ownedItemCodes.includes(item.code);
    });
  }

  private pickStock(options: {
    includeNewArrivals: boolean;
    includeSaleGuarantees: boolean;
  }): Item[] {
    const availableItems = this.getAvailableItems();
    const arrivalStageNumber = this.getArrivalStageNumber();
    const newArrivalItems = options.includeNewArrivals
      ? availableItems.filter((item) => item.arriveOn === arrivalStageNumber)
      : [];
    const newArrivalCodes = new Set(newArrivalItems.map((item) => item.code));
    const saleItems = options.includeSaleGuarantees
      ? availableItems.filter(
          (item) =>
            this.isSaleItem(item) &&
            !newArrivalCodes.has(item.code),
        )
      : [];
    const guaranteedCodes = new Set([
      ...newArrivalItems.map((item) => item.code),
      ...saleItems.map((item) => item.code),
    ]);
    const stockCount = this.getStockCount();
    const guaranteedItems = [...newArrivalItems, ...saleItems];
    const randomCount = Math.max(0, stockCount - guaranteedItems.length);
    const randomItems = this.pickWeightedStock(
      availableItems.filter((item) => !guaranteedCodes.has(item.code)),
      randomCount,
    );

    return [...guaranteedItems, ...randomItems];
  }

  private hasItemArrived(item: Item): boolean {
    return (
      item.arriveOn === undefined ||
      item.arriveOn <= this.getArrivalStageNumber()
    );
  }

  private getArrivalStageNumber(): number {
    return Math.max(1, this.afterStageNumber);
  }

  private pickWeightedStock(items: Item[], count: number): Item[] {
    const pool = [...items];
    const picked: Item[] = [];

    while (pool.length > 0 && picked.length < count) {
      const totalWeight = pool.reduce(
        (total, item) => total + ITEM_RARITY_STOCK_WEIGHT[item.rarity],
        0,
      );
      let roll = Math.random() * totalWeight;
      let pickedIndex = 0;
      for (let index = 0; index < pool.length; index += 1) {
        roll -= ITEM_RARITY_STOCK_WEIGHT[pool[index].rarity];
        if (roll <= 0) {
          pickedIndex = index;
          break;
        }
      }
      picked.push(pool.splice(pickedIndex, 1)[0]);
    }

    return picked;
  }

  private createItemCard(item: Item, index: number) {
    const column = index % STOCK_COLUMNS;
    const row = Math.floor(index / STOCK_COLUMNS);
    const x = STOCK_CARD_START_X + column * STOCK_COLUMN_GAP;
    const y = STOCK_CARD_START_Y + row * STOCK_ROW_GAP - this.stockScrollY;
    const width = STOCK_CARD_WIDTH;
    const height = STOCK_CARD_HEIGHT;
    const buttonY = y + height - 34;
    const isButtonInsideViewport =
      buttonY >= STOCK_VIEWPORT.y &&
      buttonY <= STOCK_VIEWPORT.y + STOCK_VIEWPORT.height;

    const card = this.add.graphics();
    card.fillStyle(0x162018, 0.96);
    card.fillRoundedRect(x, y, width, height, 8);
    card.lineStyle(2, 0xffef9c, 0.64);
    card.strokeRoundedRect(x, y, width, height, 8);
    card.fillStyle(0xffc545, 0.08);
    card.fillRoundedRect(x + 10, y + 10, width - 20, 36, 6);

    const icon = this.add
      .text(x + 22, y + 28, item.label, {
        fontFamily: ITEM_LABEL_FONT_FAMILY,
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);
    const name = this.add.text(x + 64, y + 16, item.name, {
      color: ItemRarityColor[item.rarity],
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "18px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 4,
    });
    const description = this.add.text(x + 18, y + 56, item.description, {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "15px",
      fontStyle: "700",
      wordWrap: { width: width - 36, useAdvancedWrap: true },
    });
    const badges = this.createStockBadges(item, x + 18, y + height - 56);
    const cornerBadge = this.isSaleItem(item)
      ? this.createStockCornerBadge(x + width - 30, y + 12, "SALE", {
          fill: 0xffb12a,
          stroke: 0x4a2200,
          textStroke: "#4a2200",
        })
      : this.shouldShowNewArrivalBadge(item)
        ? this.createStockCornerBadge(x + width - 30, y + 12, "NEW", {
            fill: 0xff3e5f,
            stroke: 0xfff0a0,
            textStroke: "#4a0612",
          })
        : null;
    const normalPrice = this.getNormalItemPrice(item);
    const price = this.getItemPrice(item);
    const discount = normalPrice - price;

    const buyButton = createButton(this, {
      x: x + width - 72,
      y: y + height - 34,
      width: 118,
      height: 44,
      label: `購入 (${price}$)`,
      fontSize: 15,
      onClick: () => this.buyItem(item),
    });
    buyButton.setEnabled(isButtonInsideViewport && this.money >= price);
    buyButton.setVisible(isButtonInsideViewport);

    const discountSticker =
      discount > 0
        ? this.createDiscountSticker(
            x + width - 12,
            y + height - 58,
            discount,
            isButtonInsideViewport,
          )
        : null;

    this.addStockObject(card);
    this.addStockObject(icon);
    this.addStockObject(name);
    this.addStockObject(description);
    for (const badge of badges) this.addStockObject(badge);
    if (cornerBadge) this.addStockObject(cornerBadge);
    if (discountSticker) this.addStockObject(discountSticker);
    this.addStockObject(buyButton);
  }

  private isNewArrivalItem(item: Item): boolean {
    return item.arriveOn === this.getArrivalStageNumber();
  }

  private shouldShowNewArrivalBadge(item: Item): boolean {
    return this.afterStageNumber > 1 && this.isNewArrivalItem(item);
  }

  private isSaleItem(item: Item): boolean {
    return item.saleOn.includes(this.getArrivalStageNumber());
  }

  private createStockCornerBadge(
    x: number,
    y: number,
    label: string,
    colors: { fill: number; stroke: number; textStroke: string },
  ): Phaser.GameObjects.Container {
    const background = this.add.graphics();
    background.fillStyle(colors.fill, 0.96);
    background.fillRoundedRect(-36, -15, 72, 30, 6);
    background.lineStyle(2, colors.stroke, 0.95);
    background.strokeRoundedRect(-36, -15, 72, 30, 6);
    background.fillStyle(0xffffff, 0.16);
    background.fillRoundedRect(-30, -11, 60, 7, 4);

    const text = this.add
      .text(0, -1, label, {
        color: "#fff7c8",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "17px",
        fontStyle: "900",
        stroke: colors.textStroke,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [background, text]);
    container.setRotation(0.24);
    container.setDepth(2);

    this.tweens.add({
      targets: container,
      scaleX: 1.08,
      scaleY: 1.08,
      rotation: 0.14,
      duration: 640,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    return container;
  }

  private createDiscountSticker(
    x: number,
    y: number,
    discount: number,
    visible: boolean,
  ): Phaser.GameObjects.Container {
    const background = this.add.graphics();
    background.fillStyle(0xfff0a0, 0.98);
    background.fillRoundedRect(-30, -15, 60, 30, 7);
    background.lineStyle(2, 0xff4d3d, 0.9);
    background.strokeRoundedRect(-30, -15, 60, 30, 7);
    background.fillStyle(0xff4d3d, 0.14);
    background.fillRoundedRect(-24, -10, 48, 6, 4);

    const text = this.add
      .text(0, 0, `-${discount}$`, {
        color: "#7a150c",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "15px",
        fontStyle: "900",
        stroke: "#fff8cf",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [background, text]);
    container.setDepth(3);
    container.setRotation(Phaser.Math.FloatBetween(-0.12, 0.12));
    container.setVisible(visible);
    return container;
  }

  private createStockBadges(
    item: Item,
    x: number,
    y: number,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    let nextY = y;

    if (item.isUnique) {
      const uniqueText = this.add.text(x, nextY, "ユニーク", {
        color: "#d391ff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 3,
      });
      objects.push(uniqueText);
      nextY += uniqueText.displayHeight + 3;
    }

    if (item.useCount !== undefined) {
      const useText = this.add.text(x, nextY, `使用回数 ${item.useCount}`, {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#050507",
        strokeThickness: 3,
      });
      objects.push(useText);
    }

    return objects;
  }
  private renderOwnedItems() {
    for (const object of this.ownedItemObjects) object.destroy();
    this.ownedItemObjects = [];
    this.hideItemTooltip();

    const ownedEntries = this.getOwnedItemEntries();
    this.updateOwnedItemMetrics(ownedEntries.length);
    this.drawOwnedItemScrollbar();
    if (ownedEntries.length === 0) {
      const emptyText = this.add
        .text(76, 657, "No items", {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "20px",
          fontStyle: "800",
        })
        .setAlpha(0.48);
      this.addOwnedItemObject(emptyText);
      return;
    }

    for (const [index, entry] of ownedEntries.entries()) {
      this.createOwnedItemCard(entry.item, entry.count, index);
    }
  }

  private getOwnedItemEntries(): { item: Item; count: number }[] {
    const countByCode = new Map<ItemCodeType, number>();
    for (const itemCode of this.ownedItemCodes) {
      countByCode.set(itemCode, (countByCode.get(itemCode) ?? 0) + 1);
    }

    return [...countByCode.entries()]
      .map(([itemCode, count]) => {
        const item = Items.find((candidate) => candidate.code === itemCode);
        if (!item) return null;
        return { item, count };
      })
      .filter(
        (entry): entry is { item: Item; count: number } => entry !== null,
      );
  }

  private getOwnedItemCount(itemCode: ItemCodeType): number {
    return this.ownedItemCodes.filter(
      (ownedItemCode) => ownedItemCode === itemCode,
    ).length;
  }

  private getNormalItemPrice(item: Item): number {
    return Math.ceil(item.price * 1.2 ** this.getOwnedItemCount(item.code));
  }

  private getItemPrice(item: Item): number {
    const normalPrice = this.getNormalItemPrice(item);
    return this.isSaleItem(item)
      ? Math.floor(normalPrice * SALE_PRICE_RATE)
      : normalPrice;
  }

  private createOwnedItemCard(item: Item, count: number, index: number) {
    const cardSize = OWNED_ITEM_CARD_SIZE;
    const x =
      OWNED_ITEM_START_X +
      (index % OWNED_ITEM_COLUMNS) * (cardSize + OWNED_ITEM_CARD_GAP);
    const y =
      OWNED_ITEM_START_Y +
      Math.floor(index / OWNED_ITEM_COLUMNS) *
        (cardSize + OWNED_ITEM_CARD_GAP) -
      this.ownedItemScrollY;
    const isInsideViewport =
      y + cardSize >= OWNED_ITEM_VIEWPORT.y &&
      y <= OWNED_ITEM_VIEWPORT.y + OWNED_ITEM_VIEWPORT.height;

    const card = this.add.graphics();
    card.fillStyle(0x162018, 0.98);
    card.fillRoundedRect(x, y, cardSize, cardSize, 8);
    card.lineStyle(2, 0xffef9c, 0.58);
    card.strokeRoundedRect(x, y, cardSize, cardSize, 8);
    card.fillStyle(0xffc545, 0.08);
    card.fillRoundedRect(x + 6, y + 6, cardSize - 12, 16, 5);

    const label = this.add
      .text(x + cardSize / 2, y + cardSize / 2 + 1, item.label, {
        fontFamily: ITEM_LABEL_FONT_FAMILY,
        fontSize: "27px",
      })
      .setOrigin(0.5);
    const zone = this.add
      .zone(x + cardSize / 2, y + cardSize / 2, cardSize, cardSize)
      .setInteractive({ useHandCursor: isInsideViewport });
    zone.setVisible(isInsideViewport);
    if (!isInsideViewport) zone.disableInteractive();

    zone.on("pointerover", () =>
      this.showItemTooltip(item, count, x + cardSize / 2, y - 10),
    );
    zone.on("pointerout", () => this.hideItemTooltip());

    this.addOwnedItemObject(card);
    this.addOwnedItemObject(label);
    this.addOwnedItemObject(zone);
  }

  private showItemTooltip(item: Item, count: number, x: number, y: number) {
    this.ensureTooltip();

    this.tooltipText!.setVisible(false);
    this.tooltipNameRow!.setVisible(true);
    this.tooltipMetaContainer!.setVisible(true);
    this.tooltipDescriptionText!.setVisible(true);

    this.tooltipNameText!.setColor(ItemRarityColor[item.rarity]);
    this.tooltipNameText!.setText(item.name);
    this.tooltipCountText!.setText(count >= 2 ? ` x${count}` : "");
    this.tooltipCountText!.setPosition(this.tooltipNameText!.displayWidth + 4, 3);
    this.renderItemTooltipMeta(item, count, this.tooltipMetaContainer!);
    this.tooltipDescriptionText!.setText(item.description);

    let cursorY = 12;
    this.tooltipNameRow!.setPosition(14, cursorY);
    cursorY += this.tooltipNameText!.displayHeight + 9;

    const metaHeight = this.getContainerHeight(this.tooltipMetaContainer!);
    this.tooltipMetaContainer!.setPosition(14, cursorY);
    if (metaHeight > 0) cursorY += metaHeight + 9;

    this.tooltipDescriptionText!.setPosition(14, cursorY);

    const width = 318;
    const height = cursorY + this.tooltipDescriptionText!.displayHeight + 12;
    const tooltipX = Phaser.Math.Clamp(
      x - width / 2,
      34,
      GAME_WIDTH - width - 34,
    );
    const tooltipY = Math.max(126, y - height);

    this.tooltipBackground!.clear();
    this.tooltipBackground!.fillStyle(0x07100a, 0.96);
    this.tooltipBackground!.fillRoundedRect(0, 0, width, height, 8);
    this.tooltipBackground!.lineStyle(2, 0xffef9c, 0.84);
    this.tooltipBackground!.strokeRoundedRect(0, 0, width, height, 8);
    this.tooltipContainer!.setPosition(tooltipX, tooltipY);
    this.tooltipContainer!.setVisible(true);
  }

  private showSimpleTooltip(text: string, x: number, y: number) {
    this.ensureTooltip();
    this.tooltipNameRow!.setVisible(false);
    this.tooltipMetaContainer!.setVisible(false);
    this.tooltipDescriptionText!.setVisible(false);
    this.tooltipText!.setVisible(true);
    this.tooltipText!.setColor("#f7f1d7");
    this.tooltipText!.setText(text);

    const bounds = this.tooltipText!.getBounds();
    const width = Math.min(318, Math.max(220, bounds.width + 28));
    const height = bounds.height + 24;
    const tooltipX = Phaser.Math.Clamp(
      x - width / 2,
      34,
      GAME_WIDTH - width - 34,
    );
    const tooltipY = Math.max(126, y - height);

    this.tooltipBackground!.clear();
    this.tooltipBackground!.fillStyle(0x07100a, 0.96);
    this.tooltipBackground!.fillRoundedRect(0, 0, width, height, 8);
    this.tooltipBackground!.lineStyle(2, 0xd391ff, 0.84);
    this.tooltipBackground!.strokeRoundedRect(0, 0, width, height, 8);
    this.tooltipText!.setPosition(14, 12);
    this.tooltipContainer!.setPosition(tooltipX, tooltipY);
    this.tooltipContainer!.setVisible(true);
  }

  private ensureTooltip() {
    if (this.tooltipContainer) return;

    this.tooltipBackground = this.add.graphics();
    this.tooltipText = this.add.text(0, 0, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "17px",
      fontStyle: "800",
      lineSpacing: 6,
      stroke: "#050507",
      strokeThickness: 3,
      wordWrap: { width: 284 },
    });
    this.tooltipNameText = this.add.text(0, 0, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "17px",
      fontStyle: "900",
      stroke: "#050507",
      strokeThickness: 3,
    });
    this.tooltipCountText = this.add.text(0, 0, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "800",
      stroke: "#050507",
      strokeThickness: 3,
    });
    this.tooltipNameRow = this.add.container(14, 12, [
      this.tooltipNameText,
      this.tooltipCountText,
    ]);
    this.tooltipMetaContainer = this.add.container(14, 38);
    this.tooltipDescriptionText = this.add.text(14, 62, "", {
      color: "#b9b3a3",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "14px",
      fontStyle: "700",
      wordWrap: { width: 284, useAdvancedWrap: true },
    });
    this.tooltipContainer = this.add.container(0, 0, [
      this.tooltipBackground,
      this.tooltipText,
      this.tooltipNameRow,
      this.tooltipMetaContainer,
      this.tooltipDescriptionText,
    ]);
    this.tooltipContainer.setDepth(1000);
  }

  private renderItemTooltipMeta(
    item: Item,
    count: number,
    container: Phaser.GameObjects.Container,
  ) {
    container.removeAll(true);
    let x = 0;

    if (item.isUnique) {
      const uniqueText = this.add.text(x, 0, "ユニーク", {
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
      const totalUseCount = item.useCount * count;
      const useText = this.add.text(x, 0, `使用回数 ${totalUseCount}`, {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "800",
        stroke: "#050507",
        strokeThickness: 3,
      });
      container.add(useText);
    }
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

  private hideItemTooltip() {
    this.tooltipContainer?.setVisible(false);
  }

  private buyItem(item: Item) {
    const price = this.getItemPrice(item);
    if (this.money < price) return;

    this.money -= price;
    this.ownedItemCodes.push(item.code);
    if (item.code === ItemCode.DiscountTicket) {
      this.rerollCost = this.getBaseRerollCost();
    }
    this.moneyText?.setText(`$ ${this.money}`);
    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    billiards.events.emit("purchase-item", item.code, price);
    this.playPurchaseSound();
    this.currentStock = this.currentStock.filter(
      (stockItem) => stockItem.code !== item.code,
    );
    this.setStockScroll(this.stockScrollY);
    this.renderStock();
    this.renderOwnedItems();
    this.updateRerollButton();
  }

  private rerollStock() {
    if (this.money < this.rerollCost) return;

    const cost = this.rerollCost;
    this.money -= cost;
    this.rerollCost *= 2;
    this.moneyText?.setText(`$ ${this.money}`);

    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    billiards.events.emit("spend-money", cost);
    this.playPurchaseSound();
    this.refreshStock({
      includeNewArrivals: false,
      includeSaleGuarantees: false,
    });
  }

  private playPurchaseSound() {
    this.sound.play(PURCHASE_SFX_KEY, { volume: getSfxVolume() });
  }

  private playWelcomeSound() {
    this.sound.play(WELCOME_SFX_KEY, { volume: getSfxVolume() });
  }

  private updateRerollButton() {
    this.rerollButton?.setLabel(this.getRerollLabel());
    this.rerollButton?.setEnabled(this.money >= this.rerollCost);
  }

  private getBaseRerollCost(): number {
    return this.ownedItemCodes.includes(ItemCode.DiscountTicket)
      ? DISCOUNTED_REROLL_COST
      : DEFAULT_REROLL_COST;
  }

  private getRerollLabel(): string {
    return `リロール (${this.rerollCost}$)`;
  }

  private nextStage() {
    if (this.transitioning) return;

    this.transitioning = true;
    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    this.scene.setVisible(true, BILLIARDS_SCENE_KEY);
    this.scene.resume(BILLIARDS_SCENE_KEY);
    billiards.events.emit("advance-stage");
    this.scene.stop();
  }

  private openMenu() {
    this.scene.launch("MenuScene", {
      currentStageNumber: this.afterStageNumber + 1,
      resumeSceneKey: this.scene.key,
    });
    this.scene.bringToTop("MenuScene");
    this.scene.pause();
  }

  private showShopDialogue() {
    if (isDialogueSkipEnabled()) {
      this.playWelcomeSound();
      return;
    }

    const messages = getShopDialogue(this.afterStageNumber);
    if (!messages || messages.length === 0) {
      this.playWelcomeSound();
      return;
    }

    this.events.once(Phaser.Scenes.Events.RESUME, () =>
      this.playWelcomeSound(),
    );
    this.scene.launch(DIALOGUE_SCENE_KEY, {
      messages,
      resumeSceneKey: this.scene.key,
      speakerName: NAVIGATOR_NAME,
    });
    this.scene.bringToTop(DIALOGUE_SCENE_KEY);
  }

  private addStockObject<T extends Phaser.GameObjects.GameObject>(
    object: T,
  ): T {
    const maskable = object as T & {
      setMask?: (mask: Phaser.Display.Masks.GeometryMask) => T;
    };
    if (this.stockMask && maskable.setMask) {
      maskable.setMask(this.stockMask);
    }
    this.stockObjects.push(object);
    return object;
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

  private updateStockMetrics() {
    const rowCount = Math.ceil(this.currentStock.length / STOCK_COLUMNS);
    this.stockContentHeight =
      rowCount === 0
        ? 0
        : STOCK_CARD_START_Y -
          STOCK_VIEWPORT.y +
          (rowCount - 1) * STOCK_ROW_GAP +
          STOCK_CARD_HEIGHT +
          24;
    this.stockScrollY = Phaser.Math.Clamp(
      this.stockScrollY,
      0,
      this.getMaxStockScroll(),
    );
  }

  private getMaxStockScroll(): number {
    return Math.max(0, this.stockContentHeight - STOCK_VIEWPORT.height);
  }

  private setStockScroll(scrollY: number) {
    const nextScrollY = Phaser.Math.Clamp(scrollY, 0, this.getMaxStockScroll());
    if (nextScrollY === this.stockScrollY) return;

    this.stockScrollY = nextScrollY;
    this.renderStock();
  }

  private isPointerInStockArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= STOCK_VIEWPORT.x &&
      pointer.x <= STOCK_VIEWPORT.x + STOCK_VIEWPORT.width &&
      pointer.y >= STOCK_VIEWPORT.y &&
      pointer.y <= STOCK_VIEWPORT.y + STOCK_VIEWPORT.height
    );
  }

  private updateOwnedItemMetrics(itemCount: number) {
    const rowCount = Math.ceil(itemCount / OWNED_ITEM_COLUMNS);
    this.ownedItemContentHeight =
      rowCount === 0
        ? 0
        : OWNED_ITEM_START_Y -
          OWNED_ITEM_VIEWPORT.y +
          (rowCount - 1) * (OWNED_ITEM_CARD_SIZE + OWNED_ITEM_CARD_GAP) +
          OWNED_ITEM_CARD_SIZE +
          4;
    this.ownedItemScrollY = Phaser.Math.Clamp(
      this.ownedItemScrollY,
      0,
      this.getMaxOwnedItemScroll(),
    );
  }

  private getMaxOwnedItemScroll(): number {
    return Math.max(
      0,
      this.ownedItemContentHeight - OWNED_ITEM_VIEWPORT.height,
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
    this.renderOwnedItems();
  }

  private isPointerInOwnedItemArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= OWNED_ITEM_VIEWPORT.x &&
      pointer.x <= OWNED_ITEM_VIEWPORT.x + OWNED_ITEM_VIEWPORT.width &&
      pointer.y >= OWNED_ITEM_VIEWPORT.y &&
      pointer.y <= OWNED_ITEM_VIEWPORT.y + OWNED_ITEM_VIEWPORT.height
    );
  }

  private drawStockScrollbar() {
    if (!this.stockScrollbar) return;

    this.stockScrollbar.clear();
    const maxScroll = this.getMaxStockScroll();
    if (maxScroll <= 0) return;

    const trackX = STOCK_VIEWPORT.x + STOCK_VIEWPORT.width - 16;
    const trackY = STOCK_VIEWPORT.y + 18;
    const trackHeight = STOCK_VIEWPORT.height - 36;
    const thumbHeight = Math.max(
      42,
      (STOCK_VIEWPORT.height / this.stockContentHeight) * trackHeight,
    );
    const thumbY =
      trackY + (this.stockScrollY / maxScroll) * (trackHeight - thumbHeight);

    this.stockScrollbar.fillStyle(0x030604, 0.42);
    this.stockScrollbar.fillRoundedRect(trackX, trackY, 7, trackHeight, 4);
    this.stockScrollbar.fillStyle(0xffef9c, 0.78);
    this.stockScrollbar.fillRoundedRect(trackX - 1, thumbY, 9, thumbHeight, 5);
  }

  private drawOwnedItemScrollbar() {
    if (!this.ownedItemScrollbar) return;

    this.ownedItemScrollbar.clear();
    const maxScroll = this.getMaxOwnedItemScroll();
    if (maxScroll <= 0) return;

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

    this.ownedItemScrollbar.fillStyle(0x030604, 0.46);
    this.ownedItemScrollbar.fillRoundedRect(trackX, trackY, 5, trackHeight, 3);
    this.ownedItemScrollbar.fillStyle(0xffef9c, 0.78);
    this.ownedItemScrollbar.fillRoundedRect(trackX, thumbY, 5, thumbHeight, 3);
  }
}
