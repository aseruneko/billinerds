import Phaser from "phaser";
import shotSfxUrl from "../../../assets/shot.wav";
import titleBgUrl from "../../../assets/title_bg.png";
import bgmUrl from "../../../assets/夜想ラヂオ.ogg";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../config";
import {
  isDialogueSkipEnabled,
  setDialogueSkipEnabled,
} from "../../dialogueSettings";
import { isCueHpBarHidden, setCueHpBarHidden } from "../../displaySettings";
import {
  getBgmVolume,
  getSfxVolume,
  setBgmVolume,
  setSfxVolume,
} from "../../soundSettings";
import { createButton, createCheckbox } from "../../ui";

const SETTINGS_BGM_KEY = "settings-bgm";
const SETTINGS_SHOT_KEY = "settings-shot";
const SETTINGS_BG_KEY = "settings-title-bg";
const SLIDER_WIDTH = 520;
const SLIDER_HEIGHT = 18;

type VolumeSlider = {
  setValue: (value: number, preview?: boolean) => void;
};

type AdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

export class SettingsScene extends Phaser.Scene {
  private bgm?: Phaser.Sound.BaseSound;
  private lastSfxPreviewAt = 0;

  constructor() {
    super("SettingsScene");
  }

  preload() {
    this.load.image(SETTINGS_BG_KEY, titleBgUrl);
    this.load.audio(SETTINGS_BGM_KEY, bgmUrl);
    this.load.audio(SETTINGS_SHOT_KEY, shotSfxUrl);
  }

  create() {
    this.cameras.main.setBackgroundColor("#101016");
    this.drawBackground();
    this.startBgm();

    this.add
      .text(GAME_WIDTH / 2, 142, "設定", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "64px",
        fontStyle: "700",
        shadow: {
          offsetX: 0,
          offsetY: 5,
          color: "#000000",
          blur: 8,
          fill: true,
        },
      })
      .setOrigin(0.5);

    this.createVolumeSlider({
      x: GAME_WIDTH / 2,
      y: 288,
      label: "BGM",
      value: getBgmVolume(),
      onChange: (value) => {
        setBgmVolume(value);
        if (this.bgm) setSoundVolume(this.bgm, value);
      },
    });

    this.createVolumeSlider({
      x: GAME_WIDTH / 2,
      y: 414,
      label: "SFX",
      value: getSfxVolume(),
      onChange: (value, preview) => {
        setSfxVolume(value);
        if (preview) this.playSfxPreview();
      },
    });

    createCheckbox(this, {
      x: GAME_WIDTH / 2 - SLIDER_WIDTH / 2,
      y: 494,
      label: "会話をスキップ",
      checked: isDialogueSkipEnabled(),
      onChange: (checked) => setDialogueSkipEnabled(checked),
    });

    createCheckbox(this, {
      x: GAME_WIDTH / 2 - SLIDER_WIDTH / 2,
      y: 542,
      label: "手球のHPバーを非表示にする",
      checked: isCueHpBarHidden(),
      onChange: (checked) => setCueHpBarHidden(checked),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 634,
      width: 220,
      height: 62,
      label: "もどる",
      fontSize: 26,
      onClick: () => this.scene.start("TitleScene"),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bgm?.stop();
      this.bgm = undefined;
    });
  }

  private drawBackground() {
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, SETTINGS_BG_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.74);

    const g = this.add.graphics();
    g.fillStyle(0x020306, 0.42);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x0b3a2a, 0.18);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x050507, 0.62);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.94);
    g.fillRoundedRect(186, 78, 652, 612, 18);
    g.lineStyle(4, 0xffef9c, 0.78);
    g.strokeRoundedRect(186, 78, 652, 612, 18);
    g.fillStyle(0xffc545, 0.1);
    g.fillRoundedRect(202, 100, 620, 94, 14);
  }

  private startBgm() {
    this.bgm = this.sound.add(SETTINGS_BGM_KEY, {
      loop: true,
      volume: getBgmVolume(),
    });

    if (this.sound.locked) {
      this.input.once("pointerdown", () => this.bgm?.play());
      return;
    }

    this.bgm.play();
  }

  private createVolumeSlider(options: {
    x: number;
    y: number;
    label: string;
    value: number;
    onChange: (value: number, preview: boolean) => void;
  }): VolumeSlider {
    const { x, y, label, onChange } = options;
    const left = x - SLIDER_WIDTH / 2;
    const top = y - SLIDER_HEIGHT / 2;
    let value = Phaser.Math.Clamp(options.value, 0, 1);

    const title = this.add.text(left, y - 54, label, {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "28px",
      fontStyle: "800",
    });
    const percent = this.add
      .text(left + SLIDER_WIDTH, y - 54, "", {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "26px",
        fontStyle: "800",
      })
      .setOrigin(1, 0);

    const graphics = this.add.graphics();
    const handle = this.add.graphics();
    const zone = this.add
      .zone(x, y, SLIDER_WIDTH + 36, 52)
      .setInteractive({ useHandCursor: true });

    const draw = () => {
      const fillWidth = SLIDER_WIDTH * value;
      const handleX = left + fillWidth;

      graphics.clear();
      graphics.fillStyle(0x101812, 1);
      graphics.fillRoundedRect(left, top, SLIDER_WIDTH, SLIDER_HEIGHT, 7);
      graphics.fillStyle(0xffc545, 1);
      graphics.fillRoundedRect(left, top, fillWidth, SLIDER_HEIGHT, 7);
      graphics.lineStyle(3, 0xffef9c, 0.92);
      graphics.strokeRoundedRect(left, top, SLIDER_WIDTH, SLIDER_HEIGHT, 7);

      handle.clear();
      handle.fillStyle(0x000000, 0.32);
      handle.fillCircle(handleX + 3, y + 4, 18);
      handle.fillStyle(0xfff1a8, 1);
      handle.fillCircle(handleX, y, 17);
      handle.lineStyle(3, 0x6b3210, 0.9);
      handle.strokeCircle(handleX, y, 17);

      percent.setText(`${Math.round(value * 100)}%`);
    };

    const setFromPointer = (
      pointer: Phaser.Input.Pointer,
      preview: boolean,
    ) => {
      value = Phaser.Math.Clamp((pointer.x - left) / SLIDER_WIDTH, 0, 1);
      draw();
      onChange(value, preview);
    };

    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      setFromPointer(pointer, true);
    });
    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      setFromPointer(pointer, true);
    });

    draw();

    return {
      setValue: (nextValue: number, preview = false) => {
        value = Phaser.Math.Clamp(nextValue, 0, 1);
        draw();
        onChange(value, preview);
      },
    };
  }

  private playSfxPreview() {
    if (this.time.now - this.lastSfxPreviewAt < 160) return;

    this.lastSfxPreviewAt = this.time.now;
    this.sound.play(SETTINGS_SHOT_KEY, { volume: getSfxVolume() });
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
