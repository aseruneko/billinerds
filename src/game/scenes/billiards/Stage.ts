import { BALL_RADIUS, CUE_START, RACK_START, TABLE } from "../../config";
import { BallCode, type BallCode as BallCodeType } from "./BallProperty";

export type StageBallPlacement = {
  ballCode: BallCodeType;
  x: number;
  y: number;
};

export const RouletteEffectCode = {
  spawnChips: "SPAWN_CHIPS",
  spawnClub: "SPAWN_CLUB",
  spawnSpade: "SPAWN_SPADE",
  spawnHeart: "SPAWN_HEART",
  spawnDiamond: "SPAWN_DIAMOND",
  nothing: "NOTHING",
  gainMoney: "GAIN_MONEY",
  cueDamage: "CUE_DAMAGE",
  growAll: "GROW_ALL",
  shrinkAll: "SHRINK_ALL",
} as const;

export type RouletteEffectCode =
  (typeof RouletteEffectCode)[keyof typeof RouletteEffectCode];

export type RouletteSegment = {
  effect: RouletteEffectCode;
  label: string;
  name: string;
  description: string;
  color: number;
};

export type PoisonHazard = {
  type: "poison";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  damage: number;
};

export type FogHazard = {
  type: "fog";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  heal: number;
};

export type RouletteHazard = {
  type: "roulette";
  x: number;
  y: number;
  radius: number;
  segments: RouletteSegment[];
};

export type MirrorHazard = {
  type: "mirror";
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

export type MagicCircleHazard = {
  type: "magicCircle";
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
  points?: Array<{ x: number; y: number }>;
};

export type StageHazard =
  | PoisonHazard
  | FogHazard
  | RouletteHazard
  | MirrorHazard
  | MagicCircleHazard;

export type PillarObstacle = {
  type: "pillar";
  x: number;
  y: number;
  size: number;
};

export type RectObstacle = {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StageObstacle = PillarObstacle | RectObstacle;

export type Stage = {
  id: number;
  per: number;
  reward: number;
  ballPlacements: StageBallPlacement[];
  hazards?: StageHazard[];
  obstacles?: StageObstacle[];
};

const rackCodes: BallCodeType[] = [
  BallCode.one,
  BallCode.eight,
  BallCode.seven,
  BallCode.thirteen,
  BallCode.twelve,
  BallCode.eleven,
  BallCode.ten,
  BallCode.fifteen,
  BallCode.fourteen,
  BallCode.nine,
  BallCode.three,
  BallCode.six,
  BallCode.five,
  BallCode.four,
  BallCode.two,
];

function rackPlacement(ballCodes: BallCodeType[]): StageBallPlacement[] {
  const placements: StageBallPlacement[] = [];
  let index = 0;

  for (let row = 0; row < 5 && index < ballCodes.length; row++) {
    for (let col = 0; col <= row && index < ballCodes.length; col++) {
      placements.push({
        ballCode: ballCodes[index],
        x: RACK_START.x + row * (BALL_RADIUS * 1.84),
        y: RACK_START.y + (col - row / 2) * (BALL_RADIUS * 2.12),
      });
      index += 1;
    }
  }

  return placements;
}

function circlePlacement(
  ballCode: BallCodeType,
  count: number,
  centerX: number,
  centerY: number,
  radius: number,
  angleOffset = 0,
): StageBallPlacement[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + angleOffset + (Math.PI * 2 * index) / count;
    return {
      ballCode,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });
}

function scatteredPlacement(
  ballCode: BallCodeType,
  placements: Array<{
    xRatio: number;
    yRatio: number;
    offsetX?: number;
    offsetY?: number;
  }>,
): StageBallPlacement[] {
  return placements.map((placement) => ({
    ballCode,
    x:
      TABLE.x +
      TABLE.width * placement.xRatio +
      BALL_RADIUS * (placement.offsetX ?? 0),
    y:
      TABLE.y +
      TABLE.height * placement.yRatio +
      BALL_RADIUS * (placement.offsetY ?? 0),
  }));
}

const cuePlacement: StageBallPlacement = {
  ballCode: BallCode.cue,
  x: CUE_START.x,
  y: CUE_START.y,
};
const chessCenter = {
  x: TABLE.x + TABLE.width * 0.68,
  y: TABLE.y + TABLE.height * 0.5,
};
const poisonFelt = {
  x: TABLE.x + TABLE.width * 0.52,
  y: TABLE.y + TABLE.height * 0.5 - 60,
  width: 220,
  height: 120,
};
const spookyFog = {
  x: TABLE.x + TABLE.width * 0.46 - 16,
  y: TABLE.y + TABLE.height * 0.5 - TABLE.height * 0.39 + 8,
  width: TABLE.width * 0.5,
  height: TABLE.height * 0.78 - 16,
};
const spookyGateWidth = 30;
const spookyGateGap = 112;
const spookyGateHeight = (spookyFog.height - spookyGateGap) / 2;
const spookyGateObstacles: StageObstacle[] = [
  {
    type: "rect",
    x: spookyFog.x - spookyGateWidth / 2 - 10,
    y: spookyFog.y + spookyGateHeight / 2,
    width: spookyGateWidth,
    height: spookyGateHeight,
  },
  {
    type: "rect",
    x: spookyFog.x - spookyGateWidth / 2 - 10,
    y: spookyFog.y + spookyFog.height - spookyGateHeight / 2,
    width: spookyGateWidth,
    height: spookyGateHeight,
  },
];
const stageTenMirror = {
  x: TABLE.x + TABLE.width * 0.31,
  y: TABLE.y + TABLE.height * 0.5 - 116,
  width: TABLE.width * 0.456,
  height: 232,
};
const stageTenPoison = {
  x: TABLE.x + TABLE.rail + 14,
  y: TABLE.y + TABLE.rail + 18,
  width: 78,
  height: TABLE.height - TABLE.rail * 2 - 36,
};
const stageTenFog = {
  x: TABLE.x + TABLE.width - TABLE.rail - 92,
  y: TABLE.y + TABLE.rail + 18,
  width: 78,
  height: TABLE.height - TABLE.rail * 2 - 36,
};
const stageElevenPoison = {
  x: TABLE.x + TABLE.rail + 14,
  y: TABLE.y + TABLE.rail + 18,
  width: 76,
  height: TABLE.height - TABLE.rail * 2 - 36,
};
const hollowSealPositions = [
  { x: TABLE.x + TABLE.width * 0.38 + 36, y: TABLE.y + TABLE.height * 0.5 },
  { x: TABLE.x + TABLE.width * 0.62 + 36, y: TABLE.y + TABLE.height * 0.27 },
  { x: TABLE.x + TABLE.width * 0.62 + 36, y: TABLE.y + TABLE.height * 0.73 },
];
const hollowSealCircle = {
  x:
    hollowSealPositions.reduce((total, position) => total + position.x, 0) /
    hollowSealPositions.length,
  y:
    hollowSealPositions.reduce((total, position) => total + position.y, 0) /
    hollowSealPositions.length,
  radius: 168,
};
const hollowSealBallPositions = hollowSealPositions.map((position, index) => {
  const dx = hollowSealCircle.x - position.x;
  const dy = hollowSealCircle.y - position.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return position;

  const scale = 50 / length;
  const pulledPosition = {
    x: position.x + dx * scale,
    y: position.y + dy * scale,
  };
  if (index === 1) {
    const offset = 16 / Math.SQRT2;
    const southeastOffset = 6 / Math.SQRT2;
    return {
      x: pulledPosition.x + offset + southeastOffset,
      y: pulledPosition.y - offset + southeastOffset,
    };
  }
  if (index === 2) {
    const angle = Math.PI / 8;
    return {
      x: pulledPosition.x + Math.cos(angle) * 16,
      y: pulledPosition.y + Math.sin(angle) * 16 - 6,
    };
  }

  return pulledPosition;
});
const stageEightPoison = {
  x: TABLE.x + TABLE.rail + 16,
  y: TABLE.y + TABLE.rail + 18,
  width: 76,
  height: TABLE.height - TABLE.rail * 2 - 36,
};
const stageEightObstacle: StageObstacle = {
  type: "rect",
  x: TABLE.x + TABLE.width * 0.5,
  y: TABLE.y + TABLE.height * 0.5,
  width: 44,
  height: 190,
};
const stageFourColumns = {
  pawnX: TABLE.x + TABLE.width * 0.64,
  poisonX: TABLE.x + TABLE.width * 0.69,
  enemyX: TABLE.x + TABLE.width * 0.86,
};
const stageFourPoison = {
  x: TABLE.x + TABLE.width * 0.585,
  width: TABLE.width * 0.19,
};
const stageFourFelt = {
  top: TABLE.y + TABLE.rail,
  bottom: TABLE.y + TABLE.height - TABLE.rail,
  centerY: TABLE.y + TABLE.height * 0.5,
  height: TABLE.height - TABLE.rail * 2,
};
const stageFourEnemyRows = [0.22, 0.36, 0.5, 0.64, 0.78].map(
  (ratio) => stageFourFelt.top + stageFourFelt.height * ratio,
);
const stageFourPawnRows = Array.from(
  { length: 6 },
  (_, index) =>
    stageFourFelt.top + stageFourFelt.height * (0.16 + index * 0.136),
);
const pillarSize = 40;
const pillarGap = 58;
const throneRoomPoison = {
  x: TABLE.x + TABLE.rail + 90 - pillarSize / 2,
  y: TABLE.y + TABLE.rail + 90 + pillarSize / 2 + 8,
  width: pillarSize * 3 + pillarGap * 2,
  height: TABLE.height - TABLE.rail * 2 - 180 - pillarSize - 16,
};
const throneRoomPillars: StageObstacle[] = [0, 1, 2].flatMap((index) => {
  const x = TABLE.x + TABLE.rail + 90 + index * (pillarSize + pillarGap);
  return [
    {
      type: "pillar",
      x,
      y: TABLE.y + TABLE.rail + 90,
      size: pillarSize,
    },
    {
      type: "pillar",
      x,
      y: TABLE.y + TABLE.height - TABLE.rail - 90,
      size: pillarSize,
    },
  ];
});

const rouletteSegments: RouletteSegment[] = [
  {
    effect: RouletteEffectCode.spawnChips,
    label: "CHIP",
    name: "チップラッシュ",
    description: "チップ球を5個追加する",
    color: 0xe05245,
  },
  {
    effect: RouletteEffectCode.spawnClub,
    label: "♣",
    name: "クラブベット",
    description: "クラブを1個追加する",
    color: 0x2f7a4a,
  },
  {
    effect: RouletteEffectCode.spawnSpade,
    label: "♠",
    name: "スペードベット",
    description: "スペードを1個追加する",
    color: 0x46506f,
  },
  {
    effect: RouletteEffectCode.spawnHeart,
    label: "♥",
    name: "ハートベット",
    description: "ハートを1個追加する",
    color: 0xe65a78,
  },
  {
    effect: RouletteEffectCode.spawnDiamond,
    label: "♦",
    name: "ダイヤベット",
    description: "ダイヤを1個追加する",
    color: 0x67c8ff,
  },
  {
    effect: RouletteEffectCode.nothing,
    label: "×",
    name: "ノーベット",
    description: "何も起こらない",
    color: 0x45414c,
  },
  {
    effect: RouletteEffectCode.gainMoney,
    label: "$",
    name: "ミニジャックポット",
    description: "即座に25$を得る",
    color: 0xf3b345,
  },
  {
    effect: RouletteEffectCode.cueDamage,
    label: "!",
    name: "デッドナンバー",
    description: "手球が10ダメージを受ける",
    color: 0xb62d3b,
  },
  {
    effect: RouletteEffectCode.growAll,
    label: "+",
    name: "ビッグテーブル",
    description: "全員のサイズが1.2倍になる",
    color: 0x955dd8,
  },
  {
    effect: RouletteEffectCode.shrinkAll,
    label: "-",
    name: "スモールテーブル",
    description: "全員のサイズが0.8倍になる",
    color: 0x3db5a1,
  },
];

const rouletteNothingSegment: RouletteSegment = {
  effect: RouletteEffectCode.nothing,
  label: "x",
  name: "ノーベット",
  description: "何も起こらない",
  color: 0x45414c,
};

const stageSevenRouletteSegments: RouletteSegment[] = [
  rouletteNothingSegment,
  rouletteSegments[0],
  rouletteSegments[1],
  rouletteSegments[2],
  rouletteNothingSegment,
  rouletteSegments[3],
  rouletteSegments[4],
  rouletteSegments[6],
  rouletteSegments[5],
  rouletteSegments[7],
  rouletteSegments[8],
  rouletteSegments[9],
];

export const Stages = [
  {
    id: 0,
    per: 5,
    reward: 100,
    ballPlacements: [cuePlacement, ...rackPlacement([BallCode.one])],
  },
  {
    id: 1,
    per: 8,
    reward: 100,
    ballPlacements: [cuePlacement, ...rackPlacement(rackCodes)],
  },
  {
    id: 2,
    per: 8,
    reward: 100,
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.rook,
        x: chessCenter.x,
        y: chessCenter.y - BALL_RADIUS * 1.45,
      },
      {
        ballCode: BallCode.bishop,
        x: chessCenter.x,
        y: chessCenter.y + BALL_RADIUS * 1.45,
      },
      ...circlePlacement(
        BallCode.pawn,
        8,
        chessCenter.x,
        chessCenter.y,
        BALL_RADIUS * 6,
      ),
    ],
  },
  {
    id: 3,
    per: 10,
    reward: 100,
    hazards: [
      {
        type: "poison",
        x: stageFourPoison.x,
        y: stageFourFelt.top + 8,
        width: stageFourPoison.width,
        height: stageFourFelt.height - 16,
        radius: 18,
        damage: 5,
      },
    ],
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.knight,
        x: stageFourColumns.enemyX,
        y: stageFourEnemyRows[0],
      },
      {
        ballCode: BallCode.rook,
        x: stageFourColumns.enemyX,
        y: stageFourEnemyRows[1],
      },
      {
        ballCode: BallCode.queen,
        x: stageFourColumns.enemyX,
        y: stageFourEnemyRows[2],
      },
      {
        ballCode: BallCode.rook,
        x: stageFourColumns.enemyX,
        y: stageFourEnemyRows[3],
      },
      {
        ballCode: BallCode.knight,
        x: stageFourColumns.enemyX,
        y: stageFourEnemyRows[4],
      },
      ...stageFourPawnRows.map((y) => ({
        ballCode: BallCode.pawn,
        x: stageFourColumns.pawnX,
        y,
      })),
    ],
  },
  {
    id: 4,
    per: 10,
    reward: 100,
    hazards: [
      {
        type: "poison",
        x: throneRoomPoison.x,
        y: throneRoomPoison.y,
        width: throneRoomPoison.width,
        height: throneRoomPoison.height,
        radius: 18,
        damage: 5,
      },
    ],
    obstacles: throneRoomPillars,
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.king,
        x: TABLE.x + TABLE.width * 0.72,
        y: TABLE.y + TABLE.height * 0.5,
      },
      {
        ballCode: BallCode.queen,
        x: TABLE.x + TABLE.width * 0.82,
        y: TABLE.y + TABLE.height * 0.5,
      },
      {
        ballCode: BallCode.rook,
        x: TABLE.x + TABLE.width * 0.62,
        y: TABLE.y + TABLE.height * 0.5,
      },
      {
        ballCode: BallCode.bishop,
        x: TABLE.x + TABLE.width * 0.72,
        y: TABLE.y + TABLE.height * 0.5 + BALL_RADIUS * 5.2,
      },
      {
        ballCode: BallCode.knight,
        x: TABLE.x + TABLE.width * 0.72,
        y: TABLE.y + TABLE.height * 0.5 - BALL_RADIUS * 5.2,
      },
      ...circlePlacement(
        BallCode.pawn,
        8,
        TABLE.x + TABLE.width * 0.72,
        TABLE.y + TABLE.height * 0.5,
        BALL_RADIUS * 9.2,
        Math.PI / 8,
      ),
    ],
  },
  {
    id: 5,
    per: 10,
    reward: 120,
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.club,
        x: TABLE.x + TABLE.width * 0.56,
        y: TABLE.y + TABLE.height * 0.5 - BALL_RADIUS * 2.4,
      },
      {
        ballCode: BallCode.club,
        x: TABLE.x + TABLE.width * 0.56,
        y: TABLE.y + TABLE.height * 0.5 + BALL_RADIUS * 2.4,
      },
      {
        ballCode: BallCode.chip,
        x: TABLE.x + TABLE.width * 0.66,
        y: TABLE.y + TABLE.height * 0.5 - BALL_RADIUS * 3.1,
      },
      {
        ballCode: BallCode.chip,
        x: TABLE.x + TABLE.width * 0.69,
        y: TABLE.y + TABLE.height * 0.5,
      },
      {
        ballCode: BallCode.chip,
        x: TABLE.x + TABLE.width * 0.66,
        y: TABLE.y + TABLE.height * 0.5 + BALL_RADIUS * 3.1,
      },
      ...scatteredPlacement(BallCode.chip, [
        { xRatio: 0.46, yRatio: 0.28, offsetX: -0.4, offsetY: 0.3 },
        { xRatio: 0.58, yRatio: 0.73, offsetX: 0.6, offsetY: -0.5 },
        { xRatio: 0.74, yRatio: 0.28, offsetX: -0.7, offsetY: -0.2 },
        { xRatio: 0.78, yRatio: 0.7, offsetX: 0.5, offsetY: 0.4 },
      ]),
      {
        ballCode: BallCode.heart,
        x: TABLE.x + TABLE.width * 0.83,
        y: TABLE.y + TABLE.height * 0.5 - BALL_RADIUS * 3.2,
      },
      {
        ballCode: BallCode.spade,
        x: TABLE.x + TABLE.width * 0.8,
        y: TABLE.y + TABLE.height * 0.5 + BALL_RADIUS * 3.4,
      },
      {
        ballCode: BallCode.diamond,
        x: TABLE.x + TABLE.width * 0.91,
        y: TABLE.y + TABLE.height * 0.5 + BALL_RADIUS * 0.4,
      },
    ],
  },
  {
    id: 6,
    per: 10,
    reward: 150,
    hazards: [
      {
        type: "roulette",
        x: TABLE.x + TABLE.width * 0.5,
        y: TABLE.y + TABLE.height * 0.5,
        radius: 138,
        segments: stageSevenRouletteSegments,
      },
    ],
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.diamond,
        x: TABLE.x + TABLE.rail + BALL_RADIUS + 25,
        y: TABLE.y + TABLE.rail + BALL_RADIUS + 17,
      },
      {
        ballCode: BallCode.diamond,
        x: TABLE.x + TABLE.width - TABLE.rail - BALL_RADIUS - 25,
        y: TABLE.y + TABLE.height - TABLE.rail - BALL_RADIUS - 17,
      },
      ...scatteredPlacement(BallCode.chip, [
        { xRatio: 0.27, yRatio: 0.26, offsetX: -0.5, offsetY: 0.7 },
        { xRatio: 0.35, yRatio: 0.22, offsetX: 0.8, offsetY: -0.2 },
        { xRatio: 0.46, yRatio: 0.19, offsetX: -0.6, offsetY: 0.4 },
        { xRatio: 0.58, yRatio: 0.22, offsetX: 0.5, offsetY: -0.5 },
        { xRatio: 0.72, yRatio: 0.27, offsetX: -0.8, offsetY: 0.6 },
        { xRatio: 0.24, yRatio: 0.39, offsetX: 0.6, offsetY: -0.7 },
        { xRatio: 0.35, yRatio: 0.39, offsetX: -0.4, offsetY: 0.4 },
        { xRatio: 0.68, yRatio: 0.39, offsetX: 0.8, offsetY: -0.3 },
        { xRatio: 0.79, yRatio: 0.4, offsetX: -0.7, offsetY: 0.5 },
        { xRatio: 0.25, yRatio: 0.61, offsetX: -0.4, offsetY: 0.5 },
        { xRatio: 0.35, yRatio: 0.62, offsetX: 0.7, offsetY: -0.6 },
        { xRatio: 0.68, yRatio: 0.61, offsetX: -0.5, offsetY: 0.3 },
        { xRatio: 0.78, yRatio: 0.62, offsetX: 0.5, offsetY: -0.4 },
        { xRatio: 0.39, yRatio: 0.78, offsetX: -0.7, offsetY: -0.2 },
        { xRatio: 0.52, yRatio: 0.81, offsetX: 0.6, offsetY: 0.4 },
        { xRatio: 0.64, yRatio: 0.77, offsetX: -0.5, offsetY: -0.6 },
      ]),
      {
        ballCode: BallCode.heart,
        x: TABLE.x + TABLE.width * 0.75,
        y: TABLE.y + TABLE.height * 0.34,
      },
      {
        ballCode: BallCode.spade,
        x: TABLE.x + TABLE.width * 0.74,
        y: TABLE.y + TABLE.height * 0.66,
      },
    ],
  },
  {
    id: 7,
    per: 13,
    reward: 300,
    hazards: [
      {
        type: "poison",
        x: stageEightPoison.x,
        y: stageEightPoison.y,
        width: stageEightPoison.width,
        height: stageEightPoison.height,
        radius: 18,
        damage: 5,
      },
    ],
    obstacles: [stageEightObstacle],
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.joker,
        x: TABLE.x + TABLE.width * 0.82,
        y: TABLE.y + TABLE.height * 0.5,
      },
      {
        ballCode: BallCode.club,
        x: TABLE.x + TABLE.width * 0.66,
        y: TABLE.y + TABLE.height * 0.32,
      },
      {
        ballCode: BallCode.spade,
        x: TABLE.x + TABLE.width * 0.66,
        y: TABLE.y + TABLE.height * 0.68,
      },
      {
        ballCode: BallCode.heart,
        x: TABLE.x + TABLE.width * 0.76,
        y: TABLE.y + TABLE.height * 0.28,
      },
      {
        ballCode: BallCode.diamond,
        x: TABLE.x + TABLE.width * 0.76,
        y: TABLE.y + TABLE.height * 0.72,
      },
      ...scatteredPlacement(BallCode.chip, [
        { xRatio: 0.35, yRatio: 0.28, offsetX: -0.4, offsetY: 0.2 },
        { xRatio: 0.42, yRatio: 0.38, offsetX: 0.5, offsetY: -0.3 },
        { xRatio: 0.36, yRatio: 0.58, offsetX: 0.4, offsetY: 0.6 },
        { xRatio: 0.45, yRatio: 0.72, offsetX: -0.5, offsetY: -0.4 },
        { xRatio: 0.58, yRatio: 0.25, offsetX: 0.3, offsetY: 0.5 },
        { xRatio: 0.6, yRatio: 0.75, offsetX: -0.6, offsetY: -0.2 },
      ]),
    ],
  },
  {
    id: 8,
    per: 10,
    reward: 180,
    hazards: [
      {
        type: "fog",
        x: spookyFog.x,
        y: spookyFog.y,
        width: spookyFog.width,
        height: spookyFog.height,
        radius: 24,
        heal: 6,
      },
    ],
    obstacles: spookyGateObstacles,
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.ghost,
        x: TABLE.x + TABLE.width * 0.48,
        y: TABLE.y + TABLE.height * 0.25,
      },
      {
        ballCode: BallCode.ghost,
        x: TABLE.x + TABLE.width * 0.48,
        y: TABLE.y + TABLE.height * 0.75,
      },
      {
        ballCode: BallCode.necromancer,
        x: TABLE.x + TABLE.width * 0.79,
        y: TABLE.y + TABLE.height * 0.5,
      },
      ...scatteredPlacement(BallCode.zombie, [
        { xRatio: 0.55, yRatio: 0.38, offsetX: -0.2, offsetY: 0.4 },
        { xRatio: 0.62, yRatio: 0.48, offsetX: 0.4, offsetY: -0.1 },
        { xRatio: 0.56, yRatio: 0.62, offsetX: 0.3, offsetY: -0.2 },
        { xRatio: 0.72, yRatio: 0.42, offsetX: -0.6, offsetY: -0.2 },
        { xRatio: 0.74, yRatio: 0.59, offsetX: 0.4, offsetY: 0.5 },
        { xRatio: 0.49, yRatio: 0.32, offsetX: -0.2, offsetY: 0.2 },
        { xRatio: 0.5, yRatio: 0.69, offsetX: 0.3, offsetY: -0.3 },
        { xRatio: 0.84, yRatio: 0.5, offsetX: -0.2, offsetY: 0 },
      ]),
    ],
  },
  {
    id: 9,
    per: 10,
    reward: 220,
    hazards: [
      {
        type: "mirror",
        x: stageTenMirror.x,
        y: stageTenMirror.y,
        width: stageTenMirror.width,
        height: stageTenMirror.height,
        radius: 22,
      },
      {
        type: "poison",
        x: stageTenPoison.x,
        y: stageTenPoison.y,
        width: stageTenPoison.width,
        height: stageTenPoison.height,
        radius: 18,
        damage: 5,
      },
      {
        type: "fog",
        x: stageTenFog.x,
        y: stageTenFog.y,
        width: stageTenFog.width,
        height: stageTenFog.height,
        radius: 24,
        heal: 6,
      },
    ],
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.doppelganger,
        x: TABLE.x + TABLE.width * 0.73,
        y: TABLE.y + TABLE.height * 0.36,
      },
      {
        ballCode: BallCode.doppelganger,
        x: TABLE.x + TABLE.width * 0.82,
        y: TABLE.y + TABLE.height * 0.64,
      },
      {
        ballCode: BallCode.wraith,
        x: TABLE.x + TABLE.width * 0.51,
        y: TABLE.y + TABLE.height * 0.24,
      },
      {
        ballCode: BallCode.wraith,
        x: TABLE.x + TABLE.width * 0.5,
        y: TABLE.y + TABLE.height * 0.76,
      },
      ...scatteredPlacement(BallCode.zombie, [
        { xRatio: 0.18, yRatio: 0.28, offsetX: 0.3, offsetY: 0.2 },
        { xRatio: 0.19, yRatio: 0.72, offsetX: -0.2, offsetY: -0.3 },
        { xRatio: 0.42, yRatio: 0.34, offsetX: -0.3, offsetY: 0.2 },
        { xRatio: 0.45, yRatio: 0.52, offsetX: 0.4, offsetY: -0.2 },
        { xRatio: 0.39, yRatio: 0.69, offsetX: 0.2, offsetY: 0.3 },
        { xRatio: 0.66, yRatio: 0.25, offsetX: -0.4, offsetY: 0.2 },
        { xRatio: 0.68, yRatio: 0.52, offsetX: 0.4, offsetY: -0.1 },
        { xRatio: 0.64, yRatio: 0.76, offsetX: -0.2, offsetY: -0.4 },
        { xRatio: 0.86, yRatio: 0.28, offsetX: 0.2, offsetY: 0.3 },
        { xRatio: 0.86, yRatio: 0.72, offsetX: -0.3, offsetY: -0.2 },
      ]),
    ],
  },
  {
    id: 10,
    per: 10,
    reward: 360,
    hazards: [
      {
        type: "magicCircle" as const,
        x: hollowSealCircle.x,
        y: hollowSealCircle.y,
        radius: hollowSealCircle.radius,
        color: 0xb79cff,
        alpha: 0.58,
        points: hollowSealPositions,
      },
      {
        type: "poison",
        x: stageElevenPoison.x,
        y: stageElevenPoison.y,
        width: stageElevenPoison.width,
        height: stageElevenPoison.height,
        radius: 18,
        damage: 5,
      },
    ],
    ballPlacements: [
      cuePlacement,
      {
        ballCode: BallCode.hollowKing,
        x: TABLE.x + TABLE.width * 0.82 + 24,
        y: TABLE.y + TABLE.height * 0.5,
      },
      ...hollowSealBallPositions.map((position) => ({
        ballCode: BallCode.soulSeal,
        x: position.x,
        y: position.y,
      })),
      {
        ballCode: BallCode.wraith,
        x: TABLE.x + TABLE.width - TABLE.rail - BALL_RADIUS - 36,
        y: TABLE.y + TABLE.rail + BALL_RADIUS + 40,
      },
      {
        ballCode: BallCode.wraith,
        x: TABLE.x + TABLE.width - TABLE.rail - BALL_RADIUS - 36,
        y: TABLE.y + TABLE.height - TABLE.rail - BALL_RADIUS - 40,
      },
      ...scatteredPlacement(BallCode.zombie, [
        { xRatio: 0.25, yRatio: 0.23, offsetX: -0.2, offsetY: 0.1 },
        { xRatio: 0.32, yRatio: 0.27, offsetX: 0.4, offsetY: -0.3 },
        { xRatio: 0.39, yRatio: 0.22, offsetX: -0.4, offsetY: 0.4 },
        { xRatio: 0.46, yRatio: 0.29, offsetX: 0.2, offsetY: -0.2 },
        { xRatio: 0.52, yRatio: 0.24, offsetX: -0.3, offsetY: 0.2 },
        { xRatio: 0.25, yRatio: 0.77, offsetX: 0.3, offsetY: -0.1 },
        { xRatio: 0.33, yRatio: 0.72, offsetX: -0.2, offsetY: 0.3 },
        { xRatio: 0.4, yRatio: 0.78, offsetX: 0.4, offsetY: -0.4 },
        { xRatio: 0.47, yRatio: 0.71, offsetX: -0.3, offsetY: 0.2 },
        { xRatio: 0.53, yRatio: 0.76, offsetX: 0.2, offsetY: -0.2 },
      ]),
    ],
  },
] satisfies readonly [
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
  Stage,
];
