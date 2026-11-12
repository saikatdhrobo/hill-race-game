import { useState } from 'react';
import type { SaveManager } from '../game/save/SaveManager';
import type { AudioManager } from '../game/audio/AudioManager';
import { VEHICLES, VEHICLE_ORDER } from '../game/vehicles';
import type { VehicleId } from '../game/types';
import { CoinIcon, LockIcon } from './Icons';

interface Props {
  save: SaveManager;
  audio: AudioManager;
  onChange: () => void;
  onBack: () => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <span className="track">
        <span style={{ width: `${Math.min(100, value * 100)}%` }} />
      </span>
    </div>
  );
}

function VehicleSilhouette({ id }: { id: VehicleId }) {
  const v = VEHICLES[id];
  return (
    <svg viewBox="0 0 120 60" fill="none" aria-hidden>
      <rect x="10" y="30" width="100" height="14" rx="5" fill={v.colors.body} />
      <path d="M34 30 46 17h30l12 13z" fill={v.colors.glass} opacity="0.9" />
      <rect x="30" y="24" width="60" height="3" rx="1.5" fill={v.colors.accent} />
      <circle cx="34" cy="46" r="10" fill="#1b1f27" />
      <circle cx="34" cy="46" r="4.4" fill={v.colors.rim} />
      <circle cx="88" cy="46" r="10" fill="#1b1f27" />
      <circle cx="88" cy="46" r="4.4" fill={v.colors.rim} />
    </svg>
  );
}

export function Garage({ save, audio, onChange, onBack }: Props) {
  const data = save.snapshot;
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handle = (id: VehicleId) => {
    if (save.isVehicleUnlocked(id)) {
      save.selectVehicle(id);
      audio.playClick();
    } else if (save.unlockVehicle(id)) {
      audio.playCheckpoint();
      flash(`${VEHICLES[id].name} added to the garage`);
    } else {
      audio.playClick();
      flash(`Need ${VEHICLES[id].cost - save.coins} more coins`);
    }
    onChange();
  };

  return (
    <div className="menu">
      <div className="menu-inner">
        <header className="brand">
          <div className="brand-title">
            <div>
              <h1 className="logo" style={{ fontSize: 'clamp(22px, 3.4vw, 34px)' }}>
                Garage
              </h1>
              <p className="logo-sub">Pick your rig — each one drives differently</p>
            </div>
          </div>
          <div className="wallet">
            <CoinIcon style={{ width: 17, height: 17 }} />
            {save.coins.toLocaleString()}
          </div>
        </header>

        <div className="vehicle-row">
          {VEHICLE_ORDER.map((id) => {
            const v = VEHICLES[id];
            const unlocked = save.isVehicleUnlocked(id);
            const selected = data.selectedVehicle === id;
            return (
              <button
                key={id}
                className={`vehicle-card ${selected ? 'selected' : ''}`}
                onClick={() => handle(id)}
              >
                <span className="vehicle-thumb">
                  <VehicleSilhouette id={id} />
                </span>
                <span className="option-name">
                  {v.name}
                  {!unlocked && <LockIcon style={{ width: 12, height: 12, opacity: 0.7 }} />}
                </span>
                <span className="option-desc">{v.className}</span>
                <span className="option-desc" style={{ minHeight: 32 }}>
                  {v.blurb}
                </span>
                <span className="option-tag">
                  {unlocked ? (selected ? 'Selected' : 'Owned — tap to select') : `Unlock · ${v.cost} coins`}
                </span>
                <span className="mini-stats" style={{ marginTop: 4 }}>
                  <StatBar label="Speed" value={v.maxSpeed / 34} />
                  <StatBar label="Power" value={v.engineForce / v.mass / 16} />
                  <StatBar label="Grip" value={(v.grip - 0.8) / 0.4} />
                  <StatBar label="Susp" value={v.wheel.travel / 0.5} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={onBack}>
            Back to menu
          </button>
          <span className="controls-hint">
            <span className="key">Coins are earned every run — spend them here</span>
          </span>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
