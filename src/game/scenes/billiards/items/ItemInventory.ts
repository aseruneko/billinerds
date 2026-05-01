import { Items, type Item, type ItemCode } from "../shop/item/Item";

export type OwnedItemEntry = {
  item: Item;
  count: number;
};

export class ItemInventory {
  private ownedItemCodes: ItemCode[] = [];
  private usesRemainingByCode = new Map<ItemCode, number>();

  reset() {
    this.ownedItemCodes = [];
    this.usesRemainingByCode.clear();
  }

  add(itemCode: ItemCode) {
    this.ownedItemCodes.push(itemCode);
  }

  getCodes(): ItemCode[] {
    return [...this.ownedItemCodes];
  }

  has(itemCode: ItemCode): boolean {
    return this.ownedItemCodes.includes(itemCode);
  }

  count(itemCode: ItemCode): number {
    return this.ownedItemCodes.filter((ownedItemCode) => ownedItemCode === itemCode).length;
  }

  getEntries(): OwnedItemEntry[] {
    const countByCode = new Map<ItemCode, number>();
    for (const itemCode of this.ownedItemCodes) {
      countByCode.set(itemCode, (countByCode.get(itemCode) ?? 0) + 1);
    }

    return [...countByCode.entries()]
      .map(([itemCode, count]) => {
        const item = Items.find((candidate) => candidate.code === itemCode);
        if (!item) return null;
        return { item, count };
      })
      .filter((entry): entry is OwnedItemEntry => entry !== null);
  }

  resetUsesForStage() {
    this.usesRemainingByCode.clear();
    for (const entry of this.getEntries()) {
      if (entry.item.useCount === undefined) continue;

      this.usesRemainingByCode.set(
        entry.item.code,
        this.getMaxUses(entry.item, entry.count),
      );
    }
  }

  getUsesRemaining(itemCode: ItemCode): number {
    return this.usesRemainingByCode.get(itemCode) ?? 0;
  }

  getMaxUses(item: Item, count: number): number {
    return item.useCount === undefined ? 0 : item.useCount * count;
  }

  consumeUse(item: Item): boolean {
    const remaining = this.getUsesRemaining(item.code);
    if (remaining <= 0) return false;

    this.usesRemainingByCode.set(item.code, remaining - 1);
    return true;
  }
}
