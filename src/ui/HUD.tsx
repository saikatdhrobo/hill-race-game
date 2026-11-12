import type { HudSnapshot } from '../game/types';
import { CoinIcon, PauseIcon, RestartIcon } from './Icons';

interface Props {
  hud: HudSnapshot;
  onPause: () => void;
  onRestart: () => void;
  /** True while the on-screen pedals are visible, so the layout avoids them. */
  compact?: boolean;
}

export function HUD({ hud, onPause, onRestart, compact = false }: Props) {
  return (
    <div className="hud">
      <div className="hud-top">
        <div>
          <div className="hud-cluster">
            <div className="hud-chip">
              <div className="label">Distance</div>
              <div className="value">
                {Math.round(hud.distance)}
                <small>m</small>
              </div>
            </div>
            <div className="hud-chip">
              <div className="label">Score</div>
              <div className="value">{hud.score.toLocaleString()}</div>
            </div>
            <div className="hud-chip hud-chip-best">
              <div className="label">Best</div>
              <div className="value">
                {Math.round(hud.best)}
                <small>m</small>
              </div>
            </div>
          </div>
          <div className="hud-progress">
            <div className="track">
              <div className="fill" style={{ width: `${Math.min(100, hud.progress * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="hud-cluster">
          <div className="hud-chip" style={{ minWidth: 72, textAlign: 'right' }}>
            <div className="label">Coins</div>
            <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
              <CoinIcon style={{ width: 16, height: 16 }} />
              {hud.coins}
            </div>
          </div>
          <div className="hud-buttons">
            <button className="hud-btn" onClick={onPause} aria-label="Pause" title="Pause (Esc)">
              <PauseIcon />
            </button>
            <button className="hud-btn" onClick={onRestart} aria-label="Restart" title="Restart (R)">
              <RestartIcon />
            </button>
          </div>
        </div>
      </div>

      <div className={`hud-speed ${compact ? 'compact' : ''}`}>
        <div className={`speedo ${hud.airborne ? 'air' : ''}`}>
          <div className="value">{hud.speedKmh}</div>
          <div className="unit">km/h</div>
          <div className="gear-badge">{hud.gear}</div>
        </div>
      </div>
      {hud.airborne && <div className="hud-air-badge">airborne</div>}
    </div>
  );
}
