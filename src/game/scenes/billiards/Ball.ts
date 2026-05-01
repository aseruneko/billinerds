import Phaser from "phaser";
import { GAME_FONT_FAMILY, ITEM_LABEL_FONT_FAMILY } from "../../config";
import type {
  BallCode,
  BallKind,
  BallProperty,
  BallVisualType,
} from "./BallProperty";
import type { CurrentGlobalBuff } from "./GlobalBuff";

type MatterScene = Phaser.Scene & {
  matter: Phaser.Physics.Matter.MatterPhysics;
};

export class Ball {
  readonly property: BallProperty;
  readonly code: BallCode;
  readonly ballKind: BallKind;
  readonly visualType: BallVisualType;
  readonly color: number;
  readonly actionPriority: number;
  maxHp: number;

  weight: number;
  radius: number;
  hp: number;
  sprite: Phaser.Physics.Matter.Image;
  label?: Phaser.GameObjects.Text;
  hpBar?: Phaser.GameObjects.Graphics;
  currentGlobalBuffs: CurrentGlobalBuff[] = [];
  temporaryStatusLabels: string[] = [];
  pocketed = false;
  pocketImmuneUntil = 0;
  previousPosition: Phaser.Math.Vector2;

  constructor(
    scene: MatterScene,
    property: BallProperty,
    x: number,
    y: number,
    textureKey: string,
    labelSize: number,
  ) {
    this.property = property;
    this.code = property.code;
    this.ballKind = property.ballKind;
    this.visualType = property.visualType;
    this.color = property.color;
    this.actionPriority = property.actionPriority;
    this.maxHp = property.maxHp;
    this.weight = property.initialWeight;
    this.radius = property.initialRadius;
    this.hp = property.maxHp;
    this.previousPosition = new Phaser.Math.Vector2(x, y);

    this.sprite = scene.matter.add.image(x, y, textureKey, undefined, {
      shape: { type: "circle", radius: this.radius },
      restitution: 0.96,
      friction: 0,
      frictionAir: 0,
      frictionStatic: 0,
      label: `ball-${this.code}`,
    });
    this.sprite.setCircle(this.radius);
    this.sprite.setFriction(0);
    this.sprite.setFrictionAir(0);
    this.sprite.setBounce(0.96);
    this.sprite.setData("code", this.code);
    this.sprite.setMass(this.weight);
    if (property.fixed) {
      this.sprite.setStatic(true);
    }
    this.sprite.setDepth(20);

    this.label =
      property.label.length > 0
        ? scene.add
            .text(x, y, property.label, {
              color: property.visualType === "eight" ? "#ffffff" : "#191919",
              fontFamily:
                property.visualType === "emoji"
                  ? ITEM_LABEL_FONT_FAMILY
                  : GAME_FONT_FAMILY,
              fontSize: `${labelSize}px`,
              fontStyle: "800",
            })
            .setOrigin(0.5)
            .setDepth(21)
        : undefined;

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(22);
  }

  destroy() {
    this.label?.destroy();
    this.hpBar?.destroy();
    this.sprite.destroy();
  }
}
