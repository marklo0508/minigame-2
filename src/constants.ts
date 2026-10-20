export const THEME = {
  fontFamily: "'Fredoka', 'Quicksand', system-ui, -apple-system, sans-serif",
  colors: {
    oceanDeep: '#05192d',
    oceanMid: '#083344',
    oceanCyan: '#06b6d4',
    oceanSurface: '#38bdf8',
    turtleGreen: '#10b981',
    turtleLight: '#34d399',
    gold: '#fbbf24',
    dangerRed: '#ef4444',
    shieldAqua: '#22d3ee',
  },
};

/**
 * Configuration for the game.
 */
export const CONFIG = {
  // --- Game General Settings ---
  title: {
    value: '海龜守護之戰',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 960,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // --- System Constants ---
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // --- Theme ---
  backgroundColor: {
    value: '#05192d',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#06b6d4',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: THEME.fontFamily,
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // --- Audio ---
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // --- Game Rules & Tuning ---
  startingHealth: {
    value: 5,
    type: 'number',
    label: 'Starting Health (HP)',
    group: 'Rules',
  },
  targetSurvivalTime: {
    value: 60,
    type: 'number',
    label: 'Sanctuary Survival Goal (sec)',
    group: 'Rules',
  },
  playerSpeed: {
    value: 480,
    type: 'number',
    label: 'Player Speed (px/s)',
    group: 'Movement',
  },
  dashCooldown: {
    value: 3.0,
    type: 'number',
    label: 'Dash Cooldown (sec)',
    group: 'Movement',
  },
  dashDuration: {
    value: 0.35,
    type: 'number',
    label: 'Dash Duration (sec)',
    group: 'Movement',
  },
  dashSpeedMultiplier: {
    value: 2.6,
    type: 'number',
    label: 'Dash Speed Multiplier',
    group: 'Movement',
  },
  invincibilityDuration: {
    value: 1.5,
    type: 'number',
    label: 'Hit Invincibility (sec)',
    group: 'Rules',
  },
  hazardSpawnRate: {
    value: 1.2,
    type: 'number',
    label: 'Hazard Spawn Frequency (per sec)',
    group: 'Rules',
  },
  jellyfishBonusScore: {
    value: 250,
    type: 'number',
    label: 'Jellyfish Bonus Score',
    group: 'Rules',
  },
  jellyfishSpeedBoostDuration: {
    value: 4.0,
    type: 'number',
    label: 'Jellyfish Speed Boost Duration (sec)',
    group: 'Rules',
  },

  // --- Asset Aspect Ratios and Base Dimensions ---
  assetTurtleAspectRatio: {
    value: 684 / 612, // 1.1176
    type: 'number',
    label: 'Player Turtle Aspect Ratio',
    group: 'ASSETS',
  },
  assetTurtleWidth: {
    value: 70,
    type: 'number',
    label: 'Player Turtle Width',
    group: 'ASSETS',
  },
  assetTurtleHeight: {
    value: 70 / (684 / 612), // ~62.6
    type: 'number',
    label: 'Player Turtle Height',
    group: 'ASSETS',
  },

  assetBagAspectRatio: {
    value: 508 / 600, // ~0.8467
    type: 'number',
    label: 'Plastic Bag Aspect Ratio',
    group: 'ASSETS',
  },
  assetBagWidth: {
    value: 54,
    type: 'number',
    label: 'Plastic Bag Width',
    group: 'ASSETS',
  },
  assetBagHeight: {
    value: 54 / (508 / 600), // ~63.8
    type: 'number',
    label: 'Plastic Bag Height',
    group: 'ASSETS',
  },

  assetBottleAspectRatio: {
    value: 325 / 724, // ~0.4489
    type: 'number',
    label: 'Glass Bottle Aspect Ratio',
    group: 'ASSETS',
  },
  assetBottleWidth: {
    value: 32,
    type: 'number',
    label: 'Glass Bottle Width',
    group: 'ASSETS',
  },
  assetBottleHeight: {
    value: 32 / (325 / 724), // ~71.3
    type: 'number',
    label: 'Glass Bottle Height',
    group: 'ASSETS',
  },

  assetStrawAspectRatio: {
    value: 715 / 717, // ~0.9972
    type: 'number',
    label: 'Straw Cluster Aspect Ratio',
    group: 'ASSETS',
  },
  assetStrawWidth: {
    value: 52,
    type: 'number',
    label: 'Straw Cluster Width',
    group: 'ASSETS',
  },
  assetStrawHeight: {
    value: 52 / (715 / 717), // ~52.1
    type: 'number',
    label: 'Straw Cluster Height',
    group: 'ASSETS',
  },

  assetGhostNetAspectRatio: {
    value: 886 / 620, // ~1.429
    type: 'number',
    label: 'Ghost Net Aspect Ratio',
    group: 'ASSETS',
  },
  assetGhostNetWidth: {
    value: 320,
    type: 'number',
    label: 'Ghost Net Width',
    group: 'ASSETS',
  },
  assetGhostNetHeight: {
    value: 320 / (886 / 620), // ~223.9
    type: 'number',
    label: 'Ghost Net Height',
    group: 'ASSETS',
  },

  assetBubbleAspectRatio: {
    value: 660 / 659, // ~1.0015
    type: 'number',
    label: 'Bubble Shield Aspect Ratio',
    group: 'ASSETS',
  },
  assetBubbleWidth: {
    value: 52,
    type: 'number',
    label: 'Bubble Shield Width',
    group: 'ASSETS',
  },
  assetBubbleHeight: {
    value: 52 / (660 / 659), // ~51.9
    type: 'number',
    label: 'Bubble Shield Height',
    group: 'ASSETS',
  },

  assetJellyfishAspectRatio: {
    value: 480 / 544, // ~0.8824
    type: 'number',
    label: 'Golden Jellyfish Aspect Ratio',
    group: 'ASSETS',
  },
  assetJellyfishWidth: {
    value: 46,
    type: 'number',
    label: 'Golden Jellyfish Width',
    group: 'ASSETS',
  },
  assetJellyfishHeight: {
    value: 46 / (480 / 544), // ~52.1
    type: 'number',
    label: 'Golden Jellyfish Height',
    group: 'ASSETS',
  },

  assetHeartAspectRatio: {
    value: 562 / 621, // ~0.905
    type: 'number',
    label: 'Heart Icon Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}
