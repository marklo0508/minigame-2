// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Play,
  RotateCw,
  Pause,
  Volume2,
  VolumeX,
  Zap,
  Shield,
  Heart,
  Info,
  X,
  Sparkles,
  Trophy,
  Menu,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Download,
  CheckSquare,
  Square,
  Tag,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {getConfig, THEME} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawAsset,
  formatTime,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
  gameAudio,
  clamp,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// --- BACKGROUND MUSIC ---
const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_ocean_danger.mp3';

// --- ASSET MANIFEST ---
const ASSETS_MANIFEST: Record<string, string> = {
  player: 'assets/images/player_sea_turtle.png',
  hazard_bag: 'assets/images/hazard_plastic_bag.png',
  hazard_bottle: 'assets/images/hazard_glass_bottle.png',
  hazard_straw: 'assets/images/hazard_plastic_straw.png',
  hazard_net: 'assets/images/hazard_ghost_net.png',
  item_shield: 'assets/images/item_bubble_shield.png',
  item_jellyfish: 'assets/images/item_golden_jellyfish.png',
  safe_passage: 'assets/images/item_safe_passage.png',
  ui_heart: 'assets/images/ui_heart_icon.png',
};

// --- TYPES & INTERFACES ---
type HazardType = 'BAG' | 'BOTTLE' | 'STRAW' | 'NET';
type ItemType = 'SHIELD' | 'JELLYFISH';

interface Hazard {
  id: string;
  type: HazardType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  baseX?: number;
  waveTimer?: number;
  waveFreq?: number;
  waveAmp?: number;
  gapX?: number;
  gapWidth?: number;
  warningTimer?: number;
  ready?: boolean;
}

interface Item {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  bobTimer: number;
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  glow?: boolean;
}

interface WarningBeacon {
  x: number;
  y: number;
  width: number;
  type: HazardType;
  timer: number;
  maxTimer: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface Floater {
  id: string;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

// Environmental Eco Pledges
const ECO_ACTIONS = [
  { id: 'bag', emoji: '🛍️', text: '自備環保購物袋，少用一次性膠袋' },
  { id: 'straw', emoji: '🥤', text: '使用不鏽鋼或環保飲管，拒絕塑膠吸管' },
  { id: 'bottle', emoji: '🧴', text: '自備水樽隨身攜帶，少買瓶裝塑膠水' },
  { id: 'recycle', emoji: '♻️', text: '落實垃圾分類與清潔回收，不讓垃圾流入大海' },
  { id: 'beach', emoji: '🏖️', text: '前往海灘遊玩親近自然，隨手帶走所有垃圾' },
  { id: 'cleanup', emoji: '🧹', text: '踴躍參與海岸淨灘與海洋保育行動' },
  { id: 'tell', emoji: '📣', text: '向家人與同學朋友宣導海龜保護知識' },
  { id: 'sewage', emoji: '🚯', text: '支持污水妥善處理，杜絕有害廢棄物排放' },
];

// Marine Knowledge Encyclopedia
const KNOWLEDGE_ITEMS = [
  {
    emoji: '🐢',
    title: '綠蠵龜（小海龜）',
    category: '守護對象',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    desc: '海龜是地球上生存超過一億年的古老海洋爬蟲類。牠們主要以水母、海草和甲殼類為食，對維持珊瑚礁與海洋生態系統的健康扮演不可或缺的關鍵角色。海龜需要浮出水面用肺呼吸，極易遭受海洋漂浮廢棄物威脅。',
  },
  {
    emoji: '🛍️',
    title: '漂浮塑膠袋',
    category: '致命陷阱',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    desc: '在海洋深處漂浮的透明塑膠袋，其半透明的波浪外觀與水母極其相似！海龜經常將塑膠袋誤認為美味的水母並吞下。塑膠袋在海龜胃中無法被分解消化，會堵塞消化道導致海龜產生虛假飽腹感而飢餓衰竭致死。',
  },
  {
    emoji: '🥤',
    title: '塑膠飲管束',
    category: '尖銳危害',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    desc: '一次性塑膠吸管質地堅硬、邊緣尖銳且極難在自然界降解。隨洋流漂移的塑膠吸管很容易隨水流刺入海龜脆弱的鼻腔或呼吸道中，引起劇烈感染出血，嚴重威脅海龜的生命。自備不鏽鋼或矽膠飲管是保護海龜的簡單良方。',
  },
  {
    emoji: '🍾',
    title: '沉底玻璃瓶',
    category: '銳利重物',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    desc: '人類遺留在海灘或拋入海中的玻璃容器沉降於海底。受海浪與岩石衝擊破裂後，鋒利的玻璃碎片會嚴重割傷海龜柔軟的腹甲、頭部與游動腳蹼，造成無法癒合的深層傷口。到海邊請務必帶走自己的玻璃製品。',
  },
  {
    emoji: '🕸️',
    title: '幽靈廢棄漁網',
    category: '致命流刺網',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    desc: '被遺棄或失落於汪洋中的合成纖維漁網被稱為「海洋幽靈殺手」。這些堅韌的網具大範圍漂流，會無差別死死纏繞海龜的四肢與甲殼。海龜被纏住後無法浮出水面換氣，往往在恐慌與掙扎中不幸溺斃。',
  },
  {
    emoji: '🫧',
    title: '潔淨泡泡護盾',
    category: '海洋庇護',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    desc: '象徵充滿活力、富含充沛氧氣的純淨海域。在遊戲中為小海龜提供一次堅不可摧的水晶氧氣氣泡障壁，抵禦海洋垃圾的直接衝擊。潔淨的水質是海龜與全人類共享的美麗寶藏。',
  },
  {
    emoji: '✨',
    title: '發光黃金水母',
    category: '天然食糧',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    desc: '海龜在大自然中喜愛且健康的純天然主食！食用無污染的天然水母能給予小海龜豐富的能量補給與活力，在遊戲中激發小海龜游速加成與高額庇護積分獎勵。',
  },
];

// Interactive Quiz Questions
const QUIZ_ITEMS = [
  {
    q: '小海龜為甚麼最容易將海洋中的塑膠袋誤吞下肚？',
    options: [
      '塑膠袋散發出海龜喜愛的香味',
      '塑膠袋在海中漂浮的姿態與海龜的主食「水母」極其相似',
      '塑膠袋有助於海龜磨亮牙齒',
    ],
    answer: 1,
    explain: '正確！半透明的塑膠袋在海水中隨波逐流，外觀與觸感都像極了水母，因此海龜容易誤食釀成悲劇。',
  },
  {
    q: '廢棄的「幽靈漁網」對海洋生物最致命的危險是甚麼？',
    options: [
      '漁網會纏住海龜使其無法游至水面換氣呼吸，導致溺水死亡',
      '漁網會讓海水變得太溫暖',
      '漁網會遮擋海底所有陽光',
    ],
    answer: 0,
    explain: '正確！海龜是用肺呼吸的海洋爬行動物，被幽靈漁網纏住後若無法及時浮上海面呼吸，便會活活溺斃。',
  },
  {
    q: '在日常生活中，我們每個人最能立即落實的保護海洋行動是？',
    options: [
      '盡量多買瓶裝水和一次性塑膠餐具',
      '自備環保購物袋與水樽、拒用塑膠吸管，去海灘遊玩帶走所有垃圾',
      '將塑膠垃圾埋在沙灘裡不用管',
    ],
    answer: 1,
    explain: '太棒了！源頭減塑（減少使用一次性塑膠）並在海灘落實垃圾不落地，就能直接減少海洋垃圾的威脅！',
  },
];

/**
 * Draws a clean, high-contrast Traditional Chinese badge pill label under an object
 */
function drawBadgeLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bgColor = 'rgba(255, 255, 255, 0.95)',
  textColor = '#0f172a',
  fontSize = 12,
  borderColor = 'rgba(0, 0, 0, 0.15)',
) {
  ctx.save();
  ctx.font = `bold ${fontSize}px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const padX = 7;
  const padY = 3.5;
  const bw = metrics.width + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = x - bw / 2;
  const by = y - bh / 2;
  const r = bh / 2;

  // Subtle drop shadow for readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bx, by, bw, bh, r);
  } else {
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
  }
  ctx.fill();

  if (borderColor) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/**
 * Generates an authentic high-resolution Canvas Certificate PNG and triggers file download
 */
function generateCertificatePNG(
  name: string,
  className: string,
  pledges: { id: string; emoji: string; text: string }[],
  score: number,
  survivalSeconds: number,
) {
  const cw = 1200;
  const ch = 900;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background Parchment
  ctx.fillStyle = '#fefcf5';
  ctx.fillRect(0, 0, cw, ch);

  // Outer Gold Border
  ctx.strokeStyle = '#c8a35a';
  ctx.lineWidth = 12;
  ctx.strokeRect(36, 36, cw - 72, ch - 72);

  // Inner Subtle Border
  ctx.strokeStyle = 'rgba(200, 163, 90, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(54, 54, cw - 108, ch - 108);

  // Corner Ornaments
  const drawCorner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#c8a35a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(0, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    ctx.restore();
  };
  drawCorner(65, 65, 0);
  drawCorner(cw - 65, 65, Math.PI / 2);
  drawCorner(cw - 65, ch - 65, Math.PI);
  drawCorner(65, ch - 65, -Math.PI / 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Sea Turtle Player Avatar Icon
  ctx.font = '84px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText('🐢', cw / 2, 135);

  // Title
  ctx.fillStyle = '#0b5c8f';
  ctx.font = '900 52px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  ctx.fillText('海洋守護者證書', cw / 2, 225);

  // Subtitle
  ctx.fillStyle = '#a08a5a';
  ctx.font = 'italic 20px Georgia, serif';
  ctx.fillText('Ocean Guardian Certificate', cw / 2, 265);

  // Divider Line
  ctx.strokeStyle = '#c8a35a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cw / 2 - 240, 292);
  ctx.lineTo(cw / 2 + 240, 292);
  ctx.stroke();

  // Student Name
  ctx.fillStyle = '#d1441f';
  ctx.font = '900 58px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  ctx.fillText(name || '海洋小守護者', cw / 2, 360);

  // Class
  if (className) {
    ctx.fillStyle = '#2e5f80';
    ctx.font = '800 24px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
    ctx.fillText(className, cw / 2, 408);
  }

  // Description
  ctx.fillStyle = '#3b6a8a';
  ctx.font = '700 22px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  ctx.fillText('積極參與「海龜守護之戰」，成功守護小海龜穿越海洋垃圾危機，', cw / 2, 452);
  ctx.fillText('並鄭重承諾在日常生活中實踐以下環保行動：', cw / 2, 484);

  // Pledges
  ctx.fillStyle = '#167a3c';
  ctx.font = '900 22px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  const startY = 528;
  const lineH = 34;
  pledges.slice(0, 5).forEach((p, idx) => {
    ctx.fillText(`${p.emoji} ${p.text}`, cw / 2, startY + idx * lineH);
  });

  // Score Badge
  const scoreY = startY + Math.min(pledges.length, 5) * lineH + 26;
  const badgeW = 480;
  const badgeH = 46;
  ctx.fillStyle = '#eaf7ff';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(cw / 2 - badgeW / 2, scoreY - badgeH / 2, badgeW, badgeH, badgeH / 2);
  } else {
    ctx.rect(cw / 2 - badgeW / 2, scoreY - badgeH / 2, badgeW, badgeH);
  }
  ctx.fill();
  ctx.strokeStyle = '#8fd3f4';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0b7fc2';
  ctx.font = '900 24px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  ctx.fillText(`最終守護得分：${score} 分  ·  存活時間：${survivalSeconds} 秒`, cw / 2, scoreY);

  // Footer Line
  const footerY = ch - 80;
  ctx.strokeStyle = '#c8a35a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cw / 2 - 240, footerY - 25);
  ctx.lineTo(cw / 2 + 240, footerY - 25);
  ctx.stroke();

  // Footer Date & Signature
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  ctx.fillStyle = '#8a7a5a';
  ctx.font = '800 20px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  ctx.fillText(`${dateStr}　　🐢 海龜守護之戰 · 海洋保護協會認證`, cw / 2, footerY);

  // Trigger Download
  try {
    const link = document.createElement('a');
    const safeName = (name || '小守護者').replace(/[\\/:*?"<>|]/g, '_');
    link.download = `海洋守護者證書_${safeName}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Download certificate failed', err);
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper> | null>(null);
  const isMobile = useIsMobile();

  // --- PLAYGROUND SDK INTEGRATION ---
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // --- ASSETS ---
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // --- REACT HUD & OVERLAY STATE ---
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
    lives: getConfig('startingHealth'),
    timer: 0,
  });

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [damageFlashOn, setDamageFlashOn] = useState(false);

  // Certificate Form State
  const [certName, setCertName] = useState('');
  const [certClass, setCertClass] = useState('');
  const [certPledges, setCertPledges] = useState<string[]>(['bag', 'straw', 'bottle', 'recycle']);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);
  const [dashCooldownPercent, setDashCooldownPercent] = useState(1);
  const [hasShieldState, setHasShieldState] = useState(false);
  const [speedBoostActive, setSpeedBoostActive] = useState(false);
  const [scoreMultiplier, setScoreMultiplier] = useState(1);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const isGameMenuOpenRef = useRef(isGameMenuOpen);
  isGameMenuOpenRef.current = isGameMenuOpen;

  const isHowToPlayOpenRef = useRef(isHowToPlayOpen);
  isHowToPlayOpenRef.current = isHowToPlayOpen;

  const isCertOpenRef = useRef(isCertOpen);
  isCertOpenRef.current = isCertOpen;

  const isKnowledgeOpenRef = useRef(isKnowledgeOpen);
  isKnowledgeOpenRef.current = isKnowledgeOpen;

  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  // Audio status stingers & celebratory effects
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [gameState.status]);

  const inputRef = useInput(canvasRef, true, {
    width: canvasWidth,
    height: canvasHeight,
  });

  // Mobile virtual buttons state
  const mobileInputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  });

  // --- HIGH-FREQUENCY GAME ENGINE STATE (IN REFS) ---
  const turtleRef = useRef({
    x: canvasWidth / 2,
    y: canvasHeight * 0.78,
    width: getConfig('assetTurtleWidth') as number,
    height: getConfig('assetTurtleHeight') as number,
    vx: 0,
    vy: 0,
    rotation: 0,
    targetRotation: 0,
    invincibleTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashCooldownTotal: getConfig('dashCooldown') as number,
    hasShield: false,
    speedBoostTimer: 0,
    health: getConfig('startingHealth') as number,
  });

  const hazardsRef = useRef<Hazard[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const warningsRef = useRef<WarningBeacon[]>([]);
  const floatersRef = useRef<Floater[]>([]);

  // Helper to spawn floating popup text
  const addFloater = (x: number, y: number, text: string, color: string, size = 18) => {
    floatersRef.current.push({
      id: `fl_${Date.now()}_${Math.random()}`,
      x,
      y,
      vy: -65,
      text,
      color,
      life: 1.25,
      maxLife: 1.25,
      size,
    });
  };

  // Timers and simulation tracking
  const simTimeRef = useRef(0);
  const hazardSpawnTimerRef = useRef(0);
  const itemSpawnTimerRef = useRef(0);
  const screenShakeRef = useRef(0);
  const damageFlashRef = useRef(0);
  const victoryBurstFiredRef = useRef(false);
  const lastScoreSecRef = useRef(0);
  const nearMissCountRef = useRef(0);

  // Background caustics & ambient bubbles
  const ambientBubblesRef = useRef<
    Array<{x: number; y: number; r: number; speed: number; drift: number}>
  >([]);
  if (ambientBubblesRef.current.length === 0) {
    for (let i = 0; i < 40; i++) {
      ambientBubblesRef.current.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        r: Math.random() * 3 + 1.5,
        speed: Math.random() * 40 + 20,
        drift: (Math.random() - 0.5) * 15,
      });
    }
  }

  // --- DASH TRIGGER HELPER ---
  const triggerDash = useCallback(() => {
    const turtle = turtleRef.current;
    if (turtle.dashCooldownTimer <= 0 && turtle.dashTimer <= 0) {
      turtle.dashTimer = getConfig('dashDuration') as number;
      turtle.dashCooldownTimer = turtle.dashCooldownTotal;
      turtle.invincibleTimer = Math.max(turtle.invincibleTimer, turtle.dashTimer);

      // Dash sound & floating text
      gameAudio.playRetroJump();
      addFloater(turtle.x, turtle.y - 30, '⚡ 龜殼衝刺！', '#34d399', 19);

      // Dash bubble shockwave
      for (let i = 0; i < 18; i++) {
        const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 1.6;
        const speed = Math.random() * 150 + 90;
        particlesRef.current.push({
          x: turtle.x,
          y: turtle.y + turtle.height * 0.4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 4 + 2,
          color: 'rgba(255, 255, 255, 0.9)',
          alpha: 1,
          life: 0,
          maxLife: 0.5,
        });
      }
    }
  }, []);

  // --- RESET / INIT GAME ---
  const initGame = useCallback(() => {
    const startingHealth = getConfig('startingHealth') as number;
    turtleRef.current = {
      x: canvasWidth / 2,
      y: canvasHeight * 0.78,
      width: getConfig('assetTurtleWidth') as number,
      height: getConfig('assetTurtleHeight') as number,
      vx: 0,
      vy: 0,
      rotation: 0,
      targetRotation: 0,
      invincibleTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      dashCooldownTotal: getConfig('dashCooldown') as number,
      hasShield: false,
      speedBoostTimer: 0,
      health: startingHealth,
    };

    hazardsRef.current = [];
    itemsRef.current = [];
    particlesRef.current = [];
    ripplesRef.current = [];
    warningsRef.current = [];
    floatersRef.current = [];

    simTimeRef.current = 0;
    hazardSpawnTimerRef.current = 0;
    itemSpawnTimerRef.current = 1.8;
    screenShakeRef.current = 0;
    damageFlashRef.current = 0;
    victoryBurstFiredRef.current = false;
    lastScoreSecRef.current = 0;
    nearMissCountRef.current = 0;

    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
      lives: startingHealth,
      timer: 0,
    });
    setIsGameMenuOpen(false);
    setIsHowToPlayOpen(false);
    setIsCertOpen(false);
    setIsKnowledgeOpen(false);
    setDashCooldownPercent(1);
    setHasShieldState(false);
    setSpeedBoostActive(false);
    setScoreMultiplier(1);
    setDamageFlashOn(false);

    if (sdk) {
      sdk.startGame();
    }
  }, [canvasWidth, canvasHeight, sdk]);

  // --- PLAYGROUND SDK LIFECYCLE ---
  usePlaygroundGameLifecycle(gameState, sdk);

  // Auto-start check
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // --- ESCAPE KEY LISTENER FOR MENU ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameStateRef.current.status === 'PLAYING') {
          if (isCertOpenRef.current) {
            setIsCertOpen(false);
          } else if (isKnowledgeOpenRef.current) {
            setIsKnowledgeOpen(false);
          } else if (isHowToPlayOpenRef.current) {
            setIsHowToPlayOpen(false);
          } else {
            setIsGameMenuOpen((prev) => !prev);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- SPAWN HAZARDS WITH ESCALATING DIFFICULTY ---
  const spawnHazardWave = (time: number) => {
    const targetSurvivalTime = getConfig('targetSurvivalTime') as number;
    const progress = Math.min(1, time / targetSurvivalTime);
    const roll = Math.random();

    if (roll < 0.32) {
      // 1. Plastic Bag: sinusoidal float
      const bagW = getConfig('assetBagWidth') as number;
      const bagH = getConfig('assetBagHeight') as number;
      const startX = Math.random() * (canvasWidth - bagW - 40) + 20;
      hazardsRef.current.push({
        id: `bag_${Date.now()}_${Math.random()}`,
        type: 'BAG',
        x: startX,
        y: -bagH - 10,
        width: bagW,
        height: bagH,
        vx: 0,
        vy: 160 + progress * 140,
        rotation: (Math.random() - 0.5) * 0.4,
        vRot: (Math.random() - 0.5) * 1.6,
        baseX: startX,
        waveTimer: Math.random() * Math.PI * 2,
        waveFreq: 2.2 + Math.random() * 1.5,
        waveAmp: 35 + Math.random() * 35,
      });
    } else if (roll < 0.6) {
      // 2. Glass Bottle: Vertical plummet with warning beam
      const botW = getConfig('assetBottleWidth') as number;
      const botH = getConfig('assetBottleHeight') as number;
      const xPos = Math.random() * (canvasWidth - botW - 40) + 20;
      warningsRef.current.push({
        x: xPos,
        y: 0,
        width: botW,
        type: 'BOTTLE',
        timer: 0.55,
        maxTimer: 0.55,
      });
      hazardsRef.current.push({
        id: `bot_${Date.now()}_${Math.random()}`,
        type: 'BOTTLE',
        x: xPos,
        y: -botH - 15,
        width: botW,
        height: botH,
        vx: 0,
        vy: 360 + progress * 220,
        rotation: 0,
        vRot: (Math.random() - 0.5) * 0.8,
        warningTimer: 0.55,
        ready: false,
      });
    } else if (roll < 0.82) {
      // 3. Plastic Straw Cluster: Angled dart
      const strW = getConfig('assetStrawWidth') as number;
      const strH = getConfig('assetStrawHeight') as number;
      const startX = Math.random() * (canvasWidth - strW - 60) + 30;
      const angle = (Math.random() - 0.5) * 0.6;
      const spd = 260 + progress * 170;
      hazardsRef.current.push({
        id: `str_${Date.now()}_${Math.random()}`,
        type: 'STRAW',
        x: startX,
        y: -strH - 10,
        width: strW,
        height: strH,
        vx: Math.sin(angle) * spd,
        vy: Math.cos(angle) * spd,
        rotation: angle,
        vRot: 0,
      });
    } else {
      // 4. Ghost Fishing Net: Screen-wide obstacle wave with a safe navigable gap
      const netW = canvasWidth;
      const netH = getConfig('assetGhostNetHeight') as number;
      const gapWidth = Math.max(120, 165 - progress * 40);
      const gapX = Math.random() * (canvasWidth - gapWidth - 60) + 30;

      hazardsRef.current.push({
        id: `net_${Date.now()}_${Math.random()}`,
        type: 'NET',
        x: 0,
        y: -netH - 20,
        width: netW,
        height: netH,
        vx: 0,
        vy: 135 + progress * 80,
        rotation: 0,
        vRot: 0,
        gapX,
        gapWidth,
      });
    }
  };

  // --- SPAWN COLLECTIBLE POWERUPS ---
  const spawnCollectible = () => {
    const isShield = Math.random() < 0.42;
    if (isShield) {
      const bW = getConfig('assetBubbleWidth') as number;
      const bH = getConfig('assetBubbleHeight') as number;
      itemsRef.current.push({
        id: `shield_${Date.now()}`,
        type: 'SHIELD',
        x: Math.random() * (canvasWidth - bW - 60) + 30,
        y: -bH - 10,
        width: bW,
        height: bH,
        vy: 130 + Math.random() * 40,
        bobTimer: Math.random() * Math.PI * 2,
        collected: false,
      });
    } else {
      const jW = getConfig('assetJellyfishWidth') as number;
      const jH = getConfig('assetJellyfishHeight') as number;
      itemsRef.current.push({
        id: `jelly_${Date.now()}`,
        type: 'JELLYFISH',
        x: Math.random() * (canvasWidth - jW - 60) + 30,
        y: -jH - 10,
        width: jW,
        height: jH,
        vy: 120 + Math.random() * 50,
        bobTimer: Math.random() * Math.PI * 2,
        collected: false,
      });
    }
  };

  // --- COLLISION CHECK HELPER ---
  const checkTurtleCollision = (
    turtle: typeof turtleRef.current,
    hazard: Hazard,
  ): boolean => {
    const turtleHitboxRadius = turtle.width * 0.35;
    const turtleCenterX = turtle.x;
    const turtleCenterY = turtle.y;

    if (hazard.type === 'NET') {
      const netLeft = hazard.x;
      const netRight = hazard.x + hazard.width;
      const netTop = hazard.y;
      const netBottom = hazard.y + hazard.height;
      const gapLeft = hazard.gapX || 0;
      const gapRight = gapLeft + (hazard.gapWidth || 100);

      const inVerticalRange =
        turtleCenterY + turtleHitboxRadius > netTop &&
        turtleCenterY - turtleHitboxRadius < netBottom;
      const inHorizontalRange =
        turtleCenterX + turtleHitboxRadius > netLeft &&
        turtleCenterX - turtleHitboxRadius < netRight;

      if (inVerticalRange && inHorizontalRange) {
        const insideGap =
          turtleCenterX - turtleHitboxRadius > gapLeft &&
          turtleCenterX + turtleHitboxRadius < gapRight;
        return !insideGap;
      }
      return false;
    }

    const hCenterX = hazard.x + hazard.width / 2;
    const hCenterY = hazard.y + hazard.height / 2;
    const hRadius = Math.min(hazard.width, hazard.height) * 0.38;

    const dx = turtleCenterX - hCenterX;
    const dy = turtleCenterY - hCenterY;
    const distSq = dx * dx + dy * dy;
    const radSum = turtleHitboxRadius + hRadius;

    return distSq < radSum * radSum;
  };

  // --- 60 FPS PHYSICS UPDATE ---
  const update = (deltaTime: number) => {
    if (
      gameStateRef.current.status !== 'PLAYING' ||
      isGameMenuOpenRef.current ||
      isHowToPlayOpenRef.current ||
      isCertOpenRef.current ||
      isKnowledgeOpenRef.current
    ) {
      return;
    }

    const dt = Math.min(deltaTime, 0.1);
    simTimeRef.current += dt;
    const currentTime = simTimeRef.current;
    const targetSurvivalTime = getConfig('targetSurvivalTime') as number;

    // Check Victory condition (reached 60s sanctuary)
    if (currentTime >= targetSurvivalTime && !victoryBurstFiredRef.current) {
      victoryBurstFiredRef.current = true;
      setGameState((prev) => ({
        ...prev,
        status: 'VICTORY',
        timer: targetSurvivalTime,
      }));
      addFloater(canvasWidth / 2, canvasHeight * 0.4, '🎉 成功抵達庇護所！', '#10b981', 28);
      return;
    }

    const turtle = turtleRef.current;
    const baseSpeed = getConfig('playerSpeed') as number;
    const speedMultiplier =
      (turtle.speedBoostTimer > 0 ? 1.3 : 1.0) *
      (turtle.dashTimer > 0 ? (getConfig('dashSpeedMultiplier') as number) : 1.0);
    const speed = baseSpeed * speedMultiplier;

    // --- INPUT GATHERING ---
    const input = inputRef.current;
    const mobile = mobileInputRef.current;

    let moveX = 0;
    let moveY = 0;

    if (input.actions.left || mobile.left) moveX -= 1;
    if (input.actions.right || mobile.right) moveX += 1;
    if (input.actions.up || mobile.up) moveY -= 1;
    if (input.actions.down || mobile.down) moveY += 1;

    // Dash trigger via space / confirm / tap button
    if (input.actions.confirm || mobile.dash) {
      triggerDash();
    }

    // Direct, ultra-responsive touch / pointer dragging
    if (input.pointer.down) {
      const targetX = input.pointer.x;
      const targetY = input.pointer.y;
      const dx = targetX - turtle.x;
      const dy = targetY - turtle.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 2) {
        const followSpeed = Math.max(speed * 1.6, dist * 18);
        const step = Math.min(dist, followSpeed * dt);
        turtle.x += (dx / dist) * step;
        turtle.y += (dy / dist) * step;
        moveX += dx / (dist || 1);
        moveY += dy / (dist || 1);
      }
    } else {
      const mag = Math.hypot(moveX, moveY);
      if (mag > 1) {
        moveX /= mag;
        moveY /= mag;
      }
      turtle.vx = moveX * speed;
      turtle.vy = moveY * speed;
      turtle.x += turtle.vx * dt;
      turtle.y += turtle.vy * dt;
    }

    // Keep within ocean canvas boundaries
    const halfW = turtle.width / 2;
    const halfH = turtle.height / 2;
    turtle.x = clamp(turtle.x, halfW + 8, canvasWidth - halfW - 8);
    turtle.y = clamp(turtle.y, halfH + 8, canvasHeight - halfH - 8);

    // Dynamic rotation tilt leaning into movement direction
    if (Math.abs(moveX) > 0.05) {
      turtle.targetRotation = clamp(moveX, -1, 1) * 0.35;
    } else {
      turtle.targetRotation = 0;
    }
    turtle.rotation += (turtle.targetRotation - turtle.rotation) * dt * 12;

    // --- TIMERS UPDATE ---
    if (turtle.invincibleTimer > 0) turtle.invincibleTimer -= dt;
    if (turtle.dashTimer > 0) turtle.dashTimer -= dt;
    if (turtle.dashCooldownTimer > 0) {
      turtle.dashCooldownTimer = Math.max(0, turtle.dashCooldownTimer - dt);
    }
    if (turtle.speedBoostTimer > 0) turtle.speedBoostTimer -= dt;

    // Screen Shake & damage flash decay
    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 25);
    }
    if (damageFlashRef.current > 0) {
      damageFlashRef.current = Math.max(0, damageFlashRef.current - dt * 3);
      if (damageFlashRef.current <= 0) {
        setDamageFlashOn(false);
      }
    }

    // Update Floater texts
    floatersRef.current.forEach((f) => {
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.35, dt);
      f.life -= dt;
    });
    floatersRef.current = floatersRef.current.filter((f) => f.life > 0);

    // --- FLIPPER BUBBLE PARTICLES ---
    if (Math.random() < (turtle.dashTimer > 0 ? 0.9 : 0.4)) {
      const flipperOffset = (Math.random() - 0.5) * turtle.width * 0.6;
      particlesRef.current.push({
        x: turtle.x + flipperOffset,
        y: turtle.y + turtle.height * 0.4,
        vx: (Math.random() - 0.5) * 20,
        vy: 40 + Math.random() * 60,
        radius: Math.random() * (turtle.dashTimer > 0 ? 4 : 2.5) + 1,
        color: turtle.speedBoostTimer > 0 ? 'rgba(251, 191, 36, 0.7)' : 'rgba(255, 255, 255, 0.6)',
        alpha: 0.8,
        life: 0,
        maxLife: 0.6,
      });
    }

    // --- SPAWN HAZARDS ---
    const spawnFreq = (getConfig('hazardSpawnRate') as number) * (1 + (currentTime / targetSurvivalTime) * 1.5);
    hazardSpawnTimerRef.current += dt;
    if (hazardSpawnTimerRef.current >= 1 / spawnFreq) {
      hazardSpawnTimerRef.current = 0;
      spawnHazardWave(currentTime);
    }

    // --- SPAWN COLLECTIBLES ---
    itemSpawnTimerRef.current += dt;
    if (itemSpawnTimerRef.current >= 5.2) {
      itemSpawnTimerRef.current = 0;
      spawnCollectible();
    }

    // --- UPDATE WARNING BEACONS ---
    warningsRef.current.forEach((w) => {
      w.timer -= dt;
    });
    warningsRef.current = warningsRef.current.filter((w) => w.timer > 0);

    // --- UPDATE HAZARDS ---
    const activeHazards: Hazard[] = [];
    for (let i = 0; i < hazardsRef.current.length; i++) {
      const h = hazardsRef.current[i];

      if (h.warningTimer && h.warningTimer > 0) {
        h.warningTimer -= dt;
        if (h.warningTimer <= 0) {
          h.ready = true;
        }
        activeHazards.push(h);
        continue;
      }

      h.rotation += h.vRot * dt;

      if (h.type === 'BAG' && h.baseX !== undefined && h.waveTimer !== undefined) {
        h.waveTimer += dt * (h.waveFreq || 2);
        h.x = h.baseX + Math.sin(h.waveTimer) * (h.waveAmp || 40);
        h.y += h.vy * dt;
      } else {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
      }

      // Check Near-Miss for score bonus
      const distToTurtle = Math.hypot(
        turtle.x - (h.x + h.width / 2),
        turtle.y - (h.y + h.height / 2),
      );
      if (distToTurtle < turtle.width + 16 && distToTurtle > turtle.width * 0.45) {
        nearMissCountRef.current++;
        if (nearMissCountRef.current % 35 === 0) {
          gameAudio.playHoverMicroTone();
          addFloater(turtle.x, turtle.y - 20, '+50 擦身閃避！', '#38bdf8', 16);
          setGameState((prev) => ({ ...prev, score: prev.score + 50 }));
        }
      }

      // Check Collision with turtle
      if (turtle.invincibleTimer <= 0 && checkTurtleCollision(turtle, h)) {
        if (turtle.hasShield) {
          turtle.hasShield = false;
          turtle.invincibleTimer = 0.8;
          gameAudio.playShieldBlock();
          screenShakeRef.current = 6;
          addFloater(turtle.x, turtle.y - 30, '🛡️ 護盾抵擋！', '#38bdf8', 20);

          ripplesRef.current.push({
            x: turtle.x,
            y: turtle.y,
            radius: 10,
            maxRadius: 80,
            alpha: 1,
            color: 'rgba(34, 211, 238, 0.8)',
          });

          for (let p = 0; p < 20; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speedVal = Math.random() * 140 + 60;
            particlesRef.current.push({
              x: turtle.x,
              y: turtle.y,
              vx: Math.cos(angle) * speedVal,
              vy: Math.sin(angle) * speedVal,
              radius: Math.random() * 3 + 2,
              color: 'rgba(34, 211, 238, 0.9)',
              alpha: 1,
              life: 0,
              maxLife: 0.45,
            });
          }
        } else {
          turtle.health -= 1;
          turtle.invincibleTimer = getConfig('invincibilityDuration') as number;
          damageFlashRef.current = 0.85;
          setDamageFlashOn(true);
          screenShakeRef.current = 14;
          gameAudio.playGeneralDamage();
          addFloater(turtle.x, turtle.y - 30, '哎呀！-1❤️', '#ef4444', 22);

          for (let p = 0; p < 18; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speedVal = Math.random() * 160 + 50;
            particlesRef.current.push({
              x: turtle.x,
              y: turtle.y,
              vx: Math.cos(angle) * speedVal,
              vy: Math.sin(angle) * speedVal,
              radius: Math.random() * 3.5 + 1.5,
              color: 'rgba(239, 68, 68, 0.9)',
              alpha: 1,
              life: 0,
              maxLife: 0.5,
            });
          }

          if (turtle.health <= 0) {
            setGameState((prev) => ({
              ...prev,
              status: 'GAME_OVER',
              lives: 0,
            }));
            return;
          }
        }
      }

      if (h.y < canvasHeight + 150) {
        activeHazards.push(h);
      }
    }
    hazardsRef.current = activeHazards;

    // --- UPDATE COLLECTIBLES ---
    const activeItems: Item[] = [];
    for (let i = 0; i < itemsRef.current.length; i++) {
      const it = itemsRef.current[i];
      it.bobTimer += dt * 3;
      it.y += it.vy * dt;
      it.x += Math.sin(it.bobTimer) * 1.2;

      const itemCenterX = it.x + it.width / 2;
      const itemCenterY = it.y + it.height / 2;
      const dist = Math.hypot(turtle.x - itemCenterX, turtle.y - itemCenterY);

      if (dist < (turtle.width + it.width) * 0.42 && !it.collected) {
        it.collected = true;

        if (it.type === 'SHIELD') {
          turtle.hasShield = true;
          gameAudio.playPowerupChime();
          addFloater(itemCenterX, itemCenterY - 25, '🫧 泡泡護盾！', '#38bdf8', 21);

          ripplesRef.current.push({
            x: itemCenterX,
            y: itemCenterY,
            radius: 10,
            maxRadius: 65,
            alpha: 1,
            color: 'rgba(34, 211, 238, 0.9)',
          });
        } else if (it.type === 'JELLYFISH') {
          turtle.speedBoostTimer = getConfig('jellyfishSpeedBoostDuration') as number;
          const bonus = (getConfig('jellyfishBonusScore') as number) * scoreMultiplier;
          gameAudio.playCoinPickup();
          addFloater(itemCenterX, itemCenterY - 25, `✨ 黃金水母 +${bonus}！`, '#fbbf24', 22);

          setGameState((prev) => ({
            ...prev,
            score: prev.score + bonus,
          }));

          for (let p = 0; p < 18; p++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 120 + 40;
            particlesRef.current.push({
              x: itemCenterX,
              y: itemCenterY,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              radius: Math.random() * 3 + 2,
              color: 'rgba(251, 191, 36, 0.95)',
              alpha: 1,
              life: 0,
              maxLife: 0.6,
              glow: true,
            });
          }
        }
      }

      if (!it.collected && it.y < canvasHeight + 80) {
        activeItems.push(it);
      }
    }
    itemsRef.current = activeItems;

    // --- UPDATE PARTICLES & RIPPLES ---
    particlesRef.current.forEach((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    });
    particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

    ripplesRef.current.forEach((r) => {
      r.radius += (r.maxRadius - r.radius) * dt * 8;
      r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
    });
    ripplesRef.current = ripplesRef.current.filter((r) => r.alpha > 0.05);

    // Ambient ocean bubble currents
    ambientBubblesRef.current.forEach((b) => {
      b.y -= b.speed * dt;
      b.x += b.drift * dt;
      if (b.y < -10) {
        b.y = canvasHeight + 10;
        b.x = Math.random() * canvasWidth;
      }
    });

    // Score accumulation over time
    if (currentTime - lastScoreSecRef.current >= 1.0) {
      lastScoreSecRef.current = currentTime;
      setGameState((prev) => ({
        ...prev,
        score: prev.score + 10 * scoreMultiplier,
        timer: Math.floor(currentTime),
        lives: turtle.health,
      }));
    }

    // Sync HUD state
    setDashCooldownPercent(
      turtle.dashCooldownTimer <= 0
        ? 1
        : 1 - turtle.dashCooldownTimer / turtle.dashCooldownTotal,
    );
    setHasShieldState(turtle.hasShield);
    setSpeedBoostActive(turtle.speedBoostTimer > 0);
  };

  // --- RENDER FUNCTION ---
  const render = (context: CanvasRenderingContext2D, alpha: number) => {
    const ctx = context;
    const time = simTimeRef.current;
    const isShowingLabels = showLabelsRef.current;

    ctx.save();

    // Screen Shake effect
    if (screenShakeRef.current > 0) {
      const shakeMag = screenShakeRef.current;
      ctx.translate(
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag,
      );
    }

    // 1. CLEAR & DRAW OCEAN BACKGROUND
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGrad.addColorStop(0, '#041c30');
    bgGrad.addColorStop(0.35, '#062d52');
    bgGrad.addColorStop(0.75, '#073663');
    bgGrad.addColorStop(1, '#05192d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. SUBTLE SUNLIGHT RAYS PENETRATING THE SHALLOWS
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const rayX = (i / 3) * canvasWidth + Math.sin(time * 0.4 + i * 1.5) * 40;
      const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 60, canvasHeight);
      rayGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      rayGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.04)');
      rayGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rayX - 30, 0);
      ctx.lineTo(rayX + 50, 0);
      ctx.lineTo(rayX + 160, canvasHeight);
      ctx.lineTo(rayX + 40, canvasHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. AMBIENT DRIFTING WATER BUBBLES
    ambientBubblesRef.current.forEach((b) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 3.5. MOVING CAUSTICS AND CURRENT CONTOURS
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.12;
    for (let band = 0; band < 5; band++) {
      const y = ((time * (10 + band * 3) + band * 150) % (canvasHeight + 220)) - 110;
      const wave = Math.sin(time * 0.7 + band) * 24;
      ctx.strokeStyle = band % 2 === 0 ? '#7de8e0' : '#6fc9f5';
      ctx.lineWidth = band % 2 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.bezierCurveTo(canvasWidth * 0.28, y - 26 + wave, canvasWidth * 0.68, y + 32 - wave, canvasWidth + 30, y - 10);
      ctx.stroke();
    }
    ctx.restore();

    // 4. WATER RIPPLES / SHIELD POP WAVES
    ripplesRef.current.forEach((r) => {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 5. DRAW WARNING BEACONS (Bottles falling)
    warningsRef.current.forEach((w) => {
      ctx.save();
      const alphaVal = 0.3 + 0.7 * Math.sin(w.timer * 25);
      ctx.fillStyle = `rgba(239, 68, 68, ${alphaVal * 0.28})`;
      ctx.fillRect(w.x, 0, w.width, canvasHeight);

      // Warning exclamation badge
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x + w.width / 2, 34, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', w.x + w.width / 2, 34);
      ctx.restore();
    });

    // 6. DRAW ITEMS (Bubble Shield & Golden Jellyfish)
    itemsRef.current.forEach((it) => {
      if (it.collected) return;
      ctx.save();

      // Soft pulsating aura glow
      const auraGrad = ctx.createRadialGradient(
        it.x + it.width / 2,
        it.y + it.height / 2,
        it.width * 0.2,
        it.x + it.width / 2,
        it.y + it.height / 2,
        it.width * 0.8,
      );
      if (it.type === 'SHIELD') {
        auraGrad.addColorStop(0, 'rgba(34, 211, 238, 0.45)');
        auraGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      } else {
        auraGrad.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
        auraGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      }
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(
        it.x + it.width / 2,
        it.y + it.height / 2,
        it.width * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Item Sprite
      const assetKey = it.type === 'SHIELD' ? 'item_shield' : 'item_jellyfish';
      drawAsset(
        ctx,
        assets[assetKey],
        it.x,
        it.y,
        it.width,
        it.height,
        (fallbackCtx) => {
          fallbackCtx.fillStyle = it.type === 'SHIELD' ? '#22d3ee' : '#fbbf24';
          fallbackCtx.beginPath();
          fallbackCtx.arc(
            it.x + it.width / 2,
            it.y + it.height / 2,
            it.width / 2,
            0,
            Math.PI * 2,
          );
          fallbackCtx.fill();
        },
      );

      // TRADITIONAL CHINESE LABEL UNDER ITEM
      if (isShowingLabels) {
        if (it.type === 'SHIELD') {
          drawBadgeLabel(
            ctx,
            '🫧 泡泡護盾',
            it.x + it.width / 2,
            it.y + it.height + 14,
            'rgba(240, 249, 255, 0.95)',
            '#0369a1',
            12,
            '#7dd3fc',
          );
        } else {
          drawBadgeLabel(
            ctx,
            '✨ 黃金水母',
            it.x + it.width / 2,
            it.y + it.height + 14,
            'rgba(254, 252, 232, 0.95)',
            '#854d0e',
            12,
            '#fde047',
          );
        }
      }

      ctx.restore();
    });

    // 7. DRAW HAZARDS
    hazardsRef.current.forEach((h) => {
      if (h.warningTimer && h.warningTimer > 0) return;

      ctx.save();
      ctx.translate(h.x + h.width / 2, h.y + h.height / 2);
      ctx.rotate(h.rotation);

      if (h.type === 'NET') {
        // Ghost Fishing Net: Spanning obstacle with illuminated safe channel
        ctx.translate(-(h.x + h.width / 2), -(h.y + h.height / 2));

        const gapLeft = h.gapX || 100;
        const gapWidth = h.gapWidth || 120;
        const gapRight = gapLeft + gapWidth;
        const netTop = h.y;
        const netBottom = h.y + h.height;
        const netH = h.height;

        // SAFE PASSAGE WATER CHANNEL
        ctx.save();
        const gapPulse = 0.88 + Math.sin(time * 4) * 0.12;
        const channelGrad = ctx.createLinearGradient(gapLeft, netTop - 20, gapRight, netTop - 20);
        channelGrad.addColorStop(0, `rgba(6, 182, 212, ${0.12 * gapPulse})`);
        channelGrad.addColorStop(0.2, `rgba(34, 211, 238, ${0.28 * gapPulse})`);
        channelGrad.addColorStop(0.5, `rgba(52, 211, 153, ${0.35 * gapPulse})`);
        channelGrad.addColorStop(0.8, `rgba(34, 211, 238, ${0.28 * gapPulse})`);
        channelGrad.addColorStop(1, `rgba(6, 182, 212, ${0.12 * gapPulse})`);

        ctx.fillStyle = channelGrad;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(gapLeft - 2, netTop - 16, gapWidth + 4, netH + 32, 10);
        } else {
          ctx.rect(gapLeft - 2, netTop - 16, gapWidth + 4, netH + 32);
        }
        ctx.fill();

        // Polished safe-passage artwork keeps the route readable during play.
        drawAsset(
          ctx,
          assets.safe_passage,
          gapLeft - 18,
          netTop - 22,
          gapWidth + 36,
          netH + 44,
          () => {},
        );

        // Directional Water Current Flow Streaks
        ctx.lineWidth = 2;
        const flowOffset = (time * 190) % 42;
        for (let fx = gapLeft + 16; fx < gapRight - 10; fx += 24) {
          const streakGrad = ctx.createLinearGradient(fx, netTop - 12, fx, netBottom + 16);
          streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          streakGrad.addColorStop(0.3, 'rgba(34, 211, 238, 0.7)');
          streakGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.95)');
          streakGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
          ctx.strokeStyle = streakGrad;

          for (let fy = netTop - 16 + flowOffset; fy < netBottom + 28; fy += 42) {
            ctx.beginPath();
            ctx.moveTo(fx, fy - 12);
            ctx.lineTo(fx, fy + 8);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fx - 4, fy + 3);
            ctx.lineTo(fx, fy + 8);
            ctx.lineTo(fx + 4, fy + 3);
            ctx.stroke();
          }
        }
        ctx.restore();

        // RENDER GHOST NET MESH IN TWO WINGS
        ctx.save();
        ctx.beginPath();
        ctx.rect(h.x, netTop, Math.max(0, gapLeft - h.x), netH);
        ctx.rect(gapRight, netTop, Math.max(0, h.x + h.width - gapRight), netH);
        ctx.clip();

        drawAsset(
          ctx,
          assets['hazard_net'],
          h.x,
          netTop,
          h.width,
          netH,
          (fallbackCtx) => {
            fallbackCtx.fillStyle = 'rgba(6, 40, 48, 0.85)';
            fallbackCtx.fillRect(h.x, netTop, h.width, netH);
          },
        );

        ctx.strokeStyle = 'rgba(15, 118, 110, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x, netTop + 4);
        ctx.lineTo(h.x + h.width, netTop + 4);
        ctx.moveTo(h.x, netBottom - 4);
        ctx.lineTo(h.x + h.width, netBottom - 4);
        ctx.stroke();

        ctx.restore();

        // TRADITIONAL CHINESE LABELS FOR NET & SAFE PASSAGE
        if (isShowingLabels) {
          if (gapLeft > 120) {
            drawBadgeLabel(
              ctx,
              '🕸️ 幽靈漁網',
              h.x + gapLeft / 2,
              netTop + netH + 16,
              'rgba(255, 235, 235, 0.95)',
              '#991b1b',
              12,
              '#f87171',
            );
          }
          drawBadgeLabel(
            ctx,
            '✨ 避險通道',
            gapLeft + gapWidth / 2,
            netTop - 14,
            'rgba(236, 253, 245, 0.95)',
            '#065f46',
            12,
            '#34d399',
          );
        }
      } else {
        const assetMap: Record<HazardType, string> = {
          BAG: 'hazard_bag',
          BOTTLE: 'hazard_bottle',
          STRAW: 'hazard_straw',
          NET: 'hazard_net',
        };
        const assetImg = assets[assetMap[h.type]];

        drawAsset(
          ctx,
          assetImg,
          -h.width / 2,
          -h.height / 2,
          h.width,
          h.height,
          (fallbackCtx) => {
            fallbackCtx.fillStyle =
              h.type === 'BOTTLE'
                ? '#10b981'
                : h.type === 'STRAW'
                ? '#ef4444'
                : '#e2e8f0';
            fallbackCtx.fillRect(
              -h.width / 2,
              -h.height / 2,
              h.width,
              h.height,
            );
          },
        );

        // TRADITIONAL CHINESE LABEL UNDER DEBRIS
        if (isShowingLabels) {
          if (h.type === 'BAG') {
            drawBadgeLabel(
              ctx,
              '🛍️ 膠袋',
              0,
              h.height / 2 + 14,
              'rgba(255, 240, 240, 0.95)',
              '#b91c1c',
              12,
              '#fca5a5',
            );
          } else if (h.type === 'BOTTLE') {
            drawBadgeLabel(
              ctx,
              '🍾 玻璃樽',
              0,
              h.height / 2 + 14,
              'rgba(240, 253, 244, 0.95)',
              '#047857',
              12,
              '#6ee7b7',
            );
          } else if (h.type === 'STRAW') {
            drawBadgeLabel(
              ctx,
              '🥤 膠飲管',
              0,
              h.height / 2 + 14,
              'rgba(255, 247, 237, 0.95)',
              '#c2410c',
              12,
              '#fdba74',
            );
          }
        }
      }
      ctx.restore();
    });

    // 8. DRAW PARTICLES
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. DRAW PLAYER TURTLE (SEA TURTLE)
    const turtle = turtleRef.current;
    const isFlashing =
      turtle.invincibleTimer > 0 && Math.floor(time * 18) % 2 === 0;

    if (!isFlashing) {
      ctx.save();
      ctx.translate(turtle.x, turtle.y);
      ctx.rotate(turtle.rotation);

      if (turtle.dashTimer > 0) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
      } else if (turtle.speedBoostTimer > 0) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14;
      }

      // Draw Turtle Sprite
      drawAsset(
        ctx,
        assets['player'],
        -turtle.width / 2,
        -turtle.height / 2,
        turtle.width,
        turtle.height,
        (fallbackCtx) => {
          fallbackCtx.fillStyle = '#10b981';
          fallbackCtx.beginPath();
          fallbackCtx.ellipse(
            0,
            0,
            turtle.width / 2,
            turtle.height / 2,
            0,
            0,
            Math.PI * 2,
          );
          fallbackCtx.fill();
        },
      );

      // Bubble Shield barrier if active
      if (turtle.hasShield) {
        ctx.save();
        const shieldPulse = 1 + Math.sin(time * 6) * 0.05;
        const shieldR = turtle.width * 0.65 * shieldPulse;

        ctx.shadowColor = 'rgba(34, 211, 238, 0.85)';
        ctx.shadowBlur = 14;

        drawAsset(
          ctx,
          assets['item_shield'],
          -shieldR,
          -shieldR,
          shieldR * 2,
          shieldR * 2,
          (fallbackCtx) => {
            fallbackCtx.strokeStyle = '#22d3ee';
            fallbackCtx.lineWidth = 3;
            fallbackCtx.beginPath();
            fallbackCtx.arc(0, 0, shieldR, 0, Math.PI * 2);
            fallbackCtx.stroke();
          },
        );
        ctx.restore();
      }

      // TRADITIONAL CHINESE LABEL UNDER TURTLE
      if (isShowingLabels) {
        drawBadgeLabel(
          ctx,
          '🐢 小海龜',
          0,
          turtle.height / 2 + 16,
          'rgba(240, 253, 244, 0.94)',
          '#15803d',
          12,
          '#86efac',
        );
      }

      ctx.restore();
    }

    // 10. DRAW FLOATING POPUP TEXTS (Floaters)
    floatersRef.current.forEach((f) => {
      const alphaVal = Math.max(0, f.life / f.maxLife);
      ctx.save();
      ctx.globalAlpha = alphaVal;
      ctx.font = `900 ${f.size}px "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5, 25, 45, 0.85)';
      ctx.strokeText(f.text, f.x, f.y);

      // Fill
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    // 11. EDGE VIGNETTE FOR A SOFT, CINEMATIC PLAYFIELD
    const vignette = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight * 0.44,
      canvasHeight * 0.16,
      canvasWidth / 2,
      canvasHeight * 0.46,
      canvasHeight * 0.82,
    );
    vignette.addColorStop(0, 'rgba(0, 18, 34, 0)');
    vignette.addColorStop(0.72, 'rgba(0, 12, 28, 0.08)');
    vignette.addColorStop(1, 'rgba(0, 6, 18, 0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.restore();
  };

  // --- RAF GAME LOOP DRIVER ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          prepareCanvas(ctx, canvasWidth, canvasHeight);
          if (stepperRef.current) {
            stepperRef.current(currentTime, (dt) => {
              update(dt);
            });
            render(ctx, 1);
          }
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasWidth, canvasHeight]);

  const targetSurvivalTime = getConfig('targetSurvivalTime') as number;
  const remainingSeconds = Math.max(0, targetSurvivalTime - (gameState.timer || 0));

  return (
    <div
      style={{
        backgroundColor: '#05192d',
        fontFamily: THEME.fontFamily,
      }}
      className="game-root relative w-screen h-screen overflow-hidden flex items-center justify-center select-none touch-none">
      {/* Background audio loop */}
      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={gameState.status === 'PLAYING' && !isGameMenuOpen && !isCertOpen}
        isMuted={isMusicMuted}
        volume={getConfig('defaultMusicVolume') as number}
      />

      {/* Red damage flash screen overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,50,50,0) 30%, rgba(255,30,30,0.6) 100%)',
          pointerEvents: 'none',
          zIndex: 25,
          opacity: damageFlashOn ? 1 : 0,
          transition: damageFlashOn ? 'none' : 'opacity 0.35s ease-out',
        }}
      />

      {/* Main Canvas Viewport with responsive aspect box */}
      <div
        style={{
          aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          maxHeight: '100vh',
        }}
        className="game-shell relative shadow-2xl flex items-center justify-center bg-slate-950 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
        />

        {/* --- IN-GAME TOP HUD --- */}
        {gameState.status === 'PLAYING' && (
          <div className="absolute top-0 left-0 right-0 p-3 flex flex-col gap-2 pointer-events-none z-20">
            {/* Upper row: Hearts, Sanctuary Timer, Score, Menu buttons */}
            <div className="flex items-center justify-between gap-2">
              {/* Hearts Health Counter */}
              <div className="hud-card flex items-center gap-1.5 px-3 py-1.5 rounded-2xl">
                {Array.from({length: getConfig('startingHealth') as number}).map((_, idx) => (
                  <img
                    key={idx}
                    src="assets/images/ui_heart_icon.png"
                    alt={idx < gameState.lives ? '生命值' : '失去的生命值'}
                    className={idx < gameState.lives ? 'hud-heart opacity-100 scale-100' : 'hud-heart hud-heart--empty scale-75'}
                  />
                ))}
              </div>

              {/* Sanctuary Survival Countdown */}
              <div className="hud-card hud-card--timer flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-cyan-200 text-xs md:text-sm font-black">
                <span>🌊 庇護所倒數:</span>
                <span className="font-mono text-sm md:text-base text-yellow-300">
                  {remainingSeconds}s
                </span>
              </div>

              {/* Score Display */}
              <div className="hud-card hud-card--score flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-amber-200 text-xs md:text-sm font-black">
                <span>分數:</span>
                <span className="font-mono text-white text-sm md:text-base">
                  {gameState.score}
                </span>
              </div>

              {/* Top Action Buttons (Labels, Knowledge, Certificate, Menu) */}
              <div className="flex items-center gap-1 pointer-events-auto">
                {/* Toggle Labels */}
                <button
                  onClick={() => setShowLabels((prev) => !prev)}
                  title="切換繁體中文標籤"
                  aria-label="切換標籤"
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    showLabels
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700'
                  }`}>
                  <Tag size={15} />
                </button>

                {/* Marine Knowledge Handbook */}
                <button
                  onClick={() => {
                    gameAudio.playCrispClick();
                    setIsKnowledgeOpen(true);
                  }}
                  title="海洋保育小知識"
                  aria-label="海洋保育小知識"
                  className="hud-action ocean-button w-8 h-8 bg-emerald-600/90 text-white rounded-full flex items-center justify-center border border-emerald-300/60 shadow transition-all active:scale-90">
                  <BookOpen size={15} />
                </button>

                {/* Pause / Menu */}
                <button
                  onClick={() => {
                    gameAudio.playCrispClick();
                    setIsGameMenuOpen(true);
                  }}
                  title="選單"
                  aria-label="選單"
                  className="hud-action ocean-button w-8 h-8 bg-slate-800/90 text-cyan-200 rounded-full flex items-center justify-center border border-cyan-500/50 shadow transition-all active:scale-90">
                  <Pause size={15} />
                </button>
              </div>
            </div>

            {/* Active Buffs (Shield & Speed) */}
            <div className="flex items-center gap-2">
              {hasShieldState && (
                <div className="flex items-center gap-1 bg-cyan-950/80 border border-cyan-400/60 text-cyan-300 text-xs px-2.5 py-1 rounded-full shadow animate-pulse">
                  <Shield size={14} className="text-cyan-300" />
                  <span className="font-bold">泡泡護盾保護中</span>
                </div>
              )}
              {speedBoostActive && (
                <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-400/60 text-amber-300 text-xs px-2.5 py-1 rounded-full shadow animate-pulse">
                  <Sparkles size={14} className="text-amber-300" />
                  <span className="font-bold">水母加速衝刺！</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- MOBILE VIRTUAL CONTROLS OVERLAY --- */}
      {gameState.status === 'PLAYING' && isMobile && (
        <div className="fixed bottom-4 left-0 right-0 px-5 flex items-end justify-between pointer-events-none z-30">
          {/* Virtual D-Pad Directions */}
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900/80 border border-cyan-900/50 rounded-2xl backdrop-blur-md pointer-events-auto shadow-2xl">
            <div />
            <button
              onPointerDown={() => {
                mobileInputRef.current.up = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.up = false;
              }}
              onPointerCancel={() => {
                mobileInputRef.current.up = false;
              }}
              aria-label="向上游"
              className="min-w-[48px] min-h-[48px] w-12 h-12 bg-slate-800 active:bg-cyan-600 text-cyan-300 active:text-white border border-cyan-700/50 rounded-xl flex items-center justify-center shadow-lg active:scale-95">
              <ArrowUp size={22} />
            </button>
            <div />

            <button
              onPointerDown={() => {
                mobileInputRef.current.left = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.left = false;
              }}
              onPointerCancel={() => {
                mobileInputRef.current.left = false;
              }}
              aria-label="向左游"
              className="min-w-[48px] min-h-[48px] w-12 h-12 bg-slate-800 active:bg-cyan-600 text-cyan-300 active:text-white border border-cyan-700/50 rounded-xl flex items-center justify-center shadow-lg active:scale-95">
              <ArrowLeft size={22} />
            </button>

            <div className="w-12 h-12 flex items-center justify-center text-slate-500 text-xs">
              🐢
            </div>

            <button
              onPointerDown={() => {
                mobileInputRef.current.right = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.right = false;
              }}
              onPointerCancel={() => {
                mobileInputRef.current.right = false;
              }}
              aria-label="向右游"
              className="min-w-[48px] min-h-[48px] w-12 h-12 bg-slate-800 active:bg-cyan-600 text-cyan-300 active:text-white border border-cyan-700/50 rounded-xl flex items-center justify-center shadow-lg active:scale-95">
              <ArrowRight size={22} />
            </button>

            <div />
            <button
              onPointerDown={() => {
                mobileInputRef.current.down = true;
              }}
              onPointerUp={() => {
                mobileInputRef.current.down = false;
              }}
              onPointerCancel={() => {
                mobileInputRef.current.down = false;
              }}
              aria-label="向下游"
              className="min-w-[48px] min-h-[48px] w-12 h-12 bg-slate-800 active:bg-cyan-600 text-cyan-300 active:text-white border border-cyan-700/50 rounded-xl flex items-center justify-center shadow-lg active:scale-95">
              <ArrowDown size={22} />
            </button>
            <div />
          </div>

          {/* Dash Action Button with Radial Cooldown */}
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <button
              onPointerDown={() => {
                mobileInputRef.current.dash = true;
                triggerDash();
              }}
              onPointerUp={() => {
                mobileInputRef.current.dash = false;
              }}
              onPointerCancel={() => {
                mobileInputRef.current.dash = false;
              }}
              disabled={dashCooldownPercent < 1}
              aria-label="龜殼衝刺技能"
              className={`min-w-[64px] min-h-[64px] w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 border shadow-xl active:scale-95 transition-all ${
                dashCooldownPercent >= 1
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300 animate-pulse'
                  : 'bg-slate-800 text-slate-500 border-slate-700 opacity-60'
              }`}>
              <Zap size={24} />
              <span className="text-[11px] font-black tracking-wider">
                {dashCooldownPercent >= 1 ? '衝刺' : `${Math.ceil((1 - dashCooldownPercent) * 3)}秒`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* --- OVERLAYS --- */}

      {/* 1. START SCREEN */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="ocean-panel p-6 md:p-8 rounded-3xl flex flex-col items-center w-full max-w-md text-center">
            <div className="pulse-ring w-20 h-20 mb-3 relative flex items-center justify-center rounded-full">
              <img
                src="assets/images/player_sea_turtle.png"
                alt="海龜"
                className="w-20 h-20 object-contain drop-shadow-lg animate-bounce"
              />
            </div>
            <div className="brand-kicker mb-2">TURTLE TIDE · OCEAN GUARDIAN</div>
            <h1 className="shimmer-title text-3xl md:text-4xl font-black mb-2 drop-shadow">
              海龜守護之戰
            </h1>
            <p className="text-slate-300 text-sm md:text-base mb-5 leading-relaxed">
              引導小海龜穿梭洶湧危機的海洋垃圾帶！躲避塑膠袋、沉重玻璃樽與幽靈漁網，平安抵達潔淨海洋庇護所！
            </p>

            <div className="w-full bg-slate-950/60 border border-cyan-900/40 rounded-xl p-3.5 mb-5 flex flex-col gap-2 text-xs text-slate-300 text-left">
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">🎮 手指拖曳：</span>
                <span>手指或滑鼠直接拖曳小海龜，亦可使用 WASD / 鍵盤方向鍵</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">⚡ 龜殼衝刺：</span>
                <span>空白鍵或點擊「衝刺」按鈕發動短暫無敵突圍技能</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">🎓 守護榮譽：</span>
                <span>存活 60 秒抵達庇護所，即可領取官方認證「海洋守護者證書」！</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  initGame();
                }}
                autoFocus
                className="ocean-button w-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-lg md:text-xl shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 active:scale-95">
                <Play size={22} fill="currentColor" />
                開始守護海龜
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsKnowledgeOpen(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                <BookOpen size={16} />
                閱讀海洋生態小知識
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 2. GAME OVER SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <MenuOverlay tone="danger" zIndex={40}>
          <div className="ocean-panel ocean-panel--danger p-6 md:p-8 rounded-3xl flex flex-col items-center w-full max-w-md text-center">
            <span className="text-5xl mb-2">🐢💔</span>
            <h2 className="text-2xl md:text-3xl font-black text-red-400 mb-2">
              哎呀！小海龜受傷了
            </h2>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              海洋垃圾密度過高，海龜承受不住衝擊！您成功守護了{' '}
              <strong className="text-yellow-300">{gameState.timer || 0} 秒</strong>，獲得得分{' '}
              <strong className="text-cyan-300">{gameState.score} 分</strong>。
            </p>

            <div className="w-full bg-red-950/40 border border-red-500/30 rounded-xl p-3 mb-5 text-xs text-slate-300 text-left">
              💡 <strong>海洋保育小提醒：</strong>
              <br />
              塑膠垃圾在海洋中需要數百年才能降解。我們的一小步行動，能為海龜帶來活下去的生機！
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  initGame();
                }}
                autoFocus
                className="w-full bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                <RotateCw size={20} />
                重新開始挑戰
              </button>

              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsCertOpen(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-yellow-500/40 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <Award size={18} />
                領取海洋守護承諾證書
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 3. VICTORY SCREEN */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory" zIndex={40}>
          <div className="ocean-panel ocean-panel--victory p-6 md:p-8 rounded-3xl flex flex-col items-center w-full max-w-md text-center">
            <span className="text-5xl mb-2 animate-bounce">🐢🏆</span>
            <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mb-2">
              恭喜抵達潔淨海洋庇護所！
            </h2>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              太棒了！您成功引導小海龜度過 60 秒驚濤駭浪的垃圾浩劫，平安抵達蔚藍純淨的海洋家園！
            </p>

            <div className="w-full bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 mb-5 text-center">
              <span className="text-xs text-emerald-300 font-bold">最終守護得分</span>
              <div className="text-3xl font-black text-yellow-300 tracking-wider">
                {gameState.score} 分
              </div>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsCertOpen(true);
                }}
                autoFocus
                className="ocean-button w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition-all active:scale-95">
                <Award size={20} />
                🎓 領取榮譽海洋守護者證書
              </button>

              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  initGame();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <RotateCw size={18} />
                再次守護挑戰
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 4. OCEAN GUARDIAN CERTIFICATE MODAL */}
      {isCertOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="ocean-panel w-full max-w-lg rounded-3xl p-5 md:p-6 flex flex-col items-center max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between w-full mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
                <Award size={22} />
                <span>海洋守護者證書（海龜篇）</span>
              </div>
              <button
                onClick={() => setIsCertOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Certificate Visual Preview */}
            <div className="w-full bg-[#fefcf5] text-slate-900 rounded-2xl p-4 md:p-5 border-4 border-[#c8a35a] shadow-inner relative mb-4 text-center">
              <div className="text-4xl mb-1">🐢</div>
              <h3 className="text-xl md:text-2xl font-black text-[#0b5c8f] tracking-widest">
                海洋守護者證書
              </h3>
              <p className="text-[11px] italic font-serif text-[#a08a5a] -mt-0.5">
                Ocean Guardian Certificate
              </p>
              <div className="w-3/4 h-0.5 bg-gradient-to-r from-transparent via-[#c8a35a] to-transparent mx-auto my-2.5" />

              <div className="text-2xl md:text-3xl font-black text-[#d1441f] tracking-wide my-1">
                {certName || '（請於下方輸入姓名）'}
              </div>
              {certClass && (
                <div className="text-xs font-bold text-[#2e5f80] mb-1">
                  班別：{certClass}
                </div>
              )}

              <p className="text-xs text-[#3b6a8a] leading-relaxed my-2">
                積極參與「海龜守護之戰」，成功守護小海龜穿越海洋垃圾危機，
                <br />
                並承諾實踐環保行動：
              </p>

              {/* Action Chips */}
              <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                {ECO_ACTIONS.filter((a) => certPledges.includes(a.id)).map((a) => (
                  <span
                    key={a.id}
                    className="text-[11px] font-bold bg-[#e2ffe9] text-[#167a3c] border border-[#8be3a8] px-2.5 py-0.5 rounded-full">
                    {a.emoji} {a.text}
                  </span>
                ))}
              </div>

              <div className="bg-[#eaf7ff] border border-dashed border-[#8fd3f4] rounded-lg py-1.5 px-3 inline-block text-xs font-black text-[#0b7fc2]">
                最終守護得分：{gameState.score} 分 · 存活時間：{gameState.timer || 0} 秒
              </div>
            </div>

            {/* Inputs: Name & Class */}
            <div className="w-full space-y-3 mb-4 text-left">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  ✏️ 守護者姓名：
                </label>
                <input
                  type="text"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  placeholder="例如：陳大明"
                  maxLength={20}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  🏫 班別 / 學校（選填）：
                </label>
                <input
                  type="text"
                  value={certClass}
                  onChange={(e) => setCertClass(e.target.value)}
                  placeholder="例如：3A 班"
                  maxLength={20}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              {/* Pledge Checkboxes */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  🌱 我承諾實踐的海洋環保行動（可多選）：
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  {ECO_ACTIONS.map((action) => {
                    const isChecked = certPledges.includes(action.id);
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => {
                          setCertPledges((prev) =>
                            isChecked
                              ? prev.filter((id) => id !== action.id)
                              : [...prev, action.id],
                          );
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left transition border ${
                          isChecked
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50'
                            : 'bg-slate-900/40 text-slate-400 border-slate-800'
                        }`}>
                        {isChecked ? (
                          <CheckSquare size={14} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Square size={14} className="text-slate-500 shrink-0" />
                        )}
                        <span>
                          {action.emoji} {action.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Download Certificate Action */}
            <div className="w-full flex flex-col md:flex-row gap-2">
              <button
                onClick={() => {
                  const pledgesToExport = ECO_ACTIONS.filter((a) =>
                    certPledges.includes(a.id),
                  );
                  generateCertificatePNG(
                    certName.trim(),
                    certClass.trim(),
                    pledgesToExport,
                    gameState.score,
                    gameState.timer || 0,
                  );
                  confetti({
                    particleCount: 80,
                    spread: 60,
                  });
                }}
                className="flex-1 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-95 text-sm md:text-base">
                <Download size={18} />
                💾 儲存證書圖片 (PNG)
              </button>

              <button
                onClick={() => setIsCertOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 px-5 rounded-xl font-bold text-sm transition active:scale-95">
                返回
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 5. MARINE KNOWLEDGE HANDBOOK MODAL */}
      {isKnowledgeOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="ocean-panel ocean-panel--victory w-full max-w-lg rounded-3xl p-5 md:p-6 flex flex-col items-center max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between w-full mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-lg">
                <BookOpen size={22} />
                <span>海洋生態與海龜保護手冊</span>
              </div>
              <button
                onClick={() => setIsKnowledgeOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Knowledge Cards */}
            <div className="w-full space-y-3 mb-5 text-left">
              {KNOWLEDGE_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="font-black text-white text-sm md:text-base">
                        {item.title}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pl-1">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Interactive Quick Quiz */}
            <div className="w-full bg-slate-950 border border-cyan-900/50 rounded-2xl p-4 mb-4 text-left">
              <div className="flex items-center gap-1.5 text-cyan-300 font-black text-sm mb-3">
                <span>🧠 海洋保育考考你</span>
              </div>

              <div className="space-y-4">
                {QUIZ_ITEMS.map((qItem, qIdx) => {
                  const selectedOpt = quizAnswers[qIdx];
                  const hasAnswered = selectedOpt !== undefined;
                  const isCorrect = selectedOpt === qItem.answer;

                  return (
                    <div key={qIdx} className="space-y-2">
                      <p className="text-xs md:text-sm font-bold text-slate-200">
                        {qIdx + 1}. {qItem.q}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {qItem.options.map((opt, optIdx) => {
                          let btnStyle =
                            'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300';
                          if (hasAnswered) {
                            if (optIdx === qItem.answer) {
                              btnStyle =
                                'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold';
                            } else if (selectedOpt === optIdx) {
                              btnStyle =
                                'bg-red-950/80 border-red-500 text-red-300';
                            }
                          }
                          return (
                            <button
                              key={optIdx}
                              disabled={hasAnswered}
                              onClick={() => {
                                setQuizAnswers((prev) => ({
                                  ...prev,
                                  [qIdx]: optIdx,
                                }));
                                if (optIdx === qItem.answer) {
                                  gameAudio.playPowerupChime();
                                } else {
                                  gameAudio.playErrorBuzz();
                                }
                              }}
                              className={`p-2.5 rounded-xl text-xs text-left border transition ${btnStyle}`}>
                              {String.fromCharCode(65 + optIdx)}. {opt}
                            </button>
                          );
                        })}
                      </div>

                      {hasAnswered && (
                        <div
                          className={`text-xs p-2.5 rounded-xl leading-relaxed ${
                            isCorrect
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                          }`}>
                          {qItem.explain}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setIsKnowledgeOpen(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition active:scale-95 text-sm md:text-base">
              我知道了，返回守護海龜
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* 6. PAUSE / GAME MENU OVERLAY */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="ocean-panel w-full max-w-md rounded-3xl p-6 flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-black text-cyan-400 mb-4 tracking-wide">
              遊戲選單
            </h2>

            <div className="w-full flex flex-col gap-3">
              {/* Resume Button */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                }}
                autoFocus
                className="w-full min-h-[48px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                <Play size={20} fill="currentColor" />
                繼續遊戲
              </button>

              {/* Toggle Traditional Chinese Labels */}
              <button
                onClick={() => {
                  setShowLabels((prev) => !prev);
                  gameAudio.playCrispClick();
                }}
                className={`w-full min-h-[48px] border font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  showLabels
                    ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                <Tag size={18} />
                繁體中文標籤：{showLabels ? '顯示中' : '已隱藏'}
              </button>

              {/* Audio Controls Group */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* SFX Toggle */}
                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setIsSfxMuted(newMuted);
                  }}
                  className={`min-h-[48px] border rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 ${
                    isSfxMuted
                      ? 'bg-red-950/80 border-red-500/50 text-red-400'
                      : 'bg-slate-800 border-cyan-700/60 text-cyan-300'
                  }`}>
                  {isSfxMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  音效: {isSfxMuted ? '關閉' : '開啟'}
                </button>

                {/* Music Toggle */}
                <button
                  onClick={() => {
                    setIsMusicMuted((prev) => !prev);
                  }}
                  className={`min-h-[48px] border rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 ${
                    isMusicMuted
                      ? 'bg-red-950/80 border-red-500/50 text-red-400'
                      : 'bg-slate-800 border-cyan-700/60 text-cyan-300'
                  }`}>
                  {isMusicMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  音樂: {isMusicMuted ? '關閉' : '開啟'}
                </button>
              </div>

              {/* Ocean Guardian Certificate */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsCertOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <Award size={18} />
                查看 / 領取海洋守護者證書
              </button>

              {/* Marine Knowledge Handbook */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsKnowledgeOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <BookOpen size={18} />
                海洋保育小知識與問答
              </button>

              {/* How to Play Button */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsHowToPlayOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <Info size={18} />
                遊戲操作玩法說明
              </button>

              {/* Restart Level */}
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  initGame();
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <RotateCw size={18} />
                重新開始挑戰
              </button>

              {/* Quit to Main Menu */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsGameMenuOpen(false);
                  setIsHowToPlayOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full min-h-[48px] bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <X size={18} />
                返回主標題
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* 7. HOW TO PLAY OVERLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="ocean-panel ocean-panel--victory w-full max-w-md rounded-3xl p-6 flex flex-col items-center text-left">
            <h2 className="text-2xl font-black text-emerald-400 mb-4 text-center">
              海龜守護之戰玩法說明
            </h2>

            <div className="w-full space-y-3 text-xs md:text-sm text-slate-300 mb-6">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-cyan-900/40">
                <p className="font-bold text-cyan-300 mb-1">🐢 靈活游動與直接拖曳</p>
                <p>
                  用手指或滑鼠直接在畫面上拖曳小海龜，海龜會迅速平滑跟隨；亦可使用 WASD / 鍵盤方向鍵操控。
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-amber-900/40">
                <p className="font-bold text-amber-300 mb-1">⚡ 堅硬龜殼衝刺（空白鍵 / 衝刺鍵）</p>
                <p>
                  發動短暫的無敵向前衝刺突圍，衝散周遭海水，技能冷卻時間為 3 秒。
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-red-900/40">
                <p className="font-bold text-red-300 mb-1">⚠️ 四大海洋垃圾危機</p>
                <p className="space-y-1">
                  • <strong>🛍️ 膠袋：</strong>隨洋流波浪擺動，形似水母極易誤食。<br />
                  • <strong>🍾 玻璃樽：</strong>急速垂直下墜，上方會出現紅色驚嘆號警示。<br />
                  • <strong>🥤 膠飲管：</strong>高速成群斜角穿梭，尖銳危險。<br />
                  • <strong>🕸️ 幽靈漁網：</strong>大範圍橫跨海域的殺手網具，請尋找並穿過有浮標標示的蔚藍避險通道！
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-emerald-900/40">
                <p className="font-bold text-emerald-300 mb-1">✨ 海洋增益道具</p>
                <p>
                  • <strong>🫧 泡泡護盾：</strong>提供一層抵擋 1 次致命垃圾傷害的水晶氣泡。<br />
                  • <strong>✨ 黃金水母：</strong>海龜的美味天然食糧，獲取高額得分與短暫游速加成。
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                gameAudio.playCrispClick();
                setIsHowToPlayOpen(false);
              }}
              autoFocus
              className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
              返回選單
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
