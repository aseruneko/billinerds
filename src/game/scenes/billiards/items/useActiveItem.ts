import {
  ItemCode,
  type Item,
} from "../shop/item/Item";
import {
  getText,
  TextCode,
  type TextCodeType,
} from "../../../text/TextDictionary";

export type TargetedItemMode =
  | "growth"
  | "shrink"
  | "blast"
  | "repulse"
  | "attract"
  | "relocateCue";

export type ActiveItemContext = {
  consumeItemUse: (item: Item) => boolean;
  tiltTable: () => void;
  gatherBalls: () => void;
  getCueBallMissingHp: () => number;
  healCueBall: (amount: number) => void;
  canActivateTemporaryCueGrowth: () => boolean;
  activateTemporaryCueGrowth: () => void;
  canActivateTemporaryCueWeight: () => boolean;
  activateTemporaryCueWeight: () => void;
  canActivateTemporaryCuePhase: () => boolean;
  activateTemporaryCuePhase: () => void;
  slowAllBalls: (scale: number) => void;
  addBackspinShot: () => void;
  addPenaltyWaiver: () => void;
  damageTargetBalls: (amount: number, reason: TextCodeType | string) => void;
  endPlayerTurn: () => void;
  beginTargetedItemMode: (item: Item, mode: TargetedItemMode) => void;
  showStatusSplash: (label: string) => void;
};

export function useActiveItem(item: Item, context: ActiveItemContext) {
  switch (item.code) {
    case ItemCode.Rage:
      if (context.consumeItemUse(item)) context.tiltTable();
      break;
    case ItemCode.Magnet:
      if (context.consumeItemUse(item)) context.gatherBalls();
      break;
    case ItemCode.FirstAidPatch:
      if (!context.consumeItemUse(item)) break;
      context.healCueBall(Math.ceil(context.getCueBallMissingHp() * 0.3));
      break;
    case ItemCode.GiantChalk:
      if (!context.canActivateTemporaryCueGrowth()) break;
      if (!context.consumeItemUse(item)) break;
      context.activateTemporaryCueGrowth();
      break;
    case ItemCode.HeavyCue:
      if (!context.canActivateTemporaryCueWeight()) break;
      if (!context.consumeItemUse(item)) break;
      context.activateTemporaryCueWeight();
      break;
    case ItemCode.PhaseCue:
      if (!context.canActivateTemporaryCuePhase()) break;
      if (!context.consumeItemUse(item)) break;
      context.activateTemporaryCuePhase();
      break;
    case ItemCode.BlastMarker:
      context.beginTargetedItemMode(item, "blast");
      break;
    case ItemCode.RepulseMarker:
      context.beginTargetedItemMode(item, "repulse");
      break;
    case ItemCode.AttractMarker:
      context.beginTargetedItemMode(item, "attract");
      break;
    case ItemCode.CueRelocator:
      context.beginTargetedItemMode(item, "relocateCue");
      break;
    case ItemCode.DrawGo:
      if (!context.consumeItemUse(item)) break;
      context.showStatusSplash(getText(TextCode.statusDrawGo));
      context.endPlayerTurn();
      break;
  }
}
