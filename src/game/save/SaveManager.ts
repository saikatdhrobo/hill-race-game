import type { DifficultyId, EnvironmentId, VehicleId } from '../types';
import { ENVIRONMENTS } from '../environments';
import { VEHICLES } from '../vehicles';

export interface SaveData {
  version: number;
  coins: number;
  bestDistance: number;
  bestByEnvironment: Partial<Record<EnvironmentId, number>>;
  unlockedVehicles: VehicleId[];
  unlockedEnvironments: EnvironmentId[];
  selectedVehicle: VehicleId;
  selectedEnvironment: EnvironmentId;
  difficulty: DifficultyId;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    muted: boolean;
    quality: 'auto' | 'low' | 'high';
    showTouchControls: 'auto' | 'on' | 'off';
  };
  stats: {
    runs: number;
    totalDistance: number;
    totalCoins: number;
  };
}

const STORAGE_KEY = 'ridgeline-rally.save.v1';
const SAVE_VERSION = 1;

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    bestDistance: 0,
    bestByEnvironment: {},
    unlockedVehicles: ['tumble'],
    unlockedEnvironments: ['highlands'],
    selectedVehicle: 'tumble',
    selectedEnvironment: 'highlands',
    difficulty: 'easy',
    settings: {
      sfxVolume: 0.8,
      musicVolume: 0.35,
      muted: false,
      quality: 'auto',
      showTouchControls: 'auto',
    },
    stats: { runs: 0, totalDistance: 0, totalCoins: 0 },
  };
}

/**
 * localStorage-backed progression. Every write is defensive: private-mode
 * browsers or disabled storage must never break the game.
 */
export class SaveManager {
  private data: SaveData;
  private writeScheduled = false;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    const base = defaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const merged: SaveData = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        stats: { ...base.stats, ...(parsed.stats ?? {}) },
        bestByEnvironment: { ...(parsed.bestByEnvironment ?? {}) },
      };
      // sanitise against current content tables so removed ids never break the UI
      merged.unlockedVehicles = (merged.unlockedVehicles ?? []).filter(
        (id) => id in VEHICLES,
      );
      merged.unlockedEnvironments = (merged.unlockedEnvironments ?? []).filter(
        (id) => id in ENVIRONMENTS,
      );
      if (!merged.unlockedVehicles.includes('tumble')) merged.unlockedVehicles.push('tumble');
      if (!merged.unlockedEnvironments.includes('highlands')) merged.unlockedEnvironments.push('highlands');
      if (!(merged.selectedVehicle in VEHICLES)) merged.selectedVehicle = 'tumble';
      if (!(merged.selectedEnvironment in ENVIRONMENTS)) merged.selectedEnvironment = 'highlands';
      return merged;
    } catch {
      return base;
    }
  }

  /** Debounced write so collecting a coin doesn't hammer localStorage. */
  private scheduleWrite(): void {
    if (this.writeScheduled) return;
    this.writeScheduled = true;
    const flush = () => {
      this.writeScheduled = false;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch {
        /* storage unavailable — progress simply won't persist */
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(flush);
    } else {
      setTimeout(flush, 120);
    }
  }

  get snapshot(): SaveData {
    return this.data;
  }

  get coins(): number {
    return this.data.coins;
  }

  get bestDistance(): number {
    return this.data.bestDistance;
  }

  bestFor(env: EnvironmentId): number {
    return this.data.bestByEnvironment[env] ?? 0;
  }

  addCoins(amount: number): void {
    this.data.coins += amount;
    this.data.stats.totalCoins += Math.max(0, amount);
    this.scheduleWrite();
  }

  spendCoins(amount: number): boolean {
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.scheduleWrite();
    return true;
  }

  recordRun(env: EnvironmentId, distance: number, coins: number): { isNewBest: boolean; best: number } {
    this.data.stats.runs += 1;
    this.data.stats.totalDistance += distance;
    const previousBest = this.bestFor(env);
    const isNewBest = distance > previousBest;
    if (isNewBest) this.data.bestByEnvironment[env] = distance;
    if (distance > this.data.bestDistance) this.data.bestDistance = distance;
    this.data.coins += coins;
    this.scheduleWrite();
    return { isNewBest, best: Math.max(previousBest, distance) };
  }

  unlockVehicle(id: VehicleId): boolean {
    if (this.data.unlockedVehicles.includes(id)) return true;
    const cost = VEHICLES[id].cost;
    if (!this.spendCoins(cost)) return false;
    this.data.unlockedVehicles.push(id);
    this.data.selectedVehicle = id;
    this.scheduleWrite();
    return true;
  }

  unlockEnvironment(id: EnvironmentId): boolean {
    if (this.data.unlockedEnvironments.includes(id)) return true;
    const cost = ENVIRONMENTS[id].cost;
    if (!this.spendCoins(cost)) return false;
    this.data.unlockedEnvironments.push(id);
    this.data.selectedEnvironment = id;
    this.scheduleWrite();
    return true;
  }

  isVehicleUnlocked(id: VehicleId): boolean {
    return this.data.unlockedVehicles.includes(id);
  }

  isEnvironmentUnlocked(id: EnvironmentId): boolean {
    return this.data.unlockedEnvironments.includes(id);
  }

  selectVehicle(id: VehicleId): void {
    this.data.selectedVehicle = id;
    this.scheduleWrite();
  }

  selectEnvironment(id: EnvironmentId): void {
    this.data.selectedEnvironment = id;
    this.scheduleWrite();
  }

  setDifficulty(id: DifficultyId): void {
    this.data.difficulty = id;
    this.scheduleWrite();
  }

  updateSettings(patch: Partial<SaveData['settings']>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.scheduleWrite();
  }

  /** Nukes local progress — used by the "reset progress" button in settings. */
  reset(): void {
    this.data = defaults();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.scheduleWrite();
  }
}
