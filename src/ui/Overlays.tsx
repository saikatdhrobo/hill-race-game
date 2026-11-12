import type { CrashReason, RunResult } from '../game/types';
import { CoinIcon, FlagIcon, GearIcon, HomeIcon, PlayIcon, RestartIcon } from './Icons';

interface PauseProps {
  distance: number;
  coins: number;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
  respawnsAvailable: number;
}

export function PauseOverlay({
  distance,
  coins,
  onResume,
  onRestart,
  onSettings,
  onQuit,
  respawnsAvailable,
}: PauseProps) {
  return (
    <div className="overlay">
      <div className="card">
        <h2>Paused</h2>
        <p className="sub">Catch your breath — the hills are not going anywhere.</p>
        <div className="stat-grid">
          <div className="stat">
            <div className="k">Distance</div>
            <div className="v">
              {Math.round(distance)}
              <small> m</small>
            </div>
          </div>
          <div className="stat">
            <div className="k">Coins</div>
            <div className="v">{coins}</div>
          </div>
          <div className="stat">
            <div className="k">Respawns</div>
            <div className="v">{respawnsAvailable}</div>
          </div>
        </div>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={onResume}>
            <PlayIcon style={{ width: 16, height: 16 }} /> Resume
          </button>
          <button className="btn" onClick={onRestart}>
            <RestartIcon style={{ width: 16, height: 16 }} /> Restart
          </button>
        </div>
        <div className="card-actions" style={{ marginTop: 10 }}>
          <button className="btn btn-ghost" onClick={onSettings}>
            <GearIcon style={{ width: 16, height: 16 }} /> Settings
          </button>
          <button className="btn btn-ghost" onClick={onQuit}>
            <HomeIcon style={{ width: 16, height: 16 }} /> Main menu
          </button>
        </div>
        <p className="pause-hint">Esc resumes · R restarts at any time</p>
      </div>
    </div>
  );
}

interface ResultProps {
  result: RunResult;
  reason: CrashReason | null;
  canContinue: boolean;
  respawnsLeft: number;
  onRetry: () => void;
  onContinue: () => void;
  onMenu: () => void;
}

const reasonText: Record<CrashReason, string> = {
  flip: 'You flipped it. The rig landed on its roof.',
  stuck: 'Bogged down — the rig could not find grip.',
  fall: 'You dropped off the ridge into the valley.',
};

export function ResultOverlay({
  result,
  reason,
  canContinue,
  respawnsLeft,
  onRetry,
  onContinue,
  onMenu,
}: ResultProps) {
  return (
    <div className="overlay">
      <div className="card">
        <h2>
          {result.completed ? 'Stage complete!' : 'Wrecked'}
          {result.isNewBest && !result.completed && <span className="badge-new">New best</span>}
        </h2>
        <p className="sub">
          {result.completed
            ? `You cleared every metre of the stage. +${result.bonusCoins} bonus coins.`
            : reason
              ? reasonText[reason]
              : 'Run over.'}
        </p>

        <div className="stat-grid">
          <div className="stat">
            <div className="k">Distance</div>
            <div className="v">
              {result.distance}
              <small> m</small>
            </div>
          </div>
          <div className="stat">
            <div className="k">Coins</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <CoinIcon style={{ width: 16, height: 16 }} />
              {result.coins}
            </div>
          </div>
          <div className="stat">
            <div className="k">Score</div>
            <div className="v">{result.score.toLocaleString()}</div>
          </div>
        </div>

        <div className="spec-list" style={{ marginBottom: 18 }}>
          <div className="spec">
            <span>Stage best</span>
            <b>
              {Math.round(result.best)} m{result.isNewBest && <span className="badge-new">Best</span>}
            </b>
          </div>
          <div className="spec">
            <span>Wallet</span>
            <b>{result.totalCoins} coins</b>
          </div>
        </div>

        {canContinue && (
          <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={onContinue}>
            <FlagIcon style={{ width: 16, height: 16 }} />
            Continue from checkpoint · {respawnsLeft} left
          </button>
        )}

        <div className="card-actions">
          <button className="btn btn-primary" onClick={onRetry}>
            <RestartIcon style={{ width: 16, height: 16 }} /> Retry stage
          </button>
          <button className="btn" onClick={onMenu}>
            <HomeIcon style={{ width: 16, height: 16 }} /> Main menu
          </button>
        </div>
      </div>
    </div>
  );
}

interface LoadingProps {
  label?: string;
}

export function LoadingOverlay({ label = 'Building the hills…' }: LoadingProps) {
  return (
    <div className="loading">
      <div>
        <div className="loader-ring" />
        <div style={{ fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
