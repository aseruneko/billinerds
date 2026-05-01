import Phaser from "phaser";
import { GAME_FONT_FAMILY, GAME_WIDTH } from "../../../config";
import { TextCode, type TextCodeType } from "../../../text/TextDictionary";
import type { Ball } from "../Ball";
import {
  BallCode,
  BallSpecialActionCode,
  BallSpecialActions,
  type BallSpecialAction,
  type BallSpecialActionCode as BallSpecialActionCodeType,
} from "../BallProperty";
import type { StageObstacle } from "../Stage";

const ROOK_CHARGE_SPEED = 9;
const ENEMY_TURN_START_DELAY_MS = 900;
const ENEMY_ACTION_EDGE_WAIT_MS = 200;
const BISHOP_HEAL_AMOUNT = 15;
const BISHOP_HEAL_WAIT_MS = 650;
const HEART_HEAL_AMOUNT = 20;
const HEART_HEAL_WAIT_MS = 560;
const KING_COMMAND_SPEED = 5;
const KING_COMMAND_WAIT_MS = 700;
const ZOMBIE_COMMAND_SPEED = 5;
const ZOMBIE_COMMAND_WAIT_MS = 700;
const SOUL_COMMAND_SPEED = 5.2;
const CHARGE_POWER_MULTIPLIER = 2;
const HOLLOW_SUMMON_THRESHOLD = 3;
const HOLLOW_SUMMON_TARGET = 10;
const HOLLOW_SUMMON_WAIT_MS = 700;
const SOUL_SEAL_HEAL_AMOUNT = 5;
const SOUL_SEAL_HEAL_WAIT_MS = 560;
const KING_CHARGE_SPEED = 7;
const HOLLOW_CHARGE_SPEED = 6.2;
const SPADE_CHARGE_SPEED = 8.4;
const PHASE_ATTACK_SPEED = 8.2;
const MIRROR_STEP_SPEED = 3.8;
const MIRROR_STEP_BACK_DISTANCE = 88;
const MIRROR_STEP_WARP_WAIT_MS = 430;
const DIAMOND_LASER_AIM_MS = 450;
const DIAMOND_SHOT_WAIT_MS = 520;
const BREAK_DOWN_DAMAGE = 999;
const BREAK_DOWN_WAIT_MS = 650;
const BREAK_DOWN_CHARGE_MS = 650;
const BREAK_DOWN_CLEAR_DELAY_MS = 1400;
const CHIP_MULTIPLY_CHANCE = 0.3;
const CHIP_MULTIPLY_WAIT_MS = 520;
const CHIP_MULTIPLY_RING_MS = 620;
const CONFETTI_EXPLOSION_RADIUS = 90;
const CONFETTI_EXPLOSION_DAMAGE = 20;
const CONFETTI_EXPLOSION_FORCE = 1.6;
const CONFETTI_EXPLOSION_WAIT_MS = 560;
const JOKER_CONFETTI_SPAWN_RADIUS = 250;
const JOKER_CONFETTI_COUNT = 3;
const JOKER_RAISE_COUNT = 5;
const JOKER_SPAWN_WAIT_MS = 620;
const JOKER_CHIP_RAKE_SPEED = 7.2;
const DIAMOND_LASER_COLORS = {
  sight: 0xf8fbff,
  glow: 0xbfe4ff,
  bullet: 0xfff1a8,
  core: 0xffffff,
};
const WRAITH_LASER_COLORS = {
  sight: 0xffc4c4,
  glow: 0xff4148,
  bullet: 0xff4b4f,
  core: 0xfff0ec,
};

type LaserPalette = typeof DIAMOND_LASER_COLORS;

type TravelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type DiamondShotHit =
  | {
      type: "ball";
      point: Phaser.Math.Vector2;
      distance: number;
      target: Ball;
    }
  | {
      type: "wall";
      point: Phaser.Math.Vector2;
      distance: number;
    };

type PendingDiamondShot = {
  ball: Ball;
  direction: Phaser.Math.Vector2;
  hit: DiamondShotHit;
  readyAt: number;
};

type PendingBreakDown = {
  readyAt: number;
};

type PendingMirrorStep = {
  ball: Ball;
  readyAt: number;
};

type ResolveDamageOptions = {
  clearSceneDelayMs?: number;
};

type RadialVelocityOptions = {
  radius: number;
  minForce: number;
  maxForce: number;
  forceMultiplier: number;
  zeroDistanceBehavior?: "randomOutward" | "fixedOutward" | "none";
};

export type EnemyTurnUpdateResult = "running" | "completed" | "interrupted";

type QueuedAction = {
  ball: Ball;
  action: BallSpecialAction;
};

type EnemyTurnContext = {
  getBalls: () => Ball[];
  getCueBall: () => Ball | null;
  areBallsStopped: () => boolean;
  applyHazardStopDamage: () => boolean;
  getObstacles: () => StageObstacle[];
  getBallTravelBounds: (radius: number) => TravelBounds;
  canPlaceBallAt: (ball: Ball, x: number, y: number) => boolean;
  isBallPhasing: (ball: Ball) => boolean;
  getBallAttack: (ball: Ball) => number;
  getDamageAfterTargetModifiers: (ball: Ball, damage: number) => number;
  showDamageSplashAt: (
    position: Phaser.Math.Vector2,
    damage: number,
    reason?: TextCodeType | string,
  ) => void;
  showHealSplash: (position: Phaser.Math.Vector2, amount: number) => void;
  onBallDamaged: (ball: Ball) => void;
  resolveDamageDefeats: (options?: ResolveDamageOptions) => void;
  findChipMultiplyPosition: (source: Ball) => Phaser.Math.Vector2 | null;
  findRandomEnemySpawnPosition: (
    code: BallCode,
    options?: {
      minCueDistance?: number;
      center?: Phaser.Math.Vector2;
      maxDistanceFromCenter?: number;
    },
  ) => Phaser.Math.Vector2 | null;
  spawnEnemyBall: (code: BallCode, x: number, y: number) => Ball | null;
  playHealSound: () => void;
  playShotSound: () => void;
  playExplodeSound: () => void;
  playWarpSound: () => void;
  showExplosionAnimation: (
    center: Phaser.Math.Vector2,
    radius?: number,
  ) => void;
  applyRadialVelocity: (
    ball: Ball,
    center: Phaser.Math.Vector2,
    distance: number,
    options: RadialVelocityOptions,
  ) => boolean;
  setBallPhasing: (ball: Ball, active: boolean) => void;
  clearPhasingBalls: () => void;
  updateHud: (status?: string) => void;
};

export class EnemyTurnController {
  private actionQueue: QueuedAction[] = [];
  private activeBall: Ball | null = null;
  private activeAction: BallSpecialAction | null = null;
  private commandProtectedBalls = new Set<Ball>();
  private turnReadyAt = 0;
  private actionStartReadyAt = 0;
  private actionWaitUntil = 0;
  private actionRing: Phaser.GameObjects.Graphics;
  private diamondGraphics: Phaser.GameObjects.Graphics;
  private chipSpawnRing: Phaser.GameObjects.Graphics;
  private confettiRangeGraphics: Phaser.GameObjects.Graphics;
  private pendingDiamondShot: PendingDiamondShot | null = null;
  private pendingBreakDown: PendingBreakDown | null = null;
  private pendingMirrorStep: PendingMirrorStep | null = null;
  private chipMultiplyProtectedUntil = 0;
  private chipRakeProtectedBalls = new Set<Ball>();
  private turnBanner?: Phaser.GameObjects.Container;
  private actionWindow?: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: EnemyTurnContext,
  ) {
    this.actionRing = scene.add.graphics();
    this.actionRing.setDepth(38);
    this.diamondGraphics = scene.add.graphics();
    this.diamondGraphics.setDepth(224);
    this.chipSpawnRing = scene.add.graphics();
    this.chipSpawnRing.setDepth(39);
    this.confettiRangeGraphics = scene.add.graphics();
    this.confettiRangeGraphics.setDepth(18);
  }

  start(): boolean {
    this.actionQueue = this.getSpecialActionBalls();
    this.activeBall = null;
    this.activeAction = null;
    if (this.actionQueue.length === 0) return false;

    this.turnReadyAt = this.scene.time.now + ENEMY_TURN_START_DELAY_MS;
    this.actionStartReadyAt = 0;
    this.actionWaitUntil = 0;
    this.pendingDiamondShot = null;
    this.pendingBreakDown = null;
    this.pendingMirrorStep = null;
    this.clearTemporaryChipRake();
    this.showEnemyTurnBanner();
    this.context.updateHud("Enemy turn");
    return true;
  }

  update(): EnemyTurnUpdateResult {
    if (this.scene.time.now < this.turnReadyAt) return "running";

    if (this.actionStartReadyAt > 0) {
      if (this.scene.time.now < this.actionStartReadyAt) return "running";

      this.actionStartReadyAt = 0;
      if (this.activeBall && this.activeAction) {
        this.executeSpecialAction(this.activeBall, this.activeAction);
        return "running";
      }
    }

    if (this.pendingDiamondShot) {
      if (this.scene.time.now < this.pendingDiamondShot.readyAt) {
        return "running";
      }

      const shot = this.pendingDiamondShot;
      this.pendingDiamondShot = null;
      if (
        shot.ball.pocketed ||
        shot.ball.hp <= 0 ||
        this.activeBall !== shot.ball ||
        !this.isLaserShotAction(this.activeAction?.code)
      ) {
        this.clearDiamondGraphics();
        return "running";
      }

      this.fireDiamondShot(shot.ball, shot.direction, shot.hit);
      return "running";
    }

    if (this.pendingBreakDown) {
      if (this.scene.time.now < this.pendingBreakDown.readyAt) {
        return "running";
      }

      this.pendingBreakDown = null;
      this.applyBreakDownDamage();
      return "running";
    }

    if (this.pendingMirrorStep) {
      if (this.scene.time.now < this.pendingMirrorStep.readyAt) {
        return "running";
      }

      const step = this.pendingMirrorStep;
      this.pendingMirrorStep = null;
      this.fireMirrorStep(step.ball);
      return "running";
    }

    if (this.actionWaitUntil > 0) {
      if (this.scene.time.now < this.actionWaitUntil) return "running";

      this.actionWaitUntil = 0;
      this.clearTemporaryChipRake();
      this.clearActivePhasing();
      if (this.context.applyHazardStopDamage()) {
        this.commandProtectedBalls.clear();
        this.clearActionRing();
        return "interrupted";
      }
      this.activeBall = null;
      this.activeAction = null;
      this.commandProtectedBalls.clear();
      this.hideActionWindow();
      this.clearActionRing();
    }

    if (this.activeBall) {
      if (!this.context.areBallsStopped()) return "running";

      this.actionWaitUntil = this.scene.time.now + ENEMY_ACTION_EDGE_WAIT_MS;
      return "running";
    }

    if (this.activeAction) {
      if (!this.context.areBallsStopped()) return "running";

      this.clearTemporaryChipRake();
      this.clearActivePhasing();
      if (this.context.applyHazardStopDamage()) {
        this.commandProtectedBalls.clear();
        this.clearActionRing();
        return "interrupted";
      }
      this.activeBall = null;
      this.activeAction = null;
      this.commandProtectedBalls.clear();
      this.hideActionWindow();
      this.clearActionRing();
    }

    const next = this.actionQueue.shift();
    if (!next) {
      this.hideActionWindow();
      this.clearActionRing();
      return "completed";
    }

    if (
      next.ball.pocketed ||
      next.ball.hp <= 0 ||
      !this.canExecuteQueuedAction(next.ball, next.action)
    ) {
      return "running";
    }

    this.activeBall = next.ball;
    this.activeAction = next.action;
    this.drawActionRing();
    this.actionStartReadyAt = this.scene.time.now + ENEMY_ACTION_EDGE_WAIT_MS;
    return "running";
  }

  drawActionRing() {
    const ball = this.activeBall;
    if (!ball || ball.pocketed) {
      this.clearActionRing();
      return;
    }

    const pulse = (Math.sin(this.scene.time.now * 0.011) + 1) / 2;
    const radius = ball.radius + 8 + pulse * 4;
    this.actionRing.clear();
    this.actionRing.lineStyle(4, 0xff263c, 0.9);
    this.actionRing.strokeCircle(ball.sprite.x, ball.sprite.y, radius);
    this.actionRing.lineStyle(1, 0xfff0d6, 0.6);
    this.actionRing.strokeCircle(ball.sprite.x, ball.sprite.y, radius + 5);
  }

  clear() {
    this.actionQueue = [];
    this.activeBall = null;
    this.activeAction = null;
    this.commandProtectedBalls.clear();
    this.turnReadyAt = 0;
    this.actionStartReadyAt = 0;
    this.actionWaitUntil = 0;
    this.pendingDiamondShot = null;
    this.pendingBreakDown = null;
    this.pendingMirrorStep = null;
    this.clearActionRing();
    this.clearDiamondGraphics();
    this.clearChipSpawnRing();
    this.clearTemporaryChipRake();
    this.context.clearPhasingBalls();
    this.clearConfettiRanges();
    this.turnBanner?.destroy();
    this.turnBanner = undefined;
    this.hideActionWindow();
  }

  getActiveBall(): Ball | null {
    return this.activeBall;
  }

  isCommandProtectedBall(ball: Ball): boolean {
    return this.commandProtectedBalls.has(ball);
  }

  isActiveAction(ball: Ball, code: BallSpecialActionCodeType): boolean {
    return this.activeBall === ball && this.activeAction?.code === code;
  }

  isChipMultiplyProtected(ball: Ball): boolean {
    return (
      ball.code === BallCode.chip &&
      this.scene.time.now < this.chipMultiplyProtectedUntil
    );
  }

  isChipRakeProtected(ball: Ball): boolean {
    return this.chipRakeProtectedBalls.has(ball);
  }

  isMirrorStepProtected(ball: Ball): boolean {
    return (
      this.activeBall === ball &&
      this.activeAction?.code === BallSpecialActionCode.mirrorStep
    );
  }

  getTemporaryAttack(ball: Ball): number | null {
    return this.chipRakeProtectedBalls.has(ball) ? 10 : null;
  }

  drawConfettiBombRanges() {
    this.confettiRangeGraphics.clear();

    const pulse = (Math.sin(this.scene.time.now * 0.006) + 1) / 2;
    for (const ball of this.context.getBalls()) {
      if (ball.code !== BallCode.confettiBomb || ball.pocketed || ball.hp <= 0) {
        continue;
      }

      this.confettiRangeGraphics.fillStyle(0xff4768, 0.06 + pulse * 0.025);
      this.confettiRangeGraphics.fillCircle(
        ball.sprite.x,
        ball.sprite.y,
        CONFETTI_EXPLOSION_RADIUS,
      );
      this.confettiRangeGraphics.lineStyle(3, 0xffd36b, 0.62 + pulse * 0.22);
      this.confettiRangeGraphics.strokeCircle(
        ball.sprite.x,
        ball.sprite.y,
        CONFETTI_EXPLOSION_RADIUS,
      );
      this.confettiRangeGraphics.lineStyle(1, 0xff4768, 0.54);
      this.confettiRangeGraphics.strokeCircle(
        ball.sprite.x,
        ball.sprite.y,
        CONFETTI_EXPLOSION_RADIUS * 0.72,
      );
    }
  }

  clearPersistentEffects() {
    this.clearConfettiRanges();
  }

  private getSpecialActionBalls(): QueuedAction[] {
    return this.context
      .getBalls()
      .filter(
        (ball) =>
          ball.ballKind === "enemy" &&
          !ball.pocketed &&
          ball.hp > 0 &&
          ball.property.specialActions.length > 0,
      )
      .map((ball) => ({
        ball,
        action: this.selectUsableAction(ball),
        order: Math.random(),
      }))
      .filter(
        (entry): entry is QueuedAction & { order: number } =>
          entry.action !== null,
      )
      .sort(
        (a, b) =>
          a.ball.actionPriority - b.ball.actionPriority || a.order - b.order,
      )
      .map(({ ball, action }) => ({ ball, action }));
  }

  private showEnemyTurnBanner() {
    this.turnBanner?.destroy();

    const background = this.scene.add.graphics();
    background.fillStyle(0x2b0508, 0.88);
    background.fillRoundedRect(-230, -44, 460, 88, 10);
    background.lineStyle(3, 0xff293f, 0.92);
    background.strokeRoundedRect(-230, -44, 460, 88, 10);
    background.fillStyle(0xff293f, 0.12);
    background.fillRoundedRect(-214, -30, 428, 18, 8);

    const text = this.scene.add
      .text(0, 0, "ENEMY TURN", {
        color: "#ffe9dc",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "50px",
        fontStyle: "900",
        stroke: "#370406",
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    this.turnBanner = this.scene.add.container(GAME_WIDTH / 2, 172, [
      background,
      text,
    ]);
    this.turnBanner.setDepth(220);
    this.turnBanner.setAlpha(0);
    this.turnBanner.setScale(0.92);

    this.scene.tweens.add({
      targets: this.turnBanner,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.Out",
      yoyo: true,
      hold: 660,
      onComplete: () => {
        this.turnBanner?.destroy();
        this.turnBanner = undefined;
      },
    });
  }

  private clearActionRing() {
    this.actionRing.clear();
  }

  private selectUsableAction(ball: Ball): BallSpecialAction | null {
    for (const actionCode of ball.property.specialActions) {
      const action = BallSpecialActions[actionCode];
      if (this.isActionUsable(ball, action)) return action;
    }
    return null;
  }

  private isActionUsable(ball: Ball, action: BallSpecialAction): boolean {
    if (!action.has_premise) return true;

    switch (action.code) {
      case BallSpecialActionCode.bishopHeal:
        return this.hasBishopHealTarget();
      case BallSpecialActionCode.heartHeal:
        return this.getHeartHealTarget() !== null;
      case BallSpecialActionCode.soulSealHeal:
        return ball.hp > 0 && ball.hp < ball.maxHp;
      case BallSpecialActionCode.kingCommand:
        return this.hasLivingPawn();
      case BallSpecialActionCode.zombieCommand:
      case BallSpecialActionCode.soulCommand:
        return this.hasLivingZombie();
      case BallSpecialActionCode.hollowSummon:
        return this.countLivingZombies() <= HOLLOW_SUMMON_THRESHOLD;
      case BallSpecialActionCode.rookCharge:
      case BallSpecialActionCode.kingCharge:
      case BallSpecialActionCode.hollowCharge:
      case BallSpecialActionCode.spadeCharge:
      case BallSpecialActionCode.phaseAttack:
      case BallSpecialActionCode.mirrorStep:
        return true;
      case BallSpecialActionCode.diamondShot:
      case BallSpecialActionCode.wraithShot:
        return this.canUseLaserShot(ball);
      case BallSpecialActionCode.breakDown:
        return this.canBreakDown();
      case BallSpecialActionCode.chipMultiply:
        return (
          Math.random() < CHIP_MULTIPLY_CHANCE &&
          this.context.findChipMultiplyPosition(ball) !== null
        );
      case BallSpecialActionCode.confettiExplode:
        return true;
      case BallSpecialActionCode.jokerConfetti:
        return !this.hasLivingConfettiBomb();
      case BallSpecialActionCode.jokerChipRake:
        return this.hasLivingChip();
      case BallSpecialActionCode.jokerRaise:
        return true;
    }
  }

  private canExecuteQueuedAction(
    ball: Ball,
    action: BallSpecialAction,
  ): boolean {
    if (!action.has_premise) return true;

    switch (action.code) {
      case BallSpecialActionCode.chipMultiply:
        return this.context.findChipMultiplyPosition(ball) !== null;
      case BallSpecialActionCode.jokerConfetti:
        return !this.hasLivingConfettiBomb();
      case BallSpecialActionCode.jokerChipRake:
        return this.hasLivingChip();
      default:
        return this.isActionUsable(ball, action);
    }
  }

  private hasBishopHealTarget(): boolean {
    return this.context
      .getBalls()
      .some(
        (target) =>
          target.ballKind === "enemy" &&
          !target.pocketed &&
          target.hp > 0 &&
          target.hp < target.maxHp,
      );
  }

  private hasLivingPawn(): boolean {
    return this.context
      .getBalls()
      .some(
        (target) =>
          target.code === BallCode.pawn && !target.pocketed && target.hp > 0,
      );
  }

  private hasLivingZombie(): boolean {
    return this.countLivingZombies() > 0;
  }

  private countLivingZombies(): number {
    return this.context
      .getBalls()
      .filter(
        (target) =>
          target.code === BallCode.zombie && !target.pocketed && target.hp > 0,
      ).length;
  }

  private hasLivingConfettiBomb(): boolean {
    return this.context
      .getBalls()
      .some(
        (target) =>
          target.code === BallCode.confettiBomb &&
          !target.pocketed &&
          target.hp > 0,
      );
  }

  private hasLivingChip(): boolean {
    return this.context
      .getBalls()
      .some(
        (target) =>
          target.code === BallCode.chip && !target.pocketed && target.hp > 0,
      );
  }

  private canUseLaserShot(ball: Ball): boolean {
    const cueBall = this.context.getCueBall();
    return (
      cueBall !== null &&
      !this.context.isBallPhasing(cueBall) &&
      this.getDiamondShotHit(ball) !== null
    );
  }

  private getHeartHealTarget(): Ball | null {
    return (
      this.context
        .getBalls()
        .filter(
          (target) =>
            target.ballKind === "enemy" &&
            !target.pocketed &&
            target.hp > 0 &&
            target.hp < target.maxHp,
        )
        .sort(
          (a, b) =>
            a.hp / a.maxHp - b.hp / b.maxHp ||
            a.actionPriority - b.actionPriority,
        )[0] ?? null
    );
  }

  private canBreakDown(): boolean {
    const livingEnemies = this.context
      .getBalls()
      .filter(
        (target) =>
          target.ballKind === "enemy" && !target.pocketed && target.hp > 0,
      );
    return (
      livingEnemies.length > 0 &&
      livingEnemies.every((target) =>
        target.property.specialActions.includes(
          BallSpecialActionCode.breakDown,
        ),
      )
    );
  }

  private executeSpecialAction(ball: Ball, action: BallSpecialAction) {
    switch (action.code) {
      case BallSpecialActionCode.rookCharge:
        this.executeRookCharge(ball, action);
        break;
      case BallSpecialActionCode.bishopHeal:
        this.executeBishopHeal(ball, action);
        break;
      case BallSpecialActionCode.heartHeal:
        this.executeHeartHeal(ball, action);
        break;
      case BallSpecialActionCode.soulSealHeal:
        this.executeSoulSealHeal(ball, action);
        break;
      case BallSpecialActionCode.kingCommand:
        this.executeKingCommand(ball, action);
        break;
      case BallSpecialActionCode.zombieCommand:
        this.executeZombieCommand(ball, action);
        break;
      case BallSpecialActionCode.soulCommand:
        this.executeSoulCommand(ball, action);
        break;
      case BallSpecialActionCode.hollowSummon:
        this.executeHollowSummon(ball, action);
        break;
      case BallSpecialActionCode.kingCharge:
        this.executeKingCharge(ball, action);
        break;
      case BallSpecialActionCode.hollowCharge:
        this.executeHollowCharge(ball, action);
        break;
      case BallSpecialActionCode.spadeCharge:
        this.executeSpadeCharge(ball, action);
        break;
      case BallSpecialActionCode.phaseAttack:
        this.executePhaseAttack(ball, action);
        break;
      case BallSpecialActionCode.mirrorStep:
        this.executeMirrorStep(ball, action);
        break;
      case BallSpecialActionCode.diamondShot:
      case BallSpecialActionCode.wraithShot:
        this.executeLaserShot(ball, action);
        break;
      case BallSpecialActionCode.breakDown:
        this.executeBreakDown(ball, action);
        break;
      case BallSpecialActionCode.chipMultiply:
        this.executeChipMultiply(ball, action);
        break;
      case BallSpecialActionCode.confettiExplode:
        this.executeConfettiExplode(ball, action);
        break;
      case BallSpecialActionCode.jokerConfetti:
        this.executeJokerConfetti(ball, action);
        break;
      case BallSpecialActionCode.jokerChipRake:
        this.executeJokerChipRake(ball, action);
        break;
      case BallSpecialActionCode.jokerRaise:
        this.executeJokerRaise(ball, action);
        break;
    }
  }

  private executeBishopHeal(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    this.context.playHealSound();

    for (const target of this.context.getBalls()) {
      if (target.ballKind === "cue" || target.pocketed || target.hp <= 0)
        continue;

      const healed = Math.min(BISHOP_HEAL_AMOUNT, target.maxHp - target.hp);
      if (healed <= 0) continue;

      target.hp += healed;
      this.context.showHealSplash(
        new Phaser.Math.Vector2(
          target.sprite.x,
          target.sprite.y - target.radius - 12,
        ),
        healed,
      );
    }

    this.context.updateHud("Bishop heal");
    this.actionWaitUntil =
      this.scene.time.now + BISHOP_HEAL_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeHeartHeal(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const target = this.getHeartHealTarget();
    if (!target) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    this.context.playHealSound();
    const healed = Math.min(HEART_HEAL_AMOUNT, target.maxHp - target.hp);
    target.hp += healed;
    this.context.showHealSplash(
      new Phaser.Math.Vector2(
        target.sprite.x,
        target.sprite.y - target.radius - 12,
      ),
      healed,
    );

    this.context.updateHud("Heart heal");
    this.actionWaitUntil =
      this.scene.time.now + HEART_HEAL_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeSoulSealHeal(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    this.context.playHealSound();

    const healed = Math.min(SOUL_SEAL_HEAL_AMOUNT, ball.maxHp - ball.hp);
    if (healed > 0) {
      ball.hp += healed;
      this.context.showHealSplash(
        new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y - ball.radius - 12),
        healed,
      );
    }

    this.context.updateHud("Soul seal heal");
    this.actionWaitUntil =
      this.scene.time.now + SOUL_SEAL_HEAL_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeRookCharge(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() <= 1) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    direction.normalize();
    this.context.playShotSound();
    ball.sprite.setVelocity(
      direction.x * this.getChargeVelocity(ROOK_CHARGE_SPEED, ball),
      direction.y * this.getChargeVelocity(ROOK_CHARGE_SPEED, ball),
    );
    this.context.updateHud("Rook charge");
  }

  private executeKingCommand(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    const pawns = this.context
      .getBalls()
      .filter(
        (candidate) =>
          candidate !== ball &&
          candidate.code === BallCode.pawn &&
          !candidate.pocketed &&
          candidate.hp > 0,
      );

    if (!cueBall || pawns.length === 0) {
      this.context.updateHud("King command");
      this.actionWaitUntil =
        this.scene.time.now + KING_COMMAND_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
      return;
    }

    this.commandProtectedBalls = new Set(pawns);
    this.context.playShotSound();

    for (const pawn of pawns) {
      const direction = new Phaser.Math.Vector2(
        cueBall.sprite.x - pawn.sprite.x,
        cueBall.sprite.y - pawn.sprite.y,
      );
      if (direction.lengthSq() <= 1) continue;

      direction.normalize();
      pawn.sprite.setVelocity(
        direction.x * this.getChargeVelocity(KING_COMMAND_SPEED, pawn),
        direction.y * this.getChargeVelocity(KING_COMMAND_SPEED, pawn),
      );
    }
    this.context.updateHud("King command");
  }

  private executeZombieCommand(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(
      ball,
      action,
      "死者の号令",
      "ゾンビを一斉に手球へ突進させる",
    );

    const cueBall = this.context.getCueBall();
    const zombies = this.context
      .getBalls()
      .filter(
        (candidate) =>
          candidate !== ball &&
          candidate.code === BallCode.zombie &&
          !candidate.pocketed &&
          candidate.hp > 0,
      );

    if (!cueBall || zombies.length === 0) {
      this.context.updateHud("Zombie command");
      this.actionWaitUntil =
        this.scene.time.now + ZOMBIE_COMMAND_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
      return;
    }

    this.commandProtectedBalls = new Set(zombies);
    this.context.playShotSound();

    for (const zombie of zombies) {
      const direction = new Phaser.Math.Vector2(
        cueBall.sprite.x - zombie.sprite.x,
        cueBall.sprite.y - zombie.sprite.y,
      );
      if (direction.lengthSq() <= 1) continue;

      direction.normalize();
      zombie.sprite.setVelocity(
        direction.x * this.getChargeVelocity(ZOMBIE_COMMAND_SPEED, zombie),
        direction.y * this.getChargeVelocity(ZOMBIE_COMMAND_SPEED, zombie),
      );
    }
    this.context.updateHud("Zombie command");
  }

  private executeSoulCommand(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    const zombies = this.context
      .getBalls()
      .filter(
        (candidate) =>
          candidate !== ball &&
          candidate.code === BallCode.zombie &&
          !candidate.pocketed &&
          candidate.hp > 0,
      );

    if (!cueBall || zombies.length === 0) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    this.commandProtectedBalls = new Set(zombies);
    this.context.playShotSound();

    for (const zombie of zombies) {
      const direction = new Phaser.Math.Vector2(
        cueBall.sprite.x - zombie.sprite.x,
        cueBall.sprite.y - zombie.sprite.y,
      );
      if (direction.lengthSq() <= 1) continue;

      direction.normalize();
      zombie.sprite.setVelocity(
        direction.x * this.getChargeVelocity(SOUL_COMMAND_SPEED, zombie),
        direction.y * this.getChargeVelocity(SOUL_COMMAND_SPEED, zombie),
      );
    }
    this.context.updateHud("Soul command");
  }

  private executeHollowSummon(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const livingZombies = this.countLivingZombies();
    const targetSpawnCount = Math.max(0, HOLLOW_SUMMON_TARGET - livingZombies);
    if (targetSpawnCount <= 0) {
      this.actionWaitUntil =
        this.scene.time.now + HOLLOW_SUMMON_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
      return;
    }

    const spawned = this.spawnRandomEnemies(BallCode.zombie, targetSpawnCount, {
      minCueDistance: 80,
    });
    this.context.updateHud(`Hollow summon x${spawned}`);
    this.actionWaitUntil =
      this.scene.time.now + HOLLOW_SUMMON_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeKingCharge(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() <= 1) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    direction.normalize();
    this.context.playShotSound();
    ball.sprite.setVelocity(
      direction.x * this.getChargeVelocity(KING_CHARGE_SPEED, ball),
      direction.y * this.getChargeVelocity(KING_CHARGE_SPEED, ball),
    );
    this.context.updateHud("King charge");
  }

  private executeHollowCharge(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() <= 1) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    direction.normalize();
    this.context.playShotSound();
    ball.sprite.setVelocity(
      direction.x * this.getChargeVelocity(HOLLOW_CHARGE_SPEED, ball),
      direction.y * this.getChargeVelocity(HOLLOW_CHARGE_SPEED, ball),
    );
    this.context.updateHud("Hollow charge");
  }

  private executeSpadeCharge(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() <= 1) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    direction.normalize();
    this.context.playShotSound();
    ball.sprite.setVelocity(
      direction.x * this.getChargeVelocity(SPADE_CHARGE_SPEED, ball),
      direction.y * this.getChargeVelocity(SPADE_CHARGE_SPEED, ball),
    );
    this.context.updateHud("Spade charge");
  }

  private executePhaseAttack(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(
      ball,
      action,
      "すりぬけアタック",
      "敵球をすり抜けながら手球へ突進する",
    );

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() <= 1) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    direction.normalize();
    this.context.setBallPhasing(ball, true);
    this.context.playShotSound();
    ball.sprite.setVelocity(
      direction.x * this.getChargeVelocity(PHASE_ATTACK_SPEED, ball),
      direction.y * this.getChargeVelocity(PHASE_ATTACK_SPEED, ball),
    );
    this.context.updateHud("Phase attack");
  }

  private executeBreakDown(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    this.context.updateHud("Break down");
    this.pendingBreakDown = {
      readyAt: this.scene.time.now + BREAK_DOWN_CHARGE_MS,
    };
  }

  private executeMirrorStep(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const fromCueToBall = new Phaser.Math.Vector2(
      ball.sprite.x - cueBall.sprite.x,
      ball.sprite.y - cueBall.sprite.y,
    );
    if (fromCueToBall.lengthSq() > 1) {
      fromCueToBall.normalize();
      const target = new Phaser.Math.Vector2(
        cueBall.sprite.x - fromCueToBall.x * MIRROR_STEP_BACK_DISTANCE,
        cueBall.sprite.y - fromCueToBall.y * MIRROR_STEP_BACK_DISTANCE,
      );
      if (this.context.canPlaceBallAt(ball, target.x, target.y)) {
        this.showMirrorStepTrail(
          new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y),
          target,
        );
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        ball.sprite.setPosition(target.x, target.y);
        ball.label?.setPosition(target.x, target.y);
        ball.previousPosition.set(target.x, target.y);
        this.context.playWarpSound();
      } else {
        this.context.updateHud("Mirror step failed");
      }
    }

    this.pendingMirrorStep = {
      ball,
      readyAt: this.scene.time.now + MIRROR_STEP_WARP_WAIT_MS,
    };
    this.context.updateHud("Mirror step");
  }

  private fireMirrorStep(ball: Ball) {
    const cueBall = this.context.getCueBall();
    if (!cueBall || ball.pocketed || ball.hp <= 0) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }
    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - ball.sprite.x,
      cueBall.sprite.y - ball.sprite.y,
    );
    if (direction.lengthSq() > 1) {
      direction.normalize();
      this.context.playShotSound();
      ball.sprite.setVelocity(
        direction.x * this.getChargeVelocity(MIRROR_STEP_SPEED, ball),
        direction.y * this.getChargeVelocity(MIRROR_STEP_SPEED, ball),
      );
    }
  }

  private getChargeVelocity(baseSpeed: number, ball: Ball): number {
    return (baseSpeed * CHARGE_POWER_MULTIPLIER) / ball.weight;
  }

  private executeChipMultiply(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const position = this.context.findChipMultiplyPosition(ball);
    if (!position) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const clone = this.context.spawnEnemyBall(
      BallCode.chip,
      position.x,
      position.y,
    );
    if (!clone) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    this.showChipSpawnRing(clone);
    this.chipMultiplyProtectedUntil =
      this.scene.time.now + CHIP_MULTIPLY_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
    this.actionWaitUntil =
      this.scene.time.now + CHIP_MULTIPLY_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
    this.context.updateHud("Chip multiply");
  }

  private executeConfettiExplode(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const center = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
    this.context.playExplodeSound();
    this.context.showExplosionAnimation(center, CONFETTI_EXPLOSION_RADIUS);

    for (const target of this.context.getBalls()) {
      if (target === ball || target.pocketed || target.hp <= 0) continue;

      const distance = Phaser.Math.Distance.Between(
        center.x,
        center.y,
        target.sprite.x,
        target.sprite.y,
      );
      if (distance > CONFETTI_EXPLOSION_RADIUS) continue;

      const modifiedDamage = this.context.getDamageAfterTargetModifiers(
        target,
        CONFETTI_EXPLOSION_DAMAGE,
      );
      const damage = Math.min(modifiedDamage, target.hp);
      target.hp = Math.max(0, target.hp - modifiedDamage);
      this.context.onBallDamaged(target);
      this.context.showDamageSplashAt(
        new Phaser.Math.Vector2(
          target.sprite.x,
          target.sprite.y - target.radius - 12,
        ),
        damage,
        TextCode.splashReasonBomb,
      );

      if (target.hp <= 0) continue;

      this.context.applyRadialVelocity(target, center, distance, {
        radius: CONFETTI_EXPLOSION_RADIUS,
        minForce: 0,
        maxForce: CONFETTI_EXPLOSION_FORCE,
        forceMultiplier: 1,
        zeroDistanceBehavior: "fixedOutward",
      });
    }

    const selfDamage = Math.min(999, ball.hp);
    ball.hp = Math.max(0, ball.hp - 999);
    this.context.showDamageSplashAt(
      new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y - ball.radius - 12),
      selfDamage,
      TextCode.splashReasonBomb,
    );
    this.context.resolveDamageDefeats();
    this.context.updateHud("Confetti bomb");
    this.actionWaitUntil =
      this.scene.time.now + CONFETTI_EXPLOSION_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeJokerConfetti(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    const cueBall = this.context.getCueBall();
    const spawned = this.spawnRandomEnemies(
      BallCode.confettiBomb,
      JOKER_CONFETTI_COUNT,
      {
        center: cueBall
          ? new Phaser.Math.Vector2(cueBall.sprite.x, cueBall.sprite.y)
          : undefined,
        maxDistanceFromCenter: JOKER_CONFETTI_SPAWN_RADIUS,
        minCueDistance: CONFETTI_EXPLOSION_RADIUS + 42,
      },
    );
    this.context.updateHud(`Confetti x${spawned}`);
    this.actionWaitUntil =
      this.scene.time.now + JOKER_SPAWN_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeJokerRaise(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    const spawned = this.spawnRandomEnemies(BallCode.chip, JOKER_RAISE_COUNT);
    this.context.updateHud(`Raise x${spawned}`);
    this.actionWaitUntil =
      this.scene.time.now + JOKER_SPAWN_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeJokerChipRake(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);
    const cueBall = this.context.getCueBall();
    if (!cueBall) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    const chips = this.context
      .getBalls()
      .filter(
        (target) =>
          target.code === BallCode.chip && !target.pocketed && target.hp > 0,
      );
    if (chips.length === 0) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    this.clearTemporaryChipRake();
    this.chipRakeProtectedBalls = new Set(chips);
    this.context.playShotSound();

    for (const chip of chips) {
      const direction = new Phaser.Math.Vector2(
        cueBall.sprite.x - chip.sprite.x,
        cueBall.sprite.y - chip.sprite.y,
      );
      if (direction.lengthSq() <= 1) continue;

      direction.normalize();
      chip.sprite.setVelocity(
        direction.x * this.getChargeVelocity(JOKER_CHIP_RAKE_SPEED, chip),
        direction.y * this.getChargeVelocity(JOKER_CHIP_RAKE_SPEED, chip),
      );
    }

    this.context.updateHud("Chip rake");
  }

  private spawnRandomEnemies(
    code: BallCode,
    count: number,
    options?: {
      minCueDistance?: number;
      center?: Phaser.Math.Vector2;
      maxDistanceFromCenter?: number;
    },
  ): number {
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      const position = this.context.findRandomEnemySpawnPosition(code, options);
      if (!position) continue;

      const ball = this.context.spawnEnemyBall(code, position.x, position.y);
      if (!ball) continue;

      spawned += 1;
      this.showChipSpawnRing(ball);
    }
    return spawned;
  }

  private showChipSpawnRing(ball: Ball) {
    this.clearChipSpawnRing();

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CHIP_MULTIPLY_RING_MS,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (value === null) return;

        const radius = ball.radius + 18 + value * 16;
        const alpha = 0.95 * (1 - value);
        this.chipSpawnRing.clear();
        this.chipSpawnRing.lineStyle(5, 0x58f6ff, alpha);
        this.chipSpawnRing.strokeCircle(ball.sprite.x, ball.sprite.y, radius);
        this.chipSpawnRing.lineStyle(2, 0xfff6b0, alpha * 0.9);
        this.chipSpawnRing.strokeCircle(ball.sprite.x, ball.sprite.y, radius + 7);
      },
      onComplete: () => this.clearChipSpawnRing(),
    });
  }

  private showMirrorStepTrail(
    from: Phaser.Math.Vector2,
    to: Phaser.Math.Vector2,
  ) {
    this.clearChipSpawnRing();

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: MIRROR_STEP_WARP_WAIT_MS,
      ease: "Sine.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (value === null) return;

        const alpha = 0.9 * (1 - value * 0.55);
        const startRadius = 12 + value * 34;
        const endRadius = 44 - value * 24;
        this.chipSpawnRing.clear();
        this.chipSpawnRing.lineStyle(3, 0xbfefff, alpha);
        this.chipSpawnRing.strokeCircle(from.x, from.y, startRadius);
        this.chipSpawnRing.lineStyle(5, 0xffffff, alpha * 0.72);
        this.chipSpawnRing.strokeCircle(to.x, to.y, endRadius);
        this.chipSpawnRing.lineStyle(2, 0x77dfff, alpha * 0.52);
        this.chipSpawnRing.lineBetween(from.x, from.y, to.x, to.y);
      },
      onComplete: () => this.clearChipSpawnRing(),
    });
  }

  private clearChipSpawnRing() {
    this.scene.tweens.killTweensOf(this.chipSpawnRing);
    this.chipSpawnRing.clear();
  }

  private clearTemporaryChipRake() {
    this.chipRakeProtectedBalls.clear();
  }

  private clearActivePhasing() {
    if (!this.activeBall) return;
    this.context.setBallPhasing(this.activeBall, false);
  }

  private clearConfettiRanges() {
    this.confettiRangeGraphics.clear();
  }

  private applyBreakDownDamage() {
    for (const target of this.context.getBalls()) {
      if (
        target.ballKind !== "enemy" ||
        target.pocketed ||
        target.hp <= 0 ||
        !target.property.specialActions.includes(
          BallSpecialActionCode.breakDown,
        )
      ) {
        continue;
      }

      const modifiedDamage = this.context.getDamageAfterTargetModifiers(
        target,
        BREAK_DOWN_DAMAGE,
      );
      const damage = Math.min(modifiedDamage, target.hp);
      target.hp = Math.max(0, target.hp - modifiedDamage);
      this.context.showDamageSplashAt(
        new Phaser.Math.Vector2(
          target.sprite.x,
          target.sprite.y - target.radius - 12,
        ),
        damage,
        TextCode.splashReasonBreak,
      );
    }

    this.context.resolveDamageDefeats({
      clearSceneDelayMs: BREAK_DOWN_CLEAR_DELAY_MS,
    });
    this.context.updateHud("Break down");
    this.actionWaitUntil =
      this.scene.time.now + BREAK_DOWN_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private executeLaserShot(ball: Ball, action: BallSpecialAction) {
    this.showActionWindow(ball, action);

    const shot = this.getDiamondShot(ball);
    if (!shot) {
      this.activeBall = null;
      this.activeAction = null;
      return;
    }

    this.drawDiamondLaser(shot.origin, shot.hit.point, this.getLaserPalette(ball));
    this.context.updateHud(this.getLaserSightHudText(action.code));
    this.pendingDiamondShot = {
      ball,
      direction: shot.direction,
      hit: shot.hit,
      readyAt: this.scene.time.now + DIAMOND_LASER_AIM_MS,
    };
  }

  private fireDiamondShot(
    ball: Ball,
    direction: Phaser.Math.Vector2,
    hit: DiamondShotHit,
  ) {
    this.context.playShotSound();
    const palette = this.getLaserPalette(ball);
    this.animateDiamondBullet(
      new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y),
      hit.point,
      palette,
    );

    if (hit.type !== "ball") {
      this.context.updateHud(this.getLaserShotHudText(this.activeAction?.code));
      this.actionWaitUntil =
        this.scene.time.now + DIAMOND_SHOT_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
      return;
    }

    const target = hit.target;
    if (!target.pocketed && target.hp > 0) {
      const modifiedDamage = this.context.getDamageAfterTargetModifiers(
        target,
        Math.ceil(this.context.getBallAttack(ball)),
      );
      const damage = Math.min(modifiedDamage, target.hp);
      target.hp = Math.max(0, target.hp - damage);
      this.context.onBallDamaged(target);
      this.context.showDamageSplashAt(
        new Phaser.Math.Vector2(
          target.sprite.x,
          target.sprite.y - target.radius - 12,
        ),
        damage,
        TextCode.splashReasonShot,
      );
    }

    this.context.resolveDamageDefeats();
    this.context.updateHud(this.getLaserShotHudText(this.activeAction?.code));
    this.actionWaitUntil =
      this.scene.time.now + DIAMOND_SHOT_WAIT_MS + ENEMY_ACTION_EDGE_WAIT_MS;
  }

  private getDiamondShot(ball: Ball): {
    origin: Phaser.Math.Vector2;
    direction: Phaser.Math.Vector2;
    hit: DiamondShotHit;
  } | null {
    const cueBall = this.context.getCueBall();
    if (!cueBall) return null;

    const origin = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
    const direction = new Phaser.Math.Vector2(
      cueBall.sprite.x - origin.x,
      cueBall.sprite.y - origin.y,
    );
    const cueDistance = direction.length();
    if (cueDistance <= 1) return null;

    direction.normalize();
    const hit = this.findDiamondLineHit(
      ball,
      origin,
      direction,
      cueDistance + cueBall.radius,
    );

    return {
      origin,
      direction,
      hit: hit ?? this.getDiamondCueFallbackHit(origin, direction, cueBall),
    };
  }

  private getDiamondShotHit(
    ball: Ball,
    origin = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y),
    direction?: Phaser.Math.Vector2,
    maxDistance = Number.POSITIVE_INFINITY,
  ): DiamondShotHit | null {
    const cueBall = this.context.getCueBall();
    if (!cueBall) return null;

    const shotDirection =
      direction ??
      new Phaser.Math.Vector2(
        cueBall.sprite.x - origin.x,
        cueBall.sprite.y - origin.y,
      );
    if (shotDirection.lengthSq() <= 1) return null;
    shotDirection.normalize();

    return this.findDiamondLineHit(ball, origin, shotDirection, maxDistance);
  }

  private findDiamondLineHit(
    shooter: Ball,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    maxDistance: number,
  ): DiamondShotHit | null {
    const candidates: DiamondShotHit[] = [];
    const addCandidate = (hit: DiamondShotHit | null) => {
      if (!hit || hit.distance <= 0.001 || hit.distance > maxDistance) return;
      candidates.push(hit);
    };

    addCandidate(this.findDiamondWallHit(origin, direction));
    for (const obstacle of this.context.getObstacles()) {
      addCandidate(this.findDiamondObstacleHit(origin, direction, obstacle));
    }
    for (const target of this.context.getBalls()) {
      if (target === shooter || target.pocketed || target.hp <= 0) continue;
      addCandidate(this.findDiamondBallHit(origin, direction, target));
    }

    return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
  }

  private findDiamondWallHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): DiamondShotHit | null {
    const bounds = this.context.getBallTravelBounds(0);
    const hits: DiamondShotHit[] = [];
    const within = (value: number, min: number, max: number) =>
      value >= min - 0.001 && value <= max + 0.001;

    if (direction.x < -0.0001) {
      const distance = (bounds.minX - origin.x) / direction.x;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.y, bounds.minY, bounds.maxY)) {
        hits.push({ type: "wall", point, distance });
      }
    } else if (direction.x > 0.0001) {
      const distance = (bounds.maxX - origin.x) / direction.x;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.y, bounds.minY, bounds.maxY)) {
        hits.push({ type: "wall", point, distance });
      }
    }

    if (direction.y < -0.0001) {
      const distance = (bounds.minY - origin.y) / direction.y;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.x, bounds.minX, bounds.maxX)) {
        hits.push({ type: "wall", point, distance });
      }
    } else if (direction.y > 0.0001) {
      const distance = (bounds.maxY - origin.y) / direction.y;
      const point = origin.clone().add(direction.clone().scale(distance));
      if (within(point.x, bounds.minX, bounds.maxX)) {
        hits.push({ type: "wall", point, distance });
      }
    }

    return (
      hits
        .filter((hit) => hit.distance > 0)
        .sort((a, b) => a.distance - b.distance)[0] ?? null
    );
  }

  private findDiamondObstacleHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    obstacle: StageObstacle,
  ): DiamondShotHit | null {
    const bounds = getObstacleBounds(obstacle);
    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;

    let entryDistance = 0;
    let exitDistance = Number.POSITIVE_INFINITY;

    if (Math.abs(direction.x) < 0.000001) {
      if (origin.x < minX || origin.x > maxX) return null;
    } else {
      const inverse = 1 / direction.x;
      const d1 = (minX - origin.x) * inverse;
      const d2 = (maxX - origin.x) * inverse;
      entryDistance = Math.max(entryDistance, Math.min(d1, d2));
      exitDistance = Math.min(exitDistance, Math.max(d1, d2));
    }

    if (Math.abs(direction.y) < 0.000001) {
      if (origin.y < minY || origin.y > maxY) return null;
    } else {
      const inverse = 1 / direction.y;
      const d1 = (minY - origin.y) * inverse;
      const d2 = (maxY - origin.y) * inverse;
      entryDistance = Math.max(entryDistance, Math.min(d1, d2));
      exitDistance = Math.min(exitDistance, Math.max(d1, d2));
    }

    if (entryDistance > exitDistance || entryDistance <= 0.001) return null;

    return {
      type: "wall",
      point: origin.clone().add(direction.clone().scale(entryDistance)),
      distance: entryDistance,
    };
  }

  private findDiamondBallHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    target: Ball,
    maxDistance = Number.POSITIVE_INFINITY,
  ): DiamondShotHit | null {
    const targetCenter = new Phaser.Math.Vector2(
      target.sprite.x,
      target.sprite.y,
    );
    const toTarget = targetCenter.clone().subtract(origin);
    const projectedDistance = toTarget.dot(direction);
    if (projectedDistance <= 0.001) return null;
    if (projectedDistance - target.radius > maxDistance) return null;

    const closestPoint = origin
      .clone()
      .add(direction.clone().scale(projectedDistance));
    const missDistance = Phaser.Math.Distance.Between(
      closestPoint.x,
      closestPoint.y,
      target.sprite.x,
      target.sprite.y,
    );
    if (missDistance > target.radius) return null;

    const surfaceOffset = Math.sqrt(
      Math.max(
        0,
        target.radius ** 2 - Math.min(missDistance, target.radius) ** 2,
      ),
    );
    const distance = Math.max(0.001, projectedDistance - surfaceOffset);
    if (distance > maxDistance) return null;

    return {
      type: "ball",
      point: origin.clone().add(direction.clone().scale(distance)),
      distance,
      target,
    };
  }

  private getDiamondCueFallbackHit(
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
    cueBall: Ball,
  ): DiamondShotHit {
    const cueCenter = new Phaser.Math.Vector2(
      cueBall.sprite.x,
      cueBall.sprite.y,
    );
    const distance = Math.max(
      1,
      cueCenter.clone().subtract(origin).length() - cueBall.radius,
    );
    return {
      type: "ball",
      point: origin.clone().add(direction.clone().scale(distance)),
      distance,
      target: cueBall,
    };
  }

  private drawDiamondLaser(
    origin: Phaser.Math.Vector2,
    target: Phaser.Math.Vector2,
    palette: LaserPalette,
  ) {
    this.diamondGraphics.clear();
    this.diamondGraphics.lineStyle(1, palette.sight, 0.62);
    this.diamondGraphics.lineBetween(origin.x, origin.y, target.x, target.y);
    this.diamondGraphics.lineStyle(1, palette.glow, 0.32);
    this.diamondGraphics.lineBetween(origin.x, origin.y, target.x, target.y);
    this.diamondGraphics.fillStyle(palette.sight, 0.66);
    this.diamondGraphics.fillCircle(target.x, target.y, 2);
  }

  private animateDiamondBullet(
    origin: Phaser.Math.Vector2,
    target: Phaser.Math.Vector2,
    palette: LaserPalette,
  ) {
    const direction = target.clone().subtract(origin);
    const length = direction.length();
    if (length <= 1) {
      this.clearDiamondGraphics();
      return;
    }
    direction.normalize();

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 180,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (value === null) return;

        const headDistance = Phaser.Math.Clamp(length * value, 0, length);
        const tailDistance = Phaser.Math.Clamp(headDistance - 46, 0, length);
        const head = origin.clone().add(direction.clone().scale(headDistance));
        const tail = origin.clone().add(direction.clone().scale(tailDistance));

        this.diamondGraphics.clear();
        this.diamondGraphics.lineStyle(
          5,
          palette.bullet,
          0.85 * (1 - value * 0.25),
        );
        this.diamondGraphics.lineBetween(tail.x, tail.y, head.x, head.y);
        this.diamondGraphics.lineStyle(2, palette.core, 0.92);
        this.diamondGraphics.lineBetween(tail.x, tail.y, head.x, head.y);
      },
      onComplete: () => this.clearDiamondGraphics(),
    });
  }

  private getLaserPalette(ball: Ball): LaserPalette {
    return ball.property.specialActions.includes(BallSpecialActionCode.wraithShot)
      ? WRAITH_LASER_COLORS
      : DIAMOND_LASER_COLORS;
  }

  private isLaserShotAction(
    code: BallSpecialActionCodeType | undefined,
  ): boolean {
    return (
      code === BallSpecialActionCode.diamondShot ||
      code === BallSpecialActionCode.wraithShot
    );
  }

  private getLaserSightHudText(code: BallSpecialActionCodeType): string {
    return code === BallSpecialActionCode.wraithShot
      ? "Wraith sight"
      : "Diamond sight";
  }

  private getLaserShotHudText(
    code: BallSpecialActionCodeType | undefined,
  ): string {
    return code === BallSpecialActionCode.wraithShot
      ? "Wraith shot"
      : "Diamond shot";
  }

  private clearDiamondGraphics() {
    this.diamondGraphics.clear();
  }

  private showActionWindow(
    ball: Ball,
    action: BallSpecialAction,
    detailTitle?: string,
    detailDescription?: string,
  ) {
    this.hideActionWindow();

    const background = this.scene.add.graphics();
    background.fillStyle(0x12080a, 0.9);
    background.fillRoundedRect(-174, -56, 348, 112, 10);
    background.lineStyle(2, 0xffd06c, 0.86);
    background.strokeRoundedRect(-174, -56, 348, 112, 10);
    background.fillStyle(0xff263c, 0.16);
    background.fillRoundedRect(-164, -46, 328, 20, 7);

    const nameText = this.scene.add
      .text(-154, -45, ball.property.name, {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "900",
      })
      .setOrigin(0, 0);

    const techniqueText = this.scene.add
      .text(-154, -18, action.name, {
        color: "#ffe9dc",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "20px",
        fontStyle: "900",
      })
      .setOrigin(0, 0);

    const typeText = this.scene.add
      .text(-154, 28, action.description, {
        color: "#f7c7d2",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "15px",
        fontStyle: "800",
        lineSpacing: 2,
        wordWrap: { width: 308, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);

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
