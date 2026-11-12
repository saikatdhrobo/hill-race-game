import type { DifficultyId } from './types';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  tagline: string;
  blurb: string;
  /** metres of drivable track */
  trackLength: number;
  /** rolling hill amplitude (metres) */
  amplitude: number;
  /** primary hill wavelength driver */
  frequency: number;
  /** extra high frequency roughness added on top */
  roughness: number;
  /** number of launch ramps / crests */
  rampCount: number;
  /** height of those ramps */
  rampHeight: number;
  /** width of the drivable corridor (metres) */
  corridorWidth: number;
  /** how far the ground falls away outside the corridor */
  cliffDrop: number;
  /** hard cap on drive-line gradient (rise/run) so every crest stays climbable */
  maxGradient: number;
  /** gravity/engine handicap multiplier */
  engineScale: number;
  gripScale: number;
  coinDensity: number;
  obstacleDensity: number;
  checkpointInterval: number;
  /** coins granted for finishing the track */
  finishBonus: number;
  scoreMultiplier: number;
  /** respawns allowed from the last checkpoint */
  checkpointRespawns: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    tagline: 'Rolling meadows',
    blurb: 'Gentle hills, wide terrain and forgiving suspension. Perfect for learning the balance of the rig.',
    trackLength: 780,
    amplitude: 3.1,
    frequency: 0.021,
    roughness: 0.45,
    rampCount: 6,
    rampHeight: 1.5,
    corridorWidth: 58,
    cliffDrop: 6,
    maxGradient: 0.55,
    engineScale: 1.08,
    gripScale: 1.06,
    coinDensity: 1.15,
    obstacleDensity: 0.35,
    checkpointInterval: 200,
    finishBonus: 120,
    scoreMultiplier: 1,
    checkpointRespawns: 2,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    tagline: 'Broken ridgelines',
    blurb: 'Steeper climbs, real air time and a narrower corridor. Momentum management matters here.',
    trackLength: 980,
    amplitude: 5.4,
    frequency: 0.026,
    roughness: 0.95,
    rampCount: 10,
    rampHeight: 2.8,
    corridorWidth: 40,
    cliffDrop: 20,
    maxGradient: 0.66,
    engineScale: 1,
    gripScale: 1,
    coinDensity: 1,
    obstacleDensity: 1,
    checkpointInterval: 220,
    finishBonus: 220,
    scoreMultiplier: 1.35,
    checkpointRespawns: 1,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    tagline: 'Knife-edge ridges',
    blurb: 'Brutal gradients, huge launches and a thin shelf of rock. One wrong landing ends the run.',
    trackLength: 1180,
    amplitude: 7.2,
    frequency: 0.031,
    roughness: 1.5,
    rampCount: 14,
    rampHeight: 4.6,
    corridorWidth: 24,
    cliffDrop: 48,
    maxGradient: 0.72,
    engineScale: 0.94,
    gripScale: 0.96,
    coinDensity: 0.85,
    obstacleDensity: 1.6,
    checkpointInterval: 240,
    finishBonus: 380,
    scoreMultiplier: 1.8,
    checkpointRespawns: 0,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'medium', 'hard'];
