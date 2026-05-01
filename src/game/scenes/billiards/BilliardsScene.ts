import Phaser from "phaser";
import attractSfxUrl from "../../../assets/attract.mp3";
import breakSfxUrl from "../../../assets/break.mp3";
import changeStateSfxUrl from "../../../assets/change_state.mp3";
import collideSfxUrl from "../../../assets/collide.wav";
import explodeSfxUrl from "../../../assets/explode.mp3";
import graveyardTileUrl from "../../../assets/graveyard_tile.png";
import healSfxUrl from "../../../assets/heal.mp3";
import magicCircleUrl from "../../../assets/magic_circle.png";
import pocketSfxUrl from "../../../assets/pocket.wav";
import poisonTileUrl from "../../../assets/poison_tile.png";
import repulseSfxUrl from "../../../assets/repulse.mp3";
import shotSfxUrl from "../../../assets/shot.wav";
import tableBgUrl from "../../../assets/table_bg.png";
import warpSfxUrl from "../../../assets/warp.mp3";
import bgmUrl from "../../../assets/夜想ラヂオ.ogg";
import {
  CONTROL_AREA_MARGIN_HEIGHT,
  CONTROL_AREA_MARGIN_WIDTH,
  CUE_START,
  DEBUG_MODE,
  GAME_FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_POWER,
  POWER_CHARGE_MS,
  TABLE,
} from "../../config";
import { isDialogueSkipEnabled } from "../../dialogueSettings";
import { isCueHpBarHidden } from "../../displaySettings";
import { getBgmVolume, getSfxVolume } from "../../soundSettings";
import {
  getText,
  isTextCode,
  TextCode,
  type TextCodeType,
} from "../../text/TextDictionary";
import { createButton, type PhaserButton } from "../../ui";
import {
  getStageStartDialogue,
  NAVIGATOR_NAME,
} from "../dialogue/DialogueScripts";
import { discoverBall, discoverBalls } from "../encyclopedia/EncyclopediaDiscovery";
import { Ball } from "./Ball";
import {
  BallCode,
  BallProperties,
  BallSpecialActionCode,
  type BallCode as BallCodeType,
  type BallProperty,
  type BallVisualType,
} from "./BallProperty";
import { EnemyTurnController } from "./enemy/EnemyTurnController";
import {
  GlobalBuffCode,
  type GlobalBuffCode as GlobalBuffCodeType,
} from "./GlobalBuff";
import { HazardSystem } from "./hazards/HazardSystem";
import { ItemInventory } from "./items/ItemInventory";
import { BallPhysicsSystem } from "./physics/BallPhysicsSystem";
import { PocketSystem } from "./pockets/PocketSystem";
import { PredictionSystem } from "./prediction/PredictionSystem";
import { PlayerActionController } from "./player/PlayerActionController";
import { RouletteController } from "./roulette/RouletteController";
import type { StageShotRecord } from "./RunResultShare";
import {
  ItemCode,
  Items,
  type Item,
  type ItemCode as ItemCodeType,
} from "./shop/item/Item";
import { Stages, type Stage, type StageObstacle } from "./Stage";
import { BilliardsHud } from "./ui/BilliardsHud";
import { SplashText } from "./ui/SplashText";

type RunState =
  | "aiming"
  | "rolling"
  | "enemy"
  | "hazard"
  | "cleared"
  | "failed";
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

type MarkerEffectConfig = {
  radius: number;
  damage?: number;
  damageReason?: TextCodeType | string;
  forceMultiplier: number;
  status: string;
  sound?: "explode" | "attract" | "repulse";
};

type CompleteStageOptions = {
  clearSceneDelayMs?: number;
};

type TableFeltPalette = {
  bumperColor: number;
  feltColor: number;
  feltLight: number;
  feltDark: number;
  stripeA: number;
  stripeB: number;
  speckLight: number;
  speckDark: number;
  highlightLine: number;
};

const BGM_KEY = "billiards-bgm";
const DIALOGUE_SCENE_KEY = "DialogueScene";
const ATTRACT_SFX_KEY = "billiards-attract";
const BREAK_SFX_KEY = "billiards-break";
const CHANGE_STATE_SFX_KEY = "billiards-change-state";
const SHOT_SFX_KEY = "billiards-shot";
const COLLIDE_SFX_KEY = "billiards-collide";
const EXPLODE_SFX_KEY = "billiards-explode";
const HEAL_SFX_KEY = "billiards-heal";
const POCKET_SFX_KEY = "billiards-pocket";
const REPULSE_SFX_KEY = "billiards-repulse";
const WARP_SFX_KEY = "billiards-warp";
const GRAVEYARD_TILE_KEY = "billiards-graveyard-tile";
const MAGIC_CIRCLE_KEY = "billiards-magic-circle";
const POISON_TILE_KEY = "billiards-poison-tile";
const TABLE_BG_KEY = "billiards-table-bg";
const COLLIDE_SOUND_COOLDOWN_MS = 45;
const HIT_MONEY_COOLDOWN_MS = 90;
const MIN_SHOT_CHARGE = 0.04;
const VITAL_CORE_HP_BONUS = 20;
const SPLASH_POSITION_JITTER = 10;
const BLAST_MARKER_RADIUS = 90;
const BLAST_MARKER_DAMAGE = 35;
const BLAST_MARKER_MAX_FORCE = 1.8;
const REPULSE_MARKER_FORCE_MULTIPLIER = 10;
const ATTRACT_MARKER_RADIUS_MULTIPLIER = 1.5;
const ATTRACT_MARKER_FORCE_MULTIPLIER = 1;
const ENEMY_TURN_FRICTION_MULTIPLIER = 3;
const PORCELAIN_SHIELD_BLOCK_RATE_REDUCTION = 0.05;
const TEMPORARY_CUE_WEIGHT_SCALE = 2;
const PHASING_BALL_ALPHA = 0.46;
const CUE_BALL_CATEGORY = 0x0002;
const ENEMY_BALL_CATEGORY = 0x0004;
const CASINO_STAGE_START_NUMBER = 6;
const CASINO_STAGE_END_NUMBER = 8;
const SPOOKY_STAGE_START_NUMBER = 9;
const SPOOKY_STAGE_END_NUMBER = 11;
const ROLLING_SETTLE_MS = 220;

type AdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

export class BilliardsScene extends Phaser.Scene {
  private balls: Ball[] = [];
  private money = 0;
  private totalEarnedMoney = 0;
  private shots = 0;
  private stageShotRecords: StageShotRecord[] = [];
  private stageEarnedMoney = 0;
  private stageShots = 0;
  private state: RunState = "aiming";
  private charging = false;
  private chargeStartedAt = 0;
  private pointerInControlArea = false;
  private penaltyWaivers = 0;
  private backspinShots = 0;
  private backspinBouncesRemaining = 0;
  private lastCollideSoundAt = Number.NEGATIVE_INFINITY;
  private lastHitMoneyAtByPair = new Map<string, number>();
  private lastPenalizedShotCount = 0;
  private inventory = new ItemInventory();
  private obstacles: StageObstacle[] = [];
  private currentStageIndex = 0;
  private itemMovementInProgress = false;
  private rollingStoppedAt?: number;
  private clearPresentationActive = false;
  private temporaryCueGrowthActive = false;
  private temporaryCueGrowthRevertPending = false;
  private temporaryCueWeightActive = false;
  private temporaryCueWeightRevertPending = false;
  private temporaryCuePhaseActive = false;
  private temporaryCuePhaseRevertPending = false;
  private phasingBalls = new Set<Ball>();
  private executedMagicCircleSealBreaks = new Set<number>();
  private pointerWorld = new Phaser.Math.Vector2(
    CUE_START.x + 120,
    CUE_START.y,
  );

  private tableLayer?: Phaser.GameObjects.Graphics;
  private tableBg?: Phaser.GameObjects.Image;
  private tableLogo?: Phaser.GameObjects.Text;
  private obstacleLayer?: Phaser.GameObjects.Graphics;
  private pocketLayer?: Phaser.GameObjects.Graphics;
  private aimLine?: Phaser.GameObjects.Graphics;
  private hazards?: HazardSystem;
  private enemyTurn?: EnemyTurnController;
  private ballPhysics?: BallPhysicsSystem;
  private pockets?: PocketSystem;
  private prediction?: PredictionSystem;
  private playerActions?: PlayerActionController;
  private roulette?: RouletteController;
  private hud?: BilliardsHud;
  private menuButton?: PhaserButton;
  private splashText?: SplashText;
  private magicCircleWindow?: Phaser.GameObjects.Container;
  private magicCircleWindowQueue: Array<{ code: BallCodeType; count: number }> = [];
  private magicCircleWindowDelayEvent?: Phaser.Time.TimerEvent;
  private pendingClearSceneEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super("BilliardsScene");
  }

  preload() {
    this.load.audio(BGM_KEY, bgmUrl);
    this.load.audio(ATTRACT_SFX_KEY, attractSfxUrl);
    this.load.audio(BREAK_SFX_KEY, breakSfxUrl);
    this.load.audio(CHANGE_STATE_SFX_KEY, changeStateSfxUrl);
    this.load.audio(SHOT_SFX_KEY, shotSfxUrl);
    this.load.audio(COLLIDE_SFX_KEY, collideSfxUrl);
    this.load.audio(EXPLODE_SFX_KEY, explodeSfxUrl);
    this.load.audio(HEAL_SFX_KEY, healSfxUrl);
    this.load.audio(POCKET_SFX_KEY, pocketSfxUrl);
    this.load.audio(REPULSE_SFX_KEY, repulseSfxUrl);
    this.load.audio(WARP_SFX_KEY, warpSfxUrl);
    this.load.image(GRAVEYARD_TILE_KEY, graveyardTileUrl);
    this.load.image(MAGIC_CIRCLE_KEY, magicCircleUrl);
    this.load.image(POISON_TILE_KEY, poisonTileUrl);
    this.load.image(TABLE_BG_KEY, tableBgUrl);
  }

  create() {
    this.matter.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor("#151019");
    this.startBgm();
    this.splashText = new SplashText(this);

    this.tableLayer = this.add.graphics();
    this.tableBg = this.add.image(0, 0, TABLE_BG_KEY);
    this.tableLogo = this.add.text(0, 0, "Billinerds", {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "34px",
      fontStyle: "700",
    });
    const hazardLayer = this.add.graphics();
    hazardLayer.setDepth(5);
    this.obstacleLayer = this.add.graphics();
    this.obstacleLayer.setDepth(10);
    this.pocketLayer = this.add.graphics();
    this.pocketLayer.setDepth(15);
    this.aimLine = this.add.graphics();
    this.aimLine.setDepth(40);
    this.playerActions = new PlayerActionController(
      this,
      {
        getState: () => this.state,
        setState: (state) => {
          this.state = state;
        },
        getCharging: () => this.charging,
        setCharging: (charging) => {
          this.charging = charging;
        },
        getBalls: () => this.balls,
        getCueBall: () => this.getCueBall(),
        getItemUsesRemaining: (itemCode) => this.getItemUsesRemaining(itemCode),
        consumeItemUse: (item) => this.consumeItemUse(item),
        updateHud: (status) => this.updateHud(status),
        showStatusSplash: (label) => this.showStatusSplash(label),
        isPointerInControlArea: (pointer) =>
          this.isPointerInControlArea(pointer),
        canPlaceBallAt: (ball, x, y) => this.canPlaceBallAt(ball, x, y),
        getBallDisplayName: (ball) => this.getBallDisplayName(ball),
        resizeBall: (ball, radiusScale, weightScale) =>
          this.resizeBall(ball, radiusScale, weightScale),
        activateBlastMarker: (center) => this.activateBlastMarker(center),
        activateRepulseMarker: (center) => this.activateRepulseMarker(center),
        activateAttractMarker: (center) => this.activateAttractMarker(center),
        relocateCueBall: (cueBall, x, y) => this.relocateCueBall(cueBall, x, y),
        tiltTable: () => this.tiltTable(),
        gatherBalls: () => this.gatherBalls(),
        getCueBallMissingHp: () => this.getCueBallMissingHp(),
        healCueBall: (amount) => this.healCueBall(amount),
        canActivateTemporaryCueGrowth: () =>
          this.canActivateTemporaryCueGrowth(),
        activateTemporaryCueGrowth: () => this.activateTemporaryCueGrowth(),
        canActivateTemporaryCueWeight: () =>
          this.canActivateTemporaryCueWeight(),
        activateTemporaryCueWeight: () => this.activateTemporaryCueWeight(),
        canActivateTemporaryCuePhase: () =>
          this.canActivateTemporaryCuePhase(),
        activateTemporaryCuePhase: () => this.activateTemporaryCuePhase(),
        slowAllBalls: (scale) => this.slowAllBalls(scale),
        addBackspinShot: () => {
          this.backspinShots += 1;
        },
        addPenaltyWaiver: () => {
          this.penaltyWaivers += 1;
        },
        damageTargetBalls: (amount, reason) =>
          this.damageTargetBalls(amount, reason),
        endPlayerTurn: () => this.endPlayerTurnFromItem(),
      },
      {
        blast: BLAST_MARKER_RADIUS,
        repulse: BLAST_MARKER_RADIUS,
        attract: BLAST_MARKER_RADIUS * ATTRACT_MARKER_RADIUS_MULTIPLIER,
      },
    );
    this.hazards = new HazardSystem(
      hazardLayer,
      {
        showDamageSplash: (position, damage, reason) =>
          this.showDamageSplashAt(position, damage, reason),
        showHealSplash: (position, amount, reason) =>
          this.showHealSplashAt(position, amount, reason),
        hasPoisonImmunity: (ball) => this.hasPoisonImmunityBuff(ball),
        getDamageAfterTargetModifiers: (ball, damage) =>
          this.getDamageAfterTargetModifiers(ball, damage),
        onBallDamaged: (ball) => this.flashCueDamage(ball),
      },
      POISON_TILE_KEY,
      GRAVEYARD_TILE_KEY,
      MAGIC_CIRCLE_KEY,
    );
    this.ballPhysics = new BallPhysicsSystem({
      getBalls: () => this.balls,
      getDraggedBall: () => this.playerActions?.getDraggedBall() ?? null,
      getBackspinBouncesRemaining: () => this.backspinBouncesRemaining,
      consumeBackspinBounce: () => {
        if (this.backspinBouncesRemaining > 0) {
          this.backspinBouncesRemaining -= 1;
        }
      },
      getFrictionMultiplier: (ball) => {
        const hazardMultiplier = this.hazards?.getFrictionMultiplier(ball) ?? 1;
        return this.state === "enemy"
          ? hazardMultiplier * ENEMY_TURN_FRICTION_MULTIPLIER
          : hazardMultiplier;
      },
      getBallTravelBounds: (radius) => this.getBallTravelBounds(radius),
      getObstacles: () => this.obstacles,
      playCollideSound: () => this.playCollideSound(),
      applyBallCollisionEffects: (a, b, position) =>
        this.applyBallCollisionEffects(a, b, position),
      canBallsCollide: (a, b) => this.canBallsCollide(a, b),
    });
    this.pockets = new PocketSystem(this, this.pocketLayer, {
      getBalls: () => this.balls,
      getDraggedBall: () => this.playerActions?.getDraggedBall() ?? null,
      getWidePocketCount: () => this.getOwnedItemCount(ItemCode.WidePocket),
      getCuePocketDamage: () => this.getCuePocketDamage(),
      getBallTravelBounds: (radius) => this.getBallTravelBounds(radius),
      canPlaceBallAt: (ball, x, y) => this.canPlaceBallAt(ball, x, y),
      canCheckPockets: () =>
        this.state !== "hazard" &&
        this.state !== "cleared" &&
        this.state !== "failed",
      areBallsStopped: () => this.areBallsStopped(),
      isRolling: () => this.state === "rolling",
      onRespawnedWhileRollingStopped: () =>
        this.handleRespawnedWhileRollingStopped(),
      playPocketSound: () => this.playPocketSound(),
      getDamageAfterTargetModifiers: (ball, damage) =>
        this.getDamageAfterTargetModifiers(ball, damage),
      showDamageSplashAt: (position, damage) =>
        this.showDamageSplashAt(position, damage),
      onBallDamaged: (ball) => this.flashCueDamage(ball),
      onBallDefeated: (ball) => this.removeGlobalBuffsFromSource(ball),
      disableBallPhysics: (ball) => this.disableBallPhysics(ball),
      enableBallPhysics: (ball) => this.enableBallPhysics(ball),
      updateHud: (status) => this.updateHud(status),
      failRun: () => this.failRunByCueHp(),
      completeStage: () => this.completeStage(),
      areAllTargetBallsDefeated: () => this.areAllTargetBallsDefeated(),
      getBallDisplayName: (ball) => this.getBallDisplayName(ball),
    });
    this.enemyTurn = new EnemyTurnController(this, {
      getBalls: () => this.balls,
      getCueBall: () => this.getCueBall(),
      areBallsStopped: () => this.areBallsStopped(),
      applyHazardStopDamage: () => this.applyHazardStopDamage(),
      getObstacles: () => this.obstacles,
      getBallTravelBounds: (radius) => this.getBallTravelBounds(radius),
      canPlaceBallAt: (ball, x, y) => this.canPlaceBallAt(ball, x, y),
      isBallPhasing: (ball) => this.isBallPhasing(ball),
      getBallAttack: (ball) => this.getAttack(ball),
      getDamageAfterTargetModifiers: (ball, damage) =>
        this.getDamageAfterTargetModifiers(ball, damage),
      showDamageSplashAt: (position, damage, reason) =>
        this.showDamageSplashAt(position, damage, reason),
      showHealSplash: (position, amount) =>
        this.showHealSplashAt(position, amount),
      onBallDamaged: (ball) => this.flashCueDamage(ball),
      resolveDamageDefeats: (options) => this.resolveDamageDefeats(options),
      findChipMultiplyPosition: (source) => this.findChipMultiplyPosition(source),
      findRandomEnemySpawnPosition: (code, options) =>
        this.findRandomEnemySpawnPosition(code, options),
      spawnEnemyBall: (code, x, y) => this.spawnEnemyBall(code, x, y),
      playHealSound: () => this.playHealSound(),
      playShotSound: () => this.playShotSound(),
      playExplodeSound: () => this.playExplodeSound(),
      playWarpSound: () => this.playWarpSound(),
      showExplosionAnimation: (center, radius) =>
        this.showBlastMarkerAnimation(center, radius),
      applyRadialVelocity: (ball, center, distance, options) =>
        this.applyRadialVelocity(ball, center, distance, options),
      setBallPhasing: (ball, active) => this.setBallPhasing(ball, active),
      clearPhasingBalls: () => this.clearPhasingBalls(),
      updateHud: (status) => this.updateHud(status),
    });
    this.hud = new BilliardsHud(this, {
      onUseItem: (item) => this.playerActions?.useOwnedItem(item),
      canUseItem: (item) => this.playerActions?.canUseOwnedItem(item) ?? false,
      getItemUsesRemaining: (itemCode) => this.getItemUsesRemaining(itemCode),
      getItemMaxUses: (item, count) => this.getItemMaxUses(item, count),
      getBallAttack: (ball) => this.getAttack(ball),
      getBallBlockRate: (ball) => this.getEffectiveBlockRate(ball),
    });
    this.prediction = new PredictionSystem(this, this.aimLine, {
      getBalls: () => this.balls,
      getObstacles: () => this.obstacles,
      getCueBall: () => this.getCueBall(),
      getPointerWorld: () => this.pointerWorld,
      getPointerInControlArea: () => this.pointerInControlArea,
      getCharging: () => this.charging,
      getChargeStartedAt: () => this.chargeStartedAt,
      getState: () => this.state,
      isDragMode: () => this.playerActions?.isDragMode() ?? false,
      isMagnifyMode: () => this.playerActions?.isMagnifyMode() ?? false,
      isMinifyMode: () => this.playerActions?.isMinifyMode() ?? false,
      hasTargetedItemMode: () =>
        this.playerActions?.hasTargetedItemMode() ?? false,
      getBallTravelBounds: (radius) => this.getBallTravelBounds(radius),
      drawPowerRing: (cueBall, ratio, visible) =>
        this.hud?.drawPowerRing(cueBall, ratio, visible),
    });
    this.roulette = new RouletteController(this, {
      getRoulettes: () => this.hazards?.getRoulettes() ?? [],
      getCueBall: () => this.getCueBall(),
      getRouletteSegmentAtPoint: (roulette, x, y) =>
        this.hazards?.getRouletteSegmentAtPoint(roulette, x, y) ?? null,
      drawRouletteSelection: (roulette, activeIndex) =>
        this.hazards?.drawRouletteSelection(roulette, activeIndex),
      setState: (state) => {
        this.state = state;
      },
      getState: () => this.state,
      setCharging: (charging) => {
        this.charging = charging;
      },
      hideBallTooltip: () => this.hideBallTooltip(),
      clearTargetPreview: () => this.playerActions?.clearTargetPreview(),
      updateHud: (status) => this.updateHud(status),
      finishPostPlayerHazards: () => this.finishPostPlayerHazards(),
      gainMoney: (amount, position) => this.gainMoney(amount, position),
      spawnEnemyBall: (code, x, y) => Boolean(this.spawnEnemyBall(code, x, y)),
      getBallTravelBounds: (radius) => this.getBallTravelBounds(radius),
      canPlaceBallAt: (ball, x, y) => this.canPlaceBallAt(ball, x, y),
      flashCueDamage: (ball) => this.flashCueDamage(ball),
      showDamageSplashAt: (position, damage, reason) =>
        this.showDamageSplashAt(position, damage, reason),
      showStatusSplash: (label) => this.showStatusSplash(label),
      resizeLivingBalls: (radiusScale, weightScale) =>
        this.resizeLivingBalls(radiusScale, weightScale),
      resolveDamageDefeats: () => this.resolveDamageDefeats(),
    });
    this.drawTable();
    this.placeTableBackground();
    this.pockets?.drawPockets();
    this.createRails();
    this.hud.create();
    this.renderOwnedItems();
    this.menuButton = createButton(this, {
      x: GAME_WIDTH - 36,
      y: 36,
      width: 40,
      height: 40,
      label: "≡",
      fontSize: 24,
      onClick: () => this.openMenu(),
    });
    this.menuButton.setEnabled(this.state === "aiming");
    this.input.mouse?.disableContextMenu();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld.set(pointer.x, pointer.y);
      this.pointerInControlArea = this.isPointerInControlArea(pointer);
      this.playerActions?.handlePointerMove(pointer);
      this.updateBallTooltip(pointer);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld.set(pointer.x, pointer.y);
      this.pointerInControlArea = this.isPointerInControlArea(pointer);
      this.hideBallTooltip();
      if (pointer.button === 2) {
        if (this.playerActions?.cancelSelectableMode()) return;
        this.cancelShotCharge();
        return;
      }
      if (pointer.button !== 0) return;
      if (this.playerActions?.handlePointerDown(pointer)) return;
      if (this.state !== "aiming") return;
      if (!this.pointerInControlArea) return;
      this.charging = true;
      this.chargeStartedAt = this.time.now;
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld.set(pointer.x, pointer.y);
      this.pointerInControlArea = this.isPointerInControlArea(pointer);
      if (pointer.button === 2) {
        this.cancelShotCharge();
        this.updateBallTooltip(pointer);
        return;
      }
      this.releaseShot();
      this.updateBallTooltip(pointer);
    });
    this.input.keyboard?.on("keydown-D", () => this.debugDamageTargets());
    this.input.keyboard?.on("keydown-F", () => this.debugMoveStage(1));
    this.input.keyboard?.on("keydown-S", () => this.debugMoveStage(-1));
    this.input.keyboard?.on("keydown-C", () => this.debugGameClear());
    this.input.keyboard?.on("keydown-X", () => this.debugGameOver());
    this.matter.world.on(
      "collisionstart",
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) =>
        this.ballPhysics?.handleMatterCollisionStart(event),
    );
    this.events.on("restart-run", () => this.resetRun());
    this.events.on("advance-stage", () => this.advanceStage());
    this.events.on("purchase-item", (itemCode: ItemCodeType, price: number) =>
      this.purchaseItem(itemCode, price),
    );
    this.events.on("spend-money", (amount: number) => this.spendMoney(amount));
    this.events.on("quit-to-title", () => this.quitToTitle());

    this.resetRun();
  }

  private startBgm() {
    const existing = this.sound.get(BGM_KEY);
    const bgm =
      existing ??
      this.sound.add(BGM_KEY, {
        loop: true,
        volume: getBgmVolume(),
      });
    setSoundVolume(bgm, getBgmVolume());

    if (bgm.isPlaying) return;

    if (this.sound.locked) {
      this.input.once("pointerdown", () => {
        if (!bgm.isPlaying) bgm.play();
      });
      return;
    }

    bgm.play();
  }

  update() {
    const isTerminalState = this.clearPresentationActive ||
      this.state === "cleared" ||
      this.state === "failed";

    if (!isTerminalState && this.state !== "hazard") {
      this.ballPhysics?.resolveContinuousBallCollisions();
      this.ballPhysics?.applyRollingFriction();
      this.pockets?.checkPockets();
      this.ballPhysics?.keepBallsInsideTable();
      this.ballPhysics?.keepBallsOutsideObstacles();

      if (this.state === "rolling") {
        if (this.areBallsStopped()) {
          this.rollingStoppedAt ??= this.time.now;
          if (this.time.now - this.rollingStoppedAt >= ROLLING_SETTLE_MS) {
            this.rollingStoppedAt = undefined;
            this.finishPlayerMovement();
          }
        } else {
          this.rollingStoppedAt = undefined;
        }
      }

      if (this.state === "enemy") {
        this.updateEnemyTurn();
      }
    }

    this.prediction?.draw();
    this.enemyTurn?.drawActionRing();
    if (isTerminalState) {
      this.enemyTurn?.clearPersistentEffects();
    } else {
      this.enemyTurn?.drawConfettiBombRanges();
    }
    this.syncBallLabels();
    if (this.state !== "aiming") this.hideBallTooltip();
    this.menuButton?.setEnabled(this.state === "aiming");
    this.refreshOwnedItems();
    this.ballPhysics?.updatePreviousBallPositions();
  }

  private openMenu() {
    if (this.state !== "aiming") return;

    this.hideBallTooltip();
    this.playerActions?.clearTargetPreview();
    this.charging = false;
    this.scene.launch("MenuScene", {
      currentStageNumber: this.currentStageIndex + 1,
      resumeSceneKey: this.scene.key,
    });
    this.scene.bringToTop("MenuScene");
    this.scene.pause();
  }

  private resetRun() {
    this.playerActions?.reset();
    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearMagicCircleWindow();
    this.clearPresentationActive = false;
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.clearSplashTexts();
    this.scene.stop("GameOverScene");
    this.scene.stop("GameClearScene");
    this.scene.stop("StageClearScene");
    this.scene.stop("ShopScene");
    this.scene.stop(DIALOGUE_SCENE_KEY);

    for (const ball of this.balls) {
      ball.destroy();
    }

    this.balls = [];
    this.money = DEBUG_MODE ? 10000 : 0;
    this.totalEarnedMoney = 0;
    this.shots = 0;
    this.stageShotRecords = [];
    this.stageEarnedMoney = 0;
    this.stageShots = 0;
    this.lastPenalizedShotCount = 0;
    this.lastHitMoneyAtByPair.clear();
    this.inventory.reset();
    if (DEBUG_MODE) {
      this.addDebugInitialItems();
    }
    this.resetItemUsesForStage();
    this.currentStageIndex = 0;
    this.state = "aiming";
    this.charging = false;
    this.playerActions?.reset();
    this.penaltyWaivers = 0;
    this.backspinShots = 0;
    this.backspinBouncesRemaining = 0;
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.enemyTurn?.clear();
    this.menuButton?.setEnabled(true);
    this.renderOwnedItems();
    this.pockets?.drawPockets();
    this.drawTable();
    this.createBalls();
    this.updateHud("Ready");
    this.showStageStartDialogue();
  }

  private quitToTitle() {
    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearPresentationActive = false;
    this.sound.get(BGM_KEY)?.stop();
    this.scene.stop("MenuScene");
    this.scene.start("TitleScene");
  }

  private drawTable() {
    const g = this.tableLayer!;
    const feltPalette = this.getTableFeltPalette();
    g.clear();

    g.fillStyle(0x0a0a0f, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    g.fillStyle(0x000000, 0.34);
    g.fillRoundedRect(
      TABLE.x + 12,
      TABLE.y + 18,
      TABLE.width,
      TABLE.height,
      30,
    );

    g.fillStyle(TABLE.railColor, 1);
    g.fillRoundedRect(TABLE.x, TABLE.y, TABLE.width, TABLE.height, 26);
    g.fillStyle(0x3e1e0d, 0.42);
    g.fillRoundedRect(
      TABLE.x + 10,
      TABLE.y + 12,
      TABLE.width - 20,
      TABLE.height - 24,
      22,
    );
    g.lineStyle(4, TABLE.railLight, 1);
    g.strokeRoundedRect(TABLE.x, TABLE.y, TABLE.width, TABLE.height, 26);
    g.lineStyle(2, 0xffd08a, 0.35);
    g.strokeRoundedRect(
      TABLE.x + 10,
      TABLE.y + 10,
      TABLE.width - 20,
      TABLE.height - 20,
      20,
    );

    g.fillStyle(feltPalette.bumperColor, 1);
    g.fillRoundedRect(
      TABLE.x + TABLE.rail,
      TABLE.y + TABLE.rail,
      TABLE.width - TABLE.rail * 2,
      TABLE.height - TABLE.rail * 2,
      18,
    );
    g.lineStyle(3, feltPalette.highlightLine, 0.24);
    g.strokeRoundedRect(
      TABLE.x + TABLE.rail + 5,
      TABLE.y + TABLE.rail + 5,
      TABLE.width - TABLE.rail * 2 - 10,
      TABLE.height - TABLE.rail * 2 - 10,
      14,
    );

    g.fillStyle(feltPalette.feltColor, 1);
    g.fillRoundedRect(
      TABLE.x + TABLE.rail + 12,
      TABLE.y + TABLE.rail + 12,
      TABLE.width - TABLE.rail * 2 - 24,
      TABLE.height - TABLE.rail * 2 - 24,
      12,
    );
    g.fillStyle(feltPalette.feltLight, 0.16);
    g.fillRoundedRect(
      TABLE.x + TABLE.rail + 28,
      TABLE.y + TABLE.rail + 24,
      TABLE.width - TABLE.rail * 2 - 56,
      TABLE.height - TABLE.rail * 2 - 48,
      10,
    );
    g.fillStyle(feltPalette.feltDark, 0.16);
    g.fillRect(
      TABLE.x + TABLE.rail + 12,
      TABLE.y + TABLE.rail + 12,
      TABLE.width - TABLE.rail * 2 - 24,
      42,
    );

    const feltLeft = TABLE.x + TABLE.rail + 18;
    const feltRight = TABLE.x + TABLE.width - TABLE.rail - 18;
    const feltTop = TABLE.y + TABLE.rail + 18;
    const feltBottom = TABLE.y + TABLE.height - TABLE.rail - 18;
    for (let i = 0; i < 48; i++) {
      const y = feltTop + i * ((feltBottom - feltTop) / 47);
      g.lineStyle(
        1,
        i % 2 === 0 ? feltPalette.stripeA : feltPalette.stripeB,
        0.08,
      );
      g.lineBetween(feltLeft, y, feltRight, y);
    }
    for (let i = 0; i < 120; i++) {
      const x = feltLeft + ((i * 73) % Math.floor(feltRight - feltLeft));
      const y = feltTop + ((i * 47) % Math.floor(feltBottom - feltTop));
      g.fillStyle(
        i % 3 === 0 ? feltPalette.speckLight : feltPalette.speckDark,
        i % 3 === 0 ? 0.08 : 0.09,
      );
      g.fillCircle(x, y, i % 5 === 0 ? 1.4 : 0.8);
    }
  }

  private getTableFeltPalette(): TableFeltPalette {
    const stageNumber = this.currentStageIndex + 1;

    if (
      stageNumber >= SPOOKY_STAGE_START_NUMBER &&
      stageNumber <= SPOOKY_STAGE_END_NUMBER
    ) {
      return {
        feltColor: 0x46505f,
        bumperColor: 0x343947,
        feltLight: 0x657088,
        feltDark: 0x242936,
        stripeA: 0x707a90,
        stripeB: 0x343948,
        speckLight: 0xd6d8ef,
        speckDark: 0x151824,
        highlightLine: 0xb5b6d8,
      };
    }

    if (
      stageNumber >= CASINO_STAGE_START_NUMBER &&
      stageNumber <= CASINO_STAGE_END_NUMBER
    ) {
      return {
        feltColor: 0x8f1f34,
        bumperColor: 0x72182a,
        feltLight: 0xb93248,
        feltDark: 0x551120,
        stripeA: 0xc83a52,
        stripeB: 0x681629,
        speckLight: 0xffd0bd,
        speckDark: 0x3b0813,
        highlightLine: 0xff8f9d,
      };
    }

    return {
      feltColor: TABLE.feltColor,
      bumperColor: TABLE.bumperColor,
      feltLight: 0x1aa66b,
      feltDark: TABLE.feltShadow,
      stripeA: 0x1fbf78,
      stripeB: 0x0a5f40,
      speckLight: 0xd8ffcf,
      speckDark: 0x073926,
      highlightLine: 0x7fe5ad,
    };
  }

  private placeTableBackground() {
    const feltX = TABLE.x + TABLE.rail + 12;
    const feltY = TABLE.y + TABLE.rail + 12;
    const feltWidth = TABLE.width - TABLE.rail * 2 - 24;
    const feltHeight = TABLE.height - TABLE.rail * 2 - 24;

    this.tableBg
      ?.setOrigin(0, 0)
      .setPosition(feltX, feltY)
      .setDisplaySize(feltWidth, feltHeight)
      .setAlpha(0.18)
      .setBlendMode(Phaser.BlendModes.SOFT_LIGHT);

    this.tableLogo
      ?.setOrigin(1, 1)
      .setPosition(feltX + feltWidth - 24, feltY + feltHeight - 22)
      .setAlpha(0.2)
      .setRotation(-0.03)
      .setBlendMode(Phaser.BlendModes.SOFT_LIGHT);
  }

  private createRails() {
    // Wall collisions are handled manually in keepBallsInsideTable so the
    // prediction line and actual reflection use the same center-line bounds.
  }

  private renderOwnedItems() {
    this.hud?.renderOwnedItems(this.inventory.getEntries());
  }

  private addDebugInitialItems() {
    for (const item of Items) {
      if (!item.debugDefault) continue;

      const count = item.isUnique ? 1 : 10;
      for (let index = 0; index < count; index += 1) {
        this.inventory.add(item.code);
      }
    }
  }

  private refreshOwnedItems() {
    this.hud?.refreshOwnedItems(this.inventory.getEntries());
  }

  private consumeItemUse(item: Item): boolean {
    if (!this.inventory.consumeUse(item)) return false;
    this.renderOwnedItems();
    return true;
  }

  private resetItemUsesForStage() {
    this.inventory.resetUsesForStage();
  }

  private getItemUsesRemaining(itemCode: ItemCodeType): number {
    return this.inventory.getUsesRemaining(itemCode);
  }

  private getItemMaxUses(item: Item, count: number): number {
    return this.inventory.getMaxUses(item, count);
  }

  private getCueBallMissingHp(): number {
    const cueBall = this.balls.find((ball) => ball.ballKind === "cue");
    if (!cueBall || cueBall.hp <= 0) return 0;

    return Math.max(0, cueBall.maxHp - cueBall.hp);
  }

  private healCueBall(amount: number) {
    const cueBall = this.balls.find((ball) => ball.ballKind === "cue");
    if (!cueBall || cueBall.hp <= 0 || amount <= 0) return;

    const actualHeal = Math.min(amount, cueBall.maxHp - cueBall.hp);
    cueBall.hp = Math.min(cueBall.maxHp, cueBall.hp + actualHeal);
    this.showStatusSplashByCode(TextCode.statusCueHeal, { amount: actualHeal });
    this.updateHud();
  }

  private canActivateTemporaryCueGrowth(): boolean {
    if (this.temporaryCueGrowthActive) return false;

    const cueBall = this.getCueBall();
    return !!cueBall && cueBall.hp > 0 && !cueBall.pocketed;
  }

  private activateTemporaryCueGrowth() {
    if (!this.canActivateTemporaryCueGrowth()) return;

    const cueBall = this.getCueBall();
    if (!cueBall) return;

    this.resizeBall(cueBall, 2, 4);
    this.temporaryCueGrowthActive = true;
    this.temporaryCueGrowthRevertPending = false;
    this.playChangeStateSound();
    this.showStatusSplashByCode(TextCode.statusGiantChalk);
    this.renderOwnedItems();
  }

  private canActivateTemporaryCueWeight(): boolean {
    if (this.temporaryCueWeightActive) return false;

    const cueBall = this.getCueBall();
    return !!cueBall && cueBall.hp > 0 && !cueBall.pocketed;
  }

  private activateTemporaryCueWeight() {
    if (!this.canActivateTemporaryCueWeight()) return;

    const cueBall = this.getCueBall();
    if (!cueBall) return;

    this.scaleBallWeight(cueBall, TEMPORARY_CUE_WEIGHT_SCALE);
    this.temporaryCueWeightActive = true;
    this.temporaryCueWeightRevertPending = false;
    this.showStatusSplashByCode(TextCode.statusHeavyCue);
    this.renderOwnedItems();
  }

  private canActivateTemporaryCuePhase(): boolean {
    if (this.temporaryCuePhaseActive) return false;

    const cueBall = this.getCueBall();
    return !!cueBall && cueBall.hp > 0 && !cueBall.pocketed;
  }

  private activateTemporaryCuePhase() {
    if (!this.canActivateTemporaryCuePhase()) return;

    const cueBall = this.getCueBall();
    if (!cueBall) return;

    this.setBallPhasing(cueBall, true);
    this.temporaryCuePhaseActive = true;
    this.temporaryCuePhaseRevertPending = false;
    this.playChangeStateSound();
    this.showStatusSplashByCode(TextCode.statusPhaseCue);
    this.renderOwnedItems();
  }

  private relocateCueBall(cueBall: Ball, x: number, y: number) {
    cueBall.sprite.setPosition(x, y);
    cueBall.sprite.setVelocity(0, 0);
    cueBall.sprite.setAngularVelocity(0);
    cueBall.label?.setPosition(x, y);
    cueBall.previousPosition.set(x, y);
    cueBall.pocketImmuneUntil = this.time.now + 650;
    this.updateHud("Cue relocated");
  }

  private markTemporaryCueGrowthForRevert() {
    if (!this.temporaryCueGrowthActive) return;

    this.temporaryCueGrowthRevertPending = true;
    this.renderOwnedItems();
  }

  private markTemporaryCueWeightForRevert() {
    if (!this.temporaryCueWeightActive) return;

    this.temporaryCueWeightRevertPending = true;
    this.renderOwnedItems();
  }

  private markTemporaryCuePhaseForRevert() {
    if (!this.temporaryCuePhaseActive) return;

    this.temporaryCuePhaseRevertPending = true;
    this.renderOwnedItems();
  }

  private markTemporaryCueEffectsForRevert() {
    this.markTemporaryCueGrowthForRevert();
    this.markTemporaryCueWeightForRevert();
    this.markTemporaryCuePhaseForRevert();
  }

  private revertTemporaryCueGrowthIfPending() {
    if (!this.temporaryCueGrowthRevertPending) return;

    this.clearTemporaryCueGrowth();
  }

  private revertTemporaryCueWeightIfPending() {
    if (!this.temporaryCueWeightRevertPending) return;

    this.clearTemporaryCueWeight();
  }

  private revertTemporaryCuePhaseIfPending() {
    if (!this.temporaryCuePhaseRevertPending) return;

    this.clearTemporaryCuePhase();
  }

  private revertTemporaryCueEffectsIfPending() {
    this.revertTemporaryCueGrowthIfPending();
    this.revertTemporaryCueWeightIfPending();
    this.revertTemporaryCuePhaseIfPending();
  }

  private clearTemporaryCueGrowth() {
    if (!this.temporaryCueGrowthActive) {
      this.temporaryCueGrowthRevertPending = false;
      return;
    }

    const cueBall = this.getCueBall();
    if (cueBall && cueBall.sprite.active) {
      this.resizeBall(cueBall, 0.5, 0.25);
    }

    this.temporaryCueGrowthActive = false;
    this.temporaryCueGrowthRevertPending = false;
    this.renderOwnedItems();
  }

  private clearTemporaryCueWeight() {
    if (!this.temporaryCueWeightActive) {
      this.temporaryCueWeightRevertPending = false;
      return;
    }

    const cueBall = this.getCueBall();
    if (cueBall && cueBall.sprite.active) {
      this.scaleBallWeight(cueBall, 1 / TEMPORARY_CUE_WEIGHT_SCALE);
    }

    this.temporaryCueWeightActive = false;
    this.temporaryCueWeightRevertPending = false;
    this.renderOwnedItems();
  }

  private clearTemporaryCuePhase() {
    if (!this.temporaryCuePhaseActive) {
      this.temporaryCuePhaseRevertPending = false;
      return;
    }

    const cueBall = this.getCueBall();
    if (cueBall && cueBall.sprite.active) {
      this.setBallPhasing(cueBall, false);
    }

    this.temporaryCuePhaseActive = false;
    this.temporaryCuePhaseRevertPending = false;
    this.renderOwnedItems();
  }

  private scaleBallWeight(ball: Ball, scale: number) {
    if (ball.property.fixed) return;

    ball.weight *= scale;
    ball.sprite.setMass(ball.weight);
  }

  private slowAllBalls(scale: number) {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      if (ball.property.fixed) {
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        continue;
      }

      const velocity = (ball.sprite.body as MatterJS.BodyType).velocity;
      const angularVelocity = (ball.sprite.body as MatterJS.BodyType)
        .angularVelocity;
      ball.sprite.setVelocity(velocity.x * scale, velocity.y * scale);
      ball.sprite.setAngularVelocity(angularVelocity * scale);
    }
    this.showStatusSplashByCode(TextCode.statusSlow);
  }

  private damageTargetBalls(amount: number, reason: TextCodeType | string) {
    for (const ball of this.balls) {
      if (ball.ballKind === "cue" || ball.pocketed || ball.hp <= 0) continue;

      const modifiedDamage = this.getDamageAfterTargetModifiers(ball, amount);
      const damage = Math.min(modifiedDamage, ball.hp);
      ball.hp = Math.max(0, ball.hp - modifiedDamage);
      this.showDamageSplashAt(
        new Phaser.Math.Vector2(
          ball.sprite.x,
          ball.sprite.y - ball.radius - 12,
        ),
        damage,
        reason,
      );
    }

    this.resolveDamageDefeats();
    this.updateHud();
  }

  private activateBlastMarker(center: Phaser.Math.Vector2) {
    this.activateMarkerEffect(center, {
      radius: BLAST_MARKER_RADIUS,
      damage: BLAST_MARKER_DAMAGE,
      damageReason: TextCode.splashReasonBlast,
      forceMultiplier: 1,
      status: "Blast!",
    });
  }

  private activateRepulseMarker(center: Phaser.Math.Vector2) {
    this.activateMarkerEffect(center, {
      radius: BLAST_MARKER_RADIUS,
      forceMultiplier: REPULSE_MARKER_FORCE_MULTIPLIER,
      status: "Repulse!",
      sound: "repulse",
    });
  }

  private activateAttractMarker(center: Phaser.Math.Vector2) {
    this.activateMarkerEffect(center, {
      radius: BLAST_MARKER_RADIUS * ATTRACT_MARKER_RADIUS_MULTIPLIER,
      forceMultiplier: -ATTRACT_MARKER_FORCE_MULTIPLIER,
      status: "Attract!",
      sound: "attract",
    });
  }

  private activateMarkerEffect(
    center: Phaser.Math.Vector2,
    config: MarkerEffectConfig,
  ) {
    let movedAnyBall = false;
    this.playMarkerEffectSound(config.sound ?? "explode");
    this.showBlastMarkerAnimation(center, config.radius);

    for (const ball of this.balls) {
      if (ball.ballKind === "cue" || ball.pocketed || ball.hp <= 0) continue;

      const distance = Phaser.Math.Distance.Between(
        center.x,
        center.y,
        ball.sprite.x,
        ball.sprite.y,
      );
      if (distance > config.radius) continue;

      if (config.damage !== undefined) {
        const modifiedDamage = this.getDamageAfterTargetModifiers(
          ball,
          config.damage,
        );
        const damage = Math.min(modifiedDamage, ball.hp);
        ball.hp = Math.max(0, ball.hp - modifiedDamage);
        this.showDamageSplashAt(
          new Phaser.Math.Vector2(
            ball.sprite.x,
            ball.sprite.y - ball.radius - 12,
          ),
          damage,
          config.damageReason,
        );
      }

      if (ball.hp <= 0) continue;

      movedAnyBall =
        this.applyRadialVelocity(ball, center, distance, {
          radius: config.radius,
          minForce: 0.35,
          maxForce: BLAST_MARKER_MAX_FORCE,
          forceMultiplier: config.forceMultiplier,
          zeroDistanceBehavior:
            config.forceMultiplier < 0 ? "none" : "randomOutward",
        }) || movedAnyBall;
    }

    if (config.damage !== undefined) {
      this.resolveDamageDefeats();
      if (this.state === "cleared" || this.state === "failed") return;
    }

    if (movedAnyBall) {
      this.state = "rolling";
      this.charging = false;
      this.itemMovementInProgress = true;
      this.rollingStoppedAt = undefined;
      this.markTemporaryCueEffectsForRevert();
    }

    this.updateHud(config.status);
  }

  private applyRadialVelocity(
    ball: Ball,
    center: Phaser.Math.Vector2,
    distance: number,
    options: RadialVelocityOptions,
  ): boolean {
    if (ball.property.fixed) {
      ball.sprite.setVelocity(0, 0);
      ball.sprite.setAngularVelocity(0);
      return false;
    }

    const direction = new Phaser.Math.Vector2(
      ball.sprite.x - center.x,
      ball.sprite.y - center.y,
    );
    if (direction.lengthSq() < 0.001) {
      if (options.zeroDistanceBehavior === "none") return false;
      if (options.zeroDistanceBehavior === "fixedOutward") {
        direction.set(1, 0);
      } else {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        direction.set(Math.cos(angle), Math.sin(angle));
      }
    } else {
      direction.normalize();
    }

    const proximity = Phaser.Math.Clamp(
      1 - distance / options.radius,
      0,
      1,
    );
    const force =
      (Phaser.Math.Linear(options.minForce, options.maxForce, proximity) *
        options.forceMultiplier) /
      ball.weight;
    const body = ball.sprite.body as MatterJS.BodyType;
    ball.sprite.setVelocity(
      body.velocity.x + direction.x * force,
      body.velocity.y + direction.y * force,
    );
    return true;
  }

  private showStatusSplash(label: string) {
    this.showMoneySplash(new Phaser.Math.Vector2(GAME_WIDTH / 2, 586), label);
  }

  private showStatusSplashByCode(
    code: TextCodeType,
    params: Record<string, string | number> = {},
  ) {
    this.showStatusSplash(getText(code, params));
  }

  private createBalls() {
    this.loadStage(Stages[this.currentStageIndex]);
  }

  private loadStage(stage: Stage) {
    this.roulette?.clear();
    this.clearMagicCircleWindow();
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.executedMagicCircleSealBreaks.clear();
    for (const ball of this.balls) {
      ball.destroy();
    }

    this.hazards?.load(stage.hazards ?? []);
    this.loadObstacles(stage.obstacles ?? []);
    discoverBalls(stage.ballPlacements.map((placement) => placement.ballCode));
    this.balls = stage.ballPlacements.map((placement) =>
      this.createBall(
        BallProperties[placement.ballCode],
        placement.x,
        placement.y,
      ),
    );
    this.applyStageGlobalBuffs();
  }

  private loadObstacles(obstacles: StageObstacle[]) {
    this.obstacles = [...obstacles];
    this.drawObstacles();
  }

  private drawObstacles() {
    const layer = this.obstacleLayer;
    if (!layer) return;

    layer.clear();
    for (const obstacle of this.obstacles) {
      const { left, top, width, height } = this.getObstacleRect(obstacle);
      layer.fillStyle(0x50545d, 1);
      layer.fillRoundedRect(left, top, width, height, 4);
      layer.fillStyle(0x777c86, 0.72);
      layer.fillRoundedRect(left + 5, top + 5, width - 10, 8, 3);
      layer.fillStyle(0x393d45, 0.7);
      layer.fillRoundedRect(
        left + 6,
        top + height - 12,
        width - 12,
        6,
        3,
      );
      layer.lineStyle(3, 0x1d2027, 0.95);
      layer.strokeRoundedRect(left, top, width, height, 4);
      layer.lineStyle(1, 0xd8d2c2, 0.36);
      layer.strokeRoundedRect(
        left + 5,
        top + 5,
        width - 10,
        height - 10,
        3,
      );
    }
  }

  private getObstacleRect(obstacle: StageObstacle) {
    if (obstacle.type === "pillar") {
      return {
        left: obstacle.x - obstacle.size / 2,
        top: obstacle.y - obstacle.size / 2,
        width: obstacle.size,
        height: obstacle.size,
      };
    }

    return {
      left: obstacle.x - obstacle.width / 2,
      top: obstacle.y - obstacle.height / 2,
      width: obstacle.width,
      height: obstacle.height,
    };
  }

  private createBall(property: BallProperty, x: number, y: number): Ball {
    const textureKey = this.getBallTextureKey(
      property.code,
      property.initialRadius,
    );
    if (!this.textures.exists(textureKey)) {
      this.createBallTexture(
        textureKey,
        property,
        property.visualType,
        property.initialRadius,
      );
    }

    const ball = new Ball(
      this,
      property,
      x,
      y,
      textureKey,
      this.getBallLabelSize(property, property.initialRadius),
    );
    this.applyCueBallItemStats(ball);
    this.applyBallCollisionFilter(ball);
    return ball;
  }

  private setBallPhasing(ball: Ball, active: boolean) {
    if (active) {
      this.phasingBalls.add(ball);
      ball.sprite.setAlpha(PHASING_BALL_ALPHA);
      ball.label?.setAlpha(PHASING_BALL_ALPHA);
      if (!ball.temporaryStatusLabels.includes("すりぬけ")) {
        ball.temporaryStatusLabels.push("すりぬけ");
      }
    } else {
      this.phasingBalls.delete(ball);
      ball.sprite.setAlpha(1);
      ball.label?.setAlpha(1);
      ball.temporaryStatusLabels = ball.temporaryStatusLabels.filter(
        (label) => label !== "すりぬけ",
      );
    }

    this.applyBallCollisionFilter(ball);
  }

  private clearPhasingBalls() {
    for (const ball of this.phasingBalls) {
      ball.sprite.setAlpha(1);
      ball.label?.setAlpha(1);
      ball.temporaryStatusLabels = ball.temporaryStatusLabels.filter(
        (label) => label !== "すりぬけ",
      );
      this.applyBallCollisionFilter(ball);
    }
    this.phasingBalls.clear();
    this.temporaryCuePhaseActive = false;
    this.temporaryCuePhaseRevertPending = false;
  }

  private isBallPhasing(ball: Ball): boolean {
    return this.phasingBalls.has(ball);
  }

  private canBallsCollide(a: Ball, b: Ball): boolean {
    if (a.pocketed || b.pocketed) return false;
    if (a.hp <= 0 || b.hp <= 0) return false;
    if (this.isBallPhasing(a) && b.ballKind !== "cue") return false;
    if (this.isBallPhasing(b) && a.ballKind !== "cue") return false;
    return true;
  }

  private disableBallPhysics(ball: Ball) {
    ball.sprite.setVelocity(0, 0);
    ball.sprite.setAngularVelocity(0);
    ball.sprite.setSensor(true);
    this.setBallCollisionMask(ball, 0);
  }

  private enableBallPhysics(ball: Ball) {
    ball.sprite.setSensor(false);
    this.applyBallCollisionFilter(ball);
  }

  private applyBallCollisionFilter(ball: Ball) {
    if (ball.pocketed || ball.hp <= 0) {
      ball.sprite.setSensor(true);
      this.setBallCollisionMask(ball, 0);
      return;
    }

    const category =
      ball.ballKind === "cue" ? CUE_BALL_CATEGORY : ENEMY_BALL_CATEGORY;
    const isPhasing = this.isBallPhasing(ball);
    const mask = isPhasing
      ? ball.ballKind === "enemy"
        ? CUE_BALL_CATEGORY
        : 0
      : CUE_BALL_CATEGORY | ENEMY_BALL_CATEGORY;

    this.setBallCollisionFilter(ball, category, mask);
  }

  private setBallCollisionMask(ball: Ball, mask: number) {
    const category =
      ball.ballKind === "cue" ? CUE_BALL_CATEGORY : ENEMY_BALL_CATEGORY;
    this.setBallCollisionFilter(ball, category, mask);
  }

  private setBallCollisionFilter(ball: Ball, category: number, mask: number) {
    const body = ball.sprite.body as MatterJS.BodyType;
    body.collisionFilter.category = category;
    body.collisionFilter.mask = mask;
    for (const part of body.parts ?? []) {
      part.collisionFilter.category = category;
      part.collisionFilter.mask = mask;
    }
  }

  private spawnEnemyBall(
    code: BallCodeType,
    x: number,
    y: number,
  ): Ball | null {
    const property = BallProperties[code];
    if (property.ballKind !== "enemy") return null;

    const ball = this.createBall(property, x, y);
    discoverBall(code);
    this.balls.push(ball);
    this.applyStageGlobalBuffs();
    this.updateHud();
    return ball;
  }

  private findChipMultiplyPosition(source: Ball): Phaser.Math.Vector2 | null {
    const chipProperty = BallProperties[BallCode.chip];
    const proxy = {
      radius: chipProperty.initialRadius,
      pocketed: false,
    } as Ball;
    const offsets: Phaser.Math.Vector2[] = [];

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      for (const distance of [32, 44, 58]) {
        offsets.push(
          new Phaser.Math.Vector2(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
          ),
        );
      }
    }

    Phaser.Utils.Array.Shuffle(offsets);
    for (const offset of offsets) {
      const x = source.sprite.x + offset.x;
      const y = source.sprite.y + offset.y;
      if (this.canPlaceBallAt(proxy, x, y)) {
        return new Phaser.Math.Vector2(x, y);
      }
    }

    return null;
  }

  private findRandomEnemySpawnPosition(
    code: BallCodeType,
    options: {
      minCueDistance?: number;
      center?: Phaser.Math.Vector2;
      maxDistanceFromCenter?: number;
    } = {},
  ): Phaser.Math.Vector2 | null {
    const property = BallProperties[code];
    if (!property || property.ballKind !== "enemy") return null;

    const proxy = {
      radius: property.initialRadius,
      pocketed: false,
    } as Ball;
    const cueBall = this.getCueBall();
    const bounds = this.getBallTravelBounds(property.initialRadius);
    const randomPosition = () => {
      if (options.center && options.maxDistanceFromCenter !== undefined) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const distance = Math.sqrt(Math.random()) * options.maxDistanceFromCenter;
        return new Phaser.Math.Vector2(
          Phaser.Math.Clamp(
            options.center.x + Math.cos(angle) * distance,
            bounds.minX,
            bounds.maxX,
          ),
          Phaser.Math.Clamp(
            options.center.y + Math.sin(angle) * distance,
            bounds.minY,
            bounds.maxY,
          ),
        );
      }

      return new Phaser.Math.Vector2(
        Phaser.Math.FloatBetween(bounds.minX, bounds.maxX),
        Phaser.Math.FloatBetween(bounds.minY, bounds.maxY),
      );
    };

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const position = randomPosition();
      if (!this.canPlaceBallAt(proxy, position.x, position.y)) continue;
      if (
        cueBall &&
        options.minCueDistance !== undefined &&
        Phaser.Math.Distance.Between(
          position.x,
          position.y,
          cueBall.sprite.x,
          cueBall.sprite.y,
        ) < options.minCueDistance
      ) {
        continue;
      }
      return position;
    }

    if (options.center && options.maxDistanceFromCenter !== undefined) {
      return this.findRandomEnemySpawnPosition(code, {
        minCueDistance: options.minCueDistance,
      });
    }

    return null;
  }

  private applyStageGlobalBuffs() {
    for (const ball of this.balls) {
      ball.currentGlobalBuffs = [];
    }

    for (const source of this.balls) {
      if (
        source.ballKind !== "enemy" ||
        source.pocketed ||
        source.hp <= 0 ||
        source.property.globalBuffs.length === 0
      ) {
        continue;
      }

      for (const buffCode of source.property.globalBuffs) {
        this.addGlobalBuffFromSource(buffCode, source.code);
      }
    }
  }

  private addGlobalBuffFromSource(
    code: GlobalBuffCodeType,
    from: BallCodeType,
  ) {
    for (const ball of this.balls) {
      if (ball.ballKind !== "enemy") continue;
      if (code === GlobalBuffCode.hollowGuard && ball.code !== BallCode.hollowKing) {
        continue;
      }

      const existing = ball.currentGlobalBuffs.find(
        (buff) => buff.code === code && buff.from === from,
      );
      if (existing) {
        existing.amount += 1;
      } else {
        ball.currentGlobalBuffs.push({ code, from, amount: 1 });
      }
    }
  }

  private removeGlobalBuffsFromSource(source: Ball) {
    if (source.property.globalBuffs.length === 0) return;

    for (const code of source.property.globalBuffs) {
      for (const ball of this.balls) {
        if (code === GlobalBuffCode.hollowGuard && ball.code !== BallCode.hollowKing) {
          continue;
        }
        const existing = ball.currentGlobalBuffs.find(
          (buff) => buff.code === code && buff.from === source.code,
        );
        if (!existing) continue;

        existing.amount -= 1;
        if (existing.amount <= 0) {
          ball.currentGlobalBuffs = ball.currentGlobalBuffs.filter(
            (buff) => buff !== existing,
          );
        }
      }
    }
  }

  private getGlobalBuffAmount(ball: Ball, code: GlobalBuffCodeType): number {
    return ball.currentGlobalBuffs
      .filter((buff) => buff.code === code)
      .reduce((total, buff) => total + buff.amount, 0);
  }

  private applyCueBallItemStats(ball: Ball) {
    if (ball.ballKind === "enemy") return;

    const vitalCoreCount = this.getOwnedItemCount(ItemCode.VitalCore);
    const maxHpBonus = vitalCoreCount * VITAL_CORE_HP_BONUS;
    ball.maxHp = ball.property.maxHp + maxHpBonus;
    ball.hp = ball.maxHp;
  }

  private createBallTexture(
    key: string,
    property: BallProperty,
    visualType: BallVisualType,
    radius: number,
  ) {
    const size = Math.ceil(radius * 2 + 6);
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) return;

    const ctx = texture.getContext();
    const center = size / 2;
    const color = property.color;
    const fillColor = `#${color.toString(16).padStart(6, "0")}`;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    if (visualType === "chip") {
      this.drawChipTexture(ctx, center, radius, fillColor);
    } else if (visualType === "stripe") {
      ctx.fillStyle = fillColor;
      ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);
      ctx.fillStyle = "#f7f4df";
      ctx.fillRect(
        center - radius,
        center - radius * 0.38,
        radius * 2,
        radius * 0.76,
      );
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(center, center, radius * 0.54, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
    ctx.beginPath();
    ctx.arc(
      center - radius * 0.38,
      center - radius * 0.46,
      radius * 0.31,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius - 1, 0, Math.PI * 2);
    ctx.stroke();

    texture.refresh();
  }

  private drawChipTexture(
    ctx: CanvasRenderingContext2D,
    center: number,
    radius: number,
    fillColor: string,
  ) {
    const accentColor = "#f8ead2";
    const ringWidth = Math.max(1, radius * 0.12);

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    for (let index = 0; index < 8; index += 1) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = accentColor;
      ctx.fillRect(
        -radius * 0.11,
        -radius * 0.96,
        radius * 0.22,
        radius * 0.34,
      );
    }
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.47, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }

  private getBallTextureKey(code: BallCodeType, radius: number): string {
    return `ball-${code}-${Math.round(radius * 100)}`;
  }

  private getBallLabelSize(property: BallProperty, radius: number): number {
    return Math.max(
      10,
      Math.round(radius * 0.77 * (property.labelSizeMultiplier ?? 1)),
    );
  }

  private getBallDisplayName(ball: Ball): string {
    return ball.ballKind === "cue" ? "cue" : ball.property.label;
  }

  private cancelShotCharge() {
    if (!this.charging) return;
    this.charging = false;
    this.chargeStartedAt = 0;
    this.updateHud("Ready");
  }

  private releaseShot() {
    if (!this.charging || this.state !== "aiming") return;
    if (!this.pointerInControlArea) {
      this.charging = false;
      return;
    }

    const cueBall = this.getCueBall();
    const cue = cueBall?.sprite;
    if (!cueBall || !cue) return;

    const charge = Phaser.Math.Clamp(
      (this.time.now - this.chargeStartedAt) / POWER_CHARGE_MS,
      MIN_SHOT_CHARGE,
      1,
    );
    const direction = new Phaser.Math.Vector2(
      cue.x - this.pointerWorld.x,
      cue.y - this.pointerWorld.y,
    );
    if (direction.length() < 8) {
      this.charging = false;
      return;
    }

    direction.normalize();
    const weightScale = Math.max(
      0.001,
      cueBall.weight / cueBall.property.initialWeight,
    );
    const shotPower = (MAX_POWER * charge) / weightScale;
    cue.setVelocity(
      direction.x * shotPower,
      direction.y * shotPower,
    );
    this.playShotSound();
    this.shots += 1;
    this.stageShots += 1;
    if (this.backspinShots > 0) {
      this.backspinShots -= 1;
      this.backspinBouncesRemaining = 1;
    }
    this.state = "rolling";
    this.charging = false;
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.markTemporaryCueEffectsForRevert();
    this.updateHud("Rolling");
  }

  private applyTooManyShotsPenaltyForAiming() {
    if (this.state !== "aiming") return;
    if (this.stageShots <= this.lastPenalizedShotCount) return;

    const stage = Stages[this.currentStageIndex] as Stage;
    if (this.stageShots <= this.getCurrentStagePer(stage)) return;

    const cueBall = this.getCueBall();
    if (!cueBall) return;

    this.lastPenalizedShotCount = this.stageShots;
    if (this.penaltyWaivers > 0) {
      this.penaltyWaivers -= 1;
      this.showStatusSplashByCode(TextCode.statusTooManyShotsWaived);
      return;
    }

    const overShotCount = this.stageShots - this.getCurrentStagePer(stage);
    const damage = 10 * 2 ** (overShotCount - 1);
    const actualDamage = Math.min(damage, cueBall.hp);
    cueBall.hp = Math.max(0, cueBall.hp - damage);
    this.flashCueDamage(cueBall);
    this.showDamageSplashAt(
      new Phaser.Math.Vector2(
        cueBall.sprite.x,
        cueBall.sprite.y - cueBall.radius - 18,
      ),
      actualDamage,
      TextCode.splashReasonTooManyShots,
    );
    this.updateHud();

    if (cueBall.hp > 0) return;

    this.state = "failed";
    this.charging = false;
    this.updateHud("Cue HP 0. Run failed.");
    this.openGameOver();
  }

  private tiltTable() {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      if (ball.property.fixed) {
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        continue;
      }

      const body = ball.sprite.body as MatterJS.BodyType;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const force = Phaser.Math.FloatBetween(0.2, 1.5);
      const weightedForce = force / ball.weight;
      ball.sprite.setVelocity(
        body.velocity.x + Math.cos(angle) * weightedForce,
        body.velocity.y + Math.sin(angle) * weightedForce,
      );
    }

    if (this.state !== "cleared" && this.state !== "failed") {
      this.state = "rolling";
      this.charging = false;
      this.itemMovementInProgress = true;
      this.rollingStoppedAt = undefined;
      this.markTemporaryCueEffectsForRevert();
    }
    this.updateHud(getText(TextCode.statusTilt));
  }

  private gatherBalls() {
    for (const ball of this.balls) {
      if (ball.pocketed || ball.ballKind === "cue") continue;
      if (ball.property.fixed) {
        ball.sprite.setVelocity(0, 0);
        ball.sprite.setAngularVelocity(0);
        continue;
      }

      const bounds = this.getBallTravelBounds(ball.radius);
      const body = ball.sprite.body as MatterJS.BodyType;
      const distances = [
        { distance: ball.sprite.x - bounds.minX, x: 1, y: 0 },
        { distance: bounds.maxX - ball.sprite.x, x: -1, y: 0 },
        { distance: ball.sprite.y - bounds.minY, x: 0, y: 1 },
        { distance: bounds.maxY - ball.sprite.y, x: 0, y: -1 },
      ];
      const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
      const weightedForce = 0.6 / ball.weight;

      ball.sprite.setVelocity(
        body.velocity.x + nearest.x * weightedForce,
        body.velocity.y + nearest.y * weightedForce,
      );
    }

    if (this.state !== "cleared" && this.state !== "failed") {
      this.state = "rolling";
      this.charging = false;
      this.itemMovementInProgress = true;
      this.rollingStoppedAt = undefined;
      this.markTemporaryCueEffectsForRevert();
    }
    this.updateHud(getText(TextCode.statusGather));
  }

  private resizeBall(ball: Ball, radiusScale: number, weightScale: number) {
    const center = new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y);
    const angle = ball.sprite.rotation;
    const angularVelocity = (ball.sprite.body as MatterJS.BodyType)
      .angularVelocity;

    ball.radius *= radiusScale;
    ball.weight *= weightScale;
    const textureKey = this.getBallTextureKey(ball.code, ball.radius);
    if (!this.textures.exists(textureKey)) {
      this.createBallTexture(
        textureKey,
        ball.property,
        ball.visualType,
        ball.radius,
      );
    }

    ball.sprite.setTexture(textureKey);
    ball.sprite.setScale(1);
    ball.sprite.setCircle(ball.radius);
    if (ball.property.fixed) {
      ball.sprite.setStatic(true);
    }
    ball.sprite.setPosition(center.x, center.y);
    ball.sprite.setRotation(angle);
    ball.sprite.setMass(ball.weight);
    this.applyBallCollisionFilter(ball);
    ball.sprite.setVelocity(0, 0);
    ball.sprite.setAngularVelocity(angularVelocity);
    ball.label?.setFontSize(this.getBallLabelSize(ball.property, ball.radius));
    ball.pocketImmuneUntil = this.time.now + 650;

    const bounds = this.getBallTravelBounds(ball.radius);
    ball.sprite.setPosition(
      Phaser.Math.Clamp(center.x, bounds.minX, bounds.maxX),
      Phaser.Math.Clamp(center.y, bounds.minY, bounds.maxY),
    );
    this.pockets?.moveBallOutOfPockets(ball);
    ball.label?.setPosition(ball.sprite.x, ball.sprite.y);
    ball.previousPosition.set(ball.sprite.x, ball.sprite.y);

    for (const other of this.balls) {
      if (
        other === ball ||
        other.pocketed ||
        other === this.playerActions?.getDraggedBall() ||
        other.property.fixed
      )
        continue;

      const direction = new Phaser.Math.Vector2(
        other.sprite.x - ball.sprite.x,
        other.sprite.y - ball.sprite.y,
      );
      const distance = direction.length();
      const minimumDistance = ball.radius + other.radius + 2;
      if (distance >= minimumDistance) continue;

      if (distance < 0.001) direction.set(1, 0);
      else direction.normalize();

      const push = Math.max(0.8, (minimumDistance - distance) * 0.12);
      const body = other.sprite.body as MatterJS.BodyType;
      other.sprite.setVelocity(
        body.velocity.x + (direction.x * push) / other.weight,
        body.velocity.y + (direction.y * push) / other.weight,
      );
    }
  }

  private findBallAtPointer(pointer: Phaser.Input.Pointer): Ball | null {
    let nearest: Ball | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const ball of this.balls) {
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

  private updateBallTooltip(pointer: Phaser.Input.Pointer) {
    if (!this.canShowBallTooltip(pointer)) {
      this.hideBallTooltip();
      return;
    }

    const ball = this.findBallAtPointer(pointer);
    if (ball) {
      this.showBallTooltip(ball, pointer.x, pointer.y);
      return;
    }

    this.hud?.hideBallTooltip();
    const hazardTooltip = this.hazards?.getTooltipAtPoint(pointer.x, pointer.y);
    if (!hazardTooltip) {
      this.hud?.hideHazardTooltip();
      return;
    }

    this.hud?.showHazardTooltip(hazardTooltip);
  }

  private canShowBallTooltip(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.state === "aiming" &&
      !this.charging &&
      this.isPointerInControlArea(pointer) &&
      (this.playerActions?.isIdleForTooltip() ?? true)
    );
  }

  private showBallTooltip(ball: Ball, pointerX: number, pointerY: number) {
    this.hud?.hideHazardTooltip();
    this.hud?.showBallTooltip(ball, pointerX, pointerY);
  }

  private hideBallTooltip() {
    this.hud?.hideBallTooltip();
    this.hud?.hideHazardTooltip();
  }

  private canPlaceBallAt(ball: Ball, x: number, y: number): boolean {
    const bounds = this.getBallTravelBounds(ball.radius);
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      y < bounds.minY ||
      y > bounds.maxY
    ) {
      return false;
    }

    if (this.pockets?.isPositionInPocket(ball, x, y)) return false;

    for (const obstacle of this.obstacles) {
      const rect = this.getObstacleRect(obstacle);
      const closestX = Phaser.Math.Clamp(
        x,
        rect.left,
        rect.left + rect.width,
      );
      const closestY = Phaser.Math.Clamp(
        y,
        rect.top,
        rect.top + rect.height,
      );
      const distance = Phaser.Math.Distance.Between(x, y, closestX, closestY);
      if (distance < ball.radius + 2) return false;
    }

    for (const other of this.balls) {
      if (other === ball || other.pocketed || other.hp <= 0) continue;

      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        other.sprite.x,
        other.sprite.y,
      );
      if (distance < ball.radius + other.radius + 2) return false;
    }

    return true;
  }

  private applyBallCollisionEffects(
    a: Ball,
    b: Ball,
    position: Phaser.Math.Vector2,
  ) {
    if (!this.canBallsCollide(a, b)) return;

    const pairKey =
      a.code < b.code ? `${a.code}-${b.code}` : `${b.code}-${a.code}`;
    const lastAwardedAt = this.lastHitMoneyAtByPair.get(pairKey);
    if (
      lastAwardedAt !== undefined &&
      this.time.now - lastAwardedAt < HIT_MONEY_COOLDOWN_MS
    ) {
      return;
    }

    this.lastHitMoneyAtByPair.set(pairKey, this.time.now);
    this.applyCollisionDamage(a, b);
    this.applyCollisionDamage(b, a);

    const moneyBagBonus = this.getOwnedItemCount(ItemCode.MoneyBag);
    const gain = a.property.moneyOnHit + b.property.moneyOnHit + moneyBagBonus;
    if (gain <= 0) {
      this.resolveDamageDefeats();
      return;
    }

    this.money += gain;
    this.totalEarnedMoney += gain;
    this.stageEarnedMoney += gain;
    this.updateHud();
    this.showMoneySplash(position, gain);
    this.resolveDamageDefeats();
  }

  private gainMoney(amount: number, position: Phaser.Math.Vector2) {
    this.money += amount;
    this.totalEarnedMoney += amount;
    this.stageEarnedMoney += amount;
    this.showMoneySplash(position, amount);
    this.updateHud();
  }

  private applyCollisionDamage(target: Ball, attacker: Ball) {
    if (target.pocketed || target.hp <= 0) return;

    const damage = this.getCollisionDamage(target, attacker);
    if (damage <= 0) return;

    target.hp = Math.max(0, target.hp - damage);
    this.flashCueDamage(target);
    this.showDamageSplashAt(
      new Phaser.Math.Vector2(
        target.sprite.x,
        target.sprite.y - target.radius - 12,
      ),
      damage,
    );
  }

  private debugDamageTargets() {
    if (!DEBUG_MODE || this.state !== "aiming") return;

    for (const ball of this.balls) {
      if (ball.ballKind === "cue" || ball.pocketed || ball.hp <= 0) continue;

      const damage = Math.min(100, ball.hp);
      ball.hp = Math.max(0, ball.hp - 100);
      if (damage > 0) {
        this.showDamageSplashAt(
          new Phaser.Math.Vector2(
            ball.sprite.x,
            ball.sprite.y - ball.radius - 12,
          ),
          damage,
        );
      }
    }

    this.resolveDamageDefeats();
    this.updateHud("Debug damage");
  }

  private debugMoveStage(direction: 1 | -1) {
    if (!DEBUG_MODE) return;

    const nextStageIndex = Phaser.Math.Clamp(
      this.currentStageIndex + direction,
      0,
      Stages.length - 1,
    );
    if (nextStageIndex === this.currentStageIndex) {
      this.showStatusSplash("no debug stage");
      return;
    }

    this.scene.stop("MenuScene");
    this.scene.stop("GameOverScene");
    this.scene.stop("GameClearScene");
    this.scene.stop("StageClearScene");
    this.scene.stop("ShopScene");
    this.scene.resume();

    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearPresentationActive = false;
    this.clearSplashTexts();
    this.currentStageIndex = nextStageIndex;
    this.stageEarnedMoney = 0;
    this.stageShots = 0;
    this.lastPenalizedShotCount = 0;
    this.lastHitMoneyAtByPair.clear();
    this.resetItemUsesForStage();
    this.penaltyWaivers = 0;
    this.backspinShots = 0;
    this.backspinBouncesRemaining = 0;
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.enemyTurn?.clear();
    this.charging = false;
    this.playerActions?.reset();
    this.state = "aiming";
    this.drawTable();
    this.loadStage(Stages[this.currentStageIndex]);
    this.renderOwnedItems();
    this.updateHud(`Debug Stage ${this.currentStageIndex + 1}`);
    this.menuButton?.setEnabled(true);
  }

  private debugGameClear() {
    if (!DEBUG_MODE || this.state === "cleared") return;

    this.prepareDebugEndRun();
    this.state = "cleared";
    this.updateHud("Debug clear");
    this.openGameClear();
  }

  private debugGameOver() {
    if (!DEBUG_MODE || this.state === "failed") return;

    this.prepareDebugEndRun();
    this.state = "failed";
    this.updateHud("Debug game over");
    this.openGameOver();
  }

  private prepareDebugEndRun() {
    this.scene.stop("MenuScene");
    this.scene.stop("GameOverScene");
    this.scene.stop("GameClearScene");
    this.scene.stop("StageClearScene");
    this.scene.stop("ShopScene");
    this.scene.stop(DIALOGUE_SCENE_KEY);
    this.scene.resume();

    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearPresentationActive = false;
    this.charging = false;
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.enemyTurn?.clear();
    this.playerActions?.reset();
    this.clearSplashTexts();
  }

  private showDamageSplashAt(
    position: Phaser.Math.Vector2,
    damage: number,
    reason: TextCodeType | string = "",
  ) {
    const damageLabel = Number.isInteger(damage)
      ? `${damage}`
      : `${damage.toFixed(1)}`;
    this.splashText?.show({
      position: this.jitterSplashPosition(position),
      text: damageLabel,
      color: "#ff6f91",
      fontSize: 19,
      stroke: "#26000b",
      strokeThickness: 4,
      subText: this.getSplashReasonText(reason),
      subColor: "#ffc0d0",
      subFontSize: 13,
      rise: 22,
      duration: 320,
      hold: 180,
      fadeDuration: 240,
      depth: 41,
    });
  }

  private flashCueDamage(ball: Ball) {
    if (ball.ballKind !== "cue") return;

    this.tweens.killTweensOf(ball.sprite);
    ball.sprite.setAlpha(1);
    ball.sprite.setTint(0xff4d4d);
    this.tweens.add({
      targets: ball.sprite,
      alpha: { from: 0.45, to: 1 },
      duration: 150,
      ease: "Sine.easeOut",
      onComplete: () => {
        ball.sprite.setAlpha(1);
        ball.sprite.clearTint();
      },
    });
  }

  private showHealSplashAt(
    position: Phaser.Math.Vector2,
    amount: number,
    reason?: TextCodeType | string,
  ) {
    const isFogHeal =
      reason === "fog" || reason === TextCode.splashReasonFog;
    this.splashText?.show({
      position,
      text: reason && !isFogHeal ? `+${amount}` : `${amount}`,
      color: "#88ffb0",
      fontSize: 19,
      stroke: "#042510",
      strokeThickness: 4,
      subText: this.getSplashReasonText(reason),
      subColor: "#d9ffd9",
      subFontSize: 13,
      rise: 22,
      duration: 320,
      hold: 180,
      fadeDuration: 240,
      depth: 40,
    });
  }

  private getSplashReasonText(
    reason?: TextCodeType | string,
  ): string | undefined {
    if (!reason) return undefined;
    if (isTextCode(reason)) return getText(reason);

    const legacyReasonMap: Record<string, TextCodeType> = {
      poison: TextCode.splashReasonPoison,
      fog: TextCode.splashReasonFog,
      bomb: TextCode.splashReasonBomb,
      break: TextCode.splashReasonBreak,
      shot: TextCode.splashReasonShot,
      blast: TextCode.splashReasonBlast,
      打ちすぎ: TextCode.splashReasonTooManyShots,
    };
    const code = legacyReasonMap[reason];
    return code ? getText(code) : reason;
  }

  private showBlastMarkerAnimation(
    center: Phaser.Math.Vector2,
    radius = BLAST_MARKER_RADIUS,
  ) {
    const burst = this.add.graphics();
    burst.setDepth(43);
    burst.fillStyle(0xff5f31, 0.26);
    burst.fillCircle(center.x, center.y, radius * 0.52);
    burst.lineStyle(5, 0xffd071, 0.95);
    burst.strokeCircle(center.x, center.y, 12);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (value === null) return;

        burst.clear();
        burst.fillStyle(0xff5f31, 0.24 * (1 - value));
        burst.fillCircle(center.x, center.y, radius * (0.35 + value * 0.75));
        burst.lineStyle(5, 0xffd071, 0.95 * (1 - value));
        burst.strokeCircle(center.x, center.y, 12 + radius * value);
        burst.lineStyle(2, 0xffffff, 0.55 * (1 - value));
        burst.strokeCircle(center.x, center.y, 24 + radius * value * 0.72);
      },
      onComplete: () => burst.destroy(),
    });
  }

  private resolveDamageDefeats(options: ResolveDamageOptions = {}) {
    for (const ball of this.balls) {
      if (ball.pocketed || ball.hp > 0) continue;

      if (ball.ballKind === "cue") {
        this.state = "failed";
        this.charging = false;
        this.updateHud("Cue HP 0. Run failed.");
        this.openGameOver();
        return;
      }

      this.removeDefeatedBall(ball);
    }

    if (this.areAllTargetBallsDefeated()) {
      this.completeStage({
        clearSceneDelayMs: options.clearSceneDelayMs,
      });
    }
  }

  private removeDefeatedBall(ball: Ball) {
    this.playBreakSound();

    if (ball.code === BallCode.soulSeal) {
      const hollowKing = this.balls.find(
        (candidate) =>
          candidate.code === BallCode.hollowKing &&
          !candidate.pocketed &&
          candidate.hp > 0,
      );
      const remainingGuard = hollowKing
        ? Math.max(
            0,
            this.getGlobalBuffAmount(hollowKing, GlobalBuffCode.hollowGuard) - 1,
          )
        : 0;
      this.showStatusSplashByCode(TextCode.statusSealBreak, {
        remaining: remainingGuard,
      });
    }

    this.removeGlobalBuffsFromSource(ball);
    this.setBallPhasing(ball, false);
    ball.pocketed = true;
    this.disableBallPhysics(ball);
    ball.sprite.setVisible(false);
    ball.sprite.setPosition(-100, -100);
    ball.label?.setVisible(false);
    ball.hpBar?.clear();
    ball.previousPosition.set(-100, -100);
    this.updateHud(`Ball ${this.getBallDisplayName(ball)} defeated`);
  }

  private showMoneySplash(
    position: Phaser.Math.Vector2,
    gain: number | string,
  ) {
    const label = typeof gain === "number" ? `${gain}$` : gain;
    this.splashText?.show({
      position: this.jitterSplashPosition(
        new Phaser.Math.Vector2(position.x, position.y - 8),
      ),
      text: label,
      color: "#ffec8a",
      fontSize: 19,
      stroke: "#261000",
      strokeThickness: 4,
      rise: 26,
      duration: 360,
      hold: 220,
      fadeDuration: 260,
      depth: 40,
    });
  }

  private jitterSplashPosition(position: Phaser.Math.Vector2) {
    return new Phaser.Math.Vector2(
      position.x +
        Phaser.Math.Between(-SPLASH_POSITION_JITTER, SPLASH_POSITION_JITTER),
      position.y +
        Phaser.Math.Between(-SPLASH_POSITION_JITTER, SPLASH_POSITION_JITTER),
    );
  }

  private clearSplashTexts() {
    this.splashText?.clear();
  }

  private openGameOver() {
    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearMagicCircleWindow();
    this.enemyTurn?.clear();
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.clearPresentationActive = false;
    this.hideBallTooltip();
    this.recordCurrentStageShots(false);
    this.scene.launch("GameOverScene", {
      finalMoney: this.money,
      totalEarnedMoney: this.totalEarnedMoney,
      totalShots: this.shots,
      currentStage: this.currentStageIndex + 1,
      ownedItemCodes: this.inventory.getCodes(),
      stageShotRecords: this.stageShotRecords,
    });
    this.scene.pause();
  }

  private openGameClear() {
    this.roulette?.clear();
    this.clearMagicCircleWindow();
    this.enemyTurn?.clear();
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.hideBallTooltip();
    this.recordCurrentStageShots(true);
    this.scene.launch("GameClearScene", {
      finalMoney: this.money,
      totalEarnedMoney: this.totalEarnedMoney,
      totalShots: this.shots,
      currentStage: this.currentStageIndex + 1,
      ownedItemCodes: this.inventory.getCodes(),
      stageShotRecords: this.stageShotRecords,
    });
    this.scene.pause();
  }

  private openStageClear() {
    this.roulette?.clear();
    this.clearMagicCircleWindow();
    this.enemyTurn?.clear();
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.hideBallTooltip();
    this.recordCurrentStageShots(true);
    this.applyShopArrivalInterest();
    const stage = Stages[this.currentStageIndex] as Stage;
    const stagePer = this.getCurrentStagePer(stage);
    const startingMoney = this.money;
    const clearReward = stage.reward;
    const lowShotBonus = Math.max(0, stagePer - this.stageShots) * 10;
    const totalReward = clearReward + lowShotBonus;
    this.money += totalReward;
    this.totalEarnedMoney += totalReward;
    this.stageEarnedMoney += totalReward;
    this.updateHud();
    this.scene.launch("StageClearScene", {
      stageNumber: this.currentStageIndex + 1,
      stageShots: this.stageShots,
      stagePer,
      startingMoney,
      money: this.money,
      clearReward,
      lowShotBonus,
      ownedItemCodes: this.inventory.getCodes(),
    });
    this.scene.pause();
  }

  private recordCurrentStageShots(completed: boolean) {
    const stageNumber = this.currentStageIndex + 1;
    const record: StageShotRecord = {
      stageNumber,
      shots: this.stageShots,
      per: this.getCurrentStagePer(),
      completed,
    };
    const existingIndex = this.stageShotRecords.findIndex(
      (candidate) => candidate.stageNumber === stageNumber,
    );
    if (existingIndex >= 0) {
      this.stageShotRecords[existingIndex] = record;
      return;
    }

    this.stageShotRecords.push(record);
  }

  private applyShopArrivalInterest() {
    if (!this.hasItem(ItemCode.InterestCert)) return;

    const gain = Math.floor(this.money * 0.1);
    if (gain <= 0) return;

    this.money += gain;
    this.totalEarnedMoney += gain;
    this.stageEarnedMoney += gain;
    this.showMoneySplash(new Phaser.Math.Vector2(GAME_WIDTH / 2, 586), gain);
    this.updateHud();
  }

  private purchaseItem(itemCode: ItemCodeType, price: number) {
    if (this.money < price) return;

    this.money -= price;
    this.inventory.add(itemCode);
    if (itemCode === ItemCode.VitalCore) {
      this.applyVitalCorePurchase();
    }
    this.pockets?.drawPockets();
    this.updateHud();
    this.renderOwnedItems();
  }

  private applyVitalCorePurchase() {
    const cueBall = this.getCueBall();
    if (!cueBall || cueBall.hp <= 0) return;

    cueBall.maxHp += VITAL_CORE_HP_BONUS;
    cueBall.hp += VITAL_CORE_HP_BONUS;
    this.showStatusSplash(`+${VITAL_CORE_HP_BONUS} max HP`);
  }

  private spendMoney(amount: number) {
    if (amount <= 0 || this.money < amount) return;

    this.money -= amount;
    this.updateHud();
  }

  private getAttack(ball: Ball): number {
    if (ball.ballKind === "enemy") {
      const temporaryAttack = this.enemyTurn?.getTemporaryAttack(ball);
      return (
        (temporaryAttack ?? ball.property.attack) *
        1.2 ** this.getGlobalBuffAmount(ball, GlobalBuffCode.attackUp)
      );
    }

    const swordCount = this.getOwnedItemCount(ItemCode.VictorySword);
    const lastStandMultiplier =
      this.hasItem(ItemCode.LastStandCue) && ball.hp / ball.maxHp < 0.3
        ? 1.5
        : 1;
    return Math.ceil((ball.property.attack + swordCount * 5) * lastStandMultiplier);
  }

  private getCollisionDamage(target: Ball, attacker: Ball): number {
    const damage = this.getAttack(attacker) * this.getEffectiveBlockRate(target);
    return this.getDamageAfterTargetModifiers(target, damage);
  }

  private getDamageAfterTargetModifiers(target: Ball, damage: number): number {
    if (damage <= 0) return 0;

    let modifiedDamage = damage;
    if (target.code === BallCode.hollowKing) {
      const guardAmount = this.getGlobalBuffAmount(
        target,
        GlobalBuffCode.hollowGuard,
      );
      if (guardAmount >= 3) {
        modifiedDamage *= 0.35;
      } else if (guardAmount === 2) {
        modifiedDamage *= 0.5;
      } else if (guardAmount === 1) {
        modifiedDamage *= 0.7;
      }
    }

    return Math.ceil(modifiedDamage);
  }

  private getEffectiveBlockRate(ball: Ball): number {
    if (this.isBallPhasing(ball)) return 0;

    if (
      this.state === "enemy" &&
      this.enemyTurn?.isCommandProtectedBall(ball)
    ) {
      return 0;
    }

    if (
      this.state === "enemy" &&
      ball === this.enemyTurn?.getActiveBall() &&
      (this.enemyTurn?.isActiveAction(ball, BallSpecialActionCode.rookCharge) ||
        this.enemyTurn?.isActiveAction(ball, BallSpecialActionCode.kingCharge) ||
        this.enemyTurn?.isActiveAction(ball, BallSpecialActionCode.hollowCharge) ||
        this.enemyTurn?.isActiveAction(ball, BallSpecialActionCode.spadeCharge) ||
        this.enemyTurn?.isMirrorStepProtected(ball))
    ) {
      return 0;
    }

    if (
      this.state === "enemy" &&
      (this.enemyTurn?.isChipMultiplyProtected(ball) ||
        this.enemyTurn?.isChipRakeProtected(ball))
    ) {
      return 0;
    }

    if (ball.ballKind === "cue" && this.state !== "enemy") return 0;

    const blockRate =
      ball.property.blockRate *
      0.8 ** this.getGlobalBuffAmount(ball, GlobalBuffCode.blockRateDown);

    if (ball.ballKind !== "cue") return blockRate;

    return Math.max(
      0,
      blockRate -
        this.getOwnedItemCount(ItemCode.PorcelainShield) *
          PORCELAIN_SHIELD_BLOCK_RATE_REDUCTION,
    );
  }

  private getOwnedItemCount(itemCode: ItemCodeType): number {
    return this.inventory.count(itemCode);
  }

  private hasItem(itemCode: ItemCodeType): boolean {
    return this.inventory.has(itemCode);
  }

  private playCollideSound() {
    if (this.time.now - this.lastCollideSoundAt < COLLIDE_SOUND_COOLDOWN_MS) {
      return;
    }

    this.lastCollideSoundAt = this.time.now;
    this.sound.play(COLLIDE_SFX_KEY, { volume: getSfxVolume() * 0.76 });
  }

  private playShotSound() {
    this.sound.play(SHOT_SFX_KEY, { volume: getSfxVolume() });
  }

  private playHealSound() {
    this.sound.play(HEAL_SFX_KEY, { volume: getSfxVolume() });
  }

  private playExplodeSound() {
    this.sound.play(EXPLODE_SFX_KEY, { volume: getSfxVolume() });
  }

  private playBreakSound() {
    this.sound.play(BREAK_SFX_KEY, { volume: getSfxVolume() });
  }

  private playChangeStateSound() {
    this.sound.play(CHANGE_STATE_SFX_KEY, { volume: getSfxVolume() });
  }

  private playWarpSound() {
    this.sound.play(WARP_SFX_KEY, { volume: getSfxVolume() });
  }

  private playMarkerEffectSound(sound: NonNullable<MarkerEffectConfig["sound"]>) {
    if (sound === "attract") {
      this.sound.play(ATTRACT_SFX_KEY, { volume: getSfxVolume() });
      return;
    }
    if (sound === "repulse") {
      this.sound.play(REPULSE_SFX_KEY, { volume: getSfxVolume() });
      return;
    }
    this.playExplodeSound();
  }

  private playPocketSound() {
    this.sound.play(POCKET_SFX_KEY, { volume: getSfxVolume() * 0.9 });
  }

  private getCuePocketDamage(): number {
    return Math.ceil(50 * 0.5 ** this.getOwnedItemCount(ItemCode.PocketCushion));
  }

  private failRunByCueHp() {
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.state = "failed";
    this.charging = false;
    this.updateHud("Cue HP 0. Run failed.");
    this.openGameOver();
  }

  private handleRespawnedWhileRollingStopped() {
    this.state = "aiming";
    this.backspinBouncesRemaining = 0;
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.revertTemporaryCueEffectsIfPending();
    this.updateHud("Ready");
  }

  private getBallTravelBounds(radius: number) {
    return {
      minX: TABLE.x + TABLE.rail + radius,
      maxX: TABLE.x + TABLE.width - TABLE.rail - radius,
      minY: TABLE.y + TABLE.rail + radius,
      maxY: TABLE.y + TABLE.height - TABLE.rail - radius,
    };
  }

  private areAllTargetBallsDefeated(): boolean {
    return this.balls.every((ball) => ball.ballKind === "cue" || ball.hp <= 0);
  }

  private completeStage(options: CompleteStageOptions = {}) {
    if (this.state === "cleared" || this.state === "failed") return;

    this.charging = false;
    this.clearTemporaryCueGrowth();
    this.clearTemporaryCueWeight();
    this.clearTemporaryCuePhase();
    this.clearPhasingBalls();
    this.itemMovementInProgress = false;
    this.rollingStoppedAt = undefined;
    this.backspinBouncesRemaining = 0;
    this.playerActions?.reset();
    this.enemyTurn?.clear();
    this.stopAllBalls();
    this.clearPendingClearSceneEvent();

    if (this.currentStageIndex >= Stages.length - 1) {
      this.state = "cleared";
      this.updateHud("Clear!");
      this.scheduleClearScene(() => this.openGameClear(), options.clearSceneDelayMs);
      return;
    }

    this.state = "cleared";
    this.updateHud(`Stage ${this.currentStageIndex + 1} Clear`);
    this.scheduleClearScene(() => this.openStageClear(), options.clearSceneDelayMs);
  }

  private scheduleClearScene(openScene: () => void, delayMs = 0) {
    this.clearPresentationActive = delayMs > 0;
    if (delayMs <= 0) {
      openScene();
      return;
    }

    this.pendingClearSceneEvent = this.time.delayedCall(delayMs, () => {
      this.pendingClearSceneEvent = undefined;
      this.clearPresentationActive = false;
      if (this.state !== "cleared") return;

      openScene();
    });
  }

  private clearPendingClearSceneEvent() {
    this.pendingClearSceneEvent?.remove(false);
    this.pendingClearSceneEvent = undefined;
  }

  private stopAllBalls() {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;

      ball.sprite.setVelocity(0, 0);
      ball.sprite.setAngularVelocity(0);
      ball.previousPosition.set(ball.sprite.x, ball.sprite.y);
    }
  }

  private advanceStage() {
    if (this.state !== "cleared") return;

    const nextStageIndex = this.currentStageIndex + 1;
    const nextStage = Stages[nextStageIndex];
    if (!nextStage) {
      this.state = "cleared";
      this.updateHud("Clear!");
      this.openGameClear();
      return;
    }

    this.clearSplashTexts();
    this.clearPendingClearSceneEvent();
    this.roulette?.clear();
    this.clearPresentationActive = false;
    this.currentStageIndex = nextStageIndex;
    this.stageEarnedMoney = 0;
    this.stageShots = 0;
    this.lastPenalizedShotCount = 0;
    this.lastHitMoneyAtByPair.clear();
    this.resetItemUsesForStage();
    this.penaltyWaivers = 0;
    this.backspinShots = 0;
    this.backspinBouncesRemaining = 0;
    this.itemMovementInProgress = false;
    this.enemyTurn?.clear();
    this.state = "aiming";
    this.drawTable();
    this.loadStage(nextStage);
    this.renderOwnedItems();
    this.updateHud(`Stage ${this.currentStageIndex + 1}`);
    this.showStageStartDialogue();
  }

  private showStageStartDialogue() {
    if (isDialogueSkipEnabled()) return;

    const stageNumber = this.currentStageIndex + 1;
    const messages = getStageStartDialogue(stageNumber);
    if (!messages || messages.length === 0) return;

    this.scene.launch(DIALOGUE_SCENE_KEY, {
      messages,
      resumeSceneKey: this.scene.key,
      speakerName: NAVIGATOR_NAME,
    });
    this.scene.bringToTop(DIALOGUE_SCENE_KEY);
  }

  private applyHazardStopDamage(): boolean {
    const appliedDamage =
      this.hazards?.applyStopDamage(
        this.balls,
        this.playerActions?.getDraggedBall() ?? null,
      ) ?? false;

    if (appliedDamage) {
      this.resolveDamageDefeats();
      this.updateHud("Poison");
      if (this.state === "cleared" || this.state === "failed") return true;
    }

    if (this.applyMagicCircleSealBreakReinforcements()) {
      this.state = "hazard";
      this.charging = false;
      return true;
    }
    return this.state === "cleared" || this.state === "failed";
  }

  private applyMagicCircleSealBreakReinforcements(): boolean {
    const stage = Stages[this.currentStageIndex] as Stage;
    if (!stage.hazards?.some((hazard) => hazard.type === "magicCircle")) {
      return false;
    }

    const totalSealCount = stage.ballPlacements.filter(
      (placement) => placement.ballCode === BallCode.soulSeal,
    ).length;
    if (totalSealCount <= 0) return false;

    const livingSealCount = this.balls.filter(
      (ball) =>
        ball.code === BallCode.soulSeal && !ball.pocketed && ball.hp > 0,
    ).length;
    const brokenSealCount = Phaser.Math.Clamp(
      totalSealCount - livingSealCount,
      0,
      totalSealCount,
    );

    const reinforcements: Array<{ sealBreaks: number; code: BallCodeType }> = [
      { sealBreaks: 1, code: BallCode.ghost },
      { sealBreaks: 2, code: BallCode.doppelganger },
      { sealBreaks: 3, code: BallCode.wraith },
    ];

    let hasSpawnedReinforcements = false;
    for (const reinforcement of reinforcements) {
      if (brokenSealCount < reinforcement.sealBreaks) continue;
      if (
        this.executedMagicCircleSealBreaks.has(reinforcement.sealBreaks)
      ) {
        continue;
      }

      const spawned = this.spawnMagicCircleReinforcements(reinforcement.code, 2);
      if (spawned > 0) {
        hasSpawnedReinforcements = true;
        this.executedMagicCircleSealBreaks.add(reinforcement.sealBreaks);
        this.showMagicCircleReinforcementWindow(reinforcement.code, spawned);
        this.updateHud(`Magic circle x${spawned}`);
      }
    }

    return hasSpawnedReinforcements;
  }

  private spawnMagicCircleReinforcements(
    code: BallCodeType,
    count: number,
  ): number {
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      const position = this.findRandomEnemySpawnPosition(code, {
        minCueDistance: 80,
      });
      if (!position) continue;
      const ball = this.spawnEnemyBall(code, position.x, position.y);
      if (!ball) continue;

      spawned += 1;
      this.showMagicCircleSpawnRing(ball);
    }
    return spawned;
  }

  private showMagicCircleReinforcementWindow(
    code: BallCodeType,
    count: number,
  ) {
    this.magicCircleWindowQueue.push({ code, count });
    if (!this.magicCircleWindow && !this.magicCircleWindowDelayEvent) {
      this.showNextMagicCircleReinforcementWindow();
    }
  }

  private showNextMagicCircleReinforcementWindow() {
    const next = this.magicCircleWindowQueue.shift();
    if (!next) return;

    const { code, count } = next;
    const width = 360;
    const height = 86;
    const background = this.add.graphics();
    background.fillStyle(0x07101e, 0.94);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    background.lineStyle(2, 0x8fb6ff, 0.88);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    background.fillStyle(0x2f64ff, 0.16);
    background.fillRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, 12, 6);

    const title = this.add
      .text(0, -16, "MAGIC CIRCLE", {
        color: "#dfeaff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "22px",
        fontStyle: "900",
        stroke: "#020812",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(0, 18, `${BallProperties[code].name} x${count}`, {
        color: "#9fd4ff",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "16px",
        fontStyle: "800",
        stroke: "#020812",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.magicCircleWindow = this.add.container(GAME_WIDTH / 2, 104, [
      background,
      title,
      detail,
    ]);
    this.magicCircleWindow.setDepth(226);
    this.magicCircleWindow.setAlpha(0);
    this.magicCircleWindow.setScale(0.96);

    this.tweens.add({
      targets: this.magicCircleWindow,
      alpha: 1,
      scale: 1,
      duration: 140,
      ease: "Cubic.easeOut",
      yoyo: true,
      hold: 1320,
      onComplete: () => {
        this.clearMagicCircleWindowContainer();
        if (this.magicCircleWindowQueue.length === 0) {
          this.finishMagicCircleReinforcementPresentation();
          return;
        }

        this.magicCircleWindowDelayEvent = this.time.delayedCall(260, () => {
          this.magicCircleWindowDelayEvent = undefined;
          this.showNextMagicCircleReinforcementWindow();
        });
      },
    });
  }

  private finishMagicCircleReinforcementPresentation() {
    if (this.state !== "hazard") return;
    this.continueAfterPlayerHazards();
  }

  private clearMagicCircleWindow() {
    this.magicCircleWindowQueue = [];
    this.magicCircleWindowDelayEvent?.remove(false);
    this.magicCircleWindowDelayEvent = undefined;
    this.clearMagicCircleWindowContainer();
  }

  private clearMagicCircleWindowContainer() {
    if (!this.magicCircleWindow) return;
    this.tweens.killTweensOf(this.magicCircleWindow);
    this.magicCircleWindow.destroy();
    this.magicCircleWindow = undefined;
  }

  private showMagicCircleSpawnRing(ball: Ball) {
    const ring = this.add.graphics();
    ring.setDepth(82);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 880,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        const value = tween.getValue();
        if (value === null) return;

        const radius = ball.radius + 10 + value * 24;
        const alpha = 0.9 * (1 - value);
        ring.clear();
        ring.lineStyle(5, 0x5db7ff, alpha);
        ring.strokeCircle(ball.sprite.x, ball.sprite.y, radius);
        ring.lineStyle(2, 0xd8f4ff, alpha * 0.85);
        ring.strokeCircle(ball.sprite.x, ball.sprite.y, radius + 8);
      },
      onComplete: () => {
        ring.destroy();
      },
    });
  }

  private applyMirrorShift(): boolean {
    const cueBall = this.getCueBall();
    if (!cueBall || cueBall.pocketed || cueBall.hp <= 0) return false;

    const mirror = this.hazards?.getMirrorAtPoint(
      cueBall.sprite.x,
      cueBall.sprite.y,
    );
    if (!mirror) return false;

    const mirrorCenterX = mirror.x + mirror.width / 2;
    const target = new Phaser.Math.Vector2(
      mirrorCenterX * 2 - cueBall.sprite.x,
      cueBall.sprite.y,
    );
    const position = this.findNearestPlaceablePosition(cueBall, target);
    if (!position) return false;

    cueBall.sprite.setVelocity(0, 0);
    cueBall.sprite.setAngularVelocity(0);
    cueBall.sprite.setPosition(position.x, position.y);
    cueBall.label?.setPosition(position.x, position.y);
    cueBall.previousPosition.set(position.x, position.y);
    cueBall.pocketImmuneUntil = this.time.now + 650;
    this.pockets?.moveBallOutOfPockets(cueBall);
    this.showStatusSplashByCode(TextCode.statusMirrorShift);
    this.updateHud("Mirror shift");
    return true;
  }

  private findNearestPlaceablePosition(
    ball: Ball,
    preferred: Phaser.Math.Vector2,
  ): Phaser.Math.Vector2 | null {
    if (this.canPlaceBallAt(ball, preferred.x, preferred.y)) {
      return preferred.clone();
    }

    const step = Math.max(12, ball.radius);
    for (let radius = step; radius <= step * 8; radius += step) {
      for (let index = 0; index < 16; index += 1) {
        const angle = (Math.PI * 2 * index) / 16;
        const x = preferred.x + Math.cos(angle) * radius;
        const y = preferred.y + Math.sin(angle) * radius;
        if (this.canPlaceBallAt(ball, x, y)) {
          return new Phaser.Math.Vector2(x, y);
        }
      }
    }

    return null;
  }

  private resizeLivingBalls(radiusScale: number, weightScale: number) {
    for (const ball of this.balls) {
      if (ball.pocketed || ball.hp <= 0) continue;
      this.resizeBall(ball, radiusScale, weightScale);
    }
  }

  private hasPoisonImmunityBuff(ball: Ball): boolean {
    if (ball.ballKind === "cue") return this.hasItem(ItemCode.PoisonCharm);
    return this.getGlobalBuffAmount(ball, GlobalBuffCode.poisonImmune) > 0;
  }

  private finishPlayerMovement() {
    this.backspinBouncesRemaining = 0;
    if (this.applyHazardStopDamage()) return;

    this.continueAfterPlayerHazards();
  }

  private continueAfterPlayerHazards() {
    if (this.state === "cleared" || this.state === "failed") return;

    if (this.itemMovementInProgress) {
      this.itemMovementInProgress = false;
      this.rollingStoppedAt = undefined;
      this.state = "aiming";
      this.revertTemporaryCueEffectsIfPending();
      this.applyTooManyShotsPenaltyForAiming();
      this.updateHud("Ready");
      return;
    }

    this.applyMirrorShift();

    if (this.roulette?.start()) return;

    this.finishPostPlayerHazards();
  }

  private endPlayerTurnFromItem() {
    if (this.state !== "aiming") return;

    this.charging = false;
    this.rollingStoppedAt = undefined;
    this.markTemporaryCueEffectsForRevert();
    this.finishPostPlayerHazards();
  }

  private finishPostPlayerHazards() {
    if (this.state === "cleared" || this.state === "failed") return;

    if (this.enemyTurn?.start()) {
      this.state = "enemy";
      this.charging = false;
      return;
    }

    this.state = "aiming";
    this.revertTemporaryCueEffectsIfPending();
    this.applyTooManyShotsPenaltyForAiming();
    this.updateHud("Ready");
  }

  private updateEnemyTurn() {
    if (this.state !== "enemy") return;

    const result = this.enemyTurn?.update() ?? "completed";
    if (result === "running" || result === "interrupted") return;

    this.state = "aiming";
    this.revertTemporaryCueEffectsIfPending();
    this.applyTooManyShotsPenaltyForAiming();
    this.updateHud("Ready");
  }

  private areBallsStopped(): boolean {
    return this.ballPhysics?.areBallsStopped() ?? true;
  }

  private syncBallLabels() {
    for (const ball of this.balls) {
      if (!ball.label || ball.pocketed) continue;
      ball.label.setPosition(ball.sprite.x, ball.sprite.y);
    }
    this.syncBallHpBars();
  }

  private syncBallHpBars() {
    for (const ball of this.balls) {
      if (!ball.hpBar) continue;

      ball.hpBar.clear();
      if (ball.ballKind === "cue" && isCueHpBarHidden()) continue;
      if (ball.pocketed || ball.hp <= 0 || ball.hp >= ball.maxHp) continue;

      const width = Math.max(18, ball.radius * 1.7);
      const height = 4;
      const x = ball.sprite.x - width / 2;
      const y = ball.sprite.y + ball.radius + 7;
      const ratio = Phaser.Math.Clamp(ball.hp / ball.maxHp, 0, 1);

      ball.hpBar.fillStyle(0x120909, 0.86);
      ball.hpBar.fillRoundedRect(x, y, width, height, 2);
      ball.hpBar.fillStyle(ratio > 0.5 ? 0x7dff7a : 0xffcf45, 0.95);
      ball.hpBar.fillRoundedRect(x, y, width * ratio, height, 2);
      ball.hpBar.lineStyle(1, 0x000000, 0.55);
      ball.hpBar.strokeRoundedRect(x, y, width, height, 2);
    }
  }

  private updateHud(_status = "") {
    const stage = Stages[this.currentStageIndex];
    this.hud?.updateHud({
      stageNumber: this.currentStageIndex + 1,
      shots: this.stageShots,
      per: this.getCurrentStagePer(stage),
      cueHp: this.getCueHp(),
      cueMaxHp: this.getCueMaxHp(),
      money: this.money,
    });
  }

  private getCurrentStagePer(stage = Stages[this.currentStageIndex]): number {
    return stage.per + this.getOwnedItemCount(ItemCode.ExtraShot);
  }

  private getCueHp(): number {
    return this.balls.find((ball) => ball.ballKind === "cue")?.hp ?? 0;
  }

  private getCueMaxHp(): number {
    return this.balls.find((ball) => ball.ballKind === "cue")?.maxHp ?? 0;
  }

  private getCueBall(): Ball | null {
    return (
      this.balls.find((ball) => ball.ballKind === "cue" && !ball.pocketed) ??
      null
    );
  }

  private isPointerInControlArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= TABLE.x - CONTROL_AREA_MARGIN_WIDTH &&
      pointer.x <= TABLE.x + TABLE.width + CONTROL_AREA_MARGIN_WIDTH &&
      pointer.y >= TABLE.y - CONTROL_AREA_MARGIN_HEIGHT &&
      pointer.y <= TABLE.y + TABLE.height + CONTROL_AREA_MARGIN_HEIGHT
    );
  }
}

function setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number) {
  const adjustable = sound as AdjustableSound;
  if (adjustable.setVolume) {
    adjustable.setVolume(volume);
    return;
  }

  adjustable.volume = volume;
}
