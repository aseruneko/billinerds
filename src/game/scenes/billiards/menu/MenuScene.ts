import Phaser from "phaser";
import shotSfxUrl from "../../../../assets/shot.wav";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../../config";
import {
  isDialogueSkipEnabled,
  setDialogueSkipEnabled,
} from "../../../dialogueSettings";
import { isCueHpBarHidden, setCueHpBarHidden } from "../../../displaySettings";
import {
  getBgmVolume,
  getSfxVolume,
  setBgmVolume,
  setSfxVolume,
} from "../../../soundSettings";
import { createButton, createCheckbox } from "../../../ui";

const BILLIARDS_SCENE_KEY = "BilliardsScene";
const BGM_KEY = "billiards-bgm";
const MENU_SHOT_KEY = "menu-shot";
const SLIDER_WIDTH = 420;
const SLIDER_HEIGHT = 16;

type MenuSceneData = {
  currentStageNumber?: number;
  resumeSceneKey?: string;
};

type AdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

export class MenuScene extends Phaser.Scene {
  private lastSfxPreviewAt = 0;
  private currentStageNumber = 1;
  private resumeSceneKey = BILLIARDS_SCENE_KEY;

  constructor() {
    super("MenuScene");
  }

  preload() {
    this.load.audio(MENU_SHOT_KEY, shotSfxUrl);
  }

  init(data: MenuSceneData) {
    this.currentStageNumber = data.currentStageNumber ?? 1;
    this.resumeSceneKey = data.resumeSceneKey ?? BILLIARDS_SCENE_KEY;
  }

  create() {
    this.drawOverlay();

    this.add
      .text(GAME_WIDTH / 2, 176, "MENU", {
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
      y: 300,
      label: "BGM",
      value: getBgmVolume(),
      onChange: (value) => {
        setBgmVolume(value);
        const bgm = this.sound.get(BGM_KEY);
        if (bgm) setSoundVolume(bgm, value);
      },
    });

    this.createVolumeSlider({
      x: GAME_WIDTH / 2,
      y: 400,
      label: "SFX",
      value: getSfxVolume(),
      onChange: (value, preview) => {
        setSfxVolume(value);
        if (preview) this.playSfxPreview();
      },
    });

    createCheckbox(this, {
      x: GAME_WIDTH / 2 - SLIDER_WIDTH / 2,
      y: 470,
      label: "会話をスキップ",
      checked: isDialogueSkipEnabled(),
      onChange: (checked) => setDialogueSkipEnabled(checked),
    });

    createCheckbox(this, {
      x: GAME_WIDTH / 2 - SLIDER_WIDTH / 2,
      y: 516,
      label: "手球のHPバーを非表示にする",
      checked: isCueHpBarHidden(),
      onChange: (checked) => setCueHpBarHidden(checked),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 - 255,
      y: 598,
      width: 150,
      height: 58,
      label: "続ける",
      fontSize: 22,
      variant: "primary",
      onClick: () => this.resumeGame(),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 - 85,
      y: 598,
      width: 150,
      height: 58,
      label: "最初から",
      fontSize: 22,
      onClick: () => this.restartGame(),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 + 85,
      y: 598,
      width: 150,
      height: 58,
      label: "ルール",
      fontSize: 22,
      onClick: () => this.openRule(),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 + 255,
      y: 598,
      width: 150,
      height: 58,
      label: "タイトル",
      fontSize: 22,
      onClick: () => this.quitToTitle(),
    });
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 0.62);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.94);
    g.fillRoundedRect(120, 112, 784, 544, 18);
    g.lineStyle(4, 0xffef9c, 0.78);
    g.strokeRoundedRect(120, 112, 784, 544, 18);
    g.fillStyle(0xffc545, 0.1);
    g.fillRoundedRect(138, 130, 748, 94, 14);
  }

  private createVolumeSlider(options: {
    x: number;
    y: number;
    label: string;
    value: number;
    onChange: (value: number, preview: boolean) => void;
  }) {
    const { x, y, label, onChange } = options;
    const left = x - SLIDER_WIDTH / 2;
    const top = y - SLIDER_HEIGHT / 2;
    let value = Phaser.Math.Clamp(options.value, 0, 1);

    this.add.text(left, y - 48, label, {
      color: "#fff1ba",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "24px",
      fontStyle: "800",
    });
    const percent = this.add
      .text(left + SLIDER_WIDTH, y - 48, "", {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "23px",
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
      graphics.fillStyle(0x070c09, 1);
      graphics.fillRoundedRect(left, top, SLIDER_WIDTH, SLIDER_HEIGHT, 7);
      graphics.fillStyle(0xffc545, 1);
      graphics.fillRoundedRect(left, top, fillWidth, SLIDER_HEIGHT, 7);
      graphics.lineStyle(3, 0xffef9c, 0.9);
      graphics.strokeRoundedRect(left, top, SLIDER_WIDTH, SLIDER_HEIGHT, 7);

      handle.clear();
      handle.fillStyle(0x000000, 0.34);
      handle.fillCircle(handleX + 3, y + 4, 17);
      handle.fillStyle(0xfff1a8, 1);
      handle.fillCircle(handleX, y, 16);
      handle.lineStyle(3, 0x6b3210, 0.9);
      handle.strokeCircle(handleX, y, 16);

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
  }

  private resumeGame() {
    this.scene.stop();
    this.scene.resume(this.resumeSceneKey);
  }

  private restartGame() {
    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    billiards.events.emit("restart-run");
    this.resumeGame();
  }

  private openRule() {
    this.scene.launch("RuleScene", {
      currentStageNumber: this.currentStageNumber,
    });
    this.scene.bringToTop("RuleScene");
  }

  private quitToTitle() {
    this.scene.stop("ShopScene");
    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    billiards.events.emit("quit-to-title");
  }

  private playSfxPreview() {
    if (this.time.now - this.lastSfxPreviewAt < 160) return;

    this.lastSfxPreviewAt = this.time.now;
    this.sound.play(MENU_SHOT_KEY, { volume: getSfxVolume() });
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
