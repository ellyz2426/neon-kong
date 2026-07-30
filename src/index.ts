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

interface GameState {
  mode: string;
  difficulty: string;
  scheme: string;
  status: 'menu' | 'playing' | 'paused' | 'gameover' | 'results';
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
];

let state: GameState;
let levelStartTime = 0;
let levelDeathCount = 0;
let levelBarrelCount = 0;
let modesPlayed = new Set<string>();
let kongMesh: Group;
let playerMesh: Group;
let hammerMesh: Group | null = null;
let rescueMesh: Group;
let barrelGroup: Group;
let environmentGroup: Group;

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

  musicOsc1 = audioCtx.createOscillator();
  musicOsc1.type = 'sine';
  musicOsc1.frequency.setValueAtTime(55, audioCtx.currentTime);
  musicOsc1.connect(musicGain);
  musicOsc1.start();

  musicOsc2 = audioCtx.createOscillator();
  musicOsc2.type = 'triangle';
  musicOsc2.frequency.setValueAtTime(110, audioCtx.currentTime);
  const g2 = audioCtx.createGain();
  g2.gain.setValueAtTime(0.02, audioCtx.currentTime);
  musicOsc2.connect(g2);
  g2.connect(audioCtx.destination);
  musicOsc2.start();
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
    careerGames: career.careerGames || 0,
    careerSmashed: career.careerSmashed || 0,
    careerJumped: career.careerJumped || 0,
    careerLevels: career.careerLevels || 0,
    careerDeaths: career.careerDeaths || 0,
    careerHammers: career.careerHammers || 0,
    careerBestScore: career.careerBestScore || 0,
    careerBestLevel: career.careerBestLevel || 0,
    careerBestCombo: career.careerBestCombo || 0,
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
  state.barrels = [];

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
}

function spawnBarrel() {
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  const mesh = createBarrelMesh(scene);
  const topPlat = state.platforms[ROWS - 1];
  const x = state.kongX;
  const y = topPlat.y + PLATFORM_H / 2 + BARREL_R;

  mesh.position.set(x, y, 0);

  const diffMult = state.difficulty === 'insane' ? 1.6 : state.difficulty === 'hard' ? 1.3 : 1.0;
  const direction = Math.random() > 0.5 ? 1 : -1;

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
  levelBarrelCount++;
}

function addScore(points: number) {
  state.combo++;
  state.comboTimer = 3;
  const mult = Math.min(state.combo, 8);
  state.score += points * mult;
  if (mult >= 3) { checkAchievement('combo_3'); playSound('combo'); }
  if (mult >= 5) checkAchievement('combo_5');
  if (mult >= 8) checkAchievement('combo_8');
  if (state.combo > state.careerBestCombo) state.careerBestCombo = state.combo;
  if (state.score > state.highScore) state.highScore = state.score;
  if (state.score > state.careerBestScore) state.careerBestScore = state.score;
  if (state.score >= 5000) checkAchievement('score_5k');
  if (state.score >= 10000) checkAchievement('score_10k');
  if (state.score >= 25000) checkAchievement('score_25k');
}

function playerDeath() {
  playSound('death');
  const scene = (window as any).__nkScene as import('@iwsdk/core').Scene;
  spawnParticles(scene, state.playerX, state.playerY, SCHEMES[state.scheme].primary, 15);

  state.lives--;
  state.careerDeaths++;
  levelDeathCount++;
  state.hasHammer = false;
  state.hammerTimer = 0;
  state.combo = 0;

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
  if (state.level > state.careerBestLevel) state.careerBestLevel = state.level;

  if (levelDeathCount === 0) checkAchievement('no_death');
  const elapsed = performance.now() / 1000 - levelStartTime;
  if (elapsed < 30) checkAchievement('speed_clear');
  if (levelBarrelCount > 0 && state.barrelsSmashed >= levelBarrelCount) checkAchievement('perfect_level');

  if (state.difficulty === 'hard' && state.level === 1) checkAchievement('hard_clear');
  if (state.difficulty === 'insane' && state.level === 1) checkAchievement('insane_clear');

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

  update(delta: number, _time: number) {
    if (state.status !== 'playing') {
      // Hide game objects when not playing
      playerMesh.visible = state.status !== 'menu';
      kongMesh.visible = state.status !== 'menu';
      rescueMesh.visible = state.status !== 'menu';
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
      if (state.comboTimer <= 0) state.combo = 0;
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
      if (moveX !== 0) {
        state.playerX += moveX * MOVE_SPEED * delta;
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
        playSound('hammer_get');
        checkAchievement('hammer_collect');
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
    const spawnInterval = Math.max(BARREL_SPAWN_INTERVAL_MIN,
      BARREL_SPAWN_INTERVAL_BASE - state.level * 0.1) / diffMult;
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

    // Kong animation
    this.kongAnimTimer += delta;
    kongMesh.position.y = state.kongY + Math.sin(this.kongAnimTimer * 2) * 0.1;
    kongMesh.rotation.y = Math.sin(this.kongAnimTimer * 0.5) * 0.15;

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
      btnSettings?.addEventListener('click', () => { state.status = 'menu'; });
      const btnTutorial = this.menuDoc.getElementById('btn-tutorial') as UIKit.Text;
      btnTutorial?.addEventListener('click', () => { state.status = 'menu'; });
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

    // Panel visibility via transform
    this.queries.menuPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 2 : 0, isMenu ? 2 : 0, isMenu ? 2 : 0); });
    this.queries.hudPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isPlaying ? 1.5 : 0, isPlaying ? 1.5 : 0, isPlaying ? 1.5 : 0); });
    this.queries.pausePanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isPaused ? 2 : 0, isPaused ? 2 : 0, isPaused ? 2 : 0); });
    this.queries.resultsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isGameover ? 2 : 0, isGameover ? 2 : 0, isGameover ? 2 : 0); });
    this.queries.settingsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 1.5 : 0, isMenu ? 1.5 : 0, isMenu ? 1.5 : 0); });
    this.queries.achievementsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 1.5 : 0, isMenu ? 1.5 : 0, isMenu ? 1.5 : 0); });
    this.queries.statsPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 0 : 0, isMenu ? 0 : 0, isMenu ? 0 : 0); });
    this.queries.tutorialPanel.entities.forEach(e => { if (e.object3D) e.object3D.scale.set(isMenu ? 0 : 0, isMenu ? 0 : 0, isMenu ? 0 : 0); });

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
      this.setText(this.resultsDoc, 'final-best', 'Best: ' + state.highScore);
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
