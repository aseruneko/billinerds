import { useEffect, useRef } from "preact/hooks";
import notoColorEmojiUrl from "./assets/NotoColorEmoji-Regular.ttf";
import { createBillinardGame } from "./game/createGame";

const ITEM_LABEL_FONT = "NotoColorEmoji";

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    let disposed = false;
    let game: Phaser.Game | undefined;

    const startGame = async () => {
      await loadItemLabelFont();
      if (disposed || !hostRef.current) return;

      game = createBillinardGame(hostRef.current);
    };

    void startGame();

    return () => {
      disposed = true;
      game?.destroy(true);
    };
  }, []);

  return <div ref={hostRef} class="game-host" />;
}

async function loadItemLabelFont() {
  if (!("fonts" in document)) return;

  const fontFace = new FontFace(
    ITEM_LABEL_FONT,
    `url(${notoColorEmojiUrl}) format("truetype")`,
  );
  await fontFace.load();
  document.fonts.add(fontFace);
  await document.fonts.ready;
}
