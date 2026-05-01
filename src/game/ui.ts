import Phaser from "phaser";
import { GAME_FONT_FAMILY } from "./config";

type ButtonOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  fontSize?: number;
  variant?: "normal" | "primary";
};

export type PhaserButton = Phaser.GameObjects.Container & {
  setLabel: (label: string) => void;
  setEnabled: (enabled: boolean) => void;
};

export type PhaserCheckbox = Phaser.GameObjects.Container & {
  setChecked: (checked: boolean) => void;
};

export function createButton(
  scene: Phaser.Scene,
  options: ButtonOptions,
): PhaserButton {
  const { x, y, width, height, onClick } = options;
  const variant = options.variant ?? "normal";
  const background = scene.add.graphics();
  const text = scene.add.text(0, 0, options.label, {
    color: variant === "primary" ? "#21150a" : "#f7f1d7",
    fontFamily: GAME_FONT_FAMILY,
    fontSize: `${options.fontSize ?? 24}px`,
    fontStyle: "700",
  }).setOrigin(0.5);
  text.setShadow(
    0,
    1,
    variant === "primary" ? "rgba(255, 255, 255, 0.34)" : "rgba(0, 0, 0, 0.42)",
    0,
    true,
    false,
  );

  const container = scene.add.container(x, y, [background, text]) as PhaserButton;
  container.setSize(width, height);
  const hitZone = scene.add.zone(x, y, width, height)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const draw = (
    fill: number,
    stroke: number,
    top: number,
    bottom: number,
    pressedOffset = 0,
  ) => {
    background.clear();
    background.fillStyle(0x000000, 0.32);
    background.fillRoundedRect(
      -width / 2 + 3,
      -height / 2 + 5,
      width,
      height,
      8,
    );

    background.fillStyle(bottom, 1);
    background.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 8);
    background.fillStyle(fill, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    background.fillStyle(top, 0.55);
    background.fillRoundedRect(
      -width / 2 + 5,
      -height / 2 + 5 + pressedOffset,
      width - 10,
      Math.max(8, height * 0.32),
      5,
    );
    background.fillStyle(0x7d3e10, 0.16);
    background.fillRoundedRect(
      -width / 2 + 5,
      height / 2 - 14 + pressedOffset,
      width - 10,
      8,
      4,
    );
    background.lineStyle(3, stroke, 1);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    background.lineStyle(1, 0x5c2c0e, 0.72);
    background.strokeRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 6);
    text.setY(pressedOffset);
  };

  const drawIdle = () =>
    variant === "primary"
      ? draw(0xffc545, 0xffef9c, 0xffe98a, 0xb26322)
      : draw(0x24463a, 0x8cf0bd, 0x3a6a58, 0x142b24);
  const drawHover = () =>
    variant === "primary"
      ? draw(0xffd85a, 0xffffff, 0xfff1a8, 0xbf6c28)
      : draw(0x2e5c4d, 0xd8ffcf, 0x4f8872, 0x18372e);
  const drawPressed = () =>
    variant === "primary"
      ? draw(0xe89a2b, 0xffffff, 0xffc767, 0x8f4717, 2)
      : draw(0x1a392f, 0xd8ffcf, 0x2f5f4f, 0x0e211b, 2);

  drawIdle();

  let pressed = false;
  let enabled = true;
  const drawDisabled = () => draw(0x506057, 0x87988f, 0x6e7f76, 0x2f3934);

  hitZone.on("pointerover", () => {
    if (!enabled) return;
    drawHover();
  });
  hitZone.on("pointerout", () => {
    pressed = false;
    if (enabled) drawIdle();
  });
  hitZone.on("pointerdown", () => {
    if (!enabled) return;
    pressed = true;
    drawPressed();
  });
  hitZone.on("pointerup", () => {
    if (!enabled) return;
    drawHover();
    if (!pressed) return;
    pressed = false;
    onClick();
  });
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    hitZone.destroy();
  });

  container.setLabel = (label: string) => {
    text.setText(label);
  };

  container.setEnabled = (nextEnabled: boolean) => {
    if (enabled === nextEnabled) return;

    enabled = nextEnabled;
    pressed = false;
    hitZone.input!.enabled = nextEnabled;
    container.setAlpha(nextEnabled ? 1 : 0.58);
    if (nextEnabled) drawIdle();
    else drawDisabled();
  };

  return container;
}

export function createCheckbox(
  scene: Phaser.Scene,
  options: {
    x: number;
    y: number;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  },
): PhaserCheckbox {
  const boxSize = 34;
  const background = scene.add.graphics();
  const check = scene.add.text(0, 0, "✓", {
    color: "#21150a",
    fontFamily: GAME_FONT_FAMILY,
    fontSize: "28px",
    fontStyle: "900",
  }).setOrigin(0.5);
  const label = scene.add.text(boxSize / 2 + 18, 0, options.label, {
    color: "#f7f1d7",
    fontFamily: GAME_FONT_FAMILY,
    fontSize: "24px",
    fontStyle: "800",
  }).setOrigin(0, 0.5);

  const container = scene.add.container(options.x, options.y, [
    background,
    check,
    label,
  ]) as PhaserCheckbox;
  const hitWidth = boxSize + 24 + label.width;
  const hitZone = scene.add
    .zone(options.x + hitWidth / 2 - boxSize / 2, options.y, hitWidth, 48)
    .setInteractive({ useHandCursor: true });
  let checked = options.checked;

  const draw = () => {
    background.clear();
    background.fillStyle(0x000000, 0.32);
    background.fillRoundedRect(-boxSize / 2 + 3, -boxSize / 2 + 4, boxSize, boxSize, 7);
    background.fillStyle(checked ? 0xffc545 : 0x101812, 1);
    background.fillRoundedRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 7);
    background.lineStyle(3, 0xffef9c, 0.9);
    background.strokeRoundedRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, 7);
    check.setVisible(checked);
  };

  hitZone.on("pointerup", () => {
    checked = !checked;
    draw();
    options.onChange(checked);
  });
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    hitZone.destroy();
  });

  container.setChecked = (nextChecked: boolean) => {
    checked = nextChecked;
    draw();
  };

  draw();
  return container;
}

export function createHudText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, label, {
    color: "#f7f1d7",
    fontFamily: GAME_FONT_FAMILY,
    fontSize: "22px",
    fontStyle: "700",
  });
}
