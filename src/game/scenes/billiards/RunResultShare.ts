import Phaser from "phaser";
import { GAME_FONT_FAMILY, VERSION } from "../../config";
import { Items, type ItemCode } from "./shop/item/Item";

export type StageShotRecord = {
  stageNumber: number;
  shots: number;
  per: number;
  completed: boolean;
};

export type RunResultData = {
  result: "GAME OVER" | "GAME CLEAR";
  finalMoney: number;
  totalEarnedMoney: number;
  totalShots: number;
  currentStage: number;
  ownedItemCodes: ItemCode[];
  stageShotRecords: StageShotRecord[];
};

export function buildRunResultText(data: RunResultData): string {
  return [
    `Billinerds ${VERSION} - ${data.result}`,
    "",
    `最終所持金額 $${data.finalMoney}`,
    `総獲得金額 $${data.totalEarnedMoney}`,
    `総打数 ${data.totalShots}`,
    "",
    ...buildItemLines(data.ownedItemCodes),
    "",
    ...buildStageShotLines(data.stageShotRecords),
  ].join("\n");
}

export function addRunResultSharePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
) {
  const fontFamily = GAME_FONT_FAMILY.replaceAll('"', "'");
  const dom = scene.add.dom(x, y).createFromHTML(`
    <div style="
      width: 560px;
      font-family: ${fontFamily};
      color: #f7f1d7;
      user-select: auto;
    ">
      <textarea readonly aria-label="Run result" style="
        box-sizing: border-box;
        width: 560px;
        height: 190px;
        resize: none;
        padding: 12px 14px;
        border: 2px solid rgba(255, 208, 108, 0.72);
        border-radius: 8px;
        outline: none;
        background: rgba(8, 9, 12, 0.92);
        color: #fff7da;
        font-family: ${fontFamily};
        font-size: 15px;
        line-height: 1.42;
        white-space: pre;
      ">${escapeHtml(text)}</textarea>
      <button type="button" style="
        display: block;
        width: 148px;
        height: 34px;
        margin: 8px auto 0;
        border: 2px solid rgba(255, 208, 108, 0.86);
        border-radius: 8px;
        background: #463a2c;
        color: #fff1ba;
        font-family: ${fontFamily};
        font-size: 17px;
        font-weight: 900;
        cursor: pointer;
      ">COPY</button>
    </div>
  `);
  dom.setDepth(310);

  const root = dom.node as HTMLElement;
  const textarea = root.querySelector("textarea") as HTMLTextAreaElement | null;
  const button = root.querySelector("button") as HTMLButtonElement | null;

  button?.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!textarea) return;

    const copied = await copyText(textarea.value, textarea);
    if (!copied || !button) return;

    button.textContent = "COPIED";
    window.setTimeout(() => {
      button.textContent = "COPY";
    }, 900);
  });

  return dom;
}

function buildItemLines(ownedItemCodes: ItemCode[]): string[] {
  if (ownedItemCodes.length === 0) return ["None"];

  const countByCode = new Map<ItemCode, number>();
  for (const itemCode of ownedItemCodes) {
    countByCode.set(itemCode, (countByCode.get(itemCode) ?? 0) + 1);
  }

  return [...countByCode.entries()].map(([itemCode, count]) => {
    const item = Items.find((candidate) => candidate.code === itemCode);
    const name = item?.name ?? itemCode;
    return count > 1 ? `- ${name} x${count}` : `- ${name}`;
  });
}

function buildStageShotLines(records: StageShotRecord[]): string[] {
  if (records.length === 0) return ["None"];

  return records.map((record) => {
    const diff = record.shots - record.per;
    const diffLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;
    const failedLabel = record.completed ? "" : " (Failed)";
    return `Stage ${record.stageNumber}: ${record.shots} / ${record.per}  ${diffLabel}${failedLabel}`;
  });
}

async function copyText(
  text: string,
  textarea: HTMLTextAreaElement,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    textarea.focus();
    textarea.select();
    return document.execCommand("copy");
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
