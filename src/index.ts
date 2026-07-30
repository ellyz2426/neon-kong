import {
  World,
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
} from '@iwsdk/core';
import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  SphereGeometry,
  CylinderGeometry,
  Group,
  Color,
  FogExp2,
  PointLight,
  AmbientLight,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Vector3,
} from '@iwsdk/core';

// ─── CONSTANTS ───
const COLS = 8;
const ROWS = 7;
const CELL = 1.2;
const PLATFORM_H = 0.15;
const LADDER_W = 0.3;
const PLAYER_R = 0.25;
const BARREL_R = 0.2;
const HAMMER_SIZE = 0.3;
const GRAVITY = 6;
const MOVE_SPEED = 3.5;
const CLIMB_SPEED = 2.5;
const JUMP_VEL = 5.5;
const BARREL_SPEED = 2.8;
const BARREL_ROLL_SPEED = 8;
const BARREL_SPAWN_INTERVAL_BASE = 2.0;
const BARREL_SPAWN_INTERVAL_MIN = 0.6;

// Color schemes
const SCHEMES: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
  cyan: { primary: '#00ffff', secondary: '#0088aa', accent: '#ff00ff', bg: '#001122' },
  green: { primary: '#00ff88', secondary: '#008844', accent: '#ffff00', bg: '#001108' },
  magenta: { primary: '#ff00ff', secondary: '#880088', accent: '#00ffff', bg: '#110022' },
  gold: { primary: '#ffaa00', secondary: '#886600', accent: '#00ffff', bg: '#111100' },
};

// ─── GAME STATE ───
interface Platform {
  row: number;
  colStart: number;
  colEnd: number;
  mesh: Mesh;
  y: number;
}

interface Ladder {
  col: number;
  rowBottom: number;
  rowTop: number;
  mesh: Group;
  x: number;
  yBottom: number;
  yTop: number;
}

interface Barrel {
  mesh: Group;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onPlatform: boolean;
  platformRow: number;
  rolling: boolean;
  angle: number;
  usedLadders: Set<number>;
}

interface Hammer {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
}

interface FireBarrel extends Barrel {
  isFire: boolean;
  trailTimer: number;
}

interface FireTrail {
  mesh: Mesh;
  x: number;
  y: number;
  life: number;
  row: number;
}

interface SpringEnemy {
  mesh: Group;
  x: number;
  y: number;
  vy: number;
  platformRow: number;
  bouncing: boolean;
  direction: number;
  bounceTimer: number;
}

interface Shield {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
}

interface BonusItem {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  points: number;
  life: number;
  bobTimer: number;
  collected: boolean;
}

interface LadderPatrol {
  mesh: Group;
  ladderIdx: number;
  y: number;
  direction: number;
  speed: number;
}

interface ScorePopup {
  mesh: Mesh;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface ConveyorBelt {
  row: number;
  direction: number; // -1 left, 1 right
  speed: number;
  arrowMeshes: Mesh[];
  arrowTimer: number;
}

interface SpeedBoost {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
  bobTimer: number;
}

interface Afterimage {
  mesh: Mesh;
  life: number;
  maxLife: number;
}

interface Rivet {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  collected: boolean;
  bobTimer: number;
}

interface CrumblingPlatform {
  row: number;
  timer: number;
  maxTimer: number;
  crumbling: boolean;
  originalOpacity: number;
}

interface WarpPortal {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  pairIdx: number; // index of paired portal
  cooldown: number;
  spinTimer: number;
}

interface ExtraLife {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
  bobTimer: number;
  pulseTimer: number;
}

interface MagnetPickup {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
  bobTimer: number;
}

interface ScoreMultiplier {
  mesh: Group;
  x: number;
  y: number;
  row: number;
  active: boolean;
  bobTimer: number;
}

interface Shockwave {
  mesh: Mesh;
  radius: number;
  maxRadius: number;
  life: number;
  y: number;
}

interface GameState {
  mode: string;
  difficulty: string;
  scheme: string;
  status: 'menu' | 'playing' | 'paused' | 'gameover' | 'results' | 'settings' | 'achievements' | 'stats' | 'tutorial';
  score: number;
  highScore: number;
  lives: number;
  level: number;
  combo: number;
  comboTimer: number;
  playerX: number;
  playerY: number;
  playerVY: number;
  playerOnGround: boolean;
  playerClimbing: boolean;
  playerPlatformRow: number;
  playerFacing: number;
  hasHammer: boolean;
  hammerTimer: number;
  hammerSwingAngle: number;
  barrels: Barrel[];
  barrelSpawnTimer: number;
  platforms: Platform[];
  ladders: Ladder[];
  hammers: Hammer[];
  rescueX: number;
  rescueY: number;
  kongX: number;
  kongY: number;
  timeRemaining: number;
  movesRemaining: number;
  barrelsSmashed: number;
  barrelsJumped: number;
  levelsCleared: number;
  jumpActive: boolean;
  // Fire barrels
  fireBarrels: FireBarrel[];
  fireTrails: FireTrail[];
  // Spring enemies
  springs: SpringEnemy[];
  // Shield power-up
  hasShield: boolean;
  shieldTimer: number;
  shieldHitsLeft: number;
  // Screen shake
  shakeTimer: number;
  shakeIntensity: number;
  // Speed boost
  hasSpeedBoost: boolean;
  speedBoostTimer: number;
  // Conveyor belts
  conveyorBelts: ConveyorBelt[];
  // Crumbling platforms
  crumblingPlatforms: CrumblingPlatform[];
  // Career
  careerGames: number;
  careerSmashed: number;
  careerJumped: number;
  careerLevels: number;
  careerDeaths: number;
  careerHammers: number;
  careerBestScore: number;
  careerBestLevel: number;
  careerBestCombo: number;
  // Boss fight
  isBossLevel: boolean;
  bossShockwaveTimer: number;
  // Magnet power-up
  hasMagnet: boolean;
  magnetTimer: number;
  // Score multiplier
  hasMultiplier: boolean;
  multiplierTimer: number;
  // Achievements
  achievements: Set<string>;
}

const ALL_ACHIEVEMENTS = [
  { id: 'first_barrel', name: 'Barrel Buster', desc: 'Smash your first barrel' },
  { id: 'jump_5', name: 'Hurdler', desc: 'Jump over 5 barrels in one game' },
  { id: 'jump_20', name: 'Acrobat', desc: 'Jump over 20 barrels in one game' },
  { id: 'smash_10', name: 'Hammer Time', desc: 'Smash 10 barrels in one game' },
  { id: 'smash_50', name: 'Wrecking Ball', desc: 'Smash 50 barrels total' },
  { id: 'level_3', name: 'Climber', desc: 'Reach level 3' },
  { id: 'level_5', name: 'Mountaineer', desc: 'Reach level 5' },
  { id: 'level_10', name: 'Summit Seeker', desc: 'Reach level 10' },
  { id: 'score_5k', name: 'High Scorer', desc: 'Score 5,000 points' },
  { id: 'score_10k', name: 'Neon Master', desc: 'Score 10,000 points' },
  { id: 'score_25k', name: 'Kong Slayer', desc: 'Score 25,000 points' },
  { id: 'combo_3', name: 'Combo Starter', desc: 'Get a 3x combo' },
  { id: 'combo_5', name: 'Combo King', desc: 'Get a 5x combo' },
  { id: 'combo_8', name: 'Combo Legend', desc: 'Get an 8x combo' },
  { id: 'no_death', name: 'Untouchable', desc: 'Clear a level without dying' },
  { id: 'speed_clear', name: 'Speed Runner', desc: 'Clear a level in under 30s' },
  { id: 'hammer_collect', name: 'Armed', desc: 'Collect your first hammer' },
  { id: 'games_10', name: 'Regular', desc: 'Play 10 games' },
  { id: 'games_50', name: 'Veteran', desc: 'Play 50 games' },
  { id: 'all_modes', name: 'Versatile', desc: 'Play all 4 game modes' },
  { id: 'hard_clear', name: 'Hard Mode Hero', desc: 'Clear level 1 on Hard' },
  { id: 'insane_clear', name: 'Insane Champion', desc: 'Clear level 1 on Insane' },
  { id: 'career_smash_100', name: 'Barrel Destroyer', desc: 'Smash 100 barrels total' },
  { id: 'career_jump_200', name: 'Jump Master', desc: 'Jump over 200 barrels total' },
  { id: 'perfect_level', name: 'Perfectionist', desc: 'Clear a level smashing every barrel' },
  { id: 'fire_dodge_5', name: 'Firewalker', desc: 'Dodge 5 fire barrels in one game' },
  { id: 'spring_jump', name: 'Spring Stomper', desc: 'Jump over a spring enemy' },
  { id: 'shield_save', name: 'Shield Bearer', desc: 'Block a hit with a shield' },
  { id: 'survive_60s', name: 'Survivor', desc: 'Survive 60 seconds on a single level' },
  { id: 'no_hammer', name: 'Pacifist', desc: 'Clear a level without using a hammer' },
  { id: 'bonus_5', name: 'Gem Collector', desc: 'Collect 5 bonus gems in one game' },
  { id: 'bonus_15', name: 'Treasure Hunter', desc: 'Collect 15 bonus gems total' },
  { id: 'patrol_dodge', name: 'Ladder Ninja', desc: 'Pass 3 ladder patrols without dying' },
  { id: 'level_15', name: 'Apex Climber', desc: 'Reach level 15' },
  { id: 'score_50k', name: 'Neon Legend', desc: 'Score 50,000 points' },
  { id: 'speed_collect', name: 'Turbo Charged', desc: 'Collect a speed boost' },
  { id: 'speed_clear', name: 'Lightning Climber', desc: 'Clear a level with speed boost active' },
  { id: 'conveyor_survive', name: 'Belt Runner', desc: 'Survive 3 conveyor belt levels' },
  { id: 'combo_no_break', name: 'Relentless', desc: 'Keep a combo going for 10 seconds' },
  { id: 'score_100k', name: 'Neon God', desc: 'Score 100,000 points' },
  { id: 'rivet_collect', name: 'Riveter', desc: 'Collect your first rivet' },
  { id: 'rivet_all', name: 'Master Builder', desc: 'Collect all rivets on a level' },
  { id: 'crumble_survive', name: 'Floor is Lava', desc: 'Survive 3 crumbling platforms' },
  { id: 'warp_use', name: 'Portal Jumper', desc: 'Use a warp portal' },
  { id: 'extra_life', name: 'Second Wind', desc: 'Collect an extra life' },
  { id: 'boss_clear', name: 'Boss Slayer', desc: 'Clear a boss level (every 5th)' },
  { id: 'magnet_collect', name: 'Magnet Master', desc: 'Collect a magnet power-up' },
  { id: 'multiplier_collect', name: 'Double Trouble', desc: 'Collect a score multiplier' },
  { id: 'score_200k', name: 'Neon Titan', desc: 'Score 200,000 points' },
  { id: 'level_20', name: 'Kong Conqueror', desc: 'Reach level 20' },
];

let state: GameState;
let levelStartTime = 0;
let levelDeathCount = 0;
let levelBarrelCount = 0;
let levelHammerUsed = false;
let fireBarrelsDodged = 0;
let springJumped = false;
let modesPlayed = new Set<string>();
let kongMesh: Group;
let playerMesh: Group;
let hammerMesh: Group | null = null;
let rescueMesh: Group;
let barrelGroup: Group;
let environmentGroup: Group;
let shieldMesh: Group | null = null;
let shields: Shield[] = [];
let bonusItems: BonusItem[] = [];
let ladderPatrols: LadderPatrol[] = [];
let scorePopups: ScorePopup[] = [];
let bonusCollectedGame = 0;
let bonusCollectedTotal = 0;
let patrolsPassed = 0;
let conveyorLevelsSurvived = 0;
let comboStartTime = 0;
let speedBoosts: SpeedBoost[] = [];
let afterimages: Afterimage[] = [];
let rivets: Rivet[] = [];
let warpPortals: WarpPortal[] = [];
let extraLives: ExtraLife[] = [];
let magnetPickups: MagnetPickup[] = [];
let scoreMultipliers: ScoreMultiplier[] = [];
let shockwaves: Shockwave[] = [];
let bossLevelsCleared = 0;
let rivetsCollectedLevel = 0;
let rivetsOnLevel = 0;
let crumblePlatformsSurvived = 0;
let cameraBasePos = new Vector3(0, 0, 8);

// Audio
let audioCtx: AudioContext;

function initAudio() {
  audioCtx = new AudioContext();
}

function playSound(type: string) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case 'jump':
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'walk':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
      break;
    case 'climb':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(350, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
      break;
    case 'smash':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      break;
    case 'barrel_land':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
      break;
    case 'death':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);
      osc.start(now); osc.stop(now + 0.6);
      break;
    case 'level_clear':
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(500, now + 0.1);
      osc.frequency.setValueAtTime(600, now + 0.2);
      osc.frequency.setValueAtTime(800, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    case 'gameover':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      osc.frequency.linearRampToValueAtTime(50, now + 0.8);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.0);
      osc.start(now); osc.stop(now + 1.0);
      break;
    case 'hammer_get':
      osc.type = 'square';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.setValueAtTime(700, now + 0.08);
      osc.frequency.setValueAtTime(900, now + 0.16);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'achievement':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.1);
      osc.frequency.setValueAtTime(1000, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
      break;
    case 'combo':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
      break;
    case 'fire_sizzle':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'shield_get':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(600, now + 0.08);
      osc.frequency.setValueAtTime(800, now + 0.16);
      osc.frequency.setValueAtTime(600, now + 0.24);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
      break;
    case 'shield_block':
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.08);
      osc.frequency.linearRampToValueAtTime(200, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      break;
    case 'spring_bounce':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(500, now + 0.1);
      osc.frequency.linearRampToValueAtTime(300, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      break;
    case 'bonus_collect':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(900, now + 0.06);
      osc.frequency.setValueAtTime(1100, now + 0.12);
      osc.frequency.setValueAtTime(1400, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'patrol_warn':
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(220, now + 0.1);
      osc.frequency.setValueAtTime(180, now + 0.2);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);
      break;
    case 'speed_boost':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.08);
      osc.frequency.linearRampToValueAtTime(900, now + 0.16);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.24);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
      break;
    case 'conveyor_hum':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.15);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      break;
    case 'rivet_collect':
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.06);
      osc.frequency.setValueAtTime(1000, now + 0.12);
      osc.frequency.setValueAtTime(1200, now + 0.18);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'crumble':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.3);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
      break;
    case 'warp':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
      osc.frequency.linearRampToValueAtTime(600, now + 0.3);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
      break;
    case 'extra_life':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.setValueAtTime(700, now + 0.1);
      osc.frequency.setValueAtTime(900, now + 0.2);
      osc.frequency.setValueAtTime(1100, now + 0.3);
      osc.frequency.setValueAtTime(1400, now + 0.4);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.55);
      osc.start(now); osc.stop(now + 0.55);
      break;
    case 'shockwave':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.4);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
      break;
    case 'magnet_get':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(900, now + 0.06);
      osc.frequency.setValueAtTime(600, now + 0.12);
      osc.frequency.setValueAtTime(1200, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
      break;
    case 'multiplier_get':
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(800, now + 0.08);
      osc.frequency.setValueAtTime(400, now + 0.16);
      osc.frequency.setValueAtTime(1000, now + 0.24);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
      break;
    case 'boss_intro':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.2);
      osc.frequency.linearRampToValueAtTime(100, now + 0.4);
      osc.frequency.linearRampToValueAtTime(300, now + 0.6);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.8);
      osc.start(now); osc.stop(now + 0.8);
      break;
  }
}

// Ambient music
let musicOsc1: OscillatorNode | null = null;
let musicOsc2: OscillatorNode | null = null;
let musicGain: GainNode | null = null;

function startMusic() {
  if (!audioCtx || musicOsc1) return;
  musicGain = audioCtx.createGain();
  musicGain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  musicGain.connect(audioCtx.destination);

  // Bass note — pitch rises with level
  const baseFreq = 55 + (state.level - 1) * 5;
  musicOsc1 = audioCtx.createOscillator();
  musicOsc1.type = 'sine';
  musicOsc1.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
  musicOsc1.connect(musicGain);
  musicOsc1.start();

  // Harmonic layer
  musicOsc2 = audioCtx.createOscillator();
  musicOsc2.type = 'triangle';
  musicOsc2.frequency.setValueAtTime(baseFreq * 2, audioCtx.currentTime);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(0.02 + state.level * 0.002, audioCtx.currentTime);
  musicOsc2.connect(g2);
  g2.connect(audioCtx.destination);
  musicOsc2.start();
}

function updateMusicTension() {
  // Evolve music with level — called on level change
  if (!audioCtx || !musicOsc1 || !musicOsc2) return;
  const now = audioCtx.currentTime;
  const baseFreq = 55 + (state.level - 1) * 5;
  musicOsc1.frequency.linearRampToValueAtTime(baseFreq, now + 0.5);
  musicOsc2.frequency.linearRampToValueAtTime(baseFreq * 2, now + 0.5);
  if (musicGain) {
    // Slight volume increase with level tension
    musicGain.gain.linearRampToValueAtTime(Math.min(0.06, 0.03 + state.level * 0.003), now + 0.5);
  }
}

function stopMusic() {
  if (musicOsc1) { musicOsc1.stop(); musicOsc1 = null; }
  if (musicOsc2) { musicOsc2.stop(); musicOsc2 = null; }
  musicGain = null;
}

// ─── PERSISTENCE ───
function loadCareer(): Partial<GameState> {
  try {
    const d = JSON.parse(localStorage.getItem('neon-kong-career') || '{}');
    bonusCollectedTotal = d.bonusCollectedTotal || 0;
    return {
      careerGames: d.careerGames || 0,
      careerSmashed: d.careerSmashed || 0,
      careerJumped: d.careerJumped || 0,
      careerLevels: d.careerLevels || 0,
      careerDeaths: d.careerDeaths || 0,
      careerHammers: d.careerHammers || 0,
      careerBestScore: d.careerBestScore || 0,
      careerBestLevel: d.careerBestLevel || 0,
      careerBestCombo: d.careerBestCombo || 0,
      highScore: d.highScore || 0,
      achievements: new Set(d.achievements || []),
    };
  } catch { return { achievements: new Set() }; }
}

function saveCareer() {
  try {
    localStorage.setItem('neon-kong-career', JSON.stringify({
      careerGames: state.careerGames,
      careerSmashed: state.careerSmashed,
      careerJumped: state.careerJumped,
      careerLevels: state.careerLevels,
      careerDeaths: state.careerDeaths,
      careerHammers: state.careerHammers,
      careerBestScore: state.careerBestScore,
      careerBestLevel: state.careerBestLevel,
      careerBestCombo: state.careerBestCombo,
      highScore: state.highScore,
      achievements: Array.from(state.achievements),
      bonusCollectedTotal,
    }));
  } catch {}
}

function checkAchievement(id: string) {
  if (!state.achievements.has(id)) {
    state.achievements.add(id);
    playSound('achievement');
    saveCareer();
  }
}

// ─── LEVEL GENERATION ───
function generateLevel(level: number): { platforms: Platform[]; ladders: Ladder[]; hammers: Hammer[] } {
  const platforms: Platform[] = [];
  const ladders: Ladder[] = [];
  const hammers: Hammer[] = [];
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  const sch = SCHEMES[state.scheme];
  const pColor = new Color(sch.primary);
  const sColor = new Color(sch.secondary);

  // Create platforms - alternating slant pattern like DK
  for (let r = 0; r < ROWS; r++) {
    const y = r * (CELL * 1.3) - (ROWS * CELL * 1.3) / 2 + 1;
    let colStart = 0;
    let colEnd = COLS - 1;

    // Slight slant offset for middle platforms
    if (r > 0 && r < ROWS - 1) {
      if (r % 2 === 1) {
        colStart = 0;
        colEnd = COLS - 1;
      }
    }

    const width = (colEnd - colStart + 1) * CELL;
    const xCenter = ((colStart + colEnd) / 2 - COLS / 2 + 0.5) * CELL;

    const geo = new BoxGeometry(width, PLATFORM_H, CELL * 0.6);
    const mat = new MeshStandardMaterial({
      color: pColor,
      emissive: pColor,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(xCenter, y, 0);

    // Add wireframe
    const edges = new EdgesGeometry(geo);
    const line = new LineSegments(edges, new LineBasicMaterial({ color: pColor }));
    mesh.add(line);

    scene.add(mesh);
    platforms.push({ row: r, colStart, colEnd, mesh, y });
  }

  // Create ladders between platforms
  for (let r = 0; r < ROWS - 1; r++) {
    const numLadders = 1 + Math.floor(Math.random() * 2);
    for (let l = 0; l < numLadders; l++) {
      const col = 1 + Math.floor(Math.random() * (COLS - 2));
      const x = (col - COLS / 2 + 0.5) * CELL;
      const yBottom = platforms[r].y + PLATFORM_H / 2;
      const yTop = platforms[r + 1].y - PLATFORM_H / 2;
      const height = yTop - yBottom;

      const group = new Group();
      // Ladder rails
      const railGeo = new CylinderGeometry(0.02, 0.02, height);
      const railMat = new MeshStandardMaterial({
        color: sColor,
        emissive: sColor,
        emissiveIntensity: 0.5,
      });
      const leftRail = new Mesh(railGeo, railMat);
      leftRail.position.set(-LADDER_W / 2, height / 2, 0);
      group.add(leftRail);
      const rightRail = new Mesh(railGeo, railMat);
      rightRail.position.set(LADDER_W / 2, height / 2, 0);
      group.add(rightRail);

      // Rungs
      const rungCount = Math.floor(height / 0.35);
      const rungGeo = new CylinderGeometry(0.015, 0.015, LADDER_W);
      for (let i = 0; i < rungCount; i++) {
        const rung = new Mesh(rungGeo, railMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, (i + 0.5) * (height / rungCount), 0);
        group.add(rung);
      }

      group.position.set(x, yBottom, 0.1);
      scene.add(group);
      ladders.push({ col, rowBottom: r, rowTop: r + 1, mesh: group, x, yBottom, yTop });
    }
  }

  // Hammers (1-2 per level)
  const hammerCount = Math.min(2, 1 + Math.floor(level / 3));
  for (let h = 0; h < hammerCount; h++) {
    const row = 1 + Math.floor(Math.random() * (ROWS - 3));
    const col = 1 + Math.floor(Math.random() * (COLS - 2));
    const x = (col - COLS / 2 + 0.5) * CELL;
    const y = platforms[row].y + PLATFORM_H / 2 + HAMMER_SIZE / 2 + 0.1;

    const group = new Group();
    const handleGeo = new CylinderGeometry(0.03, 0.03, HAMMER_SIZE * 0.7);
    const handleMat = new MeshStandardMaterial({
      color: new Color('#ffaa00'),
      emissive: new Color('#ffaa00'),
      emissiveIntensity: 0.6,
    });
    const handle = new Mesh(handleGeo, handleMat);
    handle.rotation.z = Math.PI / 4;
    group.add(handle);

    const headGeo = new BoxGeometry(HAMMER_SIZE * 0.4, HAMMER_SIZE * 0.25, HAMMER_SIZE * 0.25);
    const headMat = new MeshStandardMaterial({
      color: new Color('#ff4400'),
      emissive: new Color('#ff4400'),
      emissiveIntensity: 0.5,
    });
    const head = new Mesh(headGeo, headMat);
    head.position.set(HAMMER_SIZE * 0.25, HAMMER_SIZE * 0.25, 0);
    group.add(head);

    group.position.set(x, y, 0.1);
    scene.add(group);
    hammers.push({ mesh: group, x, y, row, active: true });
  }

  return { platforms, ladders, hammers };
}

// ─── CREATE VISUALS ───
function createKong(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const sch = SCHEMES[state.scheme];
  const accentColor = new Color(sch.accent);

  // Body
  const bodyGeo = new BoxGeometry(0.8, 0.9, 0.5);
  const bodyMat = new MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.4,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Head
  const headGeo = new SphereGeometry(0.35, 8, 6);
  const head = new Mesh(headGeo, bodyMat);
  head.position.set(0, 0.6, 0);
  group.add(head);

  // Eyes
  const eyeGeo = new SphereGeometry(0.08, 6, 4);
  const eyeMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
  const leftEye = new Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.12, 0.65, 0.25);
  group.add(leftEye);
  const rightEye = new Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.12, 0.65, 0.25);
  group.add(rightEye);

  // Arms
  const armGeo = new CylinderGeometry(0.1, 0.08, 0.6);
  const leftArm = new Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.55, 0.1, 0);
  leftArm.rotation.z = Math.PI / 6;
  group.add(leftArm);
  const rightArm = new Mesh(armGeo, bodyMat);
  rightArm.position.set(0.55, 0.1, 0);
  rightArm.rotation.z = -Math.PI / 6;
  group.add(rightArm);

  // Wireframe
  const wfGeo = new EdgesGeometry(bodyGeo);
  const wfLine = new LineSegments(wfGeo, new LineBasicMaterial({ color: accentColor }));
  group.add(wfLine);

  scene.add(group);
  return group;
}

function createPlayer(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const sch = SCHEMES[state.scheme];
  const pColor = new Color(sch.primary);

  // Body
  const bodyGeo = new CylinderGeometry(PLAYER_R * 0.6, PLAYER_R * 0.5, PLAYER_R * 2, 8);
  const bodyMat = new MeshStandardMaterial({
    color: pColor,
    emissive: pColor,
    emissiveIntensity: 0.5,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Head
  const headGeo = new SphereGeometry(PLAYER_R * 0.45, 8, 6);
  const head = new Mesh(headGeo, bodyMat);
  head.position.set(0, PLAYER_R * 1.1, 0);
  group.add(head);

  // Wireframe
  const edges = new EdgesGeometry(bodyGeo);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: pColor }));
  group.add(line);

  scene.add(group);
  return group;
}

function createRescue(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const mat = new MeshStandardMaterial({
    color: new Color('#ff88ff'),
    emissive: new Color('#ff88ff'),
    emissiveIntensity: 0.6,
  });

  const bodyGeo = new CylinderGeometry(0.12, 0.1, 0.35, 6);
  const body = new Mesh(bodyGeo, mat);
  group.add(body);

  const headGeo = new SphereGeometry(0.12, 6, 4);
  const head = new Mesh(headGeo, mat);
  head.position.set(0, 0.3, 0);
  group.add(head);

  scene.add(group);
  return group;
}

function createBarrelMesh(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const sch = SCHEMES[state.scheme];
  const accentColor = new Color(sch.accent);

  const geo = new CylinderGeometry(BARREL_R, BARREL_R, BARREL_R * 1.2, 8);
  const mat = new MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.5,
  });
  const barrel = new Mesh(geo, mat);
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);

  const edges = new EdgesGeometry(geo);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: accentColor }));
  line.rotation.x = Math.PI / 2;
  group.add(line);

  scene.add(group);
  return group;
}

function createFireBarrelMesh(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const fireColor = new Color('#ff4400');
  const fireGlow = new Color('#ff8800');

  const geo = new CylinderGeometry(BARREL_R, BARREL_R, BARREL_R * 1.2, 8);
  const mat = new MeshStandardMaterial({
    color: fireColor,
    emissive: fireGlow,
    emissiveIntensity: 0.8,
  });
  const barrel = new Mesh(geo, mat);
  barrel.rotation.x = Math.PI / 2;
  group.add(barrel);

  const edges = new EdgesGeometry(geo);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: fireGlow }));
  line.rotation.x = Math.PI / 2;
  group.add(line);

  // Fire glow sphere
  const glowGeo = new SphereGeometry(BARREL_R * 1.3, 6, 4);
  const glowMat = new MeshBasicMaterial({
    color: fireGlow,
    transparent: true,
    opacity: 0.2,
  });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  scene.add(group);
  return group;
}

// ─── PARTICLE SYSTEM ───
interface Particle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

let particles: Particle[] = [];

function spawnParticles(scene: import('@iwsdk/core').Scene, x: number, y: number, color: string, count: number) {
  const c = new Color(color);
  for (let i = 0; i < count; i++) {
    const geo = new BoxGeometry(0.06, 0.06, 0.06);
    const mat = new MeshBasicMaterial({ color: c, transparent: true });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, 0.2);
    scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1,
      vz: (Math.random() - 0.5) * 2,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
    });
  }
}

function updateParticles(scene: import('@iwsdk/core').Scene, delta: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= delta;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as MeshBasicMaterial).dispose();
      particles.splice(i, 1);
      continue;
    }
    p.mesh.position.x += p.vx * delta;
    p.mesh.position.y += p.vy * delta;
    p.mesh.position.z += p.vz * delta;
    p.vy -= 5 * delta;
    const alpha = p.life / p.maxLife;
    (p.mesh.material as MeshBasicMaterial).opacity = alpha;
  }
}

// ─── SCORE POPUPS ───
function spawnScorePopup(scene: import('@iwsdk/core').Scene, x: number, y: number, points: number) {
  // Create a glowing sphere that floats up as visual feedback
  const color = points >= 500 ? '#ffaa00' : points >= 200 ? '#ff00ff' : '#00ffff';
  const geo = new SphereGeometry(0.06 + points * 0.00005, 6, 4);
  const mat = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.9 });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, y + 0.3, 0.3);
  scene.add(mesh);
  scorePopups.push({ mesh, x, y: y + 0.3, vy: 2.5, life: 0.8, maxLife: 0.8 });
}

function updateScorePopups(scene: import('@iwsdk/core').Scene, delta: number) {
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const sp = scorePopups[i];
    sp.life -= delta;
    if (sp.life <= 0) {
      scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      (sp.mesh.material as MeshBasicMaterial).dispose();
      scorePopups.splice(i, 1);
      continue;
    }
    sp.y += sp.vy * delta;
    sp.vy -= 1.5 * delta;
    sp.mesh.position.y = sp.y;
    const alpha = sp.life / sp.maxLife;
    (sp.mesh.material as MeshBasicMaterial).opacity = alpha;
    const scale = 1 + (1 - alpha) * 0.5;
    sp.mesh.scale.set(scale, scale, scale);
  }
}

// ─── BONUS GEM CREATOR ───
function createBonusGem(scene: import('@iwsdk/core').Scene, x: number, y: number, row: number, points: number): BonusItem {
  const group = new Group();
  const sch = SCHEMES[state.scheme];

  // Diamond shape using two cones (pyramids via CylinderGeometry)
  const topGeo = new CylinderGeometry(0, 0.12, 0.15, 4);
  const botGeo = new CylinderGeometry(0.12, 0, 0.1, 4);
  const gemColor = points >= 300 ? '#ffaa00' : points >= 200 ? '#ff00ff' : '#00ff88';
  const mat = new MeshStandardMaterial({
    color: new Color(gemColor),
    emissive: new Color(gemColor),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9,
  });
  const top = new Mesh(topGeo, mat);
  top.position.y = 0.075;
  group.add(top);
  const bot = new Mesh(botGeo, mat);
  bot.position.y = -0.05;
  bot.rotation.x = Math.PI;
  group.add(bot);

  // Glow sphere
  const glowGeo = new SphereGeometry(0.16, 6, 4);
  const glowMat = new MeshBasicMaterial({
    color: new Color(gemColor),
    transparent: true,
    opacity: 0.15,
  });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  group.position.set(x, y, 0.15);
  scene.add(group);

  return { mesh: group, x, y, row, points, life: 6 + Math.random() * 4, bobTimer: Math.random() * Math.PI * 2, collected: false };
}

// ─── LADDER PATROL CREATOR ───
function createLadderPatrolMesh(scene: import('@iwsdk/core').Scene, x: number, y: number): Group {
  const group = new Group();

  // Skull-like enemy
  const headGeo = new SphereGeometry(0.15, 6, 4);
  const headMat = new MeshStandardMaterial({
    color: new Color('#ff2200'),
    emissive: new Color('#ff2200'),
    emissiveIntensity: 0.6,
  });
  const head = new Mesh(headGeo, headMat);
  group.add(head);

  // Eyes
  const eyeGeo = new SphereGeometry(0.04, 4, 3);
  const eyeMat = new MeshBasicMaterial({ color: 0xffffff });
  const leftEye = new Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.06, 0.03, 0.12);
  group.add(leftEye);
  const rightEye = new Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.06, 0.03, 0.12);
  group.add(rightEye);

  // Body
  const bodyGeo = new CylinderGeometry(0.1, 0.08, 0.2, 6);
  const bodyMat = new MeshStandardMaterial({
    color: new Color('#cc1100'),
    emissive: new Color('#cc1100'),
    emissiveIntensity: 0.4,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = -0.2;
  group.add(body);

  // Wireframe
  const edges = new EdgesGeometry(headGeo);
  const line = new LineSegments(edges, new LineBasicMaterial({ color: new Color('#ff4400') }));
  group.add(line);

  group.position.set(x, y, 0.1);
  scene.add(group);
  return group;
}

// ─── ENVIRONMENT ───
function createEnvironment(scene: import('@iwsdk/core').Scene): Group {
  const group = new Group();
  const sch = SCHEMES[state.scheme];
  const pColor = new Color(sch.primary);
  const sColor = new Color(sch.secondary);

  // Grid floor
  const floorGeo = new BoxGeometry(20, 0.02, 20);
  const floorMat = new MeshStandardMaterial({
    color: sColor,
    emissive: sColor,
    emissiveIntensity: 0.1,
    transparent: true,
    opacity: 0.3,
  });
  const floor = new Mesh(floorGeo, floorMat);
  floor.position.y = -6;
  group.add(floor);
  const floorEdges = new EdgesGeometry(floorGeo);
  const floorLine = new LineSegments(floorEdges, new LineBasicMaterial({ color: pColor, transparent: true, opacity: 0.5 }));
  floorLine.position.y = -6;
  group.add(floorLine);

  // Pillars
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = Math.cos(angle) * 8;
    const pz = Math.sin(angle) * 8;
    const pillarGeo = new BoxGeometry(0.15, 12, 0.15);
    const pillarMat = new MeshStandardMaterial({
      color: pColor,
      emissive: pColor,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.4,
    });
    const pillar = new Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 0, pz);
    group.add(pillar);
    const pEdges = new EdgesGeometry(pillarGeo);
    const pLine = new LineSegments(pEdges, new LineBasicMaterial({ color: pColor, transparent: true, opacity: 0.3 }));
    pLine.position.set(px, 0, pz);
    group.add(pLine);
  }

  // Ceiling beams
  for (let i = 0; i < 4; i++) {
    const bx = (i - 1.5) * 4;
    const beamGeo = new BoxGeometry(0.08, 0.08, 16);
    const beamMat = new MeshStandardMaterial({
      color: pColor,
      emissive: pColor,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const beam = new Mesh(beamGeo, beamMat);
    beam.position.set(bx, 6, 0);
    group.add(beam);
  }

  // Ambient orbs
  for (let i = 0; i < 20; i++) {
    const ox = (Math.random() - 0.5) * 16;
    const oy = (Math.random() - 0.5) * 10;
    const oz = -2 - Math.random() * 6;
    const orbGeo = new SphereGeometry(0.04 + Math.random() * 0.04, 6, 4);
    const orbMat = new MeshBasicMaterial({
      color: pColor,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.3,
    });
    const orb = new Mesh(orbGeo, orbMat);
    orb.position.set(ox, oy, oz);
    group.add(orb);
  }

  // Stars
  for (let i = 0; i < 50; i++) {
    const sx = (Math.random() - 0.5) * 20;
    const sy = Math.random() * 6;
    const sz = -5 - Math.random() * 5;
    const starGeo = new SphereGeometry(0.015, 4, 3);
    const starMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2 + Math.random() * 0.4,
    });
    const star = new Mesh(starGeo, starMat);
    star.position.set(sx, sy, sz);
    group.add(star);
  }

  scene.add(group);
  return group;
}

// ─── GAME LOGIC ───
function initState(): GameState {
  const career = loadCareer();
  return {
    mode: 'arcade',
    difficulty: 'normal',
    scheme: 'cyan',
    status: 'menu',
    score: 0,
    highScore: career.highScore || 0,
    lives: 3,
    level: 1,
    combo: 0,
    comboTimer: 0,
    playerX: 0,
    playerY: 0,
    playerVY: 0,
    playerOnGround: false,
    playerClimbing: false,
    playerPlatformRow: 0,
    playerFacing: 1,
    hasHammer: false,
    hammerTimer: 0,
    hammerSwingAngle: 0,
    barrels: [],
    barrelSpawnTimer: 0,
    platforms: [],
    ladders: [],
    hammers: [],
    rescueX: 0,
    rescueY: 0,
    kongX: 0,
    kongY: 0,
    timeRemaining: 120,
    movesRemaining: 200,
    barrelsSmashed: 0,
    barrelsJumped: 0,
    levelsCleared: 0,
    jumpActive: false,
    fireBarrels: [],
    fireTrails: [],
    springs: [],
    hasShield: false,
    shieldTimer: 0,
    shieldHitsLeft: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    hasSpeedBoost: false,
    speedBoostTimer: 0,
    conveyorBelts: [],
    crumblingPlatforms: [],
    careerGames: career.careerGames || 0,
    careerSmashed: career.careerSmashed || 0,
    careerJumped: career.careerJumped || 0,
    careerLevels: career.careerLevels || 0,
    careerDeaths: career.careerDeaths || 0,
    careerHammers: career.careerHammers || 0,
    careerBestScore: career.careerBestScore || 0,
    careerBestLevel: career.careerBestLevel || 0,
    careerBestCombo: career.careerBestCombo || 0,
    isBossLevel: false,
    bossShockwaveTimer: 0,
    hasMagnet: false,
    magnetTimer: 0,
    hasMultiplier: false,
    multiplierTimer: 0,
    achievements: career.achievements || new Set(),
  };
}

function startGame() {
  state.status = 'playing';
  state.score = 0;
  state.lives = state.difficulty === 'insane' ? 1 : state.difficulty === 'hard' ? 2 : 3;
  state.level = 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.barrels = [];
  state.barrelsSmashed = 0;
  state.barrelsJumped = 0;
  state.levelsCleared = 0;
  state.hasHammer = false;
  state.hammerTimer = 0;
  state.hasShield = false;
  state.shieldTimer = 0;
  state.shieldHitsLeft = 0;
  state.fireBarrels = [];
  state.fireTrails = [];
  state.springs = [];
  state.shakeTimer = 0;
  state.shakeIntensity = 0;
  state.hasSpeedBoost = false;
  state.speedBoostTimer = 0;
  state.conveyorBelts = [];
  state.crumblingPlatforms = [];
  fireBarrelsDodged = 0;
  springJumped = false;
  levelHammerUsed = false;
  bonusCollectedGame = 0;
  conveyorLevelsSurvived = 0;
  comboStartTime = 0;
  patrolsPassed = 0;
  rivetsCollectedLevel = 0;
  rivetsOnLevel = 0;
  crumblePlatformsSurvived = 0;
  state.isBossLevel = false;
  state.bossShockwaveTimer = 0;
  state.hasMagnet = false;
  state.magnetTimer = 0;
  state.hasMultiplier = false;
  state.multiplierTimer = 0;
  state.timeRemaining = 120;
  state.movesRemaining = 200;
  state.careerGames++;
  modesPlayed.add(state.mode);
  if (modesPlayed.size >= 4) checkAchievement('all_modes');
  if (state.careerGames >= 10) checkAchievement('games_10');
  if (state.careerGames >= 50) checkAchievement('games_50');
  saveCareer();
  initAudio();
  startMusic();
  setupLevel();
}

function setupLevel() {
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;

  // Clear old level
  for (const p of state.platforms) scene.remove(p.mesh);
  for (const l of state.ladders) scene.remove(l.mesh);
  for (const h of state.hammers) scene.remove(h.mesh);
  for (const b of state.barrels) scene.remove(b.mesh);
  for (const fb of state.fireBarrels) scene.remove(fb.mesh);
  for (const ft of state.fireTrails) scene.remove(ft.mesh);
  for (const sp of state.springs) scene.remove(sp.mesh);
  for (const sh of shields) scene.remove(sh.mesh);
  for (const bi of bonusItems) scene.remove(bi.mesh);
  for (const lp of ladderPatrols) scene.remove(lp.mesh);
  for (const sb of speedBoosts) scene.remove(sb.mesh);
  for (const rv of rivets) scene.remove(rv.mesh);
  for (const wp of warpPortals) scene.remove(wp.mesh);
  for (const el of extraLives) scene.remove(el.mesh);
  for (const mp of magnetPickups) scene.remove(mp.mesh);
  for (const sm of scoreMultipliers) scene.remove(sm.mesh);
  for (const sw of shockwaves) { scene.remove(sw.mesh); sw.mesh.geometry.dispose(); (sw.mesh.material as MeshBasicMaterial).dispose(); }
  for (const ai of afterimages) { scene.remove(ai.mesh); ai.mesh.geometry.dispose(); (ai.mesh.material as MeshBasicMaterial).dispose(); }
  // Clean up conveyor arrows
  for (const cb of state.conveyorBelts) { for (const am of cb.arrowMeshes) { scene.remove(am); am.geometry.dispose(); (am.material as MeshBasicMaterial).dispose(); } }
  for (const sp of scorePopups) { scene.remove(sp.mesh); sp.mesh.geometry.dispose(); (sp.mesh.material as MeshBasicMaterial).dispose(); }
  state.barrels = [];
  state.fireBarrels = [];
  state.fireTrails = [];
  state.springs = [];
  state.conveyorBelts = [];
  shields = [];
  bonusItems = [];
  ladderPatrols = [];
  scorePopups = [];
  speedBoosts = [];
  afterimages = [];
  rivets = [];
  warpPortals = [];
  extraLives = [];
  magnetPickups = [];
  scoreMultipliers = [];
  shockwaves = [];
  rivetsCollectedLevel = 0;

  const { platforms, ladders, hammers } = generateLevel(state.level);
  state.platforms = platforms;
  state.ladders = ladders;
  state.hammers = hammers;

  // Player start: bottom-left of first platform
  state.playerX = (1 - COLS / 2 + 0.5) * CELL;
  state.playerY = platforms[0].y + PLATFORM_H / 2 + PLAYER_R;
  state.playerPlatformRow = 0;
  state.playerOnGround = true;
  state.playerClimbing = false;
  state.playerVY = 0;
  state.hasHammer = false;
  state.hammerTimer = 0;

  // Kong position: top platform
  const topPlat = platforms[ROWS - 1];
  state.kongX = ((COLS / 2 - 1) - COLS / 2 + 0.5) * CELL;
  state.kongY = topPlat.y + PLATFORM_H / 2 + 0.7;
  kongMesh.position.set(state.kongX, state.kongY, 0);

  // Rescue position: near Kong
  state.rescueX = state.kongX - 1.5;
  state.rescueY = state.kongY + 0.2;
  rescueMesh.position.set(state.rescueX, state.rescueY, 0);

  state.barrelSpawnTimer = 1.5;
  levelStartTime = performance.now() / 1000;
  levelDeathCount = 0;
  levelBarrelCount = 0;
  levelHammerUsed = false;

  // Spawn shields on levels 3+
  if (state.level >= 3) {
    const shieldRow = 2 + Math.floor(Math.random() * (ROWS - 4));
    const shieldCol = 1 + Math.floor(Math.random() * (COLS - 2));
    const sx = (shieldCol - COLS / 2 + 0.5) * CELL;
    const sy = platforms[shieldRow].y + PLATFORM_H / 2 + 0.25;
    const sg = new Group();
    const sGeo = new SphereGeometry(0.18, 8, 6);
    const sMat = new MeshStandardMaterial({
      color: new Color('#4488ff'),
      emissive: new Color('#4488ff'),
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
    });
    const sm = new Mesh(sGeo, sMat);
    sg.add(sm);
    // Ring around shield
    const ringGeo = new CylinderGeometry(0.22, 0.22, 0.03, 12);
    const ringMat = new MeshStandardMaterial({
      color: new Color('#88bbff'),
      emissive: new Color('#88bbff'),
      emissiveIntensity: 0.8,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    sg.add(ring);
    sg.position.set(sx, sy, 0.1);
    scene.add(sg);
    shields.push({ mesh: sg, x: sx, y: sy, row: shieldRow, active: true });
  }

  // Spawn spring enemies on levels 4+
  if (state.level >= 4) {
    const springCount = Math.min(2, Math.floor((state.level - 3) / 2) + 1);
    for (let s = 0; s < springCount; s++) {
      const springRow = 1 + Math.floor(Math.random() * (ROWS - 3));
      const springX = (Math.floor(Math.random() * COLS) - COLS / 2 + 0.5) * CELL;
      const springY = platforms[springRow].y + PLATFORM_H / 2 + 0.2;
      const sGroup = new Group();
      // Spring body (coil)
      const coilGeo = new CylinderGeometry(0.12, 0.15, 0.35, 6);
      const coilMat = new MeshStandardMaterial({
        color: new Color('#ff6600'),
        emissive: new Color('#ff6600'),
        emissiveIntensity: 0.5,
      });
      const coil = new Mesh(coilGeo, coilMat);
      sGroup.add(coil);
      // Spring head
      const headGeo = new SphereGeometry(0.12, 6, 4);
      const headMat = new MeshStandardMaterial({
        color: new Color('#ffaa00'),
        emissive: new Color('#ffaa00'),
        emissiveIntensity: 0.6,
      });
      const head = new Mesh(headGeo, headMat);
      head.position.set(0, 0.25, 0);
      sGroup.add(head);
      // Wireframe
      const sEdges = new EdgesGeometry(coilGeo);
      const sLine = new LineSegments(sEdges, new LineBasicMaterial({ color: new Color('#ffaa00') }));
      sGroup.add(sLine);
      sGroup.position.set(springX, springY, 0);
      scene.add(sGroup);
      state.springs.push({
        mesh: sGroup,
        x: springX,
        y: springY,
        vy: 0,
        platformRow: springRow,
        bouncing: false,
        direction: Math.random() > 0.5 ? 1 : -1,
        bounceTimer: 1 + Math.random() * 2,
      });
    }
  }

  // Bonus gems (all levels, increasing count)
  const gemCount = Math.min(3, 1 + Math.floor(state.level / 2));
  for (let g = 0; g < gemCount; g++) {
    const gemRow = 1 + Math.floor(Math.random() * (ROWS - 2));
    const gemCol = 1 + Math.floor(Math.random() * (COLS - 2));
    const gx = (gemCol - COLS / 2 + 0.5) * CELL;
    const gy = platforms[gemRow].y + PLATFORM_H / 2 + 0.2;
    const pts = state.level >= 5 ? 300 : state.level >= 3 ? 200 : 100;
    bonusItems.push(createBonusGem(scene, gx, gy, gemRow, pts));
  }

  // Ladder patrol enemies (level 6+)
  if (state.level >= 6) {
    const patrolCount = Math.min(2, Math.floor((state.level - 5) / 2) + 1);
    const usedLadders = new Set<number>();
    for (let p = 0; p < patrolCount; p++) {
      // Pick a ladder that spans at least 2 rows and isn't already used
      const candidates = ladders.map((l, idx) => ({ l, idx })).filter(({ l, idx }) => !usedLadders.has(idx));
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      usedLadders.add(pick.idx);
      const ladder = pick.l;
      const patrolMesh = createLadderPatrolMesh(scene, ladder.x, ladder.yBottom + 0.3);
      ladderPatrols.push({
        mesh: patrolMesh,
        ladderIdx: pick.idx,
        y: ladder.yBottom + 0.3,
        direction: 1,
        speed: 1.2 + state.level * 0.08,
      });
    }
  }

  // Conveyor belt platforms (level 5+)
  if (state.level >= 5) {
    const beltCount = Math.min(3, Math.floor((state.level - 4) / 2) + 1);
    const usedRows = new Set<number>();
    for (let b = 0; b < beltCount; b++) {
      // Pick a row that isn't bottom, top, or already used
      const candidates = [];
      for (let r = 1; r < ROWS - 1; r++) {
        if (!usedRows.has(r)) candidates.push(r);
      }
      if (candidates.length === 0) break;
      const row = candidates[Math.floor(Math.random() * candidates.length)];
      usedRows.add(row);
      const dir = Math.random() > 0.5 ? 1 : -1;
      const speed = 1.0 + state.level * 0.1;
      const plat = platforms[row];
      
      // Create arrow indicators on the platform
      const arrowMeshes: Mesh[] = [];
      const arrowCount = 4;
      for (let a = 0; a < arrowCount; a++) {
        const ax = plat.mesh.position.x + (a - arrowCount / 2 + 0.5) * (CELL * 1.5);
        const ay = plat.y + PLATFORM_H / 2 + 0.02;
        // Arrow as a small triangle using CylinderGeometry(0, radius, height, 3) 
        const arrowGeo = new CylinderGeometry(0, 0.08, 0.15, 3);
        const arrowMat = new MeshBasicMaterial({
          color: new Color(dir > 0 ? '#ffaa00' : '#ff6600'),
          transparent: true,
          opacity: 0.6,
        });
        const arrow = new Mesh(arrowGeo, arrowMat);
        arrow.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(ax, ay, 0.1);
        scene.add(arrow);
        arrowMeshes.push(arrow);
      }

      // Tint the platform with a subtle conveyor color
      const platMat = plat.mesh.material as MeshStandardMaterial;
      platMat.emissiveIntensity = 0.5;

      state.conveyorBelts.push({
        row,
        direction: dir,
        speed,
        arrowMeshes,
        arrowTimer: 0,
      });
    }
  }

  // Speed boost power-up (level 3+)
  if (state.level >= 3) {
    const boostRow = 2 + Math.floor(Math.random() * (ROWS - 4));
    const boostCol = Math.floor(Math.random() * (COLS - 2)) + 1;
    const bx = (boostCol - COLS / 2 + 0.5) * CELL;
    const by = platforms[boostRow].y + PLATFORM_H / 2 + 0.25;
    const boostGroup = new Group();
    
    // Lightning bolt shape — vertical cylinder with glow
    const boltGeo = new CylinderGeometry(0.04, 0.04, 0.3, 4);
    const boltMat = new MeshStandardMaterial({
      color: new Color('#ffff00'),
      emissive: new Color('#ffff00'),
      emissiveIntensity: 0.9,
    });
    const bolt = new Mesh(boltGeo, boltMat);
    bolt.rotation.z = Math.PI / 6;
    boostGroup.add(bolt);
    
    const boltGeo2 = new CylinderGeometry(0.04, 0.04, 0.25, 4);
    const bolt2 = new Mesh(boltGeo2, boltMat);
    bolt2.rotation.z = -Math.PI / 6;
    bolt2.position.set(0.05, -0.12, 0);
    boostGroup.add(bolt2);
    
    // Glow sphere
    const glowGeo = new SphereGeometry(0.2, 6, 4);
    const glowMat = new MeshBasicMaterial({
      color: new Color('#ffff00'),
      transparent: true,
      opacity: 0.15,
    });
    const glow = new Mesh(glowGeo, glowMat);
    boostGroup.add(glow);
    
    boostGroup.position.set(bx, by, 0.1);
    scene.add(boostGroup);
    speedBoosts.push({ mesh: boostGroup, x: bx, y: by, row: boostRow, active: true, bobTimer: Math.random() * Math.PI * 2 });
  }

  // ─── RIVETS (level 2+) ───
  if (state.level >= 2) {
    const rivetCount = Math.min(4, 1 + Math.floor(state.level / 3));
    rivetsOnLevel = rivetCount;
    const usedPositions = new Set<string>();
    for (let r = 0; r < rivetCount; r++) {
      let row: number, col: number;
      let posKey: string;
      do {
        row = 1 + Math.floor(Math.random() * (ROWS - 2));
        col = 1 + Math.floor(Math.random() * (COLS - 2));
        posKey = row + ',' + col;
      } while (usedPositions.has(posKey));
      usedPositions.add(posKey);

      const rx = (col - COLS / 2 + 0.5) * CELL;
      const ry = platforms[row].y + PLATFORM_H / 2 + 0.15;

      const rivetGroup = new Group();
      // Bolt body
      const boltGeo = new CylinderGeometry(0.06, 0.06, 0.12, 6);
      const boltMat = new MeshStandardMaterial({
        color: new Color('#88ccff'),
        emissive: new Color('#88ccff'),
        emissiveIntensity: 0.7,
      });
      const boltMesh = new Mesh(boltGeo, boltMat);
      rivetGroup.add(boltMesh);
      // Bolt head
      const headGeo = new CylinderGeometry(0.1, 0.1, 0.04, 6);
      const headMat = new MeshStandardMaterial({
        color: new Color('#aaddff'),
        emissive: new Color('#aaddff'),
        emissiveIntensity: 0.9,
      });
      const headMesh = new Mesh(headGeo, headMat);
      headMesh.position.y = 0.08;
      rivetGroup.add(headMesh);
      // Wireframe
      const rivetEdges = new EdgesGeometry(headGeo);
      const rivetLine = new LineSegments(rivetEdges, new LineBasicMaterial({ color: new Color('#ccddff') }));
      rivetLine.position.y = 0.08;
      rivetGroup.add(rivetLine);

      rivetGroup.position.set(rx, ry, 0.12);
      scene.add(rivetGroup);
      rivets.push({ mesh: rivetGroup, x: rx, y: ry, row, collected: false, bobTimer: Math.random() * Math.PI * 2 });
    }
  }

  // ─── CRUMBLING PLATFORMS (level 7+) ───
  if (state.level >= 7) {
    const crumbleCount = Math.min(2, Math.floor((state.level - 6) / 2) + 1);
    const usedRows = new Set<number>([0, ROWS - 1]); // never crumble bottom/top
    for (let c = 0; c < crumbleCount; c++) {
      const candidates = [];
      for (let r = 1; r < ROWS - 1; r++) {
        if (!usedRows.has(r)) candidates.push(r);
      }
      if (candidates.length === 0) break;
      const row = candidates[Math.floor(Math.random() * candidates.length)];
      usedRows.add(row);
      
      const platMat = platforms[row].mesh.material as MeshStandardMaterial;
      state.crumblingPlatforms.push({
        row,
        timer: 0,
        maxTimer: 2.5 - Math.min(0.8, state.level * 0.05), // faster crumble at higher levels
        crumbling: false,
        originalOpacity: platMat.opacity,
      });
      
      // Tint crumbling platforms with a warning color
      platMat.color.set(new Color('#ff8844'));
      platMat.emissive.set(new Color('#ff6622'));
      platMat.emissiveIntensity = 0.4;
    }
  }

  // ─── WARP PORTALS (level 4+) ───
  if (state.level >= 4) {
    // Create one pair of portals
    const rowA = 1 + Math.floor(Math.random() * Math.floor((ROWS - 2) / 2));
    const rowB = rowA + 2 + Math.floor(Math.random() * (ROWS - rowA - 3));
    const colA = 1 + Math.floor(Math.random() * (COLS - 2));
    const colB = 1 + Math.floor(Math.random() * (COLS - 2));
    
    const portalPositions = [
      { row: Math.min(rowA, ROWS - 2), col: colA },
      { row: Math.min(rowB, ROWS - 2), col: colB },
    ];

    for (let pi = 0; pi < 2; pi++) {
      const pp = portalPositions[pi];
      const px = (pp.col - COLS / 2 + 0.5) * CELL;
      const py = platforms[pp.row].y + PLATFORM_H / 2 + 0.3;

      const portalGroup = new Group();
      // Outer ring
      const ringGeo = new CylinderGeometry(0.22, 0.22, 0.04, 12);
      const ringColor = pi === 0 ? '#ff44ff' : '#44ffff';
      const ringMat = new MeshStandardMaterial({
        color: new Color(ringColor),
        emissive: new Color(ringColor),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      portalGroup.add(ring);
      // Inner glow
      const innerGeo = new SphereGeometry(0.14, 8, 6);
      const innerMat = new MeshBasicMaterial({
        color: new Color(ringColor),
        transparent: true,
        opacity: 0.35,
      });
      const inner = new Mesh(innerGeo, innerMat);
      portalGroup.add(inner);
      // Wireframe ring
      const portalEdges = new EdgesGeometry(ringGeo);
      const portalLine = new LineSegments(portalEdges, new LineBasicMaterial({ color: new Color(ringColor) }));
      portalLine.rotation.x = Math.PI / 2;
      portalGroup.add(portalLine);

      portalGroup.position.set(px, py, 0.15);
      scene.add(portalGroup);
      warpPortals.push({
        mesh: portalGroup,
        x: px,
        y: py,
        row: pp.row,
        pairIdx: pi === 0 ? 1 : 0,
        cooldown: 0,
        spinTimer: Math.random() * Math.PI * 2,
      });
    }
  }

  // ─── EXTRA LIFE (level 5+, rare) ───
  if (state.level >= 5 && Math.random() < 0.4) {
    const lifeRow = 2 + Math.floor(Math.random() * (ROWS - 4));
    const lifeCol = Math.floor(Math.random() * (COLS - 2)) + 1;
    const lx = (lifeCol - COLS / 2 + 0.5) * CELL;
    const ly = platforms[lifeRow].y + PLATFORM_H / 2 + 0.25;

    const lifeGroup = new Group();
    // Heart shape using two spheres and a box
    const heartMat = new MeshStandardMaterial({
      color: new Color('#ff3366'),
      emissive: new Color('#ff3366'),
      emissiveIntensity: 0.8,
    });
    const lobe1 = new Mesh(new SphereGeometry(0.08, 6, 4), heartMat);
    lobe1.position.set(-0.05, 0.04, 0);
    lifeGroup.add(lobe1);
    const lobe2 = new Mesh(new SphereGeometry(0.08, 6, 4), heartMat);
    lobe2.position.set(0.05, 0.04, 0);
    lifeGroup.add(lobe2);
    const bodyGeo = new BoxGeometry(0.14, 0.1, 0.1);
    const body = new Mesh(bodyGeo, heartMat);
    body.rotation.z = Math.PI / 4;
    body.position.set(0, -0.02, 0);
    body.scale.set(0.8, 0.8, 0.8);
    lifeGroup.add(body);
    // Glow
    const glowGeo = new SphereGeometry(0.16, 6, 4);
    const glowMat = new MeshBasicMaterial({
      color: new Color('#ff3366'),
      transparent: true,
      opacity: 0.2,
    });
    const glow = new Mesh(glowGeo, glowMat);
    lifeGroup.add(glow);

    lifeGroup.position.set(lx, ly, 0.12);
    scene.add(lifeGroup);
    extraLives.push({ mesh: lifeGroup, x: lx, y: ly, row: lifeRow, active: true, bobTimer: Math.random() * Math.PI * 2, pulseTimer: 0 });
  }

  // Update music tension for new level
  updateMusicTension();

  // ─── BOSS LEVEL SETUP ───
  state.isBossLevel = state.level % 5 === 0 && state.level > 0;
  if (state.isBossLevel) {
    state.bossShockwaveTimer = 4;
    playSound('boss_intro');
    // Kong glows more intensely on boss levels
    kongMesh.children.forEach(child => {
      if (child instanceof Mesh) {
        const mat = (child as Mesh).material as MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = Math.min(1.2, (mat.emissiveIntensity || 0.4) + 0.5);
        }
      }
    });
  }

  // ─── MAGNET PICKUP (level 4+) ───
  if (state.level >= 4) {
    const magRow = 2 + Math.floor(Math.random() * (ROWS - 4));
    const magCol = 1 + Math.floor(Math.random() * (COLS - 2));
    const mx = (magCol - COLS / 2 + 0.5) * CELL;
    const my = platforms[magRow].y + PLATFORM_H / 2 + 0.25;
    const magGroup = new Group();
    // U-shaped magnet using cylinders
    const magMat = new MeshStandardMaterial({
      color: new Color('#ff4444'),
      emissive: new Color('#ff2222'),
      emissiveIntensity: 0.7,
    });
    const leftPole = new Mesh(new CylinderGeometry(0.04, 0.04, 0.2, 6), magMat);
    leftPole.position.set(-0.08, -0.05, 0);
    magGroup.add(leftPole);
    const rightPole = new Mesh(new CylinderGeometry(0.04, 0.04, 0.2, 6), magMat);
    rightPole.position.set(0.08, -0.05, 0);
    magGroup.add(rightPole);
    const topBar = new Mesh(new BoxGeometry(0.2, 0.06, 0.06), new MeshStandardMaterial({
      color: new Color('#cccccc'),
      emissive: new Color('#888888'),
      emissiveIntensity: 0.5,
    }));
    topBar.position.set(0, 0.07, 0);
    magGroup.add(topBar);
    // Glow
    const mGlow = new Mesh(new SphereGeometry(0.18, 6, 4), new MeshBasicMaterial({
      color: new Color('#ff4444'),
      transparent: true,
      opacity: 0.15,
    }));
    magGroup.add(mGlow);
    magGroup.position.set(mx, my, 0.12);
    scene.add(magGroup);
    magnetPickups.push({ mesh: magGroup, x: mx, y: my, row: magRow, active: true, bobTimer: Math.random() * Math.PI * 2 });
  }

  // ─── SCORE MULTIPLIER (level 6+) ───
  if (state.level >= 6) {
    const multRow = 2 + Math.floor(Math.random() * (ROWS - 4));
    const multCol = 1 + Math.floor(Math.random() * (COLS - 2));
    const smx = (multCol - COLS / 2 + 0.5) * CELL;
    const smy = platforms[multRow].y + PLATFORM_H / 2 + 0.25;
    const multGroup = new Group();
    // "2x" represented by stacked rings
    const ring1 = new Mesh(new CylinderGeometry(0.14, 0.14, 0.03, 8), new MeshStandardMaterial({
      color: new Color('#ffdd00'),
      emissive: new Color('#ffcc00'),
      emissiveIntensity: 0.9,
    }));
    ring1.rotation.x = Math.PI / 2;
    multGroup.add(ring1);
    const ring2 = new Mesh(new CylinderGeometry(0.1, 0.1, 0.03, 8), new MeshStandardMaterial({
      color: new Color('#ff8800'),
      emissive: new Color('#ff6600'),
      emissiveIntensity: 0.8,
    }));
    ring2.rotation.x = Math.PI / 2;
    ring2.position.z = 0.04;
    multGroup.add(ring2);
    // Glow
    const smGlow = new Mesh(new SphereGeometry(0.18, 6, 4), new MeshBasicMaterial({
      color: new Color('#ffdd00'),
      transparent: true,
      opacity: 0.2,
    }));
    multGroup.add(smGlow);
    multGroup.position.set(smx, smy, 0.12);
    scene.add(multGroup);
    scoreMultipliers.push({ mesh: multGroup, x: smx, y: smy, row: multRow, active: true, bobTimer: Math.random() * Math.PI * 2 });
  }
}

function spawnBarrel() {
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  const topPlat = state.platforms[ROWS - 1];
  const x = state.kongX;
  const y = topPlat.y + PLATFORM_H / 2 + BARREL_R;

  const diffMult = state.difficulty === 'insane' ? 1.6 : state.difficulty === 'hard' ? 1.3 : 1.0;
  const direction = Math.random() > 0.5 ? 1 : -1;

  // Fire barrels appear on levels 2+ with increasing probability
  const isFire = state.level >= 2 && Math.random() < Math.min(0.35, 0.1 + state.level * 0.04);

  if (isFire) {
    const mesh = createFireBarrelMesh(scene);
    mesh.position.set(x, y, 0);
    state.fireBarrels.push({
      mesh,
      x,
      y,
      vx: direction * BARREL_SPEED * diffMult * 0.8,
      vy: 0,
      onPlatform: true,
      platformRow: ROWS - 1,
      rolling: true,
      angle: 0,
      usedLadders: new Set(),
      isFire: true,
      trailTimer: 0,
    });
  } else {
    const mesh = createBarrelMesh(scene);
    mesh.position.set(x, y, 0);
    state.barrels.push({
      mesh,
      x,
      y,
      vx: direction * BARREL_SPEED * diffMult,
      vy: 0,
      onPlatform: true,
      platformRow: ROWS - 1,
      rolling: true,
      angle: 0,
      usedLadders: new Set(),
    });
  }
  levelBarrelCount++;
}

// ─── AFTERIMAGE TRAIL ───
function spawnAfterimage(scene: import('@iwsdk/core').Scene, x: number, y: number, facing: number) {
  const sch = SCHEMES[state.scheme];
  const pColor = new Color(sch.primary);
  const geo = new CylinderGeometry(PLAYER_R * 0.5, PLAYER_R * 0.4, PLAYER_R * 1.8, 6);
  const mat = new MeshBasicMaterial({
    color: pColor,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, y, -0.1);
  mesh.scale.x = facing;
  scene.add(mesh);
  afterimages.push({ mesh, life: 0.3, maxLife: 0.3 });
}

function updateAfterimages(scene: import('@iwsdk/core').Scene, delta: number) {
  for (let i = afterimages.length - 1; i >= 0; i--) {
    const ai = afterimages[i];
    ai.life -= delta;
    if (ai.life <= 0) {
      scene.remove(ai.mesh);
      ai.mesh.geometry.dispose();
      (ai.mesh.material as MeshBasicMaterial).dispose();
      afterimages.splice(i, 1);
      continue;
    }
    const alpha = (ai.life / ai.maxLife) * 0.3;
    (ai.mesh.material as MeshBasicMaterial).opacity = alpha;
    const scale = 1 - (1 - ai.life / ai.maxLife) * 0.3;
    ai.mesh.scale.y = scale;
    ai.mesh.scale.z = scale;
  }
}

function addScore(points: number) {
  state.combo++;
  state.comboTimer = 3;
  if (state.combo === 1) comboStartTime = performance.now() / 1000;
  const comboElapsed = performance.now() / 1000 - comboStartTime;
  if (comboElapsed >= 10 && state.combo > 1) checkAchievement('combo_no_break');
  const mult = Math.min(state.combo, 8);
  const globalMult = state.hasMultiplier ? 2 : 1;
  state.score += points * mult * globalMult;
  if (mult >= 3) { checkAchievement('combo_3'); playSound('combo'); }
  if (mult >= 5) checkAchievement('combo_5');
  if (mult >= 8) checkAchievement('combo_8');
  if (state.combo > state.careerBestCombo) state.careerBestCombo = state.combo;
  if (state.score > state.highScore) state.highScore = state.score;
  if (state.score > state.careerBestScore) state.careerBestScore = state.score;
  if (state.score >= 5000) checkAchievement('score_5k');
  if (state.score >= 10000) checkAchievement('score_10k');
  if (state.score >= 25000) checkAchievement('score_25k');
  if (state.score >= 50000) checkAchievement('score_50k');
  if (state.score >= 100000) checkAchievement('score_100k');
  if (state.score >= 200000) checkAchievement('score_200k');
}

function playerDeath() {
  // Shield blocks the hit
  if (state.hasShield && state.shieldHitsLeft > 0) {
    state.shieldHitsLeft--;
    playSound('shield_block');
    const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
    spawnParticles(scene, state.playerX, state.playerY, '#4488ff', 8);
    checkAchievement('shield_save');
    if (state.shieldHitsLeft <= 0) {
      state.hasShield = false;
    }
    // Trigger screen shake
    state.shakeTimer = 0.2;
    state.shakeIntensity = 0.08;
    return;
  }

  playSound('death');
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  spawnParticles(scene, state.playerX, state.playerY, SCHEMES[state.scheme].primary, 15);

  // Screen shake on death
  state.shakeTimer = 0.4;
  state.shakeIntensity = 0.15;

  state.lives--;
  state.careerDeaths++;
  levelDeathCount++;
  state.hasHammer = false;
  state.hammerTimer = 0;
  state.combo = 0;
  state.hasSpeedBoost = false;
  state.speedBoostTimer = 0;
  state.hasMagnet = false;
  state.magnetTimer = 0;
  state.hasMultiplier = false;
  state.multiplierTimer = 0;

  if (state.lives <= 0) {
    state.status = 'gameover';
    stopMusic();
    playSound('gameover');
    saveCareer();
    return;
  }

  // Respawn at bottom
  state.playerX = (1 - COLS / 2 + 0.5) * CELL;
  state.playerY = state.platforms[0].y + PLATFORM_H / 2 + PLAYER_R;
  state.playerPlatformRow = 0;
  state.playerOnGround = true;
  state.playerClimbing = false;
  state.playerVY = 0;
}

function levelClear() {
  playSound('level_clear');
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  spawnParticles(scene, state.playerX, state.playerY, '#ffffff', 20);
  spawnParticles(scene, state.rescueX, state.rescueY, '#ff88ff', 15);

  state.levelsCleared++;
  state.careerLevels++;
  addScore(1000 + state.level * 200);

  if (state.level >= 3) checkAchievement('level_3');
  if (state.level >= 5) checkAchievement('level_5');
  if (state.level >= 10) checkAchievement('level_10');
  if (state.level >= 15) checkAchievement('level_15');
  if (state.level >= 20) checkAchievement('level_20');
  if (state.isBossLevel) {
    bossLevelsCleared++;
    checkAchievement('boss_clear');
    addScore(2000); // Boss clear bonus
  }
  if (state.level > state.careerBestLevel) state.careerBestLevel = state.level;

  if (levelDeathCount === 0) checkAchievement('no_death');
  const elapsed = performance.now() / 1000 - levelStartTime;
  if (elapsed < 30) checkAchievement('speed_clear');
  if (levelBarrelCount > 0 && state.barrelsSmashed >= levelBarrelCount) checkAchievement('perfect_level');
  if (!levelHammerUsed) checkAchievement('no_hammer');

  if (state.difficulty === 'hard' && state.level === 1) checkAchievement('hard_clear');
  if (state.difficulty === 'insane' && state.level === 1) checkAchievement('insane_clear');
  if (state.conveyorBelts.length > 0) {
    conveyorLevelsSurvived++;
    if (conveyorLevelsSurvived >= 3) checkAchievement('conveyor_survive');
  }
  if (state.hasSpeedBoost) checkAchievement('speed_clear');

  state.level++;
  saveCareer();
  setupLevel();
}

// Input
const keys: Record<string, boolean> = {};

function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && state.status === 'playing') {
      state.status = 'paused';
    } else if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && state.status === 'paused') {
      state.status = 'playing';
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
}

// ─── MAIN INIT ───
async function main() {
  const container = document.getElementById('scene-container') as HTMLDivElement;
  const world = await World.create(container, {
    xr: { offer: 'once' },
    features: {
      locomotion: { browserControls: true },
    },
  });

  const scene = world.scene;
  (window as any).__nkScene = scene;
  (window as any).__nkWorld = world;

  // Fog and lighting
  const sch = SCHEMES['cyan'];
  scene.fog = new FogExp2(new Color(sch.bg).getHex(), 0.06);
  scene.background = new Color(sch.bg);

  const ambient = new AmbientLight(0x222244, 0.5);
  scene.add(ambient);
  const pLight = new PointLight(new Color(sch.primary).getHex(), 1.5, 20);
  pLight.position.set(0, 4, 3);
  scene.add(pLight);

  // Camera
  world.camera.position.set(0, 0, 8);
  world.camera.lookAt(0, 0, 0);

  // Initialize state
  state = initState();

  // Create persistent objects
  kongMesh = createKong(scene);
  playerMesh = createPlayer(scene);
  rescueMesh = createRescue(scene);
  barrelGroup = new Group();
  scene.add(barrelGroup);
  environmentGroup = createEnvironment(scene);

  // Input
  setupInput();

  // PanelUI panels
  const panelConfigs = [
    { name: 'menu', config: './ui/menu.json', pos: [0, 0, 3] as [number, number, number] },
    { name: 'hud', config: './ui/hud.json', pos: [0, 3.5, 0] as [number, number, number] },
    { name: 'pause', config: './ui/pause.json', pos: [0, 0, 3] as [number, number, number] },
    { name: 'results', config: './ui/results.json', pos: [0, 0, 3] as [number, number, number] },
    { name: 'settings', config: './ui/settings.json', pos: [2.5, 0, 2] as [number, number, number] },
    { name: 'achievements', config: './ui/achievements.json', pos: [-2.5, 0, 2] as [number, number, number] },
    { name: 'stats', config: './ui/stats.json', pos: [2.5, 0, 2] as [number, number, number] },
    { name: 'tutorial', config: './ui/tutorial.json', pos: [-2.5, 0, 2] as [number, number, number] },
  ];

  for (const pc of panelConfigs) {
    const panelObj = new Group();
    panelObj.position.set(pc.pos[0], pc.pos[1], pc.pos[2]);
    panelObj.scale.set(2, 2, 2);
    scene.add(panelObj);
    const entity = world.createTransformEntity(panelObj);
    entity.addComponent(PanelUI, { config: pc.config });
  }

  // Register systems
  world.registerSystem(GameSystem);
  world.registerSystem(UISystem);
}

// ─── GAME SYSTEM ───
class GameSystem extends createSystem({}) {
  private walkTimer = 0;
  private climbTimer = 0;
  private orbTimer = 0;
  private kongAnimTimer = 0;
  private afterimageTimer = 0;

  update(delta: number, _time: number) {
    if (state.status !== 'playing') {
      // Hide game objects when not playing
      const showObjs = state.status === 'paused' || state.status === 'gameover';
      playerMesh.visible = showObjs;
      kongMesh.visible = showObjs;
      rescueMesh.visible = showObjs;
      return;
    }

    playerMesh.visible = true;
    kongMesh.visible = true;
    rescueMesh.visible = true;

    const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
    const diffMult = state.difficulty === 'insane' ? 1.6 : state.difficulty === 'hard' ? 1.3 : 1.0;

    // Combo timer
    if (state.comboTimer > 0) {
      state.comboTimer -= delta;
      if (state.comboTimer <= 0) { state.combo = 0; comboStartTime = 0; }
    }

    // Mode timers
    if (state.mode === 'speed') {
      state.timeRemaining -= delta;
      if (state.timeRemaining <= 0) {
        state.status = 'gameover';
        stopMusic();
        playSound('gameover');
        saveCareer();
        return;
      }
    }

    // ─── PLAYER INPUT ───
    let moveX = 0;
    let moveY = 0;
    let jump = false;

    if (keys['arrowleft'] || keys['a']) moveX = -1;
    if (keys['arrowright'] || keys['d']) moveX = 1;
    if (keys['arrowup'] || keys['w']) moveY = 1;
    if (keys['arrowdown'] || keys['s']) moveY = -1;
    if (keys[' '] || keys['f']) jump = true;

    // VR controller input
    const input = (window as any).__nkWorld?.input;
    if (input) {
      try {
        const axes = input.getAxesValues?.('thumbstick') || input.getAxesValues?.('Thumbstick');
        if (axes) {
          if (axes.x < -0.3) moveX = -1;
          if (axes.x > 0.3) moveX = 1;
          if (axes.y > 0.3) moveY = 1;
          if (axes.y < -0.3) moveY = -1;
        }
        if (input.getButtonValue?.('Trigger') > 0.5 || input.getButtonValue?.('trigger') > 0.5) jump = true;
        // B button for pause
        if (input.getButtonDown?.('B') || input.getButtonDown?.('b')) {
          if (state.status === 'playing') state.status = 'paused';
          else if (state.status === 'paused') state.status = 'playing';
        }
      } catch {}
    }

    // ─── CLIMBING ───
    if (moveY !== 0 && !state.playerClimbing) {
      // Check if near a ladder
      for (const ladder of state.ladders) {
        const dx = Math.abs(state.playerX - ladder.x);
        if (dx < 0.35) {
          if (moveY > 0 && state.playerPlatformRow === ladder.rowBottom) {
            state.playerClimbing = true;
            state.playerX = ladder.x;
            break;
          }
          if (moveY < 0 && state.playerPlatformRow === ladder.rowTop) {
            state.playerClimbing = true;
            state.playerX = ladder.x;
            break;
          }
        }
      }
    }

    if (state.playerClimbing) {
      state.playerY += moveY * CLIMB_SPEED * delta;
      state.playerVY = 0;

      this.climbTimer -= delta;
      if (this.climbTimer <= 0 && moveY !== 0) {
        playSound('climb');
        this.climbTimer = 0.2;
      }

      // Check if reached top or bottom of ladder
      for (const ladder of state.ladders) {
        const dx = Math.abs(state.playerX - ladder.x);
        if (dx < 0.35) {
          const platAbove = state.platforms[ladder.rowTop];
          const platBelow = state.platforms[ladder.rowBottom];
          if (state.playerY >= platAbove.y + PLATFORM_H / 2 + PLAYER_R - 0.1) {
            state.playerY = platAbove.y + PLATFORM_H / 2 + PLAYER_R;
            state.playerPlatformRow = ladder.rowTop;
            state.playerClimbing = false;
            state.playerOnGround = true;
          }
          if (state.playerY <= platBelow.y + PLATFORM_H / 2 + PLAYER_R + 0.1) {
            state.playerY = platBelow.y + PLATFORM_H / 2 + PLAYER_R;
            state.playerPlatformRow = ladder.rowBottom;
            state.playerClimbing = false;
            state.playerOnGround = true;
          }
        }
      }
    } else {
      // Horizontal movement
      const speedMult = state.hasSpeedBoost ? 1.6 : 1.0;
      if (moveX !== 0) {
        state.playerX += moveX * MOVE_SPEED * speedMult * delta;
        state.playerFacing = moveX;

        if (state.mode === 'challenge') {
          state.movesRemaining -= delta * 10;
          if (state.movesRemaining <= 0) {
            state.status = 'gameover';
            stopMusic();
            playSound('gameover');
            saveCareer();
            return;
          }
        }

        this.walkTimer -= delta;
        if (this.walkTimer <= 0 && state.playerOnGround) {
          playSound('walk');
          this.walkTimer = 0.25;
        }

        // Spawn afterimage trail when speed boosted and moving
        if (state.hasSpeedBoost) {
          this.afterimageTimer -= delta;
          if (this.afterimageTimer <= 0) {
            spawnAfterimage(scene, state.playerX, state.playerY, state.playerFacing);
            this.afterimageTimer = 0.06;
          }
        }
      }

      // ─── CONVEYOR BELT PUSH ───
      for (const cb of state.conveyorBelts) {
        if (state.playerPlatformRow === cb.row && state.playerOnGround) {
          state.playerX += cb.direction * cb.speed * delta;
        }
        // Animate arrows (slide effect)
        cb.arrowTimer += delta * cb.speed * 2;
        for (let ai = 0; ai < cb.arrowMeshes.length; ai++) {
          const am = cb.arrowMeshes[ai];
          const phase = (cb.arrowTimer + ai * 0.5) % 2;
          const opacity = phase < 1 ? phase * 0.6 : (2 - phase) * 0.6;
          (am.material as MeshBasicMaterial).opacity = opacity;
        }
      }

      // Clamp to platform bounds
      const currentPlat = state.platforms[state.playerPlatformRow];
      if (currentPlat) {
        const minX = (currentPlat.colStart - COLS / 2 + 0.5) * CELL - CELL * 0.3;
        const maxX = (currentPlat.colEnd - COLS / 2 + 0.5) * CELL + CELL * 0.3;
        state.playerX = Math.max(minX, Math.min(maxX, state.playerX));
      }

      // Jump
      if (jump && state.playerOnGround && !state.jumpActive) {
        state.playerVY = JUMP_VEL;
        state.playerOnGround = false;
        state.jumpActive = true;
        playSound('jump');
      }
      if (!jump) state.jumpActive = false;

      // Gravity
      if (!state.playerOnGround) {
        state.playerVY -= GRAVITY * delta;
        state.playerY += state.playerVY * delta;

        // Land on platform
        const plat = state.platforms[state.playerPlatformRow];
        if (plat && state.playerY <= plat.y + PLATFORM_H / 2 + PLAYER_R) {
          state.playerY = plat.y + PLATFORM_H / 2 + PLAYER_R;
          state.playerVY = 0;
          state.playerOnGround = true;
        }
      }
    }

    // ─── HAMMER PICKUP ───
    for (const hammer of state.hammers) {
      if (!hammer.active) continue;
      const dx = state.playerX - hammer.x;
      const dy = state.playerY - hammer.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
        hammer.active = false;
        hammer.mesh.visible = false;
        state.hasHammer = true;
        state.hammerTimer = 8;
        state.careerHammers++;
        levelHammerUsed = true;
        playSound('hammer_get');
        checkAchievement('hammer_collect');
      }
    }

    // ─── SHIELD PICKUP ───
    for (const shield of shields) {
      if (!shield.active) continue;
      const dx = state.playerX - shield.x;
      const dy = state.playerY - shield.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
        shield.active = false;
        shield.mesh.visible = false;
        state.hasShield = true;
        state.shieldTimer = 15;
        state.shieldHitsLeft = 2;
        playSound('shield_get');
      }
    }

    // Shield timer
    if (state.hasShield) {
      state.shieldTimer -= delta;
      if (state.shieldTimer <= 0) {
        state.hasShield = false;
        state.shieldHitsLeft = 0;
      }
    }

    // Speed boost timer
    if (state.hasSpeedBoost) {
      state.speedBoostTimer -= delta;
      if (state.speedBoostTimer <= 0) {
        state.hasSpeedBoost = false;
      }
    }

    // ─── SPEED BOOST PICKUP ───
    for (const sb of speedBoosts) {
      if (!sb.active) continue;
      sb.bobTimer += delta * 4;
      sb.mesh.position.y = sb.y + Math.sin(sb.bobTimer) * 0.06;
      sb.mesh.rotation.y += delta * 3;
      const dx = state.playerX - sb.x;
      const dy = state.playerY - sb.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === sb.row) {
        sb.active = false;
        sb.mesh.visible = false;
        scene.remove(sb.mesh);
        state.hasSpeedBoost = true;
        state.speedBoostTimer = 6;
        playSound('speed_boost');
        spawnParticles(scene, sb.x, sb.y, '#ffff00', 10);
        checkAchievement('speed_collect');
      }
    }

    // Hammer timer
    if (state.hasHammer) {
      state.hammerTimer -= delta;
      state.hammerSwingAngle += delta * 12;
      if (state.hammerTimer <= 0) {
        state.hasHammer = false;
      }
    }

    // ─── BARREL SPAWNING ───
    state.barrelSpawnTimer -= delta;
    const bossSpawnMult = state.isBossLevel ? 0.5 : 1.0;
    const spawnInterval = Math.max(BARREL_SPAWN_INTERVAL_MIN * 0.7,
      BARREL_SPAWN_INTERVAL_BASE - state.level * 0.1) / diffMult * bossSpawnMult;
    if (state.barrelSpawnTimer <= 0) {
      spawnBarrel();
      state.barrelSpawnTimer = spawnInterval;
    }

    // ─── BARREL UPDATE ───
    for (let i = state.barrels.length - 1; i >= 0; i--) {
      const barrel = state.barrels[i];

      if (barrel.onPlatform) {
        // Roll along platform
        barrel.x += barrel.vx * delta;
        barrel.angle += barrel.vx * BARREL_ROLL_SPEED * delta;

        const plat = state.platforms[barrel.platformRow];
        if (plat) {
          const minX = (plat.colStart - COLS / 2 + 0.5) * CELL - CELL * 0.3;
          const maxX = (plat.colEnd - COLS / 2 + 0.5) * CELL + CELL * 0.3;

          // Check if barrel should fall off edge
          if (barrel.x < minX || barrel.x > maxX) {
            // Fall to next platform below
            if (barrel.platformRow > 0) {
              barrel.onPlatform = false;
              barrel.vy = 0;
            } else {
              // Remove barrel that falls off bottom
              scene.remove(barrel.mesh);
              state.barrels.splice(i, 1);
              continue;
            }
          }

          // Random chance to go down a ladder
          for (const ladder of state.ladders) {
            if (barrel.usedLadders.has(state.ladders.indexOf(ladder))) continue;
            if (ladder.rowTop === barrel.platformRow) {
              const dx = Math.abs(barrel.x - ladder.x);
              if (dx < 0.3 && Math.random() < 0.3 * delta * 10) {
                barrel.onPlatform = false;
                barrel.x = ladder.x;
                barrel.vy = -BARREL_SPEED * diffMult;
                barrel.vx = 0;
                barrel.usedLadders.add(state.ladders.indexOf(ladder));
                break;
              }
            }
          }
        }
      } else {
        // Falling
        barrel.vy -= GRAVITY * 0.7 * delta;
        barrel.y += barrel.vy * delta;
        barrel.x += barrel.vx * delta;
        barrel.angle += 5 * delta;

        // Land on platform below
        for (let r = barrel.platformRow - 1; r >= 0; r--) {
          const plat = state.platforms[r];
          if (barrel.y <= plat.y + PLATFORM_H / 2 + BARREL_R && barrel.vy < 0) {
            barrel.y = plat.y + PLATFORM_H / 2 + BARREL_R;
            barrel.vy = 0;
            barrel.platformRow = r;
            barrel.onPlatform = true;
            // Reverse direction with slight randomness
            barrel.vx = (Math.random() > 0.5 ? 1 : -1) * BARREL_SPEED * diffMult;
            playSound('barrel_land');
            break;
          }
        }

        // Remove if fell too far
        if (barrel.y < -10) {
          scene.remove(barrel.mesh);
          state.barrels.splice(i, 1);
          continue;
        }
      }

      // Update barrel mesh
      barrel.mesh.position.set(barrel.x, barrel.y, 0);
      barrel.mesh.rotation.z = barrel.angle;

      // ─── COLLISION WITH PLAYER ───
      const dx = state.playerX - barrel.x;
      const dy = state.playerY - barrel.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PLAYER_R + BARREL_R) {
        if (state.hasHammer) {
          // Smash barrel
          scene.remove(barrel.mesh);
          state.barrels.splice(i, 1);
          state.barrelsSmashed++;
          state.careerSmashed++;
          addScore(300);
          playSound('smash');
          spawnParticles(scene, barrel.x, barrel.y, SCHEMES[state.scheme].accent, 10);
          spawnScorePopup(scene, barrel.x, barrel.y, 300);
          checkAchievement('first_barrel');
          if (state.barrelsSmashed >= 10) checkAchievement('smash_10');
          if (state.careerSmashed >= 50) checkAchievement('smash_50');
          if (state.careerSmashed >= 100) checkAchievement('career_smash_100');
        } else {
          // Hit by barrel
          playerDeath();
          if ((state.status as string) === 'gameover') return;
        }
      }

      // Jump over barrel detection
      if (!state.playerOnGround && state.playerVY < 0 && barrel.onPlatform &&
          barrel.platformRow === state.playerPlatformRow) {
        const jumpDx = Math.abs(state.playerX - barrel.x);
        const jumpDy = state.playerY - barrel.y;
        if (jumpDx < 0.8 && jumpDy > 0 && jumpDy < 1.5) {
          if (!(barrel as any).__jumped) {
            (barrel as any).__jumped = true;
            state.barrelsJumped++;
            state.careerJumped++;
            addScore(100);
            if (state.barrelsJumped >= 5) checkAchievement('jump_5');
            if (state.barrelsJumped >= 20) checkAchievement('jump_20');
            if (state.careerJumped >= 200) checkAchievement('career_jump_200');
          }
        }
      }
    }

    // ─── FIRE BARREL UPDATE ───
    for (let i = state.fireBarrels.length - 1; i >= 0; i--) {
      const fb = state.fireBarrels[i];

      if (fb.onPlatform) {
        fb.x += fb.vx * delta;
        fb.angle += fb.vx * BARREL_ROLL_SPEED * delta;

        // Drop fire trails
        fb.trailTimer -= delta;
        if (fb.trailTimer <= 0) {
          fb.trailTimer = 0.4;
          const trailGeo = new BoxGeometry(0.3, 0.08, 0.3);
          const trailMat = new MeshBasicMaterial({
            color: new Color('#ff4400'),
            transparent: true,
            opacity: 0.6,
          });
          const trailMesh = new Mesh(trailGeo, trailMat);
          trailMesh.position.set(fb.x, fb.y - BARREL_R + 0.04, 0.05);
          scene.add(trailMesh);
          state.fireTrails.push({
            mesh: trailMesh,
            x: fb.x,
            y: fb.y - BARREL_R + 0.04,
            life: 4.0,
            row: fb.platformRow,
          });
        }

        const plat = state.platforms[fb.platformRow];
        if (plat) {
          const minX = (plat.colStart - COLS / 2 + 0.5) * CELL - CELL * 0.3;
          const maxX = (plat.colEnd - COLS / 2 + 0.5) * CELL + CELL * 0.3;
          if (fb.x < minX || fb.x > maxX) {
            if (fb.platformRow > 0) {
              fb.onPlatform = false;
              fb.vy = 0;
            } else {
              scene.remove(fb.mesh);
              state.fireBarrels.splice(i, 1);
              continue;
            }
          }
        }
      } else {
        fb.vy -= GRAVITY * 0.7 * delta;
        fb.y += fb.vy * delta;
        fb.x += fb.vx * delta;
        fb.angle += 5 * delta;

        for (let r = fb.platformRow - 1; r >= 0; r--) {
          const plat = state.platforms[r];
          if (fb.y <= plat.y + PLATFORM_H / 2 + BARREL_R && fb.vy < 0) {
            fb.y = plat.y + PLATFORM_H / 2 + BARREL_R;
            fb.vy = 0;
            fb.platformRow = r;
            fb.onPlatform = true;
            fb.vx = (Math.random() > 0.5 ? 1 : -1) * BARREL_SPEED * diffMult * 0.8;
            playSound('fire_sizzle');
            break;
          }
        }

        if (fb.y < -10) {
          scene.remove(fb.mesh);
          state.fireBarrels.splice(i, 1);
          continue;
        }
      }

      fb.mesh.position.set(fb.x, fb.y, 0);
      fb.mesh.rotation.z = fb.angle;

      // Collision with player
      const dx = state.playerX - fb.x;
      const dy = state.playerY - fb.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PLAYER_R + BARREL_R) {
        if (state.hasHammer) {
          scene.remove(fb.mesh);
          state.fireBarrels.splice(i, 1);
          state.barrelsSmashed++;
          state.careerSmashed++;
          addScore(500);
          playSound('smash');
          spawnParticles(scene, fb.x, fb.y, '#ff4400', 12);
        } else {
          playerDeath();
          if ((state.status as string) === 'gameover') return;
        }
      }

      // Jump over fire barrel detection
      if (!state.playerOnGround && state.playerVY < 0 && fb.onPlatform &&
          fb.platformRow === state.playerPlatformRow) {
        const jumpDx = Math.abs(state.playerX - fb.x);
        const jumpDy = state.playerY - fb.y;
        if (jumpDx < 0.8 && jumpDy > 0 && jumpDy < 1.5) {
          if (!(fb as any).__jumped) {
            (fb as any).__jumped = true;
            fireBarrelsDodged++;
            state.barrelsJumped++;
            state.careerJumped++;
            addScore(200);
            if (fireBarrelsDodged >= 5) checkAchievement('fire_dodge_5');
          }
        }
      }
    }

    // ─── FIRE TRAIL UPDATE ───
    for (let i = state.fireTrails.length - 1; i >= 0; i--) {
      const trail = state.fireTrails[i];
      trail.life -= delta;
      if (trail.life <= 0) {
        scene.remove(trail.mesh);
        (trail.mesh.material as MeshBasicMaterial).dispose();
        trail.mesh.geometry.dispose();
        state.fireTrails.splice(i, 1);
        continue;
      }
      (trail.mesh.material as MeshBasicMaterial).opacity = Math.min(0.6, trail.life / 4.0 * 0.6);

      // Player collision with fire trail
      const dx = Math.abs(state.playerX - trail.x);
      const dy = Math.abs(state.playerY - trail.y);
      if (dx < 0.3 && dy < 0.4 && state.playerPlatformRow === trail.row) {
        playerDeath();
        if ((state.status as string) === 'gameover') return;
        scene.remove(trail.mesh);
        state.fireTrails.splice(i, 1);
      }
    }

    // ─── SPRING ENEMY UPDATE ───
    for (const spring of state.springs) {
      spring.bounceTimer -= delta;
      if (spring.bounceTimer <= 0 && !spring.bouncing) {
        spring.bouncing = true;
        spring.vy = 4.5;
        spring.bounceTimer = 2 + Math.random() * 2;
        playSound('spring_bounce');
      }

      if (spring.bouncing) {
        spring.vy -= GRAVITY * 0.6 * delta;
        spring.y += spring.vy * delta;
        spring.x += spring.direction * 1.5 * delta;

        // Clamp horizontal
        const plat = state.platforms[spring.platformRow];
        if (plat) {
          const minX = (plat.colStart - COLS / 2 + 0.5) * CELL - CELL * 0.3;
          const maxX = (plat.colEnd - COLS / 2 + 0.5) * CELL + CELL * 0.3;
          if (spring.x < minX || spring.x > maxX) {
            spring.direction *= -1;
            spring.x = Math.max(minX, Math.min(maxX, spring.x));
          }
        }

        // Land
        const landY = state.platforms[spring.platformRow].y + PLATFORM_H / 2 + 0.2;
        if (spring.y <= landY && spring.vy < 0) {
          spring.y = landY;
          spring.vy = 0;
          spring.bouncing = false;
        }
      }

      spring.mesh.position.set(spring.x, spring.y, 0);
      // Squash/stretch animation
      if (spring.bouncing) {
        const stretchY = 1 + Math.abs(spring.vy) * 0.05;
        spring.mesh.scale.set(1 / stretchY, stretchY, 1);
      } else {
        spring.mesh.scale.set(1, 1, 1);
      }

      // Collision with player
      const dx = state.playerX - spring.x;
      const dy = state.playerY - spring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PLAYER_R + 0.2) {
        if (state.hasHammer) {
          // Push spring away
          spring.direction *= -1;
          spring.bouncing = true;
          spring.vy = 3;
          addScore(200);
          playSound('smash');
          spawnParticles(scene, spring.x, spring.y, '#ff6600', 8);
        } else {
          playerDeath();
          if ((state.status as string) === 'gameover') return;
        }
      }

      // Jump over spring detection
      if (!state.playerOnGround && state.playerVY < 0 &&
          spring.platformRow === state.playerPlatformRow) {
        const jumpDx = Math.abs(state.playerX - spring.x);
        const jumpDy = state.playerY - spring.y;
        if (jumpDx < 0.8 && jumpDy > 0 && jumpDy < 1.5 && !(spring as any).__jumped) {
          (spring as any).__jumped = true;
          springJumped = true;
          addScore(150);
          checkAchievement('spring_jump');
        }
      }
    }

    // ─── SURVIVE TIMER ACHIEVEMENT ───
    const elapsedLevel = performance.now() / 1000 - levelStartTime;
    if (elapsedLevel >= 60) checkAchievement('survive_60s');

    // ─── BONUS ITEM UPDATE ───
    for (let i = bonusItems.length - 1; i >= 0; i--) {
      const bi = bonusItems[i];
      if (bi.collected) continue;
      bi.life -= delta;
      bi.bobTimer += delta * 3;
      bi.mesh.position.y = bi.y + Math.sin(bi.bobTimer) * 0.08;
      bi.mesh.rotation.y += delta * 2;

      // Flicker when about to expire
      if (bi.life < 2) {
        bi.mesh.visible = Math.sin(bi.life * 12) > 0;
      }

      if (bi.life <= 0) {
        scene.remove(bi.mesh);
        bonusItems.splice(i, 1);
        continue;
      }

      // Collection check
      const dx = state.playerX - bi.x;
      const dy = state.playerY - bi.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === bi.row) {
        bi.collected = true;
        bi.mesh.visible = false;
        scene.remove(bi.mesh);
        bonusItems.splice(i, 1);
        addScore(bi.points);
        playSound('bonus_collect');
        spawnParticles(scene, bi.x, bi.y, '#ffaa00', 8);
        spawnScorePopup(scene, bi.x, bi.y, bi.points);
        bonusCollectedGame++;
        bonusCollectedTotal++;
        if (bonusCollectedGame >= 5) checkAchievement('bonus_5');
        if (bonusCollectedTotal >= 15) checkAchievement('bonus_15');
        saveCareer();
      }
    }

    // ─── LADDER PATROL UPDATE ───
    for (const lp of ladderPatrols) {
      const ladder = state.ladders[lp.ladderIdx];
      if (!ladder) continue;

      lp.y += lp.direction * lp.speed * delta;

      // Reverse at ends
      if (lp.y >= ladder.yTop - 0.1) {
        lp.y = ladder.yTop - 0.1;
        lp.direction = -1;
      }
      if (lp.y <= ladder.yBottom + 0.1) {
        lp.y = ladder.yBottom + 0.1;
        lp.direction = 1;
      }

      lp.mesh.position.set(ladder.x, lp.y, 0.1);
      // Pulsing glow
      lp.mesh.rotation.y = Math.sin(elapsedLevel * 4) * 0.3;

      // Collision with player (only while climbing on the same ladder)
      if (state.playerClimbing) {
        const dx = Math.abs(state.playerX - ladder.x);
        const dy = Math.abs(state.playerY - lp.y);
        if (dx < 0.35 && dy < 0.35) {
          if (state.hasHammer) {
            // Knock it away temporarily
            lp.direction *= -1;
            lp.y += lp.direction * 1.0;
            addScore(250);
            playSound('smash');
            spawnParticles(scene, ladder.x, lp.y, '#ff2200', 8);
            spawnScorePopup(scene, ladder.x, lp.y, 250);
          } else {
            playerDeath();
            if ((state.status as string) === 'gameover') return;
          }
        }
      } else {
        // Track passing a patrol's ladder while on the adjacent platform
        const dx = Math.abs(state.playerX - ladder.x);
        if (dx < 0.5 && (state.playerPlatformRow === ladder.rowTop || state.playerPlatformRow === ladder.rowBottom)) {
          if (!(lp as any).__passed) {
            (lp as any).__passed = true;
            patrolsPassed++;
            if (patrolsPassed >= 3) checkAchievement('patrol_dodge');
          }
        }
      }
    }

    // ─── RIVET COLLECTION ───
    for (let i = rivets.length - 1; i >= 0; i--) {
      const rv = rivets[i];
      if (rv.collected) continue;
      rv.bobTimer += delta * 4;
      rv.mesh.position.y = rv.y + Math.sin(rv.bobTimer) * 0.04;
      rv.mesh.rotation.y += delta * 3;

      const dx = state.playerX - rv.x;
      const dy = state.playerY - rv.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === rv.row) {
        rv.collected = true;
        rv.mesh.visible = false;
        scene.remove(rv.mesh);
        rivets.splice(i, 1);
        rivetsCollectedLevel++;
        addScore(400);
        playSound('rivet_collect');
        spawnParticles(scene, rv.x, rv.y, '#88ccff', 10);
        spawnScorePopup(scene, rv.x, rv.y, 400);
        checkAchievement('rivet_collect');
        if (rivetsCollectedLevel >= rivetsOnLevel && rivetsOnLevel > 0) {
          checkAchievement('rivet_all');
          // Bonus for collecting all rivets
          addScore(1000);
          spawnScorePopup(scene, state.playerX, state.playerY + 0.5, 1000);
        }
      }
    }

    // ─── CRUMBLING PLATFORMS ───
    for (const cp of state.crumblingPlatforms) {
      const plat = state.platforms[cp.row];
      if (!plat) continue;
      const platMat = plat.mesh.material as MeshStandardMaterial;

      if (state.playerPlatformRow === cp.row && state.playerOnGround) {
        // Player is standing on this crumbling platform
        if (!cp.crumbling) {
          cp.crumbling = true;
          cp.timer = 0;
        }
        cp.timer += delta;

        // Visual warning: fade and shake
        const progress = cp.timer / cp.maxTimer;
        platMat.opacity = cp.originalOpacity * (1 - progress * 0.7);
        plat.mesh.position.x += (Math.random() - 0.5) * progress * 0.04;

        if (cp.timer >= cp.maxTimer) {
          // Platform crumbles!
          playSound('crumble');
          spawnParticles(scene, plat.mesh.position.x, plat.y, '#ff8844', 12);
          platMat.opacity = 0.1;
          platMat.emissiveIntensity = 0.1;

          // Player falls
          if (state.playerPlatformRow === cp.row) {
            state.playerOnGround = false;
            state.playerVY = -1;
            // Fall to platform below
            if (cp.row > 0) {
              state.playerPlatformRow = cp.row - 1;
            }
            crumblePlatformsSurvived++;
            if (crumblePlatformsSurvived >= 3) checkAchievement('crumble_survive');
          }
          // Regenerate platform after a delay (mark for regen)
          cp.timer = -3.0; // negative means regenerating
          cp.crumbling = false;
        }
      } else if (cp.crumbling) {
        // Player left the platform, reset timer slowly
        cp.timer = Math.max(0, cp.timer - delta * 0.5);
        if (cp.timer <= 0) {
          cp.crumbling = false;
          platMat.opacity = cp.originalOpacity;
        } else {
          const progress = cp.timer / cp.maxTimer;
          platMat.opacity = cp.originalOpacity * (1 - progress * 0.7);
        }
      } else if (cp.timer < 0) {
        // Regenerating
        cp.timer += delta;
        if (cp.timer >= 0) {
          cp.timer = 0;
          platMat.opacity = cp.originalOpacity;
          platMat.emissiveIntensity = 0.4;
        } else {
          // Gradually restore opacity during regen
          const regenProgress = 1 - Math.abs(cp.timer) / 3.0;
          platMat.opacity = 0.1 + regenProgress * (cp.originalOpacity - 0.1);
        }
      }
    }

    // ─── WARP PORTALS ───
    for (const wp of warpPortals) {
      wp.spinTimer += delta * 3;
      wp.mesh.rotation.y = wp.spinTimer;
      // Pulsing glow
      const pulseScale = 1 + Math.sin(wp.spinTimer * 2) * 0.1;
      wp.mesh.scale.set(pulseScale, pulseScale, pulseScale);

      if (wp.cooldown > 0) {
        wp.cooldown -= delta;
        wp.mesh.children[1].visible = wp.cooldown <= 0; // hide inner glow when on cooldown
        continue;
      }

      const dx = state.playerX - wp.x;
      const dy = state.playerY - wp.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === wp.row && state.playerOnGround) {
        // Teleport to paired portal
        const target = warpPortals[wp.pairIdx];
        if (target && target.cooldown <= 0) {
          spawnParticles(scene, state.playerX, state.playerY, '#ff44ff', 10);
          state.playerX = target.x;
          state.playerY = target.y + 0.1;
          state.playerPlatformRow = target.row;
          state.playerOnGround = true;
          state.playerVY = 0;
          state.playerClimbing = false;
          playSound('warp');
          spawnParticles(scene, target.x, target.y, '#44ffff', 10);
          // Set cooldown on both portals
          wp.cooldown = 3;
          target.cooldown = 3;
          checkAchievement('warp_use');
          addScore(50);
        }
      }
    }

    // ─── EXTRA LIFE PICKUP ───
    for (let i = extraLives.length - 1; i >= 0; i--) {
      const el = extraLives[i];
      if (!el.active) continue;
      el.bobTimer += delta * 3;
      el.pulseTimer += delta * 4;
      el.mesh.position.y = el.y + Math.sin(el.bobTimer) * 0.08;
      el.mesh.rotation.y += delta * 2;
      // Heartbeat pulse
      const pulse = 1 + Math.sin(el.pulseTimer) * 0.15;
      el.mesh.scale.set(pulse, pulse, pulse);

      const dx = state.playerX - el.x;
      const dy = state.playerY - el.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === el.row) {
        el.active = false;
        el.mesh.visible = false;
        scene.remove(el.mesh);
        extraLives.splice(i, 1);
        state.lives++;
        playSound('extra_life');
        spawnParticles(scene, el.x, el.y, '#ff3366', 15);
        spawnScorePopup(scene, el.x, el.y, 0);
        checkAchievement('extra_life');
      }
    }

    // ─── MAGNET POWER-UP PICKUP ───
    for (let i = magnetPickups.length - 1; i >= 0; i--) {
      const mp = magnetPickups[i];
      if (!mp.active) continue;
      mp.bobTimer += delta * 4;
      mp.mesh.position.y = mp.y + Math.sin(mp.bobTimer) * 0.06;
      mp.mesh.rotation.y += delta * 3;
      const dx = state.playerX - mp.x;
      const dy = state.playerY - mp.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === mp.row) {
        mp.active = false;
        mp.mesh.visible = false;
        scene.remove(mp.mesh);
        magnetPickups.splice(i, 1);
        state.hasMagnet = true;
        state.magnetTimer = 8;
        playSound('magnet_get');
        spawnParticles(scene, mp.x, mp.y, '#ff4444', 10);
        checkAchievement('magnet_collect');
      }
    }

    // ─── MAGNET EFFECT ───
    if (state.hasMagnet) {
      state.magnetTimer -= delta;
      if (state.magnetTimer <= 0) {
        state.hasMagnet = false;
      } else {
        const magnetRange = 3.0;
        // Attract gems
        for (const bi of bonusItems) {
          if (bi.collected) continue;
          const dx = state.playerX - bi.x;
          const dy = state.playerY - bi.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < magnetRange && dist > 0.1) {
            const pullStr = (1 - dist / magnetRange) * 4 * delta;
            bi.x += (dx / dist) * pullStr;
            bi.y += (dy / dist) * pullStr;
            bi.mesh.position.set(bi.x, bi.y + Math.sin(bi.bobTimer) * 0.08, 0.15);
          }
        }
        // Attract rivets
        for (const rv of rivets) {
          if (rv.collected) continue;
          const dx = state.playerX - rv.x;
          const dy = state.playerY - rv.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < magnetRange && dist > 0.1) {
            const pullStr = (1 - dist / magnetRange) * 4 * delta;
            rv.x += (dx / dist) * pullStr;
            rv.y += (dy / dist) * pullStr;
            rv.mesh.position.set(rv.x, rv.y + Math.sin(rv.bobTimer) * 0.04, 0.12);
          }
        }
      }
    }

    // ─── SCORE MULTIPLIER PICKUP ───
    for (let i = scoreMultipliers.length - 1; i >= 0; i--) {
      const sm = scoreMultipliers[i];
      if (!sm.active) continue;
      sm.bobTimer += delta * 3;
      sm.mesh.position.y = sm.y + Math.sin(sm.bobTimer) * 0.06;
      sm.mesh.rotation.y += delta * 4;
      const dx = state.playerX - sm.x;
      const dy = state.playerY - sm.y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.5 && state.playerPlatformRow === sm.row) {
        sm.active = false;
        sm.mesh.visible = false;
        scene.remove(sm.mesh);
        scoreMultipliers.splice(i, 1);
        state.hasMultiplier = true;
        state.multiplierTimer = 10;
        playSound('multiplier_get');
        spawnParticles(scene, sm.x, sm.y, '#ffdd00', 12);
        checkAchievement('multiplier_collect');
      }
    }

    // ─── MULTIPLIER TIMER ───
    if (state.hasMultiplier) {
      state.multiplierTimer -= delta;
      if (state.multiplierTimer <= 0) {
        state.hasMultiplier = false;
      }
    }

    // ─── BOSS SHOCKWAVE ATTACK ───
    if (state.isBossLevel) {
      state.bossShockwaveTimer -= delta;
      if (state.bossShockwaveTimer <= 0) {
        // Kong slams the ground, creating a shockwave
        state.bossShockwaveTimer = 3.5 - Math.min(1.5, state.level * 0.05);
        playSound('shockwave');
        state.shakeTimer = 0.3;
        state.shakeIntensity = 0.12;
        // Create expanding ring shockwave from Kong's position
        const swY = state.platforms[ROWS - 1].y;
        const swGeo = new CylinderGeometry(0.3, 0.3, 0.08, 16);
        const swMat = new MeshBasicMaterial({
          color: new Color(SCHEMES[state.scheme].accent),
          transparent: true,
          opacity: 0.7,
        });
        const swMesh = new Mesh(swGeo, swMat);
        swMesh.position.set(state.kongX, swY, 0.2);
        scene.add(swMesh);
        shockwaves.push({ mesh: swMesh, radius: 0.3, maxRadius: 8, life: 1.2, y: swY });
      }
    }

    // ─── SHOCKWAVE UPDATE ───
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.life -= delta;
      if (sw.life <= 0) {
        scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as MeshBasicMaterial).dispose();
        shockwaves.splice(i, 1);
        continue;
      }
      sw.radius += delta * 6;
      sw.mesh.scale.set(sw.radius / 0.3, 1, sw.radius / 0.3);
      (sw.mesh.material as MeshBasicMaterial).opacity = (sw.life / 1.2) * 0.7;
      // Move shockwave downward through platforms
      sw.mesh.position.y -= delta * 3;

      // Player collision with shockwave
      const dx = state.playerX - sw.mesh.position.x;
      const dy = state.playerY - sw.mesh.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Shockwave hits if player is within the ring and on the ground
      if (dist < sw.radius * 1.2 && dist > sw.radius * 0.6 &&
          Math.abs(dy) < 1.2 && state.playerOnGround) {
        playerDeath();
        if ((state.status as string) === 'gameover') return;
        // Remove shockwave after hit
        scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as MeshBasicMaterial).dispose();
        shockwaves.splice(i, 1);
        break;
      }
    }

    // ─── SCORE POPUPS ───
    updateScorePopups(scene, delta);

    // ─── SCREEN SHAKE ───
    if (state.shakeTimer > 0) {
      state.shakeTimer -= delta;
      const shakeX = (Math.random() - 0.5) * state.shakeIntensity * 2;
      const shakeY = (Math.random() - 0.5) * state.shakeIntensity * 2;
      const world = (window as any).__nkWorld;
      if (world?.camera) {
        world.camera.position.set(cameraBasePos.x + shakeX, cameraBasePos.y + shakeY, cameraBasePos.z);
      }
    } else {
      const world = (window as any).__nkWorld;
      if (world?.camera && !state.playerClimbing) {
        world.camera.position.set(cameraBasePos.x, cameraBasePos.y, cameraBasePos.z);
      }
    }

    // ─── CHECK LEVEL CLEAR ───
    const topPlat = state.platforms[ROWS - 1];
    if (state.playerPlatformRow === ROWS - 1 && state.playerOnGround) {
      const dx = Math.abs(state.playerX - state.rescueX);
      if (dx < 1.0) {
        levelClear();
      }
    }

    // ─── UPDATE MESHES ───
    playerMesh.position.set(state.playerX, state.playerY, 0);
    playerMesh.scale.x = state.playerFacing;

    // Player shield glow effect
    if (state.hasShield) {
      // Pulse the player mesh slightly
      const pulse = 1 + Math.sin(this.kongAnimTimer * 8) * 0.05;
      playerMesh.scale.y = pulse;
      playerMesh.scale.z = pulse;
    } else {
      playerMesh.scale.y = 1;
      playerMesh.scale.z = 1;
    }

    // Kong animation - barrel throwing motion
    this.kongAnimTimer += delta;
    kongMesh.position.y = state.kongY + Math.sin(this.kongAnimTimer * 2) * 0.1;
    // Kong arm raises when about to throw
    const throwPhase = state.barrelSpawnTimer < 0.5 ? Math.sin((0.5 - state.barrelSpawnTimer) * Math.PI * 4) * 0.3 : 0;
    kongMesh.rotation.y = Math.sin(this.kongAnimTimer * 0.5) * 0.15;
    kongMesh.rotation.x = throwPhase;

    // Rescue bob
    rescueMesh.position.y = state.rescueY + Math.sin(this.kongAnimTimer * 3) * 0.05;

    // Ambient orb drift
    this.orbTimer += delta;
    if (environmentGroup) {
      environmentGroup.children.forEach((child, idx) => {
        if (child instanceof Mesh && (child.material as any).opacity !== undefined) {
          const m = child.material as MeshBasicMaterial;
          if (m.opacity < 0.7) {
            child.position.y += Math.sin(this.orbTimer * 0.5 + idx * 0.3) * delta * 0.1;
          }
        }
      });
    }

    // Particles
    updateParticles(scene, delta);

    // Afterimages
    updateAfterimages(scene, delta);
  }
}

// ─── UI SYSTEM ───
class UISystem extends createSystem({
  menuPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
  hudPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  pausePanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  resultsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/results.json')] },
  settingsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  achievementsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achievements.json')] },
  statsPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
  tutorialPanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/tutorial.json')] },
}) {
  private menuDoc: UIKitDocument | null = null;
  private hudDoc: UIKitDocument | null = null;
  private pauseDoc: UIKitDocument | null = null;
  private resultsDoc: UIKitDocument | null = null;
  private settingsDoc: UIKitDocument | null = null;
  private achievementsDoc: UIKitDocument | null = null;
  private statsDoc: UIKitDocument | null = null;
  private tutorialDoc: UIKitDocument | null = null;
  private achPage = 0;

  private getDoc(entity: any): UIKitDocument | null {
    return (entity.getValue(PanelDocument, 'document') as UIKitDocument) || null;
  }

  private setText(doc: UIKitDocument | null, id: string, text: string) {
    if (!doc) return;
    const el = doc.getElementById(id) as UIKit.Text | undefined;
    el?.setProperties({ text });
  }

  private setVis(doc: UIKitDocument | null, id: string, visible: boolean) {
    if (!doc) return;
    const el = doc.getElementById(id) as UIKit.Text | undefined;
    el?.setProperties({ visibility: visible ? 'visible' : 'hidden' });
  }

  init() {
    // Menu
    this.queries.menuPanel.subscribe('qualify', (entity) => {
      this.menuDoc = this.getDoc(entity);
      if (!this.menuDoc) return;
      const btnStart = this.menuDoc.getElementById('btn-start') as UIKit.Text;
      btnStart?.addEventListener('click', () => { state.mode = 'arcade'; startGame(); });
      const btnSpeed = this.menuDoc.getElementById('btn-speed') as UIKit.Text;
      btnSpeed?.addEventListener('click', () => { state.mode = 'speed'; startGame(); });
      const btnZen = this.menuDoc.getElementById('btn-zen') as UIKit.Text;
      btnZen?.addEventListener('click', () => { state.mode = 'zen'; state.lives = 99; startGame(); });
      const btnChallenge = this.menuDoc.getElementById('btn-challenge') as UIKit.Text;
      btnChallenge?.addEventListener('click', () => { state.mode = 'challenge'; startGame(); });
      const btnSettings = this.menuDoc.getElementById('btn-settings') as UIKit.Text;
      btnSettings?.addEventListener('click', () => { state.status = 'settings'; });
      const btnAchievements = this.menuDoc.getElementById('btn-achievements') as UIKit.Text;
      btnAchievements?.addEventListener('click', () => { state.status = 'achievements'; });
      const btnStats = this.menuDoc.getElementById('btn-stats') as UIKit.Text;
      btnStats?.addEventListener('click', () => { state.status = 'stats'; });
      const btnTutorial = this.menuDoc.getElementById('btn-tutorial') as UIKit.Text;
      btnTutorial?.addEventListener('click', () => { state.status = 'tutorial'; });
    });

    // HUD — no buttons, just text updates in update()

    // Pause
    this.queries.pausePanel.subscribe('qualify', (entity) => {
      this.pauseDoc = this.getDoc(entity);
      if (!this.pauseDoc) return;
      const btnResume = this.pauseDoc.getElementById('btn-resume') as UIKit.Text;
      btnResume?.addEventListener('click', () => { state.status = 'playing'; });
      const btnQuit = this.pauseDoc.getElementById('btn-quit') as UIKit.Text;
      btnQuit?.addEventListener('click', () => { state.status = 'menu'; stopMusic(); });
    });

    // Results
    this.queries.resultsPanel.subscribe('qualify', (entity) => {
      this.resultsDoc = this.getDoc(entity);
      if (!this.resultsDoc) return;
      const btnRetry = this.resultsDoc.getElementById('btn-retry') as UIKit.Text;
      btnRetry?.addEventListener('click', () => startGame());
      const btnMenu = this.resultsDoc.getElementById('btn-menu') as UIKit.Text;
      btnMenu?.addEventListener('click', () => { state.status = 'menu'; });
    });

    // Settings
    this.queries.settingsPanel.subscribe('qualify', (entity) => {
      this.settingsDoc = this.getDoc(entity);
      if (!this.settingsDoc) return;
      const schemes = ['cyan', 'green', 'magenta', 'gold'];
      for (const s of schemes) {
        const btn = this.settingsDoc.getElementById('btn-' + s) as UIKit.Text;
        btn?.addEventListener('click', () => { state.scheme = s; });
      }
      const diffs = ['normal', 'hard', 'insane'];
      for (const d of diffs) {
        const btn = this.settingsDoc.getElementById('btn-' + d) as UIKit.Text;
        btn?.addEventListener('click', () => { state.difficulty = d; });
      }
      const btnBack = this.settingsDoc.getElementById('btn-back') as UIKit.Text;
      btnBack?.addEventListener('click', () => { state.status = 'menu'; });
    });

    // Achievements
    this.queries.achievementsPanel.subscribe('qualify', (entity) => {
      this.achievementsDoc = this.getDoc(entity);
      if (!this.achievementsDoc) return;
      const btnPrev = this.achievementsDoc.getElementById('btn-prev') as UIKit.Text;
      btnPrev?.addEventListener('click', () => { this.achPage = Math.max(0, this.achPage - 1); });
      const btnNext = this.achievementsDoc.getElementById('btn-next') as UIKit.Text;
      btnNext?.addEventListener('click', () => { this.achPage = Math.min(Math.floor((ALL_ACHIEVEMENTS.length - 1) / 5), this.achPage + 1); });
      const btnBack = this.achievementsDoc.getElementById('btn-ach-back') as UIKit.Text;
      btnBack?.addEventListener('click', () => { state.status = 'menu'; });
    });

    // Stats
    this.queries.statsPanel.subscribe('qualify', (entity) => {
      this.statsDoc = this.getDoc(entity);
      if (!this.statsDoc) return;
      const btnBack = this.statsDoc.getElementById('btn-stats-back') as UIKit.Text;
      btnBack?.addEventListener('click', () => { state.status = 'menu'; });
    });

    // Tutorial
    this.queries.tutorialPanel.subscribe('qualify', (entity) => {
      this.tutorialDoc = this.getDoc(entity);
      if (!this.tutorialDoc) return;
      const btnBack = this.tutorialDoc.getElementById('btn-tut-back') as UIKit.Text;
      btnBack?.addEventListener('click', () => { state.status = 'menu'; });
    });
  }

  update(_delta: number, _time: number) {
    const isMenu = state.status === 'menu';
    const isPlaying = state.status === 'playing';
    const isPaused = state.status === 'paused';
    const isGameover = state.status === 'gameover';
    const isSettings = state.status === 'settings';
    const isAchievements = state.status === 'achievements';
    const isStats = state.status === 'stats';
    const isTutorial = state.status === 'tutorial';

    // Panel visibility via transform
    this.queries.menuPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 2 : 0, isMenu ? 2 : 0, isMenu ? 2 : 0); });
    this.queries.hudPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isPlaying ? 1.5 : 0, isPlaying ? 1.5 : 0, isPlaying ? 1.5 : 0); });
    this.queries.pausePanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isPaused ? 2 : 0, isPaused ? 2 : 0, isPaused ? 2 : 0); });
    this.queries.resultsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isGameover ? 2 : 0, isGameover ? 2 : 0, isGameover ? 2 : 0); });
    this.queries.settingsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isSettings ? 1.5 : 0, isSettings ? 1.5 : 0, isSettings ? 1.5 : 0); });
    this.queries.achievementsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isAchievements ? 1.5 : 0, isAchievements ? 1.5 : 0, isAchievements ? 1.5 : 0); });
    this.queries.statsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isStats ? 1.5 : 0, isStats ? 1.5 : 0, isStats ? 1.5 : 0); });
    this.queries.tutorialPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isTutorial ? 1.5 : 0, isTutorial ? 1.5 : 0, isTutorial ? 1.5 : 0); });

    // Update HUD
    if (isPlaying && this.hudDoc) {
      this.setText(this.hudDoc, 'score-val', String(state.score));
      this.setText(this.hudDoc, 'lives-val', 'x' + state.lives);
      this.setText(this.hudDoc, 'level-val', 'LV ' + state.level);
      this.setText(this.hudDoc, 'combo-val', state.combo > 1 ? state.combo + 'x' : '');
      if (state.mode === 'speed') {
        this.setText(this.hudDoc, 'timer-val', Math.ceil(state.timeRemaining) + 's');
      } else if (state.mode === 'challenge') {
        this.setText(this.hudDoc, 'timer-val', Math.ceil(state.movesRemaining) + ' moves');
      } else {
        this.setText(this.hudDoc, 'timer-val', '');
      }
      this.setText(this.hudDoc, 'hammer-val', state.hasHammer ? 'HAMMER ' + Math.ceil(state.hammerTimer) + 's' : '');
      this.setText(this.hudDoc, 'shield-val', state.hasShield ? 'SHIELD x' + state.shieldHitsLeft : '');
      this.setText(this.hudDoc, 'speed-val', state.hasSpeedBoost ? 'TURBO ' + Math.ceil(state.speedBoostTimer) + 's' : '');
      this.setText(this.hudDoc, 'magnet-val', state.hasMagnet ? 'MAGNET ' + Math.ceil(state.magnetTimer) + 's' : '');
      this.setText(this.hudDoc, 'mult-val', state.hasMultiplier ? '2x SCORE ' + Math.ceil(state.multiplierTimer) + 's' : '');
      this.setText(this.hudDoc, 'boss-val', state.isBossLevel ? '!! BOSS LEVEL !!' : '');
    }

    // Update menu high score
    if (isMenu && this.menuDoc) {
      this.setText(this.menuDoc, 'high-score', 'Best: ' + state.highScore);
    }

    // Update results
    if (isGameover && this.resultsDoc) {
      this.setText(this.resultsDoc, 'final-score', 'Score: ' + state.score);
      this.setText(this.resultsDoc, 'final-level', 'Level: ' + state.level);
      this.setText(this.resultsDoc, 'final-barrels', 'Smashed: ' + state.barrelsSmashed + '  Jumped: ' + state.barrelsJumped);
      this.setText(this.resultsDoc, 'final-combo', state.careerBestCombo > 1 ? 'Best Combo: ' + state.careerBestCombo + 'x' : '');
      this.setText(this.resultsDoc, 'final-best', 'Best: ' + state.highScore);
      this.setText(this.resultsDoc, 'new-high', state.score >= state.highScore && state.score > 0 ? 'NEW HIGH SCORE!' : '');
    }

    // Update achievements
    if (this.achievementsDoc) {
      const start = this.achPage * 5;
      for (let i = 0; i < 5; i++) {
        const ach = ALL_ACHIEVEMENTS[start + i];
        if (ach) {
          const unlocked = state.achievements.has(ach.id);
          this.setText(this.achievementsDoc, 'ach-' + i, (unlocked ? '[*] ' : '[ ] ') + ach.name);
          this.setText(this.achievementsDoc, 'ach-desc-' + i, ach.desc);
        } else {
          this.setText(this.achievementsDoc, 'ach-' + i, '');
          this.setText(this.achievementsDoc, 'ach-desc-' + i, '');
        }
      }
      this.setText(this.achievementsDoc, 'ach-page', (this.achPage + 1) + '/' + (Math.floor((ALL_ACHIEVEMENTS.length - 1) / 5) + 1));
      this.setText(this.achievementsDoc, 'ach-count', state.achievements.size + '/' + ALL_ACHIEVEMENTS.length);
    }

    // Update stats
    if (this.statsDoc) {
      this.setText(this.statsDoc, 'stat-games', String(state.careerGames));
      this.setText(this.statsDoc, 'stat-smashed', String(state.careerSmashed));
      this.setText(this.statsDoc, 'stat-jumped', String(state.careerJumped));
      this.setText(this.statsDoc, 'stat-levels', String(state.careerLevels));
      this.setText(this.statsDoc, 'stat-deaths', String(state.careerDeaths));
      this.setText(this.statsDoc, 'stat-hammers', String(state.careerHammers));
      this.setText(this.statsDoc, 'stat-best-score', String(state.careerBestScore));
      this.setText(this.statsDoc, 'stat-best-level', String(state.careerBestLevel));
      this.setText(this.statsDoc, 'stat-best-combo', String(state.careerBestCombo));
    }
  }
}

main();
