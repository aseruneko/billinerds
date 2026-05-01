import Phaser from "phaser";
import { GAME_FONT_FAMILY, GAME_WIDTH } from "../../../config";
import type { Ball } from "../Ball";
import {
  BallCode,
  BallProperties,
  type BallCode as BallCodeType,
} from "../BallProperty";
import {
  RouletteEffectCode,
  type RouletteHazard,
  type RouletteSegment,
} from "../Stage";

type RunState = "aiming" | "rolling" | "enemy" | "hazard" | "cleared" | "failed";

type TravelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type RouletteControllerContext = {
  getRoulettes: () => RouletteHazard[];
  getCueBall: () => Ball | null;
  getRouletteSegmentAtPoint: (
    roulette: RouletteHazard,
    x: number,
    y: number,
  ) => { segment: RouletteSegment; index: number } | null;
  drawRouletteSelection: (
    roulette: RouletteHazard,
    activeIndex?: number,
  ) => void;
  setState: (state: RunState) => void;
  getState: () => RunState;
  setCharging: (charging: boolean) => void;
  hideBallTooltip: () => void;
  clearTargetPreview: () => void;
  updateHud: (status?: string) => void;
  finishPostPlayerHazards: () => void;
  gainMoney: (amount: number, position: Phaser.Math.Vector2) => void;
  spawnEnemyBall: (code: BallCodeType, x: number, y: number) => boolean;
  getBallTravelBounds: (radius: number) => TravelBounds;
  canPlaceBallAt: (ball: Ball, x: number, y: number) => boolean;
  flashCueDamage: (ball: Ball) => void;
  showDamageSplashAt: (
    position: Phaser.Math.Vector2,
    damage: number,
    reason?: string,
  ) => void;
  showStatusSplash: (label: string) => void;
  resizeLivingBalls: (radiusScale: number, weightScale: number) => void;
  resolveDamageDefeats: () => void;
};

export class RouletteController {
  private pendingEvent?: Phaser.Time.TimerEvent;
  private actionWindow?: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: RouletteControllerContext,
  ) {}

  start(): boolean {
    const roulette = this.context.getRoulettes()[0];
    if (!roulette) return false;

    const cueBall = this.context.getCueBall();
    if (!cueBall || cueBall.pocketed || cueBall.hp <= 0) return false;

    const forced = this.context.getRouletteSegmentAtPoint(
      roulette,
      cueBall.sprite.x,
      cueBall.sprite.y,
    );
    const finalIndex =
      forced?.index ?? Phaser.Math.Between(0, roulette.segments.length - 1);
    const steps = Phaser.Math.Between(12, 18);
    const startIndex =
      (finalIndex - ((steps - 1) % roulette.segments.length) +
        roulette.segments.length) %
      roulette.segments.length;
    const sequence = Array.from(
      { length: steps },
      (_, index) => (startIndex + index) % roulette.segments.length,
    );

    this.context.setState("hazard");
    this.context.setCharging(false);
    this.context.hideBallTooltip();
    this.context.clearTargetPreview();
    this.context.updateHud("Roulette");

    let stepIndex = 0;
    const tick = () => {
      const activeIndex = sequence[stepIndex];
      this.context.drawRouletteSelection(roulette, activeIndex);
      stepIndex += 1;

      if (stepIndex >= sequence.length) {
        this.pendingEvent = this.scene.time.addEvent({
          delay: 420,
          callback: () => this.resolveRouletteEffect(roulette, finalIndex),
        });
        return;
      }

      this.pendingEvent = this.scene.time.addEvent({
        delay: 56 + stepIndex * 18,
        callback: tick,
      });
    };

    tick();
    return true;
  }

  clear() {
    this.clearPendingEvent();
    this.hideActionWindow();
  }

  private clearPendingEvent() {
    this.pendingEvent?.remove(false);
    this.pendingEvent = undefined;
  }

  private resolveRouletteEffect(roulette: RouletteHazard, index: number) {
    const segment = roulette.segments[index];
    this.showActionWindow(segment);
    this.pendingEvent = this.scene.time.addEvent({
      delay: 680,
      callback: () => {
        this.applyRouletteEffect(segment, roulette);
        if (
          this.context.getState() === "cleared" ||
          this.context.getState() === "failed"
        ) {
          return;
        }
        this.pendingEvent = this.scene.time.addEvent({
          delay: 280,
          callback: () => {
            this.hideActionWindow();
            this.context.drawRouletteSelection(roulette);
            if (this.context.getState() === "hazard") {
              this.context.finishPostPlayerHazards();
            }
          },
        });
      },
    });
  }

  private applyRouletteEffect(
    segment: RouletteSegment,
    roulette: RouletteHazard,
  ) {
    switch (segment.effect) {
      case RouletteEffectCode.spawnChips:
        this.spawnRouletteEnemies(BallCode.chip, 5, roulette);
        break;
      case RouletteEffectCode.spawnClub:
        this.spawnRouletteEnemies(BallCode.club, 1, roulette);
        break;
      case RouletteEffectCode.spawnSpade:
        this.spawnRouletteEnemies(BallCode.spade, 1, roulette);
        break;
      case RouletteEffectCode.spawnHeart:
        this.spawnRouletteEnemies(BallCode.heart, 1, roulette);
        break;
      case RouletteEffectCode.spawnDiamond:
        this.spawnRouletteEnemies(BallCode.diamond, 1, roulette);
        break;
      case RouletteEffectCode.gainMoney:
        this.context.gainMoney(
          25,
          new Phaser.Math.Vector2(roulette.x, roulette.y),
        );
        break;
      case RouletteEffectCode.cueDamage:
        this.damageCueFromRoulette(10);
        break;
      case RouletteEffectCode.growAll:
        this.context.resizeLivingBalls(1.2, 1.44);
        this.context.showStatusSplash("all balls grew");
        break;
      case RouletteEffectCode.shrinkAll:
        this.context.resizeLivingBalls(0.8, 0.64);
        this.context.showStatusSplash("all balls shrank");
        break;
      case RouletteEffectCode.nothing:
        this.context.showStatusSplash("nothing");
        break;
    }

    this.context.resolveDamageDefeats();
  }

  private spawnRouletteEnemies(
    code: BallCodeType,
    count: number,
    roulette: RouletteHazard,
  ) {
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      const position = this.findRandomEnemySpawnPosition(code, roulette);
      if (!position) continue;
      if (this.context.spawnEnemyBall(code, position.x, position.y)) {
        spawned += 1;
      }
    }

    this.context.showStatusSplash(
      spawned > 0 ? `spawn x${spawned}` : "spawn blocked",
    );
  }

  private findRandomEnemySpawnPosition(
    code: BallCodeType,
    roulette: RouletteHazard,
  ): Phaser.Math.Vector2 | null {
    const property = BallProperties[code];
    const proxy = {
      radius: property.initialRadius,
      pocketed: false,
    } as Ball;
    const bounds = this.context.getBallTravelBounds(property.initialRadius);

    for (let attempt = 0; attempt < 96; attempt += 1) {
      const x = Phaser.Math.Between(
        Math.ceil(bounds.minX),
        Math.floor(bounds.maxX),
      );
      const y = Phaser.Math.Between(
        Math.ceil(bounds.minY),
        Math.floor(bounds.maxY),
      );
      const distanceFromRoulette = Phaser.Math.Distance.Between(
        x,
        y,
        roulette.x,
        roulette.y,
      );
      if (distanceFromRoulette < roulette.radius + property.initialRadius + 6) {
        continue;
      }
      if (this.context.canPlaceBallAt(proxy, x, y)) {
        return new Phaser.Math.Vector2(x, y);
      }
    }

    return null;
  }

  private damageCueFromRoulette(amount: number) {
    const cueBall = this.context.getCueBall();
    if (!cueBall || cueBall.pocketed || cueBall.hp <= 0) return;

    const damage = Math.min(amount, cueBall.hp);
    cueBall.hp = Math.max(0, cueBall.hp - amount);
    this.context.flashCueDamage(cueBall);
    this.context.showDamageSplashAt(
      new Phaser.Math.Vector2(
        cueBall.sprite.x,
        cueBall.sprite.y - cueBall.radius - 12,
      ),
      damage,
      "roulette",
    );
    this.context.showStatusSplash("roulette hit");
  }

  private showActionWindow(segment: RouletteSegment) {
    this.hideActionWindow();

    const background = this.scene.add.graphics();
    background.fillStyle(0x12080a, 0.9);
    background.fillRoundedRect(-174, -44, 348, 88, 10);
    background.lineStyle(2, 0xffd06c, 0.86);
    background.strokeRoundedRect(-174, -44, 348, 88, 10);
    background.fillStyle(segment.color, 0.22);
    background.fillRoundedRect(-164, -34, 328, 20, 7);

    const nameText = this.scene.add
      .text(-154, -33, "ROULETTE", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "900",
      })
      .setOrigin(0, 0);

    const techniqueText = this.scene.add
      .text(-154, -8, segment.name, {
        color: "#ffe9dc",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "900",
      })
      .setOrigin(0, 0);

    const typeText = this.scene.add
      .text(-154, 18, segment.description, {
        color: "#f7c7d2",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "16px",
        fontStyle: "800",
      })
      .setOrigin(0, 0);

    this.actionWindow = this.scene.add.container(GAME_WIDTH / 2, 104, [
      background,
      nameText,
      techniqueText,
      typeText,
    ]);
    this.actionWindow.setDepth(225);
    this.actionWindow.setAlpha(0);
    this.actionWindow.setScale(0.96);

    this.scene.tweens.add({
      targets: this.actionWindow,
      alpha: 1,
      scale: 1,
      duration: 120,
      ease: "Back.Out",
    });
  }

  private hideActionWindow() {
    if (!this.actionWindow) return;

    this.scene.tweens.killTweensOf(this.actionWindow);
    this.actionWindow.destroy();
    this.actionWindow = undefined;
  }
}
