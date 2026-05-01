import type { BallCode } from "./BallProperty";

export const GlobalBuffCode = {
  poisonImmune: "POISON_IMMUNE",
  attackUp: "ATTACK_UP",
  blockRateDown: "BLOCK_RATE_DOWN",
  hollowGuard: "HOLLOW_GUARD",
} as const;

export type GlobalBuffCode =
  (typeof GlobalBuffCode)[keyof typeof GlobalBuffCode];

export type GlobalBuffDefinition = {
  name: string;
  description: string;
};

export const GlobalBuffRoster: Record<GlobalBuffCode, GlobalBuffDefinition> = {
  [GlobalBuffCode.poisonImmune]: {
    name: "毒耐性",
    description: "毒によるダメージを受けない",
  },
  [GlobalBuffCode.attackUp]: {
    name: "攻撃力上昇",
    description: "衝突時のダメージが1.2倍",
  },
  [GlobalBuffCode.blockRateDown]: {
    name: "防御率低下",
    description: "受けるダメージ倍率が0.8倍",
  },
  [GlobalBuffCode.hollowGuard]: {
    name: "封印防御",
    description: "ホロウキングが受けるダメージを軽減する",
  },
};

export type CurrentGlobalBuff = {
  code: GlobalBuffCode;
  from: BallCode;
  amount: number;
};
