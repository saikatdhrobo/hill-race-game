import { useState } from 'react';
import type { SaveManager } from '../game/save/SaveManager';
import type { AudioManager } from '../game/audio/AudioManager';

interface Props {
  save: SaveManager;
  audio: AudioManager;
  onChange: () => void;
  onClose: () => void;
}

export function SettingsPanel({ save, audio, onChange, onClose }: Props) {
  const settings = save.snapshot.settings;
  const [confirmReset, setConfirmReset] = useState(false);

  const update = (patch: Partial<typeof settings>) => {
    save.updateSettings(patch);
    const next = { ...settings, ...patch };
    audio.setVolumes(next.sfxVolume, next.musicVolume, next.muted);
    onChange();
  };

  return (
    <div className="overlay" style={{ zIndex: 26 }}>
      <div className="card">
        <h2>Settings</h2>
        <p className="sub">Audio, performance and touch preferences are saved on this device.</p>

        <div className="row">
          <div>
            <div className="row-label">Master mute</div>
            <div className="row-hint">Turns off engine, effects and music</div>
          </div>
          <div className="seg">
            <button className={!settings.muted ? 'active' : ''} onClick={() => update({ muted: false })}>
              Sound on
            </button>
            <button className={settings.muted ? 'active' : ''} onClick={() => update({ muted: true })}>
              Muted
            </button>
          </div>
        </div>

        <div className="row">
          <div>
            <div className="row-label">Effects volume</div>
            <div className="row-hint">Engine, coins, impacts</div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
          />
        </div>

        <div className="row">
          <div>
            <div className="row-label">Music volume</div>
            <div className="row-hint">Ambient bed</div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => update({ musicVolume: Number(e.target.value) })}
          />
        </div>

        <div className="row">
          <div>
            <div className="row-label">Graphics quality</div>
            <div className="row-hint">Auto lowers resolution if the frame rate drops</div>
          </div>
          <div className="seg">
            {(['auto', 'low', 'high'] as const).map((q) => (
              <button key={q} className={settings.quality === q ? 'active' : ''} onClick={() => update({ quality: q })}>
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div>
            <div className="row-label">On-screen controls</div>
            <div className="row-hint">Show the touch / click pedals while driving</div>
          </div>
          <div className="seg">
            {(['auto', 'on', 'off'] as const).map((v) => (
              <button
                key={v}
                className={settings.showTouchControls === v ? 'active' : ''}
                onClick={() => update({ showTouchControls: v })}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div>
            <div className="row-label">Reset progress</div>
            <div className="row-hint">Clears coins, unlocks and records on this device</div>
          </div>
          {confirmReset ? (
            <div className="seg">
              <button
                className="active"
                onClick={() => {
                  save.reset();
                  audio.playClick();
                  onChange();
                  setConfirmReset(false);
                }}
              >
                Confirm
              </button>
              <button onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-small btn-ghost" onClick={() => setConfirmReset(true)}>
              Reset
            </button>
          )}
        </div>

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
