import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  POCKET_CAPTURE_RADIUS,
  POCKETS,
  TABLE,
} from "../../../config";
import type { Ball } from "../Ball";

const POCKET_DAMAGE = 50;

type TravelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type PocketSystemContext = {
  getBalls: () => Ball[];
  getDraggedBall: () => Ball | null;
  getWidePocketCount: () => number;
  getCuePocketDamage: () => number;
  getBallTravelBounds: (radius: number) => TravelBounds;
  canPlaceBallAt: (ball: Ball, x: number, y: number) => boolean;
  canCheckPockets: () => boolean;
  areBallsStopped: () => boolean;
  isRolling: () => boolean;
  onRespawnedWhileRollingStopped: () => void;
  playPocketSound: () => void;
  getDamageAfterTargetModifiers: (ball: Ball, damage: number) => number;
  showDamageSplashAt: (position: Phaser.Math.Vector2, damage: number) => void;
  onBallDamaged?: (ball: Ball) => void;
  onBallDefeated?: (ball: Ball) => void;
  disableBallPhysics: (ball: Ball) => void;
  enableBallPhysics: (ball: Ball) => void;
  updateHud: (status?: string) => void;
  failRun: () => void;
  completeStage: () => void;
  areAllTargetBallsDefeated: () => boolean;
  getBallDisplayName: (ball: Ball) => string;
};

export class PocketSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Graphics,
    private readonly context: PocketSystemContext,
  ) {}

  drawPockets() {
    this.layer.clear();

    for (const pocket of POCKETS) {
      this.layer.fillStyle(0x000000, 1);
      this.layer.fillCircle(pocket.x, pocket.y, this.getPocketVisualRadius());
    }
  }

  checkPockets() {
    if (!this.context.canCheckPockets()) return;

    for (const ball of this.context.getBalls()) {
      if (ball.pocketed || ball === this.context.getDraggedBall()) continue;
      if (this.scene.time.now < ball.pocketImmuneUntil) continue;

      for (const pocket of POCKETS) {
        const distance = Phaser.Math.Distance.Between(
          ball.sprite.x,
          ball.sprite.y,
          pocket.x,
          pocket.y,
        );
        const captureRadius = this.getPocketCaptureRadius(ball);
        if (distance <= captureRadius) {
          this.pocketBall(ball);
          if (!this.context.canCheckPockets()) return;
          break;
        }
      }
    }
  }

  moveBallOutOfPockets(ball: Ball) {
    for (const pocket of POCKETS) {
      const captureRadius = this.getPocketCaptureRadius(ball);
      const distance = Phaser.Math.Distance.Between(
        ball.sprite.x,
        ball.sprite.y,
        pocket.x,
        pocket.y,
      );
      if (distance > captureRadius + 2) continue;

      const direction = new Phaser.Math.Vector2(
        ball.sprite.x - pocket.x,
        ball.sprite.y - pocket.y,
      );
      if (direction.lengthSq() < 0.001) {
        direction.set(
          ball.sprite.x - GAME_WIDTH / 2,
          ball.sprite.y - GAME_HEIGHT / 2,
        );
      }
      if (direction.lengthSq() < 0.001) direction.set(1, 0);
      direction.normalize();

      const targetDistance = captureRadius + 3;
      ball.sprite.setPosition(
        pocket.x + direction.x * targetDistance,
        pocket.y + direction.y * targetDistance,
      );

      const bounds = this.context.getBallTravelBounds(ball.radius);
      ball.sprite.setPosition(
        Phaser.Math.Clamp(ball.sprite.x, bounds.minX, bounds.maxX),
        Phaser.Math.Clamp(ball.sprite.y, bounds.minY, bounds.maxY),
      );
    }
  }

  isPositionInPocket(ball: Ball, x: number, y: number): boolean {
    return POCKETS.some(
      (pocket) =>
        Phaser.Math.Distance.Between(x, y, pocket.x, pocket.y) <=
        TABLE.pocketRadius + ball.radius,
    );
  }

  private getPocketVisualRadius(): number {
    return TABLE.pocketRadius * 1.1 ** this.context.getWidePocketCount();
  }

  private getPocketCaptureRadius(ball: Ball): number {
    if (ball.ballKind === "cue") return TABLE.pocketRadius - 2;

    return POCKET_CAPTURE_RADIUS * 1.1 ** this.context.getWidePocketCount();
  }

  private pocketBall(ball: Ball) {
    this.context.playPocketSound();
    const pocketedPosition = new Phaser.Math.Vector2(
      ball.sprite.x,
      ball.sprite.y,
    );
    const baseDamage = ball.ballKind === "cue"
      ? this.context.getCuePocketDamage()
      : POCKET_DAMAGE;
    const modifiedDamage = this.context.getDamageAfterTargetModifiers(
      ball,
      baseDamage,
    );
    const damage = Math.min(modifiedDamage, ball.hp);
    ball.hp = Math.max(0, ball.hp - modifiedDamage);
    this.context.onBallDamaged?.(ball);
    if (damage > 0) this.context.showDamageSplashAt(pocketedPosition, damage);
    ball.pocketed = true;
    this.context.disableBallPhysics(ball);
    ball.sprite.setVisible(false);
    ball.sprite.setPosition(-100, -100);
    ball.label?.setVisible(false);
    ball.previousPosition.set(-100, -100);

    if (ball.ballKind === "cue") {
      if (ball.hp <= 0) {
        this.context.failRun();
        return;
      }

      this.scene.time.delayedCall(450, () => this.respawnBall(ball));
      this.context.updateHud(`Cue pocketed -${damage} HP`);
      return;
    }

    if (ball.hp <= 0) {
      this.context.onBallDefeated?.(ball);
      if (this.context.areAllTargetBallsDefeated()) {
        this.context.completeStage();
        return;
      }

      this.context.updateHud(
        `Ball ${this.context.getBallDisplayName(ball)} defeated`,
      );
      return;
    }

    this.scene.time.delayedCall(450, () => this.respawnBall(ball));
    this.context.updateHud(
      `Ball ${this.context.getBallDisplayName(ball)} HP ${ball.hp}`,
    );
  }

  private respawnBall(ball: Ball) {
    if (ball.hp <= 0) return;

    const position = this.findRespawnPosition(ball);
    if (!position) {
      this.scene.time.delayedCall(300, () => this.respawnBall(ball));
      return;
    }

    ball.pocketed = false;
    ball.sprite.setVisible(true);
    ball.sprite.setPosition(position.x, position.y);
    ball.sprite.setVelocity(0, 0);
    ball.sprite.setAngularVelocity(0);
    ball.label?.setVisible(true);
    ball.label?.setPosition(position.x, position.y);
    ball.pocketImmuneUntil = this.scene.time.now + 700;
    ball.previousPosition.set(position.x, position.y);
    this.context.enableBallPhysics(ball);
    if (this.context.isRolling() && this.context.areBallsStopped()) {
      this.context.onRespawnedWhileRollingStopped();
    }
  }

  private findRespawnPosition(ball: Ball): Phaser.Math.Vector2 | null {
    const bounds = this.context.getBallTravelBounds(ball.radius);

    for (let i = 0; i < 160; i++) {
      const x = Phaser.Math.FloatBetween(bounds.minX, bounds.maxX);
      const y = Phaser.Math.FloatBetween(bounds.minY, bounds.maxY);
      if (this.context.canPlaceBallAt(ball, x, y)) {
        return new Phaser.Math.Vector2(x, y);
      }
    }

    return null;
  }
}
