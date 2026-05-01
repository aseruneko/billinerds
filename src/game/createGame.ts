import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { BilliardsScene } from "./scenes/billiards/BilliardsScene";
import { GameClearScene } from "./scenes/billiards/gameclear/GameClearScene";
import { GameOverScene } from "./scenes/billiards/gameover/GameOverScene";
import { MenuScene } from "./scenes/billiards/menu/MenuScene";
import { ShopScene } from "./scenes/billiards/shop/ShopScene";
import { StageClearScene } from "./scenes/billiards/stageclear/StageClearScene";
import { CreditScene } from "./scenes/credit/CreditScene";
import { DialogueScene } from "./scenes/dialogue/DialogueScene";
import { EncyclopediaScene } from "./scenes/encyclopedia/EncyclopediaScene";
import { RuleScene } from "./scenes/rule/RuleScene";
import { SettingsScene } from "./scenes/settings/SettingsScene";
import { TitleScene } from "./scenes/title/TitleScene";

export function createBillinardGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101016",
    dom: {
      createContainer: true,
    },
    physics: {
      default: "matter",
      matter: {
        gravity: { x: 0, y: 0 },
        positionIterations: 12,
        velocityIterations: 10,
        debug: false,
      },
    },
    scene: [
      TitleScene,
      SettingsScene,
      BilliardsScene,
      MenuScene,
      GameOverScene,
      GameClearScene,
      StageClearScene,
      ShopScene,
      DialogueScene,
      EncyclopediaScene,
      CreditScene,
      RuleScene,
    ],
  });
}
