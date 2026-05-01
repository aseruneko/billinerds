import Phaser from "phaser";
import { GAME_FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from "../../config";
import { createButton } from "../../ui";

const CREDIT_VIEWPORT = {
  x: 96,
  y: 166,
  width: GAME_WIDTH - 192,
  height: GAME_HEIGHT - 302,
};

const CREDIT_TEXT = `Billinerds

当ゲームはAIによって生成された画像とプログラムを含みます

企画・制作
@aseruneko

ゲームエンジン
Phaser

フォント
Noto Sans JP
Noto Color Emoji

BGM
夜想ラヂオ / まんぼう二等兵 様 https://dova-s.jp/bgm/detail/16555

SFX
効果音ラボ 様 https://soundeffect-lab.info/
Alex_Jauk 様 https://pixabay.com/users/alex_jauk-16800354/

Special Thanks
TASくん
`;

export class CreditScene extends Phaser.Scene {
  private creditText?: Phaser.GameObjects.Text;
  private mask?: Phaser.Display.Masks.GeometryMask;
  private maskGraphics?: Phaser.GameObjects.Graphics;
  private scrollbar?: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private contentHeight = 0;
  private wheelHandler?: (
    pointer: Phaser.Input.Pointer,
    objects: unknown,
    dx: number,
    dy: number,
  ) => void;

  constructor() {
    super("CreditScene");
  }

  create() {
    this.drawBackground();
    this.createScrollArea();
    this.drawCreditText();
    this.createBackButton();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.wheelHandler) {
        this.input.off("wheel", this.wheelHandler);
      }
    });
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x050507, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x101812, 0.96);
    g.fillRoundedRect(54, 48, GAME_WIDTH - 108, GAME_HEIGHT - 96, 18);
    g.lineStyle(4, 0xffef9c, 0.78);
    g.strokeRoundedRect(54, 48, GAME_WIDTH - 108, GAME_HEIGHT - 96, 18);
    g.fillStyle(0xffc545, 0.1);
    g.fillRoundedRect(78, 70, GAME_WIDTH - 156, 72, 14);

    this.add
      .text(GAME_WIDTH / 2, 106, "クレジット", {
        color: "#fff1ba",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "44px",
        fontStyle: "900",
        stroke: "#050507",
        strokeThickness: 7,
      })
      .setOrigin(0.5);
  }

  private createScrollArea() {
    this.maskGraphics = this.add.graphics();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(
      CREDIT_VIEWPORT.x,
      CREDIT_VIEWPORT.y,
      CREDIT_VIEWPORT.width,
      CREDIT_VIEWPORT.height,
    );
    this.maskGraphics.setVisible(false);
    this.mask = this.maskGraphics.createGeometryMask();

    this.scrollbar = this.add.graphics();
    this.scrollbar.setDepth(50);

    this.wheelHandler = (
      pointer: Phaser.Input.Pointer,
      _objects: unknown,
      _dx: number,
      dy: number,
    ) => {
      if (!this.isPointerInCreditArea(pointer)) return;
      this.setScroll(this.scrollY + dy * 0.6);
    };
    this.input.on("wheel", this.wheelHandler);
  }

  private drawCreditText() {
    this.creditText?.destroy();

    this.creditText = this.add.text(
      CREDIT_VIEWPORT.x + 18,
      CREDIT_VIEWPORT.y - this.scrollY,
      CREDIT_TEXT,
      {
        color: "#f7f1d7",
        fontFamily: GAME_FONT_FAMILY,
        fontSize: "18px",
        fontStyle: "800",
        lineSpacing: 8,
        wordWrap: {
          width: CREDIT_VIEWPORT.width - 54,
          useAdvancedWrap: true,
        },
      },
    );
    this.creditText.setMask(this.mask!);

    this.contentHeight = this.creditText.displayHeight + 32;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.getMaxScroll());
    this.drawScrollbar();
  }

  private createBackButton() {
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 92,
      width: 180,
      height: 56,
      label: "もどる",
      fontSize: 22,
      variant: "normal",
      onClick: () => this.scene.start("TitleScene"),
    });
  }

  private setScroll(scrollY: number) {
    const nextScrollY = Phaser.Math.Clamp(scrollY, 0, this.getMaxScroll());
    if (nextScrollY === this.scrollY) return;
    this.scrollY = nextScrollY;
    this.drawCreditText();
  }

  private getMaxScroll(): number {
    return Math.max(0, this.contentHeight - CREDIT_VIEWPORT.height);
  }

  private isPointerInCreditArea(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= CREDIT_VIEWPORT.x &&
      pointer.x <= CREDIT_VIEWPORT.x + CREDIT_VIEWPORT.width &&
      pointer.y >= CREDIT_VIEWPORT.y &&
      pointer.y <= CREDIT_VIEWPORT.y + CREDIT_VIEWPORT.height
    );
  }

  private drawScrollbar() {
    this.scrollbar?.clear();
    if (!this.scrollbar) return;

    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return;

    const trackX = CREDIT_VIEWPORT.x + CREDIT_VIEWPORT.width - 12;
    const trackY = CREDIT_VIEWPORT.y + 12;
    const trackHeight = CREDIT_VIEWPORT.height - 24;
    const thumbHeight = Math.max(
      42,
      (CREDIT_VIEWPORT.height / this.contentHeight) * trackHeight,
    );
    const thumbY =
      trackY + (this.scrollY / maxScroll) * (trackHeight - thumbHeight);

    this.scrollbar.fillStyle(0x030604, 0.42);
    this.scrollbar.fillRoundedRect(trackX, trackY, 7, trackHeight, 4);
    this.scrollbar.fillStyle(0xffef9c, 0.78);
    this.scrollbar.fillRoundedRect(trackX - 1, thumbY, 9, thumbHeight, 5);
  }
}
