import Phaser from "phaser";
import { POWER_CHARGE_MS } from "../../../config";
import type { Ball } from "../Ball";
import type { StageObstacle } from "../Stage";

type TravelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type PredictionHit =
  | {
      type: "ball";
      point: Phaser.Math.Vector2;
      distance: number;
      targetCenter: Phaser.Math.Vector2;
      targetDirection: Phaser.Math.Vector2;
      targetLineLength: number;
    }
  | {
      type: "wall";
      point: Phaser.Math.Vector2;
      distance: number;
      normal: Phaser.Math.Vector2;
    };
type PredictionWallHit = Extract<PredictionHit, { type: "wall" }>;

type PredictionContext = {
  getBalls: () => Ball[];
  getObstacles: () => StageObstacle[];
  getCueBall: () => Ball | null;
  getPointerWorld: () => Phaser.Math.Vector2;
  getPointerInControlArea: () => boolean;
  getCharging: () => boolean;
  getChargeStartedAt: () => number;
  getState: () => string;
  isDragMode: () => boolean;
  isMagnifyMode: () => boolean;
  isMinifyMode: () => boolean;
  hasTargetedItemMode: () => boolean;
  getBallTravelBounds: (radius: number) => TravelBounds;
  drawPowerRing: (cueBall: Ball | null, ratio: number, visible: boolean) => void;
};

export class PredictionSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly graphics: Phaser.GameObjects.Graphics,
    private readonly context: PredictionContext,
  ) {}

  draw() {
    this.graphics.clear();

    const ratio = this.context.getCharging()
      ? Phaser.Math.Clamp(
          (this.scene.time.now - this.context.getChargeStartedAt()) /
            POWER_CHARGE_MS,
          0,
          1,
        )
      : 0;
    const cueBall = this.context.getCueBall();
    const cue = cueBall?.sprite;
    const canAim =
      Boolean(cueBall && cue) &&
      this.context.getState() === "aiming" &&
      !this.context.isDragMode() &&
      !this.context.isMagnifyMode() &&
      !this.context.isMinifyMode() &&
      !this.context.hasTargetedItemMode() &&
      this.context.getPointerInControlArea();
    this.context.drawPowerRing(
      cueBall ?? null,
      ratio,
      canAim && this.context.getCharging(),
    );

    if (!cueBall || !cue || !canAim) return;

    const pointerWorld = this.context.getPointerWorld();
    const direction = new Phaser.Math.Vector2(
      cue.x - pointerWorld.x,
      cue.y - pointerWorld.y,
    );
    if (direction.length() > 8) {
      direction.normalize();
      this.drawPredictionLine(
        new Phaser.Math.Vector2(cue.x, cue.y),
        direction,
        cueBall.radius,
      );
      this.graphics.lineStyle(2, 0xffffff, 0.22);
      this.graphics.lineBetween(cue.x, cue.y, pointerWorld.x, pointerWorld.y);
    }
  }

  private drawPredictionLine(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    movingRadius: number,
  ) {
    const predictionDistance = this.getPredictionDistance();
    const firstHit = this.findPredictionHit(
      origin,
      direction,
      predictionDistance,
      movingRadius,
    );
    const firstEnd =
      firstHit?.point ??
      origin.clone().add(direction.clone().scale(predictionDistance));

    this.graphics.lineStyle(
      3,
      0xfff0a0,
      this.context.getCharging() ? 1 : 0.62,
    );
    this.graphics.lineBetween(origin.x, origin.y, firstEnd.x, firstEnd.y);

    if (firstHit?.type === "ball") {
      this.drawTargetPrediction(firstHit);
      return;
    }

    if (!firstHit || firstHit.type !== "wall") return;

    const reflected = direction
      .clone()
      .subtract(
        firstHit.normal.clone().scale(2 * direction.dot(firstHit.normal)),
      )
      .normalize();
    const secondOrigin = firstHit.point.clone().add(reflected.clone().scale(1));
    const secondHit = this.findPredictionHit(
      secondOrigin,
      reflected,
      520,
      movingRadius,
    );
    const secondEnd =
      secondHit?.point ?? secondOrigin.clone().add(reflected.clone().scale(520));

    this.graphics.lineStyle(3, 0x8cf0bd, 0.42);
    this.graphics.lineBetween(
      firstHit.point.x,
      firstHit.point.y,
      secondEnd.x,
      secondEnd.y,
    );
    if (secondHit?.type === "ball") {
      this.drawTargetPrediction(secondHit, 0.5);
    }
  }

  private drawTargetPrediction(
    hit: Extract<PredictionHit, { type: "ball" }>,
    alpha = 0.78,
  ) {
    const targetEnd = hit.targetCenter
      .clone()
      .add(
        hit.targetDirection
          .clone()
          .scale(this.getTargetPredictionLength(hit.targetLineLength)),
      );
    this.graphics.lineStyle(3, 0xff6f91, alpha);
    this.graphics.lineBetween(
      hit.targetCenter.x,
      hit.targetCenter.y,
      targetEnd.x,
      targetEnd.y,
    );
    this.graphics.fillStyle(0xff6f91, alpha);
    this.graphics.fillCircle(targetEnd.x, targetEnd.y, 4);
  }

  private getPredictionDistance(): number {
    return 920;
  }

  private getTargetPredictionLength(baseLength: number): number {
    return baseLength;
  }

  private findPredictionHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    maxDistance: number,
    movingRadius: number,
  ): PredictionHit | null {
    let nearest: PredictionHit | null = null;
    const considerHit = (hit: PredictionHit | null) => {
      if (!hit || hit.distance < 0 || hit.distance > maxDistance) return;
      if (!nearest || hit.distance < nearest.distance) nearest = hit;
    };

    considerHit(this.findWallHit(origin, direction, movingRadius));
    for (const obstacle of this.context.getObstacles()) {
      considerHit(
        this.findObstacleHit(origin, direction, obstacle, movingRadius),
      );
    }

    for (const ball of this.context.getBalls()) {
      if (ball.pocketed || ball.ballKind === "cue") continue;
      considerHit(this.findBallHit(origin, direction, ball, movingRadius));
    }

    return nearest;
  }

  private findObstacleHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    obstacle: StageObstacle,
    movingRadius: number,
  ): PredictionHit | null {
    const bounds = getObstacleBounds(obstacle, movingRadius);
    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;

    let entryDistance = 0;
    let exitDistance = Number.POSITIVE_INFINITY;
    let normal = new Phaser.Math.Vector2(0, 0);

    if (Math.abs(direction.x) < 0.000001) {
      if (origin.x < minX || origin.x > maxX) return null;
    } else {
      const inverse = 1 / direction.x;
      const d1 = (minX - origin.x) * inverse;
      const d2 = (maxX - origin.x) * inverse;
      const axisEntry = Math.min(d1, d2);
      const axisExit = Math.max(d1, d2);
      if (axisEntry > entryDistance) {
        entryDistance = axisEntry;
        normal = new Phaser.Math.Vector2(direction.x > 0 ? -1 : 1, 0);
      }
      exitDistance = Math.min(exitDistance, axisExit);
    }

    if (Math.abs(direction.y) < 0.000001) {
      if (origin.y < minY || origin.y > maxY) return null;
    } else {
      const inverse = 1 / direction.y;
      const d1 = (minY - origin.y) * inverse;
      const d2 = (maxY - origin.y) * inverse;
      const axisEntry = Math.min(d1, d2);
      const axisExit = Math.max(d1, d2);
      if (axisEntry > entryDistance) {
        entryDistance = axisEntry;
        normal = new Phaser.Math.Vector2(0, direction.y > 0 ? -1 : 1);
      }
      exitDistance = Math.min(exitDistance, axisExit);
    }

    if (entryDistance > exitDistance || entryDistance <= 0.001) return null;

    return {
      type: "wall",
      point: origin.clone().add(direction.clone().scale(entryDistance)),
      distance: entryDistance,
      normal,
    };
  }

  private findWallHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    movingRadius: number,
  ): PredictionHit | null {
    const bounds = this.context.getBallTravelBounds(movingRadius);
    const hits: PredictionWallHit[] = [];
    const within = (value: number, min: number, max: number) =>
      value >= min - 0.001 && value <= max + 0.001;

    if (direction.x < -0.0001) {
      const distance = (bounds.minX - origin.x) / direction.x;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.y, bounds.minY, bounds.maxY)) {
        hits.push({
          type: "wall",
          point,
          distance,
          normal: new Phaser.Math.Vector2(1, 0),
        });
      }
    } else if (direction.x > 0.0001) {
      const distance = (bounds.maxX - origin.x) / direction.x;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.y, bounds.minY, bounds.maxY)) {
        hits.push({
          type: "wall",
          point,
          distance,
          normal: new Phaser.Math.Vector2(-1, 0),
        });
      }
    }

    if (direction.y < -0.0001) {
      const distance = (bounds.minY - origin.y) / direction.y;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.x, bounds.minX, bounds.maxX)) {
        hits.push({
          type: "wall",
          point,
          distance,
          normal: new Phaser.Math.Vector2(0, 1),
        });
      }
    } else if (direction.y > 0.0001) {
      const distance = (bounds.maxY - origin.y) / direction.y;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.x, bounds.minX, bounds.maxX)) {
        hits.push({
          type: "wall",
          point,
          distance,
          normal: new Phaser.Math.Vector2(0, -1),
        });
      }
    }

    const nearest = hits
      .filter((hit) => hit.distance > 0)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) return null;

    const cornerNormal = hits
      .filter((hit) => Math.abs(hit.distance - nearest.distance) < 0.001)
      .reduce(
        (normal, hit) => normal.add(hit.normal),
        new Phaser.Math.Vector2(0, 0),
      );
    if (cornerNormal.lengthSq() > 0) nearest.normal = cornerNormal.normalize();

    return nearest;
  }

  private findBallHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    ball: Ball,
    movingRadius: number,
  ): PredictionHit | null {
    const targetCenter = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
    const toTarget = targetCenter.clone().subtract(origin);
    const projectedDistance = toTarget.dot(direction);
    if (projectedDistance <= 0) return null;

    const closestPoint = origin
      .clone()
      .add(direction.clone().scale(projectedDistance));
    const missDistance = Phaser.Math.Distance.Between(
      closestPoint.x,
      closestPoint.y,
      ball.sprite.x,
      ball.sprite.y,
    );
    const collisionRadius = movingRadius + ball.radius;
    if (missDistance > collisionRadius) return null;

    const offset = Math.sqrt(collisionRadius ** 2 - missDistance ** 2);
    const distance = projectedDistance - offset;
    if (distance <= 0) return null;

    const cueCenterAtImpact = origin
      .clone()
      .add(direction.clone().scale(distance));
    const targetDirection = targetCenter
      .clone()
      .subtract(cueCenterAtImpact)
      .normalize();
    const impactStrength = Phaser.Math.Clamp(
      direction.dot(targetDirection),
      0,
      1,
    );

    return {
      type: "ball",
      point: cueCenterAtImpact,
      distance,
      targetCenter,
      targetDirection,
      targetLineLength: Phaser.Math.Linear(16, 112, impactStrength),
    };
  }
}

function getObstacleBounds(obstacle: StageObstacle, padding = 0) {
  if (obstacle.type === "pillar") {
    const half = obstacle.size / 2 + padding;
    return {
      minX: obstacle.x - half,
      maxX: obstacle.x + half,
      minY: obstacle.y - half,
      maxY: obstacle.y + half,
    };
  }

  return {
    minX: obstacle.x - obstacle.width / 2 - padding,
    maxX: obstacle.x + obstacle.width / 2 + padding,
    minY: obstacle.y - obstacle.height / 2 - padding,
    maxY: obstacle.y + obstacle.height / 2 + padding,
  };
}
