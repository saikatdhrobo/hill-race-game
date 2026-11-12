import { GAME_CONFIG } from '../config';
import type { DifficultyConfig } from '../difficulties';

/**
 * Owns the run's numbers: distance, coins, checkpoints and final score.
 * Pure logic — no rendering, no DOM.
 */
export class ScoreSystem {
  distance = 0;
  maxDistance = 0;
  coins = 0;
  checkpoints = 0;
  private startX = 0;
  score = 0;

  constructor(
    private readonly diff: DifficultyConfig,
    startX: number,
    readonly bestDistance: number,
  ) {
    this.startX = startX;
  }

  update(x: number): void {
    this.distance = Math.max(0, x - this.startX);
    if (this.distance > this.maxDistance) this.maxDistance = this.distance;
    this.recalculate();
  }

  addCoins(amount: number): void {
    this.coins += amount;
    this.recalculate();
  }

  addCheckpoint(): void {
    this.checkpoints++;
    this.recalculate();
  }

  private recalculate(): void {
    const base = this.maxDistance * GAME_CONFIG.scoring.distanceScore;
    const coinScore = this.coins * GAME_CONFIG.coins.scoreValue;
    const checkpointScore = this.checkpoints * GAME_CONFIG.scoring.checkpointBonus;
    this.score = Math.round((base + coinScore + checkpointScore) * this.diff.scoreMultiplier);
  }

  get isNewBest(): boolean {
    return this.maxDistance > this.bestDistance;
  }

  progress(finishX: number): number {
    return Math.min(1, this.maxDistance / Math.max(1, finishX));
  }
}
