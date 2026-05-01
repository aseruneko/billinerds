import Phaser from "phaser";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../../config";
import { createButton } from "../../../ui";
import {
  addRunResultSharePanel,
  buildRunResultText,
  type RunResultData,
} from "../RunResultShare";

const BILLIARDS_SCENE_KEY = "BilliardsScene";
const BGM_KEY = "billiards-bgm";

type GameOverData = Omit<RunResultData, "result">;

export class GameOverScene extends Phaser.Scene {
  private runResultText = "";

  constructor() {
    super("GameOverScene");
  }

  init(data: GameOverData) {
    this.runResultText = buildRunResultText({
      ...data,
      result: "GAME OVER",
    });
  }

  create() {
    this.drawOverlay();

    this.add
      .text(GAME_WIDTH / 2, 170, "GAME OVER", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "62px",
        fontStyle: "700",
        shadow: {
          offsetX: 0,
          offsetY: 6,
          color: "#000000",
          blur: 10,
          fill: true,
        },
      })
      .setOrigin(0.5);

    addRunResultSharePanel(
      this,
      GAME_WIDTH / 2,
      388,
      this.runResultText,
    );

    createButton(this, {
      x: GAME_WIDTH / 2 - 125,
      y: 596,
      width: 200,
      height: 64,
      label: "もう一回",
      fontSize: 26,
      onClick: () => this.restartGame(),
    });

    createButton(this, {
      x: GAME_WIDTH / 2 + 125,
      y: 596,
      width: 200,
      height: 64,
      label: "諦める",
      fontSize: 26,
      onClick: () => this.quitToTitle(),
    });
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 0.68);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x170d0d, 0.95);
    g.fillRoundedRect(178, 112, 668, 532, 18);
    g.lineStyle(4, 0xff6f91, 0.78);
    g.strokeRoundedRect(178, 112, 668, 532, 18);
    g.fillStyle(0xffc545, 0.08);
    g.fillRoundedRect(216, 134, 592, 80, 14);
  }

  private restartGame() {
    const billiards = this.scene.get(BILLIARDS_SCENE_KEY);
    billiards.events.emit("restart-run");
    this.scene.stop();
    this.scene.resume(BILLIARDS_SCENE_KEY);
  }

  private quitToTitle() {
    this.sound.get(BGM_KEY)?.stop();
    this.scene.stop(BILLIARDS_SCENE_KEY);
    this.scene.start("TitleScene");
  }
}
