/** Shared types used across the game engine. */

export type DifficultyId = 'easy' | 'medium' | 'hard';
export type EnvironmentId = 'highlands' | 'rockies' | 'dunes' | 'frostpeak' | 'caldera';
export type VehicleId = 'tumble' | 'boulder' | 'ridgeback' | 'hauly' | 'apex';

export type GamePhase = 'ready' | 'running' | 'paused' | 'crashed' | 'complete';

/** Unified input surface — keyboard, mouse and touch all write here. */
export interface ControlState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. 1 (right)
  tilt: number; // -1 (nose down) .. 1 (nose up)
  handbrake: number; // 0..1
}

export type ActionName =
  | 'throttle'
  | 'brake'
  | 'left'
  | 'right'
  | 'handbrake';

/** Snapshot pushed to the React HUD a few times per second. */
export interface HudSnapshot {
  distance: number;
  progress: number;
  score: number;
  coins: number;
  speedKmh: number;
  airborne: boolean;
  gear: string;
  checkpoints: number;
  best: number;
}

export type CrashReason = 'flip' | 'stuck' | 'fall';

export interface RunResult {
  distance: number;
  coins: number;
  score: number;
  best: number;
  isNewBest: boolean;
  difficulty: DifficultyId;
  environment: EnvironmentId;
  vehicle: VehicleId;
  completed: boolean;
  bonusCoins: number;
  totalCoins: number;
}

export interface EngineCallbacks {
  onHud: (snapshot: HudSnapshot) => void;
  onCrash: (result: RunResult, reason: CrashReason) => void;
  onComplete: (result: RunResult) => void;
  onCheckpoint: (index: number, respawnsLeft: number) => void;
  onShopUpdate?: () => void;
  /** Fired when the engine pauses/resumes itself (tab hidden, Esc key). */
  onPauseChange?: (paused: boolean) => void;
}
