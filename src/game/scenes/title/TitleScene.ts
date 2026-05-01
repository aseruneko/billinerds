import Phaser from "phaser";
import titleBgUrl from "../../../assets/title_bg.png";
import titleLogoUrl from "../../../assets/title_logo.png";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH, VERSION } from "../../config";
import { createButton } from "../../ui";

const TITLE_BG_KEY = "title-bg";
const TITLE_LOGO_KEY = "title-logo";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload() {
    this.load.image(TITLE_BG_KEY, titleBgUrl);
    this.load.image(TITLE_LOGO_KEY, titleLogoUrl);
  }

  create() {
    this.cameras.main.setBackgroundColor("#08080c");
    this.drawBackground();

    this.add
      .image(GAME_WIDTH / 2, 100, TITLE_LOGO_KEY)
      .setOrigin(0.5)
      .setDisplaySize(520, 156);

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 462,
      width: 248,
      height: 54,
      label: "スタート",
      fontSize: 24,
      variant: "primary",
      onClick: () => this.scene.start("BilliardsScene"),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 534,
      width: 248,
      height: 54,
      label: "図鑑",
      fontSize: 24,
      onClick: () => this.scene.start("EncyclopediaScene"),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 606,
      width: 248,
      height: 54,
      label: "設定",
      fontSize: 24,
      onClick: () => this.scene.start("SettingsScene"),
    });

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 678,
      width: 248,
      height: 54,
      label: "クレジット",
      fontSize: 24,
      variant: "normal",
      onClick: () => this.scene.start("CreditScene"),
    });

    this.add
      .text(28, GAME_HEIGHT - 34, VERSION, {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "700",
      })
      .setAlpha(0.76);

    this.add
      .text(GAME_WIDTH - 28, GAME_HEIGHT - 34, "@aseruneko", {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "700",
      })
      .setOrigin(1, 0)
      .setAlpha(0.76);
  }

  private drawBackground() {
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TITLE_BG_KEY)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.74);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x020306, 0.42);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.fillStyle(0x0b3a2a, 0.18);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
