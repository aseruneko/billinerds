import Phaser from "phaser";
import type { Ball } from "../Ball";
import type {
  FogHazard,
  MagicCircleHazard,
  MirrorHazard,
  PoisonHazard,
  RouletteHazard,
  RouletteSegment,
  StageHazard,
} from "../Stage";
import { GAME_FONT_FAMILY } from "../../../config";
import {
  getText,
  TextCode,
  type TextCodeType,
} from "../../../text/TextDictionary";

const POISON_FRICTION_MULTIPLIER = 5.4;

export type HazardTooltipInfo = {
  title: string;
  lines: string[];
  description: string;
  accentColor: number;
};

type HazardSystemContext = {
  showDamageSplash: (
    position: Phaser.Math.Vector2,
    damage: number,
    reason?: TextCodeType | string,
  ) => void;
  showHealSplash: (
    position: Phaser.Math.Vector2,
    amount: number,
    reason?: TextCodeType | string,
  ) => void;
  hasPoisonImmunity: (ball: Ball) => boolean;
  getDamageAfterTargetModifiers: (ball: Ball, damage: number) => number;
  onBallDamaged?: (ball: Ball) => void;
};

export class HazardSystem {
  private hazards: StageHazard[] = [];
  private rouletteLabels: Phaser.GameObjects.GameObject[] = [];
  private poisonTiles: Phaser.GameObjects.TileSprite[] = [];
  private poisonTileMasks: Array<{
    graphics: Phaser.GameObjects.Graphics;
    mask: Phaser.Display.Masks.GeometryMask;
  }> = [];
  private fogTiles: Phaser.GameObjects.TileSprite[] = [];
  private fogTileMasks: Array<{
    graphics: Phaser.GameObjects.Graphics;
    mask: Phaser.Display.Masks.GeometryMask;
  }> = [];
  private magicCircleImages: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly layer: Phaser.GameObjects.Graphics,
    private readonly context: HazardSystemContext,
    private readonly poisonTileKey: string,
    private readonly graveyardTileKey: string,
    private readonly magicCircleKey: string,
  ) {}

  load(hazards: StageHazard[]) {
    this.hazards = [...hazards];
    this.draw();
  }

  clear() {
    this.hazards = [];
    this.clearRouletteLabels();
    this.clearPoisonTiles();
    this.clearFogTiles();
    this.clearMagicCircleImages();
    this.layer.clear();
  }

  getRoulettes(): RouletteHazard[] {
    return this.hazards.filter(
      (hazard): hazard is RouletteHazard => hazard.type === "roulette",
    );
  }

  getRouletteSegmentAtPoint(
    roulette: RouletteHazard,
    x: number,
    y: number,
  ): { segment: RouletteSegment; index: number } | null {
    const dx = x - roulette.x;
    const dy = y - roulette.y;
    if (Math.hypot(dx, dy) > roulette.radius) return null;

    const angle = Phaser.Math.Angle.Normalize(Math.atan2(dy, dx) + Math.PI / 2);
    const index = Math.floor(
      angle / (Math.PI * 2 / roulette.segments.length),
    ) % roulette.segments.length;
    return { segment: roulette.segments[index], index };
  }

  getMirrorAtPoint(x: number, y: number): MirrorHazard | null {
    return (
      this.hazards.find(
        (hazard): hazard is MirrorHazard =>
          hazard.type === "mirror" && this.isPointInRoundedRect(x, y, hazard),
      ) ?? null
    );
  }

  getTooltipAtPoint(x: number, y: number): HazardTooltipInfo | null {
    for (let index = this.hazards.length - 1; index >= 0; index -= 1) {
      const hazard = this.hazards[index];

      if (
        hazard.type === "poison" &&
        this.isPointInRoundedRect(x, y, hazard)
      ) {
        return {
          title: getText(TextCode.hazardPoisonTitle),
          lines: [
            getText(TextCode.hazardPoisonLineDamage, { damage: hazard.damage }),
            getText(TextCode.hazardPoisonLineSlow),
          ],
          description: getText(TextCode.hazardPoisonDescription),
          accentColor: 0x93ff4e,
        };
      }

      if (hazard.type === "fog" && this.isPointInRoundedRect(x, y, hazard)) {
        return {
          title: getText(TextCode.hazardFogTitle),
          lines: [
            getText(TextCode.hazardFogLineHeal, { amount: hazard.heal }),
            getText(TextCode.hazardFogLineCue),
          ],
          description: getText(TextCode.hazardFogDescription),
          accentColor: 0xd5ccff,
        };
      }

      if (hazard.type === "roulette") {
        const segmentHit = this.getRouletteSegmentAtPoint(hazard, x, y);
        if (!segmentHit) continue;

        return {
          title: getText(TextCode.hazardRouletteTitle),
          lines: [
            getText(TextCode.hazardRouletteLineSegment, {
              segment: segmentHit.segment.label,
            }),
            segmentHit.segment.name,
          ],
          description: segmentHit.segment.description,
          accentColor: 0xffd37d,
        };
      }

      if (
        hazard.type === "mirror" &&
        this.isPointInRoundedRect(x, y, hazard)
      ) {
        return {
          title: getText(TextCode.hazardMirrorTitle),
          lines: [
            getText(TextCode.hazardMirrorLineWarp),
            getText(TextCode.hazardMirrorLineTrigger),
          ],
          description: getText(TextCode.hazardMirrorDescription),
          accentColor: 0xbfefff,
        };
      }

      if (
        hazard.type === "magicCircle" &&
        Math.hypot(x - hazard.x, y - hazard.y) <= hazard.radius
      ) {
        return {
          title: getText(TextCode.hazardMagicCircleTitle),
          lines: [
            getText(TextCode.hazardMagicCircleLineSeal1),
            getText(TextCode.hazardMagicCircleLineSeal2),
            getText(TextCode.hazardMagicCircleLineSeal3),
          ],
          description: getText(TextCode.hazardMagicCircleDescription),
          accentColor: 0x9ab8ff,
        };
      }
    }

    return null;
  }

  drawRouletteSelection(roulette: RouletteHazard, activeIndex?: number) {
    this.draw(activeIndex, roulette);
  }

  getFrictionMultiplier(ball: Ball): number {
    return this.isBallInPoison(ball) ? POISON_FRICTION_MULTIPLIER : 1;
  }

  applyStopDamage(balls: Ball[], draggedBall: Ball | null): boolean {
    if (this.hazards.length === 0) return false;

    let appliedDamage = false;
    for (const ball of balls) {
      if (ball.pocketed || ball.hp <= 0 || ball === draggedBall) continue;

      this.applyFogHeal(ball);

      const poison = this.hazards.find(
        (hazard): hazard is PoisonHazard =>
          hazard.type === "poison" &&
          this.isPointInRoundedRect(ball.sprite.x, ball.sprite.y, hazard),
      );
      if (!poison) continue;
      if (this.context.hasPoisonImmunity(ball)) continue;

      const modifiedDamage = this.context.getDamageAfterTargetModifiers(
        ball,
        poison.damage,
      );
      const damage = Math.min(modifiedDamage, ball.hp);
      ball.hp = Math.max(0, ball.hp - modifiedDamage);
      this.context.onBallDamaged?.(ball);
      this.context.showDamageSplash(
        new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y - ball.radius - 12),
        damage,
        TextCode.splashReasonPoison,
      );
      appliedDamage = true;
    }

    return appliedDamage;
  }

  private draw(
    activeRouletteIndex?: number,
    activeRoulette?: RouletteHazard,
  ) {
    this.layer.clear();
    this.clearRouletteLabels();
    this.clearPoisonTiles();
    this.clearFogTiles();
    this.clearMagicCircleImages();

    for (const hazard of this.hazards) {
      if (hazard.type === "roulette") {
        this.drawRoulette(
          hazard,
          hazard === activeRoulette ? activeRouletteIndex : undefined,
        );
        continue;
      }

      if (hazard.type === "fog") {
        this.drawFog(hazard);
        continue;
      }

      if (hazard.type === "mirror") {
        this.drawMirror(hazard);
        continue;
      }

      if (hazard.type === "magicCircle") {
        this.drawMagicCircle(hazard);
        continue;
      }

      if (hazard.type === "poison") {
        this.drawPoison(hazard);
      }
    }
  }

  private drawPoison(hazard: PoisonHazard) {
    const tile = this.layer.scene.add
      .tileSprite(
        hazard.x,
        hazard.y,
        hazard.width,
        hazard.height,
        this.poisonTileKey,
      )
      .setOrigin(0, 0)
      .setDepth(this.layer.depth - 0.1)
      .setAlpha(0.75);
    tile.tilePositionX = hazard.x % 64;
    tile.tilePositionY = hazard.y % 64;

    const maskGraphics = this.layer.scene.make.graphics({ x: 0, y: 0 });
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
    const mask = maskGraphics.createGeometryMask();
    tile.setMask(mask);
    this.poisonTiles.push(tile);
    this.poisonTileMasks.push({ graphics: maskGraphics, mask });

    this.layer.lineStyle(2, 0x93ff4e, 0.5);
    this.layer.strokeRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
  }

  private drawFog(hazard: FogHazard) {
    const tile = this.layer.scene.add
      .tileSprite(
        hazard.x,
        hazard.y,
        hazard.width,
        hazard.height,
        this.graveyardTileKey,
      )
      .setOrigin(0, 0)
      .setDepth(this.layer.depth - 0.1)
      .setAlpha(0.75);
    tile.tilePositionX = hazard.x % 128;
    tile.tilePositionY = hazard.y % 128;

    const maskGraphics = this.layer.scene.make.graphics({ x: 0, y: 0 });
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
    const mask = maskGraphics.createGeometryMask();
    tile.setMask(mask);
    this.fogTiles.push(tile);
    this.fogTileMasks.push({ graphics: maskGraphics, mask });

    this.layer.fillStyle(0xb8afda, 0.12);
    this.layer.fillRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );

    this.layer.lineStyle(2, 0xd5ccff, 0.42);
    this.layer.strokeRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
  }

  private drawMirror(hazard: MirrorHazard) {
    this.layer.fillStyle(0xcff8ff, 0.24);
    this.layer.fillRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
    this.layer.fillStyle(0x5a89a8, 0.22);
    this.layer.fillRoundedRect(
      hazard.x + 7,
      hazard.y + 7,
      hazard.width - 14,
      hazard.height - 14,
      Math.max(8, hazard.radius - 7),
    );

    this.layer.lineStyle(3, 0xe6fbff, 0.64);
    this.layer.strokeRoundedRect(
      hazard.x,
      hazard.y,
      hazard.width,
      hazard.height,
      hazard.radius,
    );
    this.layer.lineStyle(1, 0x74d8ff, 0.5);
    this.layer.strokeRoundedRect(
      hazard.x + 6,
      hazard.y + 6,
      hazard.width - 12,
      hazard.height - 12,
      Math.max(8, hazard.radius - 6),
    );

    this.layer.lineStyle(3, 0xffffff, 0.3);
    this.layer.lineBetween(
      hazard.x + hazard.width * 0.22,
      hazard.y + hazard.height * 0.14,
      hazard.x + hazard.width * 0.78,
      hazard.y + hazard.height * 0.43,
    );
    this.layer.lineStyle(2, 0xffffff, 0.2);
    this.layer.lineBetween(
      hazard.x + hazard.width * 0.28,
      hazard.y + hazard.height * 0.56,
      hazard.x + hazard.width * 0.72,
      hazard.y + hazard.height * 0.78,
    );
  }

  private drawMagicCircle(hazard: MagicCircleHazard) {
    const circle = this.layer.scene.add
      .image(hazard.x, hazard.y, this.magicCircleKey)
      .setDepth(this.layer.depth - 0.08)
      .setDisplaySize(hazard.radius * 2.12, hazard.radius * 2.12)
      .setAlpha(hazard.alpha);
    this.magicCircleImages.push(circle);
  }

  private drawRoulette(roulette: RouletteHazard, activeIndex?: number) {
    const segmentAngle = (Math.PI * 2) / roulette.segments.length;
    this.layer.fillStyle(0x10070a, 0.92);
    this.layer.fillCircle(roulette.x, roulette.y, roulette.radius + 10);
    this.layer.lineStyle(5, 0xffd37d, 0.82);
    this.layer.strokeCircle(roulette.x, roulette.y, roulette.radius + 10);

    roulette.segments.forEach((segment, index) => {
      const start = -Math.PI / 2 + segmentAngle * index;
      const end = start + segmentAngle;
      const isActive = index === activeIndex;

      this.layer.beginPath();
      this.layer.moveTo(roulette.x, roulette.y);
      this.layer.arc(roulette.x, roulette.y, roulette.radius, start, end);
      this.layer.closePath();
      this.layer.fillStyle(segment.color, isActive ? 0.98 : 0.72);
      this.layer.fillPath();
      this.layer.lineStyle(isActive ? 4 : 2, isActive ? 0xffffff : 0x230b10, isActive ? 0.95 : 0.58);
      this.layer.strokePath();

      if (isActive) {
        this.layer.fillStyle(0xffffff, 0.18);
        this.layer.beginPath();
        this.layer.moveTo(roulette.x, roulette.y);
        this.layer.arc(roulette.x, roulette.y, roulette.radius, start, end);
        this.layer.closePath();
        this.layer.fillPath();
      }

      const labelAngle = start + segmentAngle / 2;
      const labelRadius = roulette.radius * 0.744;
      const label = this.layer.scene.add
        .text(
          roulette.x + Math.cos(labelAngle) * labelRadius,
          roulette.y + Math.sin(labelAngle) * labelRadius,
          segment.label,
          {
            color: "#fff8e8",
            fontFamily: GAME_FONT_FAMILY,
            fontSize: segment.label.length > 1 ? "12px" : "22px",
            fontStyle: "900",
            stroke: "#18070b",
            strokeThickness: 4,
          },
        )
        .setOrigin(0.5)
        .setDepth(this.layer.depth + 1);
      this.rouletteLabels.push(label);
    });

    this.layer.fillStyle(0x1d0b11, 0.92);
    this.layer.fillCircle(roulette.x, roulette.y, roulette.radius * 0.22);
    this.layer.lineStyle(3, 0xffe0a4, 0.86);
    this.layer.strokeCircle(roulette.x, roulette.y, roulette.radius * 0.22);
    this.layer.fillStyle(0xfff0c4, 0.9);
    this.layer.fillCircle(roulette.x, roulette.y, 5);
  }

  private clearRouletteLabels() {
    for (const label of this.rouletteLabels) {
      label.destroy();
    }
    this.rouletteLabels = [];
  }

  private clearPoisonTiles() {
    for (const tile of this.poisonTiles) {
      tile.destroy();
    }
    for (const { graphics, mask } of this.poisonTileMasks) {
      mask.destroy();
      graphics.destroy();
    }
    this.poisonTiles = [];
    this.poisonTileMasks = [];
  }

  private clearFogTiles() {
    for (const tile of this.fogTiles) {
      tile.destroy();
    }
    for (const { graphics, mask } of this.fogTileMasks) {
      mask.destroy();
      graphics.destroy();
    }
    this.fogTiles = [];
    this.fogTileMasks = [];
  }

  private clearMagicCircleImages() {
    for (const image of this.magicCircleImages) {
      image.destroy();
    }
    this.magicCircleImages = [];
  }

  private isBallInPoison(ball: Ball): boolean {
    return this.hazards.some(
      (hazard) =>
        hazard.type === "poison" &&
        this.isPointInRoundedRect(ball.sprite.x, ball.sprite.y, hazard),
    );
  }

  private applyFogHeal(ball: Ball) {
    if (ball.ballKind !== "enemy") return;

    const fog = this.hazards.find(
      (hazard): hazard is FogHazard =>
        hazard.type === "fog" &&
        this.isPointInRoundedRect(ball.sprite.x, ball.sprite.y, hazard),
    );
    if (!fog || ball.hp >= ball.maxHp) return;

    const heal = Math.min(fog.heal, ball.maxHp - ball.hp);
    if (heal <= 0) return;

    ball.hp += heal;
    this.context.showHealSplash(
      new Phaser.Math.Vector2(ball.sprite.x, ball.sprite.y - ball.radius - 12),
      heal,
      TextCode.splashReasonFog,
    );
  }

  private isPointInRoundedRect(
    x: number,
    y: number,
    rect: Pick<
      PoisonHazard | FogHazard | MirrorHazard,
      "x" | "y" | "width" | "height" | "radius"
    >,
  ): boolean {
    if (
      x < rect.x ||
      x > rect.x + rect.width ||
      y < rect.y ||
      y > rect.y + rect.height
    ) {
      return false;
    }

    const radius = Math.min(rect.radius, rect.width / 2, rect.height / 2);
    if (x >= rect.x + radius && x <= rect.x + rect.width - radius) {
      return true;
    }
    if (y >= rect.y + radius && y <= rect.y + rect.height - radius) {
      return true;
    }

    const cornerX =
      x < rect.x + radius ? rect.x + radius : rect.x + rect.width - radius;
    const cornerY =
      y < rect.y + radius ? rect.y + radius : rect.y + rect.height - radius;
    return Phaser.Math.Distance.Between(x, y, cornerX, cornerY) <= radius;
  }
}
