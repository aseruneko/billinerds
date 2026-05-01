import Phaser from "phaser";
import type { Ball } from "../Ball";
import { useActiveItem, type TargetedItemMode } from "../items/useActiveItem";
import {
  ItemCode,
  Items,
  type Item,
  type ItemCode as ItemCodeType,
} from "../shop/item/Item";
import { type TextCodeType } from "../../../text/TextDictionary";

type RunState = "aiming" | "rolling" | "enemy" | "hazard" | "cleared" | "failed";
type TargetedItemModeState = TargetedItemMode | null;
type MarkerItemMode = Extract<TargetedItemMode, "blast" | "repulse" | "attract">;
type MarkerPreviewRadii = Record<MarkerItemMode, number>;

type PlayerActionContext = {
  getState: () => RunState;
  setState: (state: RunState) => void;
  getCharging: () => boolean;
  setCharging: (charging: boolean) => void;
  getBalls: () => Ball[];
  getCueBall: () => Ball | null;
  getItemUsesRemaining: (itemCode: ItemCodeType) => number;
  consumeItemUse: (item: Item) => boolean;
  updateHud: (status?: string) => void;
  showStatusSplash: (label: string) => void;
  isPointerInControlArea: (pointer: Phaser.Input.Pointer) => boolean;
  canPlaceBallAt: (ball: Ball, x: number, y: number) => boolean;
  getBallDisplayName: (ball: Ball) => string;
  resizeBall: (ball: Ball, radiusScale: number, weightScale: number) => void;
  activateBlastMarker: (center: Phaser.Math.Vector2) => void;
  activateRepulseMarker: (center: Phaser.Math.Vector2) => void;
  activateAttractMarker: (center: Phaser.Math.Vector2) => void;
  relocateCueBall: (cueBall: Ball, x: number, y: number) => void;
  tiltTable: () => void;
  gatherBalls: () => void;
  getCueBallMissingHp: () => number;
  healCueBall: (amount: number) => void;
  canActivateTemporaryCueGrowth: () => boolean;
  activateTemporaryCueGrowth: () => void;
  canActivateTemporaryCueWeight: () => boolean;
  activateTemporaryCueWeight: () => void;
  canActivateTemporaryCuePhase: () => boolean;
  activateTemporaryCuePhase: () => void;
  slowAllBalls: (scale: number) => void;
  addBackspinShot: () => void;
  addPenaltyWaiver: () => void;
  damageTargetBalls: (amount: number, reason: TextCodeType | string) => void;
  endPlayerTurn: () => void;
};

export class PlayerActionController {
  private dragMode = false;
  private magnifyMode = false;
  private minifyMode = false;
  private targetedItemMode: TargetedItemModeState = null;
  private targetedItemCode: ItemCodeType | null = null;
  private draggedBall: Ball | null = null;
  private targetPreview?: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: PlayerActionContext,
    private readonly markerPreviewRadii: MarkerPreviewRadii,
  ) {}

  canUseOwnedItem(item: Item): boolean {
    if (item.useCount === undefined) return false;
    if (this.context.getState() !== "aiming") return false;
    if (
      item.code === ItemCode.GiantChalk &&
      !this.context.canActivateTemporaryCueGrowth()
    ) {
      return false;
    }
    if (
      item.code === ItemCode.HeavyCue &&
      !this.context.canActivateTemporaryCueWeight()
    ) {
      return false;
    }
    if (
      item.code === ItemCode.PhaseCue &&
      !this.context.canActivateTemporaryCuePhase()
    ) {
      return false;
    }
    if (
      this.context.getCharging() ||
      this.dragMode ||
      this.magnifyMode ||
      this.minifyMode ||
      this.targetedItemMode ||
      this.draggedBall
    ) {
      return false;
    }

    return this.context.getItemUsesRemaining(item.code) > 0;
  }

  useOwnedItem(item: Item) {
    if (!this.canUseOwnedItem(item)) return;

    useActiveItem(item, {
      consumeItemUse: (nextItem) => this.context.consumeItemUse(nextItem),
      tiltTable: () => this.context.tiltTable(),
      gatherBalls: () => this.context.gatherBalls(),
      getCueBallMissingHp: () => this.context.getCueBallMissingHp(),
      healCueBall: (amount) => this.context.healCueBall(amount),
      canActivateTemporaryCueGrowth: () =>
        this.context.canActivateTemporaryCueGrowth(),
      activateTemporaryCueGrowth: () =>
        this.context.activateTemporaryCueGrowth(),
      canActivateTemporaryCueWeight: () =>
        this.context.canActivateTemporaryCueWeight(),
      activateTemporaryCueWeight: () =>
        this.context.activateTemporaryCueWeight(),
      canActivateTemporaryCuePhase: () =>
        this.context.canActivateTemporaryCuePhase(),
      activateTemporaryCuePhase: () =>
        this.context.activateTemporaryCuePhase(),
      slowAllBalls: (scale) => this.context.slowAllBalls(scale),
      addBackspinShot: () => this.context.addBackspinShot(),
      addPenaltyWaiver: () => this.context.addPenaltyWaiver(),
      damageTargetBalls: (amount, reason) =>
        this.context.damageTargetBalls(amount, reason),
      endPlayerTurn: () => this.context.endPlayerTurn(),
      beginTargetedItemMode: (nextItem, mode) =>
        this.beginTargetedItemMode(nextItem, mode),
      showStatusSplash: (label) => this.context.showStatusSplash(label),
    });
  }

  handlePointerMove(pointer: Phaser.Input.Pointer) {
    this.moveDraggedBall(pointer);
    this.updateTargetPreview(pointer);
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.button === 2) {
      return this.cancelSelectableMode();
    }

    if (this.targetedItemMode) {
      this.handleTargetedItemPointerDown(pointer);
      return true;
    }
    if (this.magnifyMode) {
      this.handleMagnifyPointerDown(pointer);
      return true;
    }
    if (this.minifyMode) {
      this.handleMinifyPointerDown(pointer);
      return true;
    }
    if (this.dragMode) {
      this.handleDragPointerDown(pointer);
      return true;
    }

    return false;
  }

  reset() {
    this.cancelDraggedBall();
    this.dragMode = false;
    this.disableMagnifyMode();
    this.disableMinifyMode();
    this.disableTargetedItemMode();
  }

  clearTargetPreview() {
    this.targetPreview?.clear();
    this.targetPreview?.setVisible(false);
  }

  getDraggedBall(): Ball | null {
    return this.draggedBall;
  }

  isDragMode(): boolean {
    return this.dragMode;
  }

  isMagnifyMode(): boolean {
    return this.magnifyMode;
  }

  isMinifyMode(): boolean {
    return this.minifyMode;
  }

  hasTargetedItemMode(): boolean {
    return Boolean(this.targetedItemMode);
  }

  cancelSelectableMode(): boolean {
    if (this.targetedItemMode) {
      this.disableTargetedItemMode();
      this.context.updateHud("Ready");
      return true;
    }
    if (this.magnifyMode) {
      this.disableMagnifyMode();
      this.context.updateHud("Ready");
      return true;
    }
    if (this.minifyMode) {
      this.disableMinifyMode();
      this.context.updateHud("Ready");
      return true;
    }
    if (this.dragMode) {
      this.cancelDraggedBall();
      this.dragMode = false;
      this.context.updateHud("Ready");
      return true;
    }

    return false;
  }

  isIdleForTooltip(): boolean {
    return (
      !this.dragMode &&
      !this.magnifyMode &&
      !this.minifyMode &&
      !this.targetedItemMode
    );
  }

  private beginTargetedItemMode(item: Item, mode: TargetedItemMode) {
    this.targetedItemMode = mode;
    this.targetedItemCode = item.code;
    this.context.setCharging(false);
    if (mode === "blast" || mode === "repulse" || mode === "attract") {
      this.updateTargetPreview(this.scene.input.activePointer);
      return;
    }
    if (mode === "relocateCue") {
      this.updateTargetPreview(this.scene.input.activePointer);
      return;
    }
  }

  private disableTargetedItemMode() {
    this.targetedItemMode = null;
    this.targetedItemCode = null;
    this.clearTargetPreview();
  }

  private handleTargetedItemPointerDown(pointer: Phaser.Input.Pointer) {
    if (
      this.context.getState() !== "aiming" ||
      !this.targetedItemMode ||
      this.targetedItemCode === null
    ) {
      this.disableTargetedItemMode();
      return;
    }

    const item = Items.find(
      (candidate) => candidate.code === this.targetedItemCode,
    );
    if (!item || this.context.getItemUsesRemaining(item.code) <= 0) {
      this.disableTargetedItemMode();
      return;
    }

    if (
      this.targetedItemMode === "blast" ||
      this.targetedItemMode === "repulse" ||
      this.targetedItemMode === "attract"
    ) {
      this.handleBlastMarkerPointerDown(item, pointer);
      return;
    }
    if (this.targetedItemMode === "relocateCue") {
      this.handleCueRelocatorPointerDown(item, pointer);
      return;
    }

    const ball = this.findBallAtPointer(pointer);
    if (!ball) {
      return;
    }

    if (this.targetedItemMode === "growth") {
      this.context.resizeBall(ball, 1.2, 1.44);
    } else {
      this.context.resizeBall(ball, 0.8, 0.64);
    }
    this.context.consumeItemUse(item);
    this.disableTargetedItemMode();
  }

  private handleBlastMarkerPointerDown(
    item: Item,
    pointer: Phaser.Input.Pointer,
  ) {
    if (!this.context.isPointerInControlArea(pointer)) {
      this.updateTargetPreview(pointer);
      return;
    }

    if (!this.context.consumeItemUse(item)) {
      this.disableTargetedItemMode();
      return;
    }

    const center = new Phaser.Math.Vector2(pointer.x, pointer.y);
    if (item.code === ItemCode.RepulseMarker) {
      this.context.activateRepulseMarker(center);
    } else if (item.code === ItemCode.AttractMarker) {
      this.context.activateAttractMarker(center);
    } else {
      this.context.activateBlastMarker(center);
    }
    this.disableTargetedItemMode();
  }

  private handleCueRelocatorPointerDown(
    item: Item,
    pointer: Phaser.Input.Pointer,
  ) {
    const cueBall = this.context.getCueBall();
    if (!cueBall || cueBall.hp <= 0 || cueBall.pocketed) {
      this.disableTargetedItemMode();
      return;
    }

    if (!this.context.isPointerInControlArea(pointer)) {
      this.updateTargetPreview(pointer);
      return;
    }

    if (!this.context.canPlaceBallAt(cueBall, pointer.x, pointer.y)) {
      this.updateTargetPreview(pointer);
      return;
    }

    if (!this.context.consumeItemUse(item)) {
      this.disableTargetedItemMode();
      return;
    }

    this.context.relocateCueBall(cueBall, pointer.x, pointer.y);
    this.disableTargetedItemMode();
  }

  private toggleDragMode() {
    this.dragMode = !this.dragMode;
    if (this.dragMode) this.disableMagnifyMode();
    if (this.dragMode) this.disableMinifyMode();
    this.context.setCharging(false);

    if (!this.dragMode) {
      this.cancelDraggedBall();
      this.context.updateHud("Ready");
      return;
    }

    this.context.updateHud("Drag: pick a ball");
  }

  private toggleMagnifyMode() {
    this.magnifyMode = !this.magnifyMode;
    if (this.magnifyMode) {
      this.disableMinifyMode();
      this.dragMode = false;
      this.cancelDraggedBall();
    }

    this.context.setCharging(false);
    this.context.updateHud(this.magnifyMode ? "Magnify: pick a ball" : "Ready");
  }

  private disableMagnifyMode() {
    this.magnifyMode = false;
  }

  private toggleMinifyMode() {
    this.minifyMode = !this.minifyMode;
    if (this.minifyMode) {
      this.disableMagnifyMode();
      this.dragMode = false;
      this.cancelDraggedBall();
    }

    this.context.setCharging(false);
    this.context.updateHud(this.minifyMode ? "Minify: pick a ball" : "Ready");
  }

  private disableMinifyMode() {
    this.minifyMode = false;
  }

  private handleMagnifyPointerDown(pointer: Phaser.Input.Pointer) {
    const ball = this.findBallAtPointer(pointer);
    if (!ball) {
      this.context.updateHud("Magnify: no ball");
      return;
    }

    this.context.resizeBall(ball, 1.2, 1.44);
    this.disableMagnifyMode();
    this.context.updateHud(`Magnified ${this.context.getBallDisplayName(ball)}`);
  }

  private handleMinifyPointerDown(pointer: Phaser.Input.Pointer) {
    const ball = this.findBallAtPointer(pointer);
    if (!ball) {
      this.context.updateHud("Minify: no ball");
      return;
    }

    this.context.resizeBall(ball, 0.8, 0.64);
    this.disableMinifyMode();
    this.context.updateHud(`Minified ${this.context.getBallDisplayName(ball)}`);
  }

  private handleDragPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.draggedBall) {
      this.tryPlaceDraggedBall(pointer);
      return;
    }

    const ball = this.findBallAtPointer(pointer);
    if (!ball) {
      this.context.updateHud("Drag: no ball");
      return;
    }

    this.draggedBall = ball;
    this.context.setState("aiming");
    this.context.setCharging(false);
    ball.sprite.setVelocity(0, 0);
    ball.sprite.setAngularVelocity(0);
    ball.sprite.setSensor(true);
    ball.sprite.setAlpha(0.74);
    ball.label?.setAlpha(0.74);
    this.moveDraggedBall(pointer);
    this.context.updateHud("Drag: place ball");
  }

  private moveDraggedBall(pointer: Phaser.Input.Pointer) {
    if (!this.draggedBall) return;

    this.draggedBall.sprite.setPosition(pointer.x, pointer.y);
    this.draggedBall.sprite.setVelocity(0, 0);
    this.draggedBall.previousPosition.set(pointer.x, pointer.y);
    this.draggedBall.label?.setPosition(pointer.x, pointer.y);
  }

  private tryPlaceDraggedBall(pointer: Phaser.Input.Pointer) {
    const ball = this.draggedBall;
    if (!ball) return;

    if (!this.context.canPlaceBallAt(ball, pointer.x, pointer.y)) {
      this.moveDraggedBall(pointer);
      this.context.updateHud("Drag: blocked");
      return;
    }

    ball.sprite.setPosition(pointer.x, pointer.y);
    ball.sprite.setSensor(false);
    ball.sprite.setVelocity(0, 0);
    ball.sprite.setAngularVelocity(0);
    ball.sprite.setAlpha(1);
    ball.label?.setAlpha(1);
    ball.label?.setPosition(pointer.x, pointer.y);
    ball.previousPosition.set(pointer.x, pointer.y);
    this.draggedBall = null;
    this.dragMode = false;
    this.context.updateHud("Drag: placed");
  }

  private cancelDraggedBall() {
    if (!this.draggedBall) return;

    this.draggedBall.sprite.setSensor(false);
    this.draggedBall.sprite.setAlpha(1);
    this.draggedBall.label?.setAlpha(1);
    this.draggedBall = null;
  }

  private findBallAtPointer(pointer: Phaser.Input.Pointer): Ball | null {
    let nearest: Ball | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const ball of this.context.getBalls()) {
      if (ball.pocketed) continue;

      const distance = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        ball.sprite.x,
        ball.sprite.y,
      );
      if (distance > ball.radius + 5 || distance >= nearestDistance) continue;

      nearest = ball;
      nearestDistance = distance;
    }

    return nearest;
  }

  private updateTargetPreview(pointer: Phaser.Input.Pointer) {
    if (
      this.targetedItemMode === "blast" ||
      this.targetedItemMode === "repulse" ||
      this.targetedItemMode === "attract"
    ) {
      this.drawMarkerPreview(
        pointer,
        this.markerPreviewRadii[this.targetedItemMode],
      );
      return;
    }
    if (this.targetedItemMode === "relocateCue") {
      this.drawCueRelocatorPreview(pointer);
      return;
    }

    this.clearTargetPreview();
  }

  private drawMarkerPreview(pointer: Phaser.Input.Pointer, radius: number) {
    const preview = this.getTargetPreview();
    const isInside = this.context.isPointerInControlArea(pointer);
    const alpha = isInside ? 1 : 0.32;
    preview.clear();
    preview.fillStyle(0xff6f3c, 0.14 * alpha);
    preview.fillCircle(pointer.x, pointer.y, radius);
    preview.lineStyle(3, 0xffd071, 0.9 * alpha);
    preview.strokeCircle(pointer.x, pointer.y, radius);
    preview.lineStyle(1, 0xff3e5f, 0.82 * alpha);
    preview.strokeCircle(pointer.x, pointer.y, radius * 0.68);
    preview.fillStyle(0xffffff, 0.8 * alpha);
    preview.fillCircle(pointer.x, pointer.y, 4);
    preview.setVisible(true);
  }

  private drawCueRelocatorPreview(pointer: Phaser.Input.Pointer) {
    const preview = this.getTargetPreview();
    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      preview.clear();
      preview.setVisible(false);
      return;
    }

    const canPlace =
      this.context.isPointerInControlArea(pointer) &&
      this.context.canPlaceBallAt(cueBall, pointer.x, pointer.y);
    const fillColor = canPlace ? 0x88ffb0 : 0xff5f6d;
    const lineColor = canPlace ? 0xd8ffe3 : 0xffc0c8;
    const alpha = this.context.isPointerInControlArea(pointer) ? 1 : 0.36;

    preview.clear();
    preview.fillStyle(fillColor, 0.2 * alpha);
    preview.fillCircle(pointer.x, pointer.y, cueBall.radius);
    preview.lineStyle(3, lineColor, 0.9 * alpha);
    preview.strokeCircle(pointer.x, pointer.y, cueBall.radius);
    preview.lineStyle(1, 0x050507, 0.42 * alpha);
    preview.strokeCircle(pointer.x, pointer.y, cueBall.radius + 3);
    preview.setVisible(true);
  }

  private getTargetPreview(): Phaser.GameObjects.Graphics {
    if (!this.targetPreview) {
      this.targetPreview = this.scene.add.graphics();
      this.targetPreview.setDepth(39);
    }

    return this.targetPreview;
  }
}
