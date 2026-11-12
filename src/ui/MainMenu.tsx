import { useState } from 'react';
import type { SaveManager } from '../game/save/SaveManager';
import type { AudioManager } from '../game/audio/AudioManager';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../game/difficulties';
import { ENVIRONMENTS, ENVIRONMENT_ORDER, type EnvironmentConfig } from '../game/environments';
import { VEHICLES, VEHICLE_ORDER } from '../game/vehicles';
import type { EnvironmentId, VehicleId } from '../game/types';
import {
  CoinIcon,
  GearIcon,
  LockIcon,
  MountainIcon,
  PlayIcon,
  SoundOffIcon,
  SoundOnIcon,
} from './Icons';

interface Props {
  save: SaveManager;
  audio: AudioManager;
  onChange: () => void;
  onStart: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

function envGradient(env: EnvironmentConfig): string {
  return `linear-gradient(160deg, ${env.palette.skyTop} 0%, ${env.palette.skyBottom} 42%, ${env.palette.surfaceHigh} 100%)`;
}

export function MainMenu({ save, audio, onChange, onStart, onOpenGarage, onOpenSettings }: Props) {
  const data = save.snapshot;
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const pickEnvironment = (id: EnvironmentId) => {
    if (save.isEnvironmentUnlocked(id)) {
      save.selectEnvironment(id);
      audio.playClick();
      onChange();
      return;
    }
    const env = ENVIRONMENTS[id];
    if (save.unlockEnvironment(id)) {
      audio.playCheckpoint();
      flash(`${env.name} unlocked!`);
    } else {
      audio.playClick();
      flash(`Need ${env.cost - save.coins} more coins for ${env.name}`);
    }
    onChange();
  };

  const pickVehicle = (id: VehicleId) => {
    if (save.isVehicleUnlocked(id)) {
      save.selectVehicle(id);
      audio.playClick();
      onChange();
    } else {
      flash('Unlock that rig in the garage');
    }
  };

  const toggleSound = () => {
    const muted = !data.settings.muted;
    save.updateSettings({ muted });
    audio.setVolumes(data.settings.sfxVolume, data.settings.musicVolume, muted);
    if (!muted) {
      audio.init();
      audio.playClick();
    }
    onChange();
  };

  const selectedEnv = ENVIRONMENTS[data.selectedEnvironment];
  const selectedVehicle = VEHICLES[data.selectedVehicle];
  const unlockedVehicles = VEHICLE_ORDER.filter((id) => save.isVehicleUnlocked(id));

  return (
    <div className="menu">
      <div className="menu-inner">
        <header className="brand">
          <div className="brand-title">
            <div className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M2 18.5 8 7l3 5.4L14 6l8 12.5z" fill="#201302" />
                <circle cx="8.2" cy="19" r="1.6" fill="#201302" />
                <circle cx="16" cy="19" r="1.6" fill="#201302" />
              </svg>
            </div>
            <div>
              <h1 className="logo">Ridgeline Rally</h1>
              <p className="logo-sub">3D hill driving · five worlds · five rigs</p>
            </div>
          </div>
          <div className="brand" style={{ gap: 10 }}>
            <div className="wallet" title="Coins">
              <CoinIcon style={{ width: 17, height: 17 }} />
              {save.coins.toLocaleString()}
            </div>
            <button
              className="btn btn-icon btn-ghost"
              onClick={toggleSound}
              aria-label={data.settings.muted ? 'Enable sound' : 'Mute sound'}
              title={data.settings.muted ? 'Enable sound' : 'Mute sound'}
            >
              {data.settings.muted ? (
                <SoundOffIcon style={{ width: 20, height: 20 }} />
              ) : (
                <SoundOnIcon style={{ width: 20, height: 20 }} />
              )}
            </button>
            <button className="btn btn-icon btn-ghost" onClick={onOpenSettings} aria-label="Settings" title="Settings">
              <GearIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </header>

        <div className="menu-grid">
          <div className="panel">
            <h2>Difficulty</h2>
            <p className="panel-note">{DIFFICULTIES[data.difficulty].blurb}</p>
            <div className="option-grid three">
              {DIFFICULTY_ORDER.map((id) => {
                const diff = DIFFICULTIES[id];
                return (
                  <button
                    key={id}
                    className={`option ${data.difficulty === id ? 'selected' : ''}`}
                    onClick={() => {
                      save.setDifficulty(id);
                      audio.playClick();
                      onChange();
                    }}
                  >
                    <span className="option-name">{diff.label}</span>
                    <span className="option-desc">{diff.tagline}</span>
                    <span className="option-tag">{diff.trackLength} m track</span>
                  </button>
                );
              })}
            </div>

            <h2 style={{ marginTop: 20 }}>World</h2>
            <p className="panel-note">
              {selectedEnv.tagline} — {selectedEnv.description}
            </p>
            <div className="env-grid">
              {ENVIRONMENT_ORDER.map((id) => {
                const env = ENVIRONMENTS[id];
                const unlocked = save.isEnvironmentUnlocked(id);
                const best = save.bestFor(id);
                return (
                  <button
                    key={id}
                    className={`option ${data.selectedEnvironment === id ? 'selected' : ''}`}
                    onClick={() => pickEnvironment(id)}
                    style={{ padding: 10, minHeight: 0 }}
                  >
                    <span className="env-swatch" style={{ background: envGradient(env) }}>
                      <MountainIcon />
                    </span>
                    <span className="option-name" style={{ marginTop: 6, fontSize: 13 }}>
                      {env.name}
                    </span>
                    <span className="option-desc">
                      {unlocked ? `Best ${Math.round(best)} m` : `Grip ${Math.round(env.grip * 100)}%`}
                    </span>
                    {!unlocked && (
                      <span className="option-lock">
                        <LockIcon style={{ width: 11, height: 11 }} />
                        {env.cost}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <h2>Garage</h2>
            <p className="panel-note">
              <b style={{ color: 'var(--text)' }}>{selectedVehicle.name}</b> · {selectedVehicle.className}
            </p>
            <div className="option-grid two">
              {unlockedVehicles.map((id) => {
                const v = VEHICLES[id];
                return (
                  <button
                    key={id}
                    className={`option ${data.selectedVehicle === id ? 'selected' : ''}`}
                    onClick={() => pickVehicle(id)}
                  >
                    <span className="option-name">{v.name}</span>
                    <span className="option-desc">{v.className}</span>
                  </button>
                );
              })}
            </div>
            <div className="spec-list">
              <div className="spec">
                <span>Top speed</span>
                <b>{Math.round(selectedVehicle.maxSpeed * 3.6)} km/h</b>
              </div>
              <div className="spec">
                <span>Weight</span>
                <b>{selectedVehicle.mass} kg</b>
              </div>
              <div className="spec">
                <span>Grip</span>
                <b>{Math.round(selectedVehicle.grip * 100)}%</b>
              </div>
              <div className="spec">
                <span>Power</span>
                <b>{Math.round(selectedVehicle.engineForce / selectedVehicle.mass / 10)} / 10</b>
              </div>
            </div>
            <button className="btn btn-ghost btn-small" style={{ marginTop: 14, width: '100%' }} onClick={onOpenGarage}>
              Open full garage · {VEHICLE_ORDER.length} rigs
            </button>

            <div style={{ marginTop: 18 }}>
              <h2>Records</h2>
              <div className="spec-list">
                <div className="spec">
                  <span>Best distance</span>
                  <b>{Math.round(data.bestDistance)} m</b>
                </div>
                <div className="spec">
                  <span>Runs driven</span>
                  <b>{data.stats.runs}</b>
                </div>
                <div className="spec">
                  <span>Coins earned</span>
                  <b>{data.stats.totalCoins}</b>
                </div>
                <div className="spec">
                  <span>Total distance</span>
                  <b>{(data.stats.totalDistance / 1000).toFixed(1)} km</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" onClick={onStart}>
            <PlayIcon style={{ width: 18, height: 18 }} />
            Drive {ENVIRONMENTS[data.selectedEnvironment].name}
          </button>
          <div className="controls-hint">
            <span className="key">W / ↑ accelerate</span>
            <span className="key">S / ↓ brake · reverse</span>
            <span className="key">A D / ← → steer · air balance</span>
            <span className="key">Space handbrake</span>
            <span className="key">R restart</span>
            <span className="key">Esc pause</span>
          </div>
        </div>

        <div className="menu-footer">
          <span>
            Arrow keys, mouse and touch all drive · progress saves locally
          </span>
          <span>{toast ? '' : 'Tip: press and hold the on-screen pedals on mobile'}</span>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
