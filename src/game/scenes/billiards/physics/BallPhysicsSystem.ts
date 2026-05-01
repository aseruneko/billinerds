import Phaser from "phaser";
import { BALL_FRICTION, STOP_SPEED } from "../../../config";
import type { Ball } from "../Ball";
import type { StageObstacle } from "../Stage";

type TravelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type BallPhysicsContext = {
  getBalls: () => Ball[];
  getDraggedBall: () => Ball | null;
  getBackspinBouncesRemaining: () => number;
  consumeBackspinBounce: () => void;
  getFrictionMultiplier: (ball: Ball) => number;
  getBallTravelBounds: (radius: number) => TravelBounds;
  getObstacles: () => StageObstacle[];
  playCollideSound: () => void;
  applyBallCollisionEffects: (
    a: Ball,
    b: Ball,
    position: Phaser.Math.Vector2,
  ) => void;
  canBallsCollide: (a: Ball, b: Ball) => boolean;
};

type SweptBallCollision = {
  time: number;
  normal: Phaser.Math.Vector2;
  aSweepVelocity: Phaser.Math.Vector2;
  bSweepVelocity: Phaser.Math.Vector2;
};

export class BallPhysicsSystem {
  constructor(private readonly context: BallPhysicsContext) {}

  resolveContinuousBallCollisions() {
    const balls = this.context.getBalls();
    const draggedBall = this.context.getDraggedBall();

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed || a === draggedBall) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed || b === draggedBall) continue;
        if (!this.context.canBallsCollide(a, b)) continue;

        const hit = this.findSweptBallCollision(a, b, a.radius + b.radius);
        if (!hit) continue;

        this.resolveSweptBallCollision(a, b, hit);
      }
    }
  }

  applyRollingFriction() {
    for (const ball of this.context.getBalls()) {
      if (ball.pocketed || ball === this.context.getDraggedBall()) continue;
      if (ball.property.fixed) {
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        continue;
      }

      const body = ball.sprite.body as MatterJS.BodyType;
      const velocity = body.velocity;
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed < STOP_SPEED) {
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        continue;
      }

      const friction =
        BALL_FRICTION * this.context.getFrictionMultiplier(ball);
      ball.sprite.setVelocity(
        velocity.x * (1 - friction),
        velocity.y * (1 - friction),
      );
    }
  }

  keepBallsInsideTable() {
    const restitution =
      this.context.getBackspinBouncesRemaining() > 0 ? 1.02 : 0.92;

    for (const ball of this.context.getBalls()) {
      if (ball.pocketed || ball === this.context.getDraggedBall()) continue;
      if (ball.property.fixed) continue;

      const bounds = this.context.getBallTravelBounds(ball.radius);
      const body = ball.sprite.body as MatterJS.BodyType;
      let nextX = ball.sprite.x;
      let nextY = ball.sprite.y;
      let nextVelocityX = body.velocity.x;
      let nextVelocityY = body.velocity.y;
      const impactSpeed = Math.hypot(nextVelocityX, nextVelocityY);
      let escaped = false;

      if (nextX < bounds.minX) {
        nextX = bounds.minX;
        nextVelocityX = Math.abs(nextVelocityX) * restitution;
        escaped = true;
      } else if (nextX > bounds.maxX) {
        nextX = bounds.maxX;
        nextVelocityX = -Math.abs(nextVelocityX) * restitution;
        escaped = true;
      }

      if (nextY < bounds.minY) {
        nextY = bounds.minY;
        nextVelocityY = Math.abs(nextVelocityY) * restitution;
        escaped = true;
      } else if (nextY > bounds.maxY) {
        nextY = bounds.maxY;
        nextVelocityY = -Math.abs(nextVelocityY) * restitution;
        escaped = true;
      }

      if (!escaped) continue;

      if (this.context.getBackspinBouncesRemaining() > 0) {
        this.context.consumeBackspinBounce();
      }
      ball.sprite.setPosition(nextX, nextY);
      ball.sprite.setVelocity(nextVelocityX, nextVelocityY);
      if (impactSpeed > STOP_SPEED * 3) {
        this.context.playCollideSound();
      }
    }
  }

  keepBallsOutsideObstacles() {
    const obstacles = this.context.getObstacles();
    if (obstacles.length === 0) return;

    const restitution =
      this.context.getBackspinBouncesRemaining() > 0 ? 1.02 : 0.92;

    for (const ball of this.context.getBalls()) {
      if (ball.pocketed || ball === this.context.getDraggedBall()) continue;
      if (ball.property.fixed) continue;

      const hit = this.findNearestSweptObstacleCollision(ball, obstacles);
      if (!hit) continue;

      const velocity = (ball.sprite.body as MatterJS.BodyType).velocity;
      const speed = Math.hypot(velocity.x, velocity.y);
      const previous = ball.previousPosition;
      const current = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
      const impact = Phaser.Math.LinearXY(previous, current, hit.time);
      const offset = hit.normal.clone().scale(0.5);
      const reflectedVelocity = new Phaser.Math.Vector2(velocity.x, velocity.y)
        .subtract(hit.normal.clone().scale(2 * new Phaser.Math.Vector2(velocity.x, velocity.y).dot(hit.normal)))
        .scale(restitution);

      ball.sprite.setPosition(impact.x + offset.x, impact.y + offset.y);
      ball.sprite.setVelocity(reflectedVelocity.x, reflectedVelocity.y);

      if (this.context.getBackspinBouncesRemaining() > 0) {
        this.context.consumeBackspinBounce();
      }
      if (speed > STOP_SPEED * 3) {
        this.context.playCollideSound();
      }
    }
  }

  handleMatterCollisionStart(
    event: Phaser.Physics.Matter.Events.CollisionStartEvent,
  ) {
    for (const pair of event.pairs) {
      const ballA = this.getBallByMatterBody(pair.bodyA);
      const ballB = this.getBallByMatterBody(pair.bodyB);
      if (!ballA || !ballB) continue;
      if (ballA.pocketed || ballB.pocketed) continue;
      if (ballA.hp <= 0 || ballB.hp <= 0) continue;
      if (!this.context.canBallsCollide(ballA, ballB)) continue;

      this.context.playCollideSound();
      this.context.applyBallCollisionEffects(
        ballA,
        ballB,
        new Phaser.Math.Vector2(
          (ballA.sprite.x + ballB.sprite.x) / 2,
          (ballA.sprite.y + ballB.sprite.y) / 2,
        ),
      );
      return;
    }
  }

  areBallsStopped(): boolean {
    return this.context.getBalls().every((ball) => {
      if (ball.pocketed) return true;
      if (ball.property.fixed) return true;
      const velocity = (ball.sprite.body as MatterJS.BodyType).velocity;
      return Math.hypot(velocity.x, velocity.y) < STOP_SPEED;
    });
  }

  updatePreviousBallPositions() {
    for (const ball of this.context.getBalls()) {
      ball.previousPosition.set(ball.sprite.x, ball.sprite.y);
    }
  }

  private findSweptBallCollision(
    a: Ball,
    b: Ball,
    collisionRadius: number,
  ): SweptBallCollision | null {
    const previousDelta = a.previousPosition
      .clone()
      .subtract(b.previousPosition);
    const currentDelta = new Phaser.Math.Vector2(
      a.sprite.x - b.sprite.x,
      a.sprite.y - b.sprite.y,
    );
    const travelDelta = currentDelta.clone().subtract(previousDelta);
    const aSweepVelocity = new Phaser.Math.Vector2(
      a.sprite.x - a.previousPosition.x,
      a.sprite.y - a.previousPosition.y,
    );
    const bSweepVelocity = new Phaser.Math.Vector2(
      b.sprite.x - b.previousPosition.x,
      b.sprite.y - b.previousPosition.y,
    );

    const radiusSquared = collisionRadius ** 2;
    if (previousDelta.lengthSq() <= radiusSquared) return null;

    const aCoef = travelDelta.lengthSq();
    if (aCoef <= 0.000001) return null;

    const bCoef = 2 * previousDelta.dot(travelDelta);
    if (bCoef >= 0) return null;

    const cCoef = previousDelta.lengthSq() - radiusSquared;
    const discriminant = bCoef ** 2 - 4 * aCoef * cCoef;
    if (discriminant < 0) return null;

    const time = (-bCoef - Math.sqrt(discriminant)) / (2 * aCoef);
    if (time < 0.001 || time > 1) return null;

    const normal = previousDelta.add(travelDelta.scale(time)).normalize();
    if (normal.lengthSq() <= 0.000001) return null;

    return { time, normal, aSweepVelocity, bSweepVelocity };
  }

  private findNearestSweptObstacleCollision(
    ball: Ball,
    obstacles: StageObstacle[],
  ): { time: number; normal: Phaser.Math.Vector2 } | null {
    let nearest: { time: number; normal: Phaser.Math.Vector2 } | null = null;
    for (const obstacle of obstacles) {
      const hit = this.findSweptObstacleCollision(ball, obstacle);
      if (!hit) continue;
      if (!nearest || hit.time < nearest.time) nearest = hit;
    }
    return nearest;
  }

  private findSweptObstacleCollision(
    ball: Ball,
    obstacle: StageObstacle,
  ): { time: number; normal: Phaser.Math.Vector2 } | null {
    const start = ball.previousPosition;
    const end = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
    const delta = end.clone().subtract(start);
    if (delta.lengthSq() <= 0.000001) return null;

    const bounds = getObstacleBounds(obstacle, ball.radius);
    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;

    if (
      start.x >= minX &&
      start.x <= maxX &&
      start.y >= minY &&
      start.y <= maxY
    ) {
      return this.findObstacleOverlapNormal(end, minX, maxX, minY, maxY);
    }

    let entryTime = 0;
    let exitTime = 1;
    let normal = new Phaser.Math.Vector2(0, 0);

    if (Math.abs(delta.x) < 0.000001) {
      if (start.x < minX || start.x > maxX) return null;
    } else {
      const inverse = 1 / delta.x;
      const t1 = (minX - start.x) * inverse;
      const t2 = (maxX - start.x) * inverse;
      const axisEntry = Math.min(t1, t2);
      const axisExit = Math.max(t1, t2);
      if (axisEntry > entryTime) {
        entryTime = axisEntry;
        normal = new Phaser.Math.Vector2(delta.x > 0 ? -1 : 1, 0);
      }
      exitTime = Math.min(exitTime, axisExit);
    }

    if (Math.abs(delta.y) < 0.000001) {
      if (start.y < minY || start.y > maxY) return null;
    } else {
      const inverse = 1 / delta.y;
      const t1 = (minY - start.y) * inverse;
      const t2 = (maxY - start.y) * inverse;
      const axisEntry = Math.min(t1, t2);
      const axisExit = Math.max(t1, t2);
      if (axisEntry > entryTime) {
        entryTime = axisEntry;
        normal = new Phaser.Math.Vector2(0, delta.y > 0 ? -1 : 1);
      }
      exitTime = Math.min(exitTime, axisExit);
    }

    if (entryTime > exitTime || entryTime < 0.001 || entryTime > 1) {
      return null;
    }

    return { time: entryTime, normal };
  }

  private findObstacleOverlapNormal(
    point: Phaser.Math.Vector2,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): { time: number; normal: Phaser.Math.Vector2 } | null {
    const distances = [
      { distance: Math.abs(point.x - minX), normal: new Phaser.Math.Vector2(-1, 0) },
      { distance: Math.abs(maxX - point.x), normal: new Phaser.Math.Vector2(1, 0) },
      { distance: Math.abs(point.y - minY), normal: new Phaser.Math.Vector2(0, -1) },
      { distance: Math.abs(maxY - point.y), normal: new Phaser.Math.Vector2(0, 1) },
    ].sort((a, b) => a.distance - b.distance);
    return { time: 0, normal: distances[0].normal };
  }

  private resolveSweptBallCollision(
    a: Ball,
    b: Ball,
    hit: SweptBallCollision,
  ) {
    const aImpact = Phaser.Math.LinearXY(
      a.previousPosition,
      new Phaser.Math.Vector2(a.sprite.x, a.sprite.y),
      hit.time,
    );
    const bImpact = Phaser.Math.LinearXY(
      b.previousPosition,
      new Phaser.Math.Vector2(b.sprite.x, b.sprite.y),
      hit.time,
    );
    const separation = hit.normal.clone().scale(0.25);

    if (!a.property.fixed) {
      a.sprite.setPosition(aImpact.x + separation.x, aImpact.y + separation.y);
    }
    if (!b.property.fixed) {
      b.sprite.setPosition(bImpact.x - separation.x, bImpact.y - separation.y);
    }

    const aVelocity = hit.aSweepVelocity;
    const bVelocity = hit.bSweepVelocity;
    const relativeVelocity = new Phaser.Math.Vector2(
      aVelocity.x - bVelocity.x,
      aVelocity.y - bVelocity.y,
    );
    const closingSpeed = relativeVelocity.dot(hit.normal);
    if (closingSpeed >= 0) return;
    this.context.playCollideSound();
    this.context.applyBallCollisionEffects(a, b, midpoint(aImpact, bImpact));

    const restitution = 0.96;
    const inverseMassA = a.property.fixed ? 0 : 1 / a.weight;
    const inverseMassB = b.property.fixed ? 0 : 1 / b.weight;
    if (inverseMassA + inverseMassB <= 0) return;
    const impulse =
      (-(1 + restitution) * closingSpeed) / (inverseMassA + inverseMassB);
    const impulseVector = hit.normal.clone().scale(impulse);

    if (!a.property.fixed) {
      a.sprite.setVelocity(
        aVelocity.x + impulseVector.x * inverseMassA,
        aVelocity.y + impulseVector.y * inverseMassA,
      );
    }
    if (!b.property.fixed) {
      b.sprite.setVelocity(
        bVelocity.x - impulseVector.x * inverseMassB,
        bVelocity.y - impulseVector.y * inverseMassB,
      );
    }
  }

  private getBallByMatterBody(body: MatterJS.BodyType): Ball | null {
    return (
      this.context.getBalls().find((ball) => {
        const spriteBody = ball.sprite.body as MatterJS.BodyType;
        return (
          spriteBody === body ||
          spriteBody.parts?.includes(body) ||
          body.parent === spriteBody
        );
      }) ?? null
    );
  }
}

function midpoint(
  a: Phaser.Types.Math.Vector2Like,
  b: Phaser.Types.Math.Vector2Like,
): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
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
