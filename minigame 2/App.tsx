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
  Hand,
} from 'lucide-react';
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
  // Sinusoidal bag motion
  baseX?: number;
  waveTimer?: number;
  waveFreq?: number;
  waveAmp?: number;
  // Net gap bounds
  gapX?: number;
  gapWidth?: number;
  // Warning beacon
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const lastCancelRef = useRef(false);
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

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  // Audio status stingers
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
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

      // Dash sound
      gameAudio.playRetroJump();

      // Dash bubble shockwave
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
        const speed = Math.random() * 140 + 90;
        particlesRef.current.push({
          x: turtle.x,
          y: turtle.y + turtle.height * 0.4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 4 + 2,
          color: 'rgba(255, 255, 255, 0.85)',
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

    simTimeRef.current = 0;
    hazardSpawnTimerRef.current = 0;
    itemSpawnTimerRef.current = 2.0; // spawn first item soon
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
    setDashCooldownPercent(1);
    setHasShieldState(false);
    setSpeedBoostActive(false);
    setScoreMultiplier(1);

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
          if (isHowToPlayOpenRef.current) {
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

  // --- SPAWN HAZARDS WITH ESCALATING DIFFICULTY (60 SECONDS INTENSE RAMPING) ---
  const spawnHazardWave = (time: number) => {
    const targetSurvivalTime = getConfig('targetSurvivalTime') as number;
    const progress = Math.min(1, time / targetSurvivalTime);
    // Pick hazard type based on wave intensity
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
        waveFreq: 2.4 + Math.random() * 1.6,
        waveAmp: 50 + Math.random() * 40,
      });
    } else if (roll < 0.60) {
      // 2. Glass Bottle: rapid vertical plunge with warning beacon
      const bW = getConfig('assetBottleWidth') as number;
      const bH = getConfig('assetBottleHeight') as number;
      const bX = Math.random() * (canvasWidth - bW - 60) + 30;

      // Add top warning beacon
      warningsRef.current.push({
        x: bX,
        y: 10,
        width: bW,
        type: 'BOTTLE',
        timer: 0.5,
        maxTimer: 0.5,
      });

      hazardsRef.current.push({
        id: `bottle_${Date.now()}_${Math.random()}`,
        type: 'BOTTLE',
        x: bX,
        y: -bH - 60,
        width: bW,
        height: bH,
        vx: 0,
        vy: 420 + progress * 280,
        rotation: 0,
        vRot: (Math.random() - 0.5) * 0.8,
        warningTimer: 0.5,
        ready: false,
      });
    } else if (roll < 0.82) {
      // 3. Plastic Straw Cluster: fast darting barrage
      const sW = getConfig('assetStrawWidth') as number;
      const sH = getConfig('assetStrawHeight') as number;
      const clusterCount = Math.floor(Math.random() * 2) + 2 + Math.floor(progress * 1.5);
      const originX = Math.random() * (canvasWidth - 120) + 60;
      const targetAngle =
        Math.PI * 0.5 + (Math.random() - 0.5) * (0.6 + progress * 0.5);
      const speed = 340 + progress * 220;

      for (let i = 0; i < clusterCount; i++) {
        hazardsRef.current.push({
          id: `straw_${Date.now()}_${i}_${Math.random()}`,
          type: 'STRAW',
          x: originX + (i - clusterCount / 2) * 30,
          y: -sH - i * 36 - 10,
          width: sW,
          height: sH,
          vx: Math.cos(targetAngle) * speed * 0.55,
          vy: Math.sin(targetAngle) * speed,
          rotation: targetAngle - Math.PI * 0.5,
          vRot: 0,
        });
      }
    } else {
      // 4. Ghost Fishing Net: wide sweeping hazard with a navigation gap!
      const netW = canvasWidth * 0.88;
      const netH = getConfig('assetGhostNetHeight') as number;
      const gapWidth = Math.max(90, 150 - progress * 45); // tighter gap as time goes
      const gapX = Math.random() * (canvasWidth - gapWidth - 80) + 40;

      warningsRef.current.push({
        x: canvasWidth / 2 - netW / 2,
        y: 10,
        width: netW,
        type: 'NET',
        timer: 0.8,
        maxTimer: 0.8,
      });

      hazardsRef.current.push({
        id: `net_${Date.now()}_${Math.random()}`,
        type: 'NET',
        x: canvasWidth / 2 - netW / 2,
        y: -netH - 90,
        width: netW,
        height: netH,
        vx: 0,
        vy: 180 + progress * 120,
        rotation: 0,
        vRot: 0,
        gapX,
        gapWidth,
        warningTimer: 0.8,
        ready: false,
      });
    }
  };

  // --- SPAWN COLLECTIBLES ---
  const spawnCollectible = () => {
    const isShield = Math.random() < 0.45;
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
      // Net has a gap! Collision happens if within net bounding box BUT outside gap
      const netLeft = hazard.x;
      const netRight = hazard.x + hazard.width;
      const netTop = hazard.y;
      const netBottom = hazard.y + hazard.height;
      const gapLeft = (hazard.gapX || 0);
      const gapRight = gapLeft + (hazard.gapWidth || 100);

      const inVerticalRange =
        turtleCenterY + turtleHitboxRadius > netTop &&
        turtleCenterY - turtleHitboxRadius < netBottom;
      const inHorizontalRange =
        turtleCenterX + turtleHitboxRadius > netLeft &&
        turtleCenterX - turtleHitboxRadius < netRight;

      if (inVerticalRange && inHorizontalRange) {
        // Safe if completely inside the gap with margin
        const insideGap =
          turtleCenterX - turtleHitboxRadius > gapLeft &&
          turtleCenterX + turtleHitboxRadius < gapRight;
        return !insideGap;
      }
      return false;
    }

    // Circular distance check for debris
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
      isHowToPlayOpenRef.current
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
        // High agility responsive follow without lag or jitter
        const followSpeed = Math.max(speed * 1.6, dist * 18);
        const step = Math.min(dist, followSpeed * dt);
        turtle.x += (dx / dist) * step;
        turtle.y += (dy / dist) * step;
        moveX += dx / (dist || 1);
        moveY += dy / (dist || 1);
      }
    } else {
      // Standard keyboard / virtual D-pad movement
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
      damageFlashRef.current = Math.max(0, damageFlashRef.current - dt * 2.5);
    }

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

    // --- SPAWN HAZARDS (Escalating across 60 seconds) ---
    const spawnFreq = (getConfig('hazardSpawnRate') as number) * (1 + (currentTime / targetSurvivalTime) * 1.5);
    hazardSpawnTimerRef.current += dt;
    if (hazardSpawnTimerRef.current >= 1 / spawnFreq) {
      hazardSpawnTimerRef.current = 0;
      spawnHazardWave(currentTime);
    }

    // --- SPAWN COLLECTIBLES ---
    itemSpawnTimerRef.current += dt;
    if (itemSpawnTimerRef.current >= 5.5) {
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

      // Delay activation if warning timer is active
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

      // Check Near-Miss for subtle score bonus & audio
      const distToTurtle = Math.hypot(
        turtle.x - (h.x + h.width / 2),
        turtle.y - (h.y + h.height / 2),
      );
      if (distToTurtle < turtle.width + 16 && distToTurtle > turtle.width * 0.45) {
        nearMissCountRef.current++;
        if (nearMissCountRef.current % 30 === 0) {
          gameAudio.playHoverMicroTone();
        }
      }

      // Check Collision with turtle
      if (turtle.invincibleTimer <= 0 && checkTurtleCollision(turtle, h)) {
        if (turtle.hasShield) {
          // Shield absorbs 1 hit!
          turtle.hasShield = false;
          turtle.invincibleTimer = 0.8;
          gameAudio.playShieldBlock();
          screenShakeRef.current = 6;

          // Shield pop ripple & particles
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
          // Turtle takes 1 damage
          turtle.health -= 1;
          turtle.invincibleTimer = getConfig('invincibilityDuration') as number;
          damageFlashRef.current = 0.8;
          screenShakeRef.current = 14;
          gameAudio.playGeneralDamage();

          // Damage particles
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
            // Game Over
            setGameState((prev) => ({
              ...prev,
              status: 'GAME_OVER',
              lives: 0,
            }));
            return;
          }
        }
      }

      // Keep if within screen bounds (plus margin)
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

      // Check pickup collision
      const itemCenterX = it.x + it.width / 2;
      const itemCenterY = it.y + it.height / 2;
      const dist = Math.hypot(turtle.x - itemCenterX, turtle.y - itemCenterY);

      if (dist < (turtle.width + it.width) * 0.42 && !it.collected) {
        it.collected = true;

        if (it.type === 'SHIELD') {
          turtle.hasShield = true;
          gameAudio.playPowerupChime();

          // Bubble pickup VFX
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

          setGameState((prev) => ({
            ...prev,
            score: prev.score + bonus,
          }));

          // Golden sparkle burst
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

    // --- UPDATE PARTICLES ---
    particlesRef.current.forEach((p) => {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    });
    particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

    // --- UPDATE RIPPLES ---
    ripplesRef.current.forEach((r) => {
      r.radius += (r.maxRadius - r.radius) * dt * 8;
      r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
    });
    ripplesRef.current = ripplesRef.current.filter((r) => r.alpha > 0.02);

    // --- AMBIENT BUBBLES DRIFT ---
    ambientBubblesRef.current.forEach((b) => {
      b.y -= b.speed * dt;
      b.x += b.drift * dt;
      if (b.y < -10) {
        b.y = canvasHeight + 10;
        b.x = Math.random() * canvasWidth;
      }
    });

    // --- UPDATE REACT HUD METRICS (Throttle to ~10hz) ---
    const secPassed = Math.floor(currentTime);
    if (secPassed > lastScoreSecRef.current) {
      const diff = secPassed - lastScoreSecRef.current;
      lastScoreSecRef.current = secPassed;

      // Escalating level based on survival tier across 60s
      const curLevel = Math.min(5, Math.floor(currentTime / 12) + 1);
      const mult = 1 + (curLevel - 1) * 0.5;

      setScoreMultiplier(mult);
      setGameState((prev) => ({
        ...prev,
        score: prev.score + Math.floor(15 * mult * diff),
        level: curLevel,
        timer: currentTime,
        lives: turtle.health,
      }));
    }

    // Sync fast HUD indicators
    const cdRatio =
      turtle.dashCooldownTimer <= 0
        ? 1
        : 1 - turtle.dashCooldownTimer / turtle.dashCooldownTotal;
    setDashCooldownPercent(cdRatio);
    setHasShieldState(turtle.hasShield);
    setSpeedBoostActive(turtle.speedBoostTimer > 0);
  };

  // --- RENDERING ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    // Screen Shake transformation
    ctx.save();
    if (screenShakeRef.current > 0) {
      const shakeMag = screenShakeRef.current;
      const sx = (Math.random() - 0.5) * shakeMag;
      const sy = (Math.random() - 0.5) * shakeMag;
      ctx.translate(sx, sy);
    }

    // --- PROCEDURAL OCEAN BACKGROUND ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGrad.addColorStop(0, '#0c4a6e'); // top illuminated cyan-navy
    bgGrad.addColorStop(0.5, '#072e49'); // mid ocean
    bgGrad.addColorStop(1, '#031726'); // abyssal deep
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Shimmering Sunlight Caustic Rays
    const time = simTimeRef.current;
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const rayX =
        (canvasWidth / 6) * i + Math.sin(time * 0.8 + i * 1.5) * 30 + 30;
      const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 60, canvasHeight);
      rayGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      rayGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.05)');
      rayGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rayX - 25, 0);
      ctx.lineTo(rayX + 45, 0);
      ctx.lineTo(rayX + 160, canvasHeight);
      ctx.lineTo(rayX - 20, canvasHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ambient Micro-Bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ambientBubblesRef.current.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sanctuary Progress Current Lines
    const currentSpeed = 120 + Math.sin(time) * 20;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 2;
    for (let c = 0; c < 5; c++) {
      const lineY = ((time * currentSpeed + c * 200) % (canvasHeight + 100)) - 50;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.bezierCurveTo(
        canvasWidth * 0.3,
        lineY + 30,
        canvasWidth * 0.7,
        lineY - 30,
        canvasWidth,
        lineY,
      );
      ctx.stroke();
    }

    // --- DRAW WARNING BEACONS ---
    warningsRef.current.forEach((w) => {
      const pulse = 0.5 + Math.sin(time * 18) * 0.5;
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.5})`;
      ctx.strokeStyle = `rgba(254, 202, 202, ${0.8 + pulse * 0.2})`;
      ctx.lineWidth = 2;

      // Draw beacon triangle indicator
      const bX = w.x + w.width / 2;
      ctx.beginPath();
      ctx.moveTo(bX, 24);
      ctx.lineTo(bX - 14, 8);
      ctx.lineTo(bX + 14, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Warning exclamation mark
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', bX, 20);
      ctx.restore();
    });

    // --- DRAW RIPPLES ---
    ripplesRef.current.forEach((r) => {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0, r.radius), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // --- DRAW COLLECTIBLE ITEMS ---
    itemsRef.current.forEach((it) => {
      if (it.collected) return;
      ctx.save();

      // Soft glow aura
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

      // Draw item sprite
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
      ctx.restore();
    });

    // --- DRAW HAZARDS ---
    hazardsRef.current.forEach((h) => {
      if (h.warningTimer && h.warningTimer > 0) return;

      ctx.save();
      ctx.translate(h.x + h.width / 2, h.y + h.height / 2);
      ctx.rotate(h.rotation);

      if (h.type === 'NET') {
        // Ghost fishing net (wide spanning barrier with illuminated safe passage channel)
        ctx.translate(-(h.x + h.width / 2), -(h.y + h.height / 2));

        const gapLeft = h.gapX || 100;
        const gapWidth = h.gapWidth || 120;
        const gapRight = gapLeft + gapWidth;
        const netTop = h.y;
        const netBottom = h.y + h.height;
        const netH = h.height;

        // 1. RENDER SAFE PASSAGE WATER CHANNEL (Luminous cyan-aquamarine stream over natural ocean)
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

        // Directional Water Current Flow Streaks with guide chevrons through the gap
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

            // Stream directional arrowhead
            ctx.beginPath();
            ctx.moveTo(fx - 4, fy + 3);
            ctx.lineTo(fx, fy + 8);
            ctx.lineTo(fx + 4, fy + 3);
            ctx.stroke();
          }
        }

        // Shimmering micro-bubbles inside the safe passage
        for (let b = 0; b < 6; b++) {
          const bubblePhase = (time * 1.6 + b * 1.35) % 1;
          const bx = gapLeft + 12 + ((b * 37) % (gapWidth - 24));
          const by = netTop - 12 + bubblePhase * (netH + 24);
          const br = 1.5 + (b % 3);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.75 * (1 - Math.abs(bubblePhase - 0.5) * 1.8)})`;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }

        // Glowing Edge Highlight Beams bordering the net opening
        const leftEdgeGlow = ctx.createLinearGradient(gapLeft - 12, 0, gapLeft + 6, 0);
        leftEdgeGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
        leftEdgeGlow.addColorStop(1, 'rgba(34, 211, 238, 0.55)');
        ctx.fillStyle = leftEdgeGlow;
        ctx.fillRect(gapLeft - 12, netTop - 12, 12, netH + 24);

        const rightEdgeGlow = ctx.createLinearGradient(gapRight - 6, 0, gapRight + 12, 0);
        rightEdgeGlow.addColorStop(0, 'rgba(34, 211, 238, 0.55)');
        rightEdgeGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = rightEdgeGlow;
        ctx.fillRect(gapRight, netTop - 12, 12, netH + 24);

        // Vertical boundary glow lines
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(gapLeft, netTop - 12);
        ctx.lineTo(gapLeft, netBottom + 12);
        ctx.moveTo(gapRight, netTop - 12);
        ctx.lineTo(gapRight, netBottom + 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // 2. RENDER GHOST NET MESH ONLY IN THE TWO WINGS (PRESERVING NATURAL WATER IN GAP)
        ctx.save();
        ctx.beginPath();
        // Left net wing
        ctx.rect(h.x, netTop, Math.max(0, gapLeft - h.x), netH);
        // Right net wing
        ctx.rect(gapRight, netTop, Math.max(0, h.x + h.width - gapRight), netH);
        ctx.clip();

        // Draw Net Asset spanning wings with woven nylon mesh fallback
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

            fallbackCtx.strokeStyle = 'rgba(20, 184, 166, 0.45)';
            fallbackCtx.lineWidth = 1.5;
            const step = 20;
            for (let gx = h.x; gx < h.x + h.width; gx += step) {
              fallbackCtx.beginPath();
              fallbackCtx.moveTo(gx, netTop);
              fallbackCtx.lineTo(gx + netH * 0.7, netTop + netH);
              fallbackCtx.stroke();
              fallbackCtx.beginPath();
              fallbackCtx.moveTo(gx, netTop + netH);
              fallbackCtx.lineTo(gx + netH * 0.7, netTop);
              fallbackCtx.stroke();
            }
          },
        );

        // Heavy nylon border cords across the net wings
        ctx.strokeStyle = 'rgba(15, 118, 110, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x, netTop + 4);
        ctx.lineTo(h.x + h.width, netTop + 4);
        ctx.moveTo(h.x, netBottom - 4);
        ctx.lineTo(h.x + h.width, netBottom - 4);
        ctx.stroke();

        // Small red warning marker floats attached along the net wings
        for (let fx = h.x + 24; fx < h.x + h.width; fx += 52) {
          if (fx < gapLeft - 12 || fx > gapRight + 12) {
            ctx.fillStyle = '#ea580c';
            ctx.strokeStyle = '#9a3412';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(fx, netTop + 4, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();

        // 3. RENDER DISTINCTIVE WARNING BUOYS AT THE GAP ENTRANCE & BOUNDARIES
        ctx.save();
        const buoyPoints = [
          {x: gapLeft, y: netTop + 4},
          {x: gapLeft, y: netTop + netH * 0.5},
          {x: gapLeft, y: netBottom - 4},
          {x: gapRight, y: netTop + 4},
          {x: gapRight, y: netTop + netH * 0.5},
          {x: gapRight, y: netBottom - 4},
        ];

        buoyPoints.forEach((bp, idx) => {
          const buoyPulse = 1 + Math.sin(time * 6 + idx * 1.2) * 0.12;
          ctx.save();
          ctx.translate(bp.x, bp.y);
          ctx.scale(buoyPulse, buoyPulse);

          // Buoy glowing halo
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 10;

          // Glowing neon yellow-orange float buoy
          const buoyGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
          buoyGrad.addColorStop(0, '#fef08a');
          buoyGrad.addColorStop(0.6, '#f59e0b');
          buoyGrad.addColorStop(1, '#b45309');

          ctx.fillStyle = buoyGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Reflective center stripe
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-1.5, -5.5, 3, 11);
          ctx.restore();
        });
        ctx.restore();
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
      }
      ctx.restore();
    });

    // --- DRAW PARTICLES ---
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

    // --- DRAW PLAYER TURTLE ---
    const turtle = turtleRef.current;
    const isFlashing =
      turtle.invincibleTimer > 0 && Math.floor(time * 18) % 2 === 0;

    if (!isFlashing) {
      ctx.save();
      ctx.translate(turtle.x, turtle.y);
      ctx.rotate(turtle.rotation);

      // Dash trail glow
      if (turtle.dashTimer > 0) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16;
      } else if (turtle.speedBoostTimer > 0) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
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

      // Draw Bubble Shield around turtle if active
      if (turtle.hasShield) {
        ctx.save();
        const shieldPulse = 1 + Math.sin(time * 6) * 0.05;
        const shieldR = (turtle.width * 0.65) * shieldPulse;

        ctx.shadowColor = 'rgba(34, 211, 238, 0.8)';
        ctx.shadowBlur = 12;

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

      ctx.restore();
    }

    // Direct touch/drag target indicator ring when active
    const input = inputRef.current;
    if (input.pointer.down) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(input.pointer.x, input.pointer.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // --- DAMAGE VIGNETTE FLASH ---
    if (damageFlashRef.current > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${damageFlashRef.current * 0.4})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }

    ctx.restore(); // restore screen shake
  };

  // --- GAME LOOP ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      // Input cancel check
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          const currentStatus = gameStateRef.current.status;
          if (currentStatus === 'PLAYING') {
            setIsGameMenuOpen((prev) => !prev);
          } else if (currentStatus === 'START') {
            void exitChat({});
          } else if (
            ['GAME_OVER', 'VICTORY', 'LEVEL_COMPLETE'].includes(currentStatus)
          ) {
            setGameState((prev) => ({...prev, status: 'START'}));
          }
        }
        lastCancelRef.current = cancelPressed;
      }

      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [exitChat]);

  const isMusicPlaying =
    gameState.status === 'PLAYING' &&
    !isGameMenuOpen &&
    !isHowToPlayOpen;

  const targetSurvivalTime = getConfig('targetSurvivalTime') as number;
  const currentTimer = Math.min(targetSurvivalTime, gameState.timer || 0);
  const survivalProgressPercent = Math.min(
    100,
    Math.floor((currentTimer / targetSurvivalTime) * 100),
  );

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden touch-none flex flex-col bg-slate-950 text-white select-none"
      style={{fontFamily: THEME.fontFamily}}>
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white">
          <div className="text-2xl font-bold animate-pulse text-cyan-400">
            正在潛入蔚藍深海...
          </div>
        </div>
      )}

      {/* Dynamic Background Music */}
      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
      />

      {/* DEDICATED TOP HUD BAR */}
      <div className="w-full bg-slate-900/90 border-b border-cyan-900/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 shadow-lg">
        {/* Left: Health Hearts & Buff Tags */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/70 px-2 py-1 rounded-xl border border-cyan-900/40">
            {Array.from({length: getConfig('startingHealth') as number}).map(
              (_, i) => (
                <div key={i} className="relative w-6 h-6 flex items-center justify-center">
                  <img
                    src="assets/images/ui_heart_icon.png"
                    alt="Heart"
                    className={`w-6 h-6 object-contain transition-transform duration-200 ${
                      i < (gameState.lives ?? 0)
                        ? 'scale-100 opacity-100'
                        : 'scale-75 opacity-25 grayscale'
                    }`}
                  />
                </div>
              ),
            )}
          </div>

          {hasShieldState && (
            <div className="flex items-center gap-1 bg-cyan-950/80 border border-cyan-400/60 rounded-full px-2.5 py-1 text-xs text-cyan-300 font-bold animate-pulse">
              <Shield size={13} className="text-cyan-400" />
              <span>護盾</span>
            </div>
          )}

          {speedBoostActive && (
            <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-400/60 rounded-full px-2.5 py-1 text-xs text-amber-300 font-bold animate-bounce">
              <Sparkles size={13} className="text-amber-400" />
              <span>加速</span>
            </div>
          )}
        </div>

        {/* Center: Sanctuary Survival Progress & Score */}
        <div className="flex items-center gap-3">
          {/* Progress to Sanctuary */}
          <div className="flex flex-col items-center">
            <div className="text-[11px] font-bold text-cyan-400 tracking-wider">
              庇護所進度: {survivalProgressPercent}%
            </div>
            <div className="w-24 sm:w-36 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-cyan-800/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{width: `${survivalProgressPercent}%`}}
              />
            </div>
          </div>

          {/* Time & Score */}
          <div className="text-right">
            <div className="text-xs font-bold text-slate-300">
              存活: {formatTime(currentTimer)} / {formatTime(targetSurvivalTime)}
            </div>
            <div className="text-sm font-black text-yellow-400">
              {gameState.score} 分
            </div>
          </div>
        </div>

        {/* Top-Right: Game Menu Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              gameAudio.playCrispClick();
              setIsGameMenuOpen(true);
            }}
            aria-label="開啟選單"
            className="min-w-[48px] min-h-[48px] bg-slate-800 hover:bg-cyan-700 active:scale-95 text-cyan-300 hover:text-white border border-cyan-600/40 rounded-xl px-3 flex items-center justify-center gap-1.5 shadow-md transition-all">
            <Menu size={18} />
            <span className="text-xs font-bold">選單</span>
          </button>
        </div>
      </div>

      {/* GAMEPLAY CANVAS CONTAINER */}
      <div className="flex-1 w-full min-h-0 flex items-center justify-center bg-slate-950 relative overflow-hidden">
        {assetsReady && (
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
            }}
            className="h-auto max-w-full max-h-full drop-shadow-2xl shadow-cyan-950/50 cursor-grab active:cursor-grabbing"
          />
        )}

        {/* In-Game Touch & Drag Quick Guidance Banner */}
        {gameState.status === 'PLAYING' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-sm border border-cyan-500/30 px-3 py-1 rounded-full text-[11px] text-cyan-200 shadow-md">
            <Hand size={13} className="text-cyan-400 animate-pulse" />
            <span>用手指或滑鼠拖曳海龜進行閃避</span>
          </div>
        )}
      </div>

      {/* MOBILE TOUCH CONTROLS (UNCONDITIONALLY RENDERED WHEN isMobile IS TRUE) */}
      {isMobile && gameState.status === 'PLAYING' && (
        <div className="w-full bg-slate-900/95 border-t border-cyan-900/50 p-2 flex items-center justify-between px-6 sm:px-12 z-20 shrink-0 select-none touch-none">
          {/* Virtual D-Pad */}
          <div className="grid grid-cols-3 gap-1 w-32 h-32 items-center justify-center">
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

            <div className="w-12 h-12 flex items-center justify-center text-[10px] text-cyan-500 font-bold">
              游動
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
          <div className="flex flex-col items-center gap-1">
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
              aria-label="衝刺技能"
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

      {/* START SCREEN */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={40}>
          <div className="bg-slate-900/95 border-2 border-cyan-500/60 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col items-center w-full max-w-md text-center backdrop-blur-md">
            <div className="w-20 h-20 mb-3 relative flex items-center justify-center">
              <img
                src="assets/images/player_sea_turtle.png"
                alt="海龜"
                className="w-20 h-20 object-contain drop-shadow-lg animate-bounce"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-2 text-cyan-400 drop-shadow">
              海龜守護之戰
            </h1>
            <p className="text-slate-300 text-sm md:text-base mb-5 leading-relaxed">
              引導海龜穿越危機四伏的海洋垃圾帶！躲避塑膠袋、沉重玻璃瓶與幽靈漁網，在 60 秒內平安抵達潔淨海洋庇護所！
            </p>

            <div className="w-full bg-slate-950/60 border border-cyan-900/40 rounded-xl p-3.5 mb-6 flex flex-col gap-2 text-xs text-slate-300 text-left">
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold shrink-0">🎮 拖曳移動：</span>
                <span>手指或滑鼠直接拖曳海龜，亦可使用 WASD / 方向鍵</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">⚡ 衝刺突圍：</span>
                <span>空白鍵或點擊「衝刺」按鈕發動短暫無敵衝刺</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">🛡️ 勝利目標：</span>
                <span>保持 5 點生命值，成功存活 60 秒即可抵達庇護所獲勝！</span>
              </div>
            </div>

            <button
              onClick={() => {
                gameAudio.playConfirmSelect();
                initGame();
              }}
              autoFocus
              className="w-full bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-lg md:text-xl shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 active:scale-95">
              <Play size={22} fill="currentColor" />
              開始遊戲
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GAME OVER SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="海洋污染嚴重，挑戰失敗"
          description={`海龜遭受過多垃圾衝擊！您成功存活了 ${formatTime(gameState.timer || 0)}，獲得 ${gameState.score} 分。`}
          actionLabel="再試一次"
          onAction={() => {
            gameAudio.playConfirmSelect();
            initGame();
          }}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}

      {/* VICTORY SCREEN */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="恭喜抵達潔淨海洋庇護所！"
          description={`太棒了！您成功引導海龜度過 60 秒驚濤駭浪的垃圾浩劫，平安抵達蔚藍純淨的海洋家園！最終得分：${gameState.score}`}
          actionLabel="再次挑戰"
          onAction={() => {
            gameAudio.playConfirmSelect();
            initGame();
          }}
          icon={<Trophy size={24} />}
          tone="victory"
        />
      )}

      {/* PAUSE / GAME MENU OVERLAY */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-500/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center backdrop-blur-md">
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

              {/* How to Play Button */}
              <button
                onClick={() => {
                  gameAudio.playCrispClick();
                  setIsHowToPlayOpen(true);
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <Info size={18} />
                玩法說明
              </button>

              {/* Try Again / Restart Level */}
              <button
                onClick={() => {
                  gameAudio.playConfirmSelect();
                  initGame();
                }}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                <RotateCw size={18} />
                重新開始
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
                返回標題
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY OVERLAY (ON TOP OF GAME MENU) */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center backdrop-blur-md text-left">
            <h2 className="text-2xl font-black text-emerald-400 mb-4 text-center">
              遊戲玩法說明
            </h2>

            <div className="w-full space-y-3 text-xs md:text-sm text-slate-300 mb-6">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-cyan-900/40">
                <p className="font-bold text-cyan-300 mb-1">🐢 靈活游動與直接拖曳</p>
                <p>
                  用手指或滑鼠直接在畫面上拖曳海龜，海龜會迅速平滑跟隨；亦可使用 WASD / 鍵盤方向鍵或虛擬搖桿操控。
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-amber-900/40">
                <p className="font-bold text-amber-300 mb-1">⚡ 堅硬龜殼衝刺（空白鍵 / 衝刺鍵）</p>
                <p>
                  發動短暫的無敵向前衝刺，突破重重垃圾包圍，技能冷卻時間為 3 秒。
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-red-900/40">
                <p className="font-bold text-red-300 mb-1">⚠️ 海洋垃圾危機</p>
                <p className="space-y-1">
                  • <strong>漂浮塑膠袋：</strong>隨海流呈波浪狀擺動飄移。<br />
                  • <strong>沉重玻璃瓶：</strong>急速垂直下墜，上方會出現紅色驚嘆號預警。<br />
                  • <strong>塑膠吸管束：</strong>高速成群散射穿梭。<br />
                  • <strong>幽靈廢棄漁網：</strong>大範圍橫跨海域的網狀障礙，請尋找並穿過蔚藍透亮、浮標標示的洋流安全通道！
                </p>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-emerald-900/40">
                <p className="font-bold text-emerald-300 mb-1">✨ 海洋增益道具</p>
                <p>
                  • <strong>氣泡護盾：</strong>提供一層抵擋 1 次傷害的保護罩。<br />
                  • <strong>發光黃金水母：</strong>獲取高額額外得分與短暫游速加成。
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
