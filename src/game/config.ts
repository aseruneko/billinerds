export const DEBUG_MODE = false;
export const VERSION = "v0.0.2";

export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
export const GAME_FONT_FAMILY =
  '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", "Segoe UI", Arial, sans-serif';
export const ITEM_LABEL_FONT_FAMILY = '"NotoColorEmoji"';

export const TABLE = {
  x: 96,
  y: 64,
  width: 832,
  height: 468,
  rail: 34,
  pocketRadius: 26,
  feltColor: 0x148a59,
  feltShadow: 0x0c593c,
  railColor: 0x653414,
  railLight: 0xa4642c,
  bumperColor: 0x0f6f4a,
};

export const BALL_RADIUS = 13;
export const BALL_DIAMETER = BALL_RADIUS * 2;
export const POCKET_CAPTURE_RADIUS = TABLE.pocketRadius + 10;
export const CONTROL_AREA_MARGIN_WIDTH = 96;
export const CONTROL_AREA_MARGIN_HEIGHT = 64;
export const BALL_FRICTION = 0.014;
export const STOP_SPEED = 0.08;
export const MAX_POWER = 36;
export const POWER_CHARGE_MS = 1200;

export const CUE_START = {
  x: TABLE.x + TABLE.width * 0.25,
  y: TABLE.y + TABLE.height * 0.5,
};

export const RACK_START = {
  x: TABLE.x + TABLE.width * 0.68,
  y: TABLE.y + TABLE.height * 0.5,
};

export const POCKETS = [
  { x: TABLE.x + TABLE.rail, y: TABLE.y + TABLE.rail },
  { x: TABLE.x + TABLE.width / 2, y: TABLE.y + TABLE.rail - 2 },
  { x: TABLE.x + TABLE.width - TABLE.rail, y: TABLE.y + TABLE.rail },
  { x: TABLE.x + TABLE.rail, y: TABLE.y + TABLE.height - TABLE.rail },
  { x: TABLE.x + TABLE.width / 2, y: TABLE.y + TABLE.height - TABLE.rail + 2 },
  {
    x: TABLE.x + TABLE.width - TABLE.rail,
    y: TABLE.y + TABLE.height - TABLE.rail,
  },
];
