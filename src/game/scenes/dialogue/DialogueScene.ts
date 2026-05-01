import Phaser from "phaser";
import helloSfxUrl from "../../../assets/hello.mp3";
import portraitUrl from "../../../assets/portrait.png";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { getSfxVolume } from "../../soundSettings";
import { NAVIGATOR_NAME } from "./DialogueScripts";

const HELLO_SFX_KEY = "dialogue-hello";
const PORTRAIT_KEY = "navigator-portrait";
const INPUT_LOCK_MS = 140;

export type DialogueSceneData = {
  messages: string[];
  resumeSceneKey: string;
  speakerName?: string;
};

export class DialogueScene extends Phaser.Scene {
  private messages: string[] = [];
  private resumeSceneKey = "";
  private speakerName = NAVIGATOR_NAME;
  private messageIndex = 0;
  private messageText?: Phaser.GameObjects.Text;
  private inputReadyAt = 0;

  constructor() {
    super("DialogueScene");
  }

  preload() {
    this.load.audio(HELLO_SFX_KEY, helloSfxUrl);
    this.load.image(PORTRAIT_KEY, portraitUrl);
  }

  init(data: DialogueSceneData) {
    this.messages = [...data.messages];
    this.resumeSceneKey = data.resumeSceneKey;
    this.speakerName = data.speakerName ?? NAVIGATOR_NAME;
    this.messageIndex = 0;
    this.messageText = undefined;
    this.inputReadyAt = 0;
  }

  create() {
    this.scene.bringToTop();

    if (this.resumeSceneKey) {
      this.scene.pause(this.resumeSceneKey);
    }

    if (this.messages.length === 0) {
      this.close();
      return;
    }

    this.inputReadyAt = this.time.now + INPUT_LOCK_MS;
    this.drawOverlay();
    this.drawPortrait();
    this.drawMessageWindow();
    this.setMessageText();
    this.playHelloSound();

    this.input.on("pointerdown", () => this.advance());
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x030305, 0.84);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  private playHelloSound() {
    this.sound.play(HELLO_SFX_KEY, { volume: getSfxVolume() });
  }

  private drawPortrait() {
    const portrait = this.add.image(
      GAME_WIDTH - 178,
      GAME_HEIGHT + 200,
      PORTRAIT_KEY,
    );
    portrait.setOrigin(0.5, 1);
    portrait.setDepth(5);

    const scale = 1.0;
    portrait.setScale(scale);
  }

  private drawMessageWindow() {
    const windowX = 64;
    const windowY = GAME_HEIGHT - 204;
    const windowWidth = GAME_WIDTH - 128;
    const windowHeight = 148;

    const g = this.add.graphics();
    g.setDepth(10);
    g.fillStyle(0x09070c, 0.9);
    g.fillRoundedRect(windowX, windowY, windowWidth, windowHeight, 14);
    g.lineStyle(3, 0xffef9c, 0.82);
    g.strokeRoundedRect(windowX, windowY, windowWidth, windowHeight, 14);

    const namePlateWidth = 244;
    g.fillStyle(0x1a161f, 1);
    g.fillRoundedRect(windowX + 24, windowY - 28, namePlateWidth, 48, 10);
    g.lineStyle(2, 0xffef9c, 1);
    g.strokeRoundedRect(windowX + 24, windowY - 28, namePlateWidth, 48, 10);

    this.add
      .text(windowX + 44, windowY - 16, this.speakerName, {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "22px",
        fontStyle: "900",
      })
      .setDepth(11);

    this.messageText = this.add.text(windowX + 34, windowY + 36, "", {
      color: "#f7f1d7",
      fontFamily: GAME_FONT_FAMILY,
      fontSize: "22px",
      fontStyle: "800",
      lineSpacing: 7,
      wordWrap: { width: windowWidth - 108, useAdvancedWrap: true },
    });
    this.messageText.setDepth(11);

    this.add
      .text(windowX + windowWidth - 44, windowY + windowHeight - 34, "▼", {
        color: "#ffef9c",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "22px",
        fontStyle: "900",
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private setMessageText() {
    this.messageText?.setText(this.messages[this.messageIndex] ?? "");
  }

  private advance() {
    if (this.time.now < this.inputReadyAt) return;

    this.messageIndex += 1;
    if (this.messageIndex >= this.messages.length) {
      this.close();
      return;
    }

    this.inputReadyAt = this.time.now + INPUT_LOCK_MS;
    this.setMessageText();
  }

  private close() {
    if (this.resumeSceneKey) {
      this.scene.resume(this.resumeSceneKey);
    }
    this.scene.stop();
  }
}
