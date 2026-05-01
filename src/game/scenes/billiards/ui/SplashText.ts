import Phaser from "phaser";
import { GAME_FONT_FAMILY } from "../../../config";

type SplashTextOptions = {
  position: Phaser.Math.Vector2;
  text: string;
  color: string;
  fontSize: number;
  stroke: string;
  strokeThickness: number;
  subText?: string;
  subColor?: string;
  subFontSize?: number;
  rise?: number;
  duration?: number;
  hold?: number;
  fadeDuration?: number;
  depth?: number;
  align?: "left" | "center" | "right";
};

type SplashEntry = Phaser.GameObjects.Container | Phaser.GameObjects.Text;

export class SplashText {
  private entries: SplashEntry[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  show(options: SplashTextOptions): SplashEntry {
    const entry = this.createEntry(options);
    this.entries.push(entry);

    const rise = options.rise ?? 24;
    const duration = options.duration ?? 340;
    const hold = options.hold ?? 200;
    const fadeDuration = options.fadeDuration ?? 250;

    this.scene.tweens.add({
      targets: entry,
      y: entry.y - rise,
      duration,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: entry,
          alpha: 0,
          y: entry.y - Math.max(6, Math.round(rise * 0.25)),
          delay: hold,
          duration: fadeDuration,
          ease: "Sine.easeIn",
          onComplete: () => this.destroy(entry),
        });
      },
    });

    return entry;
  }

  clear() {
    for (const entry of this.entries) {
      this.scene.tweens.killTweensOf(entry);
      entry.destroy();
    }
    this.entries = [];
  }

  private createEntry(options: SplashTextOptions): SplashEntry {
    if (!options.subText) {
      return this.createMainText(options)
        .setPosition(options.position.x, options.position.y)
        .setDepth(options.depth ?? 40);
    }

    const subText = this.scene.add
      .text(0, 0, options.subText, {
        color: options.subColor ?? options.color,
        fontFamily: GAME_FONT_FAMILY,
        fontSize: `${options.subFontSize ?? Math.max(11, options.fontSize - 6)}px`,
        fontStyle: "900",
        stroke: options.stroke,
        strokeThickness: Math.max(1, options.strokeThickness - 1),
        align: options.align ?? "center",
      })
      .setOrigin(0.5);

    const mainText = this.createMainText(options).setPosition(0, 0);
    const gap = Math.max(3, Math.round(options.fontSize * 0.16));
    subText.setY(-options.fontSize / 2 - gap);
    mainText.setY((options.subFontSize ?? options.fontSize - 6) / 2 + gap);

    return this.scene.add
      .container(options.position.x, options.position.y, [subText, mainText])
      .setDepth(options.depth ?? 40);
  }

  private createMainText(options: SplashTextOptions): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, options.text, {
        color: options.color,
        fontFamily: GAME_FONT_FAMILY,
        fontSize: `${options.fontSize}px`,
        fontStyle: "900",
        stroke: options.stroke,
        strokeThickness: options.strokeThickness,
        align: options.align ?? "center",
      })
      .setOrigin(0.5);
  }

  private destroy(entry: SplashEntry) {
    this.entries = this.entries.filter((item) => item !== entry);
    entry.destroy();
  }
}
