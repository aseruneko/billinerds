import Phaser from "phaser";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../../config";
import { createButton } from "../../../ui";
import type { ItemCode } from "../shop/item/Item";
import { SplashText } from "../ui/SplashText";

const BILLIARDS_SCENE_KEY = "BilliardsScene";

type StageClearData = {
  stageNumber: number;
  stageShots: number;
  stagePer: number;
  startingMoney: number;
  money: number;
  clearReward: number;
  lowShotBonus: number;
  ownedItemCodes: ItemCode[];
};

export class StageClearScene extends Phaser.Scene {
  private stageNumber = 1;
  private stageShots = 0;
  private stagePer = 0;
  private startingMoney = 0;
  private money = 0;
  private clearReward = 0;
  private lowShotBonus = 0;
  private ownedItemCodes: ItemCode[] = [];
  private transitioning = false;
  private displayedMoney = 0;
  private moneyText?: Phaser.GameObjects.Text;
  private splashText?: SplashText;

  constructor() {
    super("StageClearScene");
  }

  init(data: StageClearData) {
    this.stageNumber = data.stageNumber;
    this.stageShots = data.stageShots;
    this.stagePer = data.stagePer;
    this.startingMoney = data.startingMoney;
    this.money = data.money;
    this.clearReward = data.clearReward;
    this.lowShotBonus = data.lowShotBonus;
    this.ownedItemCodes = data.ownedItemCodes;
    this.transitioning = false;
    this.displayedMoney = data.startingMoney;
    this.moneyText = undefined;
    this.splashText = undefined;
  }

  create() {
    this.splashText = new SplashText(this);
    this.drawOverlay();

    this.add
      .text(GAME_WIDTH / 2, 224, `STAGE ${this.stageNumber} CLEAR`, {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "56px",
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

    this.add
      .text(
        GAME_WIDTH / 2,
        350,
        `ショット数 ${this.stageShots} / ${this.stagePer}`,
        {
          color: "#f7f1d7",
          fontFamily: GAME_FONT_FAMILY,
          fontSize: "30px",
          fontStyle: "800",
          lineSpacing: 14,
        },
      )
      .setOrigin(0.5);

    this.moneyText = this.add
      .text(GAME_WIDTH / 2, 420, `${this.displayedMoney}$`, {
        color: "#ffec8a",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "34px",
        fontStyle: "900",
      })
      .setOrigin(0.5);

    this.playRewardSequence();

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 528,
      width: 200,
      height: 64,
      label: "OK",
      fontSize: 28,
      onClick: () => this.nextStage(),
    });
  }

  private drawOverlay() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 0.62);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.95);
    g.fillRoundedRect(210, 150, 604, 430, 18);
    g.lineStyle(4, 0x8cf0bd, 0.78);
    g.strokeRoundedRect(210, 150, 604, 430, 18);
    g.fillStyle(0xffc545, 0.08);
    g.fillRoundedRect(234, 172, 556, 104, 14);
  }

  private nextStage() {
    if (this.transitioning) return;

    this.transitioning = true;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.splashText?.clear();
    this.scene.launch("ShopScene", {
      money: this.money,
      ownedItemCodes: this.ownedItemCodes,
      afterStageNumber: this.stageNumber,
    });
    this.scene.bringToTop("ShopScene");
    this.scene.stop();
  }

  private playRewardSequence() {
    let delay = 260;
    delay += this.queueMoneyReward(delay, this.clearReward, "クリア報酬");

    if (this.lowShotBonus > 0 && this.stageShots < this.stagePer) {
      delay += this.queueMoneyReward(
        delay,
        this.lowShotBonus,
        "少ないショット",
      );
    }
  }

  private queueMoneyReward(
    delay: number,
    amount: number,
    label: string,
  ): number {
    if (amount <= 0) return 0;

    this.time.delayedCall(delay, () => {
      this.showRewardSplash(label, amount);
      this.animateMoney(this.displayedMoney, this.displayedMoney + amount);
    });

    return 900;
  }

  private animateMoney(from: number, to: number) {
    const counter = { value: from };
    this.tweens.add({
      targets: counter,
      value: to,
      duration: 720,
      ease: "Cubic.Out",
      onUpdate: () => {
        this.displayedMoney = Math.round(counter.value);
        this.moneyText?.setText(`${this.displayedMoney}$`);
      },
      onComplete: () => {
        this.displayedMoney = to;
        this.moneyText?.setText(`${this.displayedMoney}$`);
      },
    });
  }

  private showRewardSplash(label: string, amount: number) {
    this.splashText?.show({
      position: new Phaser.Math.Vector2(GAME_WIDTH / 2, 380),
      text: `${amount}$`,
      color: "#fff1ba",
      fontSize: 30,
      stroke: "#261000",
      strokeThickness: 5,
      subText: label,
      subColor: "#ffec8a",
      subFontSize: 18,
      rise: 24,
      duration: 180,
      hold: 460,
      fadeDuration: 180,
      depth: 40,
    });
  }
}
