import {
  BallCode,
  type BallCode as BallCodeType,
} from "../billiards/BallProperty";
import { ItemCode, type ItemCode as ItemCodeType } from "../billiards/shop/item/Item";

const STORAGE_KEY = "billinard.encyclopedia.discovery.v1";

type DiscoveryData = {
  ballCodes: BallCodeType[];
  itemCodes: ItemCodeType[];
};

const BallCodeValues = new Set<string>(Object.values(BallCode));
const ItemCodeValues = new Set<string>(Object.values(ItemCode));

export function discoverBall(code: BallCodeType) {
  const data = loadDiscoveryData();
  if (!data.ballCodes.includes(code)) data.ballCodes.push(code);
  saveDiscoveryData(data);
}

export function discoverBalls(codes: BallCodeType[]) {
  const data = loadDiscoveryData();
  let changed = false;
  for (const code of codes) {
    if (data.ballCodes.includes(code)) continue;
    data.ballCodes.push(code);
    changed = true;
  }
  if (changed) saveDiscoveryData(data);
}

export function discoverItem(code: ItemCodeType) {
  const data = loadDiscoveryData();
  if (!data.itemCodes.includes(code)) data.itemCodes.push(code);
  saveDiscoveryData(data);
}

export function discoverItems(codes: ItemCodeType[]) {
  const data = loadDiscoveryData();
  let changed = false;
  for (const code of codes) {
    if (data.itemCodes.includes(code)) continue;
    data.itemCodes.push(code);
    changed = true;
  }
  if (changed) saveDiscoveryData(data);
}

export function getDiscoveredBalls(): Set<BallCodeType> {
  return new Set(loadDiscoveryData().ballCodes);
}

export function getDiscoveredItems(): Set<ItemCodeType> {
  return new Set(loadDiscoveryData().itemCodes);
}

function loadDiscoveryData(): DiscoveryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ballCodes: [], itemCodes: [] };

    const parsed = JSON.parse(raw) as Partial<DiscoveryData>;
    return normalizeDiscoveryData(parsed);
  } catch {
    return { ballCodes: [], itemCodes: [] };
  }
}

function saveDiscoveryData(data: DiscoveryData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDiscoveryData(data)));
}

function normalizeDiscoveryData(data: Partial<DiscoveryData>): DiscoveryData {
  return {
    ballCodes: uniqueKnownValues(data.ballCodes, BallCodeValues) as BallCodeType[],
    itemCodes: uniqueKnownValues(data.itemCodes, ItemCodeValues) as ItemCodeType[],
  };
}

function uniqueKnownValues(
  values: unknown,
  knownValues: Set<string>,
): string[] {
  if (!Array.isArray(values)) return [];

  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    if (!knownValues.has(value)) continue;
    if (result.includes(value)) continue;
    result.push(value);
  }
  return result;
}
