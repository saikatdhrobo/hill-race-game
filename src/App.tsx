import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SaveManager } from './game/save/SaveManager';
import { AudioManager } from './game/audio/AudioManager';
import type { GameEngine } from './game/GameEngine';
import type { CrashReason, HudSnapshot, RunResult } from './game/types';
import { MainMenu } from './ui/MainMenu';
import { Garage } from './ui/Garage';
import { HUD } from './ui/HUD';
import { TouchControls } from './ui/TouchControls';
import { PauseOverlay, ResultOverlay } from './ui/Overlays';
import { SettingsPanel } from './ui/SettingsPanel';
import { GameView } from './ui/GameView';
import './ui/ui.css';

type Screen = 'menu' | 'garage' | 'playing';
type Overlay = 'none' | 'pause' | 'result';

const EMPTY_HUD: HudSnapshot = {
  distance: 0,
  progress: 0,
  score: 0,
  coins: 0,
  speedKmh: 0,
  airborne: false,
  gear: 'D',
  checkpoints: 0,
  best: 0,
};

export default function App() {
  const save = useMemo(() => new SaveManager(), []);
  const audio = useMemo(() => new AudioManager(), []);
  const engineRef = useRef<GameEngine | null>(null);

  const [, setSaveTick] = useState(0);
  const refresh = useCallback(() => setSaveTick((t) => t + 1), []);

  const [screen, setScreen] = useState<Screen>('menu');
  const [runKey, setRunKey] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [result, setResult] = useState<RunResult | null>(null);
  const [crashReason, setCrashReason] = useState<CrashReason | null>(null);
  const [canContinue, setCanContinue] = useState(false);
  const [respawns, setRespawns] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const settings = save.snapshot.settings;

  // audio needs a user gesture before it may play
  useEffect(() => {
    const unlock = () => {
      audio.init();
      audio.setVolumes(settings.sfxVolume, settings.musicVolume, settings.muted);
      if (settings.musicVolume > 0) audio.startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [audio, settings.sfxVolume, settings.musicVolume, settings.muted]);

  useEffect(() => {
    audio.setVolumes(settings.sfxVolume, settings.musicVolume, settings.muted);
  }, [audio, settings.sfxVolume, settings.musicVolume, settings.muted]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) audio.suspend();
      else audio.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [audio]);

  useEffect(() => () => audio.dispose(), [audio]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 1800);
  }, []);

  const startRun = useCallback(() => {
    audio.init();
    audio.resume();
    setResult(null);
    setCrashReason(null);
    setCanContinue(false);
    setOverlay('none');
    setHud(EMPTY_HUD);
    setRunKey((k) => k + 1);
    setScreen('playing');
  }, [audio]);

  const callbacks = useMemo(
    () => ({
      onHud: (snapshot: HudSnapshot) => setHud(snapshot),
      onCrash: (runResult: RunResult, reason: CrashReason) => {
        setResult(runResult);
        setCrashReason(reason);
        setCanContinue((engineRef.current?.respawnsAvailable ?? 0) > 0 && (engineRef.current?.lastCheckpointIndex ?? -1) >= 0);
        setRespawns(engineRef.current?.respawnsAvailable ?? 0);
        setOverlay('result');
        refresh();
      },
      onComplete: (runResult: RunResult) => {
        setResult(runResult);
        setCrashReason(null);
        setCanContinue(false);
        setOverlay('result');
        refresh();
      },
      onCheckpoint: (index: number, left: number) => {
        setRespawns(left);
        showToast(`Checkpoint ${index + 1} reached`);
      },
      onPauseChange: (paused: boolean) => setOverlay(paused ? 'pause' : 'none'),
    }),
    [refresh, showToast],
  );

  const retry = useCallback(() => {
    engineRef.current?.restart();
    setOverlay('none');
    setResult(null);
    setCrashReason(null);
    setCanContinue(false);
  }, []);

  const continueFromCheckpoint = useCallback(() => {
    if (engineRef.current?.continueFromCheckpoint()) {
      setOverlay('none');
      setResult(null);
      setCrashReason(null);
      setCanContinue(false);
    }
  }, []);

  const quitToMenu = useCallback(() => {
    engineRef.current?.abandonRun();
    setScreen('menu');
    setOverlay('none');
    setResult(null);
    setCrashReason(null);
    audio.stopMusic();
    refresh();
  }, [audio, refresh]);

  const lowQuality =
    settings.quality === 'low' ||
    (settings.quality === 'auto' &&
      (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)));

  const playing = screen === 'playing';
  const showControls = settings.showTouchControls !== 'off';

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          save={save}
          audio={audio}
          onChange={refresh}
          onStart={startRun}
          onOpenGarage={() => {
            audio.playClick();
            setScreen('garage');
          }}
          onOpenSettings={() => {
            audio.playClick();
            setSettingsOpen(true);
          }}
        />
      )}

      {screen === 'garage' && (
        <Garage save={save} audio={audio} onChange={refresh} onBack={() => setScreen('menu')} />
      )}

      {playing && (
        <>
          <GameView
            runKey={runKey}
            vehicleId={save.snapshot.selectedVehicle}
            environmentId={save.snapshot.selectedEnvironment}
            difficulty={save.snapshot.difficulty}
            save={save}
            audio={audio}
            lowQuality={lowQuality}
            callbacks={callbacks}
            engineRef={engineRef}
          />
          <HUD
            hud={hud}
            compact={showControls}
            onPause={() => engineRef.current?.pause()}
            onRestart={() => {
              audio.playClick();
              retry();
            }}
          />
          <TouchControls
            engineRef={engineRef}
            visible={overlay === 'none' && showControls}
            onAnyPress={() => audio.init()}
          />

          {overlay === 'pause' && (
            <PauseOverlay
              distance={hud.distance}
              coins={hud.coins}
              respawnsAvailable={engineRef.current?.respawnsAvailable ?? 0}
              onResume={() => engineRef.current?.resume()}
              onRestart={retry}
              onSettings={() => setSettingsOpen(true)}
              onQuit={quitToMenu}
            />
          )}

          {overlay === 'result' && result && (
            <ResultOverlay
              result={result}
              reason={crashReason}
              canContinue={canContinue && respawns > 0}
              respawnsLeft={respawns}
              onRetry={retry}
              onContinue={continueFromCheckpoint}
              onMenu={quitToMenu}
            />
          )}

          {toast && <div className="toast">{toast}</div>}
        </>
      )}

      {settingsOpen && (
        <SettingsPanel
          save={save}
          audio={audio}
          onChange={refresh}
          onClose={() => {
            audio.playClick();
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
