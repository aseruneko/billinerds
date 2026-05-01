export const NAVIGATOR_NAME = "パルケウチカプ";

const stageStart: Record<number, string[]> = {
  1: [
    "いらっしゃいませ！2430年創業老舗ビリナードバー『キューバッカ』へようこそ！私はナビゲータのパルケウチカプです。お見知りおきを！",
    "マウスで狙いを定めて、クリック長押しでパワーを貯めてドッカーン！とやっちゃってください！右クリックでキャンセルもできますよ。",
    "メニュー画面から詳しいルールも見れますし、私のメッセージも消すことが可能です。およよ～。",
  ],
  3: ["マウスオーバーすると、敵球のステータス確認ができますよ～。"],
  4: [
    "おっ、毒沼ですね～。テンションが上がります！これも、マウスオーバーで効果を確認可能ですよ～。",
  ],
};

const shopAfterStage: Record<number, string[]> = {
  1: [
    "ショップへようこそ～。次のステージにむけて、しっかり備えてくださいね！",
    "そういえばメニューからアクセスできるルールは随時増えていくみたいですので、気になるならチェックしてください！",
  ],
  2: ["新商品を入荷しました！よっかったら買っていってね！"],
  3: ["閉店セール初めました！大安売りですよ～。閉店はしないんですが。"],
};

export function getStageStartDialogue(
  stageNumber: number,
): string[] | undefined {
  return stageStart[stageNumber];
}

export function getShopDialogue(
  afterStageNumber: number,
): string[] | undefined {
  return shopAfterStage[afterStageNumber];
}
