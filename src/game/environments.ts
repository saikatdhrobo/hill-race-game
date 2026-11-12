import type { EnvironmentId } from './types';

export type DecoStyle = 'broadleaf' | 'pine' | 'pineSnow' | 'cactus' | 'deadtree';

export interface EnvironmentConfig {
  id: EnvironmentId;
  name: string;
  tagline: string;
  description: string;
  /** coins required to unlock (0 = free) */
  cost: number;
  palette: {
    skyTop: string;
    skyBottom: string;
    fog: string;
    sun: string;
    ambientSky: string;
    ambientGround: string;
    /** low ground / valley colour */
    surfaceLow: string;
    /** high ground / crest colour */
    surfaceHigh: string;
    rock: string;
    accent: string;
    mountain: string;
    cloud: string;
  };
  fogNear: number;
  fogFar: number;
  sunIntensity: number;
  ambientIntensity: number;
  /** 0..1 — how grippy the surface is (snow/ice is low) */
  grip: number;
  roughness: number;
  /** 0..1 how strong the snow/ash cap on high ground is */
  capAmount: number;
  scenery: {
    deco: DecoStyle;
    treeDensity: number;
    rockDensity: number;
    clouds: number;
    mountains: number;
    /** colour of the sun disc / sky glow */
    horizonGlow: string;
  };
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentConfig> = {
  highlands: {
    id: 'highlands',
    name: 'Green Highlands',
    tagline: 'Soft grass, endless crests',
    description: 'Rolling pasture with scattered broadleaf trees. The friendliest of the five worlds and a great place to learn throttle control.',
    cost: 0,
    palette: {
      skyTop: '#3f7fd6',
      skyBottom: '#cfe8f5',
      fog: '#bcd9e8',
      sun: '#fff4d6',
      ambientSky: '#9fc6e8',
      ambientGround: '#3f5a34',
      surfaceLow: '#4f8f4a',
      surfaceHigh: '#7fbf5c',
      rock: '#7d7267',
      accent: '#f2c14e',
      mountain: '#6d8fa8',
      cloud: '#ffffff',
    },
    fogNear: 90,
    fogFar: 460,
    sunIntensity: 2.1,
    ambientIntensity: 0.85,
    grip: 1.0,
    roughness: 0.95,
    capAmount: 0,
    scenery: {
      deco: 'broadleaf',
      treeDensity: 1,
      rockDensity: 0.6,
      clouds: 22,
      mountains: 14,
      horizonGlow: '#ffe9b8',
    },
  },
  rockies: {
    id: 'rockies',
    name: 'Granite Ridges',
    tagline: 'Cold stone and long drops',
    description: 'High alpine granite. Loose scree, big elevation change and shelved ridges that punish a lazy throttle.',
    cost: 350,
    palette: {
      skyTop: '#2b4a78',
      skyBottom: '#a9c3d6',
      fog: '#9fb3c4',
      sun: '#ffffff',
      ambientSky: '#8aa6c4',
      ambientGround: '#3b3a3a',
      surfaceLow: '#6b6f6a',
      surfaceHigh: '#9a9d94',
      rock: '#585a5c',
      accent: '#ff9d4d',
      mountain: '#55637a',
      cloud: '#eef3f8',
    },
    fogNear: 70,
    fogFar: 420,
    sunIntensity: 2.0,
    ambientIntensity: 0.8,
    grip: 0.96,
    roughness: 1,
    capAmount: 0.28,
    scenery: {
      deco: 'pine',
      treeDensity: 0.75,
      rockDensity: 1.4,
      clouds: 16,
      mountains: 22,
      horizonGlow: '#d8e6ff',
    },
  },
  dunes: {
    id: 'dunes',
    name: 'Sunscorch Dunes',
    tagline: 'Loose sand, hard sun',
    description: 'Wind-carved dunes under a bleached sky. Sand saps your speed so keep the revs up and the nose high.',
    cost: 800,
    palette: {
      skyTop: '#e08a3c',
      skyBottom: '#f7dcae',
      fog: '#efd2a4',
      sun: '#fff1cf',
      ambientSky: '#f0c98d',
      ambientGround: '#8a5a2c',
      surfaceLow: '#d9a661',
      surfaceHigh: '#f0cd8c',
      rock: '#a9743f',
      accent: '#8f5bd6',
      mountain: '#c9a173',
      cloud: '#fff6e2',
    },
    fogNear: 100,
    fogFar: 520,
    sunIntensity: 2.4,
    ambientIntensity: 0.95,
    grip: 0.88,
    roughness: 1,
    capAmount: 0,
    scenery: {
      deco: 'cactus',
      treeDensity: 0.4,
      rockDensity: 1,
      clouds: 10,
      mountains: 12,
      horizonGlow: '#ffd79b',
    },
  },
  frostpeak: {
    id: 'frostpeak',
    name: 'Frostpeak Pass',
    tagline: 'Icy shelves, low grip',
    description: 'Frozen ridgeline where the tyres barely bite. Feather the throttle, plan every landing, and brake early.',
    cost: 1400,
    palette: {
      skyTop: '#59789e',
      skyBottom: '#dce9f5',
      fog: '#cfe0ee',
      sun: '#f4fbff',
      ambientSky: '#b8d3ea',
      ambientGround: '#5b6b7c',
      surfaceLow: '#c9dcec',
      surfaceHigh: '#f4fbff',
      rock: '#6d7a86',
      accent: '#4fd1c5',
      mountain: '#8199ad',
      cloud: '#ffffff',
    },
    fogNear: 60,
    fogFar: 380,
    sunIntensity: 1.75,
    ambientIntensity: 1.0,
    grip: 0.62,
    roughness: 0.55,
    capAmount: 0.85,
    scenery: {
      deco: 'pineSnow',
      treeDensity: 0.7,
      rockDensity: 0.8,
      clouds: 26,
      mountains: 20,
      horizonGlow: '#e8f6ff',
    },
  },
  caldera: {
    id: 'caldera',
    name: 'Ember Caldera',
    tagline: 'Basalt, ash and tight air',
    description: 'A shattered volcanic basin. Jagged black rock, glowing fissures and the biggest launches in the game.',
    cost: 2200,
    palette: {
      skyTop: '#33172a',
      skyBottom: '#b35540',
      fog: '#75352f',
      sun: '#ffc38c',
      ambientSky: '#9a5252',
      ambientGround: '#2a1e22',
      surfaceLow: '#5a4a4a',
      surfaceHigh: '#7d635c',
      rock: '#3a2f33',
      accent: '#ff7a3c',
      mountain: '#3a2027',
      cloud: '#553038',
    },
    fogNear: 70,
    fogFar: 460,
    sunIntensity: 2.5,
    ambientIntensity: 1.15,
    grip: 0.94,
    roughness: 1,
    capAmount: 0.18,
    scenery: {
      deco: 'deadtree',
      treeDensity: 0.35,
      rockDensity: 1.6,
      clouds: 8,
      mountains: 18,
      horizonGlow: '#ff8a4c',
    },
  },
};

export const ENVIRONMENT_ORDER: EnvironmentId[] = [
  'highlands',
  'rockies',
  'dunes',
  'frostpeak',
  'caldera',
];
